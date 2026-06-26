import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Eye, Edit, Trash2, Download, Car, Calendar, 
  FileText, Shield, Sparkles, Paperclip, Upload, X, ShieldAlert, 
  CheckCircle, AlertCircle, Wrench, RefreshCw, FileCheck, TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Vehicle, VehicleDocument, EverydayExpense } from '../types';

interface VehiclesViewProps {
  vehicles: Vehicle[];
  everydayExpenses?: EverydayExpense[];
  onSave: (data: Vehicle) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  user: any;
  initialSearchTerm?: string;
}

export const VehiclesView = ({ 
  vehicles = [], 
  everydayExpenses = [],
  onSave, 
  onDelete, 
  user, 
  initialSearchTerm = '' 
}: VehiclesViewProps) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showModal, setShowModal] = useState<Partial<Vehicle> | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'Active' | 'Under Maintenance' | 'Inactive' | 'expiring'>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'Company' | 'Personal' | 'Other'>('all');
  const [showExpensesModal, setShowExpensesModal] = useState<{ vehicle: Vehicle; expenses: EverydayExpense[] } | null>(null);
  const [viewingExpenseBill, setViewingExpenseBill] = useState<EverydayExpense | null>(null);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<EverydayExpense | null>(null);
  
  // Document upload state inside Add/Edit modal
  const [newDocCategory, setNewDocCategory] = useState<'Registration' | 'Insurance' | 'Inspection' | 'Other'>('Registration');
  const [newDocName, setNewDocName] = useState('');
  const [newDocFile, setNewDocFile] = useState<string | null>(null);
  const [newDocFileType, setNewDocFileType] = useState('');
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

  // Sync initial search term
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const canManage = user?.permissions?.canManageProjects || 
                    user?.role?.toLowerCase() === 'creator' || 
                    user?.role?.toLowerCase() === 'admin' || 
                    user?.email === 'abdulkaderp3010@gmail.com';

  const getDaysLeft = (dateStr?: string) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Helper to determine vehicle overall expiration warnings
  const getVehicleExpiryStatus = (v: Vehicle) => {
    const alerts: { type: 'reg' | 'ins' | 'insp' | 'permit'; days: number; dateStr: string }[] = [];
    
    if (v.mulkiyaExpiryDate) {
      const days = getDaysLeft(v.mulkiyaExpiryDate);
      if (days !== null && days <= 30) {
        alerts.push({ type: 'reg', days, dateStr: v.mulkiyaExpiryDate });
      }
    }
    if (v.insuranceExpiryDate) {
      const days = getDaysLeft(v.insuranceExpiryDate);
      if (days !== null && days <= 30) {
        alerts.push({ type: 'ins', days, dateStr: v.insuranceExpiryDate });
      }
    }
    if (v.inspectionExpiryDate) {
      const days = getDaysLeft(v.inspectionExpiryDate);
      if (days !== null && days <= 30) {
        alerts.push({ type: 'insp', days, dateStr: v.inspectionExpiryDate });
      }
    }
    if (v.parkingPermitExpiryDate) {
      const days = getDaysLeft(v.parkingPermitExpiryDate);
      if (days !== null && days <= 30) {
        alerts.push({ type: 'permit', days, dateStr: v.parkingPermitExpiryDate });
      }
    }
    return alerts;
  };

  // Match vehicle numbers robustly as described:
  // (e.g., 10/94221 matching expense vehicleNumber 94221)
  const getVehicleExpenses = (v: Vehicle, expenses: EverydayExpense[] = []) => {
    if (!v.vehicleNumber) return [];
    return expenses.filter(exp => {
      const expVehicleNo = (exp.vehicleNumber || '').trim();
      if (!expVehicleNo) {
        // Also check in description if it contains the vehicle number
        const desc = (exp.description || '').toLowerCase();
        const plate = v.vehicleNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        const numPart = v.vehicleNumber.replace(/\D/g, '');
        if (plate && desc.includes(plate)) return true;
        if (numPart && numPart.length >= 4 && desc.includes(numPart)) return true;
        return false;
      }
      
      const cleanFleet = v.vehicleNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanExpense = expVehicleNo.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (cleanFleet === cleanExpense) return true;
      if (cleanFleet.includes(cleanExpense) || cleanExpense.includes(cleanFleet)) return true;
      
      // Try comparing purely numerical ends to match "10/94221" with "94221"
      const dFleet = v.vehicleNumber.replace(/\D/g, '');
      const dExpense = expVehicleNo.replace(/\D/g, '');
      if (dFleet && dExpense && (dFleet.endsWith(dExpense) || dExpense.endsWith(dFleet))) {
        return true;
      }
      
      return false;
    });
  };

  // Process and Filter records
  const filteredVehicles = vehicles.filter((v: Vehicle) => {
    // Search filter
    const matchesSearch = 
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.driverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.chassisNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Ownership classification filter
    if (ownershipFilter !== 'all') {
      const vOwnership = v.ownershipType || 'Company';
      if (vOwnership !== ownershipFilter) return false;
    }

    // Tabs filter
    if (activeFilter === 'all') return true;
    if (activeFilter === 'expiring') {
      const alerts = getVehicleExpiryStatus(v);
      return alerts.length > 0;
    }
    return v.status === activeFilter;
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Quick stats computed properties
  const stats = React.useMemo(() => {
    let total = vehicles.length;
    let active = 0;
    let maintenance = 0;
    let expiringSoon = 0;
    let company = 0;
    let personal = 0;
    let other = 0;

    vehicles.forEach(v => {
      if (v.status === 'Active') active++;
      if (v.status === 'Under Maintenance') maintenance++;
      
      const ownership = v.ownershipType || 'Company';
      if (ownership === 'Company') company++;
      else if (ownership === 'Personal') personal++;
      else other++;
      
      const alerts = getVehicleExpiryStatus(v);
      if (alerts.length > 0) {
        expiringSoon++;
      }
    });

    return { total, active, maintenance, expiringSoon, company, personal, other };
  }, [vehicles]);

  const handleExport = () => {
    setIsExporting(true);
    const exportData = filteredVehicles.map((v, idx) => {
      const alerts = getVehicleExpiryStatus(v);
      const warningsText = alerts.map(a => `${a.type.toUpperCase()}: ${a.days} days left`).join(', ') || 'OK';
      return {
        'Sl. No.': idx + 1,
        'Vehicle / Plate Number': v.vehicleNumber,
        'Make/Model': v.model || '-',
        'Chassis Number': v.chassisNumber || '-',
        'Driver Assigned': v.driverName || '-',
        'Status': v.status,
        'Mulkiya Issue': v.mulkiyaIssueDate || '-',
        'Mulkiya Expiry': v.mulkiyaExpiryDate || '-',
        'Insurance Company': v.insuranceCompany || '-',
        'Insurance Expiry': v.insuranceExpiryDate || '-',
        'Inspection Expiry': v.inspectionExpiryDate || '-',
        'Inspection Status': v.inspectionStatus || '-',
        'Alerts/Warnings': warningsText,
        'Remarks': v.remarks || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles Inventory");
    XLSX.writeFile(wb, `Vehicles_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setIsExporting(false);
  };

  const compressImage = (base64Str: string, maxWidth = 650, maxHeight = 650): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || !base64Str.startsWith('data:image/')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce safe database limits:
    if (file.type === 'application/pdf' && file.size > 400 * 1024) {
      setDocUploadError("PDF documents cannot exceed 400KB to ensure secure cloud storage. Please optimize or upload a smaller copy.");
      return;
    }

    if (!file.type.startsWith('image/') && file.size > 400 * 1024) {
      setDocUploadError("Non-image attachments cannot exceed 400KB to ensure secure cloud storage.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setDocUploadError("File exceeds the maximum limit of 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const rawBase64 = reader.result as string;
        const compressedBase64 = await compressImage(rawBase64);
        
        if (compressedBase64.length > 550000) {
          setDocUploadError("The file after processing is still too large. Please select a smaller or lower-resolution file.");
          setNewDocFile(null);
          return;
        }

        setNewDocFile(compressedBase64);
        setNewDocFileType(file.type);
        setDocUploadError(null);
        if (!newDocName) {
          // Set fallback neat document name
          const cleanName = file.name.split('.')[0].replace(/[-_]/g, ' ');
          setNewDocName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      } catch (err) {
        setDocUploadError("Failed to process attachment file.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAppendDocument = () => {
    if (!newDocFile || !newDocName) {
      setDocUploadError("Please provide both a document label and attach a file.");
      return;
    }

    const currentDocs = showModal?.documents || [];
    
    // Compute current cumulative size of all documents
    const currentTotalSize = currentDocs.reduce((sum, d) => sum + (d.fileData?.length || 0), 0);
    const incomingSize = newDocFile.length;

    // Limit cumulative base64 length to 800,000 characters (~600KB)
    if (currentTotalSize + incomingSize > 800000) {
      setDocUploadError("Unable to attach: The cumulative size of all attachments would exceed the database safety limit. Please remove existing attachments or optimize files before adding more.");
      return;
    }

    const newDoc: VehicleDocument = {
      id: Math.random().toString(36).substr(2, 9),
      name: newDocName,
      category: newDocCategory,
      fileData: newDocFile,
      fileType: newDocFileType,
      uploadedDate: new Date().toISOString().split('T')[0]
    };

    setShowModal({
      ...showModal,
      documents: [...currentDocs, newDoc]
    });

    // Reset upload fields
    setNewDocName('');
    setNewDocFile(null);
    setNewDocFileType('');
    setDocUploadError(null);
  };

  const handleRemoveDocument = (docId: string) => {
    const currentDocs = showModal?.documents || [];
    setShowModal({
      ...showModal,
      documents: currentDocs.filter(d => d.id !== docId)
    });
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModal?.vehicleNumber) return;

    try {
      const dataToSave: Vehicle = {
        id: showModal.id || Math.random().toString(36).substr(2, 9),
        vehicleNumber: showModal.vehicleNumber.trim(),
        model: showModal.model?.trim() || '',
        chassisNumber: showModal.chassisNumber?.trim() || '',
        mulkiyaIssueDate: showModal.mulkiyaIssueDate || '',
        mulkiyaExpiryDate: showModal.mulkiyaExpiryDate || '',
        insuranceCompany: showModal.insuranceCompany?.trim() || '',
        insurancePolicyNo: showModal.insurancePolicyNo?.trim() || '',
        insuranceExpiryDate: showModal.insuranceExpiryDate || '',
        inspectionDate: showModal.inspectionDate || '',
        inspectionExpiryDate: showModal.inspectionExpiryDate || '',
        inspectionStatus: showModal.inspectionStatus || 'N/A',
        status: showModal.status || 'Active',
        ownershipType: showModal.ownershipType || 'Company',
        driverName: showModal.driverName?.trim() || '',
        remarks: showModal.remarks?.trim() || '',
        parkingPermitIssueDate: showModal.parkingPermitIssueDate || '',
        parkingPermitExpiryDate: showModal.parkingPermitExpiryDate || '',
        documents: showModal.documents || [],
        createdAt: showModal.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(dataToSave);
      setShowModal(null);
    } catch (err: any) {
      console.error("Failed to save vehicle record in Firestore: ", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("size") || errMsg.includes("too large") || errMsg.includes("limit") || errMsg.includes("exceeds")) {
        alert("Unable to save vehicle record: The attached document file size is too large for database storage. Please compress your files, remove some large attachments, or select smaller files before retrying.");
      } else {
        alert("Failed to save vehicle record: " + (errMsg.substring(0, 150) || "Unknown Error"));
      }
    }
  };

  return (
    <div className="p-8 space-y-8 min-h-screen bg-slate-50/50">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6" id="vehicles-header">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Car className="w-10 h-10 text-indigo-600" />
            Vehicles & Fleet Management
          </h1>
          <p className="text-slate-500 font-medium">Keep track of company vehicles, Mulkiyas, registrations, insurance policies, and inspections.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={handleExport}
            className="px-6 py-3 bg-white border border-slate-250 rounded-2xl text-slate-600 font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" /> 
            {isExporting ? 'Exporting...' : 'Export Fleet Inventory'}
          </button>
          
          {canManage && (
            <button 
              type="button"
              onClick={() => {
                setViewMode(false);
                setShowModal({
                  id: '',
                  vehicleNumber: '',
                  model: '',
                  chassisNumber: '',
                  mulkiyaIssueDate: '',
                  mulkiyaExpiryDate: '',
                  insuranceCompany: '',
                  insurancePolicyNo: '',
                  insuranceExpiryDate: '',
                  inspectionDate: '',
                  inspectionExpiryDate: '',
                  inspectionStatus: 'N/A',
                  status: 'Active',
                  ownershipType: 'Company',
                  driverName: '',
                  remarks: '',
                  parkingPermitIssueDate: '',
                  parkingPermitExpiryDate: '',
                  documents: []
                });
              }}
              className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-sm shadow-xl shadow-indigo-100 hover:scale-103 hover:bg-indigo-700 active:scale-97 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" /> Add New Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Bento Stats Rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white border border-slate-150/80 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Total Fleet</span>
            <span className="text-2xl font-black text-slate-800">{stats.total} Vehicles</span>
            <div className="flex gap-1.5 mt-1 text-[9px] font-bold text-slate-500 select-none">
              <span className="bg-slate-100 px-1.5 py-0.5 rounded-md" title={`${stats.company} Company Vehicles`}>Co: {stats.company}</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded-md" title={`${stats.personal} Personal Vehicles`}>Pers: {stats.personal}</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded-md" title={`${stats.other} Other Vehicles`}>Oth: {stats.other}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-150/80 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Operational Active</span>
            <span className="text-2xl font-black text-slate-800">{stats.active} Active</span>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-150/80 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">In Maintenance</span>
            <span className="text-2xl font-black text-slate-800">{stats.maintenance} Trucks</span>
          </div>
        </div>

        <div className="p-6 bg-white border border-rose-150/80 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Expirations (30 Days)</span>
            <span className="text-2xl font-black text-slate-800">{stats.expiringSoon} Alerts</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 p-5 bg-white border border-slate-150 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${activeFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All Fleet
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('Active')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${activeFilter === 'Active' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('Under Maintenance')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${activeFilter === 'Under Maintenance' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Maintenance
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('Inactive')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${activeFilter === 'Inactive' ? 'bg-slate-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Inactive
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('expiring')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${activeFilter === 'expiring' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-rose-600 hover:bg-rose-50'}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Expiring / Alerts
            </button>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by plate no, driver, model..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all font-sans"
            />
          </div>
        </div>

        {/* Ownership Segment Controls */}
        <div className="border-t border-slate-100 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block ml-1 select-none">Ownership Section:</span>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl w-max">
              <button
                type="button"
                onClick={() => setOwnershipFilter('all')}
                className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${ownershipFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                All Fleet ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('Company')}
                className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${ownershipFilter === 'Company' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Company Vehicles ({stats.company})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('Personal')}
                className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${ownershipFilter === 'Personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Personal Vehicles ({stats.personal})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('Other')}
                className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${ownershipFilter === 'Other' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Other Vehicles ({stats.other})
              </button>
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400 mr-2">
            Showing <span className="text-slate-700 font-extrabold">{filteredVehicles.length}</span> of {vehicles.length}
          </div>
        </div>
      </div>

      {/* Grid of Vehicle Inventory */}
      {filteredVehicles.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-150 rounded-3xl shadow-sm text-slate-400 font-semibold space-y-2">
          <Car className="w-12 h-12 mx-auto text-slate-300" />
          <p>No vehicles match the selected criteria or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((v) => {
            const alerts = getVehicleExpiryStatus(v);
            const matchedExps = getVehicleExpenses(v, everydayExpenses);
            const totalExpenseAmount = matchedExps.reduce((sum, exp) => sum + (exp.totalAmount || exp.billAmount || 0), 0);
            
            return (
              <motion.div
                key={v.id}
                layout
                className="bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Visual Top Bar */}
                <div className="p-6 pb-4 border-b border-slate-100 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-950 font-mono text-sm font-black rounded-lg inline-block shadow-sm">
                          {v.vehicleNumber}
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                          v.ownershipType === 'Personal' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                          v.ownershipType === 'Other' ? 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' :
                          'bg-sky-50 text-sky-800 border-sky-200'
                        }`}>
                          {v.ownershipType || 'Company'}
                        </span>
                      </div>
                      <h3 className="text-slate-800 font-black text-sm mt-1.5 flex items-center gap-1.5">
                        {v.model || "Unknown Model"}
                      </h3>
                    </div>

                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      v.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      v.status === 'Under Maintenance' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      v.status === 'Sold' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                      'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}>
                      {v.status}
                    </span>
                  </div>

                  {v.driverName && (
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <span className="font-bold text-slate-400">Assigned Driver:</span>
                      <span className="text-slate-700">{v.driverName}</span>
                    </p>
                  )}
                </div>

                {/* Body Content / Card details */}
                <div className="p-6 space-y-4 flex-grow text-xs">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-widest">Mulkiya Expiry</span>
                      <span className={`font-mono font-bold block ${
                        v.mulkiyaExpiryDate && getDaysLeft(v.mulkiyaExpiryDate) !== null && (getDaysLeft(v.mulkiyaExpiryDate) || 0) <= 0 ? 'text-rose-600 font-extrabold' : 
                        v.mulkiyaExpiryDate && getDaysLeft(v.mulkiyaExpiryDate) !== null && (getDaysLeft(v.mulkiyaExpiryDate) || 0) <= 30 ? 'text-amber-600 font-extrabold' : 'text-slate-700'
                      }`}>
                        {v.mulkiyaExpiryDate || "N/A"}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-widest">Insurance Expiry</span>
                      <span className={`font-mono font-bold block ${
                        v.insuranceExpiryDate && getDaysLeft(v.insuranceExpiryDate) !== null && (getDaysLeft(v.insuranceExpiryDate) || 0) <= 0 ? 'text-rose-600 font-extrabold' :
                        v.insuranceExpiryDate && getDaysLeft(v.insuranceExpiryDate) !== null && (getDaysLeft(v.insuranceExpiryDate) || 0) <= 30 ? 'text-amber-600 font-extrabold' : 'text-slate-700'
                      }`}>
                        {v.insuranceExpiryDate || "N/A"}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-widest">Inspection Status</span>
                      <span className={`font-bold block ${
                        v.inspectionStatus === 'Passed' ? 'text-emerald-600' :
                        v.inspectionStatus === 'Failed' ? 'text-rose-650' : 'text-slate-600'
                      }`}>
                        {v.inspectionStatus || "N/A"} {v.inspectionExpiryDate ? `(${v.inspectionExpiryDate})` : ''}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-widest">Total Documents</span>
                      <span className="font-extrabold text-indigo-700 block bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 w-max">
                        {v.documents?.length || 0} Attached
                      </span>
                    </div>

                    <div className="space-y-0.5 col-span-2 border-t border-slate-100/70 pt-2.5 mt-1 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-400 block tracking-widest">Parking Permit Expiry</span>
                        <span className={`font-mono font-bold block ${
                          v.parkingPermitExpiryDate && getDaysLeft(v.parkingPermitExpiryDate) !== null && (getDaysLeft(v.parkingPermitExpiryDate) || 0) <= 0 ? 'text-rose-650 font-extrabold animate-pulse' : 
                          v.parkingPermitExpiryDate && getDaysLeft(v.parkingPermitExpiryDate) !== null && (getDaysLeft(v.parkingPermitExpiryDate) || 0) <= 30 ? 'text-amber-600 font-extrabold' : 'text-slate-700'
                        }`}>
                          {v.parkingPermitExpiryDate || "N/A"}
                        </span>
                      </div>
                      {v.parkingPermitIssueDate && (
                        <div className="text-right">
                          <span className="text-[8px] uppercase font-black text-slate-400 block tracking-widest">Issue Date</span>
                          <span className="font-mono text-slate-500 font-bold block">{v.parkingPermitIssueDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {alerts.length > 0 && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Expiration Alerts
                      </span>
                      <div className="space-y-0.5 text-[11px] font-semibold text-rose-950">
                        {alerts.map((a, i) => {
                          const statusTxt = a.days < 0 ? `EXPIRED by ${Math.abs(a.days)} days` : `expiring in ${a.days} days`;
                          return (
                            <div key={i} className="flex justify-between">
                              <span className="capitalize">
                                {a.type === 'reg' ? 'Mulkiya Card' : 
                                 a.type === 'ins' ? 'Insurance' : 
                                 a.type === 'insp' ? 'Vehicle Inspection' : 
                                 'Parking Permit'}
                              </span>
                              <span className="font-bold font-mono">{statusTxt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {v.remarks && (
                    <p className="text-slate-500 italic border-l-2 border-slate-200 pl-2 text-[11px] leading-relaxed">
                      {v.remarks}
                    </p>
                  )}

                  {/* Everyday Expenses Connection block */}
                  <div className="pt-3 border-t border-slate-100">
                    {matchedExps.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowExpensesModal({ vehicle: v, expenses: matchedExps })}
                        className="w-full p-3 bg-emerald-50/40 hover:bg-emerald-50/80 border border-emerald-100/70 rounded-2xl flex items-center justify-between text-left group transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-750 font-black group-hover:scale-105 transition-all text-xs">
                            {matchedExps.length}
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider block">View Bills</span>
                            <span className="text-[10px] font-bold text-slate-500 block leading-tight font-sans">View matched transactions & slips</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 block font-black uppercase tracking-widest">Total cost</span>
                          <span className="text-xs font-black text-emerald-950 font-mono">
                            AED {totalExpenseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-[11px] text-slate-400 font-semibold select-none">
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-300" /> No recorded expenses matching
                        </span>
                        <span className="font-mono text-[10px]">AED 0.00</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-1">
                    {v.documents && v.documents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode(true);
                          setShowModal(v);
                        }}
                        className="p-2 text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-200/60 transition-all cursor-pointer flex items-center gap-1.5 font-bold"
                        title="View Document Attachments"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Docs</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode(true);
                        setShowModal(v);
                      }}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition-all cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode(false);
                            setShowModal(v);
                          }}
                          className="p-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete vehicle ${v.vehicleNumber}?`)) {
                              onDelete(v.id);
                            }
                          }}
                          className="p-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="Delete Vehicle"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Primary Detail Modal / Add / Edit Form */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative my-8 overflow-hidden border border-slate-150 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Car className="w-6 h-6 text-indigo-600" />
                    {viewMode ? 'Vehicle Particulars' : showModal.id ? 'Modify Vehicle Record' : 'Enroll New Fleet Vehicle'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Please provide and review current registration metrics below.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Scroll Body */}
              <form onSubmit={handleSaveSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
                
                {/* Section 1: Basic Particulars */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Car className="w-4 h-4" /> Basic Specifications
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Plate / Vehicle no <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DXB 12345"
                        required
                        disabled={viewMode}
                        value={showModal.vehicleNumber || ''}
                        onChange={e => setShowModal({ ...showModal, vehicleNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all font-mono disabled:bg-slate-50 disabled:text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Make / Model
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Toyota Hilux 2.7L"
                        disabled={viewMode}
                        value={showModal.model || ''}
                        onChange={e => setShowModal({ ...showModal, model: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all disabled:bg-slate-50 disabled:text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Chassis Number
                      </label>
                      <input
                        type="text"
                        placeholder="Serial/Frame Number"
                        disabled={viewMode}
                        value={showModal.chassisNumber || ''}
                        onChange={e => setShowModal({ ...showModal, chassisNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all font-mono disabled:bg-slate-50 disabled:text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Assigned Driver
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ali Al Mansoori"
                        disabled={viewMode}
                        value={showModal.driverName || ''}
                        onChange={e => setShowModal({ ...showModal, driverName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all disabled:bg-slate-50 disabled:text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Vehicle Ownership
                      </label>
                      <select
                        disabled={viewMode}
                        value={showModal.ownershipType || 'Company'}
                        onChange={e => setShowModal({ ...showModal, ownershipType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all disabled:bg-slate-50 disabled:text-slate-800 cursor-pointer"
                      >
                        <option value="Company">Company Vehicle</option>
                        <option value="Personal">Personal Vehicle</option>
                        <option value="Other">Other Vehicle</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Fleet Status Check
                      </label>
                      <select
                        disabled={viewMode}
                        value={showModal.status || 'Active'}
                        onChange={e => setShowModal({ ...showModal, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all disabled:bg-slate-50 disabled:text-slate-800 cursor-pointer"
                      >
                        <option value="Active">Active / Operational</option>
                        <option value="Under Maintenance">Under Maintenance</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Sold">Sold / Offloaded</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                        Remarks Note
                      </label>
                      <input
                        type="text"
                        placeholder="Staff car, tool truck..."
                        disabled={viewMode}
                        value={showModal.remarks || ''}
                        onChange={e => setShowModal({ ...showModal, remarks: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-50 transition-all disabled:bg-slate-50 disabled:text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Registration & Insurance Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-4 p-5 bg-slate-50/50 border border-slate-150 rounded-2xl">
                    <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5 pb-1 select-none">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      Mulkiya / Registration Card
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                          Issue Date
                        </label>
                        <input
                          type="date"
                          disabled={viewMode}
                          value={showModal.mulkiyaIssueDate || ''}
                          onChange={e => setShowModal({ ...showModal, mulkiyaIssueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:bg-slate-50 transition-all disabled:text-slate-850"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                          Expiration Date
                        </label>
                        <input
                          type="date"
                          disabled={viewMode}
                          value={showModal.mulkiyaExpiryDate || ''}
                          onChange={e => setShowModal({ ...showModal, mulkiyaExpiryDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:bg-slate-50 transition-all disabled:text-slate-850"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-5 bg-slate-50/50 border border-slate-150 rounded-2xl">
                    <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5 pb-1 select-none">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      Insurance Policy Details
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-0.5">
                          Insurance Company
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. AXA, Sukoon"
                          disabled={viewMode}
                          value={showModal.insuranceCompany || ''}
                          onChange={e => setShowModal({ ...showModal, insuranceCompany: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-0.5">
                          Policy Number
                        </label>
                        <input
                          type="text"
                          placeholder="Policy ref"
                          disabled={viewMode}
                          value={showModal.insurancePolicyNo || ''}
                          onChange={e => setShowModal({ ...showModal, insurancePolicyNo: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-white font-mono"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                        Policy Expiration Date
                      </label>
                      <input
                        type="date"
                        disabled={viewMode}
                        value={showModal.insuranceExpiryDate || ''}
                        onChange={e => setShowModal({ ...showModal, insuranceExpiryDate: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2.5: Parking Permit Particulars */}
                <div className="space-y-4 p-5 bg-slate-50/50 border border-slate-150 rounded-2xl">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5 border-b border-indigo-100/50 pb-2 select-none">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    Parking Permit Particulars
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                        Parking Permit Issue Date
                      </label>
                      <input
                        type="date"
                        disabled={viewMode}
                        value={showModal.parkingPermitIssueDate || ''}
                        onChange={e => setShowModal({ ...showModal, parkingPermitIssueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                        Parking Permit Expiration Date
                      </label>
                      <input
                        type="date"
                        disabled={viewMode}
                        value={showModal.parkingPermitExpiryDate || ''}
                        onChange={e => setShowModal({ ...showModal, parkingPermitExpiryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Vehicle Inspection Details */}
                <div className="space-y-4 p-5 bg-slate-50/50 border border-slate-150 rounded-2xl">
                  <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5 border-b border-indigo-100/50 pb-2 select-none">
                    <FileCheck className="w-4 h-4 text-violet-600" />
                    Inspection & Test Particulars
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                        Inspection Status
                      </label>
                      <select
                        disabled={viewMode}
                        value={showModal.inspectionStatus || 'N/A'}
                        onChange={e => setShowModal({ ...showModal, inspectionStatus: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Passed">Passed / Decisive OK</option>
                        <option value="Failed">Failed / Warning</option>
                        <option value="Pending">Inspection Scheduled/Pending</option>
                        <option value="Needed">Inspection Overdue / Needed</option>
                        <option value="N/A">Not Applicable (New Vehicle)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                        Last Inspection Date
                      </label>
                      <input
                        type="date"
                        disabled={viewMode}
                        value={showModal.inspectionDate || ''}
                        onChange={e => setShowModal({ ...showModal, inspectionDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-0.5">
                        Next Inspection Due Date
                      </label>
                      <input
                        type="date"
                        disabled={viewMode}
                        value={showModal.inspectionExpiryDate || ''}
                        onChange={e => setShowModal({ ...showModal, inspectionExpiryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Document Uploads & Archives */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Paperclip className="w-4 h-4" /> Attached Fleet Documentation
                  </h3>

                  {/* Attachment Form (Only shows in edit/add mode) */}
                  {!viewMode && (
                    <div className="p-4 bg-indigo-50/40 border border-indigo-100/70 rounded-2xl space-y-3">
                      <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest block select-none">
                        Attach registration, insurance, or inspection files
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-0.5">
                            Doc Category
                          </label>
                          <select
                            value={newDocCategory}
                            onChange={e => setNewDocCategory(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-xl text-xs font-semibold outline-none"
                          >
                            <option value="Registration">Registration (Mulkiya)</option>
                            <option value="Insurance">Insurance Policy</option>
                            <option value="Inspection">Inspection Certificate</option>
                            <option value="Other">Other Document / Bill</option>
                          </select>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-0.5">
                            Document Label / File Title
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Mulkiya Card Front Face"
                            value={newDocName}
                            onChange={e => setNewDocName(e.target.value)}
                            className="w-full px-3 py-2 border border-indigo-100 rounded-xl text-xs font-semibold bg-white outline-none"
                          />
                        </div>

                        <div className="space-y-1 relative">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-0.5">
                            Choose File (Base64)
                          </label>
                          <div className="w-full h-[36px] bg-white border border-indigo-100 rounded-xl relative flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                            <Upload className="w-4 h-4 text-indigo-500 absolute left-3" />
                            <span className="text-[10px] font-bold text-indigo-600 pl-4 pr-1 truncate max-w-[85%]">
                              {newDocFile ? "File Selected" : "Browse File..."}
                            </span>
                            <input
                              type="file"
                              onChange={handleFileUpload}
                              accept="image/*,application/pdf"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {docUploadError && (
                        <p className="text-[11px] font-bold text-rose-650 ml-1">
                          {docUploadError}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleAppendDocument}
                        className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ml-auto"
                      >
                        <Plus className="w-3.5 h-3.5" /> Attach to Vehicle
                      </button>
                    </div>
                  )}

                  {/* Document Archive Grid list */}
                  {(!showModal.documents || showModal.documents.length === 0) ? (
                    <div className="p-8 text-center bg-slate-55 bg-slate-50 rounded-2xl text-slate-400 text-xs font-bold border border-slate-150">
                      No files or credentials have been uploaded to this vehicle record yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {showModal.documents.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[9px] font-extrabold uppercase bg-indigo-100/60 border border-indigo-200 px-1.5 py-0.5 rounded-md text-indigo-800 tracking-wide inline-block select-none">
                                {d.category}
                              </span>
                              <p className="text-[11px] font-black text-slate-800 truncate mt-1 leading-none">
                                {d.name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(d)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer border border-indigo-100"
                              title="Preview Document File"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={d.fileData}
                              download={`${showModal.vehicleNumber}_${d.name}`.replace(/\s+/g, '_')}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-emerald-100 flex items-center justify-center"
                              title="Download Attachment File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            {!viewMode && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument(d.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border border-rose-100"
                                title="Remove Attachment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>

              {/* Footer Block */}
              <div className="p-6 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  {viewMode ? 'Done' : 'Cancel'}
                </button>
                {!viewMode && (
                  <button
                    type="button"
                    onClick={handleSaveSubmit}
                    disabled={!showModal.vehicleNumber}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
                  >
                    Save Fleet Vehicle Record
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded Document Viewer Drawer/Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] border border-slate-200"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-650" />
                    Preview: {previewDoc.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5 uppercase tracking-wide">Category: {previewDoc.category}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 flex-shrink-0" />
                </button>
              </div>

              <div className="flex-grow p-4 bg-slate-100 flex items-center justify-center overflow-auto min-h-[350px]">
                {previewDoc.fileType.startsWith('image/') ? (
                  <img
                    src={previewDoc.fileData}
                    alt={previewDoc.name}
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-200"
                  />
                ) : previewDoc.fileType === 'application/pdf' ? (
                  <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center space-y-3">
                    <FileText className="w-16 h-16 text-indigo-600" />
                    <p className="text-sm font-bold text-slate-700">PDF Document Attachment Included</p>
                    <p className="text-xs text-slate-500">Embedded PDF rendering might be restricted, click below to safely download your copy.</p>
                    <a
                      href={previewDoc.fileData}
                      download={previewDoc.name}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition"
                    >
                      Retrieve / Download PDF
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={previewDoc.fileData}
                    title={previewDoc.name}
                    className="w-full h-full min-h-[450px] border-none rounded-xl"
                  />
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold font-mono">Uploaded: {previewDoc.uploadedDate || "N/A"}</span>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vehicle Expenses / Bills List Modal */}
      <AnimatePresence>
        {showExpensesModal && (() => {
          const now = new Date();
          const currentYearStr = now.getFullYear().toString();
          const currentMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
          const currentYearMonth = `${currentYearStr}-${currentMonthStr}`;

          const getMonthYearString = (dateStr: string) => {
            if (!dateStr) return 'Unknown Month';
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
              const year = parts[0];
              const monthIndex = parseInt(parts[1], 10) - 1;
              if (monthIndex >= 0 && monthIndex < 12) {
                const monthNames = [
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                return `${monthNames[monthIndex]} ${year}`;
              }
            }
            return 'Unknown Month';
          };

          const groupedExpenses: { [key: string]: number } = {};
          const currentMonthLabel = getMonthYearString(`${currentYearStr}-${currentMonthStr}-01`);
          let currentMonthTotal = 0;

          showExpensesModal.expenses.forEach(exp => {
            const amount = exp.totalAmount || exp.billAmount || 0;
            if (exp.date && exp.date.startsWith(currentYearMonth)) {
              currentMonthTotal += amount;
            }
            const monthKey = getMonthYearString(exp.date);
            groupedExpenses[monthKey] = (groupedExpenses[monthKey] || 0) + amount;
          });

          const totalLifetimeAmount = showExpensesModal.expenses.reduce((sum, exp) => sum + (exp.totalAmount || exp.billAmount || 0), 0);

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden border border-slate-150 flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-150 flex items-center justify-between animate-none">
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <Car className="w-5 h-5 text-emerald-600" />
                      Expense Records for Plate: {showExpensesModal.vehicle.vehicleNumber}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5 animate-none">
                      {showExpensesModal.vehicle.model || "Unknown Model"} &bull; {showExpensesModal.expenses.length} Matched bills / cash records
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExpensesModal(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5 flex-shrink-0" />
                  </button>
                </div>

                {/* Table / List & Charts Layout */}
                <div className="flex-grow p-6 overflow-y-auto space-y-6">
                  {/* Point 1: Monthly / Lifetime summary card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current Month & Lifetime Overview */}
                    <div className="bg-gradient-to-br from-indigo-50/50 to-indigo-100/40 p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-indigo-900">
                          <Calendar className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-black uppercase tracking-wider">Expenditure Focus</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Current Month ({currentMonthLabel})</span>
                            <span className="text-lg font-black text-indigo-950 font-mono mt-0.5 block">
                              AED {currentMonthTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Lifetime Verified</span>
                            <span className="text-lg font-black text-slate-800 font-mono mt-0.5 block">
                              AED {totalLifetimeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Month-Wise Trend Breakdown */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <TrendingUp className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-black uppercase tracking-wider">Month-Wise Distribution</span>
                        </div>
                        <div className="mt-3.5 max-h-[85px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {Object.entries(groupedExpenses).length > 0 ? (
                            Object.entries(groupedExpenses).map(([monthLabel, totalAmt]) => (
                              <div key={monthLabel} className="flex items-center justify-between text-xs py-1 border-b border-dashed border-slate-200 last:border-0 hover:bg-slate-100/40 px-1 rounded-md transition-all">
                                <span className="font-extrabold text-slate-600">{monthLabel}</span>
                                <span className="font-black text-slate-900 font-mono">AED {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs font-medium text-slate-400 italic block">No month data available</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* List / Table of matched transactions */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction History</h4>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!showExpensesModal || !showExpensesModal.expenses || showExpensesModal.expenses.length === 0) return;
                            const exportData = showExpensesModal.expenses.map((exp, idx) => ({
                              'Sl. No.': idx + 1,
                              'Date': exp.date || '-',
                              'SI No': exp.siNo || '-',
                              'Invoice No': exp.invoiceNo || '-',
                              'Category': exp.category || 'General Expense',
                              'Total Amount (AED)': exp.totalAmount || exp.billAmount || 0,
                              'VAT Amount (AED)': exp.vatAmount || 0,
                              'Net Bill Amount (AED)': exp.billAmount || 0,
                              'Shop Name / Vendor': exp.shopName || '-',
                              'Supplier Registered': exp.supplierName || '-',
                              'TRN Number': exp.trnNo || '-',
                              'Client Reference': exp.clientName || '-',
                              'Expense Description': exp.description || '-',
                              'Is Vehicle Fuel Log?': exp.isVehicleFuel ? 'Yes' : 'No',
                              'Km Start': exp.kmStart !== undefined ? exp.kmStart : '-',
                              'Km End': exp.kmEnd !== undefined ? exp.kmEnd : '-',
                              'Km Run': exp.kmRun !== undefined ? exp.kmRun : '-',
                              'Assigned Driver': exp.vehicleDriver || '-',
                              'Log Remarks': exp.vehicleRemarks || '-'
                            }));

                            const ws = XLSX.utils.json_to_sheet(exportData);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, "Transactions");
                            XLSX.writeFile(wb, `Plate_${showExpensesModal.vehicle.vehicleNumber}_Expenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                          <Download className="w-3 h-3" /> Download Details
                        </button>
                      </div>
                      <span className="text-[11px] text-indigo-650 font-bold hidden sm:inline">Tip: Click on any record row to view voucher details & receipt</span>
                    </div>

                    <div className="overflow-hidden border border-slate-150 rounded-2xl bg-white shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                            <th className="p-4">Date</th>
                            <th className="p-4">Supplier / Shop</th>
                            <th className="p-4">Description</th>
                            <th className="p-4 text-right">Total Amount</th>
                            <th className="p-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-750">
                          {showExpensesModal.expenses.map((exp) => (
                            <tr 
                              key={exp.id} 
                              onClick={() => setSelectedExpenseDetail(exp)}
                              className="hover:bg-indigo-50/40 transition bg-white cursor-pointer group/row"
                            >
                              <td className="p-4 font-mono font-bold text-slate-650">{exp.date}</td>
                              <td className="p-4 truncate max-w-[140px] font-black text-slate-800">
                                {exp.shopName || exp.supplierName || "-"}
                              </td>
                              <td className="p-4 font-semibold text-slate-500 truncate max-w-[200px]" title={exp.description}>
                                {exp.description || "-"}
                              </td>
                              <td className="p-4 text-right font-black text-emerald-600 font-mono">
                                AED {(exp.totalAmount || exp.billAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedExpenseDetail(exp);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-black rounded-lg transition"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Aggregate Fuel/Expense Total</span>
                    <span className="text-base font-black text-emerald-950 font-mono">
                      AED {totalLifetimeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExpensesModal(null)}
                    className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedExpenseDetail && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[55] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] font-sans"
            >
              {/* Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest block">Transaction Voucher & Details</span>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mt-0.5 animate-none">
                    <FileText className="w-5 h-5 text-indigo-600 animate-none" />
                    SI No: {selectedExpenseDetail.siNo || "N/A"} &bull; Invoice No: {selectedExpenseDetail.invoiceNo || "N/A"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExpenseDetail(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Info grid & File display side-by-side */}
              <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Information Fields Column */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Summary Metric Block */}
                  <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black text-emerald-800 tracking-wider block">Total Amount Paid</span>
                      <span className="text-2xl font-black text-emerald-950 font-mono block mt-0.5">
                        AED {selectedExpenseDetail.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-400 font-semibold block">VAT Amount</span>
                      <span className="font-bold text-slate-750 font-mono block">
                        AED {selectedExpenseDetail.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                      </span>
                      <span className="text-slate-400 font-semibold block mt-1">Net Base Bill</span>
                      <span className="font-bold text-slate-500 font-mono block">
                        AED {selectedExpenseDetail.billAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </div>
                  </div>

                  {/* General Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Transaction Date</span>
                      <span className="text-xs font-black text-slate-800 block mt-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150 font-mono">{selectedExpenseDetail.date || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block font-sans">Category Tag</span>
                      <span className="text-xs font-black text-indigo-700 block mt-1 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 uppercase tracking-widest text-[10px] duration-150 w-max">{selectedExpenseDetail.category || 'General Expense'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Vendor / Shop Name</span>
                      <span className="text-xs font-bold text-slate-800 block mt-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150">{selectedExpenseDetail.shopName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Supplier Registered</span>
                      <span className="text-xs font-bold text-slate-800 block mt-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150">{selectedExpenseDetail.supplierName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">TRN Number</span>
                      <span className="text-xs font-bold font-mono text-slate-800 block mt-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150">{selectedExpenseDetail.trnNo || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Client Reference</span>
                      <span className="text-xs font-bold text-slate-800 block mt-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-150">{selectedExpenseDetail.clientName || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Expense Description</span>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed font-sans">
                      {selectedExpenseDetail.description || 'No detailed instructions or descriptions specified.'}
                    </div>
                  </div>

                  {/* Mileage / Vehicle Tracking Fields */}
                  {selectedExpenseDetail.isVehicleFuel && (
                    <div className="space-y-2.5 pt-4 border-t border-slate-150">
                      <span className="text-[10px] uppercase font-black text-amber-800 tracking-wider block">Vehicle Fuel & Log Tracking</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-2.5 bg-amber-50/20 border border-amber-100 rounded-xl">
                          <span className="text-[9px] uppercase font-black text-slate-400 block">Km Start</span>
                          <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">{selectedExpenseDetail.kmStart !== undefined ? selectedExpenseDetail.kmStart.toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="p-2.5 bg-amber-50/20 border border-amber-100 rounded-xl">
                          <span className="text-[9px] uppercase font-black text-slate-400 block">Km End</span>
                          <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">{selectedExpenseDetail.kmEnd !== undefined ? selectedExpenseDetail.kmEnd.toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="p-2.5 bg-amber-50/20 border border-amber-100 rounded-xl">
                          <span className="text-[9px] uppercase font-black text-slate-400 block">Km Run</span>
                          <span className="text-xs font-black text-emerald-800 font-mono block mt-0.5">{selectedExpenseDetail.kmRun !== undefined ? `${selectedExpenseDetail.kmRun.toLocaleString()} KM` : 'N/A'}</span>
                        </div>
                        <div className="p-2.5 bg-amber-50/20 border border-amber-100 rounded-xl">
                          <span className="text-[9px] uppercase font-black text-slate-400 block">Driver Sign</span>
                          <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">{selectedExpenseDetail.vehicleDriver || 'N/A'}</span>
                        </div>
                      </div>
                      
                      {selectedExpenseDetail.vehicleRemarks && (
                        <div className="p-3 bg-amber-50/10 border border-amber-100/50 rounded-xl text-[11px] font-semibold text-amber-955 mt-2">
                          <span className="font-bold">Log Remarks: </span>{selectedExpenseDetail.vehicleRemarks}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Digital Attachment Preview Column */}
                <div className="lg:col-span-5 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Receipt Bill Slip / Image</span>
                    {selectedExpenseDetail.attachment && (
                      <button
                        type="button"
                        onClick={() => setViewingExpenseBill(selectedExpenseDetail)}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-650 hover:text-indigo-850 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Fullscreen Lightbox
                      </button>
                    )}
                  </div>

                  <div className="flex-grow border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden flex flex-col justify-center items-center p-3 relative min-h-[300px] max-h-[500px]">
                    {selectedExpenseDetail.attachment ? (
                      selectedExpenseDetail.attachment.startsWith('data:image/') ? (
                        <img
                          src={selectedExpenseDetail.attachment}
                          alt="Bill slip thumbnail"
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full rounded-xl object-contain shadow-sm cursor-pointer hover:opacity-95 transition"
                          onClick={() => setViewingExpenseBill(selectedExpenseDetail)}
                        />
                      ) : selectedExpenseDetail.attachment.startsWith('data:application/pdf') ? (
                        <div className="text-center p-4 space-y-3">
                          <FileText className="w-12 h-12 text-indigo-500 mx-auto" />
                          <span className="text-xs font-bold text-slate-700 block">PDF Document Bill Uploaded</span>
                          <a
                            href={selectedExpenseDetail.attachment}
                            download={`Receipt_${selectedExpenseDetail.invoiceNo || selectedExpenseDetail.id}.pdf`}
                            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black shadow-sm transition mt-2 cursor-pointer"
                          >
                            Download PDF Attachment
                          </a>
                        </div>
                      ) : (
                        <iframe
                          src={selectedExpenseDetail.attachment}
                          title="Voucher document inline copy"
                          className="w-full h-full border-none rounded-xl"
                        />
                      )
                    ) : (
                      <div className="text-center p-6 space-y-2 select-none">
                        <Paperclip className="w-10 h-10 text-slate-300 mx-auto" />
                        <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">No Attachment Slips</span>
                        <p className="text-[10px] font-semibold text-slate-400">This transaction was logged physically without digital receipts.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono text-slate-500">Date Logged: {selectedExpenseDetail.uploadedDate || selectedExpenseDetail.date || 'N/A'}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExpenseDetail(null)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-indigo-100"
                  >
                    Close Voucher
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bill Image / Slip Lightbox Viewer Modal */}
      <AnimatePresence>
        {viewingExpenseBill && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[70] p-4 font-sans">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] border border-slate-200"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between animate-none">
                <div>
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-650" />
                    Receipt Bill Voucher: {viewingExpenseBill.invoiceNo || viewingExpenseBill.id}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5 uppercase tracking-wide">
                    Amount: AED {(viewingExpenseBill.totalAmount || viewingExpenseBill.billAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} &bull; Supplier: {viewingExpenseBill.shopName || viewingExpenseBill.supplierName || "-"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingExpenseBill(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-705 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow p-4 bg-slate-100 flex items-center justify-center overflow-auto min-h-[350px]">
                {viewingExpenseBill.attachment && viewingExpenseBill.attachment.startsWith('data:image/') ? (
                  <img
                    src={viewingExpenseBill.attachment}
                    alt="Expense Slip voucher receipt"
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-200"
                  />
                ) : viewingExpenseBill.attachment && viewingExpenseBill.attachment.startsWith('data:application/pdf') ? (
                  <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center space-y-3">
                    <FileText className="w-16 h-16 text-indigo-600" />
                    <p className="text-sm font-bold text-slate-700">PDF Document Attachment Included</p>
                    <p className="text-xs text-slate-500">Embedded PDF rendering might be restricted, click below to safely download your copy.</p>
                    <a
                      href={viewingExpenseBill.attachment}
                      download={`Bill_${viewingExpenseBill.invoiceNo || viewingExpenseBill.id}.pdf`}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Retrieve / Download PDF
                    </a>
                  </div>
                ) : viewingExpenseBill.attachment ? (
                  <iframe
                    src={viewingExpenseBill.attachment}
                    title="Voucher document copy"
                    className="w-full h-full min-h-[450px] border-none rounded-xl"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400 font-bold">No attachment file associated.</div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold font-mono">Date Recorded: {viewingExpenseBill.date}</span>
                <button
                  type="button"
                  onClick={() => setViewingExpenseBill(null)}
                  className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close Bill
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
