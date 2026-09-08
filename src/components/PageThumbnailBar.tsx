import React from 'react';
import { MangaPage, TranslationSettings } from '../types';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Palette,
  FastForward,
  Check,
  Ban,
  Filter,
  Play,
  PlayCircle,
} from 'lucide-react';
import { isPageEligibleForTranslation } from '../utils/cbzUtils';

interface PageThumbnailBarProps {
  pages: MangaPage[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  settings?: TranslationSettings;
  onTogglePageSkip?: (index: number) => void;
  onTranslateFromPage?: (index: number) => void;
  isBatchTranslating?: boolean;
}

export const PageThumbnailBar: React.FC<PageThumbnailBarProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
  settings = {
    tone: 'natural',
    addressingPairs: '',
    fontFamily: 'Comic',
    autoInpaint: true,
    preserveFormat: true,
    onlyTranslateBW: true,
    skipColorPages: true,
    skipFirstNPages: 4,
  },
  onTogglePageSkip,
  onTranslateFromPage,
  isBatchTranslating = false,
}) => {
  const eligibleCount = pages.filter(
    (p, idx) => isPageEligibleForTranslation(idx, p, settings).eligible
  ).length;
  const skippedCount = pages.length - eligibleCount;

  return (
    <div className="w-28 md:w-36 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shrink-0 select-none">
      {/* Header status */}
      <div className="p-2 border-b border-slate-800 space-y-1.5 bg-slate-950/40">
        <div className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase flex items-center justify-between">
          <span>Danh sách trang</span>
          <span className="text-slate-500 font-mono text-[10px]">{pages.length}</span>
        </div>
        {/* Filter stats pill */}
        <div className="flex items-center justify-between text-[9px] font-semibold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
          <span className="text-emerald-400 font-mono">Dịch: {eligibleCount}</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-400 font-mono">Bỏ qua: {skippedCount}</span>
        </div>

        {/* Quick button: Dịch từ trang đang xem */}
        {onTranslateFromPage && pages.length > 0 && !isBatchTranslating ? (
          <button
            onClick={() => onTranslateFromPage(activePageIndex)}
            className="w-full py-1 px-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-indigo-100 border border-indigo-700/60 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
            title={`Bắt đầu dịch từ trang hiện tại (#${activePageIndex + 1}) đến hết truyện`}
          >
            <Play className="w-2.5 h-2.5 fill-indigo-400 text-indigo-400" />
            <span>Dịch từ #{activePageIndex + 1} → hết</span>
          </button>
        ) : isBatchTranslating ? (
          <div className="w-full py-1 px-1.5 bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1.5 shadow-sm animate-pulse">
            <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400 shrink-0" />
            <span>Đang dịch file...</span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2.5 custom-scrollbar">
        {pages.map((page, index) => {
          const isActive = index === activePageIndex;
          const eligibility = isPageEligibleForTranslation(index, page, settings);
          const isSkipped = !eligibility.eligible;

          return (
            <div
              key={page.id}
              className={`w-full group relative rounded-xl overflow-hidden border transition text-left flex flex-col ${
                isActive
                  ? 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/30 shadow-lg'
                  : isSkipped
                  ? 'border-slate-800/80 bg-slate-950/40 opacity-75 hover:opacity-100 hover:border-slate-700'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/70'
              }`}
            >
              {/* Main Thumbnail Click Target */}
              <button
                type="button"
                onClick={() => onSelectPage(index)}
                className="w-full text-left"
              >
                {/* Thumbnail Image */}
                <div className="aspect-[3/4] w-full relative bg-slate-900 overflow-hidden">
                  <img
                    src={page.originalUrl}
                    alt={`Trang ${index + 1}`}
                    className={`w-full h-full object-cover transition duration-200 group-hover:scale-105 ${
                      isSkipped && page.status !== 'completed' ? 'filter grayscale-[25%]' : ''
                    }`}
                    loading="lazy"
                  />

                  {/* Status Overlay Badge */}
                  <div className="absolute top-1 right-1 flex flex-col gap-1 items-end z-10">
                    {page.status === 'completed' && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {page.status === 'translating' && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md animate-spin">
                        <Loader2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {page.status === 'error' && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* Color vs B&W Badge */}
                    {page.isColor !== undefined && (
                      <span
                        className={`text-[9px] px-1 py-0.5 rounded font-bold shadow-sm backdrop-blur-sm border flex items-center gap-0.5 ${
                          page.isColor
                            ? 'bg-rose-950/90 border-rose-500/50 text-rose-300'
                            : 'bg-slate-950/90 border-slate-700 text-slate-300'
                        }`}
                        title={page.isColor ? 'Trang có màu (Bìa/Poster)' : 'Trang Trắng Đen'}
                      >
                        {page.isColor ? (
                          <>
                            <Palette className="w-2.5 h-2.5 text-pink-400" />
                            <span>Màu</span>
                          </>
                        ) : (
                          <span>B&W</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Skip overlay notice if filtered out */}
                  {isSkipped && page.status !== 'completed' && page.status !== 'translating' && (
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-1 pointer-events-none">
                      <span className="bg-amber-500/90 text-slate-950 px-1.5 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wider shadow-md flex items-center gap-0.5">
                        <FastForward className="w-2.5 h-2.5" />
                        <span>Bỏ qua</span>
                      </span>
                      <span className="text-[8px] text-amber-200 mt-0.5 px-1 rounded bg-slate-950/80 font-medium truncate max-w-full">
                        {eligibility.reason?.split('(')[0] || 'Bộ lọc'}
                      </span>
                    </div>
                  )}

                  {/* Page Number Ribbon & Rotating Key Badge */}
                  <div className="absolute bottom-1 left-1 flex items-center gap-1">
                    <div className="bg-slate-950/85 backdrop-blur-sm text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border border-slate-800">
                      #{index + 1}
                    </div>
                    {page.usedKeyInfo && (
                      <div
                        className="bg-indigo-950/90 backdrop-blur-sm text-indigo-300 px-1 py-0.5 rounded text-[9px] font-mono font-bold border border-indigo-700/60"
                        title={`Đã dịch bằng API Key #${page.usedKeyInfo.keyIndex}/${page.usedKeyInfo.totalKeys} (${page.usedKeyInfo.keyMasked})`}
                      >
                        K{page.usedKeyInfo.keyIndex}
                      </div>
                    )}
                  </div>
                </div>

                {/* Speech bubble box count indicator or file name */}
                <div className="p-1 text-[9px] text-slate-400 flex items-center justify-between bg-slate-900/90 border-t border-slate-800/80">
                  <span className="truncate max-w-[55px]">
                    {page.filename.replace(/^.*[\\/]/, '')}
                  </span>
                  {page.boxes.length > 0 && (
                    <span className="text-indigo-400 font-mono text-[9px] bg-indigo-950 px-1 rounded border border-indigo-800/50 shrink-0">
                      {page.boxes.length} bóng
                    </span>
                  )}
                </div>
              </button>

              {/* Action Buttons: Dịch từ trang này & Tùy chọn bỏ qua */}
              <div className="grid grid-cols-2 divide-x divide-slate-800/80 border-t border-slate-800/80">
                {onTranslateFromPage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTranslateFromPage(index);
                    }}
                    disabled={isBatchTranslating}
                    className="py-1 text-[9px] font-semibold text-indigo-300 hover:text-white bg-slate-900 hover:bg-indigo-950 transition flex items-center justify-center gap-0.5 disabled:opacity-50"
                    title={`Dịch từ trang #${index + 1} đến hết`}
                  >
                    <Play className="w-2 h-2 fill-indigo-400 text-indigo-400" />
                    <span>Dịch</span>
                  </button>
                )}

                {onTogglePageSkip && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePageSkip(index);
                    }}
                    className={`py-1 text-[9px] font-medium transition text-center flex items-center justify-center gap-0.5 ${
                      page.manualSkip === true
                        ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                        : page.manualSkip === false
                        ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                        : isSkipped
                        ? 'bg-slate-900/80 text-amber-300 hover:bg-slate-800'
                        : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={
                      page.manualSkip !== undefined
                        ? 'Đang có tùy chỉnh thủ công. Bấm để đảo trạng thái.'
                        : isSkipped
                        ? 'Bấm để ép buộc DỊCH trang này'
                        : 'Bấm để BỎ QUA trang này'
                    }
                  >
                    {page.manualSkip === true ? (
                      <span>Chặn</span>
                    ) : page.manualSkip === false ? (
                      <span>Dịch</span>
                    ) : isSkipped ? (
                      <span>Bỏ qua</span>
                    ) : (
                      <span>Bật</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
