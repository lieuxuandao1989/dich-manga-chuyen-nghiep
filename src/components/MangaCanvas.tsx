import React, { useRef, useEffect, useState } from 'react';
import { MangaPage, SpeechBox } from '../types';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  Layers,
  Eye,
  Sliders,
  Check,
  Settings,
  Zap,
  Coins,
  ExternalLink,
  Play,
  Eraser,
  MousePointer,
  MessageSquarePlus,
  Plus,
  Type,
  ScanText,
} from 'lucide-react';
import { FloatingBubbleEditor } from './FloatingBubbleEditor';
import { smartAlignBoxesToMangaImage } from '../utils/bubbleDetector';

interface MangaCanvasProps {
  page: MangaPage;
  selectedBoxId: string | null;
  onSelectBox: (boxId: string | null) => void;
  onUpdateBox?: (updatedBox: SpeechBox) => void;
  onUpdateAllBoxes?: (updatedBoxes: SpeechBox[]) => void;
  onDeleteBox?: (id: string) => void;
  onRetranslateBox?: (box: SpeechBox, instruction: string) => Promise<void>;
  onTranslateCurrentPage: () => void;
  onDetectBubbles?: () => void;
  onContinueTranslateFromCurrent?: () => void;
  fontFamily: string;
  readerMode: 'overlay' | 'side-by-side' | 'original' | 'slider';
  onChangeReaderMode: (mode: 'overlay' | 'side-by-side' | 'original' | 'slider') => void;
  onOpenSettings?: () => void;
  onAddEraserBox?: (box2d: [number, number, number, number], bg?: 'white' | 'black') => void;
  onAddBox?: (box2d?: [number, number, number, number]) => void;
}

type DragHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export const MangaCanvas: React.FC<MangaCanvasProps> = ({
  page,
  selectedBoxId,
  onSelectBox,
  onUpdateBox,
  onUpdateAllBoxes,
  onDeleteBox,
  onRetranslateBox,
  onTranslateCurrentPage,
  onDetectBubbles,
  onContinueTranslateFromCurrent,
  fontFamily,
  readerMode,
  onChangeReaderMode,
  onOpenSettings,
  onAddEraserBox,
  onAddBox,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage for comparison slider
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('default');
  const [isSnappingAll, setIsSnappingAll] = useState<boolean>(false);

  const handleAutoSnapAll = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !page.boxes || page.boxes.length === 0) return;
    setIsSnappingAll(true);
    try {
      const aligned = await smartAlignBoxesToMangaImage(canvas, page.boxes);
      if (onUpdateAllBoxes) {
        onUpdateAllBoxes(aligned);
      } else if (onUpdateBox) {
        aligned.forEach((b) => onUpdateBox(b));
      }
    } catch (err) {
      console.warn('Lỗi khi tự động khớp bong bóng:', err);
    } finally {
      setIsSnappingAll(false);
    }
  };

  // Tool mode: Select/Move boxes vs Eraser Box drawing
  const [activeTool, setActiveTool] = useState<'select' | 'eraser'>('select');
  const [eraserBg, setEraserBg] = useState<'white' | 'black'>('white');
  const [isDrawingEraser, setIsDrawingEraser] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Controls whether the floating bubble popup editor appears on click (defaults to false so screen remains completely clear)
  const [showFloatingEditor, setShowFloatingEditor] = useState<boolean>(() => {
    try {
      return localStorage.getItem('manga_show_floating_editor') === 'true';
    } catch {
      return false;
    }
  });

  const [dragState, setDragState] = useState<{
    boxId: string;
    handle: DragHandle;
    startX: number;
    startY: number;
    initialBox2d: [number, number, number, number];
    hasMoved?: boolean;
  } | null>(null);

  const selectedBox = page.boxes.find((b) => b.id === selectedBoxId);

  // Global mouseup to guarantee drag release
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDragState(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Load and render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page.originalUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    if (!page.originalUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = page.originalUrl;

    img.onload = () => {
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1200;

      // 1. Draw original base page
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 2. Draw overlay boxes if mode is 'overlay' or 'side-by-side' or 'slider'
      if (readerMode !== 'original' && page.boxes && page.boxes.length > 0) {
        const fontStack =
          fontFamily === 'Comic'
            ? '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive, sans-serif'
            : fontFamily === 'Serif'
            ? '"Georgia", serif'
            : '"Plus Jakarta Sans", sans-serif';

        page.boxes.forEach((box) => {
          const [ymin, xmin, ymax, xmax] = box.box2d;
          const x = (xmin / 1000) * canvas.width;
          const y = (ymin / 1000) * canvas.height;
          const w = Math.max(((xmax - xmin) / 1000) * canvas.width, 10);
          const h = Math.max(((ymax - ymin) / 1000) * canvas.height, 10);

          ctx.save();

          // Fill/mask background: snug and just enough to cover English text, NOT covering original manga artwork
          const extraPad = (box.maskPadding ?? 0) / 100;
          const basePadRatio = 0.015; // 1.5% bleed is just enough to cleanly cover characters without ballooning over original art
          const padX = Math.max(1, w * (basePadRatio + extraPad));
          const padY = Math.max(1, h * (basePadRatio + extraPad));
          const maskX = Math.max(0, x - padX);
          const maskY = Math.max(0, y - padY);
          const maskW = Math.min(canvas.width - maskX, w + padX * 2);
          const maskH = Math.min(canvas.height - maskY, h + padY * 2);

          if (box.backgroundColor === 'white') {
            ctx.fillStyle = '#ffffff';
          } else if (box.backgroundColor === 'black') {
            ctx.fillStyle = '#000000';
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          }

          const borderRadius = Math.min(16, Math.min(maskW, maskH) * 0.18);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(maskX, maskY, maskW, maskH, borderRadius);
          } else {
            ctx.rect(maskX, maskY, maskW, maskH);
          }
          ctx.fill();

          // Render Vietnamese text
          const isSelected = selectedBoxId === box.id;
          const isHoveredBox = hoveredBoxId === box.id;

          if (isSelected) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3.2;
            ctx.stroke();
          } else if (isHoveredBox) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Check if this box is an eraser patch to cleanly cover leftover English text
          const isEraserBox = !!box.isEraser;
          if (isEraserBox) {
            // Solid mask is already drawn above! If not selected and in eraser mode or hovered, draw subtle dashed outline
            if (!isSelected && (activeTool === 'eraser' || isHoveredBox)) {
              ctx.strokeStyle = box.backgroundColor === 'black' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(244, 63, 94, 0.6)';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 3]);
              ctx.strokeRect(maskX, maskY, maskW, maskH);
              ctx.setLineDash([]);
            }
            ctx.restore();
            return;
          }

          ctx.fillStyle = box.textColor === 'white' ? '#ffffff' : box.textColor === 'red' ? '#dc2626' : '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const padding = Math.min(w, h) * 0.08;
          const maxWidth = w - padding * 2;
          const maxHeight = h - padding * 2;

          const text = (box.translatedText || '').trim().toUpperCase();

          // Resolution-aware font size calculation:
          // Base reference is 1200px height.
          const resolutionScale = canvas.height / 1200;
          const isBold = box.bold ?? true;
          const isItalic = !!box.italic;
          const shouldAutoFit = box.autoFitFont !== false;

          let fontSize = 32;
          let lines: string[] = [text];

          if (shouldAutoFit) {
            // TỰ CO GIÃN THÔNG MINH (AUTO-FIT):
            // Tự động tìm kích thước font tối đa vừa vặn khung để nội dung dịch chèn lên hết chữ gốc
            let minF = Math.max(10, Math.round(11 * resolutionScale));
            let maxF = Math.min(180, Math.max(minF + 1, Math.round(maxHeight * 0.65)));
            let bestF = minF;
            let bestLines = wrapText(ctx, text, maxWidth);

            let low = minF;
            let high = maxF;

            while (low <= high) {
              const mid = Math.floor((low + high) / 2);
              ctx.font = `${isBold ? 'bold ' : ''}${isItalic ? 'italic ' : ''}${mid}px ${fontStack}`;
              const testLines = wrapText(ctx, text, maxWidth);
              const lineHeight = mid * 1.22;
              const totalHeight = testLines.length * lineHeight;

              // Check if any single word overflows maxWidth
              let wordOverflow = false;
              for (const tl of testLines) {
                if (ctx.measureText(tl).width > maxWidth * 1.03) {
                  wordOverflow = true;
                  break;
                }
              }

              if (!wordOverflow && totalHeight <= maxHeight) {
                bestF = mid;
                bestLines = testLines;
                low = mid + 1; // Thử cỡ chữ lớn hơn để phủ kín khoảng trống
              } else {
                high = mid - 1; // Vượt quá khung, giảm cỡ chữ
              }
            }

            fontSize = bestF;
            lines = bestLines;
          } else {
            // Cỡ chữ thủ công theo chỉ định của người dùng
            fontSize = Math.round((box.fontSize || 32) * resolutionScale);
            fontSize = Math.max(10, Math.min(fontSize, 200));
            ctx.font = `${isBold ? 'bold ' : ''}${isItalic ? 'italic ' : ''}${fontSize}px ${fontStack}`;
            lines = wrapText(ctx, text, maxWidth);
            let totalTextHeight = lines.length * (fontSize * 1.22);
            while (totalTextHeight > maxHeight && fontSize > 10) {
              fontSize -= 1;
              ctx.font = `${isBold ? 'bold ' : ''}${isItalic ? 'italic ' : ''}${fontSize}px ${fontStack}`;
              lines = wrapText(ctx, text, maxWidth);
              totalTextHeight = lines.length * (fontSize * 1.22);
            }
          }

          ctx.font = `${isBold ? 'bold ' : ''}${isItalic ? 'italic ' : ''}${fontSize}px ${fontStack}`;
          const lineHeight = fontSize * 1.22;
          const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;

          lines.forEach((line, idx) => {
            const lineY = startY + idx * lineHeight;
            if (box.backgroundColor === 'black' || box.textColor === 'white') {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = Math.max(2, fontSize * 0.08);
              ctx.strokeText(line, x + w / 2, lineY);
            }
            ctx.fillText(line, x + w / 2, lineY);
          });

          ctx.restore();
        });

        // 3. Draw active resize handles & guide pill on Selected Box
        if (selectedBoxId) {
          const selectedBox = page.boxes.find((b) => b.id === selectedBoxId);
          if (selectedBox) {
            const [ymin, xmin, ymax, xmax] = selectedBox.box2d;
            const sx = (xmin / 1000) * canvas.width;
            const sy = (ymin / 1000) * canvas.height;
            const sw = Math.max(((xmax - xmin) / 1000) * canvas.width, 10);
            const sh = Math.max(((ymax - ymin) / 1000) * canvas.height, 10);

            ctx.save();

            // High-contrast dashed selection border
            ctx.strokeStyle = selectedBox.isEraser ? '#f43f5e' : '#6366f1';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(sx, sy, sw, sh);
            ctx.setLineDash([]);

            // 8 handles
            const handles = [
              { type: 'nw', hx: sx, hy: sy },
              { type: 'n', hx: sx + sw / 2, hy: sy },
              { type: 'ne', hx: sx + sw, hy: sy },
              { type: 'e', hx: sx + sw, hy: sy + sh / 2 },
              { type: 'se', hx: sx + sw, hy: sy + sh },
              { type: 's', hx: sx + sw / 2, hy: sy + sh },
              { type: 'sw', hx: sx, hy: sy + sh },
              { type: 'w', hx: sx, hy: sy + sh / 2 },
            ];

            handles.forEach(({ hx, hy }) => {
              ctx.beginPath();
              ctx.arc(hx, hy, 6, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.strokeStyle = selectedBox.isEraser ? '#e11d48' : '#4f46e5';
              ctx.lineWidth = 2;
              ctx.stroke();
            });

            // Helpful guide tag above box
            const isSelectedEraser = selectedBox.isEraser || !selectedBox.translatedText?.trim();
            const guideText = isSelectedEraser
              ? '🧹 Vùng Tẩy Chữ (Kéo mép để che chữ tiếng Anh còn dư)'
              : "⬆️ Kéo mép trên để che chữ gốc (ISN'T IT...)";
            ctx.font = 'bold 12px sans-serif';
            const metrics = ctx.measureText(guideText);
            const badgeW = metrics.width + 16;
            const badgeX = Math.max(6, Math.min(canvas.width - badgeW - 6, sx + sw / 2 - badgeW / 2));
            const badgeY = Math.max(10, sy - 26);

            ctx.fillStyle = isSelectedEraser ? 'rgba(30, 10, 18, 0.95)' : 'rgba(15, 23, 42, 0.92)';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(badgeX, badgeY, badgeW, 22, 6);
            } else {
              ctx.rect(badgeX, badgeY, badgeW, 22);
            }
            ctx.fill();
            ctx.strokeStyle = isSelectedEraser ? '#f43f5e' : '#6366f1';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = isSelectedEraser ? '#fecdd3' : '#e0e7ff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(guideText, badgeX + badgeW / 2, badgeY + 11);

            ctx.restore();
          }
        }

        // Draw hover tooltip badge when mouse is over an unselected box
        if (hoveredBoxId && hoveredBoxId !== selectedBoxId && activeTool === 'select') {
          const hoveredBox = page.boxes.find((b) => b.id === hoveredBoxId);
          if (hoveredBox && hoveredBox.box2d && hoveredBox.box2d.length >= 4) {
            const ymin = Math.min(hoveredBox.box2d[0], hoveredBox.box2d[2]);
            const xmin = Math.min(hoveredBox.box2d[1], hoveredBox.box2d[3]);
            const xmax = Math.max(hoveredBox.box2d[1], hoveredBox.box2d[3]);

            const sx = (xmin / 1000) * canvas.width;
            const sy = (ymin / 1000) * canvas.height;
            const sw = Math.max(((xmax - xmin) / 1000) * canvas.width, 10);

            const tipText = '💬 Nhấp để sửa ô thoại này';
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            const m = ctx.measureText(tipText);
            const tipW = m.width + 16;
            const tipX = Math.max(6, Math.min(canvas.width - tipW - 6, sx + sw / 2 - tipW / 2));
            const tipY = Math.max(6, sy - 24);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(tipX, tipY, tipW, 20, 5);
            } else {
              ctx.rect(tipX, tipY, tipW, 20);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tipText, tipX + tipW / 2, tipY + 10);
            ctx.restore();
          }
        }

        // 4. Draw live drawing preview when dragging eraser rectangle
        if (isDrawingEraser && drawStart && drawCurrent) {
          const minX = Math.min(drawStart.x, drawCurrent.x);
          const minY = Math.min(drawStart.y, drawCurrent.y);
          const curW = Math.abs(drawCurrent.x - drawStart.x);
          const curH = Math.abs(drawCurrent.y - drawStart.y);

          ctx.save();
          ctx.fillStyle = eraserBg === 'black' ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)';
          ctx.fillRect(minX, minY, curW, curH);

          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(minX, minY, curW, curH);
          ctx.setLineDash([]);

          const label = '🧹 Đang vẽ vùng che chữ tiếng Anh...';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#f43f5e';
          ctx.fillText(label, minX + 5, Math.max(16, minY - 6));
          ctx.restore();
        }
      }
    };
  }, [page, selectedBoxId, hoveredBoxId, fontFamily, readerMode, isDrawingEraser, drawStart, drawCurrent, eraserBg, activeTool]);

  // Wrap text helper
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  };

  // Detect which handle or part of box is under cursor
  const getHandleAt = (
    normX: number,
    normY: number,
    box: SpeechBox,
    canvas: HTMLCanvasElement
  ): DragHandle | null => {
    const [ymin, xmin, ymax, xmax] = box.box2d;
    const pxX = (normX / 1000) * canvas.width;
    const pxY = (normY / 1000) * canvas.height;

    const sx = (xmin / 1000) * canvas.width;
    const sy = (ymin / 1000) * canvas.height;
    const sw = ((xmax - xmin) / 1000) * canvas.width;
    const sh = ((ymax - ymin) / 1000) * canvas.height;

    const hitRadius = 14;

    const points: { type: DragHandle; x: number; y: number }[] = [
      { type: 'nw', x: sx, y: sy },
      { type: 'n', x: sx + sw / 2, y: sy },
      { type: 'ne', x: sx + sw, y: sy },
      { type: 'e', x: sx + sw, y: sy + sh / 2 },
      { type: 'se', x: sx + sw, y: sy + sh },
      { type: 's', x: sx + sw / 2, y: sy + sh },
      { type: 'sw', x: sx, y: sy + sh },
      { type: 'w', x: sx, y: sy + sh / 2 },
    ];

    for (const p of points) {
      const dist = Math.hypot(pxX - p.x, pxY - p.y);
      if (dist <= hitRadius) return p.type;
    }

    if (normX >= xmin && normX <= xmax && normY >= ymin && normY <= ymax) {
      return 'move';
    }

    return null;
  };

  // Helper to reliably find speech box under cursor with generous buffer (accounting for mask bleed & organic bubble shape)
  const findBoxAt = (normX: number, normY: number, tolerance: number = 38): SpeechBox | null => {
    if (!page.boxes || page.boxes.length === 0) return null;

    let closestBox: SpeechBox | null = null;
    let minDistance = Infinity;

    for (const box of page.boxes) {
      if (!box.box2d || box.box2d.length < 4) continue;
      const ymin = Math.min(box.box2d[0], box.box2d[2]);
      const ymax = Math.max(box.box2d[0], box.box2d[2]);
      const xmin = Math.min(box.box2d[1], box.box2d[3]);
      const xmax = Math.max(box.box2d[1], box.box2d[3]);

      const w = xmax - xmin;
      const h = ymax - ymin;
      const extraPad = ((box.maskPadding ?? 0) / 100) * Math.max(w, h);
      const padX = Math.max(25, w * 0.15 + extraPad);
      const padY = Math.max(25, h * 0.15 + extraPad);

      // 1. Strictly inside box boundaries
      if (normX >= xmin && normX <= xmax && normY >= ymin && normY <= ymax) {
        const cx = (xmin + xmax) / 2;
        const cy = (ymin + ymax) / 2;
        const dist = Math.hypot(normX - cx, normY - cy);
        if (dist < minDistance) {
          minDistance = dist;
          closestBox = box;
        }
      } else if (
        minDistance > 0 &&
        normX >= xmin - padX &&
        normX <= xmax + padX &&
        normY >= ymin - padY &&
        normY <= ymax + padY
      ) {
        // 2. Within visual mask / tolerant margin
        const dx = Math.max(0, Math.max(xmin - normX, normX - xmax));
        const dy = Math.max(0, Math.max(ymin - normY, normY - ymax));
        const dist = Math.hypot(dx, dy) + 100;
        if (dist < minDistance && dist - 100 <= tolerance) {
          minDistance = dist;
          closestBox = box;
        }
      }
    }

    return closestBox;
  };

  // Handle canvas mouse down to start dragging handles or moving box, or drawing eraser
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (activeTool === 'eraser') {
      setIsDrawingEraser(true);
      setDrawStart({ x: clickX, y: clickY });
      setDrawCurrent({ x: clickX, y: clickY });
      return;
    }

    if (!page.boxes || page.boxes.length === 0) return;

    const normX = (clickX / canvas.width) * 1000;
    const normY = (clickY / canvas.height) * 1000;

    // Check if clicking resize handles of currently selected box
    const selectedBox = page.boxes.find((b) => b.id === selectedBoxId);
    if (selectedBox) {
      const handle = getHandleAt(normX, normY, selectedBox, canvas);
      if (handle && handle !== 'move') {
        setDragState({
          boxId: selectedBox.id,
          handle,
          startX: normX,
          startY: normY,
          initialBox2d: [...selectedBox.box2d],
          hasMoved: true,
        });
        return;
      }
    }

    // Find if a speech bubble was clicked using generous hit margin
    const found = findBoxAt(normX, normY, 40);

    if (found) {
      onSelectBox(found.id);
      setDragState({
        boxId: found.id,
        handle: 'move',
        startX: normX,
        startY: normY,
        initialBox2d: [...found.box2d],
        hasMoved: false,
      });
    } else {
      // Clicked outside any speech bubble: deselect
      onSelectBox(null);
    }
  };

  // Guarantee selection on regular click event
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'eraser') return;
    const canvas = canvasRef.current;
    if (!canvas || !page.boxes || page.boxes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 1000;
    const normY = ((e.clientY - rect.top) / rect.height) * 1000;

    const found = findBoxAt(normX, normY, 40);
    if (found) {
      onSelectBox(found.id);
    }
  };

  // Handle mouse move over canvas for live dragging & cursor updates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (activeTool === 'eraser') {
      if (isDrawingEraser && drawStart) {
        setDrawCurrent({ x: clickX, y: clickY });
      }
      setCursorStyle('crosshair');
      return;
    }

    if (!page.boxes || page.boxes.length === 0) return;

    const normX = (clickX / canvas.width) * 1000;
    const normY = (clickY / canvas.height) * 1000;

    // If dragging active
    if (dragState && onUpdateBox) {
      const dx = normX - dragState.startX;
      const dy = normY - dragState.startY;
      const dist = Math.hypot(dx, dy);

      // Require threshold before treating as drag movement
      if (!dragState.hasMoved) {
        if (dist < 8) return;
        dragState.hasMoved = true;
      }

      const targetBox = page.boxes.find((b) => b.id === dragState.boxId);
      if (!targetBox) return;

      const [iYmin, iXmin, iYmax, iXmax] = dragState.initialBox2d;
      let ymin = iYmin;
      let xmin = iXmin;
      let ymax = iYmax;
      let xmax = iXmax;

      const wNorm = iXmax - iXmin;
      const hNorm = iYmax - iYmin;

      switch (dragState.handle) {
        case 'n':
          ymin = Math.max(0, Math.min(iYmax - 15, iYmin + dy));
          break;
        case 's':
          ymax = Math.min(1000, Math.max(iYmin + 15, iYmax + dy));
          break;
        case 'w':
          xmin = Math.max(0, Math.min(iXmax - 15, iXmin + dx));
          break;
        case 'e':
          xmax = Math.min(1000, Math.max(iXmin + 15, iXmax + dx));
          break;
        case 'nw':
          ymin = Math.max(0, Math.min(iYmax - 15, iYmin + dy));
          xmin = Math.max(0, Math.min(iXmax - 15, iXmin + dx));
          break;
        case 'ne':
          ymin = Math.max(0, Math.min(iYmax - 15, iYmin + dy));
          xmax = Math.min(1000, Math.max(iXmin + 15, iXmax + dx));
          break;
        case 'sw':
          ymax = Math.min(1000, Math.max(iYmin + 15, iYmax + dy));
          xmin = Math.max(0, Math.min(iXmax - 15, iXmin + dx));
          break;
        case 'se':
          ymax = Math.min(1000, Math.max(iYmin + 15, iYmax + dy));
          xmax = Math.min(1000, Math.max(iXmin + 15, iXmax + dx));
          break;
        case 'move':
          ymin = Math.max(0, Math.min(1000 - hNorm, iYmin + dy));
          ymax = ymin + hNorm;
          xmin = Math.max(0, Math.min(1000 - wNorm, iXmin + dx));
          xmax = xmin + wNorm;
          break;
      }

      onUpdateBox({
        ...targetBox,
        box2d: [Math.round(ymin), Math.round(xmin), Math.round(ymax), Math.round(xmax)],
      });
      return;
    }

    // Hover cursor calculation
    const selectedBox = page.boxes.find((b) => b.id === selectedBoxId);
    if (selectedBox) {
      const handle = getHandleAt(normX, normY, selectedBox, canvas);
      if (handle === 'n' || handle === 's') {
        setCursorStyle('ns-resize');
        return;
      } else if (handle === 'w' || handle === 'e') {
        setCursorStyle('ew-resize');
        return;
      } else if (handle === 'nw' || handle === 'se') {
        setCursorStyle('nwse-resize');
        return;
      } else if (handle === 'ne' || handle === 'sw') {
        setCursorStyle('nesw-resize');
        return;
      } else if (handle === 'move') {
        setCursorStyle('move');
        return;
      }
    }

    const found = findBoxAt(normX, normY, 36);

    if (found) {
      setCursorStyle('pointer');
      setHoveredBoxId(found.id);
    } else {
      setCursorStyle('default');
      setHoveredBoxId(null);
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeTool === 'eraser') {
      if (isDrawingEraser && drawStart && drawCurrent && canvasRef.current) {
        const canvas = canvasRef.current;
        const minX = Math.min(drawStart.x, drawCurrent.x);
        const minY = Math.min(drawStart.y, drawCurrent.y);
        const maxX = Math.max(drawStart.x, drawCurrent.x);
        const maxY = Math.max(drawStart.y, drawCurrent.y);

        const wPx = maxX - minX;
        const hPx = maxY - minY;

        if (wPx > 8 && hPx > 8) {
          const ymin = Math.max(0, Math.min(1000, Math.round((minY / canvas.height) * 1000)));
          const xmin = Math.max(0, Math.min(1000, Math.round((minX / canvas.width) * 1000)));
          const ymax = Math.max(0, Math.min(1000, Math.round((maxY / canvas.height) * 1000)));
          const xmax = Math.max(0, Math.min(1000, Math.round((maxX / canvas.width) * 1000)));

          if (onAddEraserBox) {
            onAddEraserBox([ymin, xmin, ymax, xmax], eraserBg);
          }
        }
      }
      setIsDrawingEraser(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    setDragState(null);
  };

  // Double click on canvas: focus and select speech bubble under cursor
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const normX = (clickX / canvas.width) * 1000;
    const normY = (clickY / canvas.height) * 1000;

    const found = findBoxAt(normX, normY, 40);
    if (found) {
      onSelectBox(found.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
      {/* Top Controls Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10 backdrop-blur-sm">
        {/* Reader Mode Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onChangeReaderMode('overlay')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              readerMode === 'overlay'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Đã dịch (Overlay)</span>
          </button>

          <button
            onClick={() => onChangeReaderMode('side-by-side')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              readerMode === 'side-by-side'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Song Song (Anh - Việt)</span>
          </button>

          <button
            onClick={() => onChangeReaderMode('slider')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              readerMode === 'slider'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Thanh Kính Lúp</span>
          </button>

          <button
            onClick={() => onChangeReaderMode('original')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              readerMode === 'original'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Bản Gốc</span>
          </button>
        </div>

        {/* Interactive Editing Tool: Select/Edit vs Eraser Mask */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button
            onClick={() => setActiveTool('select')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTool === 'select'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Bấm chọn trực tiếp vào ô thoại đã dịch trên trang để chỉnh sửa nội dung và cỡ chữ"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Chọn / Sửa Thoại</span>
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-rose-400'
            }`}
            title="Kéo thả chuột trên ảnh để vẽ vùng che chữ tiếng Anh còn dư"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Xóa Chữ Thừa</span>
          </button>

          {activeTool === 'eraser' && (
            <div className="flex items-center gap-1 pl-1 ml-1 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setEraserBg('white')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  eraserBg === 'white' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Che nền màu trắng"
              >
                Trắng
              </button>
              <button
                type="button"
                onClick={() => setEraserBg('black')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  eraserBg === 'black' ? 'bg-slate-900 text-white border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Che nền màu đen"
              >
                Đen
              </button>
              {onAddEraserBox && (
                <button
                  type="button"
                  onClick={() => onAddEraserBox([350, 300, 450, 700], eraserBg)}
                  className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded text-[11px] font-medium transition cursor-pointer"
                  title="Thêm nhanh một ô che chữ thừa ở giữa trang"
                >
                  + Tạo nhanh
                </button>
              )}
            </div>
          )}

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Toggle Popup chỉnh sửa nhanh (mặc định Tắt để không che trang truyện) */}
          <button
            type="button"
            onClick={() => {
              const next = !showFloatingEditor;
              setShowFloatingEditor(next);
              try {
                localStorage.setItem('manga_show_floating_editor', String(next));
              } catch {}
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
              showFloatingEditor
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={
              showFloatingEditor
                ? 'Popup nhanh đang BẬT trên ảnh (bấm để tắt không che trang truyện)'
                : 'Popup nhanh đang TẮT (bấm nếu muốn bật popup nổi trên ảnh)'
            }
          >
            <Layers className="w-3 h-3" />
            <span>Popup nhanh: {showFloatingEditor ? 'Bật' : 'Tắt'}</span>
          </button>
        </div>

        {/* Action button & Zoom controls */}
        <div className="flex items-center gap-2">
          {/* Nút Nhận Diện Bong Bóng (luôn hiển thị để người dùng có thể nhận diện hoặc quét lại) */}
          <button
            onClick={onDetectBubbles || onTranslateCurrentPage}
            disabled={page.status === 'translating'}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition disabled:opacity-50 text-xs active:scale-95 cursor-pointer"
            title="Quét AI để tự động tìm, định vị và nhận diện tất cả các bong bóng thoại trên trang này"
          >
            {page.status === 'translating' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>Đang nhận diện...</span>
              </>
            ) : (
              <>
                <ScanText className="w-3.5 h-3.5 text-amber-300" />
                <span>Nhận diện bong bóng</span>
              </>
            )}
          </button>

          {page.status === 'completed' && (
            <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs">
              <Check className="w-3.5 h-3.5" />
              <span>Đã nhận diện ({page.boxes.length} bóng)</span>
            </span>
          )}

          {page.boxes && page.boxes.length > 0 && (
            <button
              onClick={handleAutoSnapAll}
              disabled={isSnappingAll || page.status === 'translating'}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-emerald-700/25 transition text-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Khớp thông minh: Tự động xếp chồng bong bóng đã dịch chính xác lên bong bóng gốc, vừa khít và che sạch 100% chữ tiếng Anh"
            >
              {isSnappingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Đang khớp...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Khớp Bong Bóng Thông Minh</span>
                </>
              )}
            </button>
          )}

          {onContinueTranslateFromCurrent && (
            <button
              onClick={onContinueTranslateFromCurrent}
              disabled={page.status === 'translating'}
              className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-violet-600/30 transition text-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Tự động dịch liên tục các trang tiếp theo trong truyện"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>{page.status === 'completed' ? 'Dịch Tiếp Các Trang Sau' : 'Dịch Tiếp Từ Đây'}</span>
            </button>
          )}

          {page.usedKeyInfo && (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-mono text-[11px] border ${
                      page.usedKeyInfo.tier === 'paid'
                        ? 'text-amber-300 bg-amber-950/70 border-amber-600/50'
                        : 'text-indigo-300 bg-indigo-950/70 border-indigo-700/50'
                    }`}
                    title={`Trang này được dịch bằng API Key #${page.usedKeyInfo.keyIndex}/${page.usedKeyInfo.totalKeys} (${page.usedKeyInfo.keyMasked}) [Gói: ${page.usedKeyInfo.tier || 'free'}, Model: ${page.usedKeyInfo.model || 'flash'}]`}
                  >
                    {page.usedKeyInfo.tier === 'paid' ? (
                      <>
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="font-bold">
                          Paid ({page.usedKeyInfo.model?.includes('pro') ? 'Pro 💎' : 'Flash ⚡'})
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span>Key #{page.usedKeyInfo.keyIndex}</span>
                      </>
                    )}
                  </span>

                  {page.usedKeyInfo.costUsd !== undefined && page.usedKeyInfo.costUsd > 0 && (
                    <span
                      className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 rounded-lg flex items-center gap-1 font-mono text-[10px]"
                      title={`Chi phí trang này: $${page.usedKeyInfo.costUsd.toFixed(5)} USD (~${Math.round(page.usedKeyInfo.costUsd * 25400)} VNĐ) - ${page.usedKeyInfo.tokensUsed?.toLocaleString() || 0} tokens`}
                    >
                      <Coins className="w-3 h-3 text-emerald-400" />
                      <span>~{Math.round(page.usedKeyInfo.costUsd * 25400)}đ</span>
                    </span>
                  )}
                </div>
              )}

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Zoom Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
              className="p-1.5 hover:bg-slate-800 rounded-md transition"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1.5 hover:bg-slate-800 rounded-md transition"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 hover:bg-slate-800 rounded-md transition text-slate-400 hover:text-slate-200"
              title="Đặt lại kích thước"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Display Stage */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center relative custom-scrollbar bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] w-full h-full"
      >
        {page.status === 'translating' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-slate-200 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 animate-pulse">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <p className="font-medium text-sm text-indigo-200">
              Gemini AI đang nhận diện bóng thoại & dịch tiếng Việt...
            </p>
            <p className="text-xs text-slate-400">
              Đang phân tích layout hình ảnh và canh vị trí văn bản
            </p>
          </div>
        )}

        {page.status === 'error' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-rose-950/95 border border-rose-800 text-rose-200 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl backdrop-blur-md max-w-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-xs flex-1">
              <p className="font-semibold text-rose-300">Không thể dịch trang này</p>
              <p className="text-rose-200/90 leading-tight mt-0.5">{page.errorMessage || 'Vui lòng thử lại.'}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {(page.errorMessage?.includes('ai.studio/spend') || page.errorMessage?.includes('Spend Cap')) && (
                <a
                  href="https://ai.studio/spend"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm"
                  title="Mở Google AI Studio để điều chỉnh giới hạn trần chi tiêu tháng"
                >
                  <span>Mở Spend Cap</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm"
                  title="Mở cài đặt để thêm nhiều API Key xoay tua"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Thêm Key</span>
                </button>
              )}
              <button
                onClick={onTranslateCurrentPage}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-rose-200 rounded-lg text-xs font-medium transition shadow-sm"
              >
                Thử lại
              </button>
              {onContinueTranslateFromCurrent && (
                <button
                  onClick={onContinueTranslateFromCurrent}
                  className="px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Thử lại và tiếp tục dịch tự động toàn bộ các trang tiếp theo"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Dịch Tiếp</span>
                </button>
              )}
            </div>
          </div>
        )}

        {page.status === 'skipped' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-xl backdrop-blur-md">
            <span className="text-amber-400 font-bold text-[11px] bg-amber-950 px-2 py-0.5 rounded-full border border-amber-700/50">
              ⏭️ Bỏ qua tự động
            </span>
            <span className="text-xs text-amber-200/90 font-medium">
              {page.skipReason || 'Bỏ qua theo bộ lọc (Trang có màu hoặc thuộc 4 trang đầu file CBZ)'}
            </span>
            <button
              onClick={onTranslateCurrentPage}
              className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs transition shadow-sm"
              title="Bấm để dịch riêng trang này bất chấp bộ lọc"
            >
              Dịch Riêng Trang Này
            </button>
            {onContinueTranslateFromCurrent && (
              <button
                onClick={onContinueTranslateFromCurrent}
                className="ml-1 px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1 active:scale-95"
                title="Tiếp tục dịch tự động từ trang này"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Dịch Tiếp Từ Đây</span>
              </button>
            )}
          </div>
        )}

        {/* View Mode 1: Standard Overlay or Original */}
        {(readerMode === 'overlay' || readerMode === 'original') && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="transition-transform duration-150 ease-out flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-slate-800 m-auto max-w-full"
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              style={{ cursor: cursorStyle }}
              className="max-h-[85vh] max-w-full w-auto h-auto object-contain bg-slate-900 select-none block shadow-2xl"
            />
          </div>
        )}

        {/* View Mode 2: Side-by-Side (Left = Original English, Right = Translated Vietnamese) */}
        {readerMode === 'side-by-side' && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-full transition-transform duration-150"
          >
            {/* Left: Original Page */}
            <div className="flex flex-col items-center bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
              <span className="text-xs text-slate-400 font-medium mb-1.5 flex items-center gap-1">
                <span>Trang Gốc (Tiếng Anh)</span>
              </span>
              <img
                src={page.originalUrl}
                alt="Original English Manga"
                className="max-h-[75vh] w-auto object-contain rounded-lg border border-slate-800"
              />
            </div>

            {/* Right: Translated Canvas Page */}
            <div className="flex flex-col items-center bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
              <span className="text-xs text-indigo-300 font-medium mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bản Dịch Tiếng Việt</span>
              </span>
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                style={{ cursor: cursorStyle }}
                className="max-h-[75vh] w-auto object-contain rounded-lg border border-slate-800 select-none"
              />
            </div>
          </div>
        )}

        {/* View Mode 3: Visual Comparison Slider */}
        {readerMode === 'slider' && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="relative max-h-[82vh] max-w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl group select-none"
          >
            {/* Base Image (Original) */}
            <img
              src={page.originalUrl}
              alt="Original"
              className="max-h-[82vh] w-auto object-contain block bg-slate-900 pointer-events-none"
            />

            {/* Top Image Overlay (Translated) clipped by slider */}
            <div
              className="absolute top-0 left-0 bottom-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                style={{ cursor: cursorStyle }}
                className="max-h-[82vh] w-auto h-full object-contain bg-slate-900 select-none"
              />
            </div>

            {/* Vertical Slider Line */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-indigo-500 shadow-lg cursor-ew-resize z-10 flex items-center justify-center"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white border-2 border-white flex items-center justify-center shadow-xl text-xs font-bold -ml-0.5">
                ↔
              </div>
            </div>

            {/* Slider Range Input */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-20"
            />
          </div>
        )}
      </div>

      {/* Floating Interactive Bubble Editor for clicked speech bubble (only if explicitly enabled by user) */}
      {showFloatingEditor && selectedBox && onUpdateBox && (
        <FloatingBubbleEditor
          box={selectedBox}
          boxIndex={page.boxes.indexOf(selectedBox)}
          canvasRef={canvasRef}
          zoom={zoom}
          onUpdateBox={onUpdateBox}
          onDeleteBox={onDeleteBox}
          onRetranslateBox={onRetranslateBox}
          onClose={() => onSelectBox(null)}
        />
      )}
    </div>
  );
};
