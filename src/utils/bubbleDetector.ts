import { SpeechBox } from '../types';

/**
 * Intelligent Speech Bubble Detection & Snapping Algorithm
 * (Thuật toán nhận diện & khớp thông minh bong bóng dịch đè lên bong bóng gốc)
 *
 * Capabilities:
 * 1. Detects if an AI bounding box is shifted or offset away from the actual speech bubble
 *    (e.g. placed over character artwork or panel margins).
 * 2. Re-centers the box directly onto the true speech bubble in the manga page image.
 * 3. Expands and fits the boundaries snugly to the speech bubble interior strokes
 *    so 100% of English text is masked without any letter bleeding or peeking through.
 */

interface SnapOptions {
  isBlackBg?: boolean;
  paddingSafetyPercent?: number; // default 2-4%
}

/**
 * Calculate pixel luminance (0 = black, 255 = white)
 */
function getPixelLuminance(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const px = Math.floor(x);
  const py = Math.floor(y);
  const idx = (py * width + px) * 4;
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

/**
 * Smartly snap a single box to the physical speech bubble in the image
 */
export function smartSnapBoxToBubble(
  imageData: ImageData,
  box2d: [number, number, number, number],
  options: SnapOptions = {}
): [number, number, number, number] {
  const { width, height, data } = imageData;
  const isBlackBg = !!options.isBlackBg;

  const [rawYmin, rawXmin, rawYmax, rawXmax] = box2d;
  let ymin = Math.min(rawYmin, rawYmax);
  let ymax = Math.max(rawYmin, rawYmax);
  let xmin = Math.min(rawXmin, rawXmax);
  let xmax = Math.max(rawXmin, rawXmax);

  // Convert normalized 0-1000 to pixel coordinates
  let pxYmin = Math.max(0, Math.min(height - 1, Math.round((ymin / 1000) * height)));
  let pxYmax = Math.max(0, Math.min(height - 1, Math.round((ymax / 1000) * height)));
  let pxXmin = Math.max(0, Math.min(width - 1, Math.round((xmin / 1000) * width)));
  let pxXmax = Math.max(0, Math.min(width - 1, Math.round((xmax / 1000) * width)));

  let boxW = Math.max(12, pxXmax - pxXmin);
  let boxH = Math.max(12, pxYmax - pxYmin);
  let cx = Math.round((pxXmin + pxXmax) / 2);
  let cy = Math.round((pxYmin + pxYmax) / 2);

  // Background criteria:
  // For standard manga (white bubble): bubble interior is white (lum > 200) with dark text (lum < 120).
  // For dark bubble: bubble interior is dark (lum < 65) with light text (lum > 180).
  const isBgPixel = (lum: number) => (isBlackBg ? lum < 70 : lum > 195);
  const isTextPixel = (lum: number) => (isBlackBg ? lum > 165 : lum < 125);
  const isStrokePixel = (lum: number) => (isBlackBg ? lum > 190 : lum < 130);

  // 1. EVALUATE CURRENT CENTER & CHECK FOR OFFSETS (KIỂM TRA LỆCH VỊ TRÍ)
  // Check whether current center has high bubble background ratio or if it landed on artwork/screentone
  const evaluateRegion = (sampleCenterX: number, sampleCenterY: number, radiusX: number, radiusY: number) => {
    let totalSamples = 0;
    let bgSamples = 0;
    let textSamples = 0;

    const stepX = Math.max(2, Math.round(radiusX / 5));
    const stepY = Math.max(2, Math.round(radiusY / 5));

    for (let dy = -radiusY; dy <= radiusY; dy += stepY) {
      for (let dx = -radiusX; dx <= radiusX; dx += stepX) {
        const sx = Math.max(0, Math.min(width - 1, sampleCenterX + dx));
        const sy = Math.max(0, Math.min(height - 1, sampleCenterY + dy));
        const lum = getPixelLuminance(data, width, sx, sy);

        totalSamples++;
        if (isBgPixel(lum)) bgSamples++;
        else if (isTextPixel(lum)) textSamples++;
      }
    }

    const bgRatio = totalSamples > 0 ? bgSamples / totalSamples : 0;
    const textRatio = totalSamples > 0 ? textSamples / totalSamples : 0;
    // Good speech bubble has lots of background color AND text characters inside
    const score = bgRatio * 2.0 + (textRatio > 0.04 && textRatio < 0.5 ? 1.2 : 0);
    return { bgRatio, textRatio, score };
  };

  const currentEval = evaluateRegion(cx, cy, boxW * 0.35, boxH * 0.35);

  // If the current box has low background ratio (< 0.45), it likely landed on character art / screentone
  // Search in neighborhood (especially horizontally left & right where bubbles often reside)
  if (currentEval.bgRatio < 0.45) {
    let bestScore = currentEval.score;
    let bestX = cx;
    let bestY = cy;

    const maxSearchX = Math.min(width * 0.35, boxW * 1.8);
    const maxSearchY = Math.min(height * 0.25, boxH * 0.9);
    const searchStepX = Math.max(8, Math.round(boxW * 0.25));
    const searchStepY = Math.max(8, Math.round(boxH * 0.25));

    for (let offsetX = -maxSearchX; offsetX <= maxSearchX; offsetX += searchStepX) {
      for (let offsetY = -maxSearchY; offsetY <= maxSearchY; offsetY += searchStepY) {
        if (offsetX === 0 && offsetY === 0) continue;
        const candX = Math.max(boxW / 2, Math.min(width - boxW / 2, cx + offsetX));
        const candY = Math.max(boxH / 2, Math.min(height - boxH / 2, cy + offsetY));

        const candEval = evaluateRegion(candX, candY, boxW * 0.35, boxH * 0.35);
        // Distance penalty to favor the closest bubble
        const dist = Math.hypot(offsetX, offsetY);
        const maxDist = Math.hypot(maxSearchX, maxSearchY) || 1;
        const adjustedScore = candEval.score - (dist / maxDist) * 0.4;

        if (candEval.bgRatio > 0.55 && adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestX = candX;
          bestY = candY;
        }
      }
    }

    if (bestScore > currentEval.score + 0.35) {
      cx = Math.round(bestX);
      cy = Math.round(bestY);
    }
  }

  // 2. CONTOUR & BOUNDARY RAY-CASTING (TÌM MÌNH KHUNG BÓNG THOẠI ĐỂ VỪA KHỚP)
  // Scan outwards in 4 directions to find where the speech bubble stroke / border is.
  const findBorderDistance = (startX: number, startY: number, stepX: number, stepY: number, maxSteps: number) => {
    let curX = startX;
    let curY = startY;
    let steps = 0;
    let consecutiveBorderPixels = 0;

    while (steps < maxSteps) {
      curX += stepX;
      curY += stepY;
      steps++;

      if (curX < 0 || curX >= width || curY < 0 || curY >= height) {
        return steps;
      }

      const lum = getPixelLuminance(data, width, curX, curY);

      if (isStrokePixel(lum)) {
        consecutiveBorderPixels++;
        if (consecutiveBorderPixels >= 2) {
          // Detected dark border of speech bubble
          return Math.max(10, steps - 1);
        }
      } else {
        consecutiveBorderPixels = 0;
      }
    }

    return steps;
  };

  // Limit boundary search to a snug margin around the text area
  const maxExpandW = Math.min(boxW * 0.15, 12);
  const maxExpandH = Math.min(boxH * 0.15, 12);

  const leftDistCenter = findBorderDistance(cx, cy, -1, 0, maxExpandW);
  const leftDistTop = findBorderDistance(cx, Math.max(0, cy - boxH * 0.25), -1, 0, maxExpandW);
  const leftDistBottom = findBorderDistance(cx, Math.min(height - 1, cy + boxH * 0.25), -1, 0, maxExpandW);
  const bestLeftDist = Math.min(leftDistCenter, leftDistTop, leftDistBottom);

  const rightDistCenter = findBorderDistance(cx, cy, 1, 0, maxExpandW);
  const rightDistTop = findBorderDistance(cx, Math.max(0, cy - boxH * 0.25), 1, 0, maxExpandW);
  const rightDistBottom = findBorderDistance(cx, Math.min(height - 1, cy + boxH * 0.25), 1, 0, maxExpandW);
  const bestRightDist = Math.min(rightDistCenter, rightDistTop, rightDistBottom);

  const topDistCenter = findBorderDistance(cx, cy, 0, -1, maxExpandH);
  const topDistLeft = findBorderDistance(Math.max(0, cx - boxW * 0.25), cy, 0, -1, maxExpandH);
  const topDistRight = findBorderDistance(Math.min(width - 1, cx + boxW * 0.25), cy, 0, -1, maxExpandH);
  const bestTopDist = Math.min(topDistCenter, topDistLeft, topDistRight);

  const bottomDistCenter = findBorderDistance(cx, cy, 0, 1, maxExpandH);
  const bottomDistLeft = findBorderDistance(Math.max(0, cx - boxW * 0.25), cy, 0, 1, maxExpandH);
  const bottomDistRight = findBorderDistance(Math.min(width - 1, cx + boxW * 0.25), cy, 0, 1, maxExpandH);
  const bestBottomDist = Math.min(bottomDistCenter, bottomDistLeft, bottomDistRight);

  // 3. SNUG BOUNDING BOX CALCULATION:
  // Vừa đủ che các chữ tiếng Anh cần dịch mà không che ảnh gốc
  const finalPxXmin = Math.max(0, cx - boxW / 2 - Math.min(bestLeftDist, 4));
  const finalPxXmax = Math.min(width, cx + boxW / 2 + Math.min(bestRightDist, 4));
  const finalPxYmin = Math.max(0, cy - boxH / 2 - Math.min(bestTopDist, 4));
  const finalPxYmax = Math.min(height, cy + boxH / 2 + Math.min(bestBottomDist, 4));

  // Convert back to normalized 0-1000 scale
  const finalYmin = Math.max(0, Math.min(1000, Math.round((finalPxYmin / height) * 1000)));
  const finalXmin = Math.max(0, Math.min(1000, Math.round((finalPxXmin / width) * 1000)));
  const finalYmax = Math.max(finalYmin + 12, Math.min(1000, Math.round((finalPxYmax / height) * 1000)));
  const finalXmax = Math.max(finalXmin + 12, Math.min(1000, Math.round((finalPxXmax / width) * 1000)));

  return [finalYmin, finalXmin, finalYmax, finalXmax];
}

/**
 * Align and fit all speech boxes in a manga page automatically
 */
export async function smartAlignBoxesToMangaImage(
  imageSource: HTMLImageElement | HTMLCanvasElement | Blob | string,
  boxes: SpeechBox[]
): Promise<SpeechBox[]> {
  if (!boxes || boxes.length === 0) return boxes;

  try {
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;

    if (imageSource instanceof HTMLCanvasElement) {
      canvas = imageSource;
      ctx = canvas.getContext('2d');
    } else {
      let img: HTMLImageElement;
      if (imageSource instanceof HTMLImageElement) {
        img = imageSource;
      } else {
        img = new Image();
        img.crossOrigin = 'anonymous';
        const url = imageSource instanceof Blob ? URL.createObjectURL(imageSource) : imageSource;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for bubble alignment'));
          img.src = url;
        });
      }

      canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
    }

    if (!ctx) return boxes;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return boxes.map((box) => {
      // Don't modify manual erasers unless they have box2d
      if (box.isEraser) return box;

      const fittedBox2d = smartSnapBoxToBubble(imageData, box.box2d, {
        isBlackBg: box.backgroundColor === 'black',
      });

      return {
        ...box,
        box2d: fittedBox2d,
        maskPadding: box.maskPadding ?? 0,
      };
    });
  } catch (err) {
    console.warn('Smart bubble snapping fallback to original boxes:', err);
    return boxes;
  }
}
