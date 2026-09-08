import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SpeechBox } from '../types';
import { smartSnapBoxToBubble } from '../utils/bubbleDetector';
import {
  Sparkles,
  X,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Loader2,
  Bold,
  Italic,
  ArrowUp,
  ArrowDown,
  Maximize,
  Move,
  Palette,
  Eraser,
  Check,
  Edit3,
} from 'lucide-react';

interface FloatingBubbleEditorProps {
  box: SpeechBox;
  boxIndex: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  zoom: number;
  onUpdateBox: (updatedBox: SpeechBox) => void;
  onDeleteBox?: (id: string) => void;
  onRetranslateBox?: (box: SpeechBox, instruction: string) => Promise<void>;
  onClose: () => void;
}

export const FloatingBubbleEditor: React.FC<FloatingBubbleEditorProps> = ({
  box,
  boxIndex,
  canvasRef,
  zoom,
  onUpdateBox,
  onDeleteBox,
  onRetranslateBox,
  onClose,
}) => {
  const [retranslateInstruction, setRetranslateInstruction] = useState<string>('');
  const [isRetranslating, setIsRetranslating] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Calculate smart screen position directly beside or near the clicked speech bubble
  const calculateSmartPosition = (targetBox: SpeechBox): { x: number; y: number } => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };

    const editorWidth = Math.min(390, window.innerWidth - 24);
    const editorHeight = 540;
    const canvas = canvasRef.current;

    // Detect sidebar to prevent any overlapping
    const aside = document.querySelector('aside');
    const asideLeft = aside ? aside.getBoundingClientRect().left : window.innerWidth;
    const maxAvailableRight = Math.max(editorWidth + 40, asideLeft - 16);
    const minAvailableLeft = window.innerWidth >= 768 ? 200 : 12;

    if (!canvas || !targetBox.box2d || targetBox.box2d.length < 4) {
      return {
        x: Math.max(minAvailableLeft, Math.round((maxAvailableRight - editorWidth) / 2)),
        y: Math.max(70, Math.min(window.innerHeight - editorHeight - 16, 100)),
      };
    }

    const rect = canvas.getBoundingClientRect();
    const ymin = Math.min(targetBox.box2d[0], targetBox.box2d[2]);
    const ymax = Math.max(targetBox.box2d[0], targetBox.box2d[2]);
    const xmin = Math.min(targetBox.box2d[1], targetBox.box2d[3]);
    const xmax = Math.max(targetBox.box2d[1], targetBox.box2d[3]);

    const boxRightOnScreen = rect.left + (xmax / 1000) * rect.width;
    const boxLeftOnScreen = rect.left + (xmin / 1000) * rect.width;
    const boxTopOnScreen = rect.top + (ymin / 1000) * rect.height;

    // 1. Prefer placing directly to the right of the bubble
    let targetX = boxRightOnScreen + 16;

    // 2. If placing on right collides with the sidebar or viewport:
    if (targetX + editorWidth > maxAvailableRight) {
      // Place to the left of the bubble
      targetX = boxLeftOnScreen - editorWidth - 16;
    }

    // 3. If placing on left also overflows the left boundary:
    if (targetX < minAvailableLeft) {
      // Center in available canvas view area
      targetX = minAvailableLeft + Math.max(0, (maxAvailableRight - minAvailableLeft - editorWidth) / 2);
    }

    targetX = Math.max(minAvailableLeft, Math.min(maxAvailableRight - editorWidth, targetX));
    let targetY = Math.max(68, Math.min(window.innerHeight - editorHeight - 16, boxTopOnScreen - 10));

    return { x: Math.round(targetX), y: Math.round(targetY) };
  };

  const [position, setPosition] = useState<{ x: number; y: number }>(() => calculateSmartPosition(box));

  // Recalculate position when clicked box or zoom changes
  useEffect(() => {
    setPosition(calculateSmartPosition(box));
  }, [box.id, zoom]);

  // Handle dragging the editor dialog by its header
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!position) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(10, Math.min(window.innerWidth - 380, dragStartRef.current.startX + dx));
      const newY = Math.max(50, Math.min(window.innerHeight - 200, dragStartRef.current.startY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleRetranslateSubmit = async () => {
    if (!onRetranslateBox) return;
    setIsRetranslating(true);
    try {
      await onRetranslateBox(box, retranslateInstruction);
      setRetranslateInstruction('');
    } finally {
      setIsRetranslating(false);
    }
  };

  const handleExpandBox = (direction: 'top' | 'bottom' | 'all' | 'shrink', amount: number = 30) => {
    let [ymin, xmin, ymax, xmax] = box.box2d;

    if (direction === 'top') {
      ymin = Math.max(0, ymin - amount);
    } else if (direction === 'bottom') {
      ymax = Math.min(1000, ymax + amount);
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
      ...box,
      box2d: [ymin, xmin, ymax, xmax],
    });
  };

  const handleSmartSnap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const fittedBox2d = smartSnapBoxToBubble(imgData, box.box2d, {
      isBlackBg: box.backgroundColor === 'black',
    });
    onUpdateBox({
      ...box,
      box2d: fittedBox2d,
      maskPadding: box.maskPadding ?? 0,
    });
  };

  const currentFontSize = box.fontSize || 32;
  const isEraser = !!box.isEraser;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={editorRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
      }}
      className="w-[360px] sm:w-[380px] bg-slate-900/98 border-2 border-indigo-500 rounded-2xl shadow-2xl shadow-black/90 backdrop-blur-md overflow-hidden text-left flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150 ring-2 ring-indigo-500/40"
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-xs text-white flex items-center gap-1.5">
            {isEraser ? (
              <>
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span>Vùng Tẩy Xóa #{boxIndex + 1}</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Chỉnh Sửa Bóng Thoại #{boxIndex + 1}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onDeleteBox && (
            <button
              onClick={() => onDeleteBox(box.id)}
              className="p-1 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 rounded-lg transition"
              title="Xóa bóng này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            title="Đóng ô chỉnh sửa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-3 overflow-y-auto custom-scrollbar flex-1">
        {/* If this is an Eraser Box */}
        {isEraser ? (
          <div className="space-y-3">
            <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-1">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span>Tẩy Xóa Chữ Tiếng Anh Dư</span>
              </span>
              <p className="text-[11px] text-rose-200/80 leading-tight">
                Vùng này sẽ phủ màu đè lên chữ tiếng Anh còn sót lại để trang truyện sạch sẽ tuyệt đối.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Màu nền che:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateBox({ ...box, backgroundColor: 'white' })}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    box.backgroundColor === 'white'
                      ? 'border-white bg-white text-slate-900 shadow'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-white border border-slate-300" />
                  <span>Trắng (Bóng thoại)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBox({ ...box, backgroundColor: 'black' })}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    box.backgroundColor === 'black'
                      ? 'border-slate-400 bg-slate-950 text-white shadow ring-1 ring-slate-400'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-black border border-slate-600" />
                  <span>Đen (Khung tối)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Original English Text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-400">Tiếng Anh Gốc:</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {box.originalText?.length || 0} ký tự
                </span>
              </div>
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono select-text leading-snug">
                {box.originalText || '(Không có câu thoại gốc)'}
              </div>
            </div>

            {/* Vietnamese Editable Text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-indigo-300">
                  Nội Dung Dịch Tiếng Việt:
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBox({
                      ...box,
                      translatedText: box.translatedText.toUpperCase(),
                    })
                  }
                  className="text-[10px] font-bold bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 px-2 py-0.5 rounded-md transition active:scale-95 cursor-pointer"
                  title="Chuyển thành chữ IN HOA chuẩn phong cách manga"
                >
                  IN HOA
                </button>
              </div>

              <textarea
                value={box.translatedText ?? ''}
                onChange={(e) => onUpdateBox({ ...box, translatedText: e.target.value })}
                rows={3}
                placeholder="Nhập nội dung câu dịch..."
                className="w-full p-2.5 bg-slate-950 border border-indigo-500/50 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none font-semibold leading-relaxed"
                autoFocus
              />
            </div>

            {/* FONT SIZE CONTROLS (Điều chỉnh kích thước font chữ & Tự co giãn) */}
            <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <span>Kích Thước Font Chữ:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBox({
                        ...box,
                        autoFitFont: !(box.autoFitFont !== false),
                      })
                    }
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                      box.autoFitFont !== false
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                    title="Tự động co giãn cỡ chữ tối đa vừa vặn khung bóng thoại"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{box.autoFitFont !== false ? '⚡ Tự co giãn' : 'Chỉnh tay'}</span>
                  </button>

                  <span className="text-amber-400 font-bold bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded-md font-mono text-xs">
                    {currentFontSize} px
                  </span>
                </div>
              </div>

              {/* Slider & Quick Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBox({
                      ...box,
                      fontSize: Math.max(10, currentFontSize - 2),
                      autoFitFont: false,
                    })
                  }
                  className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-sm transition active:scale-95"
                  title="Giảm 2px (chuyển sang cỡ cố định)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <input
                  type="range"
                  min="12"
                  max="90"
                  step="1"
                  value={currentFontSize}
                  onChange={(e) =>
                    onUpdateBox({
                      ...box,
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
                      ...box,
                      fontSize: Math.min(120, currentFontSize + 2),
                      autoFitFont: false,
                    })
                  }
                  className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-sm transition active:scale-95"
                  title="Tăng 2px (chuyển sang cỡ cố định)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-900">
                {[
                  { label: 'Nhỏ (24px)', size: 24 },
                  { label: 'Chuẩn (32px)', size: 32 },
                  { label: 'Vừa (40px)', size: 40 },
                  { label: 'Lớn (48px)', size: 48 },
                ].map((preset) => (
                  <button
                    key={preset.size}
                    type="button"
                    onClick={() => onUpdateBox({ ...box, fontSize: preset.size, autoFitFont: false })}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition ${
                      currentFontSize === preset.size && box.autoFitFont === false
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Styling & Bubble Color */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Bold / Italic */}
              <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 pl-1">Kiểu:</span>
                <button
                  type="button"
                  onClick={() => onUpdateBox({ ...box, bold: !(box.bold ?? true) })}
                  className={`flex-1 py-1 rounded-lg border text-xs font-bold transition flex items-center justify-center ${
                    (box.bold ?? true)
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                  title="In đậm"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBox({ ...box, italic: !box.italic })}
                  className={`flex-1 py-1 rounded-lg border text-xs transition flex items-center justify-center ${
                    box.italic
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                  title="In nghiêng"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text & Background Color */}
              <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 pl-1">Màu:</span>
                <select
                  value={box.textColor || 'black'}
                  onChange={(e) => onUpdateBox({ ...box, textColor: e.target.value as any })}
                  className="flex-1 bg-slate-900 border border-slate-800 text-[11px] text-slate-200 rounded p-1"
                >
                  <option value="black">Chữ đen</option>
                  <option value="white">Chữ trắng</option>
                  <option value="red">Chữ đỏ</option>
                </select>
              </div>
            </div>

            {/* Quick AI Retranslate Section */}
            {onRetranslateBox && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <label className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Dịch Lại Bằng AI:</span>
                </label>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={retranslateInstruction}
                    onChange={(e) => setRetranslateInstruction(e.target.value)}
                    placeholder="VD: Anh - Em, Con - Mẹ, hài hước..."
                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRetranslateSubmit();
                    }}
                  />
                  <button
                    onClick={handleRetranslateSubmit}
                    disabled={isRetranslating}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-50 transition active:scale-95"
                  >
                    {isRetranslating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Dịch</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1">
                  {['Anh - Em', 'Con - Mẹ', 'Cậu - Tớ', 'Hài hước'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRetranslateInstruction(preset)}
                      className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Coverage Shortcuts */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={handleSmartSnap}
            className="w-full py-1.5 px-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            title="Tự động nhận diện và khớp bong bóng này xếp chồng trực tiếp lên bong bóng gốc, vừa khít và không còn thấy chữ tiếng Anh"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Khớp Thông Minh Lên Bóng Gốc</span>
          </button>

          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => handleExpandBox('top', 40)}
              className="flex-1 py-1.5 px-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
              title="Kéo mép trên lên cao để che chữ tiếng Anh sót ở đỉnh bóng thoại"
            >
              <ArrowUp className="w-3 h-3" />
              <span>Kéo Lên (+40)</span>
            </button>

            <button
              type="button"
              onClick={() => handleExpandBox('bottom', 50)}
              className="flex-1 py-1.5 px-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
              title="Kéo đáy xuống dưới để che chữ tiếng Anh còn sót bên dưới đáy bóng thoại"
            >
              <ArrowDown className="w-3 h-3 text-amber-300" />
              <span>Kéo Xuống (+50)</span>
            </button>

            <button
              type="button"
              onClick={() => handleExpandBox('all', 20)}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
              title="Mở rộng đều 4 phía"
            >
              <Maximize className="w-3 h-3" />
              <span>Nới (+20)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow transition active:scale-95"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Xong / Đóng</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
