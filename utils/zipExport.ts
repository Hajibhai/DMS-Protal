import JSZip from 'jszip';
import { EverydayExpense } from '../types';

/**
 * Downloads a ZIP archive containing all bill receipt attachments and a summary CSV
 * for the provided Everyday Expense records.
 */
export async function downloadExpenseBillsZip(
  expenses: EverydayExpense[],
  zipFilename: string = 'Everyday_Expense_Bills.zip',
  onProgress?: (percent: number, statusText: string) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!expenses || expenses.length === 0) {
      if (onProgress) onProgress(0, 'No expenses selected to export.');
      return { success: false, count: 0, error: 'No expenses available to download.' };
    }

    if (onProgress) onProgress(5, 'Initializing ZIP archive...');
    const zip = new JSZip();
    const folder = zip.folder("bills_and_receipts");

    const manifestData: any[] = [];
    let totalAttachmentsFound = 0;
    let totalFilesAdded = 0;

    // Collect all attachment tasks
    const tasks: Array<{
      item: EverydayExpense;
      attUrl: string;
      aIdx: number;
      safeInvoice: string;
      safeSupplier: string;
      dateStr: string;
    }> = [];

    expenses.forEach((item, index) => {
      const itemAttachments: string[] = [];
      if (item.attachment && item.attachment.trim()) {
        itemAttachments.push(item.attachment.trim());
      }
      if (Array.isArray(item.attachments)) {
        item.attachments.forEach(att => {
          if (att && att.trim() && !itemAttachments.includes(att.trim())) {
            itemAttachments.push(att.trim());
          }
        });
      }

      totalAttachmentsFound += itemAttachments.length;

      manifestData.push({
        "SI No": item.siNo || (index + 1),
        "Date": item.date || '',
        "Invoice No": item.invoiceNo || '',
        "TRN No": item.trnNo || '',
        "Client Name": item.clientName || '',
        "Supplier Name": item.supplierName || item.shopName || '',
        "Shop Name": item.shopName || '',
        "Bill Amount (AED)": item.billAmount || 0,
        "VAT Amount (AED)": item.vatAmount || 0,
        "Total Amount (AED)": item.totalAmount || item.billAmount || 0,
        "Description": item.description || '',
        "Category": item.category || '',
        "Uploaded By": item.uploadedBy || '',
        "Attachments Count": itemAttachments.length
      });

      const safeInvoice = (item.invoiceNo || `bill_${item.siNo || index + 1}`).replace(/[/\\?%*:|"<>]/g, '_');
      const safeSupplier = (item.supplierName || item.shopName || 'supplier').replace(/[/\\?%*:|"<>]/g, '_');
      const dateStr = item.date ? item.date.replace(/[/\\?%*:|"<>]/g, '-') : 'nodate';

      itemAttachments.forEach((attUrl, aIdx) => {
        tasks.push({
          item,
          attUrl,
          aIdx,
          safeInvoice,
          safeSupplier,
          dateStr
        });
      });
    });

    if (tasks.length === 0) {
      if (onProgress) onProgress(30, 'No bill image attachments found in the selected expenses, creating manifest summary...');
    }

    // Process file attachments
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const progressPercent = Math.min(85, Math.round(10 + ((i + 1) / tasks.length) * 75));
      if (onProgress) {
        onProgress(progressPercent, `Packaging bill ${i + 1} of ${tasks.length} (${task.safeSupplier})...`);
      }

      const { attUrl, aIdx, safeInvoice, safeSupplier, dateStr } = task;

      if (attUrl.startsWith('data:')) {
        // Base64 Data URI
        const matches = attUrl.match(/^data:(.+?);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1].toLowerCase();
          const base64Data = matches[2];
          let ext = 'jpg';
          if (mimeType.includes('pdf')) ext = 'pdf';
          else if (mimeType.includes('png')) ext = 'png';
          else if (mimeType.includes('webp')) ext = 'webp';
          else if (mimeType.includes('svg')) ext = 'svg';
          else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';

          const fileName = `${dateStr}_${safeSupplier}_${safeInvoice}_att${aIdx + 1}.${ext}`;
          folder?.file(fileName, base64Data, { base64: true });
          totalFilesAdded++;
        }
      } else if (attUrl.startsWith('http://') || attUrl.startsWith('https://') || attUrl.startsWith('blob:')) {
        try {
          const resp = await fetch(attUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const arrayBuffer = await blob.arrayBuffer();
            let ext = 'jpg';
            const mimeType = blob.type.toLowerCase();
            if (mimeType.includes('pdf') || attUrl.endsWith('.pdf')) ext = 'pdf';
            else if (mimeType.includes('png') || attUrl.endsWith('.png')) ext = 'png';
            else if (mimeType.includes('webp') || attUrl.endsWith('.webp')) ext = 'webp';

            const fileName = `${dateStr}_${safeSupplier}_${safeInvoice}_att${aIdx + 1}.${ext}`;
            folder?.file(fileName, arrayBuffer);
            totalFilesAdded++;
          }
        } catch (err) {
          console.warn('Failed to fetch remote receipt file:', attUrl, err);
        }
      }
    }

    // Add Summary CSV
    if (manifestData.length > 0) {
      if (onProgress) onProgress(90, 'Generating Expense Summary CSV manifest...');
      const headers = Object.keys(manifestData[0]).join(',');
      const rows = manifestData.map(row =>
        Object.values(row).map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      zip.file('Expense_Bills_Summary.csv', `${headers}\n${rows}`);
    }

    if (onProgress) onProgress(95, 'Compressing ZIP file...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Trigger browser file download
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (onProgress) onProgress(100, `ZIP downloaded! Packed ${totalFilesAdded} bill files & summary.`);

    return { success: true, count: totalFilesAdded };
  } catch (error: any) {
    console.error('Error generating expense bills ZIP:', error);
    if (onProgress) onProgress(0, `Download failed: ${error?.message || 'Unknown error'}`);
    return { success: false, count: 0, error: error?.message || 'Failed to generate ZIP archive.' };
  }
}
