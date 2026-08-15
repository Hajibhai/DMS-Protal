import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Download, Upload, CheckSquare, Square, RefreshCw, 
  FileJson, CheckCircle2, AlertTriangle, Info, ShieldCheck, 
  Trash2, Layers, Search, FileText, Check, X, HardDrive, 
  Clock, UserCheck, Sparkles, ArrowRight, Save, History, FileSpreadsheet,
  Image, Receipt, Eye, FileArchive
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, orderBy, startAfter, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadExpenseBillsZip } from '../utils/zipExport';
import { RecycleBinItem } from '../types';
import { restoreFromRecycleBin, permanentlyDeleteFromRecycleBin, emptyRecycleBin } from '../services/storageService';

interface BackupModuleConfig {
  id: string;
  name: string;
  collectionName: string;
  category: 'HR & Staff' | 'Finance & Accounts' | 'Expenses & Cash' | 'Company & Assets' | 'Operations';
  icon: string;
  description: string;
}

const BACKUP_MODULES: BackupModuleConfig[] = [
  // HR & Staff
  { id: 'employees', name: 'Employees & Staff Profiles', collectionName: 'employees', category: 'HR & Staff', icon: 'UserCheck', description: 'Complete employee profiles, passports, codes, roles & images' },
  { id: 'engineer_documents', name: 'Engineer Documents & CVs', collectionName: 'engineer_documents', category: 'HR & Staff', icon: 'FileText', description: 'Engineering credentials, certificates & expiration dates' },
  { id: 'cicpa_records', name: 'CICPA Security Passes', collectionName: 'cicpa_records', category: 'HR & Staff', icon: 'ShieldCheck', description: 'CICPA pass numbers, project permissions & dates' },
  { id: 'safety_records', name: 'Safety Officer Passes', collectionName: 'safety_records', category: 'HR & Staff', icon: 'ShieldCheck', description: 'Site safety certifications & training records' },
  { id: 'job_offers', name: 'Job Offer Letters', collectionName: 'job_offers', category: 'HR & Staff', icon: 'FileText', description: 'Signed job offers, allowances & salary breakdowns' },
  { id: 'attendance', name: 'Attendance & Timesheets', collectionName: 'attendance', category: 'HR & Staff', icon: 'Clock', description: 'Daily attendance, check-ins, overtime & site logs' },
  { id: 'leaves', name: 'Leave Requests', collectionName: 'leaves', category: 'HR & Staff', icon: 'Clock', description: 'Approved, pending & rejected employee leave records' },
  { id: 'deductions', name: 'Salary Deductions & Advances', collectionName: 'deductions', category: 'HR & Staff', icon: 'FileText', description: 'Monthly payroll deductions, loan repayments & fines' },
  { id: 'holidays', name: 'Public Holidays Calendar', collectionName: 'holidays', category: 'HR & Staff', icon: 'Clock', description: 'Official corporate holidays & statutory non-working days' },

  // Finance & Accounts
  { id: 'accounts_payable', name: 'Accounts Payable (Invoices & Bills)', collectionName: 'accounts_payable', category: 'Finance & Accounts', icon: 'FileText', description: 'Supplier invoices, bill amounts, TRN numbers & payment status' },
  { id: 'accounts_receivable', name: 'Accounts Receivable (Invoices & Receipts)', collectionName: 'accounts_receivable', category: 'Finance & Accounts', icon: 'FileText', description: 'Client billing invoices, progress claims & receipts' },
  { id: 'projected_expenses', name: 'Projected Expenses & Budgets', collectionName: 'projected_expenses', category: 'Finance & Accounts', icon: 'FileText', description: 'Forecasted project expenditures & budget allocations' },
  { id: 'vouchers', name: 'Financial Vouchers', collectionName: 'vouchers', category: 'Finance & Accounts', icon: 'FileText', description: 'Payment vouchers, receipt vouchers & petty cash slips' },

  // Expenses & Cash
  { id: 'everyday_expenses', name: 'Everyday Expenses (Bills & Photos)', collectionName: 'everyday_expenses', category: 'Expenses & Cash', icon: 'FileText', description: 'Operational expense bills, full receipt photos & line items' },
  { id: 'petty_cash', name: 'Petty Cash Ledger & Books', collectionName: 'petty_cash', category: 'Expenses & Cash', icon: 'Database', description: 'Account-wise petty cash entries, cash advances & balances' },

  // Company & Assets
  { id: 'companies', name: 'Registered Companies', collectionName: 'companies', category: 'Company & Assets', icon: 'Layers', description: 'Trade licenses, establishments, TRN & corporate profiles' },
  { id: 'bank_accounts', name: 'Bank Accounts & Routing', collectionName: 'bank_accounts', category: 'Company & Assets', icon: 'Layers', description: 'Corporate bank details, IBANs, routing codes & WPS config' },
  { id: 'vehicles', name: 'Vehicles Fleet & Registration', collectionName: 'vehicles', category: 'Company & Assets', icon: 'Layers', description: 'Vehicle fleet details, Mulkiya registrations & insurance' },
  { id: 'camps', name: 'Camp Accommodations', collectionName: 'camps', category: 'Company & Assets', icon: 'Layers', description: 'Labor camp contracts, rental schedules & deposits' },

  // Operations
  { id: 'projects', name: 'Projects Directory', collectionName: 'projects', category: 'Operations', icon: 'Layers', description: 'Client project master records, locations & managers' },
  { id: 'vendors', name: 'Vendors Directory', collectionName: 'vendors', category: 'Operations', icon: 'Layers', description: 'Subcontractors, vendors, TRN & trade registration' },
  { id: 'suppliers', name: 'Suppliers Directory', collectionName: 'suppliers', category: 'Operations', icon: 'Layers', description: 'Material suppliers, contact persons & account terms' },
  { id: 'tasks', name: 'Tasks & Reminders', collectionName: 'tasks', category: 'Operations', icon: 'CheckSquare', description: 'System tasks, assignees, priorities & due dates' },
  { id: 'notes', name: 'System Notes & Memos', collectionName: 'notes', category: 'Operations', icon: 'FileText', description: 'Corporate notes, meeting minutes & operational memos' },
  { id: 'users', name: 'System Users & Roles', collectionName: 'users', category: 'Operations', icon: 'UserCheck', description: 'Portal access permissions, roles & system credentials' }
];

interface BackupRestoreViewProps {
  user?: any;
  everydayExpenses?: any[];
  onLogAction?: (action: string, details: string, type?: string) => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({ user, everydayExpenses, onLogAction }) => {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'import' | 'recycle' | 'history'>('export');
  
  // Recycle Bin State
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>([]);
  const [recycleSearch, setRecycleSearch] = useState<string>('');
  const [selectedRecycleSection, setSelectedRecycleSection] = useState<string>('All');
  const [isRestoringRecycleId, setIsRestoringRecycleId] = useState<string | null>(null);
  const [isDeletingRecycleId, setIsDeletingRecycleId] = useState<string | null>(null);

  // Real-time listener for Recycle Bin collection
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        collection(db, 'recycle_bin'),
        (snap) => {
          const items: RecycleBinItem[] = [];
          snap.forEach(docSnap => {
            items.push({ id: docSnap.id, ...docSnap.data() } as RecycleBinItem);
          });
          items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
          setRecycleBinItems(items);
        },
        (err) => {
          console.warn("Recycle bin listener note:", err?.message || err);
        }
      );
    } catch (err) {
      console.warn("Could not subscribe to recycle_bin:", err);
    }
    return () => {
      try {
        unsub();
      } catch (_) {}
    };
  }, []);

  const handleRestoreRecycleItem = async (item: RecycleBinItem) => {
    setIsRestoringRecycleId(item.id);
    try {
      await restoreFromRecycleBin(item);
      if (onLogAction) {
        onLogAction('Recycle Bin Record Restored', `Restored "${item.description || 'Record'}" (${item.section}) back to active database.`, 'update');
      }
      setNotificationMessage(`Successfully restored "${item.description || 'Record'}" back to ${item.section}!`);
      setTimeout(() => setNotificationMessage(null), 3000);
    } catch (err) {
      console.error("Restore error:", err);
    } finally {
      setIsRestoringRecycleId(null);
    }
  };

  const handleDeleteRecycleItem = async (item: RecycleBinItem) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete "${item.description || 'this record'}" from the Recycle Bin? This action cannot be undone.`)) {
      return;
    }
    setIsDeletingRecycleId(item.id);
    try {
      await permanentlyDeleteFromRecycleBin(item.id);
      if (onLogAction) {
        onLogAction('Recycle Bin Item Permanently Deleted', `Permanently purged record "${item.description}" from Recycle Bin.`, 'delete');
      }
      setNotificationMessage(`Permanently deleted record from Recycle Bin.`);
      setTimeout(() => setNotificationMessage(null), 3000);
    } catch (err) {
      console.error("Permanent delete error:", err);
    } finally {
      setIsDeletingRecycleId(null);
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (recycleBinItems.length === 0) return;
    if (!window.confirm(`Are you sure you want to PERMANENTLY EMPTY the entire Recycle Bin (${recycleBinItems.length} records)? All deleted records will be purged forever.`)) {
      return;
    }
    try {
      await emptyRecycleBin();
      if (onLogAction) {
        onLogAction('Recycle Bin Emptied', `Purged all ${recycleBinItems.length} items from Recycle Bin.`, 'delete');
      }
      setNotificationMessage(`Recycle Bin completely emptied.`);
      setTimeout(() => setNotificationMessage(null), 3000);
    } catch (err) {
      console.error("Empty recycle bin error:", err);
    }
  };

  const filteredRecycleItems = useMemo(() => {
    return recycleBinItems.filter(item => {
      // Section filter
      if (selectedRecycleSection !== 'All') {
        const itemSec = item.section || 'General';
        if (selectedRecycleSection === 'Expenses' && itemSec !== 'Expenses') return false;
        if (selectedRecycleSection === 'Petty Cash' && itemSec !== 'Petty Cash') return false;
        if (selectedRecycleSection === 'Accounts Payable' && itemSec !== 'Accounts Payable') return false;
        if (selectedRecycleSection === 'Accounts Receivable' && itemSec !== 'Accounts Receivable') return false;
        if (selectedRecycleSection === 'General' && itemSec !== 'General') return false;
      }
      // Search filter
      if (recycleSearch && recycleSearch.trim()) {
        const q = recycleSearch.toLowerCase().trim();
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchPerson = (item.personName || '').toLowerCase().includes(q);
        const matchRef = (item.reference || '').toLowerCase().includes(q);
        const matchBy = (item.deletedBy || '').toLowerCase().includes(q);
        return matchDesc || matchPerson || matchRef || matchBy;
      }
      return true;
    });
  }, [recycleBinItems, selectedRecycleSection, recycleSearch]);

  const recycleSectionCounts = useMemo(() => {
    const counts: { [key: string]: number } = {
      All: recycleBinItems.length,
      Expenses: 0,
      'Petty Cash': 0,
      'Accounts Payable': 0,
      'Accounts Receivable': 0,
      General: 0
    };
    recycleBinItems.forEach(item => {
      const sec = item.section || 'General';
      if (counts[sec] !== undefined) {
        counts[sec]++;
      } else {
        counts.General++;
      }
    });
    return counts;
  }, [recycleBinItems]);
  
  // Export State
  const [selectedExportModules, setSelectedExportModules] = useState<string[]>(BACKUP_MODULES.map(m => m.id));
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; label: string }>({ current: 0, total: 0, label: '' });
  const [liveCounts, setLiveCounts] = useState<{ [key: string]: number }>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(true);

  // Import / Restore State
  const [uploadedBackupData, setUploadedBackupData] = useState<any | null>(null);
  const [selectedRestoreModules, setSelectedRestoreModules] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreProgress, setRestoreProgress] = useState<{ current: number; total: number; label: string }>({ current: 0, total: 0, label: '' });
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
  const [restoreSuccessModal, setRestoreSuccessModal] = useState<boolean>(false);
  const [showConfirmRestoreModal, setShowConfirmRestoreModal] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [isBackupZipDownloading, setIsBackupZipDownloading] = useState<boolean>(false);
  const [backupZipProgressText, setBackupZipProgressText] = useState<string>('');

  const handleDownloadBackupBillsZip = async () => {
    if (!uploadedBackupData || !uploadedBackupData.data) {
      alert('No backup data loaded.');
      return;
    }

    const everydayExpenses = uploadedBackupData.data.everyday_expenses || [];
    const accountsPayable = uploadedBackupData.data.accounts_payable || [];
    const pettyCash = uploadedBackupData.data.petty_cash || [];

    const allExpensesToZip = [...everydayExpenses, ...accountsPayable, ...pettyCash];

    if (allExpensesToZip.length === 0) {
      alert('No expense bill entries found in this backup file.');
      return;
    }

    setIsBackupZipDownloading(true);
    setBackupZipProgressText('Packaging backup bill attachments...');

    const res = await downloadExpenseBillsZip(
      allExpensesToZip,
      `Backup_Expense_Bills_${new Date().toISOString().split('T')[0]}.zip`,
      (percent, text) => setBackupZipProgressText(`${percent}% - ${text}`)
    );

    setIsBackupZipDownloading(false);
    setBackupZipProgressText('');

    if (res.success) {
      setNotificationMessage(`Successfully downloaded ZIP with ${res.count} bill attachment files.`);
    } else {
      alert(res.error || 'Failed to generate ZIP archive.');
    }
  };

  // Local History
  const [backupHistory, setBackupHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pioneer_backup_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Compute Restore File Preview Statistics (Entries, Bills, Photos)
  const restorePreviewStats = useMemo(() => {
    if (!uploadedBackupData || !uploadedBackupData.data) {
      return { totalEntries: 0, totalBills: 0, totalPhotos: 0, moduleBreakdown: [] };
    }

    let totalEntries = 0;
    let totalBills = 0;
    let totalPhotos = 0;

    const moduleBreakdown: {
      id: string;
      name: string;
      collectionName: string;
      entries: number;
      bills: number;
      photos: number;
    }[] = [];

    BACKUP_MODULES.forEach(mod => {
      const items = uploadedBackupData.data[mod.collectionName];
      if (Array.isArray(items) && items.length > 0) {
        const entries = items.length;
        let bills = 0;
        let photos = 0;

        items.forEach((item: any) => {
          // Check for bill / invoice indicators
          const isBillCollection = [
            'everyday_expenses', 'accounts_payable', 'accounts_receivable', 'vouchers', 'petty_cash', 'purchase_orders'
          ].includes(mod.collectionName);

          const hasBillField = Boolean(
            item.invoiceNo || 
            item.invoiceNumber || 
            item.billNo || 
            item.billNumber || 
            item.billAmount || 
            item.totalAmount || 
            item.voucherNo ||
            item.poNo
          );

          if (isBillCollection || hasBillField) {
            bills++;
          }

          // Check for photos / attachment indicators
          let hasPhoto = Boolean(
            item.billPhoto || 
            item.receiptImage || 
            item.photo || 
            item.profileImage || 
            item.attachment || 
            item.documentUrl || 
            item.image || 
            item.fileUrl ||
            item.pasportCopy ||
            item.eidCopy ||
            item.licenseCopy ||
            item.mulkiyaPhoto
          );

          if (!hasPhoto && Array.isArray(item.attachments) && item.attachments.length > 0) {
            hasPhoto = true;
          }
          if (!hasPhoto && Array.isArray(item.photos) && item.photos.length > 0) {
            hasPhoto = true;
          }

          if (hasPhoto) {
            photos++;
          }
        });

        totalEntries += entries;
        totalBills += bills;
        totalPhotos += photos;

        moduleBreakdown.push({
          id: mod.id,
          name: mod.name,
          collectionName: mod.collectionName,
          entries,
          bills,
          photos
        });
      }
    });

    return { totalEntries, totalBills, totalPhotos, moduleBreakdown };
  }, [uploadedBackupData]);

  const selectedRestoreStats = useMemo(() => {
    if (!restorePreviewStats.moduleBreakdown) return { entries: 0, bills: 0, photos: 0 };
    return restorePreviewStats.moduleBreakdown
      .filter(m => selectedRestoreModules.includes(m.id))
      .reduce((acc, curr) => ({
        entries: acc.entries + curr.entries,
        bills: acc.bills + curr.bills,
        photos: acc.photos + curr.photos
      }), { entries: 0, bills: 0, photos: 0 });
  }, [restorePreviewStats, selectedRestoreModules]);

  // Helper to fetch collection docs in safe chunks
  const fetchCollectionItems = async (collectionName: string): Promise<any[]> => {
    if (collectionName === 'everyday_expenses' && everydayExpenses && everydayExpenses.length > 0) {
      return everydayExpenses;
    }

    const colRef = collection(db, collectionName);
    let allDocs: any[] = [];
    let lastDoc: any = null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 50) {
      pageCount++;
      try {
        const q = lastDoc
          ? query(colRef, orderBy('__name__'), startAfter(lastDoc), limit(30))
          : query(colRef, orderBy('__name__'), limit(30));

        const snap = await getDocs(q);
        if (snap.empty) {
          hasMore = false;
          break;
        }

        const chunk = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        allDocs = [...allDocs, ...chunk];

        if (snap.docs.length < 30) {
          hasMore = false;
        } else {
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      } catch (err) {
        console.warn(`Chunked query fallback for ${collectionName}:`, err);
        try {
          const directSnap = await getDocs(colRef);
          return directSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.error(`Failed to fetch collection ${collectionName}:`, e);
          return allDocs;
        }
      }
    }

    return allDocs;
  };

  // Fetch real-time document counts for each collection on load
  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      setIsLoadingCounts(true);
      const counts: { [key: string]: number } = {};

      for (const mod of BACKUP_MODULES) {
        if (mod.collectionName === 'everyday_expenses' && everydayExpenses && everydayExpenses.length > 0) {
          counts[mod.id] = everydayExpenses.length;
          continue;
        }

        try {
          const items = await fetchCollectionItems(mod.collectionName);
          counts[mod.id] = items.length;
        } catch {
          counts[mod.id] = 0;
        }
      }

      if (isMounted) {
        setLiveCounts(counts);
        setIsLoadingCounts(false);
      }
    };

    fetchCounts();
    return () => { isMounted = false; };
  }, [everydayExpenses]);

  const totalLiveRecords = Object.values(liveCounts).reduce((a, b) => a + b, 0);

  // Toggle selection for export
  const toggleExportModule = (id: string) => {
    setSelectedExportModules(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllExport = () => setSelectedExportModules(BACKUP_MODULES.map(m => m.id));
  const deselectAllExport = () => setSelectedExportModules([]);

  // Execute Backup Export
  const handleStartExport = async () => {
    if (selectedExportModules.length === 0) {
      alert('Please select at least one module/record category to backup.');
      return;
    }

    setIsExporting(true);
    setExportProgress({ current: 0, total: selectedExportModules.length, label: 'Initializing backup...' });

    const exportBundle: any = {
      metadata: {
        version: '5.0',
        system: 'Pioneer DMS Corporate Portal',
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email || user?.name || 'Administrator',
        totalModules: selectedExportModules.length,
        recordCounts: {}
      },
      data: {}
    };

    let processedCount = 0;
    let totalItemsDumped = 0;

    for (const modId of selectedExportModules) {
      const modConfig = BACKUP_MODULES.find(m => m.id === modId);
      if (!modConfig) continue;

      setExportProgress({ 
        current: processedCount + 1, 
        total: selectedExportModules.length, 
        label: `Extracting ${modConfig.name}...` 
      });

      try {
        const items = await fetchCollectionItems(modConfig.collectionName);

        exportBundle.data[modConfig.collectionName] = items;
        exportBundle.metadata.recordCounts[modConfig.id] = items.length;
        totalItemsDumped += items.length;
      } catch (err) {
        console.error(`Failed to export collection ${modConfig.collectionName}:`, err);
        exportBundle.data[modConfig.collectionName] = [];
        exportBundle.metadata.recordCounts[modConfig.id] = 0;
      }

      processedCount++;
    }

    exportBundle.metadata.totalRecords = totalItemsDumped;

    // Trigger download
    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const fileName = `pioneer_dms_full_backup_${dateStr}_${timeStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Record in local history
    const historyEntry = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'EXPORT',
      fileName,
      timestamp: new Date().toISOString(),
      by: user?.email || 'Admin',
      totalRecords: totalItemsDumped,
      modulesCount: selectedExportModules.length
    };

    const newHist = [historyEntry, ...backupHistory].slice(0, 20);
    setBackupHistory(newHist);
    localStorage.setItem('pioneer_backup_history', JSON.stringify(newHist));

    if (onLogAction) {
      onLogAction('System Data Backup Exported', `Backed up ${totalItemsDumped} records across ${selectedExportModules.length} categories to file ${fileName}.`, 'create');
    }

    setIsExporting(false);
  };

  // Handle File Upload for Restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || (!json.data && typeof json !== 'object')) {
          setNotificationMessage('Invalid backup file format. Expected JSON backup object containing data.');
          return;
        }

        setUploadedBackupData(json);
        
        // Auto-select modules that exist in the backup file
        const availableInFile: string[] = [];
        BACKUP_MODULES.forEach(mod => {
          if (json.data?.[mod.collectionName] && Array.isArray(json.data[mod.collectionName])) {
            availableInFile.push(mod.id);
          }
        });

        setSelectedRestoreModules(availableInFile);
        setRestoreLogs([`File loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Found ${availableInFile.length} valid data modules.`]);
        setNotificationMessage(`Successfully loaded backup file: ${file.name}`);
      } catch (err) {
        setNotificationMessage('Failed to parse JSON file. Please verify file integrity.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input element so re-uploading the same file works
  };

  // Remove entire loaded backup file preview
  const handleRemoveBackupPreview = () => {
    setUploadedBackupData(null);
    setSelectedRestoreModules([]);
    setRestoreLogs([]);
    setShowConfirmRestoreModal(false);
    setNotificationMessage('Backup file preview has been cleared.');
  };

  // Remove single module from restore preview
  const handleRemoveModuleFromPreview = (collectionName: string, modId: string) => {
    if (!uploadedBackupData || !uploadedBackupData.data) return;
    const updatedData = { ...uploadedBackupData.data };
    delete updatedData[collectionName];
    setUploadedBackupData({
      ...uploadedBackupData,
      data: updatedData
    });
    setSelectedRestoreModules(prev => prev.filter(x => x !== modId));
    setNotificationMessage('Module removed from restore preview.');
  };

  const toggleRestoreModule = (id: string) => {
    setSelectedRestoreModules(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Prompt Restore Confirmation Modal
  const handleStartRestore = () => {
    if (!uploadedBackupData || !uploadedBackupData.data) {
      setNotificationMessage('Please upload a valid backup JSON file first.');
      return;
    }

    if (selectedRestoreModules.length === 0) {
      setNotificationMessage('Please select at least one module to restore.');
      return;
    }

    setShowConfirmRestoreModal(true);
  };

  // Execute Restore Operation after confirmation
  const handleExecuteRestore = async () => {
    setShowConfirmRestoreModal(false);
    setIsRestoring(true);
    const newLogs: string[] = [`Starting restore process in [${restoreMode.toUpperCase()}] mode...`];
    setRestoreLogs(newLogs);

    let totalSuccessDocs = 0;
    let currentStep = 0;

    for (const modId of selectedRestoreModules) {
      const modConfig = BACKUP_MODULES.find(m => m.id === modId);
      if (!modConfig) continue;

      const items = uploadedBackupData.data[modConfig.collectionName];
      if (!Array.isArray(items) || items.length === 0) {
        newLogs.push(`Skipping ${modConfig.name}: No records in backup file.`);
        setRestoreLogs([...newLogs]);
        currentStep++;
        continue;
      }

      setRestoreProgress({
        current: currentStep + 1,
        total: selectedRestoreModules.length,
        label: `Restoring ${modConfig.name} (${items.length} entries)...`
      });

      try {
        // If overwrite mode, purge existing collection records first
        if (restoreMode === 'overwrite') {
          newLogs.push(`Purging existing records in ${modConfig.collectionName}...`);
          setRestoreLogs([...newLogs]);
          const existingSnap = await getDocs(collection(db, modConfig.collectionName));
          const deletePromises = existingSnap.docs.map(docSnap => deleteDoc(doc(db, modConfig.collectionName, docSnap.id)));
          await Promise.all(deletePromises);
        }

        // Write batch insertion
        newLogs.push(`Importing ${items.length} records into ${modConfig.collectionName}...`);
        setRestoreLogs([...newLogs]);

        // Process in chunks of 100 for Firestore batch safety
        const chunkSize = 100;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = writeBatch(db);

          chunk.forEach(item => {
            const docId = item.id || Math.random().toString(36).substring(2, 11);
            const cleanItem = { ...item };
            delete cleanItem.id; // remove id property from doc body before setting
            const docRef = doc(db, modConfig.collectionName, docId);
            batch.set(docRef, cleanItem, { merge: restoreMode === 'merge' });
          });

          await batch.commit();
        }

        totalSuccessDocs += items.length;
        newLogs.push(`✅ Successfully restored ${items.length} records to ${modConfig.name}.`);
        setRestoreLogs([...newLogs]);
      } catch (err: any) {
        console.error(`Error restoring module ${modConfig.name}:`, err);
        newLogs.push(`❌ Failed to restore ${modConfig.name}: ${err.message || String(err)}`);
        setRestoreLogs([...newLogs]);
      }

      currentStep++;
    }

    newLogs.push(`🎉 Restore operation completed! Total restored documents: ${totalSuccessDocs}.`);
    setRestoreLogs([...newLogs]);

    // Record in local history
    const historyEntry = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'RESTORE',
      fileName: 'Imported Backup File',
      timestamp: new Date().toISOString(),
      by: user?.email || 'Admin',
      totalRecords: totalSuccessDocs,
      modulesCount: selectedRestoreModules.length,
      mode: restoreMode
    };

    const newHist = [historyEntry, ...backupHistory].slice(0, 20);
    setBackupHistory(newHist);
    localStorage.setItem('pioneer_backup_history', JSON.stringify(newHist));

    if (onLogAction) {
      onLogAction('System Data Restored from Backup', `Restored ${totalSuccessDocs} documents across ${selectedRestoreModules.length} modules using [${restoreMode}] mode.`, 'update');
    }

    setIsRestoring(false);
    setRestoreSuccessModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {notificationMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg text-xs font-bold border border-slate-700/80"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
              <span>{notificationMessage}</span>
            </div>
            <button 
              onClick={() => setNotificationMessage(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full text-[11px] font-black uppercase tracking-wider">
              <Database className="w-3.5 h-3.5" /> Corporate Data Management
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Database Backup & Restore Center
            </h1>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Export high-fidelity JSON backups containing complete corporate records, bill receipts, attachments, employee profiles, and financial entries, or restore snapshot data securely into Firestore.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center gap-5 shrink-0 backdrop-blur-md">
            <div className="p-3 bg-brand-500/20 rounded-2xl text-brand-400">
              <HardDrive className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Live Records</span>
              <span className="text-2xl font-black text-white block mt-0.5">
                {isLoadingCounts ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-400 inline-block" />
                ) : (
                  totalLiveRecords.toLocaleString()
                )}
              </span>
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized with Firestore
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-2 mt-8 border-t border-slate-800/80 pt-6">
          <button
            onClick={() => setActiveSubTab('export')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-2.5 ${
              activeSubTab === 'export'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Download className="w-4 h-4" /> Backup Export
          </button>
          <button
            onClick={() => setActiveSubTab('import')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-2.5 ${
              activeSubTab === 'import'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Upload className="w-4 h-4" /> Restore Data
          </button>
          <button
            onClick={() => setActiveSubTab('recycle')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-2.5 ${
              activeSubTab === 'recycle'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Trash2 className="w-4 h-4 text-red-400" /> Recycle Bin
            {recycleBinItems.length > 0 && (
              <span className="bg-red-500/30 text-red-200 text-[10px] px-2 py-0.5 rounded-full font-black border border-red-400/30">
                {recycleBinItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-2.5 ${
              activeSubTab === 'history'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <History className="w-4 h-4" /> Activity History ({backupHistory.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: BACKUP EXPORT */}
      {activeSubTab === 'export' && (
        <div className="space-y-6">
          {/* Controls bar */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Download className="w-5 h-5 text-brand-600" /> Select Records to Backup
              </h2>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                Choose specific collections or perform a full system export.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={selectAllExport}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-brand-600" /> Select All ({BACKUP_MODULES.length})
              </button>
              <button
                onClick={deselectAllExport}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-4 h-4 text-slate-400" /> Deselect All
              </button>
              <button
                onClick={handleStartExport}
                disabled={isExporting || selectedExportModules.length === 0}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-brand-600/20 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Download Backup (.json)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress bar during export */}
          {isExporting && (
            <div className="bg-brand-50 border border-brand-200 p-6 rounded-3xl space-y-3 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-brand-900">
                <span>{exportProgress.label}</span>
                <span>{exportProgress.current} / {exportProgress.total} Modules</span>
              </div>
              <div className="w-full bg-brand-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-brand-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Grid of Backup Modules Grouped by Category */}
          {['HR & Staff', 'Finance & Accounts', 'Expenses & Cash', 'Company & Assets', 'Operations'].map((cat) => {
            const modulesInCat = BACKUP_MODULES.filter(m => m.category === cat);
            if (modulesInCat.length === 0) return null;

            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">
                  {cat} ({modulesInCat.length} Modules)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modulesInCat.map((mod) => {
                    const isSelected = selectedExportModules.includes(mod.id);
                    const count = liveCounts[mod.id] ?? 0;

                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleExportModule(mod.id)}
                        className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                          isSelected 
                            ? 'bg-white border-brand-500 shadow-md ring-2 ring-brand-500/10' 
                            : 'bg-white/60 border-slate-200/70 hover:border-slate-300 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl ${isSelected ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'}`}>
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 leading-snug">{mod.name}</h4>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Collection: {mod.collectionName}
                              </span>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          {mod.description}
                        </p>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-bold">Records In Database</span>
                          <span className={`font-black px-2.5 py-0.5 rounded-full text-[11px] ${
                            count > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {count.toLocaleString()} {count === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: RESTORE DATA */}
      {activeSubTab === 'import' && (
        <div className="space-y-6">
          {/* Upload File Dropzone */}
          <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] border-2 border-dashed border-slate-300 hover:border-brand-500 transition-all text-center space-y-4">
            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <FileJson className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">Upload Pioneer Backup File (.json)</h3>
              <p className="text-slate-500 text-xs font-medium max-w-md mx-auto">
                Select a previously downloaded system backup file to inspect entries and restore corporate records.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black tracking-wider transition-all shadow-md shadow-brand-600/20 cursor-pointer">
              <Upload className="w-4 h-4" /> Browse & Select JSON File
              <input 
                type="file" 
                accept=".json,application/json" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          </div>

          {/* If file is loaded */}
          {uploadedBackupData && (
            <div className="space-y-6">
              {/* File Summary & Metadata Banner */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200/80 shadow-xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-black text-[10px] uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Valid Backup Verified
                      </span>
                      <span>System Version: {uploadedBackupData.metadata?.version || '1.0'}</span>
                      <span>• Exported: {uploadedBackupData.metadata?.exportedAt ? new Date(uploadedBackupData.metadata.exportedAt).toLocaleString() : 'Unknown'}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <Eye className="w-5 h-5 text-brand-600" /> Restore Content Preview
                    </h3>
                    <p className="text-slate-500 text-xs font-medium">
                      File exported by: <strong className="text-slate-700">{uploadedBackupData.metadata?.exportedBy || 'System Admin'}</strong>
                    </p>
                  </div>

                  {/* Restore Mode Selector & Unload File Button */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">Restore Mode:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRestoreMode('merge')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            restoreMode === 'merge' ? 'bg-white text-brand-600 shadow-xs font-black border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          🔄 Merge & Update
                        </button>
                        <button
                          onClick={() => setRestoreMode('overwrite')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            restoreMode === 'overwrite' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          ⚠️ Overwrite Collection
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadBackupBillsZip}
                      disabled={isBackupZipDownloading}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                      title="Download ZIP archive containing all bill receipts & attachment photos in this backup file"
                    >
                      <FileArchive className="w-4 h-4 animate-bounce" />
                      <span>{isBackupZipDownloading ? (backupZipProgressText || 'Packaging ZIP...') : 'Download Bills ZIP'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveBackupPreview}
                      className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                      title="Clear loaded JSON file preview"
                    >
                      <Trash2 className="w-4 h-4" /> Clear Preview
                    </button>
                  </div>
                </div>

                {/* KPI Cards: Entries, Bills, Photos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Entries KPI */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white flex items-center gap-4 border border-slate-700/60 shadow-sm">
                    <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total File Entries</span>
                      <span className="text-2xl font-black text-white block mt-0.5">
                        {restorePreviewStats.totalEntries.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Database documents</span>
                    </div>
                  </div>

                  {/* Total Bills KPI */}
                  <div className="bg-gradient-to-br from-blue-900 to-slate-900 p-5 rounded-2xl text-white flex items-center gap-4 border border-blue-800/60 shadow-sm">
                    <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 block">Bills & Invoices</span>
                      <span className="text-2xl font-black text-white block mt-0.5">
                        {restorePreviewStats.totalBills.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-blue-300/80 font-medium">Expense receipts & vouchers</span>
                    </div>
                  </div>

                  {/* Total Photos KPI */}
                  <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-2xl text-white flex items-center gap-4 border border-indigo-800/60 shadow-sm">
                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                      <Image className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">Photos & Attachments</span>
                      <span className="text-2xl font-black text-white block mt-0.5">
                        {restorePreviewStats.totalPhotos.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-indigo-300/80 font-medium">Receipt photos & doc copies</span>
                    </div>
                  </div>
                </div>

                {/* Selected Restore Scope Summary Banner */}
                <div className="bg-brand-50/80 border border-brand-200/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-brand-900">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                    <span>
                      Selected Scope to Restore: <strong className="text-brand-700">{selectedRestoreStats.entries.toLocaleString()} Entries</strong>, <strong className="text-brand-700">{selectedRestoreStats.bills.toLocaleString()} Bills</strong> & <strong className="text-brand-700">{selectedRestoreStats.photos.toLocaleString()} Photos/Files</strong> across {selectedRestoreModules.length} modules.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedRestoreModules(restorePreviewStats.moduleBreakdown.map(m => m.id))}
                      className="px-2.5 py-1 bg-white hover:bg-brand-100 border border-brand-300 rounded-lg text-[11px] font-bold text-brand-700 transition-all cursor-pointer"
                    >
                      Select All ({restorePreviewStats.moduleBreakdown.length})
                    </button>
                    <button
                      onClick={() => setSelectedRestoreModules([])}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-600 transition-all cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>

              {/* Module Breakdown Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-600" /> Module Contents Breakdown
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                    <span>{selectedRestoreModules.length} of {restorePreviewStats.moduleBreakdown.length} modules active for restore</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BACKUP_MODULES.map((mod) => {
                    const breakdownItem = restorePreviewStats.moduleBreakdown.find(m => m.id === mod.id);
                    if (!breakdownItem || breakdownItem.entries === 0) return null;

                    const isSelected = selectedRestoreModules.includes(mod.id);

                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleRestoreModule(mod.id)}
                        className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                          isSelected 
                            ? 'bg-white border-brand-500 shadow-sm ring-2 ring-brand-500/10' 
                            : 'bg-white/60 border-slate-200/70 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl ${isSelected ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'}`}>
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900">{mod.name}</h4>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                {mod.collectionName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveModuleFromPreview(mod.collectionName, mod.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete/Remove this module from restore preview"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        </div>

                        {/* Content Stats Badges */}
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-black flex items-center gap-1.5">
                            <Database className="w-3 h-3 text-slate-500" />
                            {breakdownItem.entries.toLocaleString()} entries
                          </span>

                          {breakdownItem.bills > 0 && (
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[11px] font-black flex items-center gap-1.5">
                              <Receipt className="w-3 h-3 text-blue-600" />
                              {breakdownItem.bills.toLocaleString()} bills
                            </span>
                          )}

                          {breakdownItem.photos > 0 && (
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-black flex items-center gap-1.5">
                              <Image className="w-3 h-3 text-indigo-600" />
                              {breakdownItem.photos.toLocaleString()} photos
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Restore Action Button */}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleStartRestore}
                  disabled={isRestoring || selectedRestoreModules.length === 0}
                  className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black tracking-wider transition-all shadow-lg shadow-brand-600/30 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Restoring Records...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" /> Start Restore Process
                    </>
                  )}
                </button>
              </div>

              {/* Progress & Live Console Output */}
              {restoreLogs.length > 0 && (
                <div className="bg-slate-900 rounded-3xl p-6 text-slate-300 space-y-3 font-mono text-xs border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                    <span className="font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-400" /> Live Restore Log Console
                    </span>
                    {isRestoring && <span className="text-amber-400 animate-pulse font-bold">Processing...</span>}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-2 text-[11px] leading-relaxed">
                    {restoreLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-600 select-none">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ACTIVITY HISTORY */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Backup & Restore Activity Logs</h2>
              <p className="text-slate-500 text-xs font-medium mt-0.5">Recent system backup downloads and data restoration history.</p>
            </div>

            {backupHistory.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBackupHistory([]);
                  localStorage.removeItem('pioneer_backup_history');
                  setNotificationMessage('Activity logs cleared successfully.');
                }}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear History
              </button>
            )}
          </div>

          {backupHistory.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <p className="text-slate-500 text-xs font-medium">No recent backup or restore actions recorded.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {backupHistory.map((item) => (
                <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-2xl ${
                      item.type === 'EXPORT' ? 'bg-brand-50 text-brand-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {item.type === 'EXPORT' ? <Download className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {item.type === 'EXPORT' ? 'Backup Exported' : 'Data Restored'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {item.fileName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.totalRecords} records across {item.modulesCount} modules • Executed by {item.by}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-slate-400">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: RECYCLE BIN */}
      {activeSubTab === 'recycle' && (
        <div className="space-y-6">
          {/* Controls & Filter Header */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" /> Transaction Recycle Bin
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  View deleted transactions categorized section-wise. Restore records back to original accounts or purge permanently.
                </p>
              </div>

              {recycleBinItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleEmptyRecycleBin}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-2xs shrink-0 self-start sm:self-auto"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" /> Empty Recycle Bin ({recycleBinItems.length})
                </button>
              )}
            </div>

            {/* Section Selector Tabs & Search Box */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
              {/* Section Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'All', label: 'All Records', count: recycleSectionCounts.All },
                  { id: 'Expenses', label: 'Expenses', count: recycleSectionCounts.Expenses },
                  { id: 'Petty Cash', label: 'Petty Cash', count: recycleSectionCounts['Petty Cash'] },
                  { id: 'Accounts Payable', label: 'Accounts Payable', count: recycleSectionCounts['Accounts Payable'] },
                  { id: 'Accounts Receivable', label: 'Accounts Receivable', count: recycleSectionCounts['Accounts Receivable'] },
                  { id: 'General', label: 'General / Other', count: recycleSectionCounts.General },
                ].map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedRecycleSection(sec.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                      selectedRecycleSection === sec.id
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{sec.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                      selectedRecycleSection === sec.id
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {sec.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={recycleSearch}
                  onChange={(e) => setRecycleSearch(e.target.value)}
                  placeholder="Search deleted records, person, ref..."
                  className="w-full bg-slate-50 font-medium text-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all"
                />
                {recycleSearch && (
                  <button
                    onClick={() => setRecycleSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Items List / Grid */}
          {filteredRecycleItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-800">No Deleted Records Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {recycleSearch
                  ? `No records in "${selectedRecycleSection}" match your search query "${recycleSearch}".`
                  : `The Recycle Bin for section "${selectedRecycleSection}" is currently empty.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecycleItems.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                          item.section === 'Expenses'
                            ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                            : item.section === 'Petty Cash'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : item.section === 'Accounts Payable'
                            ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                            : item.section === 'Accounts Receivable'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {item.section || 'General'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Collection: {item.originalCollection}
                        </span>
                      </div>
                      {item.amount !== undefined && item.amount !== null && (
                        <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                          AED {Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm line-clamp-2">
                        {item.description || 'Deleted Record'}
                      </h4>
                      {item.personName && (
                        <p className="text-xs font-bold text-brand-600 mt-0.5 flex items-center gap-1">
                          <span>Person / Account:</span> {item.personName}
                        </p>
                      )}
                      {item.reference && (
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                          Ref / Voucher: <span className="font-mono text-slate-700">{item.reference}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span>Deleted by: <strong className="text-slate-600">{item.deletedBy || 'System User'}</strong></span>
                      <span>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Actions: Restore & Permanent Delete */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isRestoringRecycleId === item.id || isDeletingRecycleId === item.id}
                      onClick={() => handleRestoreRecycleItem(item)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRestoringRecycleId === item.id ? 'animate-spin' : ''}`} />
                      <span>{isRestoringRecycleId === item.id ? 'Restoring...' : 'Restore Record'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRestoringRecycleId === item.id || isDeletingRecycleId === item.id}
                      onClick={() => handleDeleteRecycleItem(item)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border border-slate-200 hover:border-rose-200"
                      title="Permanently Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFIRM RESTORE MODAL */}
      <AnimatePresence>
        {showConfirmRestoreModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Confirm Data Restoration</h3>
                <p className="text-slate-500 text-xs font-medium leading-relaxed">
                  {restoreMode === 'overwrite' ? (
                    <span className="text-rose-600 font-bold block">
                      ⚠️ OVERWRITE MODE IS ACTIVE: Existing records in {selectedRestoreModules.length} selected database collections will be PERMANENTLY ERASED and replaced with backup data.
                    </span>
                  ) : (
                    <span>
                      Merge Mode is active. Data for {selectedRestoreModules.length} selected modules will be safely updated and merged into Firestore.
                    </span>
                  )}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Selected Modules:</span>
                  <span className="text-brand-600 font-black">{selectedRestoreModules.length} Categories</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total Records to Restore:</span>
                  <span className="text-brand-600 font-black">{selectedRestoreStats.entries.toLocaleString()} Entries</span>
                </div>
                {selectedRestoreStats.bills > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Expense Bills:</span>
                    <span className="text-blue-600 font-black">{selectedRestoreStats.bills.toLocaleString()} Bills</span>
                  </div>
                )}
                {selectedRestoreStats.photos > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Photos & Documents:</span>
                    <span className="text-indigo-600 font-black">{selectedRestoreStats.photos.toLocaleString()} Attachments</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmRestoreModal(false)}
                  className="w-1/2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  className="w-1/2 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black tracking-wider transition-all shadow-md shadow-brand-600/30 cursor-pointer"
                >
                  Proceed & Restore
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS RESTORE MODAL */}
      <AnimatePresence>
        {restoreSuccessModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-100"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Restore Completed!</h3>
                <p className="text-slate-500 text-xs font-medium leading-relaxed">
                  Selected data modules have been successfully synchronized with the Firestore database.
                </p>
              </div>

              <button
                onClick={() => {
                  setRestoreSuccessModal(false);
                  window.location.reload(); // Refresh app state to display restored data everywhere
                }}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black tracking-wider shadow-md shadow-brand-600/20 cursor-pointer"
              >
                Reload Application View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
