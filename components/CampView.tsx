import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, Edit, Trash2, Search, Filter, 
  Home, Download, Calendar, ArrowUpDown, FileSpreadsheet, Eye, X, FileText, CheckCircle, ExternalLink, Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { CampExpense } from '../types';
import { jsPDF } from 'jspdf';

interface CampViewProps {
  data: CampExpense[];
  onAdd: () => void;
  onEdit: (camp: CampExpense) => void;
  onDelete: (camp: CampExpense) => void;
  user: any;
}

export const CampView: React.FC<CampViewProps> = ({
  data = [],
  onAdd,
  onEdit,
  onDelete,
  user
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof CampExpense>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewingAttachment, setViewingAttachment] = useState<{ doc: string; name: string } | null>(null);

  // Multi-column filter
  const filteredCamps = useMemo(() => {
    let result = [...data];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        (item.campName || '').toLowerCase().includes(q) ||
        (item.rentMonth || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    }
    
    // Sort
    result.sort((a: any, b: any) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, sortField, sortDirection]);

  // Calculations
  const totalRentExpenses = useMemo(() => {
    return filteredCamps.reduce((sum, item) => sum + (Number(item.rent) || 0), 0);
  }, [filteredCamps]);

  const totalDepositExpenses = useMemo(() => {
    return filteredCamps.reduce((sum, item) => sum + (Number(item.depositAmount) || 0), 0);
  }, [filteredCamps]);

  const totalAccommodationExpenses = useMemo(() => {
    return totalRentExpenses + totalDepositExpenses;
  }, [totalRentExpenses, totalDepositExpenses]);

  const handleSort = (field: keyof CampExpense) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDownloadPdfSummary = () => {
    const doc = new jsPDF();
    
    // Title Banner
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PIONEER DMS PORTAL", 15, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("CAMP ACCOMMODATION EXPENSES SUMMARY REPORT", 15, 28);
    
    // Metadata block
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 15, 52);
    doc.text(`Total Records: ${filteredCamps.length}`, 15, 58);
    
    doc.text(`Total Rent Outflow: AED ${totalRentExpenses.toLocaleString()}`, 120, 52);
    doc.text(`Total Deposits: AED ${totalDepositExpenses.toLocaleString()}`, 120, 58);
    
    // Divider
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(15, 65, 195, 65);
    
    // Table Headers
    let currentY = 75;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(15, currentY - 5, 180, 8, 'F');
    
    doc.text("S.No", 17, currentY);
    doc.text("Camp Name", 28, currentY);
    doc.text("Rent Month", 95, currentY);
    doc.text("Due Date", 125, currentY);
    doc.text("Deposit (AED)", 150, currentY);
    doc.text("Rent (AED)", 175, currentY);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    
    filteredCamps.forEach((item, idx) => {
      currentY += 10;
      
      // Page break check
      if (currentY > 280) {
        doc.addPage();
        currentY = 20;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY - 5, 180, 8, 'F');
        doc.text("S.No", 17, currentY);
        doc.text("Camp Name", 28, currentY);
        doc.text("Rent Month", 95, currentY);
        doc.text("Due Date", 125, currentY);
        doc.text("Deposit (AED)", 150, currentY);
        doc.text("Rent (AED)", 175, currentY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        currentY += 10;
      }
      
      // Border lines
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.line(15, currentY + 3, 195, currentY + 3);
      
      doc.text(String(idx + 1), 17, currentY);
      doc.text(String(item.campName || ''), 28, currentY);
      doc.text(String(item.rentMonth || ''), 95, currentY);
      doc.text(String(item.dueDate || ''), 125, currentY);
      doc.text(item.depositAmount ? Number(item.depositAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00', 150, currentY);
      doc.text(Number(item.rent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 175, currentY);
    });
    
    // Total row at end
    currentY += 12;
    if (currentY > 280) {
      doc.addPage();
      currentY = 25;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(15, currentY - 5, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("GRAND CUMULATIVE TOTALS", 28, currentY);
    doc.text(totalDepositExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 150, currentY);
    doc.text(totalRentExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 175, currentY);
    
    doc.save("Corporate_Camp_Accommodation_Expenses_Summary.pdf");
  };

  const handleExportExcel = () => {
    const wsData = filteredCamps.map((item, idx) => ({
      'S.No': idx + 1,
      'Camp/Accommodation Name': item.campName,
      'Deposit Amount (AED)': item.depositAmount,
      'Rent Amount (AED)': item.rent,
      'Rent Month': item.rentMonth,
      'Due Date': item.dueDate,
      'Lease Start Date': item.startDate,
      'Lease End Date': item.endDate,
      'Notes/Description': item.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Camp Accommodation Expenses");
    XLSX.writeFile(wb, "Corporate_Camp_Accommodation_Expenses.xlsx");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm shadow-indigo-100">
              <Home className="w-6 h-6" />
            </div>
            <span>Corporate Camp Accommodation (Expenses)</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 sm:mt-1.5 font-medium ml-1">
            Manage corporate camps lease contracts, active rent payments, security deposits, and schedule tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadPdfSummary}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-750 hover:bg-indigo-100 px-4.5 py-2.5 rounded-xl text-xs font-black border border-indigo-105 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Summary</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-750 hover:bg-emerald-100 px-4.5 py-2.5 rounded-xl text-xs font-black border border-emerald-100 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-100 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Camp Record</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/50 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Accommodation Cost</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              AED {totalAccommodationExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-3">Active filter total (Rent + Deposit)</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/50 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">Total Camp Rent Portion</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight block">
              AED {totalRentExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-3">Monthly leases cumulative rent portion</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/50 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">Total Camp Deposits</span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight block">
              AED {totalDepositExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-3">Refundable standard security deposits</p>
        </div>
      </div>

      {/* Search and Filters Strip */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-4.5 flex flex-col md:flex-row items-center gap-4.5 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search camp by name, rent month, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/50 rounded-xl py-2.5 pl-11 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 placeholder-slate-400 text-slate-800"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Filter className="w-4 h-4" />
          <span>Showing {filteredCamps.length} camp contracts</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200/50 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-wider">
                <th className="py-4.5 px-6">S.No</th>
                <th className="py-4.5 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('campName')}>
                  <div className="flex items-center gap-1.5">
                    <span>Accommodation Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4.5 px-6 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('depositAmount')}>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Deposit (AED)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4.5 px-6 cursor-pointer hover:bg-slate-100 text-right" onClick={() => handleSort('rent')}>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Monthly Rent (AED)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4.5 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('rentMonth')}>
                  <div className="flex items-center gap-1.5">
                    <span>Rent Month</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4.5 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('dueDate')}>
                  <div className="flex items-center gap-1.5">
                    <span>Rent Due Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-4.5 px-6">Lease Term (Dates)</th>
                <th className="py-4.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCamps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold text-xs">
                    No camp accommodation records found. Click "Add New Camp Record" to get started.
                  </td>
                </tr>
              ) : (
                filteredCamps.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-700">
                    <td className="py-4.5 px-6 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                    <td className="py-4.5 px-6 font-extrabold text-slate-900">{item.campName}</td>
                    <td className="py-4.5 px-6 text-right font-mono text-emerald-650 font-bold">
                      {item.depositAmount ? Number(item.depositAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-4.5 px-6 text-right font-mono text-indigo-650 font-bold">
                      {Number(item.rent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4.5 px-6">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded text-[10px] uppercase">
                        {item.rentMonth}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 font-mono font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        <span>{item.dueDate}</span>
                      </span>
                    </td>
                    <td className="py-4.5 px-6 font-mono text-slate-500 text-[11px]">
                      <span className="block">{item.startDate} to {item.endDate}</span>
                      {item.description && (
                        <span className="block mt-0.5 text-[10px] text-slate-400 font-sans italic max-w-xs truncate">{item.description}</span>
                      )}
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.attachment && (
                          <button
                            onClick={() => setViewingAttachment({ doc: item.attachment!, name: item.campName })}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                            title="View Active Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(item)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          className="p-2 text-rose-650 hover:bg-rose-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Attachment Lightbox Viewer */}
      <AnimatePresence>
        {viewingAttachment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-[85vh] overflow-hidden border border-slate-200/50 shadow-2xl flex flex-col relative">
              {/* Head Section */}
              <div className="bg-slate-900 text-white px-6.5 py-5 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm tracking-tight">{viewingAttachment.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Camp Document Preview</p>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={viewingAttachment.doc} 
                    download={`CAMP_${viewingAttachment.name.replace(/\s+/g, '_')}_document`}
                    className="p-2 bg-slate-800 hover:bg-slate-705 text-slate-200 hover:text-white rounded-xl transition-all active:scale-95 flex items-center gap-1.5 text-xs font-black px-4"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </a>
                  <button 
                    onClick={() => setViewingAttachment(null)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Viewer Container */}
              <div className="flex-1 bg-slate-100 flex items-center justify-center p-6 overflow-auto">
                {viewingAttachment.doc.startsWith('data:application/pdf') || viewingAttachment.doc.includes('pdf') ? (
                  <iframe 
                    src={viewingAttachment.doc} 
                    className="w-full h-full rounded-2xl border-0 bg-white shadow"
                    title="PDF Document"
                  />
                ) : (
                  <img 
                    src={viewingAttachment.doc} 
                    alt="Camp Document" 
                    className="max-w-full max-h-full rounded-2xl object-contain shadow-lg bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface CampModalProps {
  camp: CampExpense | null;
  onSave: (camp: CampExpense) => void;
  onCancel: () => void;
}

export const CampModal: React.FC<CampModalProps> = ({
  camp,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    campName: camp?.campName || '',
    depositAmount: camp?.depositAmount || 0,
    rent: camp?.rent || 0,
    rentMonth: camp?.rentMonth || '',
    dueDate: camp?.dueDate || '',
    startDate: camp?.startDate || '',
    endDate: camp?.endDate || '',
    description: camp?.description || '',
    attachment: camp?.attachment || ''
  });

  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthsList = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const currentYearVal = new Date().getFullYear();
  const yearOptions = [currentYearVal - 1, currentYearVal, currentYearVal + 1, currentYearVal + 2];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setFormData(prev => ({ ...prev, attachment: b64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campName.trim()) {
      setValidationError('Accommodation Name is strictly required.');
      return;
    }
    if (!formData.rent || Number(formData.rent) <= 0) {
      setValidationError('Valid monthly Rent amount is required.');
      return;
    }
    if (!formData.dueDate) {
      setValidationError('Rent Due Date is required.');
      return;
    }

    onSave({
      id: camp?.id || `camp_${Date.now()}`,
      campName: formData.campName.trim(),
      depositAmount: Number(formData.depositAmount) || 0,
      rent: Number(formData.rent),
      rentMonth: formData.rentMonth || `${monthsList[new Date().getMonth()]} ${currentYearVal}`,
      dueDate: formData.dueDate,
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      endDate: formData.endDate || new Date(Date.now() + 31536000000).toISOString().split('T')[0],
      description: formData.description.trim(),
      attachment: formData.attachment
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-indigo-650 px-6.5 py-6 text-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg tracking-tight">
              {camp ? 'Modify Camp Record' : 'Create Camp Record'}
            </h3>
            <p className="text-indigo-100 text-[11px] font-semibold mt-0.5">
              Enter the corporate accommodation layout details.
            </p>
          </div>
          <button 
            onClick={onCancel}
            className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6.5 space-y-4">
          
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-650 rounded-xl text-xs font-bold leading-normal">
              {validationError}
            </div>
          )}

          {/* 1. Camp Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Accommodation Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Al-Quoz Industrial Camp A"
              value={formData.campName}
              onChange={(e) => setFormData({ ...formData, campName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-650"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 2. Deposit */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Deposit Amount (AED)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={formData.depositAmount || ''}
                onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-bold font-mono text-emerald-700 tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-650"
              />
            </div>

            {/* 3. Rent */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Monthly Rent (AED) *</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="0.00"
                value={formData.rent || ''}
                onChange={(e) => setFormData({ ...formData, rent: Number(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-bold font-mono text-indigo-700 tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-650"
              />
            </div>
          </div>

          {/* 4. Rent Month */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rent Month</label>
            <div className="flex gap-2">
              <select
                value={formData.rentMonth.split(' ')[0] || monthsList[new Date().getMonth()]}
                onChange={(e) => {
                  const currentYear = formData.rentMonth.split(' ')[1] || String(currentYearVal);
                  setFormData({ ...formData, rentMonth: `${e.target.value} ${currentYear}` });
                }}
                className="flex-1 bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
              >
                {monthsList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={formData.rentMonth.split(' ')[1] || String(currentYearVal)}
                onChange={(e) => {
                  const currentMonth = formData.rentMonth.split(' ')[0] || monthsList[new Date().getMonth()];
                  setFormData({ ...formData, rentMonth: `${currentMonth} ${e.target.value}` });
                }}
                className="w-28 bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 5. Due Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rent Due Date *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-mono font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* 6. Lease Start Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lease Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-mono font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 7. Lease End Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lease End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-mono font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* 8. Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Description / Contract No.</label>
              <input
                type="text"
                placeholder="Lease No, Landlord info..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-650"
              />
            </div>
          </div>

          {/* Attachment Upload Field */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Contract or Rent Payment Receipt (PDF / Image - Max 5MB)
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4.5 bg-slate-50/50 hover:bg-slate-50 text-center cursor-pointer transition-all space-y-1.5 focus:outline-none"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="application/pdf,image/*" 
                className="hidden" 
              />
              
              {formData.attachment ? (
                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-sm">
                  <div className="flex items-center gap-2 text-left min-w-0">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
                        Invoice Document Uploaded
                      </p>
                      <p className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Ready
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, attachment: '' }));
                    }}
                    className="p-1 px-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-1">
                  <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl mb-1.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-black text-slate-700">Upload or Drag Invoice document</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Supports PDFs, PNGs, JPGs up to 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5.5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-100 transition-all active:scale-95 cursor-pointer"
            >
              {camp ? 'Save Changes' : 'Create Record'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
