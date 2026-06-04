import React from 'react';
import ReactDOM from 'react-dom/client';
import { jsPDF } from 'jspdf';

// --- CUSTOM GLOBAL INTERCEPT FOR ALL PDF DOWNLOADS / SAVES Across Entire Codebase ---
if (typeof window !== 'undefined' && jsPDF.prototype && !(jsPDF.prototype as any).__isIntercepted) {
  const originalSave = jsPDF.prototype.save;
  jsPDF.prototype.save = function (filename?: string, options?: any) {
    const finalFilename = filename || 'document.pdf';
    let blobUrl = '';
    try {
      const blob = this.output('blob');
      blobUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error("PDF generation error, falling back to basic download:", err);
      return originalSave.apply(this, [finalFilename, options]);
    }

    const triggerNativeDownload = () => {
      try {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.warn("Direct blob download failed, falling back to original save method", e);
        originalSave.apply(this, [finalFilename, options]);
      }
    };

    // Use global callback to show popup modal, fallback to native download if app not yet ready
    if (typeof window !== 'undefined' && (window as any)._shiftsyncShowDownload) {
      (window as any)._shiftsyncShowDownload(finalFilename, blobUrl, triggerNativeDownload);
    } else {
      triggerNativeDownload();
    }

    return this;
  };
  (jsPDF.prototype as any).__isIntercepted = true;
}

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
