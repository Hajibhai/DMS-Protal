import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Plus, Search, Edit2, Trash2, Eye, EyeOff, 
  ExternalLink, Share2, Printer, Download, Lock, Unlock, 
  Copy, Check, X, ShieldAlert, Key, HelpCircle
} from 'lucide-react';
import { collection, onSnapshot, query, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';

interface PasswordRecord {
  id: string;
  appName: string;
  websiteLink: string;
  username: string;
  password?: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

interface PasswordManagerViewProps {
  user: any;
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export const PasswordManagerView: React.FC<PasswordManagerViewProps> = ({ user, openConfirm }) => {
  const [records, setRecords] = useState<PasswordRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PasswordRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    appName: '',
    websiteLink: '',
    username: '',
    password: '',
    notes: ''
  });

  // Secret Code verification states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState<{
    type: 'view_password' | 'edit' | 'delete' | 'export' | 'print';
    recordId?: string;
    callback?: () => void;
  } | null>(null);

  // Revealed passwords state (map of recordId -> boolean)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Check if secret code is configured in user profile
  const isSecretCodeSet = !!user?.secretCode;

  // Load records on mount
  useEffect(() => {
    const q = query(collection(db, 'password_records'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: PasswordRecord[] = [];
      snapshot.forEach((docSnap) => {
        loaded.push({
          id: docSnap.id,
          ...docSnap.data()
        } as PasswordRecord);
      });
      // Sort alphabetically by appName
      loaded.sort((a, b) => (a.appName || '').localeCompare(b.appName || ''));
      setRecords(loaded);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading password records:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter(rec => 
      (rec.appName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [records, searchTerm]);

  // Handle PIN input button click
  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + digit);
      setPinError('');
    }
  };

  const handlePinBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinInput('');
  };

  // Submit and verify PIN
  const handlePinSubmit = () => {
    if (!user?.secretCode) {
      setPinError('No secret code set. Please configure under My Profile.');
      return;
    }

    if (pinInput === user.secretCode) {
      // Correct!
      const action = pendingAction;
      setShowPinModal(false);
      setPinInput('');
      setPendingAction(null);

      if (action) {
        if (action.callback) {
          action.callback();
        } else if (action.type === 'view_password' && action.recordId) {
          setRevealedPasswords(prev => ({
            ...prev,
            [action.recordId!]: !prev[action.recordId!]
          }));
        } else if (action.type === 'edit' && action.recordId) {
          const rec = records.find(r => r.id === action.recordId);
          if (rec) {
            setEditingRecord(rec);
            setFormData({
              appName: rec.appName || '',
              websiteLink: rec.websiteLink || '',
              username: rec.username || '',
              password: rec.password || '',
              notes: rec.notes || ''
            });
            setIsFormOpen(true);
          }
        } else if (action.type === 'delete' && action.recordId) {
          executeDelete(action.recordId);
        }
      }
    } else {
      setPinError('Incorrect 4-digit code. Please try again.');
      setPinInput('');
    }
  };

  // Trigger PIN verification modal
  const triggerPinVerification = (
    type: 'view_password' | 'edit' | 'delete' | 'export' | 'print', 
    recordId?: string, 
    callback?: () => void
  ) => {
    if (!isSecretCodeSet) {
      showToast('Please set your 4-digit Secret Code under My Profile first.', 'error');
      return;
    }
    setPendingAction({ type, recordId, callback });
    setPinInput('');
    setPinError('');
    setShowPinModal(true);
  };

  // Add / Edit submission
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.appName || !formData.username || !formData.password) {
      showToast('Please fill in App Name, Username and Password', 'error');
      return;
    }

    try {
      const cleanLink = formData.websiteLink.trim() && !/^https?:\/\//i.test(formData.websiteLink) 
        ? `https://${formData.websiteLink.trim()}` 
        : formData.websiteLink.trim();

      if (editingRecord) {
        // Update
        const ref = doc(db, 'password_records', editingRecord.id);
        await updateDoc(ref, {
          appName: formData.appName.trim(),
          websiteLink: cleanLink,
          username: formData.username.trim(),
          password: formData.password,
          notes: formData.notes.trim(),
          updatedAt: new Date().toISOString()
        });
        showToast('Password record updated successfully');
      } else {
        // Create
        await addDoc(collection(db, 'password_records'), {
          appName: formData.appName.trim(),
          websiteLink: cleanLink,
          username: formData.username.trim(),
          password: formData.password,
          notes: formData.notes.trim(),
          createdAt: new Date().toISOString(),
          createdBy: user.email
        });
        showToast('Password record saved successfully');
      }

      // Close and clear
      setIsFormOpen(false);
      setEditingRecord(null);
      setFormData({
        appName: '',
        websiteLink: '',
        username: '',
        password: '',
        notes: ''
      });
    } catch (err: any) {
      console.error("Error saving password record:", err);
      showToast(`Failed to save record: ${err?.message || err}`, 'error');
    }
  };

  const executeDelete = (id: string) => {
    const rec = records.find(r => r.id === id);
    if (!rec) return;

    openConfirm(
      'Delete Password Record',
      `Are you sure you want to permanently delete the password details for "${rec.appName}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'password_records', id));
          showToast('Record deleted successfully');
        } catch (err: any) {
          console.error("Error deleting record:", err);
          showToast(`Failed to delete record: ${err?.message || err}`, 'error');
        }
      }
    );
  };

  // Copy to clipboard formatted
  const handleShare = async (rec: PasswordRecord) => {
    const textToShare = `Account Details:
App/Website: ${rec.appName}
Link: ${rec.websiteLink || 'None'}
Username: ${rec.username}
Password: ${rec.password || '••••••••'}
Remarks: ${rec.notes || 'None'}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Account: ${rec.appName}`,
          text: textToShare
        });
        showToast('Shared successfully!');
      } catch (err) {
        // Fallback copy
        await navigator.clipboard.writeText(textToShare);
        showToast('Details copied to clipboard to share!');
      }
    } else {
      await navigator.clipboard.writeText(textToShare);
      showToast('Details copied to clipboard to share!');
    }
  };

  // Print Details
  const handlePrint = (rec?: PasswordRecord) => {
    const printContent = rec 
      ? `
        <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="margin-top: 0; color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 12px;">Pioneer DMS - Password Record</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #64748b; width: 150px;">App / Website:</td>
              <td style="padding: 10px 0; font-weight: bold; color: #0f172a;">${rec.appName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Website Link:</td>
              <td style="padding: 10px 0; color: #3b82f6;">${rec.websiteLink || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Username:</td>
              <td style="padding: 10px 0; color: #0f172a;">${rec.username}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Password:</td>
              <td style="padding: 10px 0; font-family: monospace; font-size: 14px; color: #0f172a;">${rec.password || '••••••••'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #64748b; vertical-align: top;">Notes / Remarks:</td>
              <td style="padding: 10px 0; color: #334155; white-space: pre-wrap;">${rec.notes || '-'}</td>
            </tr>
          </table>
          <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Confidential document printed by Pioneer DMS Admin on ${new Date().toLocaleString()}
          </div>
        </div>
      `
      : `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">Pioneer DMS - Credentials Directory</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #475569;">Website / App</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #475569;">URL Link</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #475569;">Username</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #475569;">Password</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #475569;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px; font-size: 12px; font-weight: bold; color: #0f172a;">${r.appName}</td>
                  <td style="padding: 12px; font-size: 12px; color: #3b82f6;">${r.websiteLink || '-'}</td>
                  <td style="padding: 12px; font-size: 12px; color: #334155;">${r.username}</td>
                  <td style="padding: 12px; font-size: 12px; font-family: monospace;">${r.password || '••••••••'}</td>
                  <td style="padding: 12px; font-size: 12px; color: #64748b;">${r.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Confidential credentials directory printed by Pioneer DMS Admin on ${new Date().toLocaleString()}
          </div>
        </div>
      `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Credentials</title>
            <style>@page { size: auto; margin: 20mm; }</style>
          </head>
          <body onload="window.print(); window.close();">
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((rec, idx) => ({
      'Sl No': idx + 1,
      'Website / App Name': rec.appName,
      'Website URL': rec.websiteLink || '-',
      'Username / Email': rec.username,
      'Password': rec.password || '',
      'Notes / Remarks': rec.notes || '-',
      'Created By': rec.createdBy || '-',
      'Created Date': rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Passwords Directory");
    XLSX.writeFile(wb, `Pioneer_Credentials_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Exported successfully to Excel!');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 right-6 z-[200] px-6 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2.5 ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-rose-600" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Credentials & Passwords Manager</h2>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Secure Administrative Vault</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => triggerPinVerification('export', undefined, handleExportExcel)}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Export credentials to Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>

          <button
            onClick={() => triggerPinVerification('print', undefined, () => handlePrint())}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Print entire directory"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print Directory
          </button>

          <button
            onClick={() => {
              if (!isSecretCodeSet) {
                showToast('Please set your 4-digit Secret Code under My Profile first.', 'error');
              } else {
                setEditingRecord(null);
                setFormData({
                  appName: '',
                  websiteLink: '',
                  username: '',
                  password: '',
                  notes: ''
                });
                setIsFormOpen(true);
              }
            }}
            className="px-5 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-brand-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Credentials
          </button>
        </div>
      </div>

      {/* Security Status Card */}
      {!isSecretCodeSet && (
        <div className="bg-amber-50 border border-amber-200 rounded-[1.5rem] p-5 flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-black text-amber-900 text-sm">Action Required: Setup Secret Code</h4>
            <p className="text-amber-800 text-xs font-medium leading-relaxed">
              To view, edit, or delete credentials, you must first create a **4-digit numeric Secret Code** inside **My Profile** (click your user portrait in the top right, choose My Profile).
            </p>
          </div>
        </div>
      )}

      {/* Main Listing Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/40">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search website name, URL, username, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400 text-slate-800"
            />
          </div>
          <div className="text-xs font-bold text-slate-400">
            Showing {filteredRecords.length} of {records.length} accounts
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto"></div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading secure data vault...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 border border-dashed border-slate-200">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-800 text-base">No credentials found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              {searchTerm ? 'No results matched your search term.' : 'Click "Add Credentials" to populate secure directory details.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/55 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                  <th className="px-6 py-4.5">Sl</th>
                  <th className="px-6 py-4.5">Website / App Name</th>
                  <th className="px-6 py-4.5">Website Link</th>
                  <th className="px-6 py-4.5">Username / Email</th>
                  <th className="px-6 py-4.5">Secure Password</th>
                  <th className="px-6 py-4.5">Notes / Remarks</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec, index) => {
                  const isRevealed = !!revealedPasswords[rec.id];
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/30 transition-all text-xs text-slate-700">
                      <td className="px-6 py-4 font-mono font-bold text-slate-400">{index + 1}</td>
                      
                      <td className="px-6 py-4 font-black text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"></span>
                          {rec.appName}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {rec.websiteLink ? (
                          <a 
                            href={rec.websiteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Visit Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">No link</span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-800">{rec.username}</td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold tracking-wider text-slate-800 min-w-[70px]">
                            {isRevealed ? rec.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => {
                              if (isRevealed) {
                                // Toggle back off
                                setRevealedPasswords(prev => ({ ...prev, [rec.id]: false }));
                              } else {
                                // Pin trigger
                                triggerPinVerification('view_password', rec.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-brand-650 transition-colors hover:bg-slate-100 rounded-lg"
                            title={isRevealed ? 'Mask Password' : 'Reveal Password'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={rec.notes}>
                        {rec.notes || <span className="text-slate-300 italic">-</span>}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleShare(rec)}
                            className="p-1.5 hover:bg-brand-50 text-slate-500 hover:text-brand-650 rounded-xl transition-all cursor-pointer"
                            title="Share as text format"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => triggerPinVerification('print', undefined, () => handlePrint(rec))}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
                            title="Print details"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => triggerPinVerification('edit', rec.id)}
                            className="p-1.5 hover:bg-slate-100 text-indigo-600 hover:text-indigo-850 rounded-xl transition-all cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => triggerPinVerification('delete', rec.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-850 rounded-xl transition-all cursor-pointer"
                            title="Delete details"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog: Add / Edit Record */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {editingRecord ? 'Modify Credentials' : 'Add New Credentials'}
                  </h3>
                  <p className="text-slate-500 text-xs font-semibold">Keep sensitive login data organized securely</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitRecord} className="p-6 md:p-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Website / App Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., ADJD Portal, Etisalat, Zoom"
                    value={formData.appName}
                    onChange={(e) => setFormData(prev => ({ ...prev, appName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Website URL / Link (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., login.etisalat.ae"
                    value={formData.websiteLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, websiteLink: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username / Email *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., admin@pioneer.ae"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password *</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter security password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes / Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="e.g., Expired date warnings, department constraints, security keys"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-none text-slate-800"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-black text-xs hover:bg-brand-700 shadow-md active:scale-95 transition-all"
                  >
                    {editingRecord ? 'Save Changes' : 'Save Credentials'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Verification Pad Modal */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 md:p-8 space-y-6 text-white"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-slate-800 text-brand-400 rounded-full flex items-center justify-center mx-auto shadow-inner border border-slate-700">
                  <Lock className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-xl font-black tracking-tight">Security Code Verification</h3>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed px-4">
                  This action is highly protected. Enter your 4-digit secret code to proceed.
                </p>
              </div>

              {/* Dot Indicators */}
              <div className="flex justify-center items-center gap-4 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4.5 h-4.5 rounded-full transition-all duration-200 ${
                      pinInput.length > idx 
                        ? 'bg-brand-500 scale-110 shadow-lg shadow-brand-500/40' 
                        : 'bg-slate-700 border border-slate-600'
                    }`}
                  ></div>
                ))}
              </div>

              {/* Error messages */}
              {pinError && (
                <div className="text-rose-400 text-xs font-bold text-center bg-rose-950/40 border border-rose-900/40 py-2 rounded-xl animate-shake">
                  {pinError}
                </div>
              )}

              {/* PIN Keyboard */}
              <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigit(digit)}
                    className="w-16 h-16 bg-slate-800 hover:bg-slate-700 text-xl font-black rounded-full flex items-center justify-center transition-all border border-slate-750 hover:scale-105 active:scale-95 shadow-sm"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="w-16 h-16 text-slate-400 hover:text-white text-xs font-black rounded-full flex items-center justify-center transition-all hover:bg-slate-800"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  className="w-16 h-16 bg-slate-800 hover:bg-slate-700 text-xl font-black rounded-full flex items-center justify-center transition-all border border-slate-750 hover:scale-105 active:scale-95 shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="w-16 h-16 text-slate-400 hover:text-white text-xs font-black rounded-full flex items-center justify-center transition-all hover:bg-slate-800"
                >
                  DELETE
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPendingAction(null);
                  }}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pinInput.length !== 4}
                  onClick={handlePinSubmit}
                  className="w-1/2 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 text-white font-black text-xs rounded-2xl transition-all shadow-lg shadow-brand-600/10 active:scale-95 flex items-center justify-center gap-1"
                >
                  <Unlock className="w-3.5 h-3.5" /> Submit PIN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
