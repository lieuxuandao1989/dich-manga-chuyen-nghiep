import React, { useRef, useState, useEffect } from 'react';
import {
  BookOpen,
  Upload,
  Download,
  Sparkles,
  Settings,
  FileCode,
  CheckCircle2,
  Loader2,
  FolderOpen,
  RefreshCw,
  Filter,
  Paperclip,
  ChevronDown,
  Layers,
  ArrowRight,
  Play,
  Bookmark,
  Clock,
  Timer,
  Zap,
  Coins,
  Palette,
} from 'lucide-react';
import { TranslationSettings, BatchProgress, SessionUsage, MangaPage } from '../types';

interface HeaderProps {
  fileName: string;
  totalPages: number;
  translatedPagesCount: number;
  eligiblePagesCount?: number;
  isBatchTranslating: boolean;
  batchProgress: BatchProgress;
  sessionUsage?: SessionUsage;
  activePageIndex?: number;
  pages?: MangaPage[];
  onUploadFile: (file: File) => void;
  onLoadSample?: () => void;
  onBatchTranslate: (startIdx?: number, endIdx?: number) => void;
  onStopBatchTranslate?: () => void;
  onExportCBZ: () => void;
  isExporting?: boolean;
  onOpenColorStripper?: () => void;
  onOpenSettings: () => void;
  settings: TranslationSettings;
  onUpdateSettings?: (settings: TranslationSettings) => void;
}

export const Header: React.FC<HeaderProps> = ({
  fileName,
  totalPages,
  translatedPagesCount,
  eligiblePagesCount,
  isBatchTranslating,
  batchProgress,
  sessionUsage,
  activePageIndex = 0,
  pages,
  onUploadFile,
  onLoadSample,
  onBatchTranslate,
  onStopBatchTranslate,
  onExportCBZ,
  isExporting = false,
  onOpenColorStripper,
  onOpenSettings,
  settings,
  onUpdateSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rangeMenuRef = useRef<HTMLDivElement>(null);

  // Find first uncompleted and unskipped page to resume smoothly
  const firstPendingIndex = pages
    ? pages.findIndex((p) => p.status !== 'completed' && p.status !== 'skipped')
    : -1;
  const resumeIndex = firstPendingIndex >= 0 ? firstPendingIndex : activePageIndex;

  // Range selection states (1-indexed for user display)
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);
  const [customStart, setCustomStart] = useState<number>(() => {
    return settings.startPage && settings.startPage >= 1 ? settings.startPage : 1;
  });
  const [customEnd, setCustomEnd] = useState<number>(() => {
    return settings.endPage && settings.endPage <= totalPages ? settings.endPage : totalPages || 1;
  });

  // Sync custom end when totalPages updates
  useEffect(() => {
    if (totalPages > 0) {
      setCustomEnd((prev) => (prev > totalPages || prev === 0 ? totalPages : prev));
      if (customStart > totalPages) {
        setCustomStart(1);
      }
    }
  }, [totalPages]);

  // Close range menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rangeMenuRef.current && !rangeMenuRef.current.contains(e.target as Node)) {
        setIsRangeMenuOpen(false);
      }
    };
    if (isRangeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRangeMenuOpen]);

  const activeKeysCount =
    settings.apiKeys && settings.apiKeys.length > 0
      ? settings.apiKeys.filter((k) => k && k.trim().length > 5).length
      : settings.apiKey && settings.apiKey.trim().length > 5
      ? 1
      : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleStartTranslateAll = () => {
    setIsRangeMenuOpen(false);
    onBatchTranslate(0, totalPages - 1);
  };

  const handleStartTranslateFromCurrent = () => {
    setIsRangeMenuOpen(false);
    onBatchTranslate(activePageIndex, totalPages - 1);
  };

  const handleStartTranslateRange = (startNum: number, endNum: number) => {
    setIsRangeMenuOpen(false);
    const startIdx = Math.max(0, Math.min(totalPages - 1, startNum - 1));
    const endIdx = Math.max(startIdx, Math.min(totalPages - 1, endNum - 1));
    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        startPage: startNum,
        endPage: endNum,
      });
    }
    onBatchTranslate(startIdx, endIdx);
  };

  // Label display on the main action button
  const isCustomRangeConfigured =
    settings.startPage &&
    settings.endPage &&
    (settings.startPage > 1 || settings.endPage < totalPages);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & File Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm md:text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent uppercase">
                DỊCH THUẬT MANGA CHUYÊN NGHIỆP
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                <span className="text-amber-300 font-semibold">Tác giả: Trần Trí Nhân</span>
                <span className="text-slate-600">•</span>
                <span>Dịch Anh - Việt Giữ Nguyên Định Dạng</span>
                {fileName ? (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="truncate max-w-[130px] md:max-w-[180px] font-mono text-indigo-300 font-medium">
                      {fileName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-400/90">Chưa có file</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Translation Progress Badge */}
        {totalPages > 0 && (
          <div className="hidden lg:flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-full text-xs">
            <span className="text-slate-300">Tiến độ dịch:</span>
            <div className="flex items-center gap-1 font-semibold text-indigo-400">
              <span>{translatedPagesCount}</span>
              <span className="text-slate-500">/</span>
              <span>{totalPages} trang</span>
            </div>
            <div className="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${(translatedPagesCount / totalPages) * 100}%` }}
              />
            </div>
            {isBatchTranslating && batchProgress.formattedTimeLeft && (
              <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1 pl-1 border-l border-slate-700 font-semibold" title="Thời gian ước tính còn lại để hoàn thành">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>~{batchProgress.formattedTimeLeft}</span>
              </span>
            )}
          </div>
        )}

        {/* Main Action Bar */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto pb-1 md:pb-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".cbz,.zip,.cbr,image/*"
            className="hidden"
          />

          {/* Nút Đính Kèm File CBZ Cần Dịch */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-indigo-600/25 active:scale-95 cursor-pointer"
            title="Đính kèm file truyện tranh CBZ, ZIP, CBR để bắt đầu dịch"
          >
            <Paperclip className="w-4 h-4" />
            <span>Đính kèm file CBZ</span>
          </button>

          {totalPages > 0 && (
            <>
              {isBatchTranslating ? (
                <div className="flex items-center gap-1.5">
                  <div className="px-3 py-1.5 text-xs font-semibold bg-indigo-900/90 border border-indigo-700/80 text-indigo-200 rounded-xl flex items-center gap-2 shadow-md">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="leading-tight">
                        {batchProgress.activeTranslatingPages && batchProgress.activeTranslatingPages.length > 1
                          ? `⚡ Song song ${batchProgress.activeTranslatingPages.length} trang (${batchProgress.activeTranslatingPages.map((idx) => `#${idx + 1}`).join(', ')})`
                          : batchProgress.startPage
                          ? `Trang #${batchProgress.startPage + batchProgress.current - 1} (${batchProgress.current}/${batchProgress.total})`
                          : `Dịch trang (${batchProgress.current}/${batchProgress.total})`}
                      </span>
                      {batchProgress.formattedTimeLeft && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-300 font-mono mt-0.5 font-normal">
                          <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span>Còn lại: ~{batchProgress.formattedTimeLeft}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {onStopBatchTranslate && (
                    <button
                      onClick={onStopBatchTranslate}
                      className="px-2.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition shadow-md active:scale-95"
                      title="Dừng dịch hàng loạt"
                    >
                      Dừng
                    </button>
                  )}
                </div>
              ) : (
                /* Split Button with Page Range Options */
                <div className="relative flex items-center" ref={rangeMenuRef}>
                  <button
                    onClick={() => {
                      if (isCustomRangeConfigured && settings.startPage && settings.endPage) {
                        handleStartTranslateRange(settings.startPage, settings.endPage);
                      } else if (translatedPagesCount > 0 && translatedPagesCount < totalPages) {
                        onBatchTranslate(resumeIndex, totalPages - 1);
                      } else {
                        handleStartTranslateAll();
                      }
                    }}
                    className={`px-3.5 py-2 text-xs font-bold rounded-l-xl transition flex items-center gap-1.5 whitespace-nowrap shadow-md active:scale-95 ${
                      translatedPagesCount > 0 && translatedPagesCount < totalPages
                        ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/30 ring-1 ring-violet-400/40'
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/20'
                    }`}
                    title={
                      isCustomRangeConfigured
                        ? `Dịch theo khoảng đã chọn: từ trang ${settings.startPage} đến ${settings.endPage}`
                        : translatedPagesCount > 0 && translatedPagesCount < totalPages
                        ? `Tiếp tục dịch tự động từ trang #${resumeIndex + 1} đến trang #${totalPages}`
                        : 'Bắt đầu dịch tự động toàn bộ file'
                    }
                  >
                    {isCustomRangeConfigured ? (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Dịch (Trang {settings.startPage}-{settings.endPage})</span>
                      </>
                    ) : translatedPagesCount > 0 && translatedPagesCount < totalPages ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white text-white" />
                        <span>Tiếp Tục Dịch (Từ Trang #{resumeIndex + 1})</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Bắt Đầu Dịch</span>
                      </>
                    )}
                  </button>

                  {/* Dropdown trigger for selecting range */}
                  <button
                    onClick={() => setIsRangeMenuOpen((prev) => !prev)}
                    className="px-2 py-2 text-xs font-semibold bg-violet-700 hover:bg-violet-600 text-white rounded-r-xl border-l border-violet-500/50 transition flex items-center shadow-md active:scale-95"
                    title="Tùy chọn dịch từ trang cụ thể trong file CBZ"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition duration-200 ${isRangeMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Page Range Dropdown Popover */}
                  {isRangeMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-3 z-50 text-slate-200 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <Layers className="w-4 h-4 text-indigo-400" />
                          <span>Tùy chọn trang dịch (CBZ)</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          Tổng: {totalPages} trang
                        </span>
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1.5 mb-3">
                        {/* Option 1: Translate from current page */}
                        <button
                          onClick={handleStartTranslateFromCurrent}
                          className="w-full px-2.5 py-2 text-left text-xs rounded-xl bg-slate-800/80 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-transparent transition flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <Bookmark className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
                            <div>
                              <p className="font-semibold text-slate-100">
                                Dịch từ trang hiện tại #{activePageIndex + 1}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Từ trang {activePageIndex + 1} đến trang {totalPages}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-indigo-300 font-bold bg-slate-900 px-1.5 py-0.5 rounded">
                            {totalPages - activePageIndex} trang
                          </span>
                        </button>

                        {/* Option 2: Translate all pages */}
                        <button
                          onClick={handleStartTranslateAll}
                          className="w-full px-2.5 py-2 text-left text-xs rounded-xl bg-slate-800/80 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-transparent transition flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition" />
                            <div>
                              <p className="font-semibold text-slate-100">Dịch toàn bộ file CBZ</p>
                              <p className="text-[10px] text-slate-400">
                                Từ trang 1 đến trang {totalPages}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-indigo-300 font-bold bg-slate-900 px-1.5 py-0.5 rounded">
                            {totalPages} trang
                          </span>
                        </button>

                        {/* Option 3: Quick Next 5 or 10 pages from current */}
                        {activePageIndex + 1 < totalPages && (
                          <div className="flex gap-1.5 pt-0.5">
                            <button
                              onClick={() =>
                                handleStartTranslateRange(
                                  activePageIndex + 1,
                                  Math.min(totalPages, activePageIndex + 5)
                                )
                              }
                              className="flex-1 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-slate-700 transition text-center"
                            >
                              +5 trang tiếp theo
                            </button>
                            <button
                              onClick={() =>
                                handleStartTranslateRange(
                                  activePageIndex + 1,
                                  Math.min(totalPages, activePageIndex + 10)
                                )
                              }
                              className="flex-1 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-slate-700 transition text-center"
                            >
                              +10 trang tiếp theo
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Custom Range Picker */}
                      <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                          <span>Khoảng trang tùy chỉnh:</span>
                        </span>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-0.5">Từ trang</label>
                            <input
                              type="number"
                              min={1}
                              max={customEnd}
                              value={customStart}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) setCustomStart(Math.max(1, Math.min(totalPages, val)));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 mt-3 shrink-0" />

                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-0.5">Đến trang</label>
                            <input
                              type="number"
                              min={customStart}
                              max={totalPages}
                              value={customEnd}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) setCustomEnd(Math.max(customStart, Math.min(totalPages, val)));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleStartTranslateRange(customStart, customEnd)}
                          className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-violet-900/30 active:scale-95"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>
                            Dịch từ trang {customStart} đến {customEnd} ({Math.max(1, customEnd - customStart + 1)} trang)
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onExportCBZ}
                disabled={isExporting}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/80 disabled:cursor-not-allowed text-white rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                title="Đóng gói các trang truyện đã dịch và tải về file truyện tranh định dạng .CBZ"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>Đang xuất CBZ...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Xuất File CBZ</span>
                  </>
                )}
              </button>
            </>
          )}

          {/* Color Page Stripper Tool Button */}
          {onOpenColorStripper && (
            <button
              onClick={onOpenColorStripper}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 whitespace-nowrap shadow-sm cursor-pointer ${
                pages && pages.some((p) => (p.colorRatio !== undefined ? p.colorRatio > 0.16 : !!p.isColor))
                  ? 'bg-gradient-to-r from-pink-950/80 to-amber-950/80 hover:from-pink-900/90 hover:to-amber-900/90 border-pink-500/50 text-pink-200'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-300'
              }`}
              title="Lọc bỏ trang màu từ file CBZ: Nhận diện các trang màu (> 16% màu) và xuất ra file CBZ sạch (các trang ≤ 16% màu được giữ lại)."
            >
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Lọc Trang Màu</span>
              {pages && pages.filter((p) => (p.colorRatio !== undefined ? p.colorRatio > 0.16 : !!p.isColor)).length > 0 && (
                <span className="text-[10px] font-mono font-bold bg-pink-600 text-white px-1.5 py-0.2 rounded-full" title="Số trang màu (>16% màu)">
                  {pages.filter((p) => (p.colorRatio !== undefined ? p.colorRatio > 0.16 : !!p.isColor)).length}
                </span>
              )}
            </button>
          )}

          {/* Filter Status Badge */}
          <button
            onClick={onOpenSettings}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-xl border transition flex items-center gap-1.5 whitespace-nowrap shadow-sm ${
              settings.onlyTranslateBW || (settings.skipFirstNPages ?? 4) > 0
                ? 'bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-900/40'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
            }`}
            title="Bộ lọc trang: Chỉ dịch B&W và bỏ qua các trang đầu tiên. Bấm để tùy chỉnh."
          >
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Bộ lọc:</span>
            <span className="font-semibold">
              {settings.onlyTranslateBW ? 'Chỉ B&W' : 'Tất cả màu'}
              {(settings.skipFirstNPages ?? 4) > 0 ? ` & >Trang ${settings.skipFirstNPages ?? 4}` : ''}
            </span>
          </button>

          {/* API Configuration & Model Badge */}
          <button
            onClick={onOpenSettings}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-amber-500/50 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 transition flex items-center gap-1.5 whitespace-nowrap shadow-sm cursor-pointer"
            title={`Cấu hình API: Model ${settings.paidModel === 'gemini-3.1-flash-lite-preview' || settings.paidModel === 'gemini-3.1-flash-lite' ? 'Gemini 3.1 Flash Lite' : 'Gemini 3.6 Flash'}, Song song ${settings.concurrency || 2} luồng, Pacing ${settings.paidPacingSpeed || 'turbo'}. Bấm để tùy chỉnh.`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-bold">
              {settings.paidModel === 'gemini-3.1-flash-lite-preview' || settings.paidModel === 'gemini-3.1-flash-lite'
                ? 'Gemini 3.1 Lite ⚡'
                : 'Gemini 3.6 Flash ⚡'}
            </span>
            <span className="text-[10px] text-amber-300/80 font-mono bg-amber-900/60 px-1 py-0.5 rounded">
              {settings.concurrency || 2}x
            </span>
          </button>

          {/* Session Usage / Cost Tracker */}
          {sessionUsage && sessionUsage.pagesTranslatedCount > 0 && (
            <button
              onClick={onOpenSettings}
              className="px-2 py-1.5 text-xs font-mono font-bold rounded-xl border border-emerald-500/40 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 transition flex items-center gap-1 shadow-sm"
              title={`Đã dịch ${sessionUsage.pagesTranslatedCount} trang trong phiên này: ~${sessionUsage.totalTokens.toLocaleString()} tokens, $${sessionUsage.totalCostUsd.toFixed(4)} USD (~${sessionUsage.totalCostVnd.toLocaleString()} VNĐ)`}
            >
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>~{sessionUsage.totalCostVnd > 0 ? `${sessionUsage.totalCostVnd.toLocaleString()}đ` : `$${sessionUsage.totalCostUsd.toFixed(4)}`}</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
            title="Cài đặt văn phong & dịch thuật"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
