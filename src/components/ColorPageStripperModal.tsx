import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  X,
  Upload,
  Download,
  Check,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Layers,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { MangaPage } from '../types';
import { parseCBZFile, exportCBZStrippingColorPages } from '../utils/cbzUtils';

interface ColorPageStripperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspacePages?: MangaPage[];
  currentWorkspaceFileName?: string;
  onLoadPagesIntoWorkspace?: (pages: MangaPage[], fileName: string) => void;
}

export const ColorPageStripperModal: React.FC<ColorPageStripperModalProps> = ({
  isOpen,
  onClose,
  currentWorkspacePages,
  currentWorkspaceFileName,
  onLoadPagesIntoWorkspace,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingProgress, setAnalyzingProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: 0,
    percent: 0,
  });
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [excludedPageIds, setExcludedPageIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'color' | 'bw' | 'all'>('color');
  const [previewPageIndex, setPreviewPageIndex] = useState<number | null>(null);

  // Export states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<{
    downloadUrl: string;
    fileName: string;
    fileSizeMb: string;
    removedCount: number;
    keptCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Load from current workspace when opening if available and no file loaded yet
  useEffect(() => {
    if (isOpen && (!pages || pages.length === 0) && currentWorkspacePages && currentWorkspacePages.length > 0) {
      loadPagesIntoTool(currentWorkspacePages, currentWorkspaceFileName || 'Manga_Current.cbz');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadPagesIntoTool = (loadedPages: MangaPage[], name: string) => {
    setPages(loadedPages);
    setFileName(name);
    // Không đánh dấu loại bỏ những trang truyện từ 16% màu trở xuống (colorRatio <= 0.16)
    // Chỉ tự động đánh dấu loại bỏ những trang có trên 16% màu (colorRatio > 0.16)
    const colorIds = new Set<string>();
    loadedPages.forEach((p) => {
      const ratio = p.colorRatio !== undefined ? p.colorRatio : (p.isColor ? 0.3 : 0);
      if (ratio > 0.16) {
        colorIds.add(p.id);
      }
    });
    setExcludedPageIds(colorIds);
    setActiveTab(colorIds.size > 0 ? 'color' : 'all');
    setExportSuccessInfo(null);
    setErrorMessage(null);
  };

  const handleProcessFile = async (selectedFile: File) => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setExportSuccessInfo(null);
      setFile(selectedFile);
      setFileName(selectedFile.name);

      setAnalyzingProgress({ current: 0, total: 100, percent: 10 });
      const parsedPages = await parseCBZFile(selectedFile);

      if (!parsedPages || parsedPages.length === 0) {
        throw new Error('Không tìm thấy hình ảnh nào trong file CBZ/ZIP này.');
      }

      setAnalyzingProgress({ current: parsedPages.length, total: parsedPages.length, percent: 100 });
      loadPagesIntoTool(parsedPages, selectedFile.name);
    } catch (err: any) {
      console.error('Lỗi khi đọc file CBZ:', err);
      setErrorMessage(err?.message || 'Không thể giải nén hoặc nhận diện file CBZ. Vui lòng kiểm tra lại định dạng file.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleExclusion = (pageId: string) => {
    setExcludedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleSelectAllColor = () => {
    // Chỉ đánh dấu các trang có trên 16% màu (> 0.16), không đánh dấu các trang từ 16% màu trở xuống
    const colorIds = new Set<string>();
    pages.forEach((p) => {
      const ratio = p.colorRatio !== undefined ? p.colorRatio : (p.isColor ? 0.3 : 0);
      if (ratio > 0.16) colorIds.add(p.id);
    });
    setExcludedPageIds(colorIds);
  };

  const handleClearAllExcluded = () => {
    setExcludedPageIds(new Set());
  };

  // Trang màu: trên 16% màu. Trang trắng đen: từ 16% màu trở xuống
  const colorPages = pages.filter((p) => {
    const ratio = p.colorRatio !== undefined ? p.colorRatio : (p.isColor ? 0.3 : 0);
    return ratio > 0.16;
  });
  const bwPages = pages.filter((p) => {
    const ratio = p.colorRatio !== undefined ? p.colorRatio : (p.isColor ? 0.3 : 0);
    return ratio <= 0.16;
  });
  const pagesToExcludeCount = excludedPageIds.size;
  const pagesToKeepCount = pages.length - pagesToExcludeCount;

  // Filtered pages for current tab
  const displayedPages =
    activeTab === 'color'
      ? pages.filter((p) => {
          const ratio = p.colorRatio !== undefined ? p.colorRatio : (p.isColor ? 0.3 : 0);
          return ratio > 0.16 || excludedPageIds.has(p.id);
        })
      : activeTab === 'bw'
      ? pages.filter((p) => {
          const ratio = p.colorRatio !== undefined ? p.colorRatio : (p.isColor ? 0.3 : 0);
          return ratio <= 0.16 && !excludedPageIds.has(p.id);
        })
      : pages;

  const handleExportWithoutColor = async () => {
    if (pagesToKeepCount <= 0) {
      setErrorMessage('Bạn đang chọn loại bỏ tất cả các trang. Vui lòng giữ lại ít nhất 1 trang trắng đen để tạo file CBZ.');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);
      setErrorMessage(null);

      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Manga';
      const outputName = `${baseName}_Khong_Trang_Mau.cbz`;

      const resultBlob = await exportCBZStrippingColorPages(
        pages,
        excludedPageIds,
        outputName,
        (current, total, percent) => {
          setExportProgress(percent);
        }
      );

      const downloadUrl = URL.createObjectURL(resultBlob);
      const sizeMb = (resultBlob.size / (1024 * 1024)).toFixed(2) + ' MB';

      setExportSuccessInfo({
        downloadUrl,
        fileName: outputName,
        fileSizeMb: sizeMb,
        removedCount: pagesToExcludeCount,
        keptCount: pagesToKeepCount,
      });

      // Programmatic auto-download trigger
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Lỗi xuất file CBZ:', err);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi đóng gói file CBZ.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenInWorkspace = () => {
    if (!onLoadPagesIntoWorkspace) return;
    const keptPages = pages.filter((p) => !excludedPageIds.has(p.id));
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Manga';
    const cleanName = `${baseName}_Khong_Trang_Mau.cbz`;
    onLoadPagesIntoWorkspace(keptPages, cleanName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-pink-600/30">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Lọc Bỏ Trang Màu Từ File CBZ
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-700/50 font-semibold">
                  Ngưỡng màu: &gt;16%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Nhận diện và loại bỏ các trang màu (&gt; 16% màu). Không đánh dấu loại bỏ những trang từ 16% màu trở xuống để bảo toàn toàn bộ truyện.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload / Source Selection */}
          {pages.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleProcessFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 ${
                isDragging
                  ? 'border-pink-500 bg-pink-950/20 ring-4 ring-pink-500/20'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600/30 to-amber-500/30 border border-pink-500/40 mx-auto flex items-center justify-center text-pink-300 shadow-inner">
                  {isAnalyzing ? (
                    <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                  ) : (
                    <Upload className="w-8 h-8 text-pink-400" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    {isAnalyzing ? 'Đang đọc và phân tích cấu trúc màu...' : 'Chọn hoặc kéo thả file CBZ vào đây'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Hỗ trợ file CBZ tiếng Việt đã dịch, truyện raw, file .zip chứa tranh truyện. Hệ thống sẽ quét từng trang để phát hiện bìa màu, tranh poster và phân loại chính xác.
                  </p>
                </div>

                {!isAnalyzing && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-gradient-to-r from-pink-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-pink-600/20 active:scale-95 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Chọn file CBZ tiếng Việt</span>
                    </button>

                    {currentWorkspacePages && currentWorkspacePages.length > 0 && (
                      <button
                        onClick={() =>
                          loadPagesIntoTool(currentWorkspacePages, currentWorkspaceFileName || 'Manga_Current.cbz')
                        }
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-indigo-400" />
                        <span>Dùng truyện đang mở ({currentWorkspacePages.length} trang)</span>
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".cbz,.zip,.cbr"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File Info & Quick Stats Header */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
                    <FileArchive className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono truncate max-w-xs sm:max-w-md">
                        {fileName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {pages.length} trang
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Đã phân tích màu sắc toàn bộ {pages.length} trang thành công
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setPages([]);
                      setFile(null);
                      setExportSuccessInfo(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Chọn file khác</span>
                  </button>
                </div>
              </div>

              {/* Stat Badges: Total, Color, BW */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Tổng số trang</div>
                    <div className="text-lg font-bold text-white font-mono">{pages.length} trang</div>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-pink-900/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-950/60 border border-pink-600/50 flex items-center justify-center text-pink-400 shrink-0">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-pink-300 uppercase font-semibold">Trang màu nhận diện (&gt;16% màu)</div>
                      <div className="text-lg font-bold text-pink-400 font-mono">
                        {colorPages.length} trang
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-pink-400/90 font-mono bg-pink-950/80 px-2 py-0.5 rounded border border-pink-800/60">
                    Sẽ loại bỏ: {pagesToExcludeCount}
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-emerald-900/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-300 uppercase font-semibold">Trang truyện giữ lại (≤16% màu)</div>
                      <div className="text-lg font-bold text-emerald-400 font-mono">
                        {bwPages.length} trang
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    Sẽ đóng gói: {pagesToKeepCount}
                  </span>
                </div>
              </div>

              {/* Tabs and Quick Selection Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('color')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'color'
                        ? 'bg-pink-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Trang màu &gt;16% ({colorPages.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('bw')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'bw'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Trang truyện ≤16% ({bwPages.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Tất cả ({pages.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllColor}
                    className="px-2.5 py-1 text-[11px] text-pink-300 hover:text-pink-200 bg-pink-950/60 border border-pink-800/60 rounded-lg transition cursor-pointer"
                  >
                    Chọn lại các trang màu (&gt;16%)
                  </button>
                  <button
                    onClick={handleClearAllExcluded}
                    className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800 rounded-lg transition cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>

              {/* Grid of Pages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Bấm vào từng trang để bật/tắt đánh dấu <strong>loại bỏ</strong>:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Đang hiển thị {displayedPages.length} trang
                  </span>
                </div>

                {displayedPages.length === 0 ? (
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-400 text-xs">
                    {activeTab === 'color'
                      ? 'Không tìm thấy trang màu nào trong file CBZ này. Tất cả các trang đều là đen trắng!'
                      : 'Không có trang nào phù hợp với bộ lọc hiện tại.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[360px] overflow-y-auto p-1 pr-2">
                    {displayedPages.map((page) => {
                      const originalIndex = pages.findIndex((p) => p.id === page.id);
                      const isExcluded = excludedPageIds.has(page.id);
                      const ratioPercent = page.colorRatio ? Math.round(page.colorRatio * 100) : 0;

                      return (
                        <div
                          key={page.id}
                          onClick={() => handleToggleExclusion(page.id)}
                          className={`relative rounded-xl border-2 overflow-hidden transition-all duration-200 cursor-pointer group flex flex-col ${
                            isExcluded
                              ? 'border-pink-500/80 bg-pink-950/20 shadow-md ring-2 ring-pink-500/20'
                              : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                          }`}
                        >
                          {/* Thumbnail Image */}
                          <div className="aspect-[2/3] w-full bg-slate-950 relative overflow-hidden flex items-center justify-center">
                            <img
                              src={page.originalUrl}
                              alt={page.filename}
                              className={`w-full h-full object-cover transition duration-300 ${
                                isExcluded ? 'opacity-60 contrast-125' : 'group-hover:scale-105'
                              }`}
                              loading="lazy"
                            />

                            {/* Exclude Checkbox Indicator */}
                            <div
                              className={`absolute top-1.5 right-1.5 p-1 rounded-md transition shadow ${
                                isExcluded
                                  ? 'bg-pink-600 text-white'
                                  : 'bg-slate-900/80 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {isExcluded ? <Trash2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            </div>

                            {/* Color / BW Ratio Badge */}
                            {ratioPercent > 16 ? (
                              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-pink-900/90 text-pink-200 border border-pink-500/50 text-[9px] font-bold flex items-center gap-1 shadow">
                                <Palette className="w-2.5 h-2.5" />
                                <span>{ratioPercent}% màu (&gt;16%)</span>
                              </div>
                            ) : ratioPercent > 0 ? (
                              <div
                                className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700/80 text-[9px] font-medium flex items-center gap-1 shadow"
                                title="Tỷ lệ màu từ 16% trở xuống: Giữ lại, không đánh dấu loại bỏ"
                              >
                                <span>{ratioPercent}% (≤16%)</span>
                              </div>
                            ) : null}

                            {/* Zoom Preview Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPageIndex(originalIndex);
                              }}
                              className="absolute bottom-1.5 right-1.5 p-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-[10px] opacity-0 group-hover:opacity-100 transition shadow"
                              title="Xem phóng to trang này"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Footer Info */}
                          <div className="p-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold text-slate-200">
                              #{originalIndex + 1}
                            </span>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                isExcluded
                                  ? 'bg-pink-950 text-pink-300 border border-pink-800/60'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              }`}
                            >
                              {isExcluded ? 'Loại bỏ' : 'Giữ lại'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="bg-red-950/60 border border-red-500/50 rounded-2xl p-4 text-xs text-red-200 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-red-300">Thông báo lỗi:</div>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Export Success Banner */}
              {exportSuccessInfo && (
                <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-2 border-emerald-500/60 rounded-2xl p-4 text-xs text-emerald-200 shadow-xl space-y-3 animate-in fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Xuất file CBZ đã lọc bỏ trang màu thành công!
                        </div>
                        <div className="text-[11px] text-emerald-300 mt-0.5 font-mono">
                          {exportSuccessInfo.fileName} ({exportSuccessInfo.fileSizeMb})
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Đã loại bỏ hoàn toàn <strong>{exportSuccessInfo.removedCount} trang màu</strong>. File CBZ mới chứa <strong>{exportSuccessInfo.keptCount} trang truyện trắng đen</strong> nguyên bản, đã được đánh số thứ tự tuần tự sạch sẽ.
                        </p>
                      </div>
                    </div>

                    <a
                      href={exportSuccessInfo.downloadUrl}
                      download={exportSuccessInfo.fileName}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 shrink-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải lại</span>
                    </a>
                  </div>

                  {onLoadPagesIntoWorkspace && (
                    <div className="pt-2 border-t border-emerald-500/30 flex items-center justify-between">
                      <span className="text-[11px] text-slate-300">
                        Bạn có muốn mở ngay tập truyện đã lọc trang màu này vào giao diện làm việc?
                      </span>
                      <button
                        onClick={handleOpenInWorkspace}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Mở trong ứng dụng</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {pages.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              Đang chọn loại bỏ: <strong className="text-pink-400 font-mono">{pagesToExcludeCount}</strong> trang màu | Giữ lại xuất CBZ: <strong className="text-emerald-400 font-mono">{pagesToKeepCount}</strong> trang trắng đen
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>

              <button
                onClick={handleExportWithoutColor}
                disabled={isExporting || pagesToKeepCount === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-pink-600 via-pink-500 to-amber-600 hover:from-pink-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-pink-600/25 active:scale-95 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang đóng gói CBZ ({exportProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Xuất File CBZ ({pagesToKeepCount} Trang Đen Trắng)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Page Zoom Preview Modal */}
      {previewPageIndex !== null && pages[previewPageIndex] && (
        <div
          onClick={() => setPreviewPageIndex(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 space-y-3 flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Xem chi tiết Trang #{previewPageIndex + 1}
                </span>
                {(() => {
                  const pRatio = Math.round((pages[previewPageIndex].colorRatio || 0) * 100);
                  if (pRatio > 16) {
                    return (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-700 font-bold">
                        Trang màu ({pRatio}% &gt; 16% - Đánh dấu loại bỏ)
                      </span>
                    );
                  } else if (pRatio > 0) {
                    return (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        Tỷ lệ màu nhẹ {pRatio}% (≤ 16% - Giữ lại nguyên bản)
                      </span>
                    );
                  }
                  return (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      Trang trắng đen (0% màu)
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={() => setPreviewPageIndex(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-black rounded-xl p-2 min-h-[300px]">
              <img
                src={pages[previewPageIndex].originalUrl}
                alt={pages[previewPageIndex].filename}
                className="max-h-[70vh] object-contain rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  handleToggleExclusion(pages[previewPageIndex].id);
                  setPreviewPageIndex(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  excludedPageIds.has(pages[previewPageIndex].id)
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-pink-600 hover:bg-pink-500 text-white'
                }`}
              >
                {excludedPageIds.has(pages[previewPageIndex].id) ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Đổi thành: Giữ lại trang này</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Đổi thành: Loại bỏ trang màu này</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setPreviewPageIndex(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
