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
