import React, { useState } from 'react';
import { TranslationSettings, MangaPage } from '../types';
import {
  X,
  Settings,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  ClipboardPaste,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Filter,
  Palette,
  Layers,
  BookOpen,
  CheckSquare,
  Square,
  Zap,
  Gauge,
  DollarSign,
  Coins,
  Flame,
  ArrowUpRight,
  SlidersHorizontal,
  AlertTriangle,
  Info,
  ExternalLink,
  FileArchive,
} from 'lucide-react';

interface TranslationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TranslationSettings;
  onUpdateSettings: (newSettings: TranslationSettings) => void;
  fontFamily: string;
  onChangeFontFamily: (font: 'Comic' | 'Sans' | 'Serif') => void;
  pages?: MangaPage[];
}

export const TranslationSettingsModal: React.FC<TranslationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  fontFamily,
  onChangeFontFamily,
  pages = [],
}) => {
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [inputMode, setInputMode] = useState<'slots' | 'bulk'>('slots');
  const [bulkText, setBulkText] = useState('');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Active keys array (up to 10)
  const currentKeys: string[] = Array.isArray(settings.apiKeys) && settings.apiKeys.length > 0
    ? settings.apiKeys
    : settings.apiKey ? [settings.apiKey] : [];

  const handleUpdateKeyAt = (index: number, val: string) => {
    // Detect if the pasted string has multiple keys separated by spaces, commas, or newlines
    const tokens = val
      .split(/[\s,;\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    let nextKeys: string[] = [];
    if (tokens.length > 1) {
      // Auto-distribute across slots
      const before = currentKeys.slice(0, index);
      const after = currentKeys.slice(index + 1);
      nextKeys = [...before, ...tokens, ...after];
    } else {
      const updated = [...currentKeys];
      updated[index] = val.trim();
      nextKeys = updated;
    }

    const cleanList = nextKeys.slice(0, 10);
    onUpdateSettings({
      ...settings,
      apiKey: cleanList.find((k) => k && k.length > 15) || cleanList[0] || '',
      apiKeys: cleanList,
    });
  };

  const handleRemoveKeyAt = (index: number) => {
    const updated = currentKeys.filter((_, i) => i !== index);
    onUpdateSettings({
      ...settings,
      apiKey: updated.find((k) => k && k.length > 15) || updated[0] || '',
      apiKeys: updated,
    });
  };

  const handleAddKeySlot = () => {
    if (currentKeys.length >= 10) return;
    const updated = [...currentKeys, ''];
    onUpdateSettings({
      ...settings,
      apiKeys: updated,
    });
  };

  const handlePreFill10Slots = () => {
    const padded = [...currentKeys];
    while (padded.length < 10) {
      padded.push('');
    }
    onUpdateSettings({
      ...settings,
      apiKeys: padded.slice(0, 10),
    });
  };

  const handleApplyBulk = () => {
    if (!bulkText.trim()) return;
    const extracted = bulkText
      .split(/[\s,;\n\r]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 15);

    // Deduplicate and cap at 10
    const uniqueKeys = Array.from(new Set(extracted)).slice(0, 10);

    onUpdateSettings({
      ...settings,
      apiKey: uniqueKeys[0] || '',
      apiKeys: uniqueKeys,
    });

    setBulkSuccessMsg(`Đã nạp thành công ${uniqueKeys.length} API Key!`);
    setTimeout(() => {
      setBulkSuccessMsg('');
      setInputMode('slots');
    }, 1200);
  };

  const handleClearAllKeys = () => {
    if (confirm('Bạn có chắc muốn xóa tất cả các API Key đã lưu?')) {
      onUpdateSettings({
        ...settings,
        apiKey: '',
        apiKeys: [],
      });
      setBulkText('');
    }
  };

  const activeValidKeys = currentKeys.filter((k) => k && k.trim().length > 5);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100">Cài Đặt Dịch Thuật & Xoay Tua API</h2>
              <p className="text-xs text-slate-400">Tự động xoay tua tối đa 10 Gemini API Key để tránh giới hạn 429</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs text-slate-300 custom-scrollbar">
          {/* CẤU HÌNH DỊCH THUẬT CHUYÊN NGHIỆP */}
          <div className="space-y-4 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>CẤU HÌNH DỊCH THUẬT GEMINI API TỐC ĐỘ CAO</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-semibold flex items-center gap-1">
                <span>⚡ 1,000+ RPM</span>
                <span className="text-amber-500">•</span>
                <span>Tốc độ & Chất lượng cao nhất</span>
              </span>
            </div>

              {/* Important Billing & Key Note */}
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200/90 text-[11px] leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Lưu ý để Google cấp hạn ngạch cao nhất (1,000+ RPM):</span>
                </div>
                <p>
                  1. <strong>Project Google Cloud đã bật Billing</strong>: Khi tạo API Key trên Google AI Studio, bạn cần chọn một Project đã được liên kết với <strong>Thẻ thanh toán (Billing Account)</strong> trên Google Cloud Console.
                </p>
                <p>
                  2. <strong>Tránh chọn "Create API key in new project"</strong>: Nên chọn Project đã liên kết Billing để được hưởng hạn ngạch cao nhất (1,000+ lượt gọi/phút).
                </p>
                <p>
                  3. <strong>Kiểm tra nhanh</strong>: Truy cập{' '}
                  <a
                    href="https://console.cloud.google.com/billing/linkedaccount"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 underline font-semibold hover:text-amber-100 inline-flex items-center gap-0.5"
                  >
                    Google Cloud Billing <ExternalLink className="w-2.5 h-2.5" />
                  </a>{' '}
                  hoặc{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 underline font-semibold hover:text-amber-100 inline-flex items-center gap-0.5"
                  >
                    AI Studio API Keys <ExternalLink className="w-2.5 h-2.5" />
                  </a>{' '}
                  để kiểm tra Project chứa API Key của bạn.
                </p>
              </div>

              {/* 1. Model Selection - Gemini 3.6 Flash vs Gemini 3.1 Flash Lite Preview */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-200 block text-xs flex items-center justify-between">
                  <span>1. Chọn Mô Hình AI Dịch Thuật:</span>
                  <span className="text-[10px] text-amber-400 font-mono font-normal">
                    {settings.paidModel === 'gemini-3.1-flash-lite-preview'
                      ? 'Đang chọn: 3.1 Flash Lite Preview'
                      : 'Đang chọn: 3.6 Flash'}
                  </span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Option 1: Gemini 3.6 Flash */}
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, paidModel: 'gemini-3.6-flash' })}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      (settings.paidModel || 'gemini-3.6-flash') === 'gemini-3.6-flash'
                        ? 'border-amber-500 bg-amber-950/50 ring-1 ring-amber-500/50 shadow-md'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 opacity-75'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between font-bold text-xs text-amber-300">
                        <span>Gemini 3.6 Flash</span>
                        {(settings.paidModel || 'gemini-3.6-flash') === 'gemini-3.6-flash' && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                            Đang chọn
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Mô hình chuẩn chuyên biệt cho manga: Phân tích biểu cảm, ngữ cảnh sâu sắc, văn phong thoại chuẩn xuất bản.
                      </p>
                      <div className="text-[10px] text-amber-400/80 font-mono">
                        $0.075 / $0.30 cho 1M token (~5 VNĐ/trang)
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Gemini 3.1 Flash Lite Preview */}
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, paidModel: 'gemini-3.1-flash-lite-preview' })}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      settings.paidModel === 'gemini-3.1-flash-lite-preview' || settings.paidModel === 'gemini-3.1-flash-lite'
                        ? 'border-cyan-500 bg-cyan-950/50 ring-1 ring-cyan-500/50 shadow-md'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 opacity-75'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between font-bold text-xs text-cyan-300">
                        <span>Gemini 3.1 Flash Lite</span>
                        {settings.paidModel === 'gemini-3.1-flash-lite-preview' || settings.paidModel === 'gemini-3.1-flash-lite' ? (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full border border-cyan-500/30">
                            Đang chọn
                          </span>
                        ) : (
                          <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-1.5 py-0.5 rounded-full border border-cyan-700/40">
                            Lite Preview ⚡
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Mô hình siêu nhẹ (Lite) tốc độ vượt trội: Độ trễ phản hồi cực thấp, tối ưu hoá token và hạn ngạch quota gọi liên tục.
                      </p>
                      <div className="text-[10px] text-cyan-400/80 font-mono">
                        $0.075 / $0.30 cho 1M token (~5 VNĐ/trang)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Concurrency & Pacing Speed */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Concurrency */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block text-xs flex items-center justify-between">
                    <span>2. Dịch Song Song:</span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold">
                      {settings.concurrency || 2} trang/lần
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {[
                      { val: 1, label: '1 trang' },
                      { val: 2, label: '2 trang ⚡' },
                      { val: 3, label: '3 trang 🚀' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ ...settings, concurrency: item.val as 1 | 2 | 3 })
                        }
                        className={`py-1.5 text-center text-xs rounded-lg font-medium transition ${
                          (settings.concurrency || 2) === item.val
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Dịch đồng thời giúp rút ngắn 50% - 70% tổng thời gian dịch tập truyện!
                  </p>
                </div>

                {/* Pacing Speed */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-200 block text-xs flex items-center justify-between">
                    <span>3. Tốc Độ Nghỉ (Pacing):</span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold">
                      {settings.paidPacingSpeed === 'normal'
                        ? '2.0s'
                        : settings.paidPacingSpeed === 'fast'
                        ? '1.0s'
                        : '0.4s (Turbo)'}
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {[
                      { id: 'turbo', label: 'Siêu tốc' },
                      { id: 'fast', label: 'Nhanh' },
                      { id: 'normal', label: '2 giây' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            paidPacingSpeed: item.id as 'turbo' | 'fast' | 'normal',
                          })
                        }
                        className={`py-1.5 text-center text-xs rounded-lg font-medium transition ${
                          (settings.paidPacingSpeed || 'turbo') === item.id
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tùy chỉnh khoảng nghỉ giữa các lần gọi API để dịch liên tục và ổn định.
                  </p>
                </div>
              </div>

              {/* 3. Deep Nuance & Literary Manga Localization */}
              <div
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    deepNuance: !settings.deepNuance,
                  })
                }
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  settings.deepNuance ?? true
                    ? 'border-amber-500/70 bg-amber-950/30'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5 text-amber-400">
                  {settings.deepNuance ?? true ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tối ưu Chiều Sâu Văn Học & Sắc Thái Manga (Deep Nuance)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    AI tự động phân tích nét mặt, biểu cảm nhân vật, bối cảnh hành động để điều chỉnh lời thoại tự nhiên, giàu cảm xúc, chuyển ngữ mượt mà từ lóng và SFX chuẩn phong cách truyện tranh chuyên nghiệp.
                  </p>
                </div>
              </div>

              {/* 4. Cost Estimator Widget */}
              {pages.length > 0 && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/90 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-xs text-slate-200">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Dự Toán Chi Phí File Hiện Tại ({pages.length} trang)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Bảng giá Google Cloud</span>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Chi phí ước tính (Gemini 3.6 Flash):</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        ~${(pages.length * 0.0002).toFixed(4)} USD
                      </span>
                      <span className="text-slate-400 text-[10px] ml-1.5 font-medium">
                        (~{Math.round(pages.length * 0.0002 * 25400)} VNĐ)
                      </span>
                    </div>
                    <div className="text-right text-[10px] text-slate-400">
                      <span className="text-amber-300 font-mono font-bold">~5 VNĐ / trang</span>
                      <p className="text-emerald-400 text-[9px]">Chi phí siêu rẻ</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Chi phí dịch với Gemini 3.6 Flash cực kỳ thấp (chỉ ~5 VNĐ cho mỗi trang truyện), bạn có thể dịch hàng chục tập truyện mà chỉ tốn vài nghìn đồng.
                  </p>
                </div>
              )}
            </div>

          {/* 1. Gemini API Key section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${activeValidKeys.length > 1 ? 'text-emerald-400 animate-spin-slow' : 'text-indigo-400'}`} />
                <label className="font-bold text-slate-200 block text-xs tracking-wider uppercase">
                  GEMINI API KEY (HỖ TRỢ NẠP TỐI ĐA 10 KEYS)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  activeValidKeys.length > 0
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                    : 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                }`}>
                  {activeValidKeys.length > 0
                    ? `${activeValidKeys.length} Key Hoạt Động`
                    : 'Chưa có Key'}
                </span>
                {currentKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    className="p-1 text-slate-400 hover:text-slate-200 transition"
                    title={showApiKeys ? 'Ẩn ký tự API Key' : 'Hiện ký tự API Key'}
                  >
                    {showApiKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Input Mode Selector */}
            <div className="flex items-center justify-between bg-slate-950 p-1 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInputMode('slots')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    inputMode === 'slots'
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Danh Sách Keys ({activeValidKeys.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('bulk')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    inputMode === 'bulk'
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Dán Nhanh Nhiều Keys</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {currentKeys.length < 10 && (
                  <button
                    type="button"
                    onClick={handlePreFill10Slots}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-2 py-1 rounded-md transition"
                    title="Tạo sẵn 10 ô trống để điền lần lượt từng Key"
                  >
                    + Tạo 10 ô nhập
                  </button>
                )}
                {activeValidKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllKeys}
                    className="text-[10px] text-rose-400 hover:text-rose-300 px-2 py-1 transition"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>
            </div>

            {/* Mode 1: Individual slots */}
            {inputMode === 'slots' && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {currentKeys.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                    <p className="text-slate-400 text-xs">
                      Chưa có API Key nào. Thêm các Gemini API Key từ Google AI Studio để hệ thống tự động xoay tua với tốc độ cao!
                    </p>
                    <button
                      type="button"
                      onClick={handleAddKeySlot}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs inline-flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm Key Đầu Tiên</span>
                    </button>
                  </div>
                ) : (
                  currentKeys.map((key, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-[11px] font-mono text-slate-400 text-right font-bold">
                        #{idx + 1}
                      </span>
                      <div className="relative flex-1">
                        <input
                          type={showApiKeys ? 'text' : 'password'}
                          value={key}
                          onChange={(e) => handleUpdateKeyAt(idx, e.target.value)}
                          placeholder={`Dán Google Gemini Key (AIzaSy...) hoặc ShopAIKey (sk-...) #${idx + 1}`}
                          className={`w-full py-2.5 px-3 bg-slate-950 border rounded-xl text-xs text-white focus:outline-none font-mono transition ${
                            key.trim().startsWith('sk-')
                              ? 'border-cyan-500/80 focus:border-cyan-400 pr-32'
                              : key.trim().startsWith('AIza')
                              ? 'border-emerald-500/80 focus:border-emerald-400 pr-28'
                              : 'border-slate-800 focus:border-indigo-500 pr-24'
                          }`}
                        />
                        {key.trim().startsWith('sk-') && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyan-300 font-semibold flex items-center gap-1 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                            <span>ShopAIKey (Proxy)</span>
                          </span>
                        )}
                        {key.trim().startsWith('AIza') && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Google Gemini</span>
                          </span>
                        )}
                        {!key.trim().startsWith('sk-') && !key.trim().startsWith('AIza') && key.trim().length > 5 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 flex items-center gap-0.5 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            <span>Key tùy chỉnh</span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyAt(idx)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                        title="Xóa Key này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}

                {currentKeys.length > 0 && currentKeys.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddKeySlot}
                    className="w-full py-2 border border-dashed border-slate-700/80 hover:border-indigo-500/80 rounded-xl text-indigo-400 hover:text-indigo-300 transition flex items-center justify-center gap-1 text-xs mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm ô nhập API Key ({currentKeys.length}/10)</span>
                  </button>
                )}
              </div>
            )}

            {/* Mode 2: Bulk paste textarea */}
            {inputMode === 'bulk' && (
              <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <p className="text-[11px] text-slate-400">
                  Dán danh sách các API Key của bạn vào bên dưới (hỗ trợ cả Google Gemini <span className="text-emerald-400 font-mono">AIzaSy...</span> và ShopAIKey <span className="text-cyan-400 font-mono">sk-...</span>, mỗi key trên 1 dòng hoặc cách nhau bằng dấu phẩy):
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`AIzaSyExampleKey1...\nsk-JSSlAwgCuyytCS9tHGRb5RhuNTQEA6iw8BIXjbrL2KFhSOHJ...\nAIzaSyExampleKey2...`}
                  rows={4}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                />
                {bulkSuccessMsg && (
                  <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{bulkSuccessMsg}</span>
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setInputMode('slots')}
                    className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBulk}
                    disabled={!bulkText.trim()}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
                  >
                    Nạp và Phân Tách Keys
                  </button>
                </div>
              </div>
            )}

            {/* Explanatory Info Card */}
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-3 text-[11px] text-amber-200 leading-relaxed space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Ưu Điểm Khi Sử Dụng Gemini API Tốc Độ Cao:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                <li>
                  <strong>Hạn ngạch cao (1,000+ RPM):</strong> Bạn chỉ cần <strong>1 API Key duy nhất</strong> (hoặc thêm nhiều key để xoay tua) là đã có thể dịch mượt mà không lo bị nghẽn hay chạm trần hạn ngạch.
                </li>
                <li>
                  <strong>Dịch Song Song & Siêu Tốc Turbo:</strong> Mở khóa chế độ xử lý 2-3 trang cùng một lúc, rút ngắn thời gian dịch toàn bộ tập truyện chỉ còn vài phút.
                </li>
                <li>
                  <strong>Chất lượng dịch như truyện xuất bản:</strong> Mô hình Gemini 3.6 Flash / 3.1 Lite thế hệ mới kết hợp cùng tính năng Deep Nuance giúp câu thoại trôi chảy, giàu sắc thái cảm xúc và phong vị manga đích thực.
                </li>
                <li>
                  <strong>Bảo mật:</strong> Tất cả khóa API được mã hóa và lưu trữ cục bộ trong trình duyệt (<code className="bg-slate-900 text-amber-300 px-1 py-0.5 rounded text-[10px] font-mono">LocalStorage</code>) của bạn.
                </li>
              </ul>
            </div>
          </div>

          <hr className="border-slate-800/80 my-2" />

          {/* 2. Page Filtering Rules (B&W Only & Skip First 4 Pages) */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-100 flex items-center gap-2 text-xs">
                <Filter className="w-4 h-4 text-amber-400" />
                <span>BỘ LỌC TRANG DỊCH (BẢO VỆ TRANH MÀU & TIẾT KIỆM API)</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                Đã bật lọc thông minh
              </span>
            </div>

            {/* Rule 1: Only Translate Black & White (Skip Color Pages) */}
            <div
              onClick={() => {
                const nextVal = !settings.onlyTranslateBW;
                onUpdateSettings({
                  ...settings,
                  onlyTranslateBW: nextVal,
                  skipColorPages: nextVal,
                });
              }}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                settings.onlyTranslateBW
                  ? 'border-indigo-500/70 bg-indigo-950/30'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
              }`}
            >
              <div className="mt-0.5 text-indigo-400">
                {settings.onlyTranslateBW ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Palette className="w-3.5 h-3.5 text-pink-400" />
                  <span>Chỉ dịch các trang Trắng Đen (Bỏ qua trang có màu)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Tự động quét pixel màu. Trang bìa màu, poster, trang giới thiệu nhân vật có màu sắc sẽ được <strong>giữ nguyên vẹn</strong>, không tốn lượt gọi API.
                </p>
              </div>
            </div>

            {/* Rule 1.1: Exclude untranslated color pages when exporting CBZ */}
            <div
              onClick={() => {
                onUpdateSettings({
                  ...settings,
                  excludeUntranslatedColorPagesFromExport: !settings.excludeUntranslatedColorPagesFromExport,
                });
              }}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                settings.excludeUntranslatedColorPagesFromExport
                  ? 'border-emerald-500/70 bg-emerald-950/30'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
              }`}
            >
              <div className="mt-0.5 text-emerald-400">
                {settings.excludeUntranslatedColorPagesFromExport ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Không đóng các trang màu chưa dịch vào file kết quả CBZ</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition ${
                      settings.excludeUntranslatedColorPagesFromExport
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {settings.excludeUntranslatedColorPagesFromExport ? 'Đang bật' : 'Tắt'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Khi bật tùy chọn này, nếu không dịch các trang màu (bìa màu, tranh poster được bỏ qua), thì khi dịch xong và xuất file CBZ, hệ thống sẽ <strong>loại bỏ hoàn toàn các trang màu chưa dịch này</strong> ra khỏi file CBZ kết quả, giúp tệp xuất ra chỉ chứa các trang truyện tranh đã dịch.
                </p>
                {pages && pages.length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-300 flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                    <Palette className="w-3 h-3 text-pink-400 shrink-0" />
                    <span>
                      File hiện tại: <strong>{pages.filter((p) => p.isColor && p.status !== 'completed').length} trang màu chưa dịch</strong>
                      {settings.excludeUntranslatedColorPagesFromExport
                        ? ' → Sẽ được loại bỏ khi xuất file CBZ'
                        : ' → Sẽ được giữ lại trong file CBZ kết quả'}.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rule 2: Skip First N Pages (e.g. 4 Pages) */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bỏ qua các trang đầu tiên của file CBZ</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        skipFirstNPages: Math.max(0, (settings.skipFirstNPages ?? 4) - 1),
                      })
                    }
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-sm text-indigo-300">
                    {settings.skipFirstNPages ?? 4}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        skipFirstNPages: Math.min(20, (settings.skipFirstNPages ?? 4) + 1),
                      })
                    }
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-slate-400">trang</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                4 trang đầu tiên thường là bìa truyện, credit nhóm dịch, mục lục và giới thiệu tác giả. Bỏ qua để tập trung dịch cốt truyện chính.
              </p>
            </div>

            {/* Rule 3: Custom Page Range for Translation */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Tùy chọn khoảng trang dịch cụ thể</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      customRangeEnabled: !settings.customRangeEnabled,
                      startPage: settings.startPage || 1,
                      endPage: settings.endPage || (pages.length > 0 ? pages.length : 50),
                    })
                  }
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition border flex items-center gap-1 ${
                    settings.customRangeEnabled
                      ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {settings.customRangeEnabled ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                      <span>Đang bật</span>
                    </>
                  ) : (
                    <span>Tắt (Dịch hết)</span>
                  )}
                </button>
              </div>

              {settings.customRangeEnabled && (
                <div className="pt-1 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-semibold">
                        Bắt đầu từ trang số:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={settings.endPage || (pages.length > 0 ? pages.length : 999)}
                        value={settings.startPage || 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            onUpdateSettings({
                              ...settings,
                              startPage: Math.max(1, val),
                            });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                        placeholder="1"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-semibold">
                        Kết thúc ở trang số:
                      </label>
                      <input
                        type="number"
                        min={settings.startPage || 1}
                        max={pages.length > 0 ? pages.length : 999}
                        value={settings.endPage || (pages.length > 0 ? pages.length : 50)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            onUpdateSettings({
                              ...settings,
                              endPage: Math.max(settings.startPage || 1, val),
                            });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                        placeholder={pages.length > 0 ? String(pages.length) : '50'}
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Chỉ những trang nằm trong khoảng từ trang {settings.startPage || 1} đến trang {settings.endPage || (pages.length > 0 ? pages.length : 'hết')} mới được gửi dịch tự động. Thích hợp khi bạn chỉ muốn đọc chương tiếp theo hoặc dịch tiếp đoạn dở dang.
                  </p>
                </div>
              )}
            </div>

            {/* Real-time Page Status for Current Manga */}
            {pages.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Thống kê file hiện tại ({pages.length} trang):
                </span>
                <div className="flex items-center gap-3 font-semibold text-[11px]">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Sẽ dịch: {pages.filter((p, idx) => {
                      if (p.manualSkip === true) return false;
                      if (p.manualSkip === false) return true;
                      if (settings.customRangeEnabled) {
                        const pageNum = idx + 1;
                        if (settings.startPage && pageNum < settings.startPage) return false;
                        if (settings.endPage && pageNum > settings.endPage) return false;
                      }
                      if ((settings.skipFirstNPages ?? 4) > 0 && idx < (settings.skipFirstNPages ?? 4)) return false;
                      if (settings.onlyTranslateBW && p.isColor) return false;
                      return true;
                    }).length} trang
                  </span>
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Bỏ qua: {pages.filter((p, idx) => {
                      if (p.manualSkip === true) return true;
                      if (p.manualSkip === false) return false;
                      if (settings.customRangeEnabled) {
                        const pageNum = idx + 1;
                        if (settings.startPage && pageNum < settings.startPage) return true;
                        if (settings.endPage && pageNum > settings.endPage) return true;
                      }
                      if ((settings.skipFirstNPages ?? 4) > 0 && idx < (settings.skipFirstNPages ?? 4)) return true;
                      if (settings.onlyTranslateBW && p.isColor) return true;
                      return false;
                    }).length} trang
                  </span>
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-800/80 my-2" />

          {/* 3. Translation Tone */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-200 block text-xs">
              1. Văn phong dịch (Translation Tone):
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'natural', label: 'Tự nhiên & Chuẩn Manga', desc: 'Sử dụng ngôn ngữ đời thường, tự nhiên' },
                { id: 'informal', label: 'Hài hước / Thân mật', desc: 'Thích hợp truyện hài, đời thường' },
                { id: 'dramatic', label: 'Kịch tính / Võ thuật', desc: 'Dành cho Shonen, kiếm hiệp, hành động' },
                { id: 'formal', label: 'Lịch sự / Trang trọng', desc: 'Dành cho bối cảnh quý tộc, học thuật' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    onUpdateSettings({ ...settings, tone: t.id as any })
                  }
                  className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                    settings.tone === t.id
                      ? 'border-indigo-500 bg-indigo-950/50 ring-1 ring-indigo-500/30'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-slate-200 flex items-center justify-between">
                    <span>{t.label}</span>
                    {settings.tone === t.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </span>
                  <span className="text-[10px] text-slate-400">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Addressing Pairs / Pronouns */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs">
              2. Quy tắc Xưng hô (Pronouns & Honorifics):
            </label>
            <p className="text-[11px] text-slate-400">
              Nhập các cặp xưng hô ưu tiên để AI dịch đồng bộ nhân vật:
            </p>
            <input
              type="text"
              value={settings.addressingPairs}
              onChange={(e) =>
                onUpdateSettings({ ...settings, addressingPairs: e.target.value })
              }
              placeholder="VD: Cậu - Tớ, Anh - Em, Ta - Ngươi, Tôi - Bạn..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* 4. Font Family for Manga Overlay */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-200 block text-xs">
              3. Font chữ hiển thị trên Manga (Manga Font Style):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Comic', label: 'Comic Style', sample: 'ABC Manga' },
                { id: 'Sans', label: 'Clean Sans', sample: 'ABC Manga' },
                { id: 'Serif', label: 'Classic Serif', sample: 'ABC Manga' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => onChangeFontFamily(f.id as any)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    fontFamily === f.id
                      ? 'border-indigo-500 bg-indigo-950/50 ring-1 ring-indigo-500/30'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-slate-200 block mb-1">{f.label}</span>
                  <span
                    className="text-xs text-indigo-300 block font-bold"
                    style={{
                      fontFamily:
                        f.id === 'Comic'
                          ? '"Comic Sans MS", cursive, sans-serif'
                          : f.id === 'Serif'
                          ? 'Georgia, serif'
                          : 'sans-serif',
                    }}
                  >
                    {f.sample}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            Lưu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
