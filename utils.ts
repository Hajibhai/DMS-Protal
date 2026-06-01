import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getPioneerPDFAssets = () => {
  const assets: { header?: string; watermark?: string; footer?: string } = {};

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return assets;
  }

  try {
    // ------------------- DRAW HEADER (1400 x 260) -------------------
    const canvasHeader = document.createElement('canvas');
    canvasHeader.width = 1400;
    canvasHeader.height = 260;
    const ctx = canvasHeader.getContext('2d');
    if (ctx) {
      // Background (clean white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1400, 260);

      // --- Draw Pioneer Logo Mark ---
      // Centers around (160, 130)
      const cx = 150, cy = 130, r = 75;

      // Draw Cogwheel Ring (Deep Corporate Blue)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#1e3a8a'; // Deep Corporate Blue
      ctx.beginPath();
      ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
      ctx.fill();

      // Cog teeth (16 teeth for a dense, high-quality gear appearance)
      const teeth = 16;
      for (let i = 0; i < teeth; i++) {
        ctx.rotate((Math.PI * 2) / teeth);
        ctx.fillRect(-12, -r - 5, 24, 25);
      }
      ctx.restore();

      // Inner white cutout to make it a hollow gear ring
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r - 22, 0, Math.PI * 2);
      ctx.fill();

      // Draw inside waves (Elegant curves representing flames/waves: Red, Green/Teal, Gold)
      // Green flame (Left side swoosh)
      ctx.fillStyle = '#059669'; // High-quality Emerald/Green
      ctx.beginPath();
      ctx.arc(cx - 8, cy, r - 28, Math.PI * 0.45, Math.PI * 1.55, false);
      ctx.arc(cx - 20, cy - 8, r - 50, Math.PI * 1.55, Math.PI * 0.45, true);
      ctx.closePath();
      ctx.fill();

      // Crimson Red flame (Right side swoosh)
      ctx.fillStyle = '#dc2626'; // Vibrant Red
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 4, r - 28, Math.PI * 1.45, Math.PI * 0.55, false);
      ctx.arc(cx + 2, cy + 2, r - 50, Math.PI * 0.55, Math.PI * 1.45, true);
      ctx.closePath();
      ctx.fill();

      // Gold core accent
      ctx.fillStyle = '#eab308'; // Amber/Gold
      ctx.beginPath();
      ctx.arc(cx + 4, cy + 22, r - 55, 0, Math.PI * 2);
      ctx.fill();

      // Center clear circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r - 58, 0, Math.PI * 2);
      ctx.fill();

      // --- Draw Company Title on Right of Logo ---
      // English Title: "PIONEER GENERAL CONTRACTING L.L.C" in bold crimson-red/slate
      ctx.fillStyle = '#a81c20'; // Pioneer Crimson Red
      ctx.font = 'bold 46px "Arial Black", "Helvetica Neue", sans-serif';
      ctx.fillText('PIONEER GENERAL CONTRACTING L.L.C', 260, 110);

      // Arabic Title: "بيونير المقاولات العامة ذ.م.م" in beautiful calligraphic-style typography
      ctx.fillStyle = '#1e3a8a'; // Corporate Dark Blue
      ctx.font = 'bold 42px "Arial", sans-serif';
      ctx.fillText('بيونير الـمـقـاولات الـعـامـة ذ.م.م', 270, 180);

      // Accent Red bottom rule
      ctx.strokeStyle = '#dc2626'; // Vivid Red
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(260, 205);
      ctx.lineTo(1350, 205);
      ctx.stroke();

      assets.header = canvasHeader.toDataURL('image/png');
    }

    // ------------------- DRAW WATERMARK (800 x 800) -------------------
    const canvasWatermark = document.createElement('canvas');
    canvasWatermark.width = 800;
    canvasWatermark.height = 800;
    const ctxW = canvasWatermark.getContext('2d');
    if (ctxW) {
      ctxW.clearRect(0, 0, 800, 800);

      const cx = 400, cy = 370, r = 240;

      // Draw Transparent Cogwheel (corporate blue ghost)
      ctxW.save();
      ctxW.globalAlpha = 0.05; // 5% opacity for elegant low contrast
      ctxW.translate(cx, cy);
      ctxW.fillStyle = '#1e3a8a';
      ctxW.beginPath();
      ctxW.arc(0, 0, r - 15, 0, Math.PI * 2);
      ctxW.fill();

      // Cog teeth
      const teeth = 16;
      for (let i = 0; i < teeth; i++) {
        ctxW.rotate((Math.PI * 2) / teeth);
        ctxW.fillRect(-20, -r - 10, 40, 45);
      }
      ctxW.restore();

      // Center clear circle
      ctxW.save();
      ctxW.globalAlpha = 0.05;
      ctxW.fillStyle = '#ffffff';
      ctxW.beginPath();
      ctxW.arc(cx, cy, r - 50, 0, Math.PI * 2);
      ctxW.fill();

      // Draw inside waves (red & green)
      ctxW.fillStyle = '#059669'; // Faint emerald
      ctxW.beginPath();
      ctxW.arc(cx - 20, cy, r - 60, Math.PI * 0.45, Math.PI * 1.55, false);
      ctxW.arc(cx - 40, cy - 15, r - 100, Math.PI * 1.55, Math.PI * 0.45, true);
      ctxW.closePath();
      ctxW.fill();

      ctxW.fillStyle = '#dc2626'; // Faint red
      ctxW.beginPath();
      ctxW.arc(cx + 30, cy - 8, r - 60, Math.PI * 1.45, Math.PI * 0.55, false);
      ctxW.arc(cx + 10, cy, r - 100, Math.PI * 0.55, Math.PI * 1.45, true);
      ctxW.closePath();
      ctxW.fill();

      ctxW.fillStyle = '#eab308'; // Faint gold
      ctxW.beginPath();
      ctxW.arc(cx + 8, cy + 50, r - 110, 0, Math.PI * 2);
      ctxW.fill();
      ctxW.restore();

      // Faint label "Pioneer" at the bottom of the watermark
      ctxW.save();
      ctxW.globalAlpha = 0.045;
      ctxW.fillStyle = '#1e3a8a';
      ctxW.font = 'bold 75px "Georgia", "Times New Roman", serif';
      ctxW.textAlign = 'center';
      ctxW.fillText('Pioneer', cx, 680);
      ctxW.restore();

      assets.watermark = canvasWatermark.toDataURL('image/png');
    }

    // ------------------- DRAW FOOTER (1400 x 220) -------------------
    const canvasFooter = document.createElement('canvas');
    canvasFooter.width = 1400;
    canvasFooter.height = 220;
    const ctxF = canvasFooter.getContext('2d');
    if (ctxF) {
      ctxF.fillStyle = '#ffffff';
      ctxF.fillRect(0, 0, 1400, 220);

      // Top slate rule
      ctxF.strokeStyle = '#cbd5e1'; // Slate 200
      ctxF.lineWidth = 3;
      ctxF.beginPath();
      ctxF.moveTo(50, 15);
      ctxF.lineTo(1350, 15);
      ctxF.stroke();

      // Faith statement
      ctxF.fillStyle = '#475569'; // Slate 600
      ctxF.font = 'italic 21px "Arial", sans-serif';
      ctxF.textAlign = 'center';
      ctxF.fillText('This letter is issued in good faith by Pioneer General Contracting LLC', 700, 45);

      // Address & Contact info line
      ctxF.fillStyle = '#1e3a8a'; // Deep Corporate Blue
      ctxF.font = 'bold 23px "Arial", sans-serif';
      ctxF.fillText('PO Box # 92986, Abu Dhabi, (UAE)   |   Tel: +971 2 677 8396   |   Mob: +971 56 227 4730', 700, 85);

      // ISO Seals & Industry Logos on Right (x = 900 to 1250)
      const drawStampF = (x: number, title: string, subtitle: string, color: string) => {
        ctxF.save();
        ctxF.strokeStyle = color;
        ctxF.lineWidth = 2.5;
        // Oval outer
        ctxF.beginPath();
        ctxF.ellipse(x, 150, 42, 28, 0, 0, Math.PI * 2);
        ctxF.stroke();
        // Oval inner
        ctxF.beginPath();
        ctxF.ellipse(x, 150, 36, 23, 0, 0, Math.PI * 2);
        ctxF.stroke();
        // Titles
        ctxF.fillStyle = color;
        ctxF.font = 'bold 11px "Arial Black", sans-serif';
        ctxF.textAlign = 'center';
        ctxF.fillText(title, x, 145);
        ctxF.font = 'bold 9px "Arial", sans-serif';
        ctxF.fillText(subtitle, x, 158);
        ctxF.restore();
      };

      drawStampF(920, 'ISO 9001', 'QUALITY', '#b45309'); // Amber
      drawStampF(1015, 'ISO 14001', 'ENVIRONMENT', '#15803d'); // Green
      drawStampF(1110, 'OHSAS 18001', 'SAFETY', '#1e3a8a'); // Navy

      // Draw Golden Star Achievement Emblem
      ctxF.save();
      const sx = 800, sy = 150;
      ctxF.strokeStyle = '#d97706'; // Gold Border
      ctxF.fillStyle = '#fef08a'; // Light yellow
      ctxF.lineWidth = 2.5;
      ctxF.beginPath();
      ctxF.arc(sx, sy, 25, 0, Math.PI * 2);
      ctxF.fill();
      ctxF.stroke();
      ctxF.fillStyle = '#d97706';
      ctxF.font = 'bold 16px "Arial", sans-serif';
      ctxF.textAlign = 'center';
      ctxF.fillText('★★★', sx, sy + 5);
      ctxF.restore();

      // UAE ICV (In-Country Value) Certified Stamp
      ctxF.save();
      const ix = 1240, iy = 150;
      // Draw outer circle
      ctxF.strokeStyle = '#df253a'; // ICV Red
      ctxF.lineWidth = 2.5;
      ctxF.beginPath();
      ctxF.arc(ix, iy, 28, 0, Math.PI * 2);
      ctxF.stroke();

      // Dynamic checkmark inside the circle
      ctxF.strokeStyle = '#15803d'; // Emerald green
      ctxF.lineWidth = 3.5;
      ctxF.beginPath();
      ctxF.moveTo(ix - 12, iy + 2);
      ctxF.lineTo(ix - 2, iy + 12);
      ctxF.lineTo(ix + 14, iy - 10);
      ctxF.stroke();

      ctxF.fillStyle = '#1e3a8a';
      ctxF.font = 'bold 10px "Arial Black", sans-serif';
      ctxF.textAlign = 'center';
      ctxF.fillText('ICV', ix, iy + 22);
      ctxF.restore();

      assets.footer = canvasFooter.toDataURL('image/png');
    }
  } catch (error) {
    console.error('Error generating asset graphics on Canvas:', error);
  }

  return assets;
};

export const applyPioneerLetterheadDoc = (doc: any, pageCount: number = 1) => {
  const assets = getPioneerPDFAssets();
  const width = doc.internal.pageSize.getWidth(); // A4 width: 210mm
  const height = doc.internal.pageSize.getHeight(); // A4 height: 297mm

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // 1. Watermark centered in background
    if (assets.watermark) {
      const wSize = 145; // 145mm wide
      const wx = (width - wSize) / 2;
      const wy = (height - wSize) / 2;
      doc.addImage(assets.watermark, 'PNG', wx, wy, wSize, wSize, undefined, 'FAST');
    }

    // 2. Letterhead top banner
    if (assets.header) {
      const hHeight = width * (260 / 1400); // maintain aspect ratio
      doc.addImage(assets.header, 'PNG', 0, 0, width, hHeight, undefined, 'FAST');
    }

    // 3. Footer bottom badge
    if (assets.footer) {
      const fHeight = 26; // 26mm bottom margin
      doc.addImage(assets.footer, 'PNG', 0, height - fHeight, width, fHeight, undefined, 'FAST');
    }
  }
};
