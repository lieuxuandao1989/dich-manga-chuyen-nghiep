import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for high-res manga images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global round-robin counter and cooldown tracker for automatic API key rotation
  let globalRoundRobinCounter = 0;
  const keyCooldownMap = new Map<string, number>(); // key -> cooldown timestamp (ms)

  function maskApiKey(key: string): string {
    if (!key) return '';
    const clean = key.trim();
    if (clean.length <= 8) return '***';
    return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
  }

  // Extract all available keys from server environment
  function getServerEnvKeys(): string[] {
    const envKeys: string[] = [];

    if (process.env.SHOPAIKEY_API_KEY && process.env.SHOPAIKEY_API_KEY.trim()) {
      envKeys.push(process.env.SHOPAIKEY_API_KEY.trim());
    }

    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      envKeys.push(process.env.GEMINI_API_KEY.trim());
    }

    if (process.env.GEMINI_API_KEYS) {
      const parsed = process.env.GEMINI_API_KEYS.split(/[,;\n\r\s]+/).map((k) => k.trim()).filter(Boolean);
      envKeys.push(...parsed);
    }

    for (let i = 1; i <= 10; i++) {
      const k = process.env[`GEMINI_API_KEY_${i}`];
      if (k && k.trim()) {
        envKeys.push(k.trim());
      }
    }

    return Array.from(new Set(envKeys)).filter(
      (k) => k && !k.startsWith('MY_GEMINI_') && k.length > 5
    );
  }

  // Combine and deduplicate client keys and server keys (up to 10 keys maximum)
  // Supports both official Google Gemini keys (AIzaSy...) and ShopAIKey keys (sk-...)
  function resolveKeyPool(requestBody: any, headers: any): string[] {
    const customList: string[] = [];

    // Keys passed from client settings or request body (support both array and multi-line strings)
    const clientKeys = requestBody.apiKeys || requestBody.settings?.apiKeys;
    const rawItems = Array.isArray(clientKeys) ? clientKeys : [clientKeys];

    for (const item of rawItems) {
      if (typeof item === 'string') {
        const tokens = item
          .split(/[\s,;\n\r]+/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 10 && !s.startsWith('AQ.Ab8'));
        customList.push(...tokens);
      }
    }

    // Fallback single key
    const singleKey = requestBody.apiKey || requestBody.settings?.apiKey || (headers['x-api-key'] as string);
    if (typeof singleKey === 'string') {
      const tokens = singleKey
        .split(/[\s,;\n\r]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 10 && !s.startsWith('AQ.Ab8'));
      customList.push(...tokens);
    }

    const uniqueCustom = Array.from(new Set(customList)).filter(Boolean);
    const isPaid = requestBody.apiTier === 'paid' || requestBody.settings?.apiTier === 'paid';

    let finalPool: string[] = [];

    if (uniqueCustom.length > 0) {
      // If user provided a ShopAIKey (sk-...), strictly isolate to ShopAIKey(s)
      // to avoid routing paid requests to expired Google Free API endpoints
      if (uniqueCustom.some((k) => k.startsWith('sk-'))) {
        finalPool = uniqueCustom.filter((k) => k.startsWith('sk-'));
      } else {
        finalPool = uniqueCustom;
      }
    } else {
      // No custom keys passed: use server environment keys (excluding any stale AQ.Ab8 tokens)
      const serverKeys = getServerEnvKeys().filter((k) => !k.startsWith('AQ.Ab8'));
      finalPool = Array.from(new Set(serverKeys));
      if (isPaid && finalPool.some((k) => k.startsWith('sk-'))) {
        finalPool = finalPool.filter((k) => k.startsWith('sk-'));
      }
    }

    return finalPool.slice(0, 10);
  }

  // Calculate estimated cost in USD based on official Google Gemini API pricing
  function calculateTokenCost(model: string, promptTokens: number, outputTokens: number): number {
    if (model.includes('3.8-flash')) {
      // Gemini 3.8 Flash preview pricing: $0.15 per 1M prompt, $0.60 per 1M output
      return (promptTokens * 0.15 + outputTokens * 0.60) / 1_000_000;
    }
    if (model.includes('3.1-flash-lite')) {
      // Gemini 3.1 Flash Lite Preview: $0.075 per 1M prompt, $0.30 per 1M output
      return (promptTokens * 0.075 + outputTokens * 0.30) / 1_000_000;
    }
    // Gemini 3.6 Flash / Flash-lite pricing: $0.075 per 1M prompt, $0.30 per 1M output
    return (promptTokens * 0.075 + outputTokens * 0.30) / 1_000_000;
  }

  // Execute Gemini operation with per-page key rotation and instant failover on 503/429/network errors
  async function executeWithKeyRotation<T>(
    pool: string[],
    targetPageIndex: number | undefined,
    operation: (
      ai: GoogleGenAI,
      keyInfo: { keyIndex: number; totalKeys: number; keyMasked: string; model: string; tier: 'free' | 'paid' }
    ) => Promise<T>,
    options?: {
      apiTier?: 'free' | 'paid';
      preferredModel?: string;
    }
  ): Promise<{
    result: T;
    keyInfo: { keyIndex: number; totalKeys: number; keyMasked: string; model: string; rotated: boolean; tier: 'free' | 'paid' };
  }> {
    if (pool.length === 0) {
      throw new Error(
        'Chưa có Gemini API Key nào được thiết lập. Vui lòng mở Cài đặt (⚙️) và nhập các API Key để kích hoạt tính năng tự động xoay tua.'
      );
    }

    const isPaidTier = options?.apiTier === 'paid';
    const totalKeys = pool.length;

    // Per-page rotation strategy
    const startingIndex =
      typeof targetPageIndex === 'number' && targetPageIndex >= 0
        ? Math.abs(targetPageIndex) % totalKeys
        : Math.abs(globalRoundRobinCounter++) % totalKeys;

    let lastError: any = null;
    let hasRotated = false;

    // Candidate keys ordered starting from startingIndex
    const rawCandidateIndices: number[] = [];
    for (let offset = 0; offset < totalKeys; offset++) {
      rawCandidateIndices.push((startingIndex + offset) % totalKeys);
    }

    // Filter out keys that are currently in cooldown (e.g. permanent quota exceeded)
    const now = Date.now();
    let candidateIndices = rawCandidateIndices.filter(
      (idx) => (keyCooldownMap.get(pool[idx]) || 0) <= now
    );
    if (candidateIndices.length === 0) {
      // If all keys are in cooldown, pick the one that has the shortest remaining cooldown
      candidateIndices = [...rawCandidateIndices].sort(
        (a, b) => (keyCooldownMap.get(pool[a]) || 0) - (keyCooldownMap.get(pool[b]) || 0)
      );
    }

    const maxPasses = candidateIndices.length > 1 ? 2 : 3;

    // Model priority based on API Tier & user selection (supports gemini-3.6-flash & gemini-3.1-flash-lite-preview / gemini-3.1-flash-lite)
    const preferred = options?.preferredModel;
    let modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    if (preferred) {
      const isLite = preferred.includes('flash-lite');
      modelsToTry = isLite
        ? ['gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash-lite']
        : ['gemini-3.6-flash', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
    } else if (isPaidTier) {
      modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-lite'];
    }

    for (let pass = 0; pass < maxPasses; pass++) {
      for (let attempt = 0; attempt < candidateIndices.length; attempt++) {
        const keyIdx = candidateIndices[attempt];
        const key = pool[keyIdx];
        const isShopAIKey = key.startsWith('sk-');
        const masked = maskApiKey(key) + (isShopAIKey ? ' [ShopAIKey]' : '');

        const httpOptions: any = {
          headers: {
            'User-Agent': 'aistudio-build-manga',
          },
        };
        if (isShopAIKey) {
          // ShopAIKey provides direct proxy support for Google GenAI SDK
          httpOptions.baseUrl = 'https://api.shopaikey.com';
        }

        const ai = new GoogleGenAI({
          apiKey: key,
          httpOptions,
        });

        // Try models in priority order
        for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
          const currentModel = modelsToTry[mIdx];

          try {
            const tierPrefix = isPaidTier ? '⚡ [Paid Tier]' : '🆓 [Free Tier]';
            if (attempt > 0 || pass > 0 || mIdx > 0) {
              console.log(
                `[Key Rotator] ${tierPrefix} 🔄 Xoay tua Trang #${(targetPageIndex ?? 0) + 1} sang Key #${keyIdx + 1}/${totalKeys} (${masked}) [${currentModel}]`
              );
              hasRotated = true;
            } else {
              console.log(
                `[Key Rotator] ${tierPrefix} 📖 Trang #${(targetPageIndex ?? 0) + 1} sử dụng Key #${keyIdx + 1}/${totalKeys} (${masked}) [${currentModel}]`
              );
            }

            const result = await operation(ai, {
              keyIndex: keyIdx + 1,
              totalKeys,
              keyMasked: masked,
              model: currentModel,
              tier: isPaidTier ? 'paid' : 'free',
            });

            // Request succeeded: clear any cooldown for this key
            keyCooldownMap.delete(key);

            return {
              result,
              keyInfo: {
                keyIndex: keyIdx + 1,
                totalKeys,
                keyMasked: masked,
                model: currentModel,
                rotated: hasRotated,
                tier: isPaidTier ? 'paid' : 'free',
              },
            };
          } catch (err: any) {
            lastError = err;
            const errStr = err?.message || String(err);

            const is503HighDemand =
              errStr.includes('503') ||
              errStr.includes('UNAVAILABLE') ||
              errStr.includes('high demand') ||
              errStr.includes('overloaded');

            const isRateLimit =
              errStr.includes('429') ||
              errStr.includes('RESOURCE_EXHAUSTED') ||
              errStr.includes('Quota exceeded') ||
              errStr.includes('Too Many Requests');

            const isAuthError =
              errStr.includes('API_KEY_INVALID') ||
              errStr.includes('API key not valid') ||
              errStr.includes('forbidden') ||
              errStr.includes('PERMISSION_DENIED');

            const isNetworkOrServerError =
              errStr.includes('500') ||
              errStr.includes('502') ||
              errStr.includes('504') ||
              errStr.includes('DEADLINE_EXCEEDED') ||
              errStr.includes('fetch failed') ||
              errStr.includes('ECONNRESET');

            if (is503HighDemand) {
              // 503 high demand on current model: try next model on same key first
              if (mIdx < modelsToTry.length - 1) {
                console.warn(
                  `[Key Rotator] ⚠️ Key #${keyIdx + 1} gặp lỗi 503 (High demand) trên ${currentModel}. Đang thử fallback sang ${modelsToTry[mIdx + 1]}...`
                );
                continue; // try next model
              } else {
                keyCooldownMap.set(key, Date.now() + 10000);
                console.warn(
                  `[Key Rotator] ⚠️ Key #${keyIdx + 1}/${totalKeys} (${masked}) bị 503 trên tất cả models. Tự động chuyển sang Key tiếp theo trong danh sách...`
                );
                break; // break to next key
              }
            } else if (isRateLimit) {
              console.warn(
                `[Key Rotator] ⚠️ Key #${keyIdx + 1}/${totalKeys} (${masked}) chạm giới hạn 429/Quota: ${errStr.slice(0, 120)}`
              );

              const isPermanentQuotaExceeded =
                (errStr.includes('exceeded your current quota') ||
                 errStr.includes('check your plan and billing details') ||
                 errStr.includes('spending cap')) &&
                !errStr.includes('Too Many Requests');

              // If key has completely exhausted its plan/quota (0 balance), deactivate it for 24h
              if (isPermanentQuotaExceeded && !isShopAIKey) {
                keyCooldownMap.set(key, Date.now() + 86400000);
                console.warn(
                  `[Key Rotator] 🛑 Key #${keyIdx + 1}/${totalKeys} (${masked}) đã hết hạn mức tài khoản (bị vô hiệu hóa khỏi danh sách xoay tua 24h).`
                );
                break; // break to next key immediately
              }

              // Temporary RPM/TPM rate limit on active key: auto pause & retry
              if (candidateIndices.length === 1 || attempt === candidateIndices.length - 1) {
                const backoffMs = (pass + 1) * 3000;
                console.log(
                  `[Key Rotator] ⚡ Tạm nghỉ ${backoffMs / 1000}s để hồi phục Rate Limit rồi thử lại (lần ${pass + 1}/${maxPasses})...`
                );
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
              }

              // 429 quota fallback to flash-lite if available
              if (mIdx < modelsToTry.length - 1 && modelsToTry[mIdx + 1] === 'gemini-2.5-flash-lite') {
                console.warn(
                  `[Key Rotator] ⚠️ Key #${keyIdx + 1} chạm giới hạn trên ${currentModel}. Thử fallback sang gemini-2.5-flash-lite...`
                );
                continue;
              }
              keyCooldownMap.set(key, Date.now() + (isPaidTier ? 8000 : 20000));
              break; // break to next key
            } else if (isAuthError) {
              // Invalid API key: long cooldown and rotate to next key
              keyCooldownMap.set(key, Date.now() + 300000);
              console.warn(
                `[Key Rotator] ❌ Key #${keyIdx + 1}/${totalKeys} (${masked}) không hợp lệ. Đổi sang Key khác...`
              );
              break; // break to next key
            } else if (isNetworkOrServerError) {
              console.warn(
                `[Key Rotator] ⚠️ Lỗi kết nối mạng/máy chủ (${errStr.slice(0, 80)}). Thử Key tiếp theo...`
              );
              break; // break to next key
            } else {
              // If there's another fallback model available in the list, try it on the same key!
              if (mIdx < modelsToTry.length - 1) {
                console.warn(
                  `[Key Rotator] ⚠️ Model ${currentModel} gặp lỗi (${errStr.slice(0, 80)}). Thử fallback sang ${modelsToTry[mIdx + 1]}...`
                );
                continue;
              }

              // Generic error: if more keys are available, try next key
              if (attempt < candidateIndices.length - 1 || pass < maxPasses - 1) {
                console.warn(
                  `[Key Rotator] ⚠️ Gặp lỗi: ${errStr.slice(0, 80)}. Tiếp tục xoay sang Key tiếp theo...`
                );
                break;
              }
              // Last attempt
              throw err;
            }
          }
        }
      }

      // If all keys had errors in this pass, wait a moment before second pass
      if (pass < maxPasses - 1) {
        const waitMs = (pass + 1) * 2000;
        console.warn(
          `[Key Rotator] Tất cả ${totalKeys} keys đang bận/rate limit. Tạm dừng ${waitMs / 1000}s trước khi tự động xoay tua lại...`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    // Convert raw error into a user-friendly Vietnamese message
    let rawErrorSnippet = lastError?.message || String(lastError || '');
    let cleanMessage = rawErrorSnippet || 'Không thể dịch trang này.';

    try {
      if (rawErrorSnippet.includes('{') && rawErrorSnippet.includes('}')) {
        const jsonMatch = rawErrorSnippet.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error?.message) {
            rawErrorSnippet = parsed.error.message;
            if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
              cleanMessage =
                'Máy chủ AI của Google đang quá tải tạm thời (Lỗi 503: High demand). Hệ thống đã tự động thử xoay qua các API Key. Vui lòng bấm "Thử lại" sau vài giây.';
            } else if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
              const lowerMsg = rawErrorSnippet.toLowerCase();
              const isSpendCap =
                lowerMsg.includes('spending cap') ||
                lowerMsg.includes('spend cap') ||
                lowerMsg.includes('exceeded its monthly');
              const isLimit15 = rawErrorSnippet.includes("limit '15'") || rawErrorSnippet.includes('limit: 15');

              if (isSpendCap) {
                cleanMessage =
                  'Dự án Google của bạn đã chạm mức Trần ngân sách tháng (Monthly Spending Cap). Google tạm dừng API để ngăn chi phí phát sinh ngoài ý muốn. Vui lòng truy cập https://ai.studio/spend để nâng/gỡ mức Spend Cap, hoặc thêm 1 API Key từ dự án Google Cloud khác trong Cài đặt (⚙️). Toàn bộ các trang bạn đã dịch trước đó vẫn được lưu an toàn!';
              } else if (isLimit15) {
                cleanMessage =
                  'Google API báo lỗi hạn ngạch (429: Giới hạn 15 lượt/phút của Free Tier). Lưu ý quan trọng: Dù tài khoản Google đã có thẻ thanh toán, API Key này có thể thuộc Project chưa liên kết Thẻ thanh toán (Billing Account) trên Google Cloud Console (AI Studio mặc định tạo Project Free Tier). Vui lòng kiểm tra Billing của Project chứa Key này trên Google Cloud.';
              } else if (isPaidTier) {
                cleanMessage =
                  'API Key trả phí tạm thời chạm giới hạn gọi (Lỗi 429: Quota / Rate limit). Nguyên nhân có thể do: 1) Project chưa gán Billing Account trên Google Cloud; 2) Chạm giới hạn lượt gọi/phút hoặc ngân sách trần (Budget Cap); 3) Quá nhiều request song song. Vui lòng đợi 10-20 giây rồi bấm Thử lại.';
              } else {
                cleanMessage =
                  'Đã vượt quá giới hạn lượt gọi miễn phí của các API Key khả dụng (Lỗi 429: 15 lượt/phút). Vui lòng đợi 20-30 giây để Google nạp lại quota, hoặc chuyển sang Gói Trả Phí / thêm thêm API Key trong Cài đặt (⚙️).';
              }
            } else if (parsed.error.code === 400 && rawErrorSnippet.includes('API key not valid')) {
              cleanMessage =
                'Khóa API không hợp lệ hoặc đã hết hạn (Lỗi 400: API key not valid). Nếu dùng Google Gemini, hãy kiểm tra khóa AIzaSy... tại https://aistudio.google.com/app/apikey. Nếu dùng ShopAIKey, hãy kiểm tra số dư và tình trạng khóa sk-... tại https://shopaikey.com.';
            } else {
              cleanMessage = `${parsed.error.message} (Mã lỗi ${parsed.error.code || 500})`;
            }
          }
        }
      }
    } catch {}

    // If still raw 429 string
    if (
      cleanMessage.includes('429') ||
      cleanMessage.includes('RESOURCE_EXHAUSTED') ||
      cleanMessage.includes('Quota exceeded')
    ) {
      const lowerMsg = rawErrorSnippet.toLowerCase();
      const isSpendCap =
        lowerMsg.includes('spending cap') ||
        lowerMsg.includes('spend cap') ||
        lowerMsg.includes('exceeded its monthly');
      const isLimit15 = rawErrorSnippet.includes("limit '15'") || rawErrorSnippet.includes('limit: 15');

      if (isSpendCap) {
        cleanMessage =
          'Dự án Google của bạn đã chạm mức Trần ngân sách tháng (Monthly Spending Cap). Google tạm dừng API để ngăn chi phí phát sinh ngoài ý muốn. Vui lòng truy cập https://ai.studio/spend để nâng/gỡ mức Spend Cap, hoặc thêm 1 API Key từ dự án Google Cloud khác trong Cài đặt (⚙️). Toàn bộ các trang bạn đã dịch trước đó vẫn được lưu an toàn!';
      } else if (isLimit15) {
        cleanMessage =
          'Google API báo lỗi hạn ngạch (429: Giới hạn 15 lượt/phút của Free Tier). Lưu ý: Dù tài khoản Google đã có thẻ thanh toán, API Key này có thể thuộc Project chưa liên kết Thẻ thanh toán (Billing Account) trên Google Cloud Console (AI Studio mặc định tạo Project Free Tier). Vui lòng kiểm tra Billing của Project trên Google Cloud.';
      } else if (isPaidTier) {
        cleanMessage =
          'API Key trả phí tạm thời chạm giới hạn gọi (Lỗi 429: Quota / Rate limit). Nguyên nhân có thể do: 1) Project chưa gán Billing Account trên Google Cloud; 2) Chạm giới hạn lượt gọi/phút hoặc ngân sách trần (Budget Cap); 3) Quá nhiều request song song. Vui lòng đợi 10-20 giây rồi bấm Thử lại.';
      } else {
        cleanMessage =
          'Đã vượt quá giới hạn lượt gọi miễn phí của các API Key khả dụng (Lỗi 429: 15 lượt/phút). Vui lòng đợi 20-30 giây để Google nạp lại quota, hoặc chuyển sang Gói Trả Phí / thêm thêm API Key trong Cài đặt (⚙️).';
      }
    }

    throw new Error(cleanMessage);
  }

  // Smart Context & Pronoun Refinement Safeguard
  // Helper to refine and enforce pronoun consistency
  function refinePronounsSmartly(boxes: any[], previousContext: string = '', settings: any = {}): any[] {
    if (!boxes || !Array.isArray(boxes)) return boxes;

    const combinedContext = [
      previousContext,
      ...boxes.map((b) => `${b.originalText || ''} ${b.translatedText || ''}`),
    ].join(' ');

    // Check if mother-son context is present:
    // e.g. male addresses female as "mẹ", "mẹ ơi", "thưa mẹ", "mẹ à", "chào mẹ", "mom", "mother", "mama"
    const isMotherSonContext = /(?:^|[^\p{L}])(?:mẹ\s*ơi|con\s*chào\s*mẹ|thưa\s*mẹ|mẹ\s*à|chào\s*mẹ|với\s*mẹ|của\s*mẹ|cho\s*mẹ|mom|mother|mama)(?:[^\p{L}]|$)/iu.test(
      combinedContext
    );

    // Check if male-female peer context or preference is present
    const isMaleFemaleContext =
      /(?:^|[^\p{L}])(?:anh|em|cô\s*bé|cậu\s*bé|bạn\s*gái|bạn\s*trai|nữ\s*sinh|nam\s*sinh)(?:[^\p{L}]|$)/iu.test(combinedContext) ||
      (settings?.addressingPairs && settings.addressingPairs.includes('Anh - Em'));

    return boxes.map((box) => {
      let text = box.translatedText;
      if (!text || typeof text !== 'string') return box;

      if (isMotherSonContext) {
        // Son or mother speaking in mother-son context: Ensure "cậu - tớ" is not used
        const isSonSpeaking = /(?:mẹ|mom|mother)/i.test(box.originalText || '') || /(?:mẹ|thưa|ơi|à)/i.test(text);
        if (isSonSpeaking) {
          text = text
            .replace(/\bCẬU\b/g, 'MẸ')
            .replace(/\bTỚ\b/g, 'CON')
            .replace(/\bCậu\b/g, 'Mẹ')
            .replace(/\btớ\b/g, 'con')
            .replace(/\bTÔI\b/g, 'CON')
            .replace(/\bBẠN\b/g, 'MẸ')
            .replace(/\bTôi\b/g, 'Con')
            .replace(/\bbạn\b/g, 'mẹ');
        } else {
          text = text
            .replace(/\bCẬU\b/g, 'CON')
            .replace(/\bTỚ\b/g, 'MẸ')
            .replace(/\bCậu\b/g, 'Con')
            .replace(/\btớ\b/g, 'mẹ')
            .replace(/\bTÔI\b/g, 'MẸ')
            .replace(/\bBẠN\b/g, 'CON')
            .replace(/\bTôi\b/g, 'Mẹ')
            .replace(/\bbạn\b/g, 'con');
        }
      } else if (isMaleFemaleContext) {
        // Replace stiff "cậu - tớ" with "anh - em" for male-female peers
        const isFemaleSpeaking = /(?:em|chan|nữ)/i.test(text) || /(?:em)/i.test(box.originalText || '');
        if (isFemaleSpeaking) {
          text = text
            .replace(/\bCẬU\b/g, 'ANH')
            .replace(/\bTỚ\b/g, 'EM')
            .replace(/\bCậu\b/g, 'Anh')
            .replace(/\btớ\b/g, 'em');
        } else {
          text = text
            .replace(/\bCẬU\b/g, 'EM')
            .replace(/\bTỚ\b/g, 'ANH')
            .replace(/\bCậu\b/g, 'Em')
            .replace(/\btớ\b/g, 'anh');
        }
      }

      return {
        ...box,
        translatedText: text,
      };
    });
  }

  // API Endpoint: Translate Manga Page
  app.post('/api/translate-page', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/png', settings = {}, pageIndex, previousContext = '' } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Hình ảnh không hợp lệ hoặc bị thiếu.' });
      }

      const pool = resolveKeyPool(req.body, req.headers);
      if (pool.length === 0) {
        return res.status(400).json({
          error:
            'Chưa cấu hình Gemini API Key. Vui lòng mở Cài đặt (⚙️) và nhập các API Key để kích hoạt tính năng tự động xoay tua.',
        });
      }

      // Clean base64 string
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1].trim() : imageBase64.trim();

      // Ensure mimeType is a valid image mimeType supported by Gemini
      let validMimeType = mimeType;
      if (!validMimeType || !validMimeType.startsWith('image/')) {
        validMimeType = 'image/png';
      }

      const tone = settings.tone || 'natural';
      const addressingPairs = settings.addressingPairs || 'Anh - Em, Con - Mẹ, Cậu - Tớ, Ta - Ngươi, Tôi - Bạn';
      const isPaidTier = settings.apiTier === 'paid';
      const deepNuanceActive = settings.deepNuance || isPaidTier;

      const deepNuancePrompt = deepNuanceActive
        ? `
   - DEEP LITERARY MANGA LOCALIZATION:
     * Carefully analyze facial expressions, character emotions, dynamic scene pacing, and interpersonal relationships.
     * Translate speech bubbles into smooth, authentic Vietnamese comic dialog (lời thoại tự nhiên, sinh động, chuẩn văn phong truyện tranh xuất bản chuyên nghiệp, tuyệt đối không dịch máy thô cứng).
     * Localize humor, slang, idioms, puns, and honorifics naturally according to the context of each scene.`
        : '';

      const contextSection = previousContext && previousContext.trim().length > 0
        ? `
PREVIOUS STORY CONTEXT FROM PRECEDING PAGES (NGỮ CẢNH CÁC TRANG TRƯỚC ĐÓ ĐỂ NHẬN DIỆN MỐI QUAN HỆ NHÂN VẬT):
"""
${previousContext.trim()}
"""
CRITICAL: Use the previous dialogue above to accurately identify relationships and maintain seamless continuity!
`
        : '';

      const prompt = `You are an expert manga OCR and English to Vietnamese translator.
Analyze this manga page image carefully.
Locate dialogue text regions (speech bubbles, thought bubbles, dialogue captions, titles, or box labels).
CRITICAL RULE: DO NOT LOCATE OR TRANSLATE SOUND EFFECTS (SFX)!
${contextSection}
CRITICAL INSTRUCTIONS FOR DIALOGUE & BOUNDING BOXES:
1. STRICT FILTER: DO NOT DETECT OR TRANSLATE SOUND EFFECTS (SFX / ÂM THANH):
   - ABSOLUTELY DO NOT detect, extract, or translate sound effects (SFX), sound words, action noises, background onomatopoeia, or sound lettering drawn over action/characters (such as "BOOM", "CRASH", "THUD", "DOKI", "WHAM", "SWOOSH", "RUMBLE", "CLANG", "PFFT", "AAARGH", "BADUMP", etc.).
   - Leave ALL SFX completely untouched on the original artwork.
   - ONLY detect and translate character dialogue, spoken words, thoughts, and narration boxes.

2. FULL DIALOGUE BOUNDING BOX (BAO TRỌN TẤT CẢ CÁC DÒNG CHỮ TRONG BÓNG THOẠI):
   - Provide the 2D bounding box [ymin, xmin, ymax, xmax] normalized on a scale from 0 to 1000 (0,0 is top-left, 1000,1000 is bottom-right).
   - In manga speech bubbles, dialogue frequently spans multiple lines (e.g. 4 to 6 lines, such as "PLEASE DO A DOUBLE" at the top followed by "LEG TAKE-DOWN, PLEASE." at the bottom).
   - CRITICAL: [ymin, xmin, ymax, xmax] MUST EXTEND FROM THE TOP OF THE FIRST WORD ALL THE WAY TO THE BOTTOM OF THE VERY LAST WORD AT THE BOTTOM OF THE BUBBLE (e.g. ymax MUST be below "LEG TAKE-DOWN, PLEASE.").
   - ABSOLUTELY NEVER cut off or stop halfway through the bubble! Do NOT leave bottom lines or top lines of dialogue exposed.
   - The box [ymin, xmin, ymax, xmax] must encompass the entire dialogue area so that the background mask and translated text cover and obliterate 100% of the English text inside the bubble.
   - Do NOT expand the box outside into character faces, hair, body drawings, or panel borders. Keep it fitted cleanly to the text area inside the bubble.
   - Center [(ymin+ymax)/2, (xmin+xmax)/2] directly on the center of the dialogue text inside that speech bubble!
   - NEVER omit introductory words, questions, or exclamations located at the top of a speech bubble (such as "ISN'T IT", "WAIT", "LOOK", "HEY", "HUH?", "AH...", quotation marks, or ellipses). Include all lines of dialogue within that bubble.
   - If a bubble contains a phrase at the top followed by quotes or dialogue below, e.g.:
       ISN'T IT
       "THE ONE WHO KILLED THE RABBITS...
       IS THE ONE WHO DREW THAT PICTURE?"
     You MUST treat the entire bubble as ONE single unified text box:
     - Set originalText to the complete text: 'ISN'T IT "THE ONE WHO KILLED THE RABBITS... IS THE ONE WHO DREW THAT PICTURE?"'
     - The bounding box [ymin, xmin, ymax, xmax] starts right above "ISN'T IT" down to below the last word "PICTURE?".
     - Translate the COMPLETE thought: e.g. 'CHẲNG PHẢI KẺ ĐÃ GIẾT MẤY CON THỎ... CHÍNH LÀ KẺ ĐÃ VẼ BỨC HÌNH ĐÓ SAO?'

3. CONSOLIDATE SPLIT LINES:
   - Never split phrases inside the same bubble into separate partial fragments. Combine all text in the same bubble into a single box.

4. Extract the exact English text inside the box.

5. SMART CONTEXT & PRONOUN REPLACEMENT RULES (BẮT BUỘC THỰC HIỆN ĐÚNG QUY TẮC XƯNG HÔ):
   a) MALE & FEMALE PEERS / SAME AGE (NAM NỮ CÙNG TUỔI):
      - When dialogue occurs between a young male and female of similar age (classmates, friends, romantic interests, comrades):
      - DO NOT translate with stiff, distant "CẬU - TỚ" or "TÔI - BẠN"!
      - MUST REPLACE with the natural, authentic manga pronoun pair "ANH - EM":
        * The male character refers to himself as "ANH" and addresses the female as "EM".
        * The female character refers to herself as "EM" and addresses the male as "ANH".
      - Example: "Are you okay? I'm so worried about you." -> Male speaking: "EM CÓ SAO KHÔNG? ANH LO CHO EM LẮM." / Female speaking: "ANH CÓ SAO KHÔNG? EM LO CHO ANH LẮM."

   b) MOTHER & SON CONTEXT (CON - MẸ THEO NGỮ CẢNH):
      - If the male character addresses the female character as "MẸ" (Mom, Mother, Mama, Mẹ ơi, Chào mẹ, Thưa mẹ...), either on this page or in the previous context:
      - The relationship is strictly MOTHER & SON (MẸ - CON)!
      - NEVER use "CẬU - TỚ", "MÀY - TAO", or "TÔI - BẠN" between them!
      - MUST REPLACE all pronouns with "CON - MẸ":
        * The son refers to himself as "CON" and addresses her as "MẸ" (e.g. "CON VỀ RỒI ĐÂY MẸ", "MẸ CÓ SAO KHÔNG?").
        * The mother refers to herself as "MẸ" and addresses him as "CON" (e.g. "CON ĐÃ ĂN CƠM CHƯA?", "ĐỂ MẸ LÀM CHO CON NHÉ").

   c) GENERAL RULES:
      - Two male friends of same age: Use "Cậu - Tớ" or "Mày - Tao" depending on intimacy.
      - Two female friends of same age: Use "Cậu - Tớ" or "Mày - Tao".
      - BUT between Male & Female of same age: ALWAYS prioritize "Anh - Em"!
      - And if male calls female "Mẹ": ALWAYS strictly use "Con - Mẹ"!
      - Translation Tone: ${tone}
      - WRITE ALL TRANSLATED TEXT IN CAPITAL LETTERS (IN HOA) for manga speech bubbles (e.g. "EM CÓ SAO KHÔNG?", "MẸ CÓ MỆT LẮM KHÔNG?").
      - DO NOT translate sound effects (SFX). Leave SFX untouched.${deepNuancePrompt}

6. Determine bubble background color ('white', 'black', or 'transparent') and text color ('black', 'white', or 'red').
7. Determine bubbleType ('speech', 'thought', or 'caption'). NEVER output 'sfx'.

Be thorough, detect ALL speech bubbles, and ensure original English dialogue is accurately translated!`;

      const targetPageNum = typeof pageIndex === 'number' ? pageIndex : undefined;

      let capturedUsage: any = null;

      const { result: textOutput, keyInfo } = await executeWithKeyRotation(
        pool,
        targetPageNum,
        async (ai, currentKeyInfo) => {
          const response = await ai.models.generateContent({
            model: currentKeyInfo.model,
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      data: cleanBase64,
                      mimeType: validMimeType,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            config: {
              temperature: isPaidTier ? 0.3 : 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  boxes: {
                    type: Type.ARRAY,
                    description: 'List of detected text boxes on the manga page',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        box2d: {
                          type: Type.ARRAY,
                          description: '[ymin, xmin, ymax, xmax] normalized 0-1000',
                          items: { type: Type.INTEGER },
                        },
                        originalText: { type: Type.STRING },
                        translatedText: { type: Type.STRING },
                        bubbleType: {
                          type: Type.STRING,
                          description: 'speech, thought, or caption. NEVER sfx',
                        },
                        backgroundColor: {
                          type: Type.STRING,
                          description: 'white, black, transparent',
                        },
                        textColor: {
                          type: Type.STRING,
                          description: 'black, white, red, blue',
                        },
                      },
                      required: [
                        'box2d',
                        'originalText',
                        'translatedText',
                        'bubbleType',
                        'backgroundColor',
                        'textColor',
                      ],
                    },
                  },
                  pageSummary: {
                    type: Type.STRING,
                    description: 'Short summary of what happens on this manga page in Vietnamese',
                  },
                },
                required: ['boxes'],
              },
            },
          });

          if (response.usageMetadata) {
            const promptTokens = response.usageMetadata.promptTokenCount || 0;
            const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
            const totalTokens = response.usageMetadata.totalTokenCount || 0;
            const costUsd = calculateTokenCost(currentKeyInfo.model, promptTokens, outputTokens);
            capturedUsage = {
              promptTokens,
              outputTokens,
              totalTokens,
              costUsd,
              costVnd: Math.round(costUsd * 25400),
            };
          }

          return response.text;
        },
        {
          apiTier: settings.apiTier,
          preferredModel: settings.paidModel,
        }
      );

      if (!textOutput) {
        throw new Error('Gemini không trả về kết quả dịch.');
      }

      const parsedData = JSON.parse(textOutput);

      // Filter out any SFX (Sound Effects) if present
      if (parsedData && Array.isArray(parsedData.boxes)) {
        parsedData.boxes = parsedData.boxes.filter((b: any) => {
          if (b.bubbleType === 'sfx') return false;
          const orig = (b.originalText || '').trim();
          // Skip if it looks like typical pure SFX noise or onomatopoeia
          const sfxNoiseRegex = /^([*~]|\b)(boom|bang|crash|thud|doki|wham|swoosh|rumble|clang|clack|click|creak|pant|sigh|gasp|badump|snicker|zap|shing|slash|whack|smack|fwoosh|bzzz|splash|snap|drip|tap|step|giggle|chuckle|aaargh|gah|ugh|eek|huff|puff)([*~!]|\b)*$/i;
          if (sfxNoiseRegex.test(orig)) return false;
          return true;
        });
        parsedData.boxes = refinePronounsSmartly(parsedData.boxes, previousContext, settings);
      }

      const enhancedKeyInfo = {
        ...keyInfo,
        tier: isPaidTier ? ('paid' as const) : ('free' as const),
        tokensUsed: capturedUsage?.totalTokens,
        costUsd: capturedUsage?.costUsd,
      };

      return res.json({
        success: true,
        data: parsedData,
        keyInfo: enhancedKeyInfo,
        usage: capturedUsage,
      });
    } catch (err: any) {
      console.error('Error translating manga page:', err);
      let errMsg = err.message || 'Lỗi xử lý dịch thuật từ Gemini AI.';

      const isPaid = req.body?.settings?.apiTier === 'paid' || req.body?.apiTier === 'paid';

      // Only reformat if it's an unhandled raw Google API error
      if (
        typeof errMsg === 'string' &&
        !errMsg.includes('Đã vượt quá') &&
        !errMsg.includes('Google API báo lỗi') &&
        !errMsg.includes('API Key trả phí') &&
        (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded'))
      ) {
        const isLimit15 = errMsg.includes("limit '15'") || errMsg.includes('limit: 15');
        if (isLimit15) {
          errMsg =
            'Google API báo lỗi hạn ngạch (429: Giới hạn 15 lượt/phút của Free Tier). Lưu ý: Dù tài khoản Google đã có thẻ thanh toán, API Key này có thể thuộc Project chưa liên kết Thẻ thanh toán (Billing Account) trên Google Cloud Console (AI Studio mặc định tạo Project Free Tier). Vui lòng kiểm tra Billing của Project trên Google Cloud.';
        } else if (isPaid) {
          errMsg =
            'API Key trả phí tạm thời chạm giới hạn lượt gọi (Lỗi 429: Quota / Rate limit). Có thể do: 1) Project chưa gán Billing Account trên Google Cloud; 2) Chạm giới hạn lượt gọi/phút hoặc ngân sách chi tiêu tối đa (Budget Cap); 3) Quá nhiều yêu cầu song song. Vui lòng thử lại sau 10-20 giây hoặc kiểm tra Billing trên Google Cloud.';
        } else {
          errMsg =
            'Đã vượt quá giới hạn lượt gọi miễn phí của các API Key khả dụng (Lỗi 429: 15 lượt/phút). Vui lòng đợi 20-30 giây để Google nạp lại quota, hoặc thêm các API Key mới từ Google AI Studio trong Cài đặt (⚙️).';
        }
      }
      return res.status(500).json({
        success: false,
        error: errMsg,
      });
    }
  });

  // API Endpoint: Re-translate a specific speech bubble with custom instruction
  app.post('/api/retranslate-box', async (req, res, _next) => {
    try {
      const { originalText, currentTranslation, instruction } = req.body;

      if (!originalText) {
        return res.status(400).json({ success: false, error: 'Thiếu câu thoại gốc.' });
      }

      const pool = resolveKeyPool(req.body, req.headers);
      if (pool.length === 0) {
        return res.status(400).json({ success: false, error: 'Chưa có Gemini API Key.' });
      }

      const prompt = `You are a professional English to Vietnamese Manga translator.
Re-translate or refine this single manga line based on user instruction.

Original English text: "${originalText}"
Current Vietnamese translation: "${currentTranslation || ''}"
User Instruction: "${instruction || 'Dịch tự nhiên hơn theo phong cách truyện tranh'}"

SMART PRONOUN & CONTEXT GUIDELINES:
- Male & Female peers / same age: Prioritize "ANH - EM" (male: anh/em, female: em/anh) instead of "CẬU - TỚ".
- Mother & Son context: If talking to mother, use "CON - MẸ" (con xưng con, gọi mẹ; mẹ xưng mẹ, gọi con).
- Write ALL translated text in CAPITAL LETTERS (IN HOA).

Respond ONLY with JSON matching format:
{"translatedText": "câu dịch mới bằng tiếng Việt (viết HOA)"}`;

      const { result: textOutput, keyInfo } = await executeWithKeyRotation(
        pool,
        undefined,
        async (ai, currentKeyInfo) => {
          const response = await ai.models.generateContent({
            model: currentKeyInfo.model,
            contents: prompt,
            config: {
              temperature: 0.3,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  translatedText: { type: Type.STRING },
                },
                required: ['translatedText'],
              },
            },
          });
          return response.text;
        }
      );

      const parsed = JSON.parse(textOutput || '{}');
      return res.json({
        success: true,
        translatedText: parsed.translatedText || currentTranslation,
        keyInfo,
      });
    } catch (err: any) {
      console.error('Error re-translating box:', err);
      return res.status(500).json({ success: false, error: err.message || 'Không thể dịch lại câu thoại này.' });
    }
  });

  // API Endpoint: Check rotation key pool status
  app.get('/api/gemini-pool-status', (req, res) => {
    const envKeys = getServerEnvKeys();
    res.json({
      envKeysCount: envKeys.length,
      activeCooldowns: Array.from(keyCooldownMap.entries()).filter(([_, time]) => time > Date.now()).length,
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Global Error Handler for API routes to always return JSON instead of HTML
  app.use('/api', (err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API Error handler caught:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Lỗi hệ thống máy chủ API.',
    });
  });

  // Vite middleware for dev / static for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Manga CBZ Translator Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
