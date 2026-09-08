import React, { useState } from 'react';
import { SpeechBox } from '../types';
import {
  MessageSquare,
  Sparkles,
  Trash2,
  Plus,
  Minus,
  Type,
  Palette,
  Loader2,
  Edit3,
  RefreshCw,
  Bold,
  Italic,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize,
  Maximize2,
  ShieldCheck,
  Eraser,
  ScanText,
} from 'lucide-react';

interface BubbleInspectorProps {
  boxes: SpeechBox[];
  selectedBoxId: string | null;
  onSelectBox: (id: string | null) => void;
  onUpdateBox: (updatedBox: SpeechBox) => void;
  onDeleteBox: (id: string) => void;
  onAddBox: () => void;
  onAddEraserBox?: (customBox2d?: [number, number, number, number], bg?: 'white' | 'black') => void;
  onRetranslateBox: (box: SpeechBox, instruction: string) => Promise<void>;
  onDetectBubbles?: () => void;
  onAutoSnapBox?: (box: SpeechBox) => void;
  onAutoSnapAll?: () => void;
  isPageTranslating: boolean;
}

export const BubbleInspector: React.FC<BubbleInspectorProps> = ({
  boxes,
  selectedBoxId,
  onSelectBox,
  onUpdateBox,
  onDeleteBox,
  onAddBox,
  onAddEraserBox,
  onRetranslateBox,
  onDetectBubbles,
  onAutoSnapBox,
  onAutoSnapAll,
  isPageTranslating,
}) => {
  const [retranslateInstruction, setRetranslateInstruction] = useState<string>('');
  const [isRetranslating, setIsRetranslating] = useState<boolean>(false);

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  const handleExpandBox = (direction: 'top' | 'bottom' | 'left' | 'right' | 'all' | 'shrink', amount: number = 25) => {
    if (!selectedBox) return;
    let [ymin, xmin, ymax, xmax] = selectedBox.box2d;

    if (direction === 'top') {
      ymin = Math.max(0, ymin - amount);
    } else if (direction === 'bottom') {
      ymax = Math.min(1000, ymax + amount);
    } else if (direction === 'left') {
      xmin = Math.max(0, xmin - amount);
    } else if (direction === 'right') {
      xmax = Math.min(1000, xmax + amount);
    } else if (direction === 'all') {
      ymin = Math.max(0, ymin - amount);
      ymax = Math.min(1000, ymax + amount);
      xmin = Math.max(0, xmin - amount);
      xmax = Math.min(1000, xmax + amount);
    } else if (direction === 'shrink') {
      if (ymax - ymin > 30) {
        ymin = Math.min(ymax - 20, ymin + amount);
        ymax = Math.max(ymin + 20, ymax - amount);
      }
      if (xmax - xmin > 30) {
        xmin = Math.min(xmax - 20, xmin + amount);
        xmax = Math.max(xmin + 20, xmax - amount);
      }
    }

    onUpdateBox({
      ...selectedBox,
      box2d: [ymin, xmin, ymax, xmax],
    });
  };

  const handleRetranslateSubmit = async () => {
    if (!selectedBox) return;
    setIsRetranslating(true);
    try {
      await onRetranslateBox(selectedBox, retranslateInstruction);
      setRetranslateInstruction('');
    } finally {
      setIsRetranslating(false);
    }
  };

  return (
    <aside className="w-80 lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-10 shrink-0">
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <h2 className="font-bold text-sm text-slate-100">Chỉnh Sửa Thoại ({boxes.length})</h2>
        </div>

        <div className="flex items-center gap-1.5">
          {onAutoSnapAll && boxes.length > 0 && (
            <button
              onClick={onAutoSnapAll}
              disabled={isPageTranslating}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Khớp thông minh: Tự động xếp chồng tất cả bong bóng đè lên bong bóng gốc, vừa khít và không còn thấy chữ tiếng Anh"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Khớp Bong Bóng</span>
            </button>
          )}

          {onDetectBubbles && (
            <button
              onClick={onDetectBubbles}
              disabled={isPageTranslating}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Quét AI để tự động tìm và định vị tất cả bong bóng thoại trên trang này"
            >
              {isPageTranslating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Đang quét...</span>
                </>
              ) : (
                <>
                  <ScanText className="w-3.5 h-3.5 text-amber-300" />
                  <span>Nhận diện bong bóng</span>
                </>
              )}
            </button>
          )}

          {onAddEraserBox && (
            <button
              onClick={() => onAddEraserBox()}
              className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition active:scale-95"
              title="Thêm vùng tẩy xóa chữ tiếng Anh còn sót lại"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Xóa Chữ Thừa</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* If no boxes detected yet */}
        {boxes.length === 0 && !isPageTranslating && (
          <div className="p-6 text-center text-slate-400 flex flex-col items-center gap-3 bg-slate-950/40 rounded-2xl border border-slate-800/80 my-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shadow-md">
              <ScanText className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-200">Chưa có bong bóng thoại nào</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Bấm nút bên dưới để Gemini AI tự động quét hình ảnh và nhận diện toàn bộ các bong bóng thoại trên trang này.
              </p>
            </div>
            {onDetectBubbles && (
              <button
                onClick={onDetectBubbles}
                className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95"
              >
                <ScanText className="w-4 h-4 text-amber-300" />
                <span>Nhận diện bong bóng</span>
              </button>
            )}
          </div>
        )}

        {/* Selected Box Editor */}
        {selectedBox ? (
          <div
            className={`rounded-2xl p-3.5 border shadow-xl space-y-3.5 ${
              selectedBox.isEraser
                ? 'bg-rose-950/20 border-rose-500/50 ring-1 ring-rose-500/20'
                : 'bg-slate-950/80 border-indigo-500/50 ring-1 ring-indigo-500/20'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span
                className={`text-xs font-bold flex items-center gap-1.5 ${
                  selectedBox.isEraser ? 'text-rose-300' : 'text-indigo-300'
                }`}
              >
                {selectedBox.isEraser ? (
                  <>
                    <Eraser className="w-3.5 h-3.5 text-rose-400" />
                    <span>Vùng Tẩy Xóa Chữ Dư #{boxes.indexOf(selectedBox) + 1}</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Đang chọn Bóng #{boxes.indexOf(selectedBox) + 1}</span>
                  </>
                )}
              </span>

              <button
                onClick={() => onDeleteBox(selectedBox.id)}
                className="text-slate-400 hover:text-rose-400 p-1 hover:bg-rose-950/40 rounded-lg transition"
                title="Xóa ô này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Eraser Specific Controls vs Standard Speech Bubble Controls */}
            {selectedBox.isEraser ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <Eraser className="w-4 h-4 text-rose-400" />
                    <span>Công Cụ Tẩy Xóa Chữ Tiếng Anh Dư</span>
                  </div>
                  <p className="text-[11px] text-rose-200/80 leading-relaxed">
                    Vùng này được dùng để che phủ sạch sẽ chữ tiếng Anh gốc còn sót lại (như chữ ở rìa ngoài bóng thoại, tiêu đề, hoặc SFX chưa dịch).
                  </p>
                </div>

                {/* Eraser Background Color */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Màu Nền Che Phủ:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateBox({ ...selectedBox, backgroundColor: 'white' })}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        selectedBox.backgroundColor === 'white'
                          ? 'border-white bg-white text-slate-900 shadow-md ring-2 ring-white/30'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300" />
                      <span>Nền Trắng (Bóng thoại)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateBox({ ...selectedBox, backgroundColor: 'black' })}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        selectedBox.backgroundColor === 'black'
                          ? 'border-slate-400 bg-slate-950 text-white shadow-md ring-2 ring-slate-500/30'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-black border border-slate-600" />
                      <span>Nền Đen (Khung tối)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Original Text (English) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Tiếng Anh Gốc:
                  </label>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono select-text">
                    {selectedBox.originalText || '(Không có câu thoại gốc)'}
                  </div>
                </div>

                {/* Vietnamese Translated Text */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-indigo-300">
                      Bản Dịch Tiếng Việt:
                    </label>
                    <button
                      onClick={() =>
                        onUpdateBox({
                          ...selectedBox,
                          translatedText: selectedBox.translatedText.toUpperCase(),
                        })
                      }
                      className="text-[10px] font-bold bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 px-2 py-0.5 rounded-md transition active:scale-95"
                      title="Chuyển thành chữ IN HOA"
                    >
                      IN HOA
                    </button>
                  </div>
                  <textarea
                    value={selectedBox.translatedText ?? ''}
                    onChange={(e) =>
                      onUpdateBox({ ...selectedBox, translatedText: e.target.value })
                    }
                    rows={3}
                    placeholder="Nhập câu dịch tiếng Việt..."
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-semibold leading-relaxed"
                  />
                </div>

                {/* AI Re-translation Prompt */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block text-[11px] font-semibold text-amber-300 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Dịch Lại Bằng AI (Gợi Ý / Tinh Chỉnh):</span>
                  </label>

                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      value={retranslateInstruction}
                      onChange={(e) => setRetranslateInstruction(e.target.value)}
                      placeholder="VD: Dịch xưng hô Anh - Em, Con - Mẹ, hài hước..."
                      className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleRetranslateSubmit}
                      disabled={isRetranslating}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 shrink-0 disabled:opacity-50"
                    >
                      {isRetranslating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Gửi</span>
                    </button>
                  </div>

                  {/* Quick Prompt Presets */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Anh - Em',
                      'Con - Mẹ',
                      'Cậu - Tớ',
                      'Ta - Ngươi',
                      'Dịch hài hước',
                      'Trang trọng'
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setRetranslateInstruction(preset);
                        }}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Styling Controls */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Kiểu Dáng & Định Dạng Bóng:
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Background color */}
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Nền bóng</label>
                      <select
                        value={selectedBox.backgroundColor}
                        onChange={(e) =>
                          onUpdateBox({
                            ...selectedBox,
                            backgroundColor: e.target.value as any,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg p-1.5 focus:outline-none"
                      >
                        <option value="white">Trắng (Mặc định)</option>
                        <option value="black">Đen (U tối/Suy nghĩ)</option>
                        <option value="transparent">Trong suốt</option>
                      </select>
                    </div>

                    {/* Text color */}
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Màu chữ</label>
                      <select
                        value={selectedBox.textColor}
                        onChange={(e) =>
                          onUpdateBox({
                            ...selectedBox,
                            textColor: e.target.value as any,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg p-1.5 focus:outline-none"
                      >
                        <option value="black">Đen</option>
                        <option value="white">Trắng</option>
                        <option value="red">Đỏ (La hét/SFX)</option>
                      </select>
                    </div>
                  </div>

                  {/* Enhanced Font Size Control */}
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300">
                        Cỡ Chữ (Font Size):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateBox({
                              ...selectedBox,
                              autoFitFont: !(selectedBox.autoFitFont !== false),
                            })
                          }
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                            selectedBox.autoFitFont !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                          title="Tự động co giãn cỡ chữ tối đa vừa vặn khung bóng thoại để phủ kín chữ gốc"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{selectedBox.autoFitFont !== false ? '⚡ Tự co giãn' : 'Chỉnh tay'}</span>
                        </button>

                        <span className="text-amber-400 font-bold bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded-md font-mono text-xs">
                          {selectedBox.fontSize || 32} px
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBox({
                            ...selectedBox,
                            fontSize: Math.max(10, (selectedBox.fontSize || 32) - 2),
                            autoFitFont: false,
                          })
                        }
                        className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-sm transition active:scale-95 cursor-pointer"
                        title="Giảm 2px (chuyển sang cỡ cố định)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="range"
                        min="12"
                        max="90"
                        step="1"
                        value={selectedBox.fontSize || 32}
                        onChange={(e) =>
                          onUpdateBox({
                            ...selectedBox,
                            fontSize: Number(e.target.value),
                            autoFitFont: false,
                          })
                        }
                        className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBox({
                            ...selectedBox,
                            fontSize: Math.min(120, (selectedBox.fontSize || 32) + 2),
                            autoFitFont: false,
                          })
                        }
                        className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-sm transition active:scale-95 cursor-pointer"
                        title="Tăng 2px (chuyển sang cỡ cố định)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-950">
                      {[
                        { label: 'Nhỏ (24px)', size: 24 },
                        { label: 'Chuẩn (32px)', size: 32 },
                        { label: 'Vừa (40px)', size: 40 },
                        { label: 'Lớn (48px)', size: 48 },
                      ].map((preset) => (
                        <button
                          key={preset.size}
                          type="button"
                          onClick={() => onUpdateBox({ ...selectedBox, fontSize: preset.size, autoFitFont: false })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition ${
                            (selectedBox.fontSize || 32) === preset.size && selectedBox.autoFitFont === false
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Bold / Italic */}
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-950">
                      <span className="text-[10px] text-slate-400 mr-auto">Kiểu chữ:</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBox({ ...selectedBox, bold: !(selectedBox.bold ?? true) })
                        }
                        className={`px-2 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                          (selectedBox.bold ?? true)
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                        title="Bật/Tắt in đậm"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        <span>Đậm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBox({ ...selectedBox, italic: !selectedBox.italic })
                        }
                        className={`px-2 py-1 rounded-lg border text-xs transition flex items-center gap-1 ${
                          selectedBox.italic
                            ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                        title="Bật/Tắt in nghiêng"
                      >
                        <Italic className="w-3.5 h-3.5" />
                        <span>Nghiêng</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Bounding Box Coverage & Position Adjustments */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Vùng Che Phủ (Khắc Phục Sót Chữ Gốc)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Y: {selectedBox.box2d[0]}-{selectedBox.box2d[2]}
                </span>
              </div>

              <div className="p-2.5 bg-indigo-950/30 border border-indigo-900/50 rounded-xl space-y-2">
                <p className="text-[11px] text-slate-300 leading-snug">
                  Nếu chữ tiếng Anh bị sót (như <strong className="text-amber-300 font-mono">&quot;ISN&apos;T IT&quot;</strong> ở đỉnh bóng thoại hoặc mép trái/phải), bấm các nút dưới để mở rộng vùng che tức thì:
                </p>

                {onAutoSnapBox && (
                  <button
                    onClick={() => onAutoSnapBox(selectedBox)}
                    className="w-full py-1.5 px-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                    title="Tự động nhận diện và khớp bong bóng này xếp chồng trực tiếp lên bong bóng gốc, vừa khít và không còn thấy chữ tiếng Anh"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>🎯 Khớp Thông Minh Lên Bóng Gốc</span>
                  </button>
                )}

                {/* 1-Click Expand Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleExpandBox('top', 40)}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition active:scale-95"
                    title="Kéo mép trên lên cao để che chữ tiếng Anh ở đỉnh bóng (như ISN'T IT)"
                  >
                    <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Kéo Lên Trên (+40)</span>
                  </button>
                  <button
                    onClick={() => handleExpandBox('bottom', 50)}
                    className="px-2.5 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                    title="Mở rộng mép dưới xuống để che chữ tiếng Anh sót ở đáy bóng"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[3]" />
                    <span>Kéo Xuống Dưới (+50)</span>
                  </button>
                  <button
                    onClick={() => handleExpandBox('left', 25)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
                    title="Mở rộng mép trái để che chữ sót bên trái"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                    <span>Mở Rộng Trái (+25)</span>
                  </button>
                  <button
                    onClick={() => handleExpandBox('right', 25)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
                    title="Mở rộng mép phải để che chữ sót bên phải"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span>Mở Rộng Phải (+25)</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleExpandBox('all', 20)}
                    className="flex-1 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
                    title="Mở rộng đều 4 cạnh quanh bóng thoại"
                  >
                    <Maximize className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mở Rộng Đều 4 Phía (+20)</span>
                  </button>
                  <button
                    onClick={() => handleExpandBox('shrink', 15)}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition active:scale-95"
                    title="Thu nhỏ lại nếu bị tràn quá đà"
                  >
                    Thu Nhỏ
                  </button>
                </div>
              </div>

              {/* Extra Bleed Slider */}
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="text-[11px] text-slate-400">Độ lan che nền (+padding):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={selectedBox.maskPadding ?? 0}
                    onChange={(e) =>
                      onUpdateBox({ ...selectedBox, maskPadding: Number(e.target.value) })
                    }
                    className="w-24 accent-indigo-500 cursor-pointer"
                  />
                  <span className="font-mono text-indigo-300 font-bold text-[11px] w-7 text-right">
                    +{selectedBox.maskPadding ?? 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-slate-300 bg-indigo-950/40 rounded-2xl border border-indigo-500/40 text-center space-y-1.5 shadow-lg">
            <p className="font-bold text-indigo-300 flex items-center justify-center gap-1.5 text-sm">
              <span>👉 Nhấp vào ô thoại trên ảnh để sửa</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bấm chọn trực tiếp vào ô thoại đã dịch trên trang truyện hoặc danh sách bên dưới để hiện bong bóng chỉnh sửa nội dung và cỡ chữ ngay lập tức.
            </p>
          </div>
        )}

        {/* All Boxes List for Page */}
        {boxes.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-slate-400 block px-1">
              Tất cả bóng thoại trên trang:
            </span>

            {boxes.map((box, index) => {
              const isSelected = selectedBoxId === box.id;
              const isEraser = box.isEraser || !box.translatedText?.trim();

              return (
                <div
                  key={box.id}
                  onClick={() => onSelectBox(box.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition text-left space-y-1 ${
                    isSelected
                      ? isEraser
                        ? 'border-rose-500 bg-rose-950/50 shadow-md ring-1 ring-rose-500/30'
                        : 'border-indigo-500 bg-indigo-950/50 shadow-md ring-1 ring-indigo-500/30'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300 flex items-center gap-1">
                      {isEraser && <Eraser className="w-3 h-3 text-rose-400" />}
                      <span>{isEraser ? `Vùng Xóa #${index + 1}` : `Bóng #${index + 1}`}</span>
                    </span>
                    <span
                      className={`text-[10px] capitalize px-1.5 py-0.5 rounded border ${
                        isEraser
                          ? 'text-rose-300 bg-rose-950/80 border-rose-800/60'
                          : 'text-slate-500 bg-slate-900 border-slate-800'
                      }`}
                    >
                      {isEraser ? 'Tẩy Xóa' : box.bubbleType}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 line-clamp-2 font-medium">
                    {isEraser ? '(Che chữ tiếng Anh còn dư)' : box.translatedText || '(Chưa có bản dịch)'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
