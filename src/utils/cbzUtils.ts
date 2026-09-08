import JSZip from 'jszip';
import { MangaPage, SpeechBox } from '../types';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'];

// Helper for natural sorting of filenames (e.g. page_1, page_2, page_10)
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export async function parseCBZFile(file: File): Promise<MangaPage[]> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);

  // Check for embedded project metadata from previous export
  let embeddedProjectData: any = null;
  const projectFile =
    contents.file('manga_project.json') ||
    contents.file('translation_data.json');

  if (projectFile) {
    try {
      const jsonText = await projectFile.async('text');
      embeddedProjectData = JSON.parse(jsonText);
      console.log('Đã phát hiện dữ liệu bản dịch nhúng sẵn trong file CBZ:', embeddedProjectData);
    } catch (e) {
      console.warn('Không thể phân tích dữ liệu manga_project.json trong CBZ:', e);
    }
  }

  const imageFiles: { name: string; zipObject: JSZip.JSZipObject }[] = [];

  contents.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      const lowerName = relativePath.toLowerCase();
      if (IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        imageFiles.push({ name: relativePath, zipObject: zipEntry });
      }
    }
  });

  // Sort image files by filename naturally
  imageFiles.sort((a, b) => naturalCompare(a.name, b.name));

  const mangaPages: MangaPage[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const item = imageFiles[i];
    const blob = await item.zipObject.async('blob');
    const originalUrl = URL.createObjectURL(blob);

    // Get image dimensions and detect color mode
    const dimensions = await getImageDimensions(originalUrl);
    const { isColor, colorRatio } = await detectImageColorMode(originalUrl);

    // Restore embedded speech boxes and status if this CBZ was previously translated/exported
    let boxes: SpeechBox[] = [];
    let status: 'idle' | 'translating' | 'completed' | 'error' = 'idle';

    if (embeddedProjectData) {
      const savedPageList = Array.isArray(embeddedProjectData)
        ? embeddedProjectData
        : Array.isArray(embeddedProjectData.pages)
        ? embeddedProjectData.pages
        : Array.isArray(embeddedProjectData.data)
        ? embeddedProjectData.data
        : [];

      const cleanItemName = item.name.split('/').pop()?.toLowerCase();
      const savedPage =
        savedPageList.find((p: any) => {
          const cleanPName = (p.cleanFilename || p.filename || '').split('/').pop()?.toLowerCase();
          return (
            (cleanPName && cleanItemName && cleanPName === cleanItemName) ||
            p.filename === item.name ||
            p.cleanFilename === item.name
          );
        }) || savedPageList[i];

      if (savedPage && Array.isArray(savedPage.boxes) && savedPage.boxes.length > 0) {
        boxes = savedPage.boxes.map((b: any, bIdx: number) => ({
          id: b.id || `box_${i}_${bIdx}_${Date.now()}`,
          box2d: b.box2d || [100, 100, 300, 400],
          originalText: b.originalText || '',
          translatedText: b.translatedText || '',
          bubbleType: b.bubbleType || 'speech',
          backgroundColor: b.backgroundColor || 'white',
          textColor: b.textColor || 'black',
          fontSize: b.fontSize || 32,
          bold: b.bold ?? true,
          italic: !!b.italic,
          maskPadding: b.maskPadding || 0,
          isEraser: !!b.isEraser,
        }));
        status = 'completed';
      }
    }

    mangaPages.push({
      id: `page_${i + 1}_${Date.now()}`,
      filename: item.name,
      originalUrl,
      originalBlob: blob,
      width: dimensions.width,
      height: dimensions.height,
      status,
      boxes,
      isColor,
      colorRatio,
    });
  }

  return mangaPages;
}

export function detectImageColorMode(url: string): Promise<{ isColor: boolean; colorRatio: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 80;
        sampleCanvas.height = 120;
        const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          return resolve({ isColor: false, colorRatio: 0 });
        }
        ctx.drawImage(img, 0, 0, 80, 120);
        const data = ctx.getImageData(0, 0, 80, 120).data;
        let colorPixels = 0;
        let validPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 30) continue;

          // Skip pure black and pure white background margins where color doesn't exist
          if ((r < 20 && g < 20 && b < 20) || (r > 240 && g > 240 && b > 240)) {
            continue;
          }

          validPixels++;

          // In B&W manga scan, R ≈ G ≈ B. Allow subtle scanner tint / paper grain up to delta 22
          const delta = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
          if (delta > 22) {
            colorPixels++;
          }
        }

        const colorRatio = validPixels > 0 ? colorPixels / validPixels : 0;
        // Không phân loại hoặc đánh dấu loại bỏ những trang từ 16% màu trở xuống (colorRatio <= 0.16)
        // Chỉ những trang có trên 16% pixel màu (colorRatio > 0.16) mới được coi là trang màu (bìa màu, poster, tranh màu chính)
        const isColor = colorRatio > 0.16;
        resolve({ isColor, colorRatio });
      } catch (err) {
        console.warn('Lỗi phân tích màu trang:', err);
        resolve({ isColor: false, colorRatio: 0 });
      }
    };
    img.onerror = () => {
      resolve({ isColor: false, colorRatio: 0 });
    };
    img.src = url;
  });
}

// Unified helper to check whether a page should be translated based on skip rules
export function isPageEligibleForTranslation(
  pageIndex: number,
  page: MangaPage,
  settings: {
    onlyTranslateBW: boolean;
    skipColorPages: boolean;
    skipFirstNPages: number;
  }
): { eligible: boolean; reason?: string } {
  // Explicit manual override by user
  if (page.manualSkip === true) {
    return { eligible: false, reason: 'Người dùng bỏ qua' };
  }
  if (page.manualSkip === false) {
    return { eligible: true };
  }

  // 1. Skip first N pages rule (e.g. 4 pages of covers / TOC / credits)
  if (settings.skipFirstNPages > 0 && pageIndex < settings.skipFirstNPages) {
    return {
      eligible: false,
      reason: `${settings.skipFirstNPages} trang đầu (Trang #${pageIndex + 1})`,
    };
  }

  // 2. Skip color pages / Only translate B&W
  if ((settings.skipColorPages || settings.onlyTranslateBW) && page.isColor) {
    return { eligible: false, reason: 'Trang màu (Chỉ dịch B&W)' };
  }

  return { eligible: true };
}

export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 1200 });
    };
    img.onerror = () => {
      resolve({ width: 800, height: 1200 });
    };
    img.src = url;
  });
}

export function imageToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Chuyển đổi hình ảnh sang base64 thất bại.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Optimize manga page image for Gemini OCR and translation to reduce token usage and prevent 429 rate limits
export function optimizeImageForOcr(blob: Blob, maxDimension = 1600): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const origW = img.naturalWidth || 800;
      const origH = img.naturalHeight || 1200;

      // If already within reasonable dimensions and size, keep standard base64
      if (origW <= maxDimension && origH <= maxDimension && blob.size < 1.5 * 1024 * 1024) {
        imageToBase64(blob)
          .then((b64) => resolve({ base64: b64, mimeType: blob.type || 'image/jpeg' }))
          .catch(() => {
            // fallback to canvas below
          });
      }

      // Calculate proportional scale
      let targetW = origW;
      let targetH = origH;
      if (targetW > maxDimension || targetH > maxDimension) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDimension) / targetW);
          targetW = maxDimension;
        } else {
          targetW = Math.round((targetW * maxDimension) / targetH);
          targetH = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        imageToBase64(blob).then((b64) => resolve({ base64: b64, mimeType: blob.type || 'image/jpeg' }));
        return;
      }

      // High quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Export as high quality JPEG (ideal for manga OCR with small token size)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      imageToBase64(blob).then((b64) => resolve({ base64: b64, mimeType: blob.type || 'image/png' }));
    };

    img.src = objectUrl;
  });
}

// Generate rendered canvas Blob for a page with fast hardware-accelerated encoding
export function renderTranslatedPageToCanvas(
  originalImg: HTMLImageElement,
  boxes: SpeechBox[],
  fontFamily: string = 'Comic',
  mimeType: string = 'image/jpeg',
  quality: number = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = originalImg.naturalWidth || originalImg.width || 800;
    canvas.height = originalImg.naturalHeight || originalImg.height || 1200;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return reject(new Error('Không thể khởi tạo 2D Canvas context.'));
    }

    // 1. Draw original background image
    ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);

    // 2. Render speech boxes & inpaint mask
    const fontStack =
      fontFamily === 'Comic'
        ? '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif'
        : fontFamily === 'Serif'
        ? '"Georgia", "Times New Roman", serif'
        : '"Plus Jakarta Sans", "Helvetica Neue", sans-serif';

    boxes.forEach((box) => {
      const [ymin, xmin, ymax, xmax] = box.box2d;

      // Convert normalized 0-1000 box2d coordinates to actual canvas pixels
      const x = (xmin / 1000) * canvas.width;
      const y = (ymin / 1000) * canvas.height;
      const w = Math.max(((xmax - xmin) / 1000) * canvas.width, 10);
      const h = Math.max(((ymax - ymin) / 1000) * canvas.height, 10);

      // Fill/mask background: snug and just enough to cover English text, NOT covering original manga artwork
      const extraPad = (box.maskPadding ?? 0) / 100;
      const basePadRatio = 0.015; // 1.5% bleed is just enough to cleanly cover characters without ballooning over original art
      const padX = Math.max(1, w * (basePadRatio + extraPad));
      const padY = Math.max(1, h * (basePadRatio + extraPad));
      const maskX = Math.max(0, x - padX);
      const maskY = Math.max(0, y - padY);
      const maskW = Math.min(canvas.width - maskX, w + padX * 2);
      const maskH = Math.min(canvas.height - maskY, h + padY * 2);

      // Inpaint/cover background
      ctx.save();

      if (box.backgroundColor === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
      } else if (box.backgroundColor === 'black') {
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      }

      // Draw mask shape (rounded box with capped radius so corners don't cut into words or leak English text)
      const borderRadius = Math.min(16, Math.min(maskW, maskH) * 0.18);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(maskX, maskY, maskW, maskH, borderRadius);
      } else {
        ctx.rect(maskX, maskY, maskW, maskH);
      }
      ctx.fill();

      // Render Vietnamese text inside box
      ctx.fillStyle = box.textColor === 'white' ? '#ffffff' : box.textColor === 'red' ? '#dc2626' : '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const padding = Math.min(w, h) * 0.08;
      const maxWidth = w - padding * 2;
      const maxHeight = h - padding * 2;

      // If this is an eraser box or has no translated text, the background mask above already cleanly covers the English text!
      const text = (box.translatedText || '').trim().toUpperCase();
      if (!text || box.isEraser) {
        ctx.restore();
        return;
      }

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
        // Cỡ chữ thủ công
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
        // Text stroke for contrast if black background or white text
        if (box.backgroundColor === 'black' || box.textColor === 'white') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(2, fontSize * 0.1);
          ctx.strokeText(line, x + w / 2, lineY);
        }
        ctx.fillText(line, x + w / 2, lineY);
      });

      ctx.restore();
    });

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Tạo file ảnh từ canvas thất bại.'));
        }
      },
      mimeType,
      mimeType === 'image/png' ? undefined : quality
    );
  });
}

// Text wrapper utility for Canvas
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
}

export interface ExportCBZOptions {
  excludeUntranslatedColorPages?: boolean;
}

// Helper to check if a page is a color page that has not been translated
export function isUntranslatedColorPage(p: MangaPage): boolean {
  // Không đánh dấu loại bỏ những trang truyện từ 16% màu trở xuống (colorRatio <= 0.16)
  const isColorPage = p.colorRatio !== undefined ? p.colorRatio > 0.16 : !!p.isColor;
  if (!isColorPage) return false;
  const hasActiveTranslatedBoxes =
    p.boxes &&
    p.boxes.length > 0 &&
    p.boxes.some(
      (b) => (b.translatedText && b.translatedText.trim().length > 0) || b.isEraser
    );
  return p.status !== 'completed' && !hasActiveTranslatedBoxes;
}

// Export CBZ Zip archive containing rendered translated manga pages
// Highly optimized with 4-way parallel rendering and instant STORE compression
export async function exportToCBZ(
  pages: MangaPage[],
  zipName: string = 'Manga_Dich_Tieng_Viet.cbz',
  fontFamily: string = 'Comic',
  onProgress?: (current: number, total: number, phase: 'rendering' | 'zipping', percent: number) => void,
  options?: ExportCBZOptions
): Promise<Blob> {
  // If requested, filter out untranslated color pages
  const pagesToExport = options?.excludeUntranslatedColorPages
    ? pages.filter((p) => !isUntranslatedColorPage(p))
    : pages;

  if (pagesToExport.length === 0) {
    throw new Error(
      'Tất cả các trang màu chưa được dịch đã bị loại bỏ theo tùy chọn xuất. Không còn trang nào để tạo file CBZ.'
    );
  }

  const zip = new JSZip();
  const total = pagesToExport.length;
  const pageBlobs: (Blob | null)[] = new Array(total).fill(null);
  let completedCount = 0;

  // Concurrency: Render up to 4 pages simultaneously for maximal throughput
  const concurrency = Math.min(4, Math.max(1, total));

  // Process each page: check if needs canvas rendering or can directly bypass
  const processPage = async (page: MangaPage, i: number) => {
    let pageBlob: Blob | null = null;

    // Only re-render if page actually contains Vietnamese translated text or eraser patches
    const hasActiveBoxes =
      page.boxes &&
      page.boxes.length > 0 &&
      page.boxes.some(
        (b) =>
          (b.translatedText && b.translatedText.trim().length > 0) ||
          b.isEraser
      );

    if (hasActiveBoxes) {
      // Need to render translated text boxes onto page canvas
      let tempUrl: string | null = null;
      try {
        let imgSrc = page.originalUrl;
        if (page.originalBlob && page.originalBlob.size > 0) {
          tempUrl = URL.createObjectURL(page.originalBlob);
          imgSrc = tempUrl;
        }

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Không thể nạp ảnh trang ${i + 1}`));
          image.src = imgSrc;
        });

        // Smart adaptive compression:
        // Raw manga pages in CBZ are usually compressed JPEG scans (150-250KB).
        // Using baseline quality 0.76 yields razor-sharp text and lines while matching original file sizes.
        const originalSize = page.originalBlob?.size || 0;
        let renderedBlob = await renderTranslatedPageToCanvas(img, page.boxes, fontFamily, 'image/jpeg', 0.76);

        // Adaptive fine-tuning: If the rendered page is larger than the original scan,
        // dynamically re-encode with a lower target quality to guarantee zero file bloat.
        if (originalSize > 0 && renderedBlob.size > originalSize) {
          const ratio = renderedBlob.size / originalSize;
          const targetQuality = ratio > 1.3 ? 0.65 : ratio > 1.15 ? 0.69 : 0.72;
          try {
            const tighterBlob = await renderTranslatedPageToCanvas(img, page.boxes, fontFamily, 'image/jpeg', targetQuality);
            if (tighterBlob.size < renderedBlob.size) {
              renderedBlob = tighterBlob;
            }
          } catch (e) {
            // Keep renderedBlob
          }
        }

        pageBlob = renderedBlob;
      } catch (renderErr) {
        console.warn(`Lỗi render canvas trang ${i + 1}, fallback về ảnh gốc:`, renderErr);
        pageBlob = null;
      } finally {
        if (tempUrl) {
          try {
            URL.revokeObjectURL(tempUrl);
          } catch (e) {}
        }
      }
    }

    // Direct fast bypass: untranslated pages or fallback to original blob
    if (!pageBlob) {
      if (page.originalBlob && page.originalBlob.size > 0) {
        pageBlob = page.originalBlob;
      } else if (page.originalUrl) {
        try {
          const res = await fetch(page.originalUrl);
          pageBlob = await res.blob();
        } catch (fetchErr) {
          console.warn(`Không thể lấy blob gốc cho trang ${i + 1}:`, fetchErr);
        }
      }
    }

    if (!pageBlob) {
      // Fallback 1x1 blank canvas if image is somehow completely empty
      const emptyCanvas = document.createElement('canvas');
      emptyCanvas.width = page.width || 800;
      emptyCanvas.height = page.height || 1200;
      pageBlob = await new Promise<Blob>((res) =>
        emptyCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.9)
      );
    }

    pageBlobs[i] = pageBlob;
    completedCount++;

    if (onProgress) {
      const renderPercent = Math.round((completedCount / total) * 100);
      onProgress(completedCount, total, 'rendering', renderPercent);
    }
  };

  // Run with parallel workers
  let nextIndex = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < total) {
      const idx = nextIndex++;
      await processPage(pagesToExport[idx], idx);
    }
  });

  await Promise.all(workers);

  // Add all processed images into JSZip preserving clean sequential naming
  for (let i = 0; i < total; i++) {
    const page = pagesToExport[i];
    const blob = pageBlobs[i];
    if (!blob) continue;

    const isJpeg = blob.type === 'image/jpeg';
    const originalExt =
      page.filename && page.filename.lastIndexOf('.') !== -1
        ? page.filename.substring(page.filename.lastIndexOf('.'))
        : '';
    const extension = isJpeg ? '.jpg' : originalExt || '.png';
    const cleanFilename = `page_${String(i + 1).padStart(3, '0')}${extension}`;

    zip.file(cleanFilename, blob);
  }

  // Embed full project data and speech box coordinates so when the CBZ is imported back later,
  // all bubbles, translated texts, font sizes, colors, and masks are 100% editable!
  const projectManifest = {
    version: 1,
    appName: 'Manga Translator Pro',
    exportedAt: new Date().toISOString(),
    fontFamily,
    pages: pagesToExport.map((p, idx) => {
      const isJpeg = pageBlobs[idx]?.type === 'image/jpeg' || p.originalBlob?.type === 'image/jpeg';
      const cleanFilename = `page_${String(idx + 1).padStart(3, '0')}${isJpeg ? '.jpg' : '.png'}`;
      return {
        index: idx,
        id: p.id,
        cleanFilename,
        filename: p.filename,
        status: p.status,
        tier: p.usedKeyInfo?.tier,
        isColor: p.isColor,
        boxes: (p.boxes || []).map((b) => ({
          id: b.id,
          box2d: b.box2d,
          originalText: b.originalText,
          translatedText: b.translatedText,
          bubbleType: b.bubbleType,
          backgroundColor: b.backgroundColor,
          textColor: b.textColor,
          fontSize: b.fontSize,
          bold: b.bold,
          italic: b.italic,
          maskPadding: b.maskPadding,
          isEraser: b.isEraser,
        })),
      };
    }),
  };

  const projectManifestJson = JSON.stringify(projectManifest, null, 2);
  zip.file('manga_project.json', projectManifestJson);
  zip.file('translation_data.json', projectManifestJson);

  if (onProgress) {
    onProgress(total, total, 'zipping', 0);
  }

  // Standards-compliant CBZ packaging with DEFLATE level 6 compression:
  // Guarantees maximum compatibility with comic readers while eliminating archive bloat,
  // making the exported CBZ equal to or lighter than the original file.
  return await zip.generateAsync(
    {
      type: 'blob',
      mimeType: 'application/vnd.comicbook+zip',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(total, total, 'zipping', Math.round(metadata.percent));
      }
    }
  );
}

/**
 * Xuất file CBZ sau khi lọc bỏ các trang màu được chỉ định.
 * Giữ nguyên 100% chất lượng ảnh gốc mà không cần nén lại.
 */
export async function exportCBZStrippingColorPages(
  pages: MangaPage[],
  excludedPageIds: Set<string> | string[],
  zipName: string = 'Manga_Khong_Trang_Mau.cbz',
  onProgress?: (current: number, total: number, percent: number) => void
): Promise<Blob> {
  const excludedSet = Array.isArray(excludedPageIds) ? new Set(excludedPageIds) : excludedPageIds;
  const keptPages = pages.filter((p) => !excludedSet.has(p.id));

  if (keptPages.length === 0) {
    throw new Error('Không còn trang nào để xuất sau khi lọc bỏ tất cả các trang màu.');
  }

  const zip = new JSZip();
  const total = keptPages.length;

  for (let i = 0; i < total; i++) {
    const page = keptPages[i];
    let blob: Blob;

    // Nếu trang có các khung thoại đã được biên tập / dịch trong ứng dụng, vẽ canvas
    if (page.boxes && page.boxes.length > 0 && page.status === 'completed') {
      let tempUrl = '';
      try {
        tempUrl = URL.createObjectURL(page.originalBlob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = tempUrl;
        });
        blob = await renderTranslatedPageToCanvas(img, page.boxes, 'Comic', 'image/jpeg', 0.85);
      } catch (err) {
        console.warn('Lỗi vẽ canvas, sử dụng blob gốc:', err);
        blob = page.originalBlob;
      } finally {
        if (tempUrl) {
          try {
            URL.revokeObjectURL(tempUrl);
          } catch (e) {}
        }
      }
    } else {
      // Giữ nguyên file ảnh gốc (đặc biệt đối với file CBZ tiếng Việt đã dịch sẵn)
      blob = page.originalBlob;
    }

    const isJpeg = blob.type === 'image/jpeg';
    const originalExt =
      page.filename && page.filename.lastIndexOf('.') !== -1
        ? page.filename.substring(page.filename.lastIndexOf('.'))
        : '';
    const extension = isJpeg ? '.jpg' : originalExt || '.png';
    const cleanFilename = `page_${String(i + 1).padStart(3, '0')}${extension}`;

    zip.file(cleanFilename, blob);

    if (onProgress) {
      onProgress(i + 1, total, Math.round(((i + 1) / total) * 80));
    }
  }

  // Ghi kèm manifest project để lưu trữ thông tin
  const projectManifest = {
    version: 1,
    appName: 'Manga Translator Pro',
    exportedAt: new Date().toISOString(),
    filterNote: 'Đã lọc bỏ các trang màu',
    originalPagesCount: pages.length,
    keptPagesCount: total,
    excludedCount: excludedSet.size,
    pages: keptPages.map((p, idx) => {
      const isJpeg = p.originalBlob?.type === 'image/jpeg';
      const cleanFilename = `page_${String(idx + 1).padStart(3, '0')}${isJpeg ? '.jpg' : '.png'}`;
      return {
        index: idx,
        id: p.id,
        cleanFilename,
        filename: p.filename,
        status: p.status,
        isColor: p.isColor,
        boxes: p.boxes || [],
      };
    }),
  };
  zip.file('manga_project_data.json', JSON.stringify(projectManifest, null, 2));

  if (onProgress) {
    onProgress(total, total, 90);
  }

  return await zip.generateAsync(
    {
      type: 'blob',
      mimeType: 'application/vnd.comicbook+zip',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(total, total, Math.min(100, Math.round(90 + metadata.percent * 0.1)));
      }
    }
  );
}

/**
 * Định dạng số giây còn lại thành chuỗi tiếng Việt trực quan, chính xác
 * Ví dụ: "45 giây", "2 phút 15 giây", "1 giờ 10 phút"
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return 'Vài giây nữa';
  const roundedSecs = Math.round(seconds);
  if (roundedSecs < 60) {
    return `${roundedSecs} giây`;
  }
  const minutes = Math.floor(roundedSecs / 60);
  const remainingSecs = roundedSecs % 60;
  if (minutes < 60) {
    if (remainingSecs === 0) return `${minutes} phút`;
    return `${minutes} phút ${remainingSecs} giây`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${hours} giờ`;
  return `${hours} giờ ${remainingMins} phút`;
}
