import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MangaPage, SpeechBox, TranslationSettings, BatchProgress, SupportedPaidModel } from './types';
import { Header } from './components/Header';
import { PageThumbnailBar } from './components/PageThumbnailBar';
import { MangaCanvas } from './components/MangaCanvas';
import { BubbleInspector } from './components/BubbleInspector';
import { TranslationSettingsModal } from './components/TranslationSettingsModal';
import { ColorPageStripperModal } from './components/ColorPageStripperModal';
import {
  parseCBZFile,
  imageToBase64,
  optimizeImageForOcr,
  exportToCBZ,
  detectImageColorMode,
  isPageEligibleForTranslation,
  isUntranslatedColorPage,
  formatDuration,
} from './utils/cbzUtils';
import { smartAlignBoxesToMangaImage } from './utils/bubbleDetector';
import {
  Sparkles,
  Upload,
  FileCode,
  CheckCircle2,
  Download,
  AlertCircle,
  Loader2,
  Clock,
  Timer,
  Zap,
  Paperclip,
  FileArchive,
  BookOpen,
  Layers,
  Check,
  Play,
  Bookmark,
  X,
  RefreshCw,
  Palette,
} from 'lucide-react';
import {
  savePageTranslation,
  loadTranslationsForFile,
  getLatestSavedSession,
  SavedSession,
} from './utils/translationStorage';

export default function App() {
  const [pages, setPages] = useState<MangaPage[]>([]);
  const pagesRef = useRef<MangaPage[]>(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [restoredToast, setRestoredToast] = useState<string | null>(null);

  // Reader & Styling states
  const [readerMode, setReaderMode] = useState<'overlay' | 'side-by-side' | 'original' | 'slider'>('overlay');
  const [fontFamily, setFontFamily] = useState<'Comic' | 'Sans' | 'Serif'>('Comic');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isColorStripperOpen, setIsColorStripperOpen] = useState<boolean>(false);

  // Batch translation state
  const [isBatchTranslating, setIsBatchTranslating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    current: 0,
    total: 0,
  });
  const cancelBatchRef = useRef<boolean>(false);

  // CBZ Export State
  const [exportState, setExportState] = useState<{
    isExporting: boolean;
    current: number;
    total: number;
    phase: 'rendering' | 'zipping' | 'done' | 'error';
    percent: number;
    downloadUrl?: string;
    downloadFileName?: string;
    fileSizeMb?: string;
    errorMessage?: string;
    excludedColorCount?: number;
  } | null>(null);

  // Settings with LocalStorage persistence for Gemini API key and 10-key rotation pool
  const [settings, setSettings] = useState<TranslationSettings>(() => {
    const userShopAIKey = 'sk-JSSlAwgCuyytCS9tHGRb5RhuNTQEA6iw8BIXjbrL2KFhSOHJ';
    let savedApiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') || userShopAIKey : userShopAIKey;
    if (savedApiKey.startsWith('AQ.Ab8') || savedApiKey.includes('4axE')) {
      savedApiKey = userShopAIKey;
    }

    let savedApiKeys: string[] = [userShopAIKey];
    let onlyTranslateBW = true;
    let skipFirstNPages = 4;
    let excludeUntranslatedColorPagesFromExport = false;
    let customRangeEnabled = false;
    let startPage: number | undefined = undefined;
    let endPage: number | undefined = undefined;
    let apiTier: 'free' | 'paid' = 'paid';
    let paidModel: SupportedPaidModel = 'gemini-3.6-flash';
    let paidPacingSpeed: 'turbo' | 'fast' | 'normal' = 'fast';
    let concurrency: 1 | 2 | 3 = 1;
    let deepNuance = true;

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('gemini_api_keys');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Strip out dead keys and expired test tokens
            const cleanTokens = parsed
              .filter((k) => typeof k === 'string' && k.trim().length > 10)
              .filter((k) => !k.startsWith('AQ.Ab8') && !k.includes('4axE'));
            if (cleanTokens.length > 0) {
              savedApiKeys = cleanTokens;
            }
          }
        }

        // If user is using ShopAIKey (sk-...), isolate from expired Google Free keys
        if (savedApiKeys.some((k) => k.startsWith('sk-'))) {
          savedApiKeys = savedApiKeys.filter((k) => k.startsWith('sk-'));
        }

        const storedBW = localStorage.getItem('only_translate_bw');
        if (storedBW !== null) {
          onlyTranslateBW = storedBW === 'true';
        }
        const storedSkip = localStorage.getItem('skip_first_n_pages');
        if (storedSkip !== null) {
          skipFirstNPages = parseInt(storedSkip, 10);
          if (isNaN(skipFirstNPages)) skipFirstNPages = 4;
        }
        const storedExcludeColor = localStorage.getItem('exclude_untranslated_color_pages');
        if (storedExcludeColor !== null) {
          excludeUntranslatedColorPagesFromExport = storedExcludeColor === 'true';
        }
        const storedRangeEnabled = localStorage.getItem('custom_range_enabled');
        if (storedRangeEnabled !== null) {
          customRangeEnabled = storedRangeEnabled === 'true';
        }
        const storedStart = localStorage.getItem('custom_start_page');
        if (storedStart !== null) {
          const val = parseInt(storedStart, 10);
          if (!isNaN(val)) startPage = val;
        }
        const storedEnd = localStorage.getItem('custom_end_page');
        if (storedEnd !== null) {
          const val = parseInt(storedEnd, 10);
          if (!isNaN(val)) endPage = val;
        }
        const storedTier = localStorage.getItem('gemini_api_tier');
        apiTier = 'paid'; // Luôn dùng chế độ chuyên nghiệp cao tốc
        const storedModel = localStorage.getItem('gemini_paid_model');
        if (storedModel === 'gemini-3.1-flash-lite-preview' || storedModel === 'gemini-3.6-flash') {
          paidModel = storedModel;
        }
        const storedPacing = localStorage.getItem('gemini_paid_pacing');
        if (storedPacing === 'turbo' || storedPacing === 'fast' || storedPacing === 'normal') {
          paidPacingSpeed = storedPacing;
        }
        const storedConcurrency = localStorage.getItem('gemini_concurrency');
        if (storedConcurrency) {
          const c = parseInt(storedConcurrency, 10);
          if (c === 1 || c === 2 || c === 3) concurrency = c as any;
        }
        const storedNuance = localStorage.getItem('gemini_deep_nuance');
        if (storedNuance !== null) {
          deepNuance = storedNuance === 'true';
        }
      } catch (e) {
        console.warn('Lỗi đọc settings từ localStorage:', e);
      }
    }

    // If multi-key list is empty but single key was previously saved, populate it
    if (savedApiKeys.length === 0 && savedApiKey) {
      savedApiKeys = [savedApiKey];
    }

    return {
      tone: 'natural',
      addressingPairs: 'Cậu - Tớ, Anh - Em, Ta - Ngươi, Tôi - Bạn',
      fontFamily: 'Comic',
      autoInpaint: true,
      preserveFormat: true,
      apiKey: savedApiKey,
      apiKeys: savedApiKeys,
      apiTier,
      paidModel,
      paidPacingSpeed,
      concurrency,
      deepNuance,
      onlyTranslateBW,
      skipColorPages: onlyTranslateBW,
      skipFirstNPages,
      excludeUntranslatedColorPagesFromExport,
      customRangeEnabled,
      startPage,
      endPage,
    };
  });

  // Track session usage, tokens, and estimated cost
  const [sessionUsage, setSessionUsage] = useState({
    totalTokens: 0,
    totalCostUsd: 0,
    totalCostVnd: 0,
    pagesTranslatedCount: 0,
  });

  useEffect(() => {
    if (settings.apiKeys && settings.apiKeys.length > 0) {
      localStorage.setItem('gemini_api_keys', JSON.stringify(settings.apiKeys));
      const firstValid = settings.apiKeys.find((k) => k && k.trim());
      if (firstValid) {
        localStorage.setItem('gemini_api_key', firstValid.trim());
      }
    } else {
      localStorage.removeItem('gemini_api_keys');
      if (settings.apiKey?.trim()) {
        localStorage.setItem('gemini_api_key', settings.apiKey.trim());
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    }

    localStorage.setItem('only_translate_bw', String(settings.onlyTranslateBW));
    localStorage.setItem('skip_first_n_pages', String(settings.skipFirstNPages ?? 4));
    localStorage.setItem('exclude_untranslated_color_pages', String(settings.excludeUntranslatedColorPagesFromExport ?? false));
    localStorage.setItem('custom_range_enabled', String(settings.customRangeEnabled ?? false));
    if (settings.startPage !== undefined) {
      localStorage.setItem('custom_start_page', String(settings.startPage));
    }
    if (settings.endPage !== undefined) {
      localStorage.setItem('custom_end_page', String(settings.endPage));
    }
    localStorage.setItem('gemini_api_tier', 'paid');
    localStorage.setItem('gemini_paid_model', settings.paidModel || 'gemini-3.6-flash');
    localStorage.setItem('gemini_paid_pacing', settings.paidPacingSpeed || 'turbo');
    localStorage.setItem('gemini_concurrency', String(settings.concurrency || 2));
    localStorage.setItem('gemini_deep_nuance', String(settings.deepNuance ?? true));
  }, [
    settings.apiKeys,
    settings.apiKey,
    settings.apiTier,
    settings.paidModel,
    settings.paidPacingSpeed,
    settings.concurrency,
    settings.deepNuance,
    settings.onlyTranslateBW,
    settings.skipFirstNPages,
    settings.excludeUntranslatedColorPagesFromExport,
    settings.customRangeEnabled,
    settings.startPage,
    settings.endPage,
  ]);

  // Live 1-second interval countdown to provide real-time remaining time updates
  useEffect(() => {
    if (!isBatchTranslating) return;

    const timer = setInterval(() => {
      setBatchProgress((prev) => {
        if (prev.estimatedSecondsLeft === undefined) return prev;
        if (prev.estimatedSecondsLeft <= 1) {
          return {
            ...prev,
            estimatedSecondsLeft: 0,
            formattedTimeLeft: 'Vài giây nữa',
          };
        }
        const nextSeconds = prev.estimatedSecondsLeft - 1;
        return {
          ...prev,
          estimatedSecondsLeft: nextSeconds,
          formattedTimeLeft: formatDuration(nextSeconds),
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isBatchTranslating]);

  // Load last saved session on app mount
  useEffect(() => {
    getLatestSavedSession().then((session) => {
      if (session) {
        setSavedSession(session);
      }
    });
  }, []);

  // Handle uploading user CBZ or ZIP file
  const handleUploadFile = async (file: File) => {
    try {
      setIsParsingFile(true);
      const parsedPages = await parseCBZFile(file);
      if (parsedPages.length === 0) {
        alert('Không tìm thấy tệp hình ảnh nào bên trong file CBZ/ZIP này.');
        return;
      }

      // Check if there are cached translations in IndexedDB for this file
      const cached = await loadTranslationsForFile(file.name);
      let initialActiveIndex = 0;
      let restoredCount = 0;

      let finalPages = parsedPages;
      if (cached && cached.size > 0) {
        let firstIncompleteIndex = -1;
        finalPages = parsedPages.map((p, idx) => {
          const saved = cached.get(idx);
          if (saved) {
            restoredCount++;
            return {
              ...p,
              status: 'completed' as const,
              boxes: saved.boxes,
              usedKeyInfo: saved.usedKeyInfo,
            };
          }
          if (firstIncompleteIndex === -1) {
            firstIncompleteIndex = idx;
          }
          return p;
        });

        if (firstIncompleteIndex !== -1) {
          initialActiveIndex = firstIncompleteIndex;
        }

        if (restoredCount > 0) {
          setRestoredToast(
            `Đã khôi phục thành công ${restoredCount} trang đã dịch trước đó! Bạn có thể bấm "Tiếp Tục Dịch" để tiếp tục dịch từ trang ${initialActiveIndex + 1}.`
          );
          setTimeout(() => setRestoredToast(null), 10000);
        }
      }

      setPages(finalPages);
      setActivePageIndex(initialActiveIndex);
      setFileName(file.name);
      setSelectedBoxId(null);
    } catch (err: any) {
      console.error('Lỗi đọc file CBZ:', err);
      alert('Không thể mở file CBZ. Vui lòng đảm bảo file định dạng .cbz hoặc .zip hợp lệ.');
    } finally {
      setIsParsingFile(false);
    }
  };

  // Translate a single manga page using server endpoint
  const translateSinglePage = async (pageIndex: number): Promise<boolean> => {
    const page = pagesRef.current[pageIndex] || pages[pageIndex];
    if (!page) return false;

    // Set page state to translating
    setPages((prev) =>
      prev.map((p, idx) => (idx === pageIndex ? { ...p, status: 'translating', errorMessage: undefined } : p))
    );

    try {
      const { base64: base64Image, mimeType: imageMimeType } = await optimizeImageForOcr(page.originalBlob);

      // Collect recent dialogue context from previously completed pages for smart context & pronoun resolution
      const recentPages = pagesRef.current
        .slice(Math.max(0, pageIndex - 4), pageIndex)
        .filter((p) => p.status === 'completed' && p.boxes.length > 0);

      const previousDialogues = recentPages
        .flatMap((p) =>
          p.boxes
            .map((b) => b.translatedText?.trim())
            .filter((t): t is string => Boolean(t && t.length > 0))
        )
        .slice(-16)
        .join('\n');

      const res = await fetch('/api/translate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageIndex: pageIndex,
          imageBase64: base64Image,
          mimeType: imageMimeType,
          previousContext: previousDialogues,
          settings: {
            tone: settings.tone,
            addressingPairs: settings.addressingPairs,
            apiKey: settings.apiKey,
            apiKeys: settings.apiKeys,
            apiTier: settings.apiTier,
            paidModel: settings.paidModel,
            deepNuance: settings.deepNuance,
          },
          apiTier: settings.apiTier,
          paidModel: settings.paidModel,
          deepNuance: settings.deepNuance,
          apiKeys: settings.apiKeys,
          apiKey: settings.apiKey,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let json: any = {};
      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        await res.text();
        throw new Error(`Máy chủ chưa phản hồi xong hoặc đang khởi động lại (Mã lỗi ${res.status}). Vui lòng thử lại sau vài giây.`);
      }

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Dịch trang thất bại (Mã lỗi ${res.status}).`);
      }

      if (json.keyInfo) {
        console.log(
          `[${json.keyInfo.tier === 'paid' ? 'Paid Tier' : 'Xoay tua API'}] Trang ${pageIndex + 1}: Sử dụng Key #${json.keyInfo.keyIndex}/${json.keyInfo.totalKeys} (${json.keyInfo.keyMasked}) [Model: ${json.keyInfo.model || 'flash'}]`
        );
      }

      if (json.usage) {
        setSessionUsage((prev) => ({
          totalTokens: prev.totalTokens + (json.usage.totalTokens || 0),
          totalCostUsd: prev.totalCostUsd + (json.usage.costUsd || 0),
          totalCostVnd: prev.totalCostVnd + (json.usage.costVnd || 0),
          pagesTranslatedCount: prev.pagesTranslatedCount + 1,
        }));
      }

      const rawBoxes = json.data.boxes || [];

      // Format boxes into typed SpeechBox objects (filtering out any SFX sound effects)
      const formattedBoxes: SpeechBox[] = rawBoxes
        .filter((b: any) => b.bubbleType !== 'sfx')
        .map((b: any, idx: number) => ({
          id: `box_${pageIndex}_${idx}_${Date.now()}`,
          box2d: b.box2d || [100, 100, 300, 400],
          originalText: b.originalText || '',
          translatedText: b.translatedText || '',
          bubbleType: b.bubbleType || 'speech',
          backgroundColor: b.backgroundColor === 'black' ? 'black' : 'white',
          textColor: b.textColor === 'white' ? 'white' : b.textColor === 'red' ? 'red' : 'black',
          fontSize: 32,
          autoFitFont: true,
          bold: true,
          maskPadding: 0,
        }));

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === pageIndex
            ? {
                ...p,
                status: 'completed',
                boxes: formattedBoxes,
                usedKeyInfo: json.keyInfo,
                tier: json.keyInfo?.tier || settings.apiTier || 'free',
                costUsd: json.usage?.costUsd,
                tokensUsed: json.usage?.totalTokens,
              }
            : p
        )
      );

      // Persist to IndexedDB so translations survive reload/refresh
      savePageTranslation(fileName, pageIndex, {
        boxes: formattedBoxes,
        usedKeyInfo: json.keyInfo,
        totalPages: pages.length,
      });

      return true;
    } catch (err: any) {
      console.error(`Lỗi dịch trang ${pageIndex + 1}:`, err);
      let cleanErrorMessage = err.message || 'Lỗi khi kết nối với Gemini AI.';

      // Clean up raw JSON error objects like {"error":{"code":503,"message":"..."}}
      try {
        if (cleanErrorMessage.includes('{') && cleanErrorMessage.includes('}')) {
          const match = cleanErrorMessage.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.error?.message) {
              if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
                cleanErrorMessage =
                  'Máy chủ AI của Google đang quá tải tạm thời (Lỗi 503: High demand). Hệ thống đã thử xoay qua các API Key. Vui lòng bấm "Thử lại".';
              } else if (parsed.error.code === 429) {
                cleanErrorMessage =
                  'Các API Key đều đã tạm hết quota miễn phí (Lỗi 429). Vui lòng đợi 20-30s và bấm "Thử lại".';
              } else {
                cleanErrorMessage = `${parsed.error.message} (Mã lỗi ${parsed.error.code || 500})`;
              }
            }
          }
        }
      } catch {}

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === pageIndex
            ? {
                ...p,
                status: 'error',
                errorMessage: cleanErrorMessage,
              }
            : p
        )
      );
      return false;
    }
  };

  const handleStopBatchTranslate = () => {
    cancelBatchRef.current = true;
  };

  // Toggle user manual skip override on a specific page
  const handleToggleManualSkip = (pageIndex: number) => {
    setPages((prev) =>
      prev.map((p, idx) => {
        if (idx !== pageIndex) return p;
        const currentEligible = isPageEligibleForTranslation(pageIndex, p, settings).eligible;
        return {
          ...p,
          manualSkip: currentEligible ? true : false,
        };
      })
    );
  };

  // Batch translate pages within a specified range [startIdx, endIdx]
  const handleBatchTranslate = async (startIdx?: number, endIdx?: number) => {
    if (pages.length === 0 || isBatchTranslating) return;

    // Determine actual start & end index
    let actualStart = startIdx !== undefined ? startIdx : 0;
    let actualEnd = endIdx !== undefined ? endIdx : pages.length - 1;

    // If no explicit start/end passed, check settings.customRangeEnabled
    if (startIdx === undefined && endIdx === undefined && settings.customRangeEnabled) {
      if (settings.startPage && settings.startPage >= 1) {
        actualStart = settings.startPage - 1;
      }
      if (settings.endPage && settings.endPage >= 1) {
        actualEnd = Math.min(pages.length - 1, settings.endPage - 1);
      }
    }

    actualStart = Math.max(0, Math.min(pages.length - 1, actualStart));
    actualEnd = Math.max(actualStart, Math.min(pages.length - 1, actualEnd));

    const totalToProcess = actualEnd - actualStart + 1;

    // Count how many eligible pages actually require translation in this range
    let pendingEligibleCount = 0;
    for (let idx = actualStart; idx <= actualEnd; idx++) {
      if (pages[idx]?.status !== 'completed') {
        const eligibility = isPageEligibleForTranslation(idx, pages[idx], settings);
        if (eligibility.eligible) {
          pendingEligibleCount++;
        }
      }
    }

    // Determine tier, concurrency, and pacing delay
    const isPaid = settings.apiTier === 'paid';
    const validKeyCount = (settings.apiKeys || []).filter((k) => k && k.trim().length > 10).length;
    // For Paid tier: fully enable 1, 2, or 3 concurrent workers as configured by user!
    // For Free tier: if user has multiple keys, allow multi-worker rotation, otherwise 1
    const concurrency = isPaid
      ? (settings.concurrency || 1)
      : (validKeyCount > 1 ? Math.min(validKeyCount, settings.concurrency || 1) : 1);
    // Pacing delay:
    // - Paid Tier: turbo: 400ms, fast: 1000ms, normal: 2000ms
    // - Free Tier: strictly 4500ms (~4.5s) to guarantee quota stability & prevent 503/429 errors
    const pacingDelayMs = isPaid
      ? (settings.paidPacingSpeed === 'normal' ? 2000 : settings.paidPacingSpeed === 'fast' ? 1000 : 400)
      : 4500;

    const initialEstimatedSecsPerPage = (isPaid ? 2.5 : 3.5) + pacingDelayMs / 1000;
    const initialEstimatedSeconds = Math.max(
      pendingEligibleCount > 0 ? (isPaid ? 3 : 8) : 1,
      Math.round((pendingEligibleCount * initialEstimatedSecsPerPage) / concurrency)
    );

    cancelBatchRef.current = false;
    setIsBatchTranslating(true);

    setBatchProgress({
      current: 0,
      total: totalToProcess,
      startPage: actualStart + 1,
      endPage: actualEnd + 1,
      estimatedSecondsLeft: initialEstimatedSeconds,
      formattedTimeLeft: formatDuration(initialEstimatedSeconds),
      speedSecondsPerPage: initialEstimatedSecsPerPage,
      completedInBatch: 0,
      activeTranslatingPages: [],
    });

    // Mark ineligible pages in the range as skipped first
    const pendingEligibleIndices: number[] = [];
    for (let i = actualStart; i <= actualEnd; i++) {
      const eligibility = isPageEligibleForTranslation(i, pages[i], settings);
      if (!eligibility.eligible) {
        if (pages[i].status !== 'completed') {
          console.log(`[Bỏ qua dịch] Trang ${i + 1} (${pages[i].filename}): ${eligibility.reason}`);
          setPages((prev) =>
            prev.map((p, idx) =>
              idx === i && p.status !== 'completed'
                ? { ...p, status: 'skipped', skipReason: eligibility.reason }
                : p
            )
          );
        }
      } else if (pages[i].status !== 'completed') {
        pendingEligibleIndices.push(i);
      }
    }

    let completedPagesInBatch = 0;
    let totalProcessingTimeMs = 0;
    const batchStartTime = Date.now();
    const activeTranslatingSet = new Set<number>();

    const updateActiveTranslatingState = () => {
      setBatchProgress((prev) => ({
        ...prev,
        activeTranslatingPages: Array.from(activeTranslatingSet).sort((a, b) => a - b),
      }));
    };

    if (concurrency > 1 && pendingEligibleIndices.length > 0) {
      // Multi-worker concurrent queue for Paid Tier / Multi-key
      const queue = [...pendingEligibleIndices];

      const worker = async (workerId: number) => {
        while (queue.length > 0 && !cancelBatchRef.current) {
          const pageIdx = queue.shift();
          if (pageIdx === undefined) break;

          activeTranslatingSet.add(pageIdx);
          updateActiveTranslatingState();
          setActivePageIndex(pageIdx);

          let success = await translateSinglePage(pageIdx);

          if (!success && !cancelBatchRef.current) {
            console.warn(`[Paid Luồng #${workerId}] Thử lại trang ${pageIdx + 1}...`);
            await new Promise((r) => setTimeout(r, 1500));
            if (!cancelBatchRef.current) {
              success = await translateSinglePage(pageIdx);
            }
          }

          activeTranslatingSet.delete(pageIdx);
          updateActiveTranslatingState();

          if (cancelBatchRef.current) break;

          completedPagesInBatch++;
          const elapsedSecs = (Date.now() - batchStartTime) / 1000;
          const avgSecsPerPage = elapsedSecs / completedPagesInBatch;
          const remainingCount = queue.length;
          const updatedSecondsLeft = Math.max(1, Math.round((remainingCount * avgSecsPerPage) / concurrency));

          setBatchProgress((prev) => ({
            ...prev,
            current: completedPagesInBatch,
            completedInBatch: completedPagesInBatch,
            estimatedSecondsLeft: updatedSecondsLeft,
            formattedTimeLeft: formatDuration(updatedSecondsLeft),
            speedSecondsPerPage: avgSecsPerPage / concurrency,
          }));

          if (pacingDelayMs > 0 && queue.length > 0 && !cancelBatchRef.current) {
            await new Promise((r) => setTimeout(r, pacingDelayMs));
          }
        }
      };

      const activeWorkerCount = Math.min(concurrency, queue.length);
      const workers: Promise<void>[] = [];
      for (let w = 0; w < activeWorkerCount; w++) {
        workers.push(
          (async () => {
            if (w > 0) {
              // Stagger worker start slightly (250ms) to avoid simultaneous millisecond connection bursts
              await new Promise((r) => setTimeout(r, w * 250));
            }
            return worker(w + 1);
          })()
        );
      }
      await Promise.all(workers);
    } else {
      // Sequential queue (Free Tier with 4.5s delay or single-worker Paid Tier)
      for (let step = 0; step < pendingEligibleIndices.length; step++) {
        if (cancelBatchRef.current) {
          console.log('Đã dừng dịch hàng loạt theo yêu cầu.');
          break;
        }

        const i = pendingEligibleIndices[step];
        const pageStartTime = Date.now();
        activeTranslatingSet.add(i);
        updateActiveTranslatingState();
        setActivePageIndex(i);

        let success = await translateSinglePage(i);

        // If page failed or hit rate limit, retry
        if (!success && !cancelBatchRef.current) {
          const retryWait = isPaid ? 2000 : 6000;
          console.warn(`Trang ${i + 1} chưa xong, tự động thử lại sau ${retryWait / 1000} giây...`);
          await new Promise((res) => setTimeout(res, retryWait));
          if (!cancelBatchRef.current) {
            success = await translateSinglePage(i);
          }
        }

        activeTranslatingSet.delete(i);
        updateActiveTranslatingState();

        if (cancelBatchRef.current) break;

        const pageDurationMs = Date.now() - pageStartTime;
        totalProcessingTimeMs += pageDurationMs;
        completedPagesInBatch++;

        const avgSecsPerPage = (totalProcessingTimeMs / completedPagesInBatch) / 1000;
        const remainingEligible = pendingEligibleIndices.length - (step + 1);
        const updatedSecondsLeft = Math.round(remainingEligible * avgSecsPerPage);

        setBatchProgress((prev) => ({
          ...prev,
          current: step + 1,
          completedInBatch: completedPagesInBatch,
          estimatedSecondsLeft: updatedSecondsLeft,
          formattedTimeLeft: formatDuration(updatedSecondsLeft),
          speedSecondsPerPage: avgSecsPerPage,
        }));

        if (step < pendingEligibleIndices.length - 1) {
          const nextDelay = success ? pacingDelayMs : (isPaid ? 2000 : 5000);
          await new Promise((res) => setTimeout(res, nextDelay));
        }
      }
    }

    activeTranslatingSet.clear();
    setIsBatchTranslating(false);
    setBatchProgress((prev) => ({
      ...prev,
      activeTranslatingPages: [],
      estimatedSecondsLeft: 0,
      formattedTimeLeft: 'Hoàn thành!',
    }));
  };

  // Re-translate specific box with custom prompt
  const handleRetranslateBox = async (box: SpeechBox, instruction: string) => {
    try {
      const res = await fetch('/api/retranslate-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: box.originalText,
          currentTranslation: box.translatedText,
          instruction,
          apiKey: settings.apiKey,
          apiKeys: settings.apiKeys,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success && json.translatedText) {
          handleUpdateBox({
            ...box,
            translatedText: json.translatedText,
          });
        }
      }
    } catch (err) {
      console.error('Lỗi khi dịch lại câu:', err);
    }
  };

  // Update box in active page state
  const handleUpdateBox = (updatedBox: SpeechBox) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== activePageIndex) return p;
        return {
          ...p,
          boxes: p.boxes.map((b) => (b.id === updatedBox.id ? updatedBox : b)),
        };
      })
    );
  };

  // Update all boxes in active page state & persist
  const handleUpdateAllBoxes = (updatedBoxes: SpeechBox[]) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== activePageIndex) return p;
        return {
          ...p,
          boxes: updatedBoxes,
        };
      })
    );
    savePageTranslation(fileName, activePageIndex, {
      boxes: updatedBoxes,
      totalPages: pages.length,
    });
  };

  // Smart auto-snap single box to physical speech bubble
  const handleAutoSnapBox = async (box: SpeechBox) => {
    const activePage = pages[activePageIndex];
    if (!activePage) return;
    try {
      const aligned = await smartAlignBoxesToMangaImage(activePage.originalBlob, [box]);
      if (aligned.length > 0) {
        handleUpdateBox(aligned[0]);
      }
    } catch (err) {
      console.warn('Lỗi khớp bong bóng:', err);
    }
  };

  // Smart auto-snap all boxes on active page to physical speech bubbles
  const handleAutoSnapAll = async () => {
    const activePage = pages[activePageIndex];
    if (!activePage || !activePage.boxes || activePage.boxes.length === 0) return;
    try {
      const aligned = await smartAlignBoxesToMangaImage(activePage.originalBlob, activePage.boxes);
      handleUpdateAllBoxes(aligned);
    } catch (err) {
      console.warn('Lỗi khớp tất cả bong bóng:', err);
    }
  };

  // Delete box from active page
  const handleDeleteBox = (boxId: string) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== activePageIndex) return p;
        return {
          ...p,
          boxes: p.boxes.filter((b) => b.id !== boxId),
        };
      })
    );
    if (selectedBoxId === boxId) setSelectedBoxId(null);
  };

  // Add new box manually
  const handleAddBox = (customBox2d?: [number, number, number, number]) => {
    const activePage = pages[activePageIndex];
    if (!activePage) return;

    const newBox: SpeechBox = {
      id: `custom_box_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      box2d: customBox2d || [400, 300, 600, 700],
      originalText: '',
      translatedText: 'NHẬP CÂU DỊCH MỚI...',
      bubbleType: 'speech',
      backgroundColor: 'white',
      textColor: 'black',
      fontSize: 32,
      autoFitFont: true,
      bold: true,
      isEraser: false,
    };

    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== activePageIndex) return p;
        return {
          ...p,
          status: 'completed',
          boxes: [...p.boxes, newBox],
        };
      })
    );

    setSelectedBoxId(newBox.id);
  };

  // Add new eraser patch to cleanly mask leftover English text
  const handleAddEraserBox = (customBox2d?: [number, number, number, number], bg: 'white' | 'black' = 'white') => {
    const activePage = pages[activePageIndex];
    if (!activePage) return;

    const newEraserBox: SpeechBox = {
      id: `eraser_${Date.now()}`,
      box2d: customBox2d || [350, 300, 450, 700],
      originalText: '(Vùng tẩy xóa chữ tiếng Anh còn dư)',
      translatedText: '', // empty so only clean background mask is drawn
      bubbleType: 'caption',
      backgroundColor: bg,
      textColor: 'black',
      fontSize: 16,
      maskPadding: 2,
      isEraser: true,
    };

    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== activePageIndex) return p;
        return {
          ...p,
          boxes: [...p.boxes, newEraserBox],
        };
      })
    );

    setSelectedBoxId(newEraserBox.id);
  };

  // Export translated pages as a downloadable CBZ file with real-time UI feedback and direct download fallback
  const handleExportCBZ = async () => {
    if (pages.length === 0) {
      setExportState({
        isExporting: false,
        current: 0,
        total: 0,
        phase: 'error',
        percent: 0,
        errorMessage: 'Chưa có trang truyện nào trong ứng dụng. Vui lòng tải file truyện (.cbz, .zip) lên trước.',
      });
      return;
    }

    const untranslatedColorCount = pages.filter(isUntranslatedColorPage).length;
    const willExcludeColor = Boolean(settings.excludeUntranslatedColorPagesFromExport && untranslatedColorCount > 0);
    const targetTotal = willExcludeColor ? pages.length - untranslatedColorCount : pages.length;

    if (targetTotal === 0) {
      setExportState({
        isExporting: false,
        current: 0,
        total: 0,
        phase: 'error',
        percent: 0,
        errorMessage:
          'Tất cả các trang trong truyện đều là trang màu chưa được dịch và đang bật tùy chọn loại bỏ trang màu khi xuất file CBZ. Vui lòng dịch ít nhất một trang hoặc tắt tùy chọn này trong cài đặt.',
      });
      return;
    }

    const rawName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Manga_Dich';
    const exportName = `${rawName}_Vietnamese.cbz`;

    setExportState({
      isExporting: true,
      current: 1,
      total: targetTotal,
      phase: 'rendering',
      percent: 0,
      downloadFileName: exportName,
      excludedColorCount: willExcludeColor ? untranslatedColorCount : 0,
    });

    try {
      const cbzBlob = await exportToCBZ(
        pages,
        exportName,
        fontFamily,
        (current, total, phase, percent) => {
          setExportState((prev) => ({
            ...prev,
            isExporting: true,
            current,
            total,
            phase,
            percent,
            downloadFileName: exportName,
          }));
        },
        {
          excludeUntranslatedColorPages: settings.excludeUntranslatedColorPagesFromExport,
        }
      );

      const url = URL.createObjectURL(cbzBlob);
      const sizeMb = (cbzBlob.size / (1024 * 1024)).toFixed(2) + ' MB';

      setExportState((prev) => ({
        ...prev,
        isExporting: false,
        current: targetTotal,
        total: targetTotal,
        phase: 'done',
        percent: 100,
        downloadUrl: url,
        downloadFileName: exportName,
        fileSizeMb: sizeMb,
        excludedColorCount: willExcludeColor ? untranslatedColorCount : 0,
      }));

      // Programmatic auto-download trigger
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = exportName;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 1000);
      } catch (clickErr) {
        console.warn('Trình duyệt chặn auto-download, hiển thị liên kết tải trực tiếp:', clickErr);
      }
    } catch (err: any) {
      console.error('Lỗi khi xuất file CBZ:', err);
      setExportState({
        isExporting: false,
        current: 0,
        total: pages.length,
        phase: 'error',
        percent: 0,
        errorMessage: err?.message || 'Không thể tạo file CBZ. Vui lòng thử lại.',
      });
    }
  };

  const activePage = pages[activePageIndex];
  const translatedPagesCount = pages.filter((p) => p.status === 'completed').length;
  const eligiblePagesCount = pages.filter(
    (p, idx) => isPageEligibleForTranslation(idx, p, settings).eligible
  ).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <Header
        fileName={fileName}
        totalPages={pages.length}
        translatedPagesCount={translatedPagesCount}
        eligiblePagesCount={eligiblePagesCount}
        isBatchTranslating={isBatchTranslating}
        batchProgress={batchProgress}
        sessionUsage={sessionUsage}
        activePageIndex={activePageIndex}
        pages={pages}
        onUploadFile={handleUploadFile}
        onBatchTranslate={handleBatchTranslate}
        onStopBatchTranslate={handleStopBatchTranslate}
        onExportCBZ={handleExportCBZ}
        isExporting={exportState?.isExporting ?? false}
        onOpenColorStripper={() => setIsColorStripperOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      {/* Cache Restoration Toast Alert */}
      {restoredToast && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-emerald-500/50 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between gap-3 z-30 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{restoredToast}</span>
          </div>
          <button
            onClick={() => setRestoredToast(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Batch Translation Notification Banner with Real-time Estimated Time Remaining */}
      {isBatchTranslating && (
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-b border-indigo-700/60 px-4 py-2.5 text-xs text-indigo-200 flex flex-wrap items-center justify-between gap-3 z-20 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              <span className="font-medium text-slate-200">
                {batchProgress.activeTranslatingPages && batchProgress.activeTranslatingPages.length > 1 ? (
                  <>
                    <span className="text-amber-300 font-bold">⚡ Đang dịch song song {batchProgress.activeTranslatingPages.length} trang:</span>{' '}
                    <strong className="text-white font-mono bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-700/50">
                      {batchProgress.activeTranslatingPages.map((idx) => `#${idx + 1}`).join(', ')}
                    </strong>
                  </>
                ) : (
                  <>
                    Đang dịch:{' '}
                    <strong className="text-white font-mono">
                      Trang #{batchProgress.startPage !== undefined ? batchProgress.startPage + batchProgress.current - 1 : batchProgress.current}
                    </strong>
                  </>
                )}{' '}
                <span className="text-slate-400 font-mono">
                  ({batchProgress.current}/{batchProgress.total} trang)
                </span>
              </span>
            </div>

            {/* Mini Progress Bar */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg">
              <div className="w-20 md:w-28 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${batchProgress.total > 0 ? Math.min(100, Math.round((batchProgress.current / batchProgress.total) * 100)) : 0}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-indigo-300">
                {batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%
              </span>
            </div>

            {/* Live Remaining Time Badge */}
            <div className="flex items-center gap-1.5 bg-amber-950/70 border border-amber-600/60 text-amber-200 px-2.5 py-1 rounded-lg shadow-sm">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span>Thời gian còn lại:</span>
              <strong className="font-mono text-amber-300 font-bold">
                {batchProgress.formattedTimeLeft || 'Đang tính toán...'}
              </strong>
            </div>

            {/* Average Speed Badge */}
            {batchProgress.speedSecondsPerPage && batchProgress.speedSecondsPerPage > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                <Zap className="w-3 h-3 text-indigo-400" />
                <span>~{batchProgress.speedSecondsPerPage.toFixed(1)}s / trang</span>
              </span>
            )}
          </div>

          <button
            onClick={handleStopBatchTranslate}
            className="text-xs bg-rose-600/90 hover:bg-rose-500 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-sm active:scale-95 ml-auto cursor-pointer"
            title="Dừng dịch hàng loạt"
          >
            Dừng dịch
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      {pages.length > 0 ? (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Thumbnail Page Selector */}
          <PageThumbnailBar
            pages={pages}
            activePageIndex={activePageIndex}
            onSelectPage={(index) => {
              setActivePageIndex(index);
              setSelectedBoxId(null);
            }}
            settings={settings}
            onTogglePageSkip={handleToggleManualSkip}
            onTranslateFromPage={(fromIdx) => handleBatchTranslate(fromIdx, pages.length - 1)}
            isBatchTranslating={isBatchTranslating}
          />

          {/* Center Interactive Manga Viewer Stage */}
          {activePage && (
            <MangaCanvas
              page={activePage}
              selectedBoxId={selectedBoxId}
              onSelectBox={setSelectedBoxId}
              onUpdateBox={handleUpdateBox}
              onUpdateAllBoxes={handleUpdateAllBoxes}
              onDeleteBox={handleDeleteBox}
              onRetranslateBox={handleRetranslateBox}
              onTranslateCurrentPage={() => translateSinglePage(activePageIndex)}
              onDetectBubbles={() => translateSinglePage(activePageIndex)}
              onContinueTranslateFromCurrent={() => handleBatchTranslate(activePageIndex, pages.length - 1)}
              fontFamily={fontFamily}
              readerMode={readerMode}
              onChangeReaderMode={setReaderMode}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onAddEraserBox={handleAddEraserBox}
              onAddBox={handleAddBox}
            />
          )}

          {/* Right Speech Bubble Inspector & Editor */}
          <BubbleInspector
            boxes={activePage?.boxes || []}
            selectedBoxId={selectedBoxId}
            onSelectBox={setSelectedBoxId}
            onUpdateBox={handleUpdateBox}
            onDeleteBox={handleDeleteBox}
            onAddBox={handleAddBox}
            onAddEraserBox={handleAddEraserBox}
            onRetranslateBox={handleRetranslateBox}
            onDetectBubbles={() => translateSinglePage(activePageIndex)}
            onAutoSnapBox={handleAutoSnapBox}
            onAutoSnapAll={handleAutoSnapAll}
            isPageTranslating={activePage?.status === 'translating'}
          />
        </div>
      ) : (
        /* Empty Upload Landing View: Drag & Drop Zone with prominent "Đính kèm file CBZ" button */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleUploadFile(e.dataTransfer.files[0]);
            }
          }}
          className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] relative overflow-y-auto"
        >
          <div
            className={`bg-slate-900/95 border-2 rounded-3xl p-8 md:p-10 max-w-xl w-full text-center shadow-2xl space-y-6 transition-all duration-300 backdrop-blur-md ${
              isDragging
                ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02] bg-indigo-950/40'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Previous Session Resume Banner */}
            {savedSession && !isParsingFile && (
              <div className="bg-gradient-to-r from-violet-950/80 via-indigo-950/90 to-violet-950/80 border-2 border-indigo-500/50 p-4 rounded-2xl text-left shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-300">Tìm thấy tiến độ dịch trước đó:</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono font-bold">
                        Đã dịch {savedSession.translatedCount} trang
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white font-mono truncate max-w-xs sm:max-w-sm mt-0.5">
                      {savedSession.fileName}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Đính kèm lại file này để tự động khôi phục và tiếp tục dịch ngay từ trang {savedSession.lastPageIndex + 1}!
                    </p>
                  </div>
                </div>
                <label className="cursor-pointer px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shrink-0 whitespace-nowrap active:scale-95">
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Chọn File Để Dịch Tiếp</span>
                  <input
                    type="file"
                    onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
                    accept=".cbz,.zip,.cbr"
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Upload Icon Badge */}
            <div className="relative mx-auto w-20 h-20">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
                {isParsingFile ? (
                  <Loader2 className="w-10 h-10 animate-spin text-white" />
                ) : (
                  <Paperclip className="w-10 h-10 -rotate-45" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-slate-900 border-2 border-slate-800 text-indigo-400 shadow">
                <FileArchive className="w-4 h-4" />
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {isParsingFile ? 'Đang Giải Nén File CBZ...' : 'Đính Kèm File Truyện Cần Dịch'}
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                {isParsingFile
                  ? 'Hệ thống đang nạp các trang truyện tranh và phân tích cấu trúc màu. Vui lòng đợi trong giây lát...'
                  : 'Tải lên file truyện tranh để AI tự động nhận diện khung thoại, dịch Anh - Việt và giữ nguyên font chữ truyện tranh.'}
              </p>
            </div>

            {/* Main Action Buttons */}
            {!isParsingFile && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <label className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer">
                    <Paperclip className="w-5 h-5 -rotate-45" />
                    <span>Đính kèm file CBZ để dịch</span>
                    <input
                      type="file"
                      onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
                      accept=".cbz,.zip,.cbr"
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => setIsColorStripperOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-pink-600/90 via-pink-500/90 to-amber-600/90 hover:from-pink-500 hover:to-amber-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-pink-600/20 transition transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
                  >
                    <Palette className="w-5 h-5" />
                    <span>Lọc bỏ trang màu CBZ</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Hoặc kéo thả trực tiếp file <strong className="text-indigo-400 font-mono">.cbz</strong>, <strong className="text-indigo-400 font-mono">.zip</strong> vào khung này
                </p>
              </div>
            )}

            {/* Format Badges */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs text-slate-500">Định dạng hỗ trợ:</span>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-800 text-slate-300 rounded border border-slate-700">
                .CBZ
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-800 text-slate-300 rounded border border-slate-700">
                .ZIP
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-800 text-slate-300 rounded border border-slate-700">
                .CBR
              </span>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-left">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>OCR & Tẩy Nền</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Tự động phát hiện vị trí bóng thoại và xóa sạch chữ tiếng Anh gốc.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dịch Theo Ngữ Cảnh</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Văn phong manga mượt mà, hỗ trợ kính ngữ và danh xưng linh hoạt.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Dịch Song Song Siêu Tốc</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Tốc độ cao 1,000+ RPM, xử lý đồng thời 2-3 trang/lần với Gemini Flash.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-pink-900/40 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-pink-300 mb-1">
                  <Palette className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>Lọc Trang Màu CBZ</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Upload file CBZ tiếng Việt, quét nhận diện bìa & poster màu và xuất CBZ sạch.
                </p>
              </div>
            </div>

            {/* Author Credit */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <span className="font-semibold text-amber-300">Tác giả: Trần Trí Nhân</span>
              <span className="text-slate-600">•</span>
              <span>Dịch thuật chuẩn xuất bản & Tối ưu dung lượng CBZ</span>
            </div>
          </div>
        </div>
      )}

      {/* Translation Settings Modal */}
      <TranslationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        fontFamily={fontFamily}
        onChangeFontFamily={setFontFamily}
        pages={pages}
      />

      {/* Color Page Stripper Modal */}
      <ColorPageStripperModal
        isOpen={isColorStripperOpen}
        onClose={() => setIsColorStripperOpen(false)}
        currentWorkspacePages={pages}
        currentWorkspaceFileName={fileName}
        onLoadPagesIntoWorkspace={(newPages, newFileName) => {
          setPages(newPages);
          setFileName(newFileName);
          setActivePageIndex(0);
          setSelectedBoxId(null);
        }}
      />

      {/* Export CBZ Progress & Direct Download Modal */}
      {exportState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  {exportState.phase === 'done'
                    ? 'Xuất File CBZ Thành Công!'
                    : exportState.phase === 'error'
                    ? 'Lỗi Khi Xuất File CBZ'
                    : 'Đang Đóng Gói Tệp Truyện (.CBZ)...'}
                </h3>
              </div>
              <button
                onClick={() => setExportState(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-progress phases: Rendering & Zipping */}
            {(exportState.phase === 'rendering' || exportState.phase === 'zipping') && (
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    {exportState.phase === 'rendering'
                      ? `Đang kết xuất siêu tốc (song song) trang ${exportState.current}/${exportState.total}...`
                      : 'Đang đóng gói file .CBZ (Nén DEFLATE chuẩn)...'}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {exportState.percent}%
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, exportState.percent)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {exportState.phase === 'rendering'
                    ? 'Hệ thống đang chạy 4 luồng song song để ghép thoại tiếng Việt và tối ưu hóa dung lượng ảnh.'
                    : 'Gói nén CBZ chuẩn DEFLATE đang được nén tối ưu, dung lượng nhẹ ngang hoặc hơn file gốc.'}
                </p>
              </div>
            )}

            {/* Success phase */}
            {exportState.phase === 'done' && (
              <div className="space-y-4 py-1">
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-emerald-300">
                      Tệp truyện đã sẵn sàng!
                    </div>
                    <div className="text-slate-300 font-mono text-[11px] break-all">
                      {exportState.downloadFileName} ({exportState.fileSizeMb})
                    </div>
                    {exportState.excludedColorCount !== undefined && exportState.excludedColorCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] font-medium mt-1">
                        <Palette className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span>
                          Đã loại bỏ <strong>{exportState.excludedColorCount} trang màu chưa dịch</strong> theo tùy chọn xuất (Đã đóng gói <strong>{exportState.total}</strong> trang).
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400">
                      File đã được kích hoạt tải xuống. Nếu trình duyệt chặn tải tự động, bạn có thể bấm nút bên dưới:
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {exportState.downloadUrl && (
                    <a
                      href={exportState.downloadUrl}
                      download={exportState.downloadFileName || 'Manga_Dich_Tieng_Viet.cbz'}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải Xuống Ngay</span>
                    </a>
                  )}
                  <button
                    onClick={() => setExportState(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}

            {/* Error phase */}
            {exportState.phase === 'error' && (
              <div className="space-y-4 py-1">
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-rose-300">
                      Không thể xuất file CBZ
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">
                      {exportState.errorMessage}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExportCBZ}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Thử Lại</span>
                  </button>
                  <button
                    onClick={() => setExportState(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
