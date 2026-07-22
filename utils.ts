import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getPioneerPDFAssets = () => {
  // Returns empty assets so no dynamic watermarks or letterheads are drawn
  return { header: undefined, watermark: undefined, footer: undefined };
};

export const applyPioneerLetterheadDoc = (doc: any, pageCount: number = 1) => {
  // Intentional standard no-op. Allows generated PDFs to remain clean and blank
  // so users can print directly onto pre-printed corporate stationery with physical stamps/signatures.
};

export const compressImageBase64 = (base64Str: string, maxDim = 900, quality = 0.65): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || typeof base64Str !== 'string') {
      resolve(base64Str || '');
      return;
    }
    if (!base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = base64Str;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < base64Str.length ? compressed : base64Str);
        } else {
          resolve(base64Str);
        }
      } catch {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const compressAllImagesInDoc = async (obj: any): Promise<any> => {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/')) {
      return await compressImageBase64(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map(item => compressAllImagesInDoc(item)));
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [key, val] of Object.entries(obj)) {
      res[key] = await compressAllImagesInDoc(val);
    }
    return res;
  }
  return obj;
};

