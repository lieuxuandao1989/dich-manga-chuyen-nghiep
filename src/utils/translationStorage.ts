import { SpeechBox } from '../types';

const DB_NAME = 'MangaTranslatorDB';
const DB_VERSION = 1;
const STORE_PAGES = 'page_translations';
const STORE_SESSIONS = 'sessions';

export interface SavedSession {
  fileName: string;
  translatedCount: number;
  totalPages?: number;
  lastPageIndex: number;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PAGES)) {
        const pageStore = db.createObjectStore(STORE_PAGES, { keyPath: 'id' });
        pageStore.createIndex('fileName', 'fileName', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'fileName' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePageTranslation(
  fileName: string,
  pageIndex: number,
  data: {
    boxes: SpeechBox[];
    usedKeyInfo?: any;
    totalPages?: number;
  }
): Promise<void> {
  try {
    const db = await openDB();
    const id = `${fileName}_page_${pageIndex}`;

    // 1. Save page translation
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PAGES, STORE_SESSIONS], 'readwrite');
      const pageStore = tx.objectStore(STORE_PAGES);
      pageStore.put({
        id,
        fileName,
        pageIndex,
        boxes: data.boxes,
        usedKeyInfo: data.usedKeyInfo,
        updatedAt: Date.now(),
      });

      // Update session record
      const sessionStore = tx.objectStore(STORE_SESSIONS);
      const getReq = sessionStore.get(fileName);
      getReq.onsuccess = () => {
        const existing = getReq.result as SavedSession | undefined;
        const currentCount = (existing?.translatedCount || 0) + (existing ? 0 : 1);
        sessionStore.put({
          fileName,
          translatedCount: existing ? existing.translatedCount + 1 : 1,
          totalPages: data.totalPages || existing?.totalPages,
          lastPageIndex: pageIndex,
          updatedAt: Date.now(),
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Lưu bản dịch vào IndexedDB thất bại:', err);
  }
}

export async function loadTranslationsForFile(
  fileName: string
): Promise<Map<number, { boxes: SpeechBox[]; usedKeyInfo?: any }>> {
  const result = new Map<number, { boxes: SpeechBox[]; usedKeyInfo?: any }>();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PAGES, 'readonly');
      const store = tx.objectStore(STORE_PAGES);
      const index = store.index('fileName');
      const request = index.getAll(IDBKeyRange.only(fileName));

      request.onsuccess = () => {
        const items = request.result || [];
        for (const item of items) {
          if (typeof item.pageIndex === 'number' && Array.isArray(item.boxes)) {
            result.set(item.pageIndex, {
              boxes: item.boxes,
              usedKeyInfo: item.usedKeyInfo,
            });
          }
        }
        resolve(result);
      };

      request.onerror = () => {
        console.warn('Đọc cache bản dịch từ IndexedDB lỗi:', request.error);
        resolve(result);
      };
    });
  } catch (err) {
    console.warn('Không thể mở IndexedDB để đọc bản dịch:', err);
    return result;
  }
}

export async function getLatestSavedSession(): Promise<SavedSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = (request.result || []) as SavedSession[];
        if (sessions.length === 0) {
          return resolve(null);
        }
        // Return session with latest updatedAt
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sessions[0]);
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearSavedSession(fileName: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_PAGES, STORE_SESSIONS], 'readwrite');
    const pageStore = tx.objectStore(STORE_PAGES);
    const index = pageStore.index('fileName');
    const req = index.getAllKeys(IDBKeyRange.only(fileName));
    req.onsuccess = () => {
      const keys = req.result || [];
      for (const k of keys) {
        pageStore.delete(k);
      }
    };
    tx.objectStore(STORE_SESSIONS).delete(fileName);
  } catch (err) {
    console.warn('Xóa session cache lỗi:', err);
  }
}
