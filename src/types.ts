export interface MangaPage {
  id: string;
  filename: string;
  originalUrl: string; // Blob URL or base64
  originalBlob: Blob;
  width: number;
  height: number;
  status: 'idle' | 'translating' | 'completed' | 'error' | 'skipped';
  errorMessage?: string;
  boxes: SpeechBox[];
  translatedCanvasUrl?: string;
  isColor?: boolean; // true if color page, false if black & white
  colorRatio?: number; // ratio of color pixels
  manualSkip?: boolean; // user override to skip or force translate
  skipReason?: string; // reason why page is skipped (e.g. '4 trang đầu', 'Trang màu')
  usedKeyInfo?: {
    keyIndex: number;
    totalKeys: number;
    keyMasked: string;
    model?: string;
    rotated?: boolean;
    tier?: 'free' | 'paid';
    costUsd?: number;
    tokensUsed?: number;
  };
}

export interface SpeechBox {
  id: string;
  box2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] scaled 0-1000
  originalText: string;
  translatedText: string;
  bubbleType: 'speech' | 'thought' | 'sfx' | 'caption';
  backgroundColor: 'white' | 'black' | 'transparent';
  textColor: 'black' | 'white' | 'red' | 'blue';
  fontSize: number; // calculated or user set
  autoFitFont?: boolean; // true to dynamically auto-scale font size to fit box & cover original text
  bold?: boolean;
  italic?: boolean;
  maskPadding?: number; // extra padding in % to expand inpainting coverage
  isEraser?: boolean; // true if this box is an eraser patch to cleanly cover leftover English text
}

export type SupportedPaidModel = 'gemini-3.6-flash' | 'gemini-3.1-flash-lite-preview' | 'gemini-3.1-flash-lite';

export interface TranslationSettings {
  tone: 'natural' | 'formal' | 'informal' | 'dramatic';
  addressingPairs: string; // e.g. "Cậu - Tớ, Anh - Em, Ta - Ngươi"
  fontFamily: 'Comic' | 'Sans' | 'Serif';
  autoInpaint: boolean;
  preserveFormat: boolean;
  apiKey?: string;
  apiKeys?: string[]; // Up to 10 Gemini API keys for auto-rotation
  // Paid API Optimizations:
  apiTier: 'free' | 'paid'; // 'free' | 'paid' (Pay-as-you-go)
  paidModel: SupportedPaidModel;
  paidPacingSpeed: 'turbo' | 'fast' | 'normal'; // turbo: 400ms, fast: 1000ms, normal: 2000ms
  concurrency: 1 | 2 | 3; // 1 (tuần tự), 2 (song song x2), 3 (song song x3)
  deepNuance: boolean; // Tối ưu văn học sâu sắc thái manga
  // Page filtering settings:
  onlyTranslateBW: boolean; // Chỉ dịch trang trắng đen (mặc định true)
  skipColorPages: boolean; // Bỏ qua trang có màu (mặc định true)
  skipFirstNPages: number; // Bỏ qua N trang đầu tiên của file CBZ (mặc định 4)
  excludeUntranslatedColorPagesFromExport?: boolean; // Tùy chọn: Không đóng các trang màu chưa dịch vào file kết quả CBZ khi xuất
  // Page range options:
  customRangeEnabled?: boolean;
  startPage?: number; // 1-indexed (e.g. 1)
  endPage?: number; // 1-indexed (e.g. 50)
}

export interface CBZFileMeta {
  name: string;
  totalPages: number;
  pages: MangaPage[];
}

export interface BatchProgress {
  current: number;
  total: number;
  startPage?: number;
  endPage?: number;
  estimatedSecondsLeft?: number;
  formattedTimeLeft?: string;
  speedSecondsPerPage?: number;
  completedInBatch?: number;
  activeTranslatingPages?: number[];
}

export interface SessionUsage {
  totalTokens: number;
  totalCostUsd: number;
  totalCostVnd: number;
  pagesTranslatedCount: number;
}
