
import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Filter, Download, Plus, Edit, Trash2, 
  ChevronDown, X, FileText, Globe, Truck, 
  TrendingUp, TrendingDown, Wallet, Calendar,
  MoreVertical, Check, ListFilter, ArrowUpDown,
  FileSpreadsheet, ExternalLink, Paperclip, Printer, Eye, AlertTriangle,
  Camera, Upload, CheckCircle, AlertCircle, Clock, BarChart3, Percent, Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
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

    // Trigger active direct browser file savings
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

    // Dispatch system-wide event
    window.dispatchEvent(new CustomEvent('shiftsync-pdf-download', {
      detail: {
        filename: finalFilename,
        blobUrl: blobUrl,
        triggerDownload: triggerNativeDownload
      }
    }));

    return this;
  };
  (jsPDF.prototype as any).__isIntercepted = true;
}
import { cn, getPioneerPDFAssets } from '../utils';
import { Vendor, AccountsPayable, AccountsReceivable, PettyCash, 
  Supplier, Project, SystemUser, UserRole, ProjectedExpense, EverydayExpense 
} from '../types';
import { PrintModal, PrintOptions } from './PrintModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Downscale and compress an image file to prevent "Request Entity Too Large" errors
 * on mobile phone uploads or camera pictures while preserving high legibility for AI OCR.
 */
const compressImageFile = (file: File, maxDimension = 1200, quality = 0.85): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            // Only compress image files
            if (!file.type.startsWith('image/')) {
                resolve({ base64, mimeType: file.type });
                return;
            }

            const img = new Image();
            img.onload = () => {
                try {
                    let width = img.width;
                    let height = img.height;

                    // Only downscale if it exceeds maxDimension
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        } else {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve({ base64, mimeType: file.type });
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Use image/jpeg for excellent photographic/receipt compression
                    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                    const compressedBase64 = canvas.toDataURL(outputType, quality);
                    
                    // Only use compressed if it's actually smaller
                    if (compressedBase64.length < base64.length) {
                        resolve({ base64: compressedBase64, mimeType: outputType });
                    } else {
                        resolve({ base64, mimeType: file.type });
                    }
                } catch (err) {
                    console.error("Image compression failed, using original file:", err);
                    resolve({ base64, mimeType: file.type });
                }
            };
            img.onerror = () => {
                resolve({ base64, mimeType: file.type });
            };
            img.src = base64;
        };
        reader.onerror = () => {
            resolve({ base64: '', mimeType: file.type });
        };
        reader.readAsDataURL(file);
    });
};

interface DataTableProps<T> {
    title: string;
    description: string;
    icon: React.ElementType;
    data: T[];
    columns: {
        key: keyof T | string;
        label: string;
        render?: (item: T) => React.ReactNode;
        sortable?: boolean;
    }[];
    onAdd?: () => void;
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    onViewBill?: (item: T) => void;
    searchPlaceholder?: string;
    searchFields: (keyof T)[];
    exportFileName: string;
    user: SystemUser;
    filterOptions?: {
        key: keyof T | string;
        label: string;
        options: { label: string; value: string }[];
    }[];
}

export function DataTable<T extends { id: string }>({
    title,
    description,
    icon: Icon,
    data,
    columns,
    onAdd,
    onEdit,
    onDelete,
    onViewBill,
    searchPlaceholder = "Search...",
    searchFields,
    exportFileName,
    user,
    filterOptions = []
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = useMemo(() => {
        let result = [...data];

        // Search
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            result = result.filter(item => 
                searchFields.some(field => {
                    const value = item[field];
                    return value && String(value).toLowerCase().includes(query);
                })
            );
        }

        // Filters
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (value) {
                result = result.filter(item => String((item as any)[key]) === value);
            }
        });

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key];
                const bVal = (b as any)[sortConfig.key];
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [data, searchTerm, searchFields, activeFilters, sortConfig]);

    const handleExport = () => {
        const exportData = filteredData.map(item => {
            const row: any = {};
            columns.forEach(col => {
                if (typeof col.key === 'string') {
                    row[col.label] = (item as any)[col.key];
                }
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `${exportFileName}.xlsx`);
    };

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const handlePrintClick = () => {
        setIsPrintModalOpen(true);
    };

    const handlePrintWithConfig = (options: PrintOptions) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { 
                            size: ${options.orientation}; 
                            margin: ${options.margins === 'none' ? '0' : options.margins === 'minimum' ? '5mm' : '20mm'}; 
                        }
                        body { 
                            font-family: sans-serif; 
                            color: #333; 
                            filter: ${options.colorMode === 'mono' ? 'grayscale(100%) !important' : 'none'};
                            ${options.fitToPaper ? 'zoom: 92%; max-width: 100%;' : ''}
                            -webkit-print-color-adjust: ${options.bgGraphics ? 'exact' : 'unset'} !important;
                            print-color-adjust: ${options.bgGraphics ? 'exact' : 'unset'} !important;
                        }
                        ${options.highContrast ? `
                            * {
                                color: #000000 !important;
                                background-color: #ffffff !important;
                                border-color: #000000 !important;
                            }
                        ` : ''}
                        h1 { text-align: center; color: #000; margin-bottom: 5px; }
                        p { text-align: center; color: #666; margin-bottom: 20px; font-size: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
                        th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
                        tr:nth-child(even) { background-color: #fafafa; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p>${description}</p>
                    <table>
                        <thead>
                            <tr>
                                ${columns.map(col => `<th>${col.label}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredData.map(item => `
                                <tr>
                                    ${columns.map(col => {
                                        const val = (item as any)[col.key];
                                        return `<td>${val !== undefined && val !== null ? val : ''}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-[0.2em]">
                        <Icon className="w-4 h-4" />
                        Finance & Operations
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">{title}</h1>
                    <p className="text-slate-500 font-medium max-w-xl">{description}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export Excel
                    </button>
                    <button 
                        onClick={handlePrintClick}
                        className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Print A4
                    </button>
                    {onAdd && (
                        <button 
                            onClick={onAdd}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all active:scale-95 shadow-lg shadow-brand-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add New
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-sm"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                isFilterOpen || Object.values(activeFilters).some(v => v) ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-slate-100"
                            )}
                        >
                            <ListFilter className="w-4 h-4" />
                            Filters
                            {Object.values(activeFilters).filter(v => v).length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-brand-600 text-white text-[10px] rounded-full">
                                    {Object.values(activeFilters).filter(v => v).length}
                                </span>
                            )}
                        </button>
                        {Object.values(activeFilters).some(v => v) && (
                            <button 
                                onClick={() => setActiveFilters({})}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {isFilterOpen && filterOptions.length > 0 && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-6 py-4 bg-slate-50 border-b border-slate-100 overflow-hidden"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {filterOptions.map(filter => (
                                    <div key={String(filter.key)} className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{filter.label}</label>
                                        <select 
                                            value={activeFilters[String(filter.key)] || ''}
                                            onChange={e => setActiveFilters({ ...activeFilters, [String(filter.key)]: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                        >
                                            <option value="">All {filter.label}</option>
                                            {filter.options.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                {columns.map((col) => (
                                    <th 
                                        key={String(col.key)}
                                        className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"
                                    >
                                        <div 
                                            className={cn(
                                                "flex items-center gap-2",
                                                col.sortable && "cursor-pointer hover:text-slate-600 transition-colors"
                                            )}
                                            onClick={() => col.sortable && handleSort(String(col.key))}
                                        >
                                            {col.label}
                                            {col.sortable && <ArrowUpDown className="w-3 h-3" />}
                                        </div>
                                    </th>
                                ))}
                                {(onEdit || onDelete || onViewBill) && (
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    {columns.map((col) => (
                                        <td key={String(col.key)} className="px-6 py-5 text-sm font-bold text-slate-600">
                                            {col.render ? col.render(item) : String((item as any)[col.key] || '-')}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete || onViewBill) && (
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {onViewBill && (item as any).attachment && (
                                                    <button 
                                                        onClick={() => onViewBill(item)}
                                                        className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-brand-600 transition-all shadow-sm border border-transparent hover:border-slate-100"
                                                        title="View Attached Bill"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onEdit && (
                                                    <button 
                                                        onClick={() => onEdit(item)}
                                                        className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-brand-600 transition-all shadow-sm border border-transparent hover:border-slate-100"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button 
                                                        onClick={() => onDelete(item)}
                                                        className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-red-600 transition-all shadow-sm border border-transparent hover:border-slate-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                <Search className="w-8 h-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-bold">No records found matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PrintModal 
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                onPrint={handlePrintWithConfig}
                title={`Print ${title}`}
            />
        </div>
    );
}

// --- Specific Views ---

export const VendorView = ({ vendors, onAdd, onEdit, onDelete, user }: any) => (
    <DataTable<Vendor>
        title="Clients"
        description="Manage your third-party service providers and material clients."
        icon={Truck}
        data={vendors}
        columns={[
            { key: 'code', label: 'Code', sortable: true },
            { key: 'name', label: 'Client Name', sortable: true },
            { key: 'contactPerson', label: 'Contact Person' },
            { key: 'trn', label: 'TRN (VAT)', render: (item) => <span className="font-mono text-slate-600 font-extrabold">{item.trn || '-'}</span> },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'category', label: 'Category', sortable: true },
        ]}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        searchFields={['name', 'code', 'contactPerson', 'email', 'trn']}
        exportFileName="Vendors_List"
        user={user}
    />
);

export const AccountsPayableView = ({ data, vendors, suppliers, projects, onAdd, onEdit, onDelete, user, companies }: any) => {
    const [activeTabMode, setActiveTabMode] = useState<'ledger' | 'insights' | 'soa'>('ledger');
    const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null);

    // Advanced Filter State variables
    const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterVendor, setFilterVendor] = useState('All');
    const [filterProject, setFilterProject] = useState('All');
    const [filterMonth, setFilterMonth] = useState('All');

    // SOA Tool state variables
    const [soaVendorId, setSoaVendorId] = useState('All');
    const [soaProjectId, setSoaProjectId] = useState('All');
    const [soaStartDate, setSoaStartDate] = useState('');
    const [soaEndDate, setSoaEndDate] = useState('');
    const [soaScope, setSoaScope] = useState<'All' | 'Paid' | 'Pending'>('All');
    const [soaCompanyId, setSoaCompanyId] = useState('All');

    const apPartnerOptions = useMemo(() => {
        const supplierGroups: { [name: string]: any[] } = {};
        (suppliers || []).forEach((s: any) => {
            const nameKey = (s.name || '').trim();
            if (!supplierGroups[nameKey]) supplierGroups[nameKey] = [];
            supplierGroups[nameKey].push(s);
        });

        const vendorGroups: { [name: string]: any[] } = {};
        (vendors || []).forEach((v: any) => {
            const nameKey = (v.name || '').trim();
            if (!vendorGroups[nameKey]) vendorGroups[nameKey] = [];
            vendorGroups[nameKey].push(v);
        });

        const options: { value: string; label: string }[] = [];

        // Add unified group options for suppliers
        Object.entries(supplierGroups).forEach(([name]) => {
            options.push({
                value: `BY_NAME:${name}`,
                label: `🌟 ${name} (All Consolidated Projects) (Supplier)`
            });
        });

        // Add unified group options for vendors
        Object.entries(vendorGroups).forEach(([name]) => {
            options.push({
                value: `BY_NAME:${name}`,
                label: `🌟 ${name} (All Consolidated Projects) (Client)`
            });
        });

        // Add individual supplier options
        (suppliers || []).forEach((s: any) => {
            options.push({
                value: s.id,
                label: `📄 ${s.name} (Code: ${s.code || 'N/A'}) (Supplier)`
            });
        });

        // Add individual vendor options
        (vendors || []).forEach((v: any) => {
            options.push({
                value: v.id,
                label: `📄 ${v.name} (Code: ${v.code || 'N/A'}) (Client)`
            });
        });

        return options;
    }, [suppliers, vendors]);

    const getVendorName = (id: string, type: string) => {
        if (type === 'Supplier') {
            const s = suppliers.find((s: any) => s.id === id);
            return s ? (s.code ? `${s.name} (${s.code})` : s.name) : 'Unknown';
        }
        const v = vendors.find((v: any) => v.id === id);
        return v ? (v.code ? `${v.name} (${v.code})` : v.name) : 'Unknown';
    };

    const getProjectName = (id?: string) => {
        if (!id) return '-';
        return projects.find((p: any) => p.id === id)?.name || 'N/A';
    };

    // Calculate unique available months in dataset for entries
    const availableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        (data || []).forEach((item: any) => {
            if (item.date) {
                monthsSet.add(item.date.substring(0, 7)); // YYYY-MM
            }
        });
        return Array.from(monthsSet).sort().reverse();
    }, [data]);

    // Apply Advanced Filters to dataset
    const filteredData = useMemo(() => {
        return (data || []).filter((item: any) => {
            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;

            const amount = item.totalAmount || item.amount || 0;
            if (minAmount !== '' && amount < Number(minAmount)) return false;
            if (maxAmount !== '' && amount > Number(maxAmount)) return false;

            if (filterStatus !== 'All' && item.status !== filterStatus) return false;
            if (filterProject !== 'All' && item.projectId !== filterProject) return false;
            
            if (filterVendor !== 'All') {
                if (item.vendorId !== filterVendor) return false;
            }

            if (filterMonth !== 'All') {
                const m = item.date.substring(0, 7);
                if (m !== filterMonth) return false;
            }

            return true;
        });
    }, [data, startDate, endDate, minAmount, maxAmount, filterStatus, filterVendor, filterProject, filterMonth]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (startDate) count++;
        if (endDate) count++;
        if (minAmount !== '') count++;
        if (maxAmount !== '') count++;
        if (filterStatus !== 'All') count++;
        if (filterVendor !== 'All') count++;
        if (filterProject !== 'All') count++;
        if (filterMonth !== 'All') count++;
        return count;
    }, [startDate, endDate, minAmount, maxAmount, filterStatus, filterVendor, filterProject, filterMonth]);

    const handleClearAdvFilters = () => {
        setStartDate('');
        setEndDate('');
        setMinAmount('');
        setMaxAmount('');
        setFilterStatus('All');
        setFilterVendor('All');
        setFilterProject('All');
        setFilterMonth('All');
    };

    // Calculate dynamic high-level metrics based on filtered data to stay in sync
    const metrics = useMemo(() => {
        let totalBills = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let totalVat = 0;

        (filteredData || []).forEach((item: any) => {
            const amount = item.totalAmount || item.amount || 0;
            const vat = item.vatAmount || 0;
            totalBills += amount;
            totalVat += vat;

            if (item.status === 'Paid') {
                totalPaid += amount;
            } else {
                totalPending += amount;
            }
        });

        return {
            totalBills,
            totalPaid,
            totalPending,
            totalVat,
            count: filteredData?.length || 0,
            pendingCount: (filteredData || []).filter((item: any) => item.status !== 'Paid').length,
            paidCount: (filteredData || []).filter((item: any) => item.status === 'Paid').length
        };
    }, [filteredData]);

    // Aging Buckets Calculation
    const agingBuckets = useMemo(() => {
        const buckets: { [key: string]: { label: string; amount: number; count: number; color: string; desc: string; items: any[] } } = {
            current: { label: 'Current / Not Due', amount: 0, count: 0, color: 'bg-emerald-500', desc: 'Bills within standard terms', items: [] },
            days30: { label: '1 - 30 Days Due', amount: 0, count: 0, color: 'bg-indigo-500', desc: 'Overdue up to 1 month', items: [] },
            days60: { label: '31 - 60 Days Due', amount: 0, count: 0, color: 'bg-amber-500', desc: 'Overdue 1 to 2 months', items: [] },
            days90: { label: '61 - 90 Days Due', amount: 0, count: 0, color: 'bg-orange-500', desc: 'Overdue 2 to 3 months', items: [] },
            daysOver90: { label: '90+ Days Overdue', amount: 0, count: 0, color: 'bg-rose-500', desc: 'Unpaid bills over 90 days', items: [] }
        };

        const today = new Date();
        today.setHours(0,0,0,0);

        (filteredData || []).forEach((item: any) => {
            // Only non-Paid items belong to aging
            if (item.status === 'Paid') return;

            const refDateStr = item.dueDate || item.date;
            if (!refDateStr) return;

            const refDate = new Date(refDateStr);
            refDate.setHours(0,0,0,0);

            const diffTime = today.getTime() - refDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const amount = item.totalAmount || item.amount || 0;

            if (diffDays <= 0) {
                buckets.current.amount += amount;
                buckets.current.count += 1;
                buckets.current.items.push(item);
            } else if (diffDays <= 30) {
                buckets.days30.amount += amount;
                buckets.days30.count += 1;
                buckets.days30.items.push(item);
            } else if (diffDays <= 60) {
                buckets.days60.amount += amount;
                buckets.days60.count += 1;
                buckets.days60.items.push(item);
            } else if (diffDays <= 90) {
                buckets.days90.amount += amount;
                buckets.days90.count += 1;
                buckets.days90.items.push(item);
            } else {
                buckets.daysOver90.amount += amount;
                buckets.daysOver90.count += 1;
                buckets.daysOver90.items.push(item);
            }
        });

        return buckets;
    }, [filteredData]);

    const totalAgingAmount = Object.values(agingBuckets).reduce((acc, curr) => acc + curr.amount, 0);
    const activeAgingList = selectedAgingBucket ? agingBuckets[selectedAgingBucket]?.items || [] : [];
    const activeAgingLabel = selectedAgingBucket ? agingBuckets[selectedAgingBucket]?.label : '';

    // Monthly Trends Calculation
    const monthlyTrends = useMemo(() => {
        const trends: { [key: string]: { label: string; bBilled: number; pPaid: number; pPending: number; itemsCount: number } } = {};

        (filteredData || []).forEach((item: any) => {
            const dateStr = item.date;
            if (!dateStr) return;

            const monthKey = dateStr.substring(0, 7); // YYYY-MM
            if (!trends[monthKey]) {
                const [yr, mn] = monthKey.split('-');
                const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
                const humanLabel = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                trends[monthKey] = {
                    label: humanLabel,
                    bBilled: 0,
                    pPaid: 0,
                    pPending: 0,
                    itemsCount: 0
                };
            }

            const amount = item.totalAmount || item.amount || 0;
            trends[monthKey].bBilled += amount;
            trends[monthKey].itemsCount += 1;

            if (item.status === 'Paid') {
                trends[monthKey].pPaid += amount;
            } else {
                trends[monthKey].pPending += amount;
            }
        });

        return Object.keys(trends)
            .sort()
            .map(key => ({
                key,
                ...trends[key]
            }));
    }, [filteredData]);

    // Statement of Account Items filter logic
    const soaFilteredItems = useMemo(() => {
        return (data || []).filter((item: any) => {
            // Must match selected vendor
            if (soaVendorId !== 'All') {
                if (soaVendorId.startsWith('BY_NAME:')) {
                    const targetName = soaVendorId.replace('BY_NAME:', '').toLowerCase().trim();
                    const actualVendorObj = item.vendorType === 'Supplier'
                        ? suppliers.find((s: any) => s.id === item.vendorId)
                        : vendors.find((v: any) => v.id === item.vendorId);
                    if (!actualVendorObj || actualVendorObj.name.toLowerCase().trim() !== targetName) return false;
                } else {
                    if (item.vendorId !== soaVendorId) return false;
                }
            }
            
            // Must match selected seller company
            if (soaCompanyId !== 'All' && item.companyId !== soaCompanyId) return false;

            // Must match selected project
            if (soaProjectId !== 'All' && item.projectId !== soaProjectId) return false;

            // Date limits
            if (soaStartDate && item.date < soaStartDate) return false;
            if (soaEndDate && item.date > soaEndDate) return false;

            // Settlement scope
            if (soaScope === 'Paid' && item.status !== 'Paid') return false;
            if (soaScope === 'Pending' && item.status === 'Paid') return false;

            return true;
        });
    }, [data, soaVendorId, soaProjectId, soaStartDate, soaEndDate, soaScope, soaCompanyId, suppliers, vendors]);

    // Executing EXCEL Download for specific month
    const executeDownloadMonthExcel = (mKey: string) => {
        const monthItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
        const reportRows = monthItems.map((item: any) => ({
            "Bill Date": item.date,
            "Invoice #": item.invoiceNumber || '-',
            "Supplier / Client": getVendorName(item.vendorId, item.vendorType),
            "Supplier ID": item.vendorId || '-',
            "Partner Category": item.vendorType || 'Vendor',
            "Project": getProjectName(item.projectId),
            "Excl. Amount (AED)": item.amount || 0,
            "VAT Amount (5%)": item.vatAmount || 0,
            "Total Invoiced (AED)": item.totalAmount || item.amount || 0,
            "Payment Status": item.status,
            "Payment Due Date": item.dueDate || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(reportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `AP_Ledger_${mKey}`);
        XLSX.writeFile(wb, `Accounts_Payable_Register_${mKey}.xlsx`);
    };

    // Executing PDF Download for specific month
    const executeDownloadMonthPDF = (mKey: string) => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add Watermark Logo
        const assets = getPioneerPDFAssets();
        if (assets.watermark) {
            doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
        }

        const monthItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
        const [yr, mn] = mKey.split('-');
        const mLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });

        doc.setFillColor(190, 24, 74); // Crimson header stripe 
        doc.rect(0, 0, 210, 6, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(`ACCOUNTS PAYABLE JOURNAL REGISTER - ${mLabel.toUpperCase()}`, 15, 18);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Category: Accounts Payable Ledger Outflows | Generated: ${new Date().toLocaleDateString()}`, 15, 23);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 27, 195, 27);

        // Build Table header
        const tableHeaderY = 32;
        doc.setFillColor(190, 24, 74);
        doc.rect(15, tableHeaderY, 180, 8, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text("BILL DATE", 18, tableHeaderY + 5.5);
        doc.text("INVOICE #", 38, tableHeaderY + 5.5);
        doc.text("SUPPLIER PARTNER", 65, tableHeaderY + 5.5);
        doc.text("PROJECT", 115, tableHeaderY + 5.5);
        doc.text("STATUS", 150, tableHeaderY + 5.5);
        doc.text("TOTAL (AED)", 192, tableHeaderY + 5.5, { align: 'right' });

        let currentY = tableHeaderY + 8;
        monthItems.forEach((itm: any, idx: number) => {
            if (currentY > 270) {
                doc.addPage();
                doc.setFillColor(190, 24, 74);
                doc.rect(0, 0, 210, 6, 'F');
                currentY = 15;
            }

            if (idx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, currentY, 180, 8, 'F');
            }

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);

            doc.text(itm.date || '', 18, currentY + 5.5);
            doc.setFont("Helvetica", "bold");
            doc.text(itm.invoiceNumber || '-', 38, currentY + 5.5);
            
            doc.setFont("Helvetica", "normal");
            const nameText = getVendorName(itm.vendorId, itm.vendorType);
            doc.text(nameText.length > 25 ? nameText.substring(0, 23) + '..' : nameText, 65, currentY + 5.5);
            
            const projText = getProjectName(itm.projectId);
            doc.text(projText.length > 20 ? projText.substring(0, 18) + '..' : projText, 115, currentY + 5.5);

            const isP = itm.status === 'Paid';
            if (isP) {
                doc.setTextColor(16, 124, 65);
            } else {
                doc.setTextColor(220, 95, 0);
            }
            doc.setFont("Helvetica", "bold");
            doc.text(itm.status || 'Pending', 150, currentY + 5.5);
            
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(30, 41, 59);
            const tot = itm.totalAmount || itm.amount || 0;
            doc.setFont("Helvetica", "bold");
            doc.text(tot.toLocaleString(), 192, currentY + 5.5, { align: 'right' });

            currentY += 8;
        });

        const sumTotal = monthItems.reduce((acc: number, curr: any) => acc + (curr.totalAmount || curr.amount || 0), 0);
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY + 2, 180, 9, 'F');
        doc.setFont("Helvetica", "bold");
        doc.text("SUMMARY TOTAL", 18, currentY + 8);
        doc.text(`AED ${sumTotal.toLocaleString()}`, 192, currentY + 8, { align: 'right' });

        doc.save(`Accounts_Payable_Journal_${mKey}.pdf`);
    };

    // Bulk Multi-Sheet Excel download
    const handleDownloadAllMonthsConsolidated = () => {
        const wb = XLSX.utils.book_new();
        availableMonths.forEach((mKey) => {
            const mItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
            const rows = mItems.map((item: any) => ({
                "Bill Date": item.date,
                "Invoice Number": item.invoiceNumber || '-',
                "Supplier Partner": getVendorName(item.vendorId, item.vendorType),
                "Project": getProjectName(item.projectId),
                "Amount (AED)": item.amount || 0,
                "VAT (5%)": item.vatAmount || 0,
                "Total Amount (AED)": item.totalAmount || item.amount || 0,
                "Status": item.status,
                "Due Date": item.dueDate || '-'
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const [yr, mn] = mKey.split('-');
            const mLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
            XLSX.utils.book_append_sheet(wb, ws, mLabel.substring(0, 31));
        });
        XLSX.writeFile(wb, "Accounts_Payable_Consolidated_Monthly_Workbook.xlsx");
    };

    // SOA Generation Handlers
    const handleGenerateSOAPDF = () => {
        let pName = 'All Combined Suppliers';
        let pTrn = 'Multiple / N/A';
        let pType = 'Supplier Network';

        if (soaVendorId !== 'All') {
            let foundSup: any = null;
            let foundVen: any = null;
            if (soaVendorId.startsWith('BY_NAME:')) {
                const targetName = soaVendorId.replace('BY_NAME:', '').toLowerCase().trim();
                foundSup = suppliers.find((s: any) => s.name.toLowerCase().trim() === targetName);
                foundVen = vendors.find((v: any) => v.name.toLowerCase().trim() === targetName);
                if (!foundSup && !foundVen) {
                    foundSup = { name: soaVendorId.replace('BY_NAME:', ''), trn: 'Multiple / N/A' };
                }
            } else {
                foundSup = suppliers.find((s: any) => s.id === soaVendorId);
                foundVen = vendors.find((v: any) => v.id === soaVendorId);
            }
            pName = foundSup?.name || foundVen?.name || 'Selected Supplier';
            pTrn = foundSup?.trn || foundVen?.trn || 'Not Registered';
            pType = foundSup ? 'Contracted Supplier' : 'Vendor Service';
        }

        let projName = 'All Combined Projects';
        if (soaProjectId !== 'All') {
            projName = getProjectName(soaProjectId);
        }

        const periodStr = (soaStartDate || soaEndDate) 
            ? `${soaStartDate || 'Origin'} to ${soaEndDate || 'Present'}`
            : 'Complete Recorded Operations History';

        // Summary Calculations
        let totalBilled = 0;
        let totalPaid = 0;
        soaFilteredItems.forEach((itm: any) => {
            const amt = itm.totalAmount || itm.amount || 0;
            totalBilled += amt;
            if (itm.status === 'Paid') {
                totalPaid += amt;
            }
        });
        const balance = totalBilled - totalPaid;

        let selectedCompanyObj = (companies || []).find((c: any) => c.id === soaCompanyId);
        if (!selectedCompanyObj && soaFilteredItems.length > 0) {
            const firstItem = soaFilteredItems[0];
            selectedCompanyObj = (companies || []).find((c: any) => c.id === firstItem.companyId || c.name === firstItem.companyName);
        }
        if (!selectedCompanyObj && companies && companies.length > 0) {
            selectedCompanyObj = companies[0];
        }

        generatePdfSOA({
            title: "SUPPLIER STATEMENT OF ACCOUNT (SOA)",
            partnerName: pName,
            partnerType: pType,
            partnerTrn: pTrn,
            projectName: projName,
            periodStr,
            items: soaFilteredItems,
            totalBilled,
            totalPaid,
            balance,
            isReceivable: false,
            companyName: selectedCompanyObj?.name,
            companyLogo: selectedCompanyObj?.logo,
            companyAddress: selectedCompanyObj?.address,
            companyEmail: selectedCompanyObj?.email,
            companyPhone: selectedCompanyObj?.phone
        });
    };

    const handleGenerateSOAExcel = () => {
        let pName = 'All Combined Suppliers';
        let pType = 'Supplier Network';

        if (soaVendorId !== 'All') {
            if (soaVendorId.startsWith('BY_NAME:')) {
                const targetName = soaVendorId.replace('BY_NAME:', '').toLowerCase().trim();
                const foundSup = suppliers.find((s: any) => s.name.toLowerCase().trim() === targetName);
                const foundVen = vendors.find((v: any) => v.name.toLowerCase().trim() === targetName);
                pName = foundSup?.name || foundVen?.name || soaVendorId.replace('BY_NAME:', '');
                pType = foundSup ? 'Supplier' : 'Client';
            } else {
                const foundSup = suppliers.find((s: any) => s.id === Math.random); // wait, foundSup is suppliers.find(s => s.id === soaVendorId)
                const foundVen = vendors.find((v: any) => v.id === soaVendorId);
                const foundSupReal = suppliers.find((s: any) => s.id === soaVendorId);
                pName = foundSupReal?.name || foundVen?.name || 'Selected Supplier';
                pType = foundSupReal ? 'Supplier' : 'Client';
            }
        }

        downloadSOAExcel(soaVendorId, pName, pType, soaFilteredItems, false);
    };

    return (
        <div className="relative space-y-6">
            
            {/* Header with Mode Toggles */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 border border-slate-100 rounded-3xl gap-4 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <TrendingDown className="w-6 h-6 text-rose-600" />
                        <span>Supplier Accounts Payable</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">Track supplier liabilities, outstanding aged bills, and payment outflows.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/45 shrink-0">
                    <button 
                        onClick={() => setActiveTabMode('ledger')}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'ledger' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        📋 Bill Ledger Table
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTabMode('insights');
                            setSelectedAgingBucket('days30'); // Default to 1-30 days overdue
                        }}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'insights' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        📊 Aging & Monthly Reports
                    </button>
                    <button 
                        onClick={() => setActiveTabMode('soa')}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'soa' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        📄 Statement of Account (SOA)
                    </button>
                </div>
            </div>

            {/* Financial Summary Ribbons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-blue-100 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Total Supplier Bills</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalBills.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono">Billed count: {metrics.count} invoices</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-emerald-100 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Cleared Outflows (Paid)</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-2 font-mono">
                        Payment rate: {metrics.totalBills > 0 ? ((metrics.totalPaid / metrics.totalBills) * 100).toFixed(1) : 0}% ({metrics.paidCount} paid)
                    </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-rose-100 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Aged Supplier Payables</span>
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-2xl">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalPending.toLocaleString()}</p>
                    <p className="text-[10px] text-rose-600 font-bold mt-2 font-mono">
                        {metrics.totalBills > 0 ? ((metrics.totalPending / metrics.totalBills) * 100).toFixed(1) : 0}% outstanding ({metrics.pendingCount} unpaid)
                    </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-slate-200 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">5% Input Tax (Recoverable)</span>
                        <div className="p-2 bg-slate-50 text-slate-600 rounded-2xl">
                            <Percent className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalVat.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono">Claimable VAT on ledger</p>
                </div>
            </div>

            {/* Main Dynamic Panel */}
            {activeTabMode === 'ledger' ? (
                <div className="space-y-4">
                    {/* Advanced Filter Controller */}
                    <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-rose-600" />
                                <span className="font-extrabold text-sm text-slate-800">Advanced Filter Controls</span>
                                {activeFiltersCount > 0 && (
                                    <span className="bg-rose-100 text-rose-700 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full">
                                        {activeFiltersCount} Filters applied
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {activeFiltersCount > 0 && (
                                    <button 
                                        onClick={handleClearAdvFilters}
                                        className="text-[11px] font-bold text-slate-450 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-xl transition-all cursor-pointer"
                                    >
                                        Reset All
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsAdvFilterOpen(!isAdvFilterOpen)}
                                    className="text-white bg-slate-800 hover:bg-slate-900 font-bold text-xs px-4 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                                >
                                    {isAdvFilterOpen ? "Hide Filter Dashboard" : "Show Advanced Filters"}
                                </button>
                            </div>
                        </div>

                        {isAdvFilterOpen && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs animate-fadeIn">
                                {/* Date Start & End */}
                                <div className="space-y-1">
                                    <label className="block text-slate-405 font-mono font-bold uppercase text-[9px]">Date Period</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="date" 
                                            value={startDate} 
                                            onChange={e => setStartDate(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-hidden font-medium"
                                        />
                                        <input 
                                            type="date" 
                                            value={endDate} 
                                            onChange={e => setEndDate(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-hidden font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Amount Range Threshold */}
                                <div className="space-y-1">
                                    <label className="block text-slate-405 font-mono font-bold uppercase text-[9px]">Amount Range (AED)</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="number" 
                                            placeholder="Min Amount" 
                                            value={minAmount} 
                                            onChange={e => setMinAmount(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-750 outline-hidden font-medium"
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Max Amount" 
                                            value={maxAmount} 
                                            onChange={e => setMaxAmount(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-750 outline-hidden font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Partner & Project Selectors */}
                                <div className="space-y-1">
                                    <label className="block text-slate-405 font-mono font-bold uppercase text-[9px]">Supplier Entity & project</label>
                                    <div className="flex gap-1.5">
                                        <select 
                                            value={filterVendor} 
                                            onChange={e => setFilterVendor(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer"
                                        >
                                            <option value="All">All Suppliers</option>
                                            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                                            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>)}
                                        </select>
                                        <select 
                                            value={filterProject} 
                                            onChange={e => setFilterProject(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer"
                                        >
                                            <option value="All">All Projects</option>
                                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Status & Quick Month dropdowns */}
                                <div className="space-y-1">
                                    <label className="block text-slate-405 font-mono font-bold uppercase text-[9px]">Status & Billing Month</label>
                                    <div className="flex gap-1.5">
                                        <select 
                                            value={filterStatus} 
                                            onChange={e => setFilterStatus(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer"
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Paid">Paid</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                        <select 
                                            value={filterMonth} 
                                            onChange={e => setFilterMonth(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer"
                                        >
                                            <option value="All">All Months</option>
                                            {availableMonths.map((m: string) => {
                                                const [yr, mn] = m.split('-');
                                                const dLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                                return <option key={m} value={m}>{dLabel}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DataTable<AccountsPayable>
                        title="Accounts Payable Ledger"
                        description="Filtered list of supplier billings and payments matching specified constraints."
                        icon={TrendingDown}
                        data={filteredData}
                        columns={[
                            { key: 'date', label: 'Date', sortable: true },
                            { key: 'invoiceNumber', label: 'Invoice #', sortable: true },
                            { 
                                key: 'vendorId', 
                                label: 'Client/Supplier',
                                render: (item) => (
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">{getVendorName(item.vendorId, item.vendorType)}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.vendorType === 'Vendor' ? 'Client' : item.vendorType}</span>
                                    </div>
                                )
                            },
                            { 
                                key: 'projectId', 
                                label: 'Project',
                                render: (item) => getProjectName(item.projectId)
                            },
                            { 
                                key: 'amount', 
                                label: 'Amount',
                                sortable: true,
                                render: (item) => (
                                    <span className="font-bold text-slate-600">AED {item.amount.toLocaleString()}</span>
                                )
                            },
                            { 
                                key: 'vatAmount', 
                                label: 'VAT (5%)',
                                render: (item) => (
                                    <span className="text-slate-400">AED {(item.vatAmount || 0).toLocaleString()}</span>
                                )
                            },
                            { 
                                key: 'totalAmount', 
                                label: 'Total',
                                sortable: true,
                                render: (item) => (
                                    <span className="font-black text-slate-900">AED {(item.totalAmount || item.amount).toLocaleString()}</span>
                                )
                            },
                            { 
                                key: 'status', 
                                label: 'Status',
                                render: (item) => (
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                        item.status === 'Paid' ? "bg-emerald-100 text-emerald-600" :
                                        item.status === 'Pending' ? "bg-orange-100 text-orange-600" :
                                        "bg-blue-100 text-blue-600"
                                    )}>
                                        {item.status}
                                    </span>
                                )
                            },
                        ]}
                        onAdd={onAdd}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        searchFields={['invoiceNumber', 'description']}
                        exportFileName="Accounts_Payable"
                        user={user}
                    />
                </div>
            ) : activeTabMode === 'insights' ? (
                <div className="space-y-6">
                    {/* Interactive Aging Wheel & Progress metrics */}
                    <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 gap-3">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                                    <span>Supplier Aging Analysis Tracker</span>
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">Click on any age group to view detailed outstanding supplier bills.</p>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <button
                                        onClick={() => downloadAgingAndMonthlyExcel(false, agingBuckets, monthlyTrends, getVendorName, getProjectName)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span>Export Excel</span>
                                    </button>
                                    <button
                                        onClick={() => downloadAgingAndMonthlyPDF(false, agingBuckets, monthlyTrends, totalAgingAmount, getVendorName, getProjectName)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Download PDF</span>
                                    </button>
                                    <button
                                        onClick={() => printAgingAndMonthlyReport(false, agingBuckets, monthlyTrends, totalAgingAmount, getVendorName, getProjectName)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Print Report</span>
                                    </button>
                                </div>
                            </div>
                            <div className="text-left md:text-right bg-slate-50 border border-slate-100 rounded-2xl p-3 shrink-0">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono">Total Unpaid Outflows</span>
                                <h4 className="text-xl font-black text-slate-800 font-mono">AED {totalAgingAmount.toLocaleString()}</h4>
                            </div>
                        </div>

                        {/* Interactive Aging Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {Object.entries(agingBuckets).map(([key, bucket]) => {
                                const selected = selectedAgingBucket === key;
                                const pctOfTotal = totalAgingAmount > 0 ? (bucket.amount / totalAgingAmount) * 100 : 0;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedAgingBucket(key)}
                                        className={cn(
                                            "flex flex-col text-left p-4 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden",
                                            selected 
                                                ? "border-rose-600 bg-rose-50/20 shadow-md shadow-rose-600/5 scale-[1.02]" 
                                                : "border-slate-100 hover:border-slate-300 bg-white"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">
                                                {bucket.label}
                                            </span>
                                            {bucket.count > 0 && (
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded-lg text-[9px] font-black text-white shrink-0 font-mono",
                                                    bucket.color
                                                )}>
                                                    {bucket.count}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[16px] font-black text-slate-900 leading-none">AED {bucket.amount.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1.5 font-mono">{pctOfTotal.toFixed(1)}% of total</p>
                                        
                                        {/* Colored Progress Bar Segment */}
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                                            <div 
                                                className={cn("h-full rounded-full", bucket.color)} 
                                                style={{ width: `${pctOfTotal}%` }} 
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected Aging Bucket Details */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedAgingBucket || 'none'}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-slate-50/80 border border-slate-100 rounded-3xl p-5 md:p-6"
                            >
                                <div className="flex justify-between items-center border-b border-slate-200/50 pb-4 mb-4">
                                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                        <span className="inline-block w-2.5 h-2.5 bg-rose-600 rounded-full animate-pulse" />
                                        <span>Details for Group:</span>
                                        <strong className="text-rose-600">{activeAgingLabel}</strong>
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-bold font-mono">
                                        {activeAgingList.length} supplier invoices in this bucket
                                    </span>
                                </div>

                                {activeAgingList.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400">
                                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                        <p className="font-extrabold text-slate-700 text-sm">No Outstanding Liabilities!</p>
                                        <p className="text-[11px] text-slate-400 font-medium">All supplier bills in this aging group have been cleared.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                                    <th className="py-3 px-2">Invoice #</th>
                                                    <th className="py-3 px-2">Supplier Name</th>
                                                    <th className="py-3 px-2">Project</th>
                                                    <th className="py-3 px-2">Bill Date</th>
                                                    <th className="py-3 px-2">Due Date</th>
                                                    <th className="py-3 px-2">Aged Overdue</th>
                                                    <th className="py-3 px-2 text-right">Liability Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-150">
                                                {activeAgingList.map((item: any) => {
                                                    const today = new Date();
                                                    today.setHours(0,0,0,0);
                                                    const refDate = new Date(item.dueDate || item.date);
                                                    const diffDays = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

                                                    return (
                                                        <tr key={item.id} className="text-xs hover:bg-slate-100/50 transition-colors">
                                                            <td className="py-3.5 px-2 font-black text-slate-900 font-mono">{item.invoiceNumber || 'N/A'}</td>
                                                            <td className="py-3.5 px-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-800">{getVendorName(item.vendorId, item.vendorType)}</span>
                                                                    <span className="text-[10px] text-slate-400 font-mono uppercase shrink-0">
                                                                        {item.vendorType === 'Vendor' ? 'Client' : item.vendorType}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5 px-2 font-semibold text-slate-700">{getProjectName(item.projectId)}</td>
                                                            <td className="py-3.5 px-2 font-medium text-slate-505 font-mono">{item.date}</td>
                                                            <td className="py-3.5 px-2 font-semibold text-slate-600 font-mono">{item.dueDate || 'N/A'}</td>
                                                            <td className="py-3.5 px-2 font-bold">
                                                                {diffDays <= 0 ? (
                                                                    <span className="text-emerald-600 font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Not overdue</span>
                                                                ) : (
                                                                    <span className="text-rose-600 font-mono text-[10px] bg-rose-50 px-2 py-0.5 rounded-full font-bold">{diffDays} days past due</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-2 text-right font-black text-slate-900 font-mono">
                                                                AED {(item.totalAmount || item.amount).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Monthly Trends Dashboard */}
                    <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-5">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                                <span>Monthly Supplier Billings & Liquidation</span>
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">Visual calendar ledger tracking supplier claims received, payments released, and outstanding credits.</p>
                        </div>

                        {monthlyTrends.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl">
                                <p className="font-bold">No monthly billings data available yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left: Monthly Trends Table */}
                                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-xs bg-white">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                                <th className="py-3.5 px-4 font-bold text-slate-500">Billing Month</th>
                                                <th className="py-3.5 px-4 text-right">Invoiced (AED)</th>
                                                <th className="py-3.5 px-4 text-right">Paid Out (AED)</th>
                                                <th className="py-3.5 px-4 text-right">Pending Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {monthlyTrends.map((trend: any) => {
                                                const paidPct = trend.bBilled > 0 ? (trend.pPaid / trend.bBilled) * 100 : 0;
                                                return (
                                                    <tr key={trend.key} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-3.5 px-4 font-extrabold text-slate-800">{trend.label}</td>
                                                        <td className="py-3.5 px-4 text-right font-bold text-slate-500">{trend.bBilled.toLocaleString()}</td>
                                                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                                                            {trend.pPaid.toLocaleString()}
                                                            <span className="block text-[9px] font-bold font-mono text-emerald-500 mt-0.5">{paidPct.toFixed(0)}% Disbursed</span>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right font-black text-rose-600">{trend.pPending.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Right: Visual Progress Chart representation of Month-on-Month billing */}
                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 md:p-6 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">Month-on-Month Liability Liquidation</h4>
                                        <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
                                            {monthlyTrends.map((trend: any) => {
                                                const paidPct = trend.bBilled > 0 ? (trend.pPaid / trend.bBilled) * 100 : 0;
                                                return (
                                                    <div key={trend.key} className="space-y-1">
                                                        <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700">
                                                            <span className="font-extrabold">{trend.label}</span>
                                                            <span className="font-mono text-slate-500">AED {trend.bBilled.toLocaleString()}</span>
                                                        </div>
                                                        <div className="relative w-full h-3 bg-slate-200/50 rounded-full overflow-hidden flex">
                                                            {/* Color for paid */}
                                                            <div 
                                                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-l-full relative group transition-all" 
                                                                style={{ width: `${paidPct}%` }}
                                                                title={`Paid: AED ${trend.pPaid.toLocaleString()}`}
                                                            />
                                                            {/* Color for unpaid */}
                                                            <div 
                                                                className="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-r-full transition-all" 
                                                                style={{ width: `${100 - paidPct}%` }}
                                                                title={`Liability balance: AED ${trend.pPending.toLocaleString()}`}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                                                            <span>Paid Ratio: {paidPct.toFixed(1)}%</span>
                                                            <span>Outstanding: {(100 - paidPct).toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200/50 flex justify-around text-[10px] font-bold font-mono">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                            <span className="text-slate-505">Paid Liabilities</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                                            <span className="text-slate-505">Outstanding Balance</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* activeTabMode === 'soa' */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                    
                    {/* Left: SOA Custom Builder (5 columns wide) */}
                    <div className="lg:col-span-5 bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-600" />
                                <span>Compile Partner Statement of Account (SOA)</span>
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">
                                Produce corporate-grade ledger statements of transactions, credits, and settlements over custom spans.
                            </p>
                        </div>

                        <div className="space-y-4 text-xs font-semibold">
                            {/* Supplier Entity Select */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Select Supplier Counterparty</label>
                                <select 
                                    value={soaVendorId} 
                                    onChange={e => setSoaVendorId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-800 outline-hidden font-extrabold cursor-pointer"
                                >
                                    <option value="All">All Registered Partners Combined</option>
                                    {apPartnerOptions.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Company Origin/Seller */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider text-brand-600">Select Company Issuer</label>
                                <select 
                                    value={soaCompanyId} 
                                    onChange={e => setSoaCompanyId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-800 outline-hidden font-extrabold cursor-pointer text-brand-600 hover:border-brand-300 transition-colors"
                                >
                                    <option value="All">All Companies (Default Pioneer Header)</option>
                                    {(companies || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            💼 {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Project Filter */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Associated Project / Contract</label>
                                <select 
                                    value={soaProjectId} 
                                    onChange={e => setSoaProjectId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-800 outline-hidden font-extrabold cursor-pointer"
                                >
                                    <option value="All">All Operations & Projects Combined</option>
                                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            {/* Date Span */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={soaStartDate} 
                                        onChange={e => setSoaStartDate(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-slate-850 outline-hidden"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">End Date</label>
                                    <input 
                                        type="date" 
                                        value={soaEndDate} 
                                        onChange={e => setSoaEndDate(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-slate-850 outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Settlement Scope */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Settlement Scope</label>
                                <div className="grid grid-cols-3 bg-slate-50 p-1 border border-slate-200 rounded-2xl gap-1">
                                    {(['All', 'Paid', 'Pending'] as const).map((sc) => (
                                        <button
                                            key={sc}
                                            onClick={() => setSoaScope(sc)}
                                            className={cn(
                                                "py-1.5 font-bold rounded-xl transition-all text-center cursor-pointer",
                                                soaScope === sc ? "bg-white text-emerald-600 shadow-xs" : "text-slate-500 hover:text-slate-850"
                                            )}
                                        >
                                            {sc === 'All' ? 'All Rows' : sc === 'Paid' ? 'Cleared' : 'Outstanding'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Output Preview Card */}
                            <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-3xl space-y-2 mt-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 font-mono">Matched Record Summary</p>
                                <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                                    <div>
                                        <span className="text-slate-450 block">Matched:</span>
                                        <strong className="text-slate-800 text-xs font-black">{soaFilteredItems.length} invoices</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-450 block">Net Liability:</span>
                                        <strong className="text-rose-600 text-xs font-black">
                                            AED {soaFilteredItems.reduce((acc, c) => acc + (c.status !== 'Paid' ? (c.totalAmount || c.amount || 0) : 0), 0).toLocaleString()}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={handleGenerateSOAPDF}
                                    disabled={soaFilteredItems.length === 0}
                                    className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold p-3 rounded-2xl transition-all shadow-xs cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Download PDF SOA</span>
                                </button>
                                <button
                                    onClick={handleGenerateSOAExcel}
                                    disabled={soaFilteredItems.length === 0}
                                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold p-3 rounded-2xl transition-all shadow-xs cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    <span>Download Excel SOA</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Month-by-month Accounts Ledger Pack (7 columns wide) */}
                    <div className="lg:col-span-7 bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-indigo-600" />
                                    <span>Month-by-Month Accounts Ledger Pack</span>
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    Instantly compile and package whole months into structured Excel and PDF registers.
                                </p>
                            </div>
                            <button
                                onClick={handleDownloadAllMonthsConsolidated}
                                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-4 py-2 rounded-2xl shadow-xs transition-colors cursor-pointer shrink-0"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Master Workbook</span>
                            </button>
                        </div>

                        {availableMonths.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-medium border border-dashed border-slate-150 rounded-3xl">
                                No billing records found in the ledger to segment by month.
                            </div>
                        ) : (
                            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                                {availableMonths.map((mKey) => {
                                    const mItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
                                    const mTotal = mItems.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0);
                                    const mPaid = mItems.reduce((sum, item) => sum + (item.status === 'Paid' ? (item.totalAmount || item.amount || 0) : 0), 0);
                                    const mPending = mTotal - mPaid;

                                    const [yr, mn] = mKey.split('-');
                                    const mLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });

                                    return (
                                        <div 
                                            key={mKey}
                                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 hover:bg-slate-100/60 border border-slate-100 hover:border-slate-200 p-4 rounded-3xl transition-all gap-4"
                                        >
                                            <div className="space-y-1">
                                                <h4 className="font-extrabold text-sm text-slate-800">{mLabel}</h4>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-mono">
                                                    <span>Entries: <strong className="text-slate-700">{mItems.length} bills</strong></span>
                                                    <span>Billed: <strong className="text-slate-700">AED {mTotal.toLocaleString()}</strong></span>
                                                    <span>Paid: <strong className="text-emerald-600">AED {mPaid.toLocaleString()}</strong></span>
                                                    <span>Due: <strong className="text-rose-600 font-bold">AED {mPending.toLocaleString()}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                                                <button
                                                    onClick={() => executeDownloadMonthExcel(mKey)}
                                                    className="flex items-center gap-1 bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 hover:bg-emerald-500 hover:text-white px-3.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs"
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                    <span>Excel</span>
                                                </button>
                                                <button
                                                    onClick={() => executeDownloadMonthPDF(mKey)}
                                                    className="flex items-center gap-1 bg-white border border-slate-200 hover:border-rose-300 text-rose-700 hover:bg-rose-500 hover:text-white px-3.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                    <span>PDF Journal</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


export const downloadAgingAndMonthlyExcel = (
    isReceivable: boolean,
    agingBuckets: any,
    monthlyTrends: any[],
    getVendorName?: (id: string, type: string) => string,
    getProjectName?: (id: string) => string
) => {
    const wb = XLSX.utils.book_new();

    // 1. Aging summary sheet
    const summaryRows = Object.entries(agingBuckets).map(([key, bucket]: any) => {
        const totalAmount = Object.values(agingBuckets).reduce((sum: number, b: any) => sum + b.amount, 0) as number;
        const pct = totalAmount > 0 ? (bucket.amount / totalAmount) * 100 : 0;
        return {
            'Aging Group': bucket.label,
            'Outstanding Amount (AED)': bucket.amount,
            'Invoices Count': bucket.count,
            'Description': bucket.desc,
            '% of Total Outstanding': `${pct.toFixed(1)}%`
        };
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Aging_Summary");

    // 2. Monthly trends sheet
    const trendRows = monthlyTrends.map((trend: any) => {
        const paidAmount = trend.pPaid !== undefined ? trend.pPaid : (trend.cCollected !== undefined ? trend.cCollected : 0);
        return {
            'Billing Month': trend.label,
            'Invoiced Amount (AED)': trend.bBilled || 0,
            'Paid Out/Collected (AED)': paidAmount,
            'Pending Balance (AED)': trend.pPending || 0
        };
    });
    const wsTrends = XLSX.utils.json_to_sheet(trendRows);
    XLSX.utils.book_append_sheet(wb, wsTrends, "Monthly_Trends");

    // 3. Outstanding invoice list
    const invoicesRows: any[] = [];
    Object.entries(agingBuckets).forEach(([groupKey, bucket]: any) => {
        const items = bucket.items || [];
        items.forEach((item: any) => {
            let partnerName = 'N/A';
            if (getVendorName) {
                const partnerId = isReceivable ? (item.entityId || item.projectId) : item.vendorId;
                const partnerType = isReceivable ? (item.entityType || 'Project') : item.vendorType;
                partnerName = getVendorName(partnerId, partnerType);
            } else if (item.clientName) {
                partnerName = item.clientName;
            }
            
            invoicesRows.push({
                'Invoice #': item.invoiceNumber || 'N/A',
                'Partner/Recipient Name': partnerName,
                'Project': getProjectName ? getProjectName(item.projectId) : (item.projectName || 'N/A'),
                'Invoice Date': item.date || 'N/A',
                'Due Date': item.dueDate || 'N/A',
                'Aging Group': bucket.label,
                'Outstanding Balance (AED)': item.totalAmount || item.amount || 0,
                'Status': item.status || 'Pending'
            });
        });
    });
    if (invoicesRows.length > 0) {
        const wsInvoices = XLSX.utils.json_to_sheet(invoicesRows);
        XLSX.utils.book_append_sheet(wb, wsInvoices, "Outstanding_Invoices_Ledger");
    }

    const fileName = isReceivable 
        ? "Accounts_Receivable_Aging_And_Monthly_Reports.xlsx" 
        : "Accounts_Payable_Aging_And_Monthly_Reports.xlsx";

    XLSX.writeFile(wb, fileName);
};

export const downloadAgingAndMonthlyPDF = (
    isReceivable: boolean,
    agingBuckets: any,
    monthlyTrends: any[],
    totalAgingAmount: number,
    getVendorName?: (id: string, type: string) => string,
    getProjectName?: (id: string) => string
) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const reportTitle = isReceivable 
        ? 'DMS CLIENT ACCOUNTS RECEIVABLE AGING & MONTHS' 
        : 'DMS SUPPLIER ACCOUNTS PAYABLE AGING & MONTHS';

    const assets = getPioneerPDFAssets();
    if (assets.header) {
        doc.addImage(assets.header, 'PNG', 15, 12, 45, 15);
    }
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(reportTitle, 15, 36);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, 41);
    doc.text(`Scope: Unpaid liabilities, group ageing analysis and recurring monthly ledger trends`, 15, 45);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 52, 180, 16, 2, 2, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(isReceivable ? "TOTAL OUTSTANDING RECEIVABLES BALANCE" : "TOTAL OUTSTANDING AP OUTFLOW LIABILITY", 18, 58);
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(225, 29, 72);
    doc.text(`AED ${totalAgingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, 64);

    let currentY = 78;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("1. AGING POSITION OUTSTANDING SUMMARY", 15, currentY);

    currentY += 4;
    doc.setFillColor(15, 23, 42);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Aging Category group", 18, currentY + 4.5);
    doc.text("Outstanding (AED)", 80, currentY + 4.5);
    doc.text("Bill Count", 140, currentY + 4.5);
    doc.text("% Share", 175, currentY + 4.5);

    currentY += 7;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    Object.entries(agingBuckets).forEach(([key, bucket]: any) => {
        const pct = totalAgingAmount > 0 ? (bucket.amount / totalAgingAmount) * 100 : 0;
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 6.5, 'S');
        doc.setFont("Helvetica", "bold");
        doc.text(bucket.label, 18, currentY + 4.5);
        doc.setFont("Helvetica", "normal");
        doc.text(`AED ${bucket.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, currentY + 4.5);
        doc.text(String(bucket.count), 140, currentY + 4.5);
        doc.text(`${pct.toFixed(1)}%`, 175, currentY + 4.5);
        currentY += 6.5;
    });

    currentY += 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("2. MONTHLY BOOKING & DISBURSEMENT HISTORY", 15, currentY);

    currentY += 4;
    doc.setFillColor(15, 23, 42);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Calendar Month", 18, currentY + 4.5);
    doc.text("Invoiced Total (AED)", 70, currentY + 4.5);
    doc.text(isReceivable ? "Collected (AED)" : "Released Paid (AED)", 120, currentY + 4.5);
    doc.text("Pending Balance (AED)", 160, currentY + 4.5);

    currentY += 7;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    monthlyTrends.forEach((trend: any) => {
        if (currentY > 275) {
            doc.addPage();
            currentY = 20;
        }
        const paidAmount = trend.pPaid !== undefined ? trend.pPaid : (trend.cCollected !== undefined ? trend.cCollected : 0);
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 6.5, 'S');
        doc.setFont("Helvetica", "bold");
        doc.text(trend.label, 18, currentY + 4.5);
        doc.setFont("Helvetica", "normal");
        doc.text(`AED ${(trend.bBilled || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 70, currentY + 4.5);
        doc.text(`AED ${(paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, currentY + 4.5);
        doc.setFont("Helvetica", "bold");
        doc.text(`AED ${(trend.pPending || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, currentY + 4.5);
        doc.setTextColor(51, 65, 85);
        currentY += 6.5;
    });

    currentY += 10;
    if (currentY > 210) {
        doc.addPage();
        currentY = 20;
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("3. OUTSTANDING INDIVIDUAL INVOICES SCHEDULE", 15, currentY);

    currentY += 4;
    doc.setFillColor(15, 23, 42);
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Invoice Code", 18, currentY + 4.5);
    doc.text("Name of Partner", 55, currentY + 4.5);
    doc.text("Date", 115, currentY + 4.5);
    doc.text("Aging Basket", 140, currentY + 4.5);
    doc.text("Balance", 175, currentY + 4.5);

    currentY += 7;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    
    let hasItems = false;
    Object.entries(agingBuckets).forEach(([groupKey, bucket]: any) => {
        const items = bucket.items || [];
        items.forEach((item: any) => {
            hasItems = true;
            if (currentY > 275) {
                doc.addPage();
                currentY = 20;

                doc.setFillColor(15, 23, 42);
                doc.rect(15, currentY, 180, 7, 'F');
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(255, 255, 255);
                doc.text("Invoice Code", 18, currentY + 4.5);
                doc.text("Name of Partner", 55, currentY + 4.5);
                doc.text("Date", 115, currentY + 4.5);
                doc.text("Aging Basket", 140, currentY + 4.5);
                doc.text("Balance", 175, currentY + 4.5);
                currentY += 7;
                doc.setFont("Helvetica", "normal");
                doc.setTextColor(51, 65, 85);
            }

            let partnerName = 'N/A';
            if (getVendorName) {
                const partnerId = isReceivable ? (item.entityId || item.projectId) : item.vendorId;
                const partnerType = isReceivable ? (item.entityType || 'Project') : item.vendorType;
                partnerName = getVendorName(partnerId, partnerType);
            } else if (item.clientName) {
                partnerName = item.clientName;
            }

            doc.setFillColor(248, 250, 252);
            doc.rect(15, currentY, 180, 7.5, 'S');
            doc.setFont("Helvetica", "bold");
            doc.text(String(item.invoiceNumber || 'N/A'), 18, currentY + 5);
            doc.setFont("Helvetica", "normal");
            doc.text(String(partnerName).substring(0, 30), 55, currentY + 5);
            doc.text(String(item.date || 'N/A'), 115, currentY + 5);
            doc.text(String(bucket.label).replace(" Days Overdue", "d+").replace(" Days Due", "d"), 140, currentY + 5);
            doc.text(`AED ${(item.totalAmount || item.amount || 0).toLocaleString()}`, 175, currentY + 5);

            currentY += 7.5;
        });
    });

    if (!hasItems) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 10, 'S');
        doc.text("No outstanding invoices registered in system.", 18, currentY + 6.5);
    }

    const docName = isReceivable 
        ? "Accounts_Receivable_Aging_And_Monthly_Reports.pdf" 
        : "Accounts_Payable_Aging_And_Monthly_Reports.pdf";

    doc.save(docName);
};

export const printAgingAndMonthlyReport = (
    isReceivable: boolean,
    agingBuckets: any,
    monthlyTrends: any[],
    totalAgingAmount: number,
    getVendorName?: (id: string, type: string) => string,
    getProjectName?: (id: string) => string
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportTitle = isReceivable 
        ? 'DMS Client Accounts Receivable Aging & Monthly Report' 
        : 'DMS Supplier Accounts Payable Aging & Monthly Report';

    const agingRowsHtml = Object.entries(agingBuckets).map(([key, bucket]: any) => {
        const pct = totalAgingAmount > 0 ? (bucket.amount / totalAgingAmount) * 100 : 0;
        return `
            <tr>
                <td style="font-weight: bold; border: 1px solid #ddd; padding: 10px;">${bucket.label}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">AED ${bucket.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${bucket.count}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${pct.toFixed(1)}%</td>
            </tr>
        `;
    }).join('');

    const trendRowsHtml = monthlyTrends.map((trend: any) => {
        const paidAmount = trend.pPaid !== undefined ? trend.pPaid : (trend.cCollected !== undefined ? trend.cCollected : 0);
        return `
            <tr>
                <td style="font-weight: bold; border: 1px solid #ddd; padding: 10px;">${trend.label}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">AED ${(trend.bBilled || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">AED ${(paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold; color: #be184a;">AED ${(trend.pPending || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');

    const invoiceItems: any[] = [];
    Object.entries(agingBuckets).forEach(([groupKey, bucket]: any) => {
        const items = bucket.items || [];
        items.forEach((item: any) => {
            let partnerName = 'N/A';
            if (getVendorName) {
                const partnerId = isReceivable ? (item.entityId || item.projectId) : item.vendorId;
                const partnerType = isReceivable ? (item.entityType || 'Project') : item.vendorType;
                partnerName = getVendorName(partnerId, partnerType);
            } else if (item.clientName) {
                partnerName = item.clientName;
            }
            invoiceItems.push({
                invoiceNumber: item.invoiceNumber || 'N/A',
                partner: partnerName,
                date: item.date || 'N/A',
                bucket: bucket.label,
                balance: item.totalAmount || item.amount || 0
            });
        });
    });

    const invoiceRowsHtml = invoiceItems.map((item: any) => `
        <tr>
            <td style="font-weight: bold; border: 1px solid #ddd; padding: 10px;">${item.invoiceNumber}</td>
            <td style="border: 1px solid #ddd; padding: 10px;">${item.partner}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.date}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.bucket}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">AED ${item.balance.toLocaleString()}</td>
        </tr>
    `).join('');

    const html = `
        <html>
            <head>
                <title>${reportTitle}</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                        color: #334155; 
                        margin: 20px; 
                    }
                    h1 { color: #0f172a; font-size: 20px; text-align: center; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .subheader { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 25px; line-height: 1.5; }
                    .stats-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 30px; }
                    .stats-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
                    .stats-value { font-size: 22px; font-weight: 900; color: #e11d48; margin-top: 5px; }
                    h2 { font-size: 13px; color: #0f172a; margin-top: 25px; border-bottom: 2px solid #0f172a; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 25px; }
                    th { background-color: #0f172a; color: #ffffff; padding: 10px; font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; text-align: left; }
                    td { font-size: 11px; }
                    @media print {
                        body { margin: 15mm; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div style="display: flex; justify-content: space-between; align-items: center; flag-row: row; margin-bottom: 10px;">
                    <div style="font-size: 16px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">PIONEER DMS PORTAL</div>
                    <button onclick="window.print()" style="background-color: #0f172a; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">Print Report</button>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
                <h1>${reportTitle}</h1>
                <div class="subheader">
                    Generated: ${new Date().toLocaleString()} | Scope: Outstanding Balance Tracker and Rolling Billings Summary
                </div>

                <div class="stats-card">
                    <div class="stats-title">${isReceivable ? "Total Pending Receivables" : "Total AP Outstanding Balance"}</div>
                    <div class="stats-value">AED ${totalAgingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>

                <h2>1. Aging Position Summary</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Aging Category</th>
                            <th style="text-align: left;">Liability Balance (AED)</th>
                            <th style="text-align: center;">Invoices Count</th>
                            <th style="text-align: right;">% Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${agingRowsHtml}
                    </tbody>
                </table>

                <h2>2. Monthly Billings Summary</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Calendar Month</th>
                            <th>Invoiced Work (AED)</th>
                            <th>${isReceivable ? "Collected (AED)" : "Released Paid (AED)"}</th>
                            <th style="padding: 10px; text-align: right;">Outstanding Balance (AED)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trendRowsHtml}
                    </tbody>
                </table>

                <h2>3. Unpaid Invoices Schedule</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Partner Name / Recipient</th>
                            <th style="text-align: center;">Date</th>
                            <th style="text-align: center;">Aging Bucket</th>
                            <th style="text-align: right;">Balance Amount (AED)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceRowsHtml.length > 0 ? invoiceRowsHtml : '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #94a3b8;">No outstanding schedule items.</td></tr>'}
                    </tbody>
                </table>

                <script>
                    setTimeout(() => {
                        window.print();
                    }, 500);
                </script>
            </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

export const downloadZohoInvoicePDF = (item: any, company?: any, client?: any, bankAccounts: any[] = []) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const defaultBank = (bankAccounts || []).find(b => b.isDefault) || (bankAccounts || [])[0] || {
        accountName: "Pioneer General Contracting LLC",
        bankName: "Abu Dhabi Commercial Bank",
        accountNumber: "11249315820001",
        iban: "AE190030011249315820001",
        swiftCode: "ADCBAEAA",
        currency: "AED"
    };

    // Add Watermark Logo
    const assets = getPioneerPDFAssets();
    if (assets.watermark) {
        doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
    }

    const primaryColor = [10, 25, 47]; // Deep Navy
    const accentColor = [59, 130, 246]; // Modern blue/azure
    const darkTextColor = [33, 37, 41];
    const lightText = [100, 116, 139];
    const borderSlate = [226, 232, 240];
    const tableHeaderBg = [241, 245, 249];

    // High Quality Layout Top Stripe
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, 210, 6, 'F');

    let headerOffset = 35;
    if (company?.logo && company.logo.startsWith('data:image')) {
        try {
            doc.addImage(company.logo, 'PNG', 15, 12, 25, 25);
            headerOffset = 42;
        } catch (e) {
            console.error("Error drawing logo on pdf:", e);
        }
    } else {
        doc.setFillColor(59, 130, 246);
        doc.circle(27, 24, 12, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        const initial = company?.name ? company.name.substring(0, 2).toUpperCase() : 'CO';
        doc.text(initial, 27, 26, { align: 'center' });
        headerOffset = 42;
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(company?.name || "PIONEER DMS GROUP LTD", 15, headerOffset - 4);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    const sellerDetails = [
        company?.address || "United Arab Emirates",
        company?.email ? `Email: ${company.email}` : "Email: accounts@pioneer.ae",
        company?.phone ? `Phone: ${company.phone}` : "Phone: +971 4 000 0000"
    ];
    if (company?.trn || item.companyTrn) {
        sellerDetails.push(`Supplier TRN (VAT ID): ${company?.trn || item.companyTrn}`);
    } else {
        sellerDetails.push(`Supplier TRN (VAT ID): 100459382100003`);
    }
    doc.text(sellerDetails, 15, headerOffset);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("TAX INVOICE", 195, 24, { align: 'right' });

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    
    doc.text(`Invoice No:`, 140, 32);
    doc.setFont("Helvetica", "bold");
    doc.text(`${item.invoiceNumber || 'INV-NA'}`, 195, 32, { align: 'right' });

    doc.setFont("Helvetica", "normal");
    doc.text(`Date:`, 140, 38);
    doc.text(`${item.date}`, 195, 38, { align: 'right' });

    doc.setFont("Helvetica", "normal");
    doc.text(`Due Date:`, 140, 44);
    doc.text(`${item.dueDate || item.date}`, 195, 44, { align: 'right' });

    doc.setFont("Helvetica", "normal");
    doc.text(`Status:`, 140, 50);
    doc.setFont("Helvetica", "bold");
    if (item.status === 'Received') {
        doc.setTextColor(16, 124, 65);
    } else {
        doc.setTextColor(220, 95, 0);
    }
    doc.text(`${item.status || 'Pending'}`.toUpperCase(), 195, 50, { align: 'right' });

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.4);
    doc.line(15, 60, 195, 60);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("BILLED TO", 15, 68);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(client?.name || item.contact || "Valued Client", 15, 74);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    const clientDetails = [
        client?.address || "Dubai, United Arab Emirates",
        client?.email ? `Email: ${client.email}` : "",
        client?.phone ? `Phone: ${client.phone}` : ""
    ];
    if (client?.trn || item.clientTrn) {
        clientDetails.push(`Recipient TRN (VAT ID): ${client?.trn || item.clientTrn}`);
    } else {
        clientDetails.push(`Recipient TRN (VAT ID): 100389423100003`);
    }
    doc.text(clientDetails.filter(Boolean), 15, 80);

    let yPos = 105;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("ITEMIZED SERVICE SUMMARY", 15, yPos - 3);

    doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
    doc.rect(15, yPos, 180, 10, 'F');
    doc.rect(15, yPos, 180, 10, 'D');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("S.No", 18, yPos + 6);
    doc.text("Items & Description", 30, yPos + 6);
    doc.text("Quantity", 115, yPos + 6, { align: 'right' });
    doc.text("Rate (AED)", 145, yPos + 6, { align: 'right' });
    doc.text("Amount (AED)", 190, yPos + 6, { align: 'right' });

    const lineItems = item.items && item.items.length > 0 ? item.items : [
        { id: '1', name: item.description || 'General Contracting Services', description: 'Comprehensive services as agreed', quantity: 1, rate: item.amount || 0, total: item.amount || 0 }
    ];

    yPos += 10;

    lineItems.forEach((li: any, idx: number) => {
        // Calculate wrapped lines using splitTextToSize to match actual available column width (approx 70mm)
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        const nameLines = doc.splitTextToSize(li.name || 'Contract Item', 70);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        const hasDesc = li.description && li.description.trim() !== '';
        const descLines = hasDesc ? doc.splitTextToSize(li.description, 70) : [];

        const nameHeight = nameLines.length * 4.0;
        const descHeight = descLines.length > 0 ? (descLines.length * 3.4) : 0;
        const totalTextHeight = nameHeight + (descLines.length > 0 ? descHeight + 1.0 : 0);
        
        // rowHeight includes 5.0mm top padding and 3.0mm bottom padding
        const rowHeight = totalTextHeight + 8.0;

        // Auto-pagebreak if current row extends past safe printable height (275mm)
        if (yPos + rowHeight > 275) {
            doc.addPage();
            yPos = 20;
        }

        // 1. Draw top-aligned S.No column
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
        doc.text(String(idx + 1), 18, yPos + 5.0);

        // 2. Draw top-aligned Quantity, Rate, Amount columns
        doc.text(String(li.quantity || 1), 115, yPos + 5.0, { align: 'right' });
        doc.text(Number(li.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), 145, yPos + 5.0, { align: 'right' });
        
        doc.setFont("Helvetica", "bold");
        doc.text(Number(li.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), 190, yPos + 5.0, { align: 'right' });

        // 3. Draw wrapped item names
        let textY = yPos + 5.0;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
        nameLines.forEach((line: string) => {
            doc.text(line, 30, textY);
            textY += 4.0;
        });

        // 4. Draw wrapped item descriptions
        if (descLines.length > 0) {
            textY += 1.0;
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(lightText[0], lightText[1], lightText[2]);
            descLines.forEach((line: string) => {
                doc.text(line, 30, textY);
                textY += 3.4;
            });
        }

        // Draw solid bottom gridline
        doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
        doc.setLineWidth(0.3);
        doc.line(15, yPos + rowHeight, 195, yPos + rowHeight);

        // Advance visual cursor to bottom of row
        yPos += rowHeight;
    });

    yPos += 8;
    if (yPos > 240) {
        doc.addPage();
        yPos = 30;
    }

    const totalsStartY = yPos;

    // Draw Totals Block (Right column)
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("Sub Total:", 145, yPos);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(`AED ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

    yPos += 6;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("VAT (5.0%):", 145, yPos);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(`AED ${Number(item.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

    yPos += 8;
    doc.setFillColor(240, 246, 255);
    doc.setDrawColor(200, 220, 255);
    doc.rect(125, yPos - 5, 70, 10, 'F');
    doc.rect(125, yPos - 5, 70, 10, 'D');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("Total Amount (AED):", 129, yPos + 1.5);
    doc.setFontSize(10.5);
    doc.text(`AED ${Number(item.totalAmount || item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos + 1.5, { align: 'right' });

    // Draw Bank Details Box (Left column, parallel to Totals)
    const boxY = totalsStartY - 2;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(15, boxY, 98, 30, 2, 2, 'FD');

    // Box Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(59, 130, 246);
    doc.text("Bank Details:", 18, boxY + 4.5);

    // Beneficiary Row
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(100, 116, 139);
    doc.text("Beneficiary:", 18, boxY + 9.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(defaultBank.accountName || "N/A", 42, boxY + 9.5);

    // Bank Name Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Bank Name:", 18, boxY + 13.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(defaultBank.bankName || "N/A", 42, boxY + 13.5);

    // Account No Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Account No:", 18, boxY + 17.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(defaultBank.accountNumber || "N/A", 42, boxY + 17.5);

    // IBAN Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("IBAN:", 18, boxY + 21.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text(defaultBank.iban || "N/A", 42, boxY + 21.5);

    // Swift / Currency Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Swift / Currency:", 18, boxY + 25.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(33, 37, 41);
    doc.text(`${defaultBank.swiftCode || "N/A"} / ${defaultBank.currency || "AED"}`, 42, boxY + 25.5);

    // Advance position past the bank details / totals blocks
    yPos = totalsStartY + 30;
    if (yPos > 240) {
        doc.addPage();
        yPos = 30;
    }

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(15, yPos, 195, yPos);
    yPos += 6;

    // LEFT COLUMN: TERMS
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("TERMS & INSTRUCTIONS", 15, yPos);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text([
        "1. Please reference the Invoice Number on bank transfers.",
        "2. Payment is due within the stipulated credit days.",
        "3. Standard 5% UAE VAT applies to overall civil items."
    ], 15, yPos + 5);

    // RIGHT COLUMN: AUTHORIZED SIGNATORY (Placed parallel to TERMS under the line)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("AUTHORIZED SIGNATORY", 192, yPos, { align: 'right' });
    doc.line(135, yPos + 12, 192, yPos + 12);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("Operations / Accounts Dept", 192, yPos + 17, { align: 'right' });

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 289, 210, 8, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Official electronic tax invoice generated inside Pioneer Group DMS.", 105, 294, { align: "center" });

    doc.save(`Invoice_${item.invoiceNumber || 'INV'}.pdf`);
};

interface PdfSOAParams {
    title: string;
    partnerName: string;
    partnerType: string;
    partnerTrn: string;
    projectName: string;
    periodStr: string;
    items: any[];
    totalBilled: number;
    totalPaid: number;
    balance: number;
    isReceivable: boolean;
    companyName?: string;
    companyLogo?: string;
    companyAddress?: string;
    companyEmail?: string;
    companyPhone?: string;
}

export const generatePdfSOA = ({
    title,
    partnerName,
    partnerType,
    partnerTrn,
    projectName,
    periodStr,
    items,
    totalBilled,
    totalPaid,
    balance,
    isReceivable,
    companyName,
    companyLogo,
    companyAddress,
    companyEmail,
    companyPhone
}: PdfSOAParams) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // Add Watermark Logo (Landscape)
    const assets = getPioneerPDFAssets();
    if (assets.watermark) {
        doc.addImage(assets.watermark, 'PNG', (297 - 145) / 2, (210 - 145) / 2, 145, 145, undefined, 'FAST');
    }

    const themeColor = isReceivable ? [37, 99, 235] : [190, 24, 74];
    const primaryColor = [15, 23, 42];
    const lightText = [100, 116, 139]; 
    const borderSlate = [226, 232, 240];

    const cName = companyName || "PIONEER DMS GROUP LTD";
    const cAddress = companyAddress || "United Arab Emirates";
    const cEmail = companyEmail || "accounts@pioneer.ae";
    const cPhone = companyPhone || "+971 4 000 0000";

    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(0, 0, 297, 6, 'F');

    let headerOffset = 18;
    let textX = 15;
    if (companyLogo && companyLogo.startsWith('data:image')) {
        try {
            doc.addImage(companyLogo, 'PNG', 15, 10, 20, 20);
            textX = 40;
            headerOffset = 16;
        } catch (e) {
            console.error("Error drawing logo on pdf:", e);
        }
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(cName, textX, headerOffset);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text([
        `Address: ${cAddress}`,
        `Email: ${cEmail} | Phone: ${cPhone}`,
        "Official Statement of Account Generated electronically on " + new Date().toLocaleDateString()
    ], textX, headerOffset + 5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text(title.toUpperCase(), 15, 42);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("Statement Period: " + periodStr, 15, 47);

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(15, 52, 282, 52);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("COUNTERPARTY INFORMATION", 15, 58);
    
    doc.setFont("Helvetica", "normal");
    doc.text(`Partner name: ${partnerName}`, 15, 63);
    doc.text(`Type / Category: ${partnerType}`, 15, 68);
    doc.text(`TRN number: ${partnerTrn}`, 15, 73);

    doc.setFont("Helvetica", "bold");
    doc.text("OPERATIONAL BOUNDS", 150, 58);
    
    doc.setFont("Helvetica", "normal");
    doc.text(`Contracted projects: ${projectName}`, 150, 63);
    doc.text(`Matched entries: ${items.length} records`, 150, 68);
    doc.text(`System source: Ledger Sync`, 150, 73);

    doc.line(15, 78, 282, 78);

    const cardY = 84;
    doc.setFillColor(248, 250, 252);
    doc.rect(15, cardY, 267, 18, 'F');
    doc.rect(15, cardY, 267, 18, 'D');

    doc.line(104, cardY, 104, cardY + 18);
    doc.line(193, cardY, 193, cardY + 18);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(isReceivable ? "TOTAL BILLED" : "TOTAL INVOICES", 20, cardY + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`AED ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, cardY + 12);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(isReceivable ? "COLLECTED FUNDS" : "SETTLED AMOUNT", 109, cardY + 5);
    doc.setFontSize(11);
    doc.setTextColor(16, 124, 65);
    doc.text(`AED ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 109, cardY + 12);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(isReceivable ? "DEBT BAL. DUE" : "PENDING LIABILITY", 198, cardY + 5);
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text(`AED ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 198, cardY + 12);

    const tableHeaderY = 110;
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(15, tableHeaderY, 267, 8, 'F');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("SI NO", 16, tableHeaderY + 5.5);
    doc.text("INV. DATE", 26, tableHeaderY + 5.5);
    doc.text("INVOICE #", 45, tableHeaderY + 5.5);
    doc.text("MON", 71, tableHeaderY + 5.5);
    doc.text("YR", 85, tableHeaderY + 5.5);
    doc.text("ACT. AMT (AED)", 121, tableHeaderY + 5.5, { align: 'right' });
    doc.text("VAT AMT (AED)", 141, tableHeaderY + 5.5, { align: 'right' });
    doc.text("TOTAL (AED)", 166, tableHeaderY + 5.5, { align: 'right' });
    doc.text("BALANCE (AED)", 191, tableHeaderY + 5.5, { align: 'right' });
    doc.text("STATUS", 195, tableHeaderY + 5.5);
    doc.text("CHEQUE SETTLEMENT DETAILS (IF APPLICABLE)", 216, tableHeaderY + 5.5);

    let currentY = tableHeaderY + 8;
    items.forEach((itm: any, idx: number) => {
        if (currentY > 185) {
            doc.addPage();
            doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
            doc.rect(0, 0, 297, 6, 'F');
            currentY = 15;
        }

        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, currentY, 267, 8, 'F');
        }

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        // SI No
        doc.text(String(idx + 1), 16, currentY + 5.5);

        // Date
        doc.text(itm.date || '-', 26, currentY + 5.5);

        // Invoice No
        doc.setFont("Helvetica", "bold");
        doc.text(itm.invoiceNumber || '-', 45, currentY + 5.5);
        doc.setFont("Helvetica", "normal");

        // Parse month and year
        let yrStr = '-';
        let mnStr = '-';
        if (itm.date) {
            const parts = itm.date.split('-');
            if (parts.length >= 2) {
                yrStr = parts[0];
                const mnVal = parseInt(parts[1]);
                if (!isNaN(mnVal) && mnVal >= 1 && mnVal <= 12) {
                    mnStr = new Date(parseInt(parts[0]), mnVal - 1, 1).toLocaleDateString('default', { month: 'short' });
                }
            }
        }
        doc.text(mnStr, 71, currentY + 5.5);
        doc.text(yrStr, 85, currentY + 5.5);

        // Amounts
        const actualAmt = itm.amount || 0;
        const vatAmt = itm.vatAmount || 0;
        const totalAmt = itm.totalAmount || itm.amount || 0;
        
        const isPaid = itm.status === 'Paid' || itm.status === 'Received';
        const balanceAmt = isPaid ? 0 : totalAmt;

        doc.text(actualAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), 121, currentY + 5.5, { align: 'right' });
        doc.text(vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), 141, currentY + 5.5, { align: 'right' });
        doc.text(totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), 166, currentY + 5.5, { align: 'right' });
        
        doc.setFont("Helvetica", "bold");
        doc.text(balanceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), 191, currentY + 5.5, { align: 'right' });
        doc.setFont("Helvetica", "normal");

        // Status
        if (isPaid) {
            doc.setTextColor(16, 124, 65);
        } else {
            doc.setTextColor(220, 95, 0);
        }
        doc.setFont("Helvetica", "bold");
        doc.text(itm.status || 'Pending', 195, currentY + 5.5);
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(30, 41, 59);

        // Cheque details
        let chqStr = "-";
        if (itm.chequeNo || itm.chequeDate || itm.chequeAmount) {
            const chqParts = [];
            if (itm.chequeNo) chqParts.push(`Chq: #${itm.chequeNo}`);
            if (itm.chequeDate) chqParts.push(`Date: ${itm.chequeDate}`);
            if (itm.chequeAmount) chqParts.push(`Amt: ${Number(itm.chequeAmount).toLocaleString()}`);
            chqStr = chqParts.join(" | ");
        }
        doc.setFontSize(7);
        doc.text(chqStr.length > 40 ? chqStr.substring(0, 38) + '..' : chqStr, 216, currentY + 5.5);
        doc.setFontSize(7.5);

        currentY += 8;
    });

    doc.setFillColor(241, 245, 249);
    doc.rect(15, currentY + 2, 267, 9, 'F');
    doc.setFont("Helvetica", "bold");
    doc.text("STATEMENT OUTSTANDING BALANCE", 18, currentY + 8);
    doc.text(`AED ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 280, currentY + 8, { align: 'right' });

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 201, 297, 9, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("Official electronic statement from corporate workspace ledger environment.", 148, 206, { align: "center" });

    doc.save(`${isReceivable ? 'Receivable' : 'Payable'}_SOA_${partnerName.replace(/\s+/g, '_')}.pdf`);
};

export const downloadSOAExcel = (
    partnerId: string, 
    partnerName: string, 
    partnerType: string, 
    items: any[], 
    isReceivable: boolean
) => {
    const reportRows = items.map((itm: any, idx: number) => {
        let yr = '-';
        let mnLabel = '-';
        if (itm.date) {
            const dateParts = itm.date.split('-');
            if (dateParts && dateParts.length >= 2) {
                yr = dateParts[0];
                const mn = parseInt(dateParts[1]);
                if (!isNaN(mn) && mn >= 1 && mn <= 12) {
                    mnLabel = new Date(parseInt(yr), mn - 1, 1).toLocaleDateString('default', { month: 'long' });
                }
            }
        }
        
        const actualAmt = itm.amount || 0;
        const vatAmt = itm.vatAmount || 0;
        const totalAmt = itm.totalAmount || itm.amount || 0;
        const isPaid = itm.status === 'Paid' || itm.status === 'Received';
        const balanceAmt = isPaid ? 0 : totalAmt;

        return {
            "SI No": idx + 1,
            "Invoice Date": itm.date || '',
            "Invoice No": itm.invoiceNumber || '-',
            "Invoice Month": mnLabel,
            "Invoice Year": yr,
            "Actual Amount": actualAmt,
            "VAT Amount": vatAmt,
            "Total Amount": totalAmt,
            "Balance Amount": balanceAmt,
            "Payment Status": itm.status || 'Pending',
            "Cheque Date": itm.chequeDate || '-',
            "Cheque Number": itm.chequeNo || '-',
            "Cheque Amount": itm.chequeAmount || '-'
        };
    });

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `SOA_${partnerId.substring(0, 8)}`);
    XLSX.writeFile(wb, `${isReceivable ? 'Receivable' : 'Payable'}_SOA_${partnerName.replace(/\s+/g, '_')}.xlsx`);
};

export const AccountsReceivableView = ({ data, projects, suppliers, vendors, onAdd, onEdit, onDelete, user, companies, bankAccounts = [] }: any) => {
    const [previewInvoiceItem, setPreviewInvoiceItem] = useState<{ item: any; comp: any; client: any } | null>(null);
    const [activeTabMode, setActiveTabMode] = useState<'ledger' | 'insights' | 'soa'>('ledger');
    const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null);

    // Advanced Filter State variables
    const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterEntity, setFilterEntity] = useState('All');
    const [filterProject, setFilterProject] = useState('All');
    const [filterCompany, setFilterCompany] = useState('All');
    const [filterMonth, setFilterMonth] = useState('All');

    // SOA Tool state variables
    const [soaEntityId, setSoaEntityId] = useState('All');
    const [soaProjectId, setSoaProjectId] = useState('All');
    const [soaCompanyId, setSoaCompanyId] = useState('All');
    const [soaStartDate, setSoaStartDate] = useState('');
    const [soaEndDate, setSoaEndDate] = useState('');
    const [soaScope, setSoaScope] = useState<'All' | 'Received' | 'Pending'>('All');

    const arClientOptions = useMemo(() => {
        const groups: { [name: string]: any[] } = {};
        (vendors || []).forEach((v: any) => {
            const nameKey = (v.name || '').trim();
            if (!groups[nameKey]) groups[nameKey] = [];
            groups[nameKey].push(v);
        });

        const options: { value: string; label: string }[] = [];
        
        // Add "All Consolidated Projects" options for groups
        Object.entries(groups).forEach(([name]) => {
            options.push({
                value: `BY_NAME:${name}`,
                label: `🌟 ${name} (All Consolidated Projects)`
            });
        });

        // Add standard individual project options
        (vendors || []).forEach((v: any) => {
            options.push({
                value: v.id,
                label: `📄 ${v.name} (Code: ${v.code || 'N/A'})`
            });
        });

        return options;
    }, [vendors]);

    const getEntityName = (id: string, type: string) => {
        if (type === 'Project') return projects.find((p: any) => p.id === id)?.name || 'Unknown Project';
        if (type === 'Supplier') {
            const s = suppliers.find((s: any) => s.id === id);
            return s ? (s.code ? `${s.name} (${s.code})` : s.name) : 'Unknown Supplier';
        }
        if (type === 'Vendor') {
            const v = vendors.find((v: any) => v.id === id);
            return v ? (v.code ? `${v.name} (${v.code})` : v.name) : 'Unknown Client';
        }
        return 'Unknown';
    };

    const getEntityObject = (id: string, type: string) => {
        if (type === 'Project') return projects.find((p: any) => p.id === id);
        if (type === 'Supplier') return suppliers.find((s: any) => s.id === id);
        if (type === 'Vendor') return vendors.find((v: any) => v.id === id);
        return null;
    };

    // Calculate unique available months in dataset for entries
    const availableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        (data || []).forEach((item: any) => {
            if (item.date) {
                monthsSet.add(item.date.substring(0, 7)); // YYYY-MM
            }
        });
        return Array.from(monthsSet).sort().reverse();
    }, [data]);

    // Apply Advanced Filters to dataset
    const filteredData = useMemo(() => {
        return (data || []).filter((item: any) => {
            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;

            const amount = item.totalAmount || item.amount || 0;
            if (minAmount !== '' && amount < Number(minAmount)) return false;
            if (maxAmount !== '' && amount > Number(maxAmount)) return false;

            if (filterStatus !== 'All' && item.status !== filterStatus) return false;
            
            if (filterEntity !== 'All') {
                if (item.entityId !== filterEntity) return false;
            }

            if (filterProject !== 'All') {
                if ((item.entityId || item.projectId) !== filterProject) return false;
            }

            if (filterCompany !== 'All') {
                if (item.companyId !== filterCompany) return false;
            }

            if (filterMonth !== 'All') {
                const m = item.date.substring(0, 7);
                if (m !== filterMonth) return false;
            }

            return true;
        });
    }, [data, startDate, endDate, minAmount, maxAmount, filterStatus, filterEntity, filterProject, filterCompany, filterMonth]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (startDate) count++;
        if (endDate) count++;
        if (minAmount !== '') count++;
        if (maxAmount !== '') count++;
        if (filterStatus !== 'All') count++;
        if (filterEntity !== 'All') count++;
        if (filterProject !== 'All') count++;
        if (filterCompany !== 'All') count++;
        if (filterMonth !== 'All') count++;
        return count;
    }, [startDate, endDate, minAmount, maxAmount, filterStatus, filterEntity, filterProject, filterCompany, filterMonth]);

    const handleClearAdvFilters = () => {
        setStartDate('');
        setEndDate('');
        setMinAmount('');
        setMaxAmount('');
        setFilterStatus('All');
        setFilterEntity('All');
        setFilterProject('All');
        setFilterCompany('All');
        setFilterMonth('All');
    };

    // Statement of Account Items filter logic
    const soaFilteredItems = useMemo(() => {
        return (data || []).filter((item: any) => {
            // Must match selected client entity
            if (soaEntityId !== 'All') {
                if (soaEntityId.startsWith('BY_NAME:')) {
                    const targetName = soaEntityId.replace('BY_NAME:', '').toLowerCase().trim();
                    const actualClientObj = getEntityObject(item.entityId, item.entityType || 'Vendor');
                    if (!actualClientObj || actualClientObj.name.toLowerCase().trim() !== targetName) return false;
                } else {
                    if (item.entityId !== soaEntityId) return false;
                }
            }
            
            // Must match selected project
            if (soaProjectId !== 'All' && (item.entityId || item.projectId) !== soaProjectId) return false;

            // Must match selected seller company
            if (soaCompanyId !== 'All' && item.companyId !== soaCompanyId) return false;

            // Date limits
            if (soaStartDate && item.date < soaStartDate) return false;
            if (soaEndDate && item.date > soaEndDate) return false;

            // Settlement scope
            if (soaScope === 'Received' && item.status !== 'Received') return false;
            if (soaScope === 'Pending' && item.status === 'Received') return false;

            return true;
        });
    }, [data, soaEntityId, soaProjectId, soaCompanyId, soaStartDate, soaEndDate, soaScope, vendors, suppliers, projects]);

    // Executing EXCEL Download for specific month
    const executeDownloadMonthExcel = (mKey: string) => {
        const monthItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
        const reportRows = monthItems.map((item: any) => ({
            "Invoice Date": item.date,
            "Invoice #": item.invoiceNumber || '-',
            "Client / Partner": getEntityName(item.entityId, item.entityType || 'Vendor'),
            "Partner Category": (item.entityType || 'Vendor') === 'Vendor' ? 'Client' : (item.entityType || 'Vendor'),
            "Seller Company": (companies || []).find((c: any) => c.id === item.companyId || c.name === item.companyName)?.name || item.companyName || 'Unassigned',
            "Excl. Amount (AED)": item.amount || 0,
            "VAT Amount (5%)": item.vatAmount || 0,
            "Total Invoiced (AED)": item.totalAmount || item.amount || 0,
            "Receipt Status": item.status,
            "Expected Due Date": item.dueDate || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(reportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `AR_Ledger_${mKey}`);
        XLSX.writeFile(wb, `Accounts_Receivable_Register_${mKey}.xlsx`);
    };

    // Executing PDF Download for specific month
    const executeDownloadMonthPDF = (mKey: string) => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add Watermark Logo
        const assets = getPioneerPDFAssets();
        if (assets.watermark) {
            doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
        }

        const monthItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
        const [yr, mn] = mKey.split('-');
        const mLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });

        doc.setFillColor(37, 99, 235); // Royal Blue header stripe 
        doc.rect(0, 0, 210, 6, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(`ACCOUNTS RECEIVABLE REGISTER - ${mLabel.toUpperCase()}`, 15, 18);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Category: Accounts Receivable Ledger Inflows | Generated: ${new Date().toLocaleDateString()}`, 15, 23);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 27, 195, 27);

        // Build Table header
        const tableHeaderY = 32;
        doc.setFillColor(37, 99, 235);
        doc.rect(15, tableHeaderY, 180, 8, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text("INVOICE DATE", 18, tableHeaderY + 5.5);
        doc.text("INVOICE #", 38, tableHeaderY + 5.5);
        doc.text("CLIENT / PROJECT ENTITY", 65, tableHeaderY + 5.5);
        doc.text("SELLER", 115, tableHeaderY + 5.5);
        doc.text("STATUS", 150, tableHeaderY + 5.5);
        doc.text("TOTAL (AED)", 192, tableHeaderY + 5.5, { align: 'right' });

        let currentY = tableHeaderY + 8;
        monthItems.forEach((itm: any, idx: number) => {
            if (currentY > 270) {
                doc.addPage();
                doc.setFillColor(37, 99, 235);
                doc.rect(0, 0, 210, 6, 'F');
                currentY = 15;
            }

            if (idx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, currentY, 180, 8, 'F');
            }

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);

            doc.text(itm.date || '', 18, currentY + 5.5);
            doc.setFont("Helvetica", "bold");
            doc.text(itm.invoiceNumber || '-', 38, currentY + 5.5);
            
            doc.setFont("Helvetica", "normal");
            const entityLabel = getEntityName(itm.entityId || itm.projectId, itm.entityType || 'Project');
            doc.text(entityLabel.length > 25 ? entityLabel.substring(0, 23) + '..' : entityLabel, 65, currentY + 5.5);
            
            const compLabel = (companies || []).find((c: any) => c.id === itm.companyId || c.name === itm.companyName)?.name || itm.companyName || '-';
            doc.text(compLabel.length > 18 ? compLabel.substring(0, 16) + '..' : compLabel, 115, currentY + 5.5);

            const isC = itm.status === 'Received' || itm.status === 'Paid';
            if (isC) {
                doc.setTextColor(16, 124, 65);
            } else {
                doc.setTextColor(220, 95, 0);
            }
            doc.setFont("Helvetica", "bold");
            doc.text(itm.status || 'Pending', 150, currentY + 5.5);
            
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(30, 41, 59);
            const tot = itm.totalAmount || itm.amount || 0;
            doc.setFont("Helvetica", "bold");
            doc.text(tot.toLocaleString(), 192, currentY + 5.5, { align: 'right' });

            currentY += 8;
        });

        const sumTotal = monthItems.reduce((acc: number, curr: any) => acc + (curr.totalAmount || curr.amount || 0), 0);
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY + 2, 180, 9, 'F');
        doc.setFont("Helvetica", "bold");
        doc.text("VOLUME SUMMARY TOTAL", 18, currentY + 8);
        doc.text(`AED ${sumTotal.toLocaleString()}`, 192, currentY + 8, { align: 'right' });

        doc.save(`Accounts_Receivable_Journal_${mKey}.pdf`);
    };

    // Bulk Multi-Sheet Excel download
    const handleDownloadAllMonthsConsolidated = () => {
        const wb = XLSX.utils.book_new();
        availableMonths.forEach((mKey) => {
            const mItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
            const rows = mItems.map((item: any) => ({
                "Invoice Date": item.date,
                "Invoice Number": item.invoiceNumber || '-',
                "Client Counterparty": getEntityName(item.entityId, item.entityType || 'Vendor'),
                "Seller Company": (companies || []).find((c: any) => c.id === item.companyId || c.name === item.companyName)?.name || item.companyName || '-',
                "Amount (AED)": item.amount || 0,
                "VAT Amount (5%) (AED)": item.vatAmount || 0,
                "Total Amount Gross (AED)": item.totalAmount || item.amount || 0,
                "Payment Status": item.status,
                "Expected Due Date": item.dueDate || '-'
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const [yr, mn] = mKey.split('-');
            const mLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
            XLSX.utils.book_append_sheet(wb, ws, mLabel.substring(0, 31));
        });
        XLSX.writeFile(wb, "Accounts_Receivable_Consolidated_Monthly_Workbook.xlsx");
    };

    const handleGenerateSOAPDF = () => {
        let pName = 'All Combined Clients';
        let pTrn = 'Multiple / N/A';
        let pType = 'Corporate Debtors';

        if (soaEntityId !== 'All') {
            let clientObj: any = null;
            if (soaEntityId.startsWith('BY_NAME:')) {
                const targetName = soaEntityId.replace('BY_NAME:', '').toLowerCase().trim();
                clientObj = vendors.find((v: any) => v.name.toLowerCase().trim() === targetName) 
                         || suppliers.find((s: any) => s.name.toLowerCase().trim() === targetName);
                if (!clientObj) {
                    clientObj = { name: soaEntityId.replace('BY_NAME:', ''), trn: 'Multiple / N/A' };
                }
            } else {
                clientObj = getEntityObject(soaEntityId, 'Vendor') || getEntityObject(soaEntityId, 'Supplier') || getEntityObject(soaEntityId, 'Project');
            }
            pName = clientObj?.name || 'Selected Client';
            pTrn = clientObj?.trn || 'Not Registered';
            pType = 'Client Account';
        }

        let projName = 'All Combined Operations';
        if (soaProjectId !== 'All') {
            projName = getEntityName(soaProjectId, 'Project');
        }

        const periodStr = (soaStartDate || soaEndDate) 
            ? `${soaStartDate || 'Origin'} to ${soaEndDate || 'Present'}`
            : 'Complete Recorded Operations History';

        // Summary Calculations
        let totalBilled = 0;
        let totalPaid = 0;
        soaFilteredItems.forEach((itm: any) => {
            const amt = itm.totalAmount || itm.amount || 0;
            totalBilled += amt;
            if (itm.status === 'Received') {
                totalPaid += amt;
            }
        });
        const balance = totalBilled - totalPaid;

        let selectedCompanyObj = (companies || []).find((c: any) => c.id === soaCompanyId);
        if (!selectedCompanyObj && soaFilteredItems.length > 0) {
            const firstItem = soaFilteredItems[0];
            selectedCompanyObj = (companies || []).find((c: any) => c.id === firstItem.companyId || c.name === firstItem.companyName);
        }
        if (!selectedCompanyObj && companies && companies.length > 0) {
            selectedCompanyObj = companies[0];
        }

        generatePdfSOA({
            title: "CLIENT STATEMENT OF ACCOUNT (SOA)",
            partnerName: pName,
            partnerType: pType,
            partnerTrn: pTrn,
            projectName: projName,
            periodStr,
            items: soaFilteredItems,
            totalBilled,
            totalPaid,
            balance,
            isReceivable: true,
            companyName: selectedCompanyObj?.name,
            companyLogo: selectedCompanyObj?.logo,
            companyAddress: selectedCompanyObj?.address,
            companyEmail: selectedCompanyObj?.email,
            companyPhone: selectedCompanyObj?.phone
        });
    };

    const handleGenerateSOAExcel = () => {
        let pName = 'All Combined Clients';
        let pType = 'Client Debtor';

        if (soaEntityId !== 'All') {
            let clientObj: any = null;
            if (soaEntityId.startsWith('BY_NAME:')) {
                const targetName = soaEntityId.replace('BY_NAME:', '').toLowerCase().trim();
                clientObj = vendors.find((v: any) => v.name.toLowerCase().trim() === targetName) 
                         || suppliers.find((s: any) => s.name.toLowerCase().trim() === targetName);
                if (!clientObj) {
                    clientObj = { name: soaEntityId.replace('BY_NAME:', '') };
                }
            } else {
                clientObj = getEntityObject(soaEntityId, 'Vendor') || getEntityObject(soaEntityId, 'Supplier') || getEntityObject(soaEntityId, 'Project');
            }
            pName = clientObj?.name || 'Selected Client';
            pType = 'Client';
        }

        downloadSOAExcel(soaEntityId, pName, pType, soaFilteredItems, true);
    };

    // Calculate dynamic high-level metrics
    const metrics = useMemo(() => {
        let totalBilled = 0;
        let totalCollected = 0;
        let totalPending = 0;
        let totalVat = 0;
        
        (filteredData || []).forEach((item: any) => {
            const amount = item.totalAmount || item.amount || 0;
            const vat = item.vatAmount || 0;
            totalBilled += amount;
            totalVat += vat;

            if (item.status === 'Received') {
                totalCollected += amount;
            } else {
                totalPending += amount;
            }
        });

        return {
            totalBilled,
            totalCollected,
            totalPending,
            totalVat,
            count: filteredData?.length || 0,
            pendingCount: (filteredData || []).filter((item: any) => item.status !== 'Received').length,
            collectedCount: (filteredData || []).filter((item: any) => item.status === 'Received').length
        };
    }, [filteredData]);

    // Aging Buckets Calculation
    const agingBuckets = useMemo(() => {
        const buckets: { [key: string]: { label: string; amount: number; count: number; color: string; desc: string; items: any[] } } = {
            current: { label: 'Current / Not Due', amount: 0, count: 0, color: 'bg-emerald-500', desc: 'Invoices within standard terms', items: [] },
            days30: { label: '1 - 30 Days Due', amount: 0, count: 0, color: 'bg-indigo-500', desc: 'Overdue up to 1 month', items: [] },
            days60: { label: '31 - 60 Days Due', amount: 0, count: 0, color: 'bg-amber-500', desc: 'Overdue 1 to 2 months', items: [] },
            days90: { label: '61 - 90 Days Due', amount: 0, count: 0, color: 'bg-orange-500', desc: 'Overdue 2 to 3 months', items: [] },
            daysOver90: { label: '90+ Days Overdue', amount: 0, count: 0, color: 'bg-rose-500', desc: 'Action required immediately', items: [] }
        };

        const today = new Date();
        today.setHours(0,0,0,0);

        (filteredData || []).forEach((item: any) => {
            // Only non-Received items belong to aging
            if (item.status === 'Received') return;

            const refDateStr = item.dueDate || item.date;
            if (!refDateStr) return;

            const refDate = new Date(refDateStr);
            refDate.setHours(0,0,0,0);

            const diffTime = today.getTime() - refDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const amount = item.totalAmount || item.amount || 0;

            if (diffDays <= 0) {
                buckets.current.amount += amount;
                buckets.current.count += 1;
                buckets.current.items.push(item);
            } else if (diffDays <= 30) {
                buckets.days30.amount += amount;
                buckets.days30.count += 1;
                buckets.days30.items.push(item);
            } else if (diffDays <= 60) {
                buckets.days60.amount += amount;
                buckets.days60.count += 1;
                buckets.days60.items.push(item);
            } else if (diffDays <= 90) {
                buckets.days90.amount += amount;
                buckets.days90.count += 1;
                buckets.days90.items.push(item);
            } else {
                buckets.daysOver90.amount += amount;
                buckets.daysOver90.count += 1;
                buckets.daysOver90.items.push(item);
            }
        });

        return buckets;
    }, [filteredData]);

    // Monthly Trends Calculation
    const monthlyTrends = useMemo(() => {
        const trends: { [key: string]: { label: string; bBilled: number; cCollected: number; pPending: number; itemsCount: number } } = {};

        (filteredData || []).forEach((item: any) => {
            const dateStr = item.date;
            if (!dateStr) return;

            const monthKey = dateStr.substring(0, 7); // YYYY-MM
            if (!trends[monthKey]) {
                const [yr, mn] = monthKey.split('-');
                const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
                const humanLabel = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                trends[monthKey] = {
                    label: humanLabel,
                    bBilled: 0,
                    cCollected: 0,
                    pPending: 0,
                    itemsCount: 0
                };
            }

            const amount = item.totalAmount || item.amount || 0;
            trends[monthKey].bBilled += amount;
            trends[monthKey].itemsCount += 1;

            if (item.status === 'Received') {
                trends[monthKey].cCollected += amount;
            } else {
                trends[monthKey].pPending += amount;
            }
        });

        return Object.keys(trends)
            .sort()
            .map(key => ({
                key,
                ...trends[key]
            }));
    }, [filteredData]);

    // Outstanding items helper for list below aging selectors
    const totalAgingAmount = Object.values(agingBuckets).reduce((acc, curr) => acc + curr.amount, 0);

    const activeAgingList = selectedAgingBucket ? agingBuckets[selectedAgingBucket]?.items || [] : [];
    const activeAgingLabel = selectedAgingBucket ? agingBuckets[selectedAgingBucket]?.label : '';

    return (
        <div className="relative space-y-6">
            
            {/* Header with Mode Toggles */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 border border-slate-100 rounded-3xl gap-4 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                        <span>Client Accounts Receivable</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">Analyze client invoices, outstanding aged debts, and payment trends.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/45 shrink-0">
                    <button 
                        onClick={() => setActiveTabMode('ledger')}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'ledger' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        📋 Invoice Ledger Table
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTabMode('insights');
                            setSelectedAgingBucket('days30'); // Default to 1-30 days overdue
                        }}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'insights' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        📊 Aging & Monthly Reports
                    </button>
                    <button 
                        onClick={() => setActiveTabMode('soa')}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'soa' ? "bg-white text-blue-600 shadow-sm" : "text-slate-505 hover:text-slate-800"
                        )}
                    >
                        📄 SOA & Monthly Packs
                    </button>
                </div>
            </div>

            {/* Financial Summary Ribbons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-blue-100 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Total Billed Invoices</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalBilled.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono">Invoiced count: {metrics.count} bills</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-emerald-100 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Revenue Collected</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalCollected.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-2 font-mono">
                        Settle rate: {metrics.totalBilled > 0 ? ((metrics.totalCollected / metrics.totalBilled) * 100).toFixed(1) : 0}% ({metrics.collectedCount} settled)
                    </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-indigo-100 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Outstanding Receivables</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalPending.toLocaleString()}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-2 font-mono">
                        {metrics.totalBilled > 0 ? ((metrics.totalPending / metrics.totalBilled) * 100).toFixed(1) : 0}% pending ({metrics.pendingCount} unpaid)
                    </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-slate-200 transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">5% Output Tax (VAT)</span>
                        <div className="p-2 bg-slate-50 text-slate-600 rounded-2xl">
                            <Percent className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalVat.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono">Collected Output VAT on ledger</p>
                </div>
            </div>

            {/* Main Dynamic Panel */}
            {activeTabMode === 'ledger' ? (
                <div className="space-y-4">
                    {/* Advanced Filter Controller */}
                    <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-blue-600" />
                                <span className="font-extrabold text-sm text-slate-800">Advanced Filter Controls</span>
                                {activeFiltersCount > 0 && (
                                    <span className="bg-blue-100 text-blue-700 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full">
                                        {activeFiltersCount} Filters applied
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {activeFiltersCount > 0 && (
                                    <button 
                                        onClick={handleClearAdvFilters}
                                        className="text-[11px] font-bold text-slate-450 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-xl transition-all cursor-pointer"
                                    >
                                        Reset All
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsAdvFilterOpen(!isAdvFilterOpen)}
                                    className="text-white bg-slate-800 hover:bg-slate-900 font-bold text-xs px-4 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                                >
                                    {isAdvFilterOpen ? "Hide Filter Dashboard" : "Show Advanced Filters"}
                                </button>
                            </div>
                        </div>

                        {isAdvFilterOpen && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                                {/* Date Start & End */}
                                <div className="space-y-1">
                                    <label className="block text-slate-500 font-mono font-bold uppercase text-[9px]">Date Period</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="date" 
                                            value={startDate} 
                                            onChange={e => setStartDate(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-hidden font-medium font-sans"
                                        />
                                        <input 
                                            type="date" 
                                            value={endDate} 
                                            onChange={e => setEndDate(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-hidden font-medium font-sans"
                                        />
                                    </div>
                                </div>

                                {/* Amount Range Threshold */}
                                <div className="space-y-1">
                                    <label className="block text-slate-500 font-mono font-bold uppercase text-[9px]">Amount Range (AED)</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="number" 
                                            placeholder="Min Amount" 
                                            value={minAmount} 
                                            onChange={e => setMinAmount(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-750 outline-hidden font-medium font-sans"
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Max Amount" 
                                            value={maxAmount} 
                                            onChange={e => setMaxAmount(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-755 outline-hidden font-medium font-sans"
                                        />
                                    </div>
                                </div>

                                {/* Partner & Project Selectors */}
                                <div className="space-y-1">
                                    <label className="block text-slate-500 font-mono font-bold uppercase text-[9px]">Client & project</label>
                                    <div className="flex gap-1.5">
                                        <select 
                                            value={filterEntity} 
                                            onChange={e => setFilterEntity(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer font-sans"
                                        >
                                            <option value="All">All Clients</option>
                                            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>)}
                                        </select>
                                        <select 
                                            value={filterProject} 
                                            onChange={e => setFilterProject(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer font-sans"
                                        >
                                            <option value="All">All Projects</option>
                                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Status & Quick Month dropdowns */}
                                <div className="space-y-1">
                                    <label className="block text-slate-500 font-mono font-bold uppercase text-[9px]">Status & Billing Month</label>
                                    <div className="flex gap-1.5">
                                        <select 
                                            value={filterStatus} 
                                            onChange={e => setFilterStatus(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer font-sans"
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Received">Received / Paid</option>
                                            <option value="Pending">Pending / Overdue</option>
                                        </select>
                                        <select 
                                            value={filterMonth} 
                                            onChange={e => setFilterMonth(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer font-mono"
                                        >
                                            <option value="All">All Months</option>
                                            {availableMonths.map((m: string) => {
                                                const [yr, mn] = m.split('-');
                                                const label = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                                return <option key={m} value={m}>{label}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DataTable<AccountsReceivable>
                        title="Accounts Receivable Ledger"
                        description="Standard general ledger list of client billings and collections."
                        icon={TrendingUp}
                        data={filteredData}
                        columns={[
                        { key: 'date', label: 'Date', sortable: true },
                        { key: 'invoiceNumber', label: 'Invoice #', sortable: true },
                        { 
                            key: 'companyId', 
                            label: 'Seller Company',
                            render: (item: any) => {
                                const comp = (companies || []).find((c: any) => c.id === item.companyId || c.name === item.companyName);
                                return (
                                    <div className="flex items-center gap-2">
                                        {comp?.logo ? (
                                            <img src={comp.logo} alt={comp.name} className="w-7 h-7 object-contain rounded-lg border border-slate-100 bg-white p-0.5 shrink-0" referrerPolicy="no-referrer" />
                                        ) : (
                                            <div className="w-7 h-7 bg-blue-50 text-blue-600 border border-blue-100/50 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                {(comp?.name || item.companyName || 'CO').substring(0, 2)}
                                            </div>
                                        )}
                                        <span className="font-extrabold text-slate-800 text-xs truncate max-w-[130px]">
                                            {comp?.name || item.companyName || 'Unassigned'}
                                        </span>
                                    </div>
                                );
                            }
                        },
                        { 
                            key: 'entityId', 
                            label: 'Entity / Project',
                            render: (item: any) => (
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">
                                        {getEntityName(item.entityId || item.projectId, item.entityType || 'Project')}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                                        {(item.entityType || 'Project') === 'Vendor' ? 'Client' : (item.entityType || 'Project')}
                                    </span>
                                </div>
                            )
                        },
                        { 
                            key: 'amount', 
                            label: 'Amount',
                            sortable: true,
                            render: (item) => (
                                <span className="font-bold text-slate-600">AED {item.amount.toLocaleString()}</span>
                            )
                        },
                        { 
                            key: 'vatAmount', 
                            label: 'VAT (5%)',
                            render: (item) => (
                                <span className="text-slate-400">AED {(item.vatAmount || 0).toLocaleString()}</span>
                            )
                        },
                        { 
                            key: 'totalAmount', 
                            label: 'Total',
                            sortable: true,
                            render: (item) => (
                                <span className="font-black text-slate-900">AED {(item.totalAmount || item.amount).toLocaleString()}</span>
                            )
                        },
                        {
                            key: 'zoho_invoice',
                            label: 'Zoho Invoice',
                            render: (item: any) => {
                                const comp = (companies || []).find((c: any) => c.id === item.companyId || c.name === item.companyName);
                                const client = getEntityObject(item.entityId, item.entityType);
                                return (
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <button
                                            onClick={() => downloadZohoInvoicePDF(item, comp, client, bankAccounts)}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-blue-600 transition-colors shrink-0"
                                            title="Download Zoho PDF Invoice"
                                        >
                                            <Download className="w-4 h-4 text-blue-600" />
                                        </button>
                                        <button
                                            onClick={() => setPreviewInvoiceItem({ item, comp, client })}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-emerald-600 transition-colors shrink-0"
                                            title="View Invoice Live Preview"
                                        >
                                            <Eye className="w-4 h-4 text-emerald-600" />
                                        </button>
                                    </div>
                                );
                            }
                        },
                        { 
                            key: 'status', 
                            label: 'Status',
                            render: (item) => (
                                <span className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                    item.status === 'Received' ? "bg-emerald-100 text-emerald-600" :
                                    item.status === 'Pending' ? "bg-orange-100 text-orange-600" :
                                    "bg-blue-100 text-blue-600"
                                )}>
                                    {item.status}
                                </span>
                            )
                        },
                    ]}
                    onAdd={onAdd}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    searchFields={['invoiceNumber', 'description']}
                    exportFileName="Accounts_Receivable"
                    user={user}
                />
                </div>
            ) : activeTabMode === 'insights' ? (
                <div className="space-y-6">
                    {/* Interactive Aging Wheel & Progress metrics */}
                    <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-5 gap-3">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                                    <span>Client Aging Analysis Tracker</span>
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">Click on any age group to view detailed outstanding client invoices.</p>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <button
                                        onClick={() => downloadAgingAndMonthlyExcel(true, agingBuckets, monthlyTrends, (id, type) => getEntityName(id, type || 'Project'))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span>Export Excel</span>
                                    </button>
                                    <button
                                        onClick={() => downloadAgingAndMonthlyPDF(true, agingBuckets, monthlyTrends, totalAgingAmount, (id, type) => getEntityName(id, type || 'Project'))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Download PDF</span>
                                    </button>
                                    <button
                                        onClick={() => printAgingAndMonthlyReport(true, agingBuckets, monthlyTrends, totalAgingAmount, (id, type) => getEntityName(id, type || 'Project'))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Print Report</span>
                                    </button>
                                </div>
                            </div>
                            <div className="text-left md:text-right bg-slate-50 border border-slate-100 rounded-2xl p-3 shrink-0">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono">Total Pending Receivables</span>
                                <h4 className="text-xl font-black text-slate-800">AED {totalAgingAmount.toLocaleString()}</h4>
                            </div>
                        </div>

                        {/* Interactive Aging Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {Object.entries(agingBuckets).map(([key, bucket]) => {
                                const selected = selectedAgingBucket === key;
                                const pctOfTotal = totalAgingAmount > 0 ? (bucket.amount / totalAgingAmount) * 100 : 0;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedAgingBucket(key)}
                                        className={cn(
                                            "flex flex-col text-left p-4 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden",
                                            selected 
                                                ? "border-indigo-600 bg-indigo-50/20 shadow-md shadow-indigo-600/5 scale-[1.02]" 
                                                : "border-slate-100 hover:border-slate-300 bg-white"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">
                                                {bucket.label}
                                            </span>
                                            {bucket.count > 0 && (
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded-lg text-[9px] font-black text-white shrink-0 font-mono",
                                                    bucket.color
                                                )}>
                                                    {bucket.count}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[16px] font-black text-slate-900 leading-none">AED {bucket.amount.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1.5 font-mono">{pctOfTotal.toFixed(1)}% of total</p>
                                        
                                        {/* Colored Progress Bar Segment */}
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                                            <div 
                                                className={cn("h-full rounded-full", bucket.color)} 
                                                style={{ width: `${pctOfTotal}%` }} 
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected Aging Bucket Details */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedAgingBucket || 'none'}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-slate-50/80 border border-slate-100 rounded-3xl p-5 md:p-6"
                            >
                                <div className="flex justify-between items-center border-b border-slate-200/50 pb-4 mb-4">
                                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                        <span className="inline-block w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse" />
                                        <span>Details for Group:</span>
                                        <strong className="text-indigo-600">{activeAgingLabel}</strong>
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-bold font-mono">
                                        {activeAgingList.length} outstanding invoices in this bucket
                                    </span>
                                </div>

                                {activeAgingList.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400">
                                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                        <p className="font-extrabold text-slate-700 text-sm">Perfect Balance!</p>
                                        <p className="text-[11px] text-slate-400 font-medium">No client accounts are overdue in this aging category.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                                    <th className="py-3 px-2">Invoice #</th>
                                                    <th className="py-3 px-2">Client name / Project</th>
                                                    <th className="py-3 px-2">Bill Date</th>
                                                    <th className="py-3 px-2">Due Date</th>
                                                    <th className="py-3 px-2">Overdue By</th>
                                                    <th className="py-3 px-2 text-right">Outstanding Amount</th>
                                                    <th className="py-3 px-2 text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-150">
                                                {activeAgingList.map((item: any) => {
                                                    const today = new Date();
                                                    today.setHours(0,0,0,0);
                                                    const refDate = new Date(item.dueDate || item.date);
                                                    const diffDays = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
                                                    const client = getEntityObject(item.entityId, item.entityType);
                                                    const comp = (companies || []).find((c: any) => c.id === item.companyId || c.name === item.companyName);

                                                    return (
                                                        <tr key={item.id} className="text-xs hover:bg-slate-100/50 transition-colors">
                                                            <td className="py-3.5 px-2 font-black text-slate-900 font-mono">{item.invoiceNumber}</td>
                                                            <td className="py-3.5 px-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-800">{getEntityName(item.entityId, item.entityType)}</span>
                                                                    <span className="text-[10px] text-slate-400 font-mono uppercase shrink-0">
                                                                        {item.entityType === 'Vendor' ? 'Client' : item.entityType}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5 px-2 font-medium text-slate-505 font-mono">{item.date}</td>
                                                            <td className="py-3.5 px-2 font-semibold text-slate-600 font-mono">{item.dueDate || 'N/A'}</td>
                                                            <td className="py-3.5 px-2 font-bold">
                                                                {diffDays <= 0 ? (
                                                                    <span className="text-emerald-600 font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Not overdue</span>
                                                                ) : (
                                                                    <span className="text-rose-600 font-mono text-[10px] bg-rose-50 px-2 py-0.5 rounded-full font-bold">{diffDays} days past due</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-2 text-right font-black text-slate-900 font-mono">
                                                                AED {(item.totalAmount || item.amount).toLocaleString()}
                                                            </td>
                                                            <td className="py-3.5 px-2 text-center">
                                                                <button
                                                                    onClick={() => setPreviewInvoiceItem({ item, comp, client })}
                                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" /> Preview
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Monthly Trends Dashboard */}
                    <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-5">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                                <span>Monthly Invoicing & Collections Ledger</span>
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">Chronological summary of client invoices issued, money collected, and pending receipts.</p>
                        </div>

                        {monthlyTrends.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl">
                                <p className="font-bold">No monthly ledger data available yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left: Monthly Trends Ledger Table */}
                                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                                <th className="py-3.5 px-4 font-extrabold text-slate-500">Billing Month</th>
                                                <th className="py-3.5 px-4 text-right">Invoiced (AED)</th>
                                                <th className="py-3.5 px-4 text-right">Collected (AED)</th>
                                                <th className="py-3.5 px-4 text-right">Outstanding (AED)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {monthlyTrends.map((trend: any) => {
                                                const collPct = trend.bBilled > 0 ? (trend.cCollected / trend.bBilled) * 100 : 0;
                                                return (
                                                    <tr key={trend.key} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-3.5 px-4 font-extrabold text-slate-800">{trend.label}</td>
                                                        <td className="py-3.5 px-4 text-right font-bold text-slate-500">{trend.bBilled.toLocaleString()}</td>
                                                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600">
                                                            {trend.cCollected.toLocaleString()}
                                                            <span className="block text-[9px] font-bold font-mono text-emerald-500 mt-0.5">{collPct.toFixed(0)}% Settle rate</span>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right font-black text-rose-600">{trend.pPending.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Right: Visual Progress Chart representation of Month-on-Month billing */}
                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 md:p-6 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">Month-on-Month billing and liquidation</h4>
                                        <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
                                            {monthlyTrends.map((trend: any) => {
                                                const collPct = trend.bBilled > 0 ? (trend.cCollected / trend.bBilled) * 100 : 0;
                                                return (
                                                    <div key={trend.key} className="space-y-1">
                                                        <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700">
                                                            <span className="font-extrabold">{trend.label}</span>
                                                            <span className="font-mono text-slate-500">AED {trend.bBilled.toLocaleString()}</span>
                                                        </div>
                                                        <div className="relative w-full h-3 bg-slate-200/50 rounded-full overflow-hidden flex">
                                                            {/* Color for collected */}
                                                            <div 
                                                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-l-full relative group transition-all" 
                                                                style={{ width: `${collPct}%` }}
                                                                title={`Collected: AED ${trend.cCollected.toLocaleString()}`}
                                                            />
                                                            {/* Color for uncollected */}
                                                            <div 
                                                                className="bg-gradient-to-r from-orange-400 to-rose-500 h-full rounded-r-full transition-all" 
                                                                style={{ width: `${100 - collPct}%` }}
                                                                title={`Pending: AED ${trend.pPending.toLocaleString()}`}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                                                            <span>Liquidation: {collPct.toFixed(1)}%</span>
                                                            <span>Pending: {(100 - collPct).toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200/50 flex justify-around text-[10px] font-bold font-mono">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                            <span className="text-slate-505">Collected (Revenue)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                                            <span className="text-slate-505">Pending (Overdue Debt)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* activeTabMode === 'soa' */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                    
                    {/* Left: SOA Custom Builder (5 columns wide) */}
                    <div className="lg:col-span-5 bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span>Compile Partner Statement of Account (SOA)</span>
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">
                                Produce corporate-grade ledger statements of transactions, revenue, and client receipts over custom spans.
                            </p>
                        </div>

                        <div className="space-y-4 text-xs font-semibold font-sans">
                            {/* Client Entity Select */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Select Client Counterparty</label>
                                <select 
                                    value={soaEntityId} 
                                    onChange={e => setSoaEntityId(e.target.value)}
                                    className="w-full bg-slate-55 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-850 outline-hidden font-extrabold cursor-pointer text-xs"
                                >
                                    <option value="All">All Registered Clients Combined</option>
                                    {arClientOptions.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Company Origin/Seller */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider text-brand-600">Select Company Issuer</label>
                                <select 
                                    value={soaCompanyId} 
                                    onChange={e => setSoaCompanyId(e.target.value)}
                                    className="w-full bg-slate-55 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-850 outline-hidden font-extrabold cursor-pointer text-xs text-brand-600 hover:border-brand-300 transition-colors"
                                >
                                    <option value="All">All Companies (Default Pioneer Header)</option>
                                    {(companies || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            💼 {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Project Filter */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Associated Project / contract</label>
                                <select 
                                    value={soaProjectId} 
                                    onChange={e => setSoaProjectId(e.target.value)}
                                    className="w-full bg-slate-55 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-850 outline-hidden font-extrabold cursor-pointer text-xs"
                                >
                                    <option value="All">All Projects Combined</option>
                                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            {/* Date Span */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={soaStartDate} 
                                        onChange={e => setSoaStartDate(e.target.value)}
                                        className="w-full bg-slate-55 border border-slate-200 rounded-2xl px-3 py-2 text-slate-850 outline-hidden font-bold text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">End Date</label>
                                    <input 
                                        type="date" 
                                        value={soaEndDate} 
                                        onChange={e => setSoaEndDate(e.target.value)}
                                        className="w-full bg-slate-55 border border-slate-200 rounded-2xl px-3 py-2 text-slate-850 outline-hidden font-bold text-xs"
                                    />
                                </div>
                            </div>

                            {/* Statement Scope Category */}
                            <div className="space-y-1.5">
                                <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Scope category filter</label>
                                <select 
                                    value={soaScope} 
                                    onChange={e => setSoaScope(e.target.value as any)}
                                    className="w-full bg-slate-55 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-850 outline-hidden font-extrabold cursor-pointer text-xs"
                                >
                                    <option value="All">Include Combined Transactions (All)</option>
                                    <option value="Pending">Outstanding / Pending Demands Only</option>
                                    <option value="Received">Settled / Closed Invoices Only</option>
                                </select>
                            </div>

                            {/* Preview Badge Info */}
                            <div className="bg-blue-50/50 border border-blue-100/30 p-4 rounded-3xl space-y-1.5">
                                <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-blue-700 font-mono">Statement Target Cohort</h4>
                                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                                    <span>Matching Records:</span>
                                    <span className="font-mono text-slate-800 font-bold">{soaFilteredItems.length} invoices</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-555 text-[11px]">
                                    <span>Cumulative Billed:</span>
                                    <span className="font-mono text-slate-900 font-black">AED {soaFilteredItems.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Generating Actions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                                <button
                                    onClick={handleGenerateSOAPDF}
                                    disabled={soaFilteredItems.length === 0}
                                    className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold p-3 rounded-2xl transition-all shadow-xs cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download PDF SOA</span>
                                </button>
                                <button
                                    onClick={handleGenerateSOAExcel}
                                    disabled={soaFilteredItems.length === 0}
                                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold p-3 rounded-2xl transition-all shadow-xs cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    <span>Download Excel SOA</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Month-by-month Accounts Ledger Pack (7 columns wide) */}
                    <div className="lg:col-span-7 bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    <span>Month-by-Month Accounts Ledger Pack</span>
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    Instantly compile and package whole months into structured Excel and PDF registers.
                                </p>
                            </div>
                            <button
                                onClick={handleDownloadAllMonthsConsolidated}
                                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-4 py-2 rounded-2xl shadow-xs transition-colors cursor-pointer shrink-0"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Master Workbook</span>
                            </button>
                        </div>

                        {availableMonths.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-medium border border-dashed border-slate-150 rounded-3xl">
                                No billing records found in the ledger to segment by month.
                            </div>
                        ) : (
                            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                                {availableMonths.map((mKey) => {
                                    const mItems = (data || []).filter((item: any) => item.date && item.date.substring(0, 7) === mKey);
                                    const mTotal = mItems.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0);
                                    const mPaid = mItems.reduce((sum, item) => sum + (item.status === 'Received' ? (item.totalAmount || item.amount || 0) : 0), 0);
                                    const mPending = mTotal - mPaid;

                                    const [yr, mn] = mKey.split('-');
                                    const mLabel = new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });

                                    return (
                                        <div 
                                            key={mKey}
                                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 hover:bg-slate-100/60 border border-slate-100 hover:border-slate-200 p-4 rounded-3xl transition-all gap-4 animate-fadeIn"
                                        >
                                            <div className="space-y-1">
                                                <h4 className="font-extrabold text-sm text-slate-800 font-sans">{mLabel}</h4>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-mono">
                                                    <span>Invoices: <strong className="text-slate-700">{mItems.length} records</strong></span>
                                                    <span>Billed: <strong className="text-slate-700">AED {mTotal.toLocaleString()}</strong></span>
                                                    <span>Collected: <strong className="text-emerald-600">AED {mPaid.toLocaleString()}</strong></span>
                                                    <span>Outstanding: <strong className="text-rose-600 font-bold">AED {mPending.toLocaleString()}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end font-sans">
                                                <button
                                                    onClick={() => executeDownloadMonthExcel(mKey)}
                                                    className="flex items-center gap-1 bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 hover:bg-emerald-500 hover:text-white px-3.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs"
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                    <span>Excel</span>
                                                </button>
                                                <button
                                                    onClick={() => executeDownloadMonthPDF(mKey)}
                                                    className="flex items-center gap-1 bg-white border border-slate-200 hover:border-rose-300 text-rose-700 hover:bg-rose-500 hover:text-white px-3.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    <span>PDF pack</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Zoho Books Live Invoice Preview Lightbox */}
            {previewInvoiceItem && (() => {
                const { item, comp, client } = previewInvoiceItem;
                const defaultBank = (bankAccounts || []).find(b => b.isDefault) || (bankAccounts || [])[0] || {
                    accountName: "Pioneer General Contracting LLC",
                    bankName: "Abu Dhabi Commercial Bank",
                    accountNumber: "11249315820001",
                    iban: "AE190030011249315820001",
                    swiftCode: "ADCBAEAA",
                    currency: "AED"
                };
                const itemsList = item.items && item.items.length > 0 
                    ? item.items 
                    : [{ id: '1', name: item.description || 'General Contracting & Technical works', description: 'Detailed project works executed on-site', quantity: 1, rate: item.amount || 0, total: item.amount || 0 }];
                return (
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setPreviewInvoiceItem(null)}
                    >
                        <div 
                            className="bg-white w-full max-w-4xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in scale-in duration-300 border border-slate-100"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Toolbar header */}
                            <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100 bg-slate-50">
                                <div>
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full">Zoho Books Invoice Engine</span>
                                    <h3 className="font-extrabold text-slate-900 text-lg mt-1">Invoice Preview: {item.invoiceNumber || 'NEW UNIQUE INVOICE'}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => downloadZohoInvoicePDF(item, comp, client, bankAccounts)}
                                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-500/10 cursor-pointer"
                                    >
                                        <Download className="w-4 h-4" /> Download PDF
                                    </button>
                                    <button 
                                        onClick={() => setPreviewInvoiceItem(null)}
                                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Live Zoho Invoice Page Render Container */}
                            <div className="flex-1 overflow-y-auto bg-slate-100 p-8 flex justify-center">
                                <div className="bg-white w-[184mm] min-h-[260mm] shadow-lg rounded-2xl p-10 border border-slate-200/60 flex flex-col justify-between relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
                                    
                                    <div>
                                        {/* Top Accent line */}
                                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500 rounded-t-2xl"></div>

                                        {/* Invoice Header Section */}
                                        <div className="flex justify-between items-start mb-8">
                                            {/* Left - Seller details */}
                                            <div className="space-y-4">
                                                {comp?.logo ? (
                                                    <img src={comp.logo} alt={comp.name} className="h-14 object-contain rounded-xl border border-slate-100 bg-white p-1" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md uppercase">
                                                        {(comp?.name || item.companyName || 'CO').substring(0, 2)}
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 className="font-black text-slate-900 text-base uppercase tracking-tight">{comp?.name || 'Pioneer Contracting Group'}</h4>
                                                    <p className="text-[11px] text-slate-500 font-medium whitespace-pre-line leading-relaxed">
                                                        {comp?.address || 'United Arab Emirates'}<br />
                                                        {comp?.email ? `Email: ${comp.email}` : 'Email: accounts@pioneer.ae'}<br />
                                                        {comp?.phone ? `Phone: ${comp.phone}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right - General Metadata */}
                                            <div className="text-right">
                                                <h2 className="text-3xl font-black text-blue-600 tracking-wider mb-2">TAX INVOICE</h2>
                                                <div className="inline-grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-left">
                                                    <span className="text-slate-400 font-semibold">Invoice No:</span>
                                                    <span className="font-bold text-slate-900 text-right">{item.invoiceNumber || 'INV-0000'}</span>
                                                    
                                                    <span className="text-slate-400 font-semibold">Date:</span>
                                                    <span className="font-bold text-slate-950 text-right">{item.date}</span>

                                                    <span className="text-slate-400 font-semibold">Due Date:</span>
                                                    <span className="font-bold text-slate-950 text-right">{item.dueDate || item.date}</span>

                                                    <span className="text-slate-400 font-semibold">Status:</span>
                                                    <span className={cn(
                                                        "font-black text-right uppercase tracking-wide",
                                                        item.status === 'Received' ? "text-emerald-600" : "text-orange-500"
                                                    )}>{item.status || 'Pending'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <hr className="border-slate-100 mb-6" />

                                        {/* Bill From and Bill To split grid */}
                                        <div className="mb-8">
                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-2">Billed To / Clients</span>
                                            <h5 className="font-black text-slate-950 text-sm whitespace-nowrap">{client?.name || item.contact || 'Valued Client'}</h5>
                                            <p className="text-[11px] text-slate-500 whitespace-pre-line leading-relaxed mt-1">
                                                {client?.address || 'Dubai, United Arab Emirates'}<br />
                                                {client?.email && `Email: ${client.email}`}<br />
                                                {client?.phone && `Phone: ${client.phone}`}
                                            </p>
                                        </div>

                                        {/* Line items list grid */}
                                        <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="px-4 py-3 text-center w-12">S.No</th>
                                                        <th className="px-4 py-3">Item Name & Description</th>
                                                        <th className="px-4 py-3 text-right w-24">Qty</th>
                                                        <th className="px-4 py-3 text-right w-36">Rate (AED)</th>
                                                        <th className="px-4 py-3 text-right w-36">Total (AED)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs">
                                                    {itemsList.map((li: any, idx: number) => (
                                                        <tr key={li.id || idx} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                                                            <td className="px-4 py-3 pr-8">
                                                                <span className="font-extrabold text-slate-900 block">{li.name || 'Service Rendering Item'}</span>
                                                                <span className="text-[10.5px] text-slate-450 block mt-0.5 leading-normal">{li.description || 'General contracting technical work'}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-600 font-bold">{li.quantity || 1}</td>
                                                            <td className="px-4 py-3 text-right text-slate-600 font-bold">AED {Number(li.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-4 py-3 text-right text-slate-900 font-black">AED {Number(li.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Direct Banking & Totals block */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                            {/* Bank Transfer Details Box */}
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] self-start">
                                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-2">Bank Details:</span>
                                                <div className="space-y-1.5 leading-normal">
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-slate-400 font-semibold whitespace-nowrap">Beneficiary:</span>
                                                        <span className="font-bold text-slate-700 text-right">{defaultBank.accountName}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-slate-400 font-semibold whitespace-nowrap">Bank Name:</span>
                                                        <span className="font-bold text-slate-700 text-right">{defaultBank.bankName}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-slate-400 font-semibold">Account No:</span>
                                                        <span className="font-bold text-slate-700 text-right font-mono">{defaultBank.accountNumber}</span>
                                                    </div>
                                                    <div className="flex flex-col p-1.5 bg-blue-50/70 text-blue-950 rounded-lg px-2 mt-1 gap-0.5">
                                                        <span className="font-black text-[9px] text-blue-600 uppercase tracking-wider">IBAN:</span>
                                                        <span className="font-extrabold font-mono tracking-tight text-[11px] select-all">{defaultBank.iban}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] pt-1">
                                                        <span className="text-slate-400 font-semibold">Swift Bic / Currency:</span>
                                                        <span className="font-bold text-slate-600">{defaultBank.swiftCode} / {defaultBank.currency}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Totals compilation box */}
                                            <div className="space-y-2 text-xs flex flex-col justify-end">
                                                <div className="flex justify-between items-center text-slate-500 font-medium">
                                                    <span>Sub Total:</span>
                                                    <span className="font-bold text-slate-800">AED {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-slate-500 font-medium">
                                                    <span>VAT (5.00%):</span>
                                                    <span className="font-bold text-slate-800">AED {Number(item.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-blue-50/50 border border-blue-100 text-blue-700 p-3 rounded-xl font-black text-sm mt-3">
                                                    <span>Total Due:</span>
                                                    <span className="text-base text-blue-600">AED {Number(item.totalAmount || item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Signatures & Footer block */}
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end border-t border-slate-100 pt-6">
                                            <div className="text-[10px] text-slate-400 max-w-sm leading-normal">
                                                <span className="font-bold text-slate-600 block mb-1">TERMS & DISCLOSURES</span>
                                                Please quote invoice numbers on your remittance. Electronic copy of invoice issued under official corporate authorization.
                                            </div>
                                            <div className="text-right space-y-1 justify-end flex flex-col items-end">
                                                <div className="w-32 border-b border-slate-300 h-8"></div>
                                                <span className="text-[9px] font-black text-slate-950 uppercase tracking-wider block pt-2">AUTHORIZED SIGNATURE</span>
                                                <span className="text-[8px] text-slate-400 block">Pioneer Contracting Finance LLC</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export const downloadPettyCashPDF = (item: any, emp?: any) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Add Watermark Logo
    const assets = getPioneerPDFAssets();
    if (assets.watermark) {
        doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
    }

    // Color Palette
    const primaryColor = [15, 23, 42]; // Slate-900
    const secondaryColor = [71, 85, 105]; // Slate-600
    const themeColor = [37, 99, 235]; // Blue-600
    const lightBg = [248, 250, 252]; // Slate-50

    // Header Accent Stripe
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(0, 0, 210, 8, 'F');

    // Brand Info
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("PIONEER DMS PORTAL", 15, 25);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Official Employee Petty Cash Disbursement Voucher", 15, 31);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 35);

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text("PETTY CASH VOUCHER", 125, 25);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Voucher Ref: #PCV-${item.id.substring(0, 8).toUpperCase()}`, 125, 31);
    doc.text(`Status: Paid & Handed Over`, 125, 35);

    // Divider
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(15, 42, 195, 42);

    // Section 1: Employee Information
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(15, 48, 180, 48, 'F');
    doc.rect(15, 48, 180, 48, 'D');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("EMPLOYEE / RECIPIENT INFORMATION", 20, 55);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Name:`, 20, 63);
    doc.setFont("Helvetica", "bold");
    doc.text(`${emp?.name || item.contact || item.requestedBy || 'Unknown Employee'}`, 55, 63);

    doc.setFont("Helvetica", "normal");
    doc.text(`Employee Code:`, 20, 70);
    doc.setFont("Helvetica", "bold");
    doc.text(`${emp?.code || 'N/A'}`, 55, 70);

    doc.setFont("Helvetica", "normal");
    doc.text(`Designation:`, 20, 77);
    doc.text(`${emp?.designation || 'N/A'}`, 55, 77);

    doc.setFont("Helvetica", "normal");
    doc.text(`Department:`, 20, 84);
    doc.text(`${emp?.department || 'N/A'}`, 55, 84);

    // Section 2: Transaction Details
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DISBURSEMENT DETAILS", 15, 110);

    // Table Header
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(15, 115, 180, 10, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Disbursement Purpose / Note", 20, 121);
    doc.text("Book / Category", 80, 121);
    doc.text("Payment Mode", 125, 121);
    doc.text("Amount Paid", 165, 121);

    // Table Row values
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(item.description || "Petty cash distribution / advance", 20, 132);
    doc.text(item.category || "General", 80, 132);
    doc.text(item.mode || "Cash", 125, 132);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text(`AED ${Number(item.amount).toFixed(2)}`, 165, 132);

    // Table Outlines
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.line(15, 125, 15, 137);
    doc.line(195, 125, 195, 137);
    doc.line(15, 137, 195, 137);

    // Total sum block
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(125, 143, 70, 14, 'F');
    doc.rect(125, 143, 70, 14, 'D');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Total Handed:", 129, 152);
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text(`AED ${Number(item.amount).toFixed(2)}`, 160, 152);

    // Authorizations & Signatures
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DISBURSED BY (HR / ADMIN)", 15, 195);
    doc.line(15, 190, 75, 190);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Pioneer Operations Dept / Cashier", 15, 199);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("EMPLOYEE SIGNATURE & RECEIPT", 120, 195);
    doc.line(120, 190, 195, 190);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Received the above sum in complete full.", 120, 199);

    // Footer disclaimer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("This petty cash disbursement voucher represents immediate cashier payment. Scan & re-upload signed copy.", 105, 280, { align: "center" });

    doc.save(`PettyCash_Disbursement_${emp?.name ? emp.name.replace(/\s+/g, '_') : 'Employee'}_${item.date}.pdf`);
};

export const PettyCashView = ({ data, projects, onAdd, onEdit, onSave, onDelete, user, employees, everydayExpenses }: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBook, setSelectedBook] = useState('All Books');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedProject, setSelectedProject] = useState('All');
    const [selectedContact, setSelectedContact] = useState('All');
    const [dateRange, setDateRange] = useState('All');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    // Row level direct signed voucher upload and lightbox preview properties
    const [previewSignedAttachment, setPreviewSignedAttachment] = useState<{ data: string; name: string } | null>(null);
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
    const rowFileInputRef = useRef<HTMLInputElement>(null);

    const handleRowFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingItemId) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const item = data.find((x: any) => x.id === uploadingItemId);
            if (item) {
                const updatedItem = {
                    ...item,
                    signedAttachment: reader.result as string,
                    signedAttachmentName: file.name
                };
                if (onSave) {
                    onSave(updatedItem);
                }
            }
            setUploadingItemId(null);
            if (rowFileInputRef.current) rowFileInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    };

    // Export Report Modal states
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportTab, setExportTab] = useState<'all' | 'day' | 'contact' | 'category' | 'mode'>('all');
    const [pdfSettings, setPdfSettings] = useState({
        fontSize: 'medium', // small, medium, large
        margin: 'normal',   // compact, normal, wide
        showLogo: true,
        theme: 'classic'     // classic, modern, simple
    });
    const [showPdfSettings, setShowPdfSettings] = useState(false);

    // Dynamic list of books (categories)
    const books = useMemo(() => {
        const cats = new Set<string>();
        data.forEach((item: any) => {
            if (item.category) cats.add(item.category);
        });
        return ['All Books', ...Array.from(cats)];
    }, [data]);

    // Dynamic list of unique contacts / suppliers
    const contacts = useMemo(() => {
        const list = new Set<string>();
        data.forEach((item: any) => {
            const name = item.contact || item.requestedBy || 'Boss';
            if (name && name.trim()) {
                list.add(name.trim());
            }
        });
        return Array.from(list).sort((a, b) => a.localeCompare(b));
    }, [data]);

    const getProjectName = (id?: string) => {
        if (!id) return 'General';
        return projects.find((p: any) => p.id === id)?.name || 'N/A';
    };

    // Filtered data for active workspace list
    const filteredData = useMemo(() => {
        let result = [...data];

        // Book/Category filter
        if (selectedBook !== 'All Books') {
            result = result.filter(item => item.category === selectedBook);
        }

        // Mode filter
        if (selectedMode !== 'All') {
            result = result.filter(item => (item.mode || 'Cash') === selectedMode);
        }

        // Project filter
        if (selectedProject !== 'All') {
            result = result.filter(item => (item.projectId || '') === selectedProject);
        }

        // Contact / Supplier filter
        if (selectedContact !== 'All') {
            result = result.filter(item => {
                const name = item.contact || item.requestedBy || 'Boss';
                return name.trim() === selectedContact;
            });
        }

        // Search term
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            result = result.filter(item => 
                (item.description || '').toLowerCase().includes(query) ||
                (item.category || '').toLowerCase().includes(query) ||
                (item.requestedBy || '').toLowerCase().includes(query) ||
                (item.contact || '').toLowerCase().includes(query)
            );
        }

        // Date filter
        const todayStr = new Date().toISOString().split('T')[0];
        if (dateRange === 'today') {
            result = result.filter(item => item.date === todayStr);
        } else if (dateRange === 'this-month') {
            const monthStr = new Date().toISOString().slice(0, 7); // yyyy-mm
            result = result.filter(item => item.date.startsWith(monthStr));
        } else if (dateRange === 'last-month') {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            const prevMonthStr = d.toISOString().slice(0, 7);
            result = result.filter(item => item.date.startsWith(prevMonthStr));
        } else if (dateRange === 'this-year') {
            const yearStr = new Date().getFullYear().toString();
            result = result.filter(item => item.date.startsWith(yearStr));
        } else if (dateRange === 'custom') {
            if (customStartDate) {
                result = result.filter(item => item.date >= customStartDate);
            }
            if (customEndDate) {
                result = result.filter(item => item.date <= customEndDate);
            }
        }

        return result;
    }, [data, selectedBook, selectedMode, selectedProject, selectedContact, searchTerm, dateRange, customStartDate, customEndDate]);

    // Chronologically sorted entries to compute accurate progressive running balances
    const sortedWithRunningBalances = useMemo(() => {
        // Sort ascending by date & ID to make balance calculation stable
        const sorted = [...filteredData].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.id.localeCompare(b.id);
        });

        let balance = 0;
        return sorted.map(item => {
            const amountVal = item.amount || 0;
            if (item.type === 'Income') {
                balance += amountVal;
            } else {
                balance -= amountVal;
            }
            return {
                ...item,
                runningBalance: balance
            };
        });
    }, [filteredData]);

    // Visually display latest first in the tables
    const displayData = useMemo(() => {
        return [...sortedWithRunningBalances].reverse();
    }, [sortedWithRunningBalances]);

    // Totals
    const totals = useMemo(() => {
        let cashIn = 0;
        let cashOut = 0;
        filteredData.forEach(item => {
            const amountVal = item.amount || 0;
            if (item.type === 'Income') {
                cashIn += amountVal;
            } else {
                cashOut += amountVal;
            }
        });
        return {
            cashIn,
            cashOut,
            balance: cashIn - cashOut
        };
    }, [filteredData]);

    // Grouping analytics for Export tabs
    const dayWiseData = useMemo(() => {
        const groups: Record<string, { date: string; cashIn: number; cashOut: number; count: number }> = {};
        sortedWithRunningBalances.forEach(item => {
            if (!groups[item.date]) {
                groups[item.date] = { date: item.date, cashIn: 0, cashOut: 0, count: 0 };
            }
            groups[item.date].count += 1;
            const amountVal = item.amount || 0;
            if (item.type === 'Income') {
                groups[item.date].cashIn += amountVal;
            } else {
                groups[item.date].cashOut += amountVal;
            }
        });

        let balance = 0;
        return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date)).map(g => {
            balance += (g.cashIn - g.cashOut);
            return {
                ...g,
                runningBalance: balance
            };
        });
    }, [sortedWithRunningBalances]);

    const contactWiseData = useMemo(() => {
        const groups: Record<string, { contact: string; count: number; cashIn: number; cashOut: number; categories: Set<string> }> = {};
        filteredData.forEach(item => {
            const contactName = item.contact || item.requestedBy || 'General';
            if (!groups[contactName]) {
                groups[contactName] = { contact: contactName, count: 0, cashIn: 0, cashOut: 0, categories: new Set() };
            }
            groups[contactName].count += 1;
            const amountVal = item.amount || 0;
            if (item.type === 'Income') {
                groups[contactName].cashIn += amountVal;
            } else {
                groups[contactName].cashOut += amountVal;
            }
            if (item.category) {
                groups[contactName].categories.add(item.category);
            }
        });
        return Object.values(groups).map(g => ({
            ...g,
            categoryList: Array.from(g.categories).join(', ') || 'N/A',
            balance: g.cashIn - g.cashOut
        })).sort((a, b) => b.cashIn - a.cashIn);
    }, [filteredData]);

    const categoryWiseData = useMemo(() => {
        const groups: Record<string, { category: string; count: number; cashIn: number; cashOut: number }> = {};
        filteredData.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!groups[cat]) {
                groups[cat] = { category: cat, count: 0, cashIn: 0, cashOut: 0 };
            }
            groups[cat].count += 1;
            const amountVal = item.amount || 0;
            if (item.type === 'Income') {
                groups[cat].cashIn += amountVal;
            } else {
                groups[cat].cashOut += amountVal;
            }
        });
        return Object.values(groups).map(g => ({
            ...g,
            balance: g.cashIn - g.cashOut
        })).sort((a, b) => b.cashIn - a.cashIn);
    }, [filteredData]);

    const paymentModeWiseData = useMemo(() => {
        const groups: Record<string, { mode: string; count: number; cashIn: number; cashOut: number }> = {};
        filteredData.forEach(item => {
            const mode = item.mode || 'Cash';
            if (!groups[mode]) {
                groups[mode] = { mode: mode, count: 0, cashIn: 0, cashOut: 0 };
            }
            groups[mode].count += 1;
            const amountVal = item.amount || 0;
            if (item.type === 'Income') {
                groups[mode].cashIn += amountVal;
            } else {
                groups[mode].cashOut += amountVal;
            }
        });
        return Object.values(groups).map(g => ({
            ...g,
            balance: g.cashIn - g.cashOut
        })).sort((a, b) => b.cashIn - a.cashIn);
    }, [filteredData]);

    const [isPettyCashPrintModalOpen, setIsPettyCashPrintModalOpen] = useState(false);

    const handleA4Print = () => {
        setIsPettyCashPrintModalOpen(true);
    };

    const handleA4PrintWithConfig = (options: PrintOptions) => {
        const styleId = 'pettycash-print-overrides';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `
            @media print {
                @page { 
                    size: ${options.orientation}; 
                    margin: ${options.margins === 'none' ? '0' : options.margins === 'minimum' ? '5mm' : '10mm'}; 
                }
                body { 
                    filter: ${options.colorMode === 'mono' ? 'grayscale(100%) !important' : 'none'};
                    ${options.fitToPaper ? 'zoom: 92% !important; max-width: 100vw !important; overflow: hidden !important;' : ''}
                    -webkit-print-color-adjust: ${options.bgGraphics ? 'exact' : 'unset'} !important;
                    print-color-adjust: ${options.bgGraphics ? 'exact' : 'unset'} !important;
                }
                ${options.highContrast ? `
                    * {
                        color: #000000 !important;
                        background-color: #ffffff !important;
                        border-color: #000000 !important;
                    }
                ` : ''}
            }
        `;
        
        window.print();
        
        setTimeout(() => {
            if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
            }
        }, 1500);
    };

    const handleExcelExport = () => {
        const wsData = sortedWithRunningBalances.map((item, idx) => ({
            'Sl No': idx + 1,
            'Date': item.date,
            'Category/Book': item.category,
            'Description': item.description,
            'Contact/Name': item.contact || item.requestedBy || '-',
            'Mode': item.mode || 'Cash',
            'Project': getProjectName(item.projectId),
            'Cash In (AED)': item.type === 'Income' ? item.amount : 0,
            'Cash Out (AED)': item.type === 'Expense' ? item.amount : 0,
            'Running Balance (AED)': item.runningBalance
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cash_Book_Ledger");
        XLSX.writeFile(wb, `${selectedBook === 'All Books' ? 'All_Accounts' : selectedBook}_Ledger.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Main Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 no-print">
                <div className="flex items-start gap-4">
                    <div className="p-4 bg-brand-50 text-brand-600 rounded-3xl">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Petty Cash Accounts</h1>
                        <p className="text-slate-500 text-sm font-semibold mt-1">Manage, analyze, and print small daily transactions and ledger books.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExcelExport}
                        className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                    >
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Export Excel
                    </button>
                    <button 
                        onClick={() => setShowExportModal(true)}
                        className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                    >
                        <Printer className="w-5 h-5 text-brand-600" />
                        Print A4 Report
                    </button>
                    <button 
                        onClick={onAdd}
                        className="px-6 py-3 bg-brand-600 text-white rounded-2xl text-sm font-black flex items-center gap-2 hover:bg-brand-700 active:scale-95 transition-all shadow-md shadow-brand-600/10"
                    >
                        <Plus className="w-5 h-5" />
                        Add Transaction
                    </button>
                </div>
            </div>

            {/* Cash Books / Registers Selector */}
            <div className="space-y-2 no-print">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Cash Book Account</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {books.map(book => {
                        const isSelected = selectedBook === book;
                        const bookEntries = data.filter((item: any) => book === 'All Books' || item.category === book);
                        let bookBal = 0;
                        bookEntries.forEach((item: any) => {
                            if (item.type === 'Income') bookBal += item.amount;
                            else bookBal -= item.amount;
                        });

                        // Deduct everyday expenses uploaded by this account name to reconcile automatically!
                        let totalEESpent = 0;
                        if (everydayExpenses) {
                            const matchingEE = (everydayExpenses || []).filter((ee: any) => {
                                if (book === 'All Books') {
                                    const cleanUploader = (ee.uploadedBy || '').toLowerCase().trim().split('(')[0].trim();
                                    return books.some(b => b !== 'All Books' && (cleanUploader === b.toLowerCase().trim() || (ee.uploadedBy || '').toLowerCase().trim().includes(b.toLowerCase().trim()) || (cleanUploader === 'jamel' && b.toLowerCase().trim() === 'jamil') || (cleanUploader === 'jamil' && b.toLowerCase().trim() === 'jamel')));
                                }
                                const cleanUploader = (ee.uploadedBy || '').toLowerCase().trim().split('(')[0].trim();
                                const targetBook = book.toLowerCase().trim();
                                return cleanUploader === targetBook || (ee.uploadedBy || '').toLowerCase().trim().includes(targetBook) || (cleanUploader === 'jamel' && targetBook === 'jamil') || (cleanUploader === 'jamil' && targetBook === 'jamel');
                            });
                            totalEESpent = matchingEE.reduce((sum: number, ee: any) => sum + (Number(ee.totalAmount) || Number(ee.billAmount) || 0), 0);
                        }

                        const reconciledBal = bookBal - totalEESpent;

                        return (
                            <button
                                key={book}
                                onClick={() => setSelectedBook(book)}
                                className={cn(
                                    "px-5 py-3 rounded-2xl text-xs font-bold border flex items-center gap-3 whitespace-nowrap active:scale-95 transition-all shadow-sm cursor-pointer",
                                    isSelected 
                                        ? "bg-slate-900 border-slate-900 text-white" 
                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                <div className={cn(
                                    "w-2.5 h-2.5 rounded-full",
                                    reconciledBal >= 0 ? "bg-emerald-500" : "bg-red-500"
                                )} />
                                <div className="text-left flex flex-col">
                                    <span className="font-bold">{book === 'All Books' ? '📁 All Accounts' : `👤 ${book}`}</span>
                                    {totalEESpent > 0 && (
                                        <span className="text-[9px] text-amber-500 font-extrabold tracking-tight">
                                            Reconciled: -{totalEESpent.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-lg text-[10px] font-black",
                                    isSelected 
                                        ? "bg-white/10 text-white" 
                                        : reconciledBal >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                )}>
                                    AED {reconciledBal.toLocaleString()}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dashboard KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Cash In</span>
                            <span className="text-3xl font-black text-emerald-600 tracking-tight">
                                AED {totals.cashIn.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Income Source Ledger</span>
                        <span className="font-extrabold text-emerald-600">Active</span>
                    </div>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Cash Out</span>
                            <span className="text-3xl font-black text-red-500 tracking-tight">
                                AED {totals.cashOut.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                            <TrendingDown className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Expense Settlement</span>
                        <span className="font-extrabold text-red-500">Settled</span>
                    </div>
                </div>

                <div className={cn(
                    "p-7 rounded-[2.5rem] border shadow-sm relative overflow-hidden transition-all",
                    totals.balance >= 0 ? "bg-slate-900 border-slate-900 text-white" : "bg-red-50 border-red-100 text-red-950"
                )}>
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <span className={cn("text-[10px] font-black uppercase tracking-widest block", totals.balance >= 0 ? "text-slate-400" : "text-red-500")}>Net Cash in Hand</span>
                            <span className="text-3xl font-black tracking-tight">
                                AED {totals.balance.toLocaleString()}
                            </span>
                        </div>
                        <div className={cn("p-3 rounded-2xl", totals.balance >= 0 ? "bg-white/10 text-white" : "bg-red-100 text-red-600")}>
                            <Wallet className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-600/30 flex items-center justify-between text-xs">
                        <span className={totals.balance >= 0 ? "text-slate-400" : "text-red-500/80"}>Progressive Safe Balance</span>
                        <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase",
                            totals.balance >= 0 ? "bg-emerald-500 text-white animate-pulse" : "bg-red-600 text-white"
                        )}>
                            {totals.balance >= 0 ? "Surplus" : "Deficit"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Filter Suite */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 no-print">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {/* Search field */}
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search description, contacts, or accounts..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Contact / Supplier Filter */}
                    <div className="space-y-1">
                        <select
                            value={selectedContact}
                            onChange={e => setSelectedContact(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
                        >
                            <option value="All">All Contacts</option>
                            {contacts.map((contactName: string) => (
                                <option key={contactName} value={contactName}>{contactName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mode Filter */}
                    <div className="space-y-1">
                        <select
                            value={selectedMode}
                            onChange={e => setSelectedMode(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
                        >
                            <option value="All">All Modes</option>
                            <option value="Cash">Cash</option>
                            <option value="Online">Online</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Card">Card</option>
                        </select>
                    </div>

                    {/* Project Filter */}
                    <div className="space-y-1">
                        <select
                            value={selectedProject}
                            onChange={e => setSelectedProject(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
                        >
                            <option value="All">All Projects</option>
                            {projects.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Quick Filter */}
                    <div className="space-y-1">
                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
                        >
                            <option value="All">All Dates</option>
                            <option value="today">Today</option>
                            <option value="this-month">This Month</option>
                            <option value="last-month">Last Month</option>
                            <option value="this-year">This Year</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Inputs */}
                {dateRange === 'custom' && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400">From</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={e => setCustomStartDate(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400">To</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={e => setCustomEndDate(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <button
                            onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                            className="text-xs font-bold text-brand-600 hover:text-brand-800 ml-auto"
                        >
                            Reset Dates
                        </button>
                    </div>
                )}
            </div>

            {/* Main Ledger Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden no-print">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Category Book</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Remark / Description</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact / Supplier</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Project</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mode</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Progressive Bal</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {displayData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400 font-bold">
                                        No cash transactions found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                displayData.map((item: any) => {
                                    const itemMode = item.mode || 'Cash';
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                                            <td className="px-6 py-4 text-xs font-black text-slate-500 whitespace-nowrap">{item.date}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-extrabold uppercase">
                                                    {item.category || 'General'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-900 max-w-xs truncate" title={item.description}>
                                                {item.description || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-800">{item.contact || item.requestedBy || 'Boss'}</span>
                                                    <span className="text-[9px] text-slate-400 uppercase tracking-widest">
                                                        {item.type === 'Income' ? 'Donor / Source' : 'Recipient'}
                                                    </span>
                                                    {item.employeeId && (
                                                        <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded mt-1 w-max uppercase tracking-wider">
                                                            👥 Employee Voucher
                                                        </span>
                                                    )}
                                                    {item.uploadedBy && (
                                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 w-max uppercase tracking-wider">
                                                            📸 {item.uploadedBy}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                                {getProjectName(item.projectId)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap",
                                                    itemMode === 'Cash' && "bg-emerald-50 text-emerald-700",
                                                    itemMode === 'Online' && "bg-sky-50 text-sky-700",
                                                    itemMode === 'Bank Transfer' && "bg-violet-50 text-violet-700",
                                                    itemMode === 'Cheque' && "bg-amber-50 text-amber-700",
                                                    itemMode === 'Card' && "bg-rose-50 text-rose-700"
                                                )}>
                                                    {itemMode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn(
                                                    "text-sm font-black",
                                                    item.type === 'Income' ? "text-emerald-600" : "text-red-500"
                                                )}>
                                                    {item.type === 'Income' ? '+' : '-'} AED {(item.amount || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn(
                                                    "text-sm font-black text-slate-800",
                                                    item.runningBalance < 0 && "text-red-600"
                                                 )}>
                                                     AED {item.runningBalance.toLocaleString()}
                                                 </span>
                                             </td>
                                             <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {item.employeeId && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const emp = (employees || []).find((x: any) => x.id === item.employeeId);
                                                                    downloadPettyCashPDF(item, emp);
                                                                }}
                                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-blue-600 transition-colors"
                                                                title="Download Voucher PDF"
                                                            >
                                                                <Download className="w-4 h-4 text-blue-600" />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setUploadingItemId(item.id);
                                                                    setTimeout(() => {
                                                                        rowFileInputRef.current?.click();
                                                                    }, 100);
                                                                }}
                                                                className={cn(
                                                                    "p-1.5 hover:bg-slate-100 rounded-lg transition-colors",
                                                                    item.signedAttachment ? "text-emerald-600 hover:text-emerald-700" : "text-slate-400 hover:text-emerald-650"
                                                                )}
                                                                title={item.signedAttachment ? "Change Signed Voucher" : "Upload Signed Voucher"}
                                                            >
                                                                <Upload className="w-4 h-4" />
                                                            </button>
                                                            {item.signedAttachment && (
                                                                <button
                                                                    onClick={() => setPreviewSignedAttachment({ data: item.signedAttachment, name: item.signedAttachmentName || 'Signed Voucher.pdf' })}
                                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-emerald-500 hover:text-emerald-600 transition-colors"
                                                                    title="View Signed Voucher"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => onEdit(item)} 
                                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600 transition-colors"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDelete(item)} 
                                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                             )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Hidden File Input for Row-level Direct Signed Voucher Upload */}
            <input 
                type="file"
                ref={rowFileInputRef}
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleRowFileChange}
            />

            {/* Document Preview Lightbox / Overlay */}
            {previewSignedAttachment && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewSignedAttachment(null)}
                >
                    <div 
                        className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in scale-in duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Signed Voucher Attachment Preview</h3>
                                <p className="text-xs text-slate-400 font-medium truncate max-w-md">{previewSignedAttachment.name}</p>
                            </div>
                            <button 
                                onClick={() => setPreviewSignedAttachment(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-6">
                            {previewSignedAttachment.data.startsWith('data:image') ? (
                                <img 
                                    src={previewSignedAttachment.data} 
                                    alt="Preview" 
                                    className="max-w-full max-h-full object-contain rounded-2xl shadow-lg border border-slate-200/50" 
                                    referrerPolicy="no-referrer"
                                />
                            ) : previewSignedAttachment.data.startsWith('data:application/pdf') ? (
                                <iframe 
                                    src={previewSignedAttachment.data} 
                                    className="w-full h-full bg-white rounded-2xl shadow-lg border border-slate-200/50" 
                                    title="Signed Voucher Preview"
                                />
                            ) : (
                                <div className="text-center bg-white p-8 rounded-3xl shadow-lg border border-slate-200/50 max-w-sm">
                                    <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="font-bold text-slate-800 mb-2">Detailed Preview Unsupported</p>
                                    <p className="text-slate-500 text-xs mb-5">This file type cannot be rendered directly in the preview, but you can download it to view it locally.</p>
                                    <a 
                                        href={previewSignedAttachment.data} 
                                        download={previewSignedAttachment.name} 
                                        className="inline-flex items-center gap-2 bg-brand-600 text-white text-xs font-bold px-5 py-3 rounded-2xl hover:bg-brand-700 transition"
                                    >
                                        <Download className="w-4 h-4" /> Download File
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* EXPORT TRANSACTIONS PRINT MODAL (Image 1 Replica) */}
            {/* ========================================================= */}
            {showExportModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print overflow-y-auto">
                    {/* Inline print overrides to lock background items out strictly on paper */}
                    <style dangerouslySetInnerHTML={{__html: `
                        @media print {
                            body * {
                                visibility: hidden !important;
                            }
                            #printable-report, #printable-report * {
                                visibility: visible !important;
                            }
                            #printable-report {
                                position: fixed !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 210mm !important;
                                height: auto !important;
                                margin: 0 !important;
                                padding: 15mm !important;
                                bg: white !important;
                                background: white !important;
                                color: black !important;
                                box-shadow: none !important;
                                border: none !important;
                                z-index: 99999999 !important;
                            }
                        }
                    `}} />

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-slate-100 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-200 h-[92vh] flex flex-col"
                    >
                        {/* Title Bar */}
                        <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Printer className="w-5 h-5 text-brand-600" />
                                    Export Transactions
                                </h2>
                                <p className="text-slate-500 text-xs font-semibold mt-0.5">Select a tab and customise settings before generating and downloading your statement</p>
                            </div>
                            <button 
                                onClick={() => { setShowExportModal(false); setShowPdfSettings(false); }}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors shadow-inner"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Top Filters / Report Tabs Bar */}
                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-2xl">
                                {(['all', 'day', 'contact', 'category', 'mode'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setExportTab(tab)}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-xs font-black capitalize transition-all cursor-pointer",
                                            exportTab === tab 
                                                ? "bg-white text-slate-950 shadow-sm"
                                                : "text-slate-600 hover:text-slate-900"
                                        )}
                                    >
                                        {tab === 'all' && 'All Entries'}
                                        {tab === 'day' && 'Day-wise'}
                                        {tab === 'contact' && 'Contact-wise'}
                                        {tab === 'category' && 'Category-wise'}
                                        {tab === 'mode' && 'Payment Mode'}
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => setShowPdfSettings(!showPdfSettings)}
                                className={cn(
                                    "px-4 py-2 border rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all",
                                    showPdfSettings ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <ListFilter className="w-4 h-4" />
                                PDF Settings
                            </button>
                        </div>

                        {/* Middle Content Workspace */}
                        <div className="flex-1 overflow-hidden flex relative">
                            {/* Left Settings Panel */}
                            {showPdfSettings && (
                                <div className="w-72 bg-white border-r border-slate-200 p-6 space-y-6 overflow-y-auto animate-slideRight">
                                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Customise Report Profile</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Font Scale</label>
                                            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl">
                                                {(['small', 'medium', 'large'] as const).map(sz => (
                                                    <button
                                                        key={sz}
                                                        onClick={() => setPdfSettings({ ...pdfSettings, fontSize: sz })}
                                                        className={cn(
                                                            "py-1.5 rounded-lg text-[10px] font-extrabold capitalize cursor-pointer",
                                                            pdfSettings.fontSize === sz ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                                                        )}
                                                    >
                                                        {sz}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Page Margins</label>
                                            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl">
                                                {(['compact', 'normal', 'wide'] as const).map(mg => (
                                                    <button
                                                        key={mg}
                                                        onClick={() => setPdfSettings({ ...pdfSettings, margin: mg })}
                                                        className={cn(
                                                            "py-1.5 rounded-lg text-[10px] font-extrabold capitalize cursor-pointer",
                                                            pdfSettings.margin === mg ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                                                        )}
                                                    >
                                                        {mg}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Corporate Branding logo</label>
                                            <div className="flex items-center gap-1.5">
                                                <input 
                                                    type="checkbox"
                                                    id="show-logo"
                                                    checked={pdfSettings.showLogo}
                                                    onChange={e => setPdfSettings({ ...pdfSettings, showLogo: e.target.checked })}
                                                    className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                                                />
                                                <label htmlFor="show-logo" className="text-xs font-bold text-slate-700 cursor-pointer">Show Pioneer Header Logo</label>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400">PDF Colour Palette</label>
                                            <select
                                                value={pdfSettings.theme}
                                                onChange={e => setPdfSettings({ ...pdfSettings, theme: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                                            >
                                                <option value="classic">Classic Corporate (Slate)</option>
                                                <option value="emerald">Emerald Ledger (Green)</option>
                                                <option value="elegant">Ocean Royal (Blue)</option>
                                                <option value="minimal">Minimal Cash (Charcoal)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-semibold pt-4 border-t border-slate-100">
                                        Note: PDF downloads are optimized for local paper printing and standard A4 sizes. Please use landscape or portrait layout accordingly inside the print interface.
                                    </div>
                                </div>
                            )}

                            {/* Live Layout Report Sheet Preview */}
                            <div className="flex-1 bg-slate-200/50 p-8 overflow-auto flex justify-center custom-scrollbar">
                                <div 
                                    id="printable-report"
                                    className={cn(
                                        "bg-white shadow-xl border w-[210mm] min-h-[297mm] transition-all origin-top shrink-0 text-slate-900 border-slate-300/60 p-[15mm] space-y-6 relative flex flex-col justify-start",
                                        pdfSettings.fontSize === 'small' && "text-[11px]",
                                        pdfSettings.fontSize === 'medium' && "text-[13px]",
                                        pdfSettings.fontSize === 'large' && "text-[15px]",
                                        pdfSettings.margin === 'compact' && "p-[8mm] space-y-4",
                                        pdfSettings.margin === 'wide' && "p-[22mm] space-y-8"
                                    )}
                                    style={{ fontFamily: "'Inter', sans-serif" }}
                                >
                                    {/* Pioneer Company Letterhead Header */}
                                    <div className="flex items-start justify-between pb-6 border-b-2 border-slate-800">
                                        <div className="flex items-center gap-4">
                                            {pdfSettings.showLogo && (
                                                <div className="w-14 h-14 bg-sky-100 rounded-full flex items-center justify-center border border-sky-300 text-sky-700 font-extrabold shadow-sm shrink-0">
                                                    {/* Company logo insignia matching standard LLC */}
                                                    <div className="relative w-8 h-8 flex items-center justify-center">
                                                        <span className="text-xl font-black">P</span>
                                                        <span className="absolute -bottom-1 -right-1 text-[9px] font-black uppercase text-slate-500 bg-white px-1 border rounded-md">LLC</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pioneer General Contracting LLC</h1>
                                                <p className="text-slate-500 text-xs font-bold leading-none mt-0.5">Petty Cash Statement & Account Ledger Report</p>
                                                <p className="text-slate-400 text-[10px] font-medium mt-1">Location: Al Ain, Abu Dhabi, UAE • Post Box: 12345</p>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-0.5">
                                            <div className="inline-block px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black tracking-wider uppercase">
                                                Certified Report
                                            </div>
                                            <p className="text-[10px] font-black text-slate-500 mt-2">
                                                Generated: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-[10px] font-medium text-slate-400">
                                                Generated by: {user?.displayName || user?.name || 'Abdul Kader'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Subheader / Book Title */}
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account Register Profile</span>
                                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                                {selectedBook === 'All Books' ? 'All Books Ledger Account' : `Profile Name: ${selectedBook}`}
                                            </h2>
                                        </div>
                                        <div className="text-right pt-2 md:pt-0">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Active Status</span>
                                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">OPERATIONAL LEDGER</span>
                                        </div>
                                    </div>

                                    {/* A4 Report Consolidated Sum-KPI Panel. Matching the dual-border/double dashed metrics layout requested in image */}
                                    <div className={cn(
                                        "grid grid-cols-3 gap-1 p-5 rounded-2xl text-center border-t-2 border-b-2",
                                        pdfSettings.theme === 'emerald' ? "bg-emerald-50/50 border-emerald-600/30" :
                                        pdfSettings.theme === 'elegant' ? "bg-sky-50/50 border-sky-600/30" :
                                        pdfSettings.theme === 'minimal' ? "bg-slate-50 border-slate-900/30" :
                                        "bg-slate-50 border-slate-800"
                                    )}>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Cash In</span>
                                            <span className="text-lg font-black text-emerald-600 leading-none block">
                                                AED {totals.cashIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="space-y-1 border-l border-r border-slate-300">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total Cash Out</span>
                                            <span className="text-lg font-black text-red-500 leading-none block">
                                                AED {totals.cashOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Final Balance</span>
                                            <span className={cn(
                                                "text-lg font-black leading-none block",
                                                totals.balance >= 0 ? "text-slate-900" : "text-red-600"
                                            )}>
                                                AED {totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between px-1">
                                        <span>Total Records Count: {filteredData.length}</span>
                                        <span>Currency: UAE Dirham (AED)</span>
                                    </div>

                                    {/* The Report Table Workspace */}
                                    <div className="flex-1 min-h-[400px]">
                                        {exportTab === 'all' && (
                                            <table className="w-full table-fixed text-left text-xs border-collapse font-medium">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-300">
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] w-[12%]">Date</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] w-[22%]">Remark / Description</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] w-[14%]">Contact</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] w-[14%]">Category</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] w-[8%]">Mode</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] text-right w-[10%]">Cash In</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] text-right w-[10%]">Cash Out</th>
                                                        <th className="px-3 py-2.5 font-bold uppercase text-[9px] text-right w-[10%]">Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {sortedWithRunningBalances.map((item: any, idx: number) => (
                                                        <tr key={item.id} className="hover:bg-slate-50 odd:bg-slate-50/30">
                                                            <td className="px-3 py-2 text-[10px] font-bold text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{item.date}</td>
                                                            <td className="px-3 py-2 text-[11px] font-bold text-slate-800 break-words whitespace-normal leading-tight">{item.description || '-'}</td>
                                                            <td className="px-3 py-2 text-[11px] font-semibold text-slate-700 break-words whitespace-normal leading-tight">{item.contact || item.requestedBy || '-'}</td>
                                                            <td className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 break-words whitespace-normal leading-tight">{item.category || 'General'}</td>
                                                            <td className="px-3 py-2 text-[10px] font-extrabold uppercase text-slate-600 break-words whitespace-normal leading-tight">{item.mode || 'Cash'}</td>
                                                            <td className="px-3 py-2 text-right font-black text-emerald-600">
                                                                {item.type === 'Income' ? (item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-red-500">
                                                                {item.type === 'Expense' ? (item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                                                {item.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {exportTab === 'day' && (
                                            <table className="w-full table-fixed text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-300">
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] w-[20%]">Date</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-center w-[15%]">Entries Count</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[20%]">Total In</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[20%]">Total Out</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[25%]">Running Net Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {dayWiseData.map((day: any) => (
                                                        <tr key={day.date} className="hover:bg-slate-50 odd:bg-slate-50/30">
                                                            <td className="px-4 py-2.5 text-[10px] font-bold text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{day.date}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold text-slate-700">{day.count}</td>
                                                            <td className="px-4 py-2.5 text-right font-black text-emerald-600">
                                                                {day.cashIn > 0 ? `+ AED ${day.cashIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-red-500">
                                                                {day.cashOut > 0 ? `- AED ${day.cashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-slate-900">
                                                                AED {day.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {exportTab === 'contact' && (
                                            <table className="w-full table-fixed text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-300">
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] w-[22%]">Contact Name</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-center w-[13%]">Receipts Count</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] w-[23%]">Main Categories</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[14%]">Inflow (AED)</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[14%]">Outflow (AED)</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[14%]">Subtotal Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {contactWiseData.map((item: any) => (
                                                        <tr key={item.contact} className="hover:bg-slate-50 odd:bg-slate-50/30">
                                                            <td className="px-4 py-2.5 font-black text-slate-800 break-words whitespace-normal leading-tight">{item.contact}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold text-slate-600">{item.count}</td>
                                                            <td className="px-4 py-2.5 text-[10px] text-slate-400 uppercase font-bold break-words whitespace-normal leading-tight">{item.categoryList}</td>
                                                            <td className="px-4 py-2.5 text-right font-black text-emerald-600">
                                                                {item.cashIn > 0 ? `+ ${item.cashIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-red-500">
                                                                {item.cashOut > 0 ? `- ${item.cashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-slate-900">
                                                                AED {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {exportTab === 'category' && (
                                            <table className="w-full table-fixed text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-300">
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] w-[25%]">Category Cash Book</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-center w-[15%]">Entries Count</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[20%]">Total Inflow (AED)</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[20%]">Total Outflow (AED)</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[20%]">Net Category Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {categoryWiseData.map((item: any) => (
                                                        <tr key={item.category} className="hover:bg-slate-50 odd:bg-slate-50/30">
                                                            <td className="px-4 py-2.5 font-black text-slate-800 uppercase text-[10px] tracking-wider break-words whitespace-normal leading-tight">{item.category}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold text-slate-600">{item.count}</td>
                                                            <td className="px-4 py-2.5 text-right font-black text-emerald-600">
                                                                {item.cashIn > 0 ? `+ ${item.cashIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-red-500">
                                                                {item.cashOut > 0 ? `- ${item.cashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-slate-900">
                                                                AED {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {exportTab === 'mode' && (
                                            <table className="w-full table-fixed text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-300">
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] w-[30%]">Payment Mode Details</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-center w-[15%]">Transaction Count</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[18%]">Total Cash In (AED)</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[18%]">Total Cash Out (AED)</th>
                                                        <th className="px-4 py-2.5 font-black uppercase text-[9px] text-right w-[19%]">Net Subtotal Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {paymentModeWiseData.map((item: any) => (
                                                        <tr key={item.mode} className="hover:bg-slate-50 odd:bg-slate-50/30">
                                                            <td className="px-4 py-2.5 font-black text-slate-800 uppercase text-[10px] tracking-wider break-words whitespace-normal leading-tight">{item.mode}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold text-slate-600">{item.count}</td>
                                                            <td className="px-4 py-2.5 text-right font-black text-emerald-600">
                                                                {item.cashIn > 0 ? `+ ${item.cashIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-red-500">
                                                                {item.cashOut > 0 ? `- ${item.cashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-black text-slate-900">
                                                                AED {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>

                                    {/* Report Stamp Signoff columns */}
                                    <div className="pt-12 grid grid-cols-2 gap-16 justify-between mt-auto">
                                        <div className="space-y-1">
                                            <div className="h-0.5 bg-slate-300 w-44" />
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prepared By</p>
                                            <p className="text-[11px] font-bold text-slate-800">{user?.displayName || user?.name || 'Abdul Kader'}</p>
                                        </div>
                                        <div className="space-y-1 text-right ml-auto">
                                            <div className="h-0.5 bg-slate-300 w-44 ml-auto" />
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Approved Authority Stamp</p>
                                            <p className="text-[11px] font-bold text-slate-500">Pioneer Contracting Finance LLC</p>
                                        </div>
                                    </div>

                                    {/* Page Footer */}
                                    <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold flex justify-between">
                                        <span>System Certification: Zoho Cash-Book Sync Standard</span>
                                        <span>Page 1 of 1</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modals Action Bar footer */}
                        <div className="p-6 bg-white border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-bold">
                                Statement contains <strong className="text-slate-800">{filteredData.length} records</strong> under <strong className="text-slate-800">{selectedBook}</strong> book register.
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { setShowExportModal(false); setShowPdfSettings(false); }}
                                    className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleA4Print}
                                    className="px-6 py-3 bg-brand-600 text-white rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-brand-700 active:scale-95 transition-all shadow-md shadow-brand-600/10 cursor-pointer"
                                >
                                    <Download className="w-4 h-4" />
                                    Download as PDF Report
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            <PrintModal 
                isOpen={isPettyCashPrintModalOpen}
                onClose={() => setIsPettyCashPrintModalOpen(false)}
                onPrint={handleA4PrintWithConfig}
                title="Print Petty Cash Statement"
            />
        </div>
    );
};

export const ProjectedExpenseView = ({ data, projects, onAdd, onEdit, onDelete, user }: any) => {
    const getProjectName = (id?: string) => {
        if (!id) return 'General';
        return projects.find((p: any) => p.id === id)?.name || 'N/A';
    };

    return (
        <DataTable<ProjectedExpense>
            title="Projected Expenses"
            description="Manage and track projected project expenses and billings."
            icon={TrendingDown}
            data={data}
            columns={[
                { key: 'siNo', label: 'SI.No', sortable: true },
                { key: 'date', label: 'Date', sortable: true },
                { key: 'invoiceNumber', label: 'Bill/Invoice #', sortable: true },
                { key: 'clientName', label: 'Client Name', sortable: true },
                { key: 'siteLocation', label: 'Site Location' },
                { 
                    key: 'actualAmount', 
                    label: 'Actual Amount',
                    render: (item) => <span className="font-bold">AED {item.actualAmount.toLocaleString()}</span>
                },
                { 
                    key: 'vatAmount', 
                    label: 'VAT (5%)',
                    render: (item) => <span className="text-slate-400">AED {item.vatAmount.toLocaleString()}</span>
                },
                { 
                    key: 'totalAmount', 
                    label: 'Total Amount',
                    render: (item) => <span className="font-black text-slate-900">AED {item.totalAmount.toLocaleString()}</span>
                },
            ]}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            searchFields={['invoiceNumber', 'billDescription', 'clientName', 'siteLocation', 'workDescription']}
            exportFileName="Projected_Expenses"
            user={user}
        />
    );
};

// --- Modals ---

export const VendorModal = ({ vendor, onSave, onCancel }: any) => {
    const [formData, setFormData] = useState(() => {
        if (vendor) {
            return {
                ...vendor,
                trn: vendor.trn || ''
            };
        }
        return { code: '', name: '', contactPerson: '', address: '', email: '', phone: '', category: '', notes: '', trn: '' };
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white"
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{vendor ? 'Edit Client' : 'Add Client'}</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Enter client details and VAT registration information</p>
                    </div>
                    <button onClick={onCancel} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Code</label>
                            <input 
                                type="text"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                            <input 
                                type="text"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Name</label>
                        <input 
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">TRN (VAT Registration Number)</label>
                            <input 
                                type="text"
                                placeholder="e.g. 100xxxxxxxxxxxx"
                                value={formData.trn || ''}
                                onChange={e => setFormData({ ...formData, trn: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Person</label>
                            <input 
                                type="text"
                                value={formData.contactPerson}
                                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                            <input 
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone</label>
                            <input 
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Address</label>
                        <input 
                            type="text"
                            placeholder="Dubai, UAE"
                            value={formData.address || ''}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                    <button onClick={() => onSave(formData)} className="flex-1 px-6 py-4 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20">Save Client</button>
                </div>
            </motion.div>
        </div>
    );
};

export const AccountsPayableModal = ({ ap, vendors, suppliers, projects, onSave, onCancel, companies }: any) => {
    const [formData, setFormData] = useState(ap || { 
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        vendorId: '',
        vendorType: 'Supplier',
        projectId: '',
        invoiceNumber: '',
        amount: 0,
        vatAmount: 0,
        totalAmount: 0,
        description: '',
        status: 'Pending',
        companyId: companies && companies.length > 0 ? companies[0].id : ''
    });

    const handleAmountChange = (val: number) => {
        const vat = val * 0.05;
        const total = val + vat;
        setFormData({ 
            ...formData, 
            amount: val,
            vatAmount: Number(vat.toFixed(2)),
            totalAmount: Number(total.toFixed(2))
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white"
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{ap ? 'Edit Payable' : 'Add Payable'}</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Enter payment details below</p>
                    </div>
                    <button onClick={onCancel} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</label>
                            <input 
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invoice #</label>
                            <input 
                                type="text"
                                value={formData.invoiceNumber}
                                onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payee Type</label>
                            <select 
                                value={formData.vendorType}
                                onChange={e => setFormData({ ...formData, vendorType: e.target.value, vendorId: '' })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            >
                                <option value="Supplier">Supplier</option>
                                <option value="Vendor">Client</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select {formData.vendorType === 'Vendor' ? 'Client' : formData.vendorType}</label>
                            <select 
                                value={formData.vendorId}
                                onChange={e => setFormData({ ...formData, vendorId: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            >
                                <option value="">Select...</option>
                                {(formData.vendorType === 'Supplier' ? suppliers : vendors).map((v: any) => (
                                    <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project (Optional)</label>
                        <select 
                            value={formData.projectId}
                            onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        >
                            <option value="">General / No Project</option>
                            {projects.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">Buying Corporate Identity (Company)</label>
                        <select 
                            value={formData.companyId || ''}
                            onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                            className="w-full px-4 py-3 bg-brand-50 border border-brand-100/55 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-brand-700 cursor-pointer"
                            required
                        >
                            {(!companies || companies.length === 0) && (
                                <option value="">No corporate company accounts registered</option>
                            )}
                            {(companies || []).map((c: any) => (
                                <option key={c.id} value={c.id}>🏢 {c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Taxable Amount (AED)</label>
                            <input 
                                type="number"
                                value={formData.amount}
                                onChange={e => handleAmountChange(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                            <select 
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Partially Paid">Partially Paid</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-brand-50/50 rounded-2xl border border-brand-100">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">VAT (5%)</label>
                            <div className="w-full px-4 py-3 bg-white/50 border border-brand-100 rounded-xl text-sm font-bold text-slate-500">
                                {formData.vatAmount.toLocaleString()}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">Total Amount</label>
                            <div className="w-full px-4 py-3 bg-brand-600 rounded-xl text-sm font-black text-white shadow-md">
                                {formData.totalAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
                        <textarea 
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[100px]"
                        />
                    </div>
                    
                    <div className="border border-slate-200/60 p-4 rounded-2xl bg-amber-50/20 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-brand-600 rounded-full inline-block" />
                            <span className="text-[10px] font-black uppercase text-brand-600 tracking-wider">Cheque Settlement (Optional)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cheque No</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. 10482"
                                    value={formData.chequeNo || ''}
                                    onChange={e => setFormData({ ...formData, chequeNo: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cheque Date</label>
                                <input 
                                    type="date" 
                                    value={formData.chequeDate || ''}
                                    onChange={e => setFormData({ ...formData, chequeDate: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cheque Amt</label>
                                <input 
                                    type="number" 
                                    placeholder="AED"
                                    value={formData.chequeAmount || ''}
                                    onChange={e => setFormData({ ...formData, chequeAmount: e.target.value ? Number(e.target.value) : '' })}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                    <button onClick={() => onSave(formData)} className="flex-1 px-6 py-4 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20">Save Entry</button>
                </div>
            </motion.div>
        </div>
    );
};

export const AccountsReceivableModal = ({ ar, projects, suppliers, vendors, onSave, onCancel, companies }: any) => {
    const [formData, setFormData] = useState(() => {
        const defaultItem = { id: Math.random().toString(36).substr(2, 9), name: '', description: '', quantity: 1, rate: 0, total: 0 };
        if (ar) {
            return {
                ...ar,
                companyId: ar.companyId || '',
                companyName: ar.companyName || '',
                entityId: ar.entityId || ar.projectId || '',
                entityType: ar.entityType || 'Project',
                vatAmount: ar.vatAmount || 0,
                totalAmount: ar.totalAmount || ar.amount || 0,
                dueDate: ar.dueDate || ar.date || new Date().toISOString().split('T')[0],
                items: ar.items && ar.items.length > 0 ? ar.items : [
                    { id: Math.random().toString(36).substr(2, 9), name: ar.description || 'General Services', description: 'Technical works as agreed', quantity: 1, rate: ar.amount || 0, total: ar.amount || 0 }
                ]
            };
        }
        return { 
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 30 days credit
            entityId: '',
            entityType: 'Project',
            invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
            amount: 0,
            vatAmount: 0,
            totalAmount: 0,
            description: '',
            status: 'Pending',
            companyId: companies && companies.length > 0 ? companies[0].id : '',
            companyName: companies && companies.length > 0 ? companies[0].name : '',
            items: [defaultItem]
        };
    });

    const selectedCompany = useMemo(() => {
        return (companies || []).find((c: any) => c.id === formData.companyId);
    }, [companies, formData.companyId]);

    const targetEntity = useMemo(() => {
        if (formData.entityType === 'Project') {
            return (projects || []).find((p: any) => p.id === formData.entityId);
        } else if (formData.entityType === 'Supplier') {
            return (suppliers || []).find((s: any) => s.id === formData.entityId);
        } else if (formData.entityType === 'Vendor') {
            return (vendors || []).find((v: any) => v.id === formData.entityId);
        }
        return null;
    }, [formData.entityType, formData.entityId, projects, suppliers, vendors]);

    // Update individual items and auto recalculate totals
    const updateItemValue = (id: string, field: string, val: any) => {
        const nextItems = formData.items.map((it: any) => {
            if (it.id === id) {
                const nextIt = { ...it, [field]: val };
                if (field === 'quantity' || field === 'rate') {
                    const q = Number(nextIt.quantity) || 0;
                    const r = Number(nextIt.rate) || 0;
                    nextIt.total = Number((q * r).toFixed(2));
                }
                return nextIt;
            }
            return it;
        });

        recalculateInvoiceTotals(nextItems);
    };

    const addInvoiceRow = () => {
        const newItem = { id: Math.random().toString(36).substr(2, 9), name: '', description: '', quantity: 1, rate: 0, total: 0 };
        recalculateInvoiceTotals([...formData.items, newItem]);
    };

    const removeInvoiceRow = (id: string) => {
        if (formData.items.length <= 1) {
            // Do not delete the last row, just clear it
            const clearedItems = [{ id: Math.random().toString(36).substr(2, 9), name: '', description: '', quantity: 1, rate: 0, total: 0 }];
            recalculateInvoiceTotals(clearedItems);
            return;
        }
        const nextItems = formData.items.filter((it: any) => it.id !== id);
        recalculateInvoiceTotals(nextItems);
    };

    const recalculateInvoiceTotals = (nextItems: any[]) => {
        const subtotal = nextItems.reduce((acc: number, it: any) => acc + (Number(it.total) || 0), 0);
        const vat = subtotal * 0.05;
        const total = subtotal + vat;

        setFormData({
            ...formData,
            items: nextItems,
            amount: Number(subtotal.toFixed(2)),
            vatAmount: Number(vat.toFixed(2)),
            totalAmount: Number(total.toFixed(2))
        });
    };

    const handleCompanyChange = (id: string) => {
        const comp = (companies || []).find((c: any) => c.id === id);
        setFormData({
            ...formData,
            companyId: id,
            companyName: comp ? comp.name : ''
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 overflow-y-auto">
            <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-white flex flex-col my-8 max-h-[90vh]"
            >
                {/* Modal Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 px-3 py-1.5 rounded-full">Zoho Books Invoice Editor</span>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1.5">{ar ? 'Edit Tax Invoice' : 'Create Tax Invoice'}</h2>
                        <p className="text-slate-500 text-sm font-medium">Billed client invoicing matching UAE corporate compliance standards</p>
                    </div>
                    <button onClick={onCancel} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm bg-white border border-slate-100"><X className="w-5 h-5" /></button>
                </div>

                {/* Form Body Container */}
                <div className="p-8 space-y-8 overflow-y-auto flex-1">
                    
                    {/* Section 1: COMPANY WISE SELECTION & LOGO PREVIEW */}
                    <div className="bg-slate-50/60 p-6 rounded-[2rem] border border-slate-100/80 space-y-4">
                        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                            
                            {/* Company dropdown picker */}
                            <div className="flex-1 w-full space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 block">
                                    Seller Corporate Identity (Company Name) <span className="text-red-500 font-extrabold">*</span>
                                </label>
                                <select 
                                    value={formData.companyId || ''}
                                    onChange={e => handleCompanyChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
                                    required
                                >
                                    <option value="">Select Selling Company...</option>
                                    {(companies || []).map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10.5px] text-slate-400 font-medium">The selected company's official corporate logo, name, and address details will automatically render on the Zoho Books Tax Invoice layout and printed PDFs.</p>
                                {selectedCompany?.trn ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100/60 rounded-xl text-xs font-bold text-emerald-805 font-mono mt-1">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Seller TRN registered: <strong>{selectedCompany.trn}</strong></span>
                                    </div>
                                ) : formData.companyId ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100/60 rounded-xl text-xs font-bold text-amber-700 font-mono mt-1">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Seller company has no TRN registered in settings!</span>
                                    </div>
                                ) : null}
                            </div>

                            {/* Company wise Logo Live View box */}
                            <div className="w-full lg:w-fit shrink-0">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 text-center lg:text-left">Selected Identity Logo</span>
                                <div className="h-24 w-44 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center p-3 shadow-md relative group overflow-hidden mx-auto lg:mx-0">
                                    {selectedCompany?.logo ? (
                                        <img src={selectedCompany.logo} alt="Logo" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="text-center space-y-1">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto text-xs font-black">
                                                ?
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">No Logo Uploaded</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Section 2: GENERAL METADATA GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invoice Date</label>
                            <input 
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Due Date (Payment Terms)</label>
                            <input 
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invoice Number</label>
                            <input 
                                type="text"
                                value={formData.invoiceNumber}
                                onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Section 3: CUSTOMER / CLIENT LINK SELECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Entity Type</label>
                            <select 
                                value={formData.entityType}
                                onChange={e => setFormData({ ...formData, entityType: e.target.value, entityId: '' })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option value="Project">Project</option>
                                <option value="Supplier">Supplier</option>
                                <option value="Vendor">Client</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 font-mono">
                                Select {formData.entityType === 'Vendor' ? 'Client' : formData.entityType}
                            </label>
                            <select 
                                value={formData.entityId}
                                onChange={e => setFormData({ ...formData, entityId: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                            >
                                <option value="">Select contact...</option>
                                {formData.entityType === 'Project' && projects.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                                {formData.entityType === 'Supplier' && suppliers.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                                ))}
                                {formData.entityType === 'Vendor' && vendors.map((v: any) => (
                                    <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>
                                ))}
                            </select>
                            {targetEntity?.trn ? (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 border border-teal-100/60 rounded-lg text-[10px] font-black text-teal-700 font-mono mt-1">
                                    <span>Client TRN: <strong>{targetEntity.trn}</strong></span>
                                </div>
                            ) : formData.entityId ? (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-100/60 rounded-lg text-[10px] font-black text-amber-600 font-mono mt-1">
                                    <span>No TRN registered for this contact!</span>
                                </div>
                            ) : null}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Receivable State (Status)</label>
                            <select 
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option value="Pending">Pending</option>
                                <option value="Received">Received</option>
                                <option value="Partially Received">Partially Received</option>
                            </select>
                        </div>
                    </div>

                    {/* Section 4: ITEMS GRID (ZOHO BOOKS SPECIAL BILLING ITEMS LIST) */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[11px] font-black uppercase tracking-widest text-blue-600 ml-1 block">
                                Line Items & Work Descriptions (Zoho-Style Grid)
                            </label>
                            <button 
                                type="button" 
                                onClick={addInvoiceRow}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition text-xs font-black"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Row
                            </button>
                        </div>

                        <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-inner bg-slate-50/20">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-4 py-3">Item/Service Name</th>
                                        <th className="px-4 py-3">Sub-Description (Scope)</th>
                                        <th className="px-4 py-3 text-right w-20">Qty</th>
                                        <th className="px-4 py-3 text-right w-32">Rate (AED)</th>
                                        <th className="px-4 py-3 text-right w-36">Total (AED)</th>
                                        <th className="p-3 text-center w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150">
                                    {formData.items.map((it: any) => (
                                        <tr key={it.id} className="hover:bg-slate-50/50">
                                            <td className="p-3">
                                                <input 
                                                    type="text" 
                                                    placeholder="Item or service name"
                                                    value={it.name}
                                                    onChange={e => updateItemValue(it.id, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    required
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="text" 
                                                    placeholder="Scope notes or sub-details"
                                                    value={it.description}
                                                    onChange={e => updateItemValue(it.id, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    placeholder="1"
                                                    value={it.quantity}
                                                    onChange={e => updateItemValue(it.id, 'quantity', Number(e.target.value))}
                                                    className="w-full px-2 py-2 text-right bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    required
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    min="0.01" 
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={it.rate}
                                                    onChange={e => updateItemValue(it.id, 'rate', Number(e.target.value))}
                                                    className="w-full px-2 py-2 text-right bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    required
                                                />
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-800 text-xs">
                                                AED {Number(it.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeInvoiceRow(it.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 5: TOTALS CALCULATIONS BLOCK */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Overall General Description & Cheque details */}
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">General Notes / Footnotes</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Additional notes to display on the Zoho Invoice footer..."
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                                />
                            </div>

                            <div className="border border-slate-200/60 p-4 rounded-2xl bg-amber-50/20 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full inline-block" />
                                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Cheque Settlement (Optional)</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cheque No</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. 5032"
                                            value={formData.chequeNo || ''}
                                            onChange={e => setFormData({ ...formData, chequeNo: e.target.value })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cheque Date</label>
                                        <input 
                                            type="date" 
                                            value={formData.chequeDate || ''}
                                            onChange={e => setFormData({ ...formData, chequeDate: e.target.value })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cheque Amt</label>
                                        <input 
                                            type="number" 
                                            placeholder="AED"
                                            value={formData.chequeAmount || ''}
                                            onChange={e => setFormData({ ...formData, chequeAmount: e.target.value ? Number(e.target.value) : '' })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Calculation Panel */}
                        <div className="bg-slate-50/50 border border-slate-150 rounded-[2rem] p-6 space-y-3.5">
                            <div className="flex justify-between items-center text-xs text-slate-500 font-bold px-1">
                                <span>TAXABLE SUB TOTAL:</span>
                                <span>AED {formData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-500 font-bold px-1 border-b border-dashed border-slate-200 pb-3">
                                <span>UAE VAT STANDARD (5%):</span>
                                <span>AED {formData.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center bg-blue-600 text-white rounded-2xl p-4 shadow-lg shadow-blue-500/10">
                                <span className="text-xs font-black uppercase tracking-wide">GRAND TOTAL (INCL. VAT):</span>
                                <span className="text-lg font-black">AED {formData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Modal Footer Controls */}
                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                    <button 
                        onClick={() => {
                            if (!formData.companyId) {
                                alert("Please select a selling corporate identity company first!");
                                return;
                            }
                            onSave({
                                ...formData,
                                companyTrn: selectedCompany?.trn || '',
                                clientTrn: targetEntity?.trn || ''
                            });
                        }} 
                        className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                    >
                        {ar ? 'Update Zoho Invoice' : 'Create Zoho Invoice'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const LiveCameraCapture = ({ 
    onCapture, 
    onClose 
}: { 
    onCapture: (base64: string, mime: string) => void, 
    onClose: () => void 
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    React.useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            setError("Webcam access is not supported by your browser in this mode.");
            return;
        }
        navigator.mediaDevices.enumerateDevices()
            .then(devs => {
                const videoDevs = devs.filter(d => d.kind === 'videoinput');
                setDevices(videoDevs);
                if (videoDevs.length > 0) {
                    setSelectedDeviceId(videoDevs[0].deviceId);
                }
            })
            .catch(err => {
                console.error("enumerateDevices error", err);
                setError("Error finding camera devices.");
            });
    }, []);

    React.useEffect(() => {
        if (!selectedDeviceId) return;
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }

        navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: { exact: selectedDeviceId } } 
        })
        .then(str => {
            setStream(str);
            if (videoRef.current) {
                videoRef.current.srcObject = str;
            }
        })
        .catch(err => {
            console.error(err);
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(str => {
                    setStream(str);
                    if (videoRef.current) {
                        videoRef.current.srcObject = str;
                    }
                })
                .catch(err2 => {
                    setError("Could not access camera. Please ensure permissions are granted.");
                });
        });

        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        };
    }, [selectedDeviceId]);

    const handleCapture = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg');
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
            onCapture(base64, 'image/jpeg');
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Live Receipt Capture</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error ? (
                    <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold text-center">
                        ⚠️ {error}
                    </div>
                ) : (
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-100">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                )}

                {devices.length > 1 && !error && (
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Select Camera</label>
                        <select 
                            value={selectedDeviceId} 
                            onChange={e => setSelectedDeviceId(e.target.value)}
                            className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {devices.map((d, index) => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label || `Camera ${index + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition"
                    >
                        Cancel
                    </button>
                    {!error && (
                        <button 
                            type="button" 
                            onClick={handleCapture} 
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm uppercase tracking-wider"
                        >
                            Capture Photo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const PettyCashModal = ({ pettyCash, projects, onSave, onCancel, employees }: any) => {
    const [formData, setFormData] = useState(() => {
        if (pettyCash) {
            return {
                employeeId: '',
                signedAttachment: '',
                signedAttachmentName: '',
                ...pettyCash
            };
        }
        return {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            category: '',
            description: '',
            amount: 0,
            type: 'Expense',
            requestedBy: '',
            projectId: '',
            mode: 'Cash',
            contact: '',
            employeeId: '',
            signedAttachment: '',
            signedAttachmentName: ''
        };
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [tempImageData, setTempImageData] = useState<{ image: string, mime: string } | null>(null);
    const [uploaderName, setUploaderName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanError(null);
        try {
            const result = await compressImageFile(file);
            if (!result.base64) {
                throw new Error("Failed to process the uploaded image");
            }
            setTempImageData({ image: result.base64, mime: result.mimeType });
            setUploaderName(formData.uploadedBy || formData.updatedBy || formData.requestedBy || '');
            setShowNamePrompt(true);
        } catch (err: any) {
            setScanError(err.message || "Failed to process the file");
        } finally {
            setIsScanning(false);
        }
    };

    const handleConfirmNameAndScan = async () => {
        if (!uploaderName.trim()) {
            alert("Please enter your name to proceed.");
            return;
        }
        if (!tempImageData) return;

        setShowNamePrompt(false);
        setIsScanning(true);
        setScanError(null);

        try {
            const response = await fetch("/api/gemini/extract-receipt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    image: tempImageData.image,
                    mimeType: tempImageData.mime,
                    type: "petty cash"
                })
            });

            const text = await response.text();

            if (!response.ok) {
                let errMsg = "Failed to scan receipt";
                try {
                    const errResult = JSON.parse(text);
                    errMsg = errResult.error || errMsg;
                } catch {
                    errMsg = text.slice(0, 120).trim() || `HTTP error ${response.status}`;
                    if (errMsg.toLowerCase().includes('<!doctype html>') || errMsg.toLowerCase().includes('<html')) {
                        errMsg = "Please make sure your server is running and configured correctly. (Vite dev server or backend received 404/500)";
                    }
                }
                throw new Error(errMsg);
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error("Invalid response format received from server (expected JSON)");
            }

            setFormData((prev: any) => ({
                ...prev,
                ...data,
                uploadedBy: uploaderName,
                updatedBy: uploaderName,
                contact: prev.contact || data.contact || uploaderName,
                requestedBy: prev.requestedBy || data.requestedBy || data.contact || uploaderName
            }));
        } catch (error: any) {
            console.error("Scanning failed:", error);
            setScanError(error.message || "An error occurred while scanning with Gemini");
        } finally {
            setIsScanning(false);
            setTempImageData(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
            }
        }
    };

    // Make sure contact is synced to requestedBy for safety
    const handleContactChange = (val: string) => {
        setFormData({
            ...formData,
            contact: val,
            requestedBy: val
        });
        if (errors.contact) {
            setErrors(prev => ({ ...prev, contact: '' }));
        }
    };

    const handleFormSubmit = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.category.trim()) newErrors.category = 'Category or Book is required';
        if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than zero';
        const contactVal = formData.contact || formData.requestedBy;
        if (!contactVal || !contactVal.trim()) {
            newErrors.contact = formData.type === 'Income' ? 'Received Source or Name is required' : 'Recipient or requesting person is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSave(formData);
    };

    const quickCategories = formData.type === 'Income' 
        ? ['Office Cash Register', 'Director Advance', 'Bank Withdrawal', 'Client Cash Receipt']
        : ['Fuel & Conveyance', 'Office Stationery', 'Site Materials', 'Pantry & Refreshments', 'Repairs & Maintenance'];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-[70] p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200"
            >
                {/* Zoho Corporate Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                            <h2 className="text-lg font-bold text-slate-900">
                                {pettyCash ? 'Edit Transaction Ledger' : 'New Transaction Ledger'}
                            </h2>
                        </div>
                        <p className="text-slate-500 text-xs font-semibold mt-0.5">
                            Fill in details accurately with automatic ledger bookkeeping
                        </p>
                    </div>
                    <button 
                        onClick={onCancel} 
                        className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {/* Gemini AI Scan Panel */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                <Paperclip className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">AI Receipt Scanner</h4>
                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Upload receipt photo or take a new picture to auto-fill details.</p>
                                {(formData.uploadedBy || formData.updatedBy) && (
                                    <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100/50 rounded text-blue-900 text-[9px] font-bold">
                                        <span className="w-1 h-1 rounded-full bg-blue-600 animate-pulse" />
                                        Recorded by: {formData.uploadedBy || formData.updatedBy}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Upload className="w-3 h-3" />
                                Upload Photo
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                    if (isMobile && cameraInputRef.current) {
                                        cameraInputRef.current.click();
                                    } else {
                                        setShowCamera(true);
                                    }
                                }}
                                className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Camera className="w-3 h-3" />
                                Take Photo
                            </button>
                            <input 
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <input 
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={cameraInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    {scanError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-[11px] font-semibold text-left">
                            ⚠️ {scanError}
                        </div>
                    )}

                    {/* Zoho Segmented Controller for Transaction Type */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Transaction Type
                        </label>
                        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData({ ...formData, type: 'Expense' });
                                    setErrors({});
                                }}
                                className={cn(
                                    "py-2.5 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer",
                                    formData.type === 'Expense'
                                        ? "bg-white text-rose-600 shadow-sm border border-slate-200/50"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <TrendingDown className="w-4 h-4" />
                                Payment Out / Expense (-)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData({ ...formData, type: 'Income' });
                                    setErrors({});
                                }}
                                className={cn(
                                    "py-2.5 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer",
                                    formData.type === 'Income'
                                        ? "bg-white text-emerald-600 shadow-sm border border-slate-200/50"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <TrendingUp className="w-4 h-4" />
                                Cash In / Received (+)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Transaction Date */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Transaction Date
                            </label>
                            <div className="relative">
                                <input 
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Amount in AED */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Amount (AED)
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-extrabold text-xs">
                                    AED
                                </span>
                                <input 
                                    type="number"
                                    step="any"
                                    value={formData.amount || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, amount: Number(e.target.value) });
                                        if (errors.amount) {
                                            setErrors(prev => ({ ...prev, amount: '' }));
                                        }
                                    }}
                                    className={cn(
                                        "w-full pl-12 pr-3.5 py-2.5 bg-white border rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-sm",
                                        errors.amount ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-200"
                                    )}
                                    placeholder="0.00"
                                />
                            </div>
                            {errors.amount && (
                                <p className="text-[10px] text-rose-500 font-bold mt-0.5">{errors.amount}</p>
                            )}
                        </div>
                    </div>

                    {/* Category / Book Selection with suggested Quick Badges */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Category / Cash Book Register
                            </label>
                            {errors.category && (
                                <span className="text-[10px] text-rose-500 font-bold">{errors.category}</span>
                            )}
                        </div>
                        <input 
                            type="text"
                            value={formData.category}
                            onChange={e => {
                                setFormData({ ...formData, category: e.target.value });
                                if (errors.category) {
                                    setErrors(prev => ({ ...prev, category: '' }));
                                }
                            }}
                            className={cn(
                                "w-full px-3.5 py-2.5 bg-white border rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-sm",
                                errors.category ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-200"
                            )}
                            placeholder={formData.type === 'Income' ? "Enter Cash Register Book name" : "e.g. Fuel, Stationery, Site Expense"}
                        />
                        {/* Quick Suggestions Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {quickCategories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        setFormData({ ...formData, category: cat });
                                        if (errors.category) {
                                            setErrors(prev => ({ ...prev, category: '' }));
                                        }
                                    }}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all border cursor-pointer",
                                        formData.category === cat
                                            ? "bg-blue-50 border-blue-200 text-blue-700"
                                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Mode of Payment */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Mode of Payment
                            </label>
                            <select
                                value={formData.mode || 'Cash'}
                                onChange={e => setFormData({ ...formData, mode: e.target.value })}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
                            >
                                <option value="Cash">💵 Cash</option>
                                <option value="Online">🌐 Online Gateway</option>
                                <option value="Bank Transfer">🏦 Bank Transfer</option>
                                <option value="Cheque">✍️ Cheque Payment</option>
                                <option value="Card">💳 Credit/Debit Card</option>
                            </select>
                        </div>

                        {/* Link to Project */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Project Link (Optional)
                            </label>
                            <select 
                                value={formData.projectId}
                                onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
                            >
                                <option value="">📁 General (No Project Link)</option>
                                {projects.map((p: any) => (
                                    <option key={p.id} value={p.id}>🏢 {p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Disbursed to Employee (For Voucher & Sign flow) */}
                    {formData.type === 'Expense' && (
                        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={!!formData.employeeId}
                                    onChange={e => {
                                        if (!e.target.checked) {
                                            setFormData(prev => ({
                                                ...prev,
                                                employeeId: '',
                                                contact: '',
                                                requestedBy: ''
                                            }));
                                        } else {
                                            const firstEmp = (employees && employees[0]) ? employees[0] : null;
                                            setFormData(prev => ({
                                                ...prev,
                                                employeeId: firstEmp ? firstEmp.id : 'select_placeholder',
                                                contact: firstEmp ? firstEmp.name : '',
                                                requestedBy: firstEmp ? firstEmp.name : ''
                                            }));
                                        }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4"
                                />
                                <span className="text-xs font-bold text-slate-705">Given to Staff / Employee (Voucher & Signature Required)</span>
                            </label>

                            {formData.employeeId ? (
                                <div className="space-y-3 pt-1 animate-fadeIn">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Select Staff Member</label>
                                        <select
                                            value={formData.employeeId === 'select_placeholder' ? '' : formData.employeeId}
                                            onChange={e => {
                                                const selectedId = e.target.value;
                                                const emp = (employees || []).find((x: any) => x.id === selectedId);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    employeeId: selectedId,
                                                    contact: emp ? emp.name : '',
                                                    requestedBy: emp ? emp.name : ''
                                                }));
                                                if (errors.contact) {
                                                    setErrors(prev => ({ ...prev, contact: '' }));
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
                                        >
                                            <option value="">-- Choose Employee --</option>
                                            {(employees || []).map((e: any) => (
                                                <option key={e.id} value={e.id}>{e.name} ({e.code || 'No Code'})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {formData.employeeId && formData.employeeId !== 'select_placeholder' && (
                                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                            {/* Download Voucher Button */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const emp = (employees || []).find((x: any) => x.id === formData.employeeId);
                                                    downloadPettyCashPDF(formData, emp);
                                                }}
                                                className="flex-1 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download Voucher PDF
                                            </button>

                                            {/* Upload signed copy input */}
                                            <div className="flex-1 relative">
                                                <input 
                                                    type="file" 
                                                    id="signed-voucher-upload"
                                                    accept="image/*,application/pdf"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    signedAttachment: reader.result as string,
                                                                    signedAttachmentName: file.name
                                                                }));
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                                <label
                                                    htmlFor="signed-voucher-upload"
                                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold cursor-pointer transition-all w-full text-center"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    {formData.signedAttachmentName ? "Change Signed Voucher" : "Upload Signed Voucher"}
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {formData.signedAttachment && (
                                        <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs font-bold text-slate-700 animate-fadeIn">
                                            <div className="flex items-center gap-2 truncate">
                                                <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span className="truncate text-[11px] text-emerald-800 font-extrabold">{formData.signedAttachmentName || "Signed_Voucher.pdf"}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, signedAttachment: '', signedAttachmentName: '' }))}
                                                className="text-[10px] text-rose-600 hover:text-rose-805 bg-white hover:bg-rose-50 px-2 py-1 rounded border border-rose-150 transition-all font-black shrink-0"
                                            >
                                                Remove File
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* Received From / Requested By (Contact) */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {formData.type === 'Income' ? 'Donor / Source Contact' : 'Recipient / Contact Associate'}
                            </label>
                            {errors.contact && (
                                <span className="text-[10px] text-rose-500 font-bold">{errors.contact}</span>
                            )}
                        </div>
                        <input 
                            type="text"
                            value={formData.contact || formData.requestedBy || ''}
                            onChange={e => handleContactChange(e.target.value)}
                            className={cn(
                                "w-full px-3.5 py-2.5 bg-white border rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-sm",
                                errors.contact ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-200"
                            )}
                            placeholder={formData.type === 'Income' ? "Who provided these funds? e.g. Jamel G" : "Who is receiving or requested this cash?"}
                        />
                    </div>

                    {/* Remarks / Narrative Description */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Narrative Remarks / Remarks
                        </label>
                        <textarea 
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all min-h-[90px] shadow-sm resize-none"
                            placeholder="Provide ledger notes or specific reference numbers if any..."
                        />
                    </div>

                    {/* Uploaded / Updated By Tracker */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Uploaded / Updated By (Your Name)
                        </label>
                        <input 
                            type="text"
                            placeholder="Identify yourself e.g. Sreeraj, Jamel..."
                            value={formData.uploadedBy || formData.updatedBy || ''}
                            onChange={e => setFormData({ ...formData, uploadedBy: e.target.value, updatedBy: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Zoho Branded Action Buttons Footer */}
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button 
                        type="button"
                        onClick={onCancel} 
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        onClick={handleFormSubmit} 
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-sm hover:shadow-md cursor-pointer"
                    >
                        {pettyCash ? 'Update Entry' : 'Save Transaction'}
                    </button>
                </div>
            </motion.div>

            {/* Dialog Overlays */}
            {showNamePrompt && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 text-left">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm border border-slate-150 shadow-2xl space-y-4 text-left">
                        <div className="text-center space-y-1">
                            <span className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-2xl mb-2">
                                <Paperclip className="w-6 h-6" />
                            </span>
                            <h3 className="text-base font-black text-slate-800">Identify Yourself</h3>
                            <p className="text-xs text-slate-500 font-semibold">Who is uploading or updating this record?</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Your Full Name</label>
                            <input 
                                type="text" 
                                value={uploaderName}
                                onChange={e => setUploaderName(e.target.value)}
                                placeholder="e.g. Sreeraj, Jamel..."
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2.5 pt-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowNamePrompt(false);
                                    setTempImageData(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={handleConfirmNameAndScan}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                                Confirm & Scan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center z-[120] p-4 text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm flex flex-col items-center gap-4 border border-slate-100 text-left">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gemini AI OCR</h3>
                            <p className="text-xs text-slate-500 font-semibold mt-1">Reading receipt image and extracting ledger details...</p>
                        </div>
                    </div>
                </div>
            )}

            {showCamera && (
                <LiveCameraCapture 
                    onClose={() => setShowCamera(false)}
                    onCapture={(base64, mime) => {
                        setTempImageData({ image: base64, mime: mime });
                        setUploaderName(formData.uploadedBy || formData.updatedBy || formData.requestedBy || '');
                        setShowNamePrompt(true);
                        setScanError(null);
                        setShowCamera(false);
                    }}
                />
            )}
        </div>
    );
};

export const ProjectedExpenseModal = ({ expense, projects, onSave, onCancel }: any) => {
    const [formData, setFormData] = useState(expense || { 
        id: Math.random().toString(36).substr(2, 9),
        siNo: '',
        date: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        billDescription: '',
        clientName: '',
        siteLocation: '',
        workDescription: '',
        actualAmount: 0,
        vatAmount: 0,
        totalAmount: 0,
        projectId: ''
    });

    const handleAmountChange = (val: number) => {
        const vat = val * 0.05;
        const total = val + vat;
        setFormData({ 
            ...formData, 
            actualAmount: val,
            vatAmount: vat,
            totalAmount: total
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white"
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{expense ? 'Edit Projected Expense' : 'Add Projected Expense'}</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Enter expense details below</p>
                    </div>
                    <button onClick={onCancel} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SI.No</label>
                            <input 
                                type="text"
                                value={formData.siNo}
                                onChange={e => setFormData({ ...formData, siNo: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</label>
                            <input 
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bill/Invoice #</label>
                            <input 
                                type="text"
                                value={formData.invoiceNumber}
                                onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Name</label>
                            <input 
                                type="text"
                                value={formData.clientName}
                                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Site Location</label>
                            <input 
                                type="text"
                                value={formData.siteLocation}
                                onChange={e => setFormData({ ...formData, siteLocation: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project (Optional)</label>
                        <select 
                            value={formData.projectId}
                            onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        >
                            <option value="">General / No Project</option>
                            {projects.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bill Description</label>
                        <input 
                            type="text"
                            value={formData.billDescription}
                            onChange={e => setFormData({ ...formData, billDescription: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Work Description</label>
                        <textarea 
                            value={formData.workDescription}
                            onChange={e => setFormData({ ...formData, workDescription: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[80px]"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4 p-4 bg-brand-50/50 rounded-2xl border border-brand-100">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">Actual Bill Amount</label>
                            <input 
                                type="number"
                                value={formData.actualAmount}
                                onChange={e => handleAmountChange(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">VAT (5%)</label>
                            <div className="w-full px-4 py-3 bg-white/50 border border-brand-100 rounded-xl text-sm font-bold text-slate-500">
                                {formData.vatAmount.toLocaleString()}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">Total Amount</label>
                            <div className="w-full px-4 py-3 bg-brand-600 rounded-xl text-sm font-black text-white shadow-md">
                                {formData.totalAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                    <button onClick={() => onSave(formData)} className="flex-1 px-6 py-4 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20">Save Expense</button>
                </div>
            </motion.div>
        </div>
    );
};

export const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY format
        }
    }
    return dateStr;
};

export const generateEmployeeTallyPdf = (tally: any) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // Add Watermark Logo
    const assets = getPioneerPDFAssets();
    if (assets.watermark) {
        doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
    }

    const empName = tally.employee.name;
    const empCode = tally.employee.code || 'N/A';
    const dept = tally.employee.department || tally.employee.designation || 'Staff';

    // Top Header Banner
    doc.setFillColor(37, 99, 235); // Blue
    doc.rect(0, 0, 210, 6, 'F');

    // Corporate Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text("PIONEER DMS GROUP LTD", 15, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Workforce Expense & Petty Cash Tally Statement", 15, 25);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 29);

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 33, 195, 33);

    // Employee Meta Info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("STAFF ACCOUNT DETAILS", 15, 41);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Employee Name: ${empName}`, 15, 47);
    doc.text(`Employee Code: ${empCode}`, 15, 52);
    doc.text(`Designation/Dept: ${dept}`, 15, 57);

    doc.text(`Total Advanced: AED ${tally.totalAdvanced.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 115, 47);
    doc.text(`Total Expended: AED ${tally.totalSpending.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 115, 52);
    
    // Balance Status
    const statusText = tally.netBalance >= 0 
        ? `REMAINING BALANCE: AED ${tally.netBalance.toLocaleString(undefined, {minimumFractionDigits: 2})} (BALANCED)`
        : `OVERSPENT DEFICIT: AED ${Math.abs(tally.netBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} (UNBALANCED)`;
    
    doc.setFont("helvetica", "bold");
    if (tally.netBalance >= 0) {
        doc.setTextColor(16, 185, 129); // Green
    } else {
        doc.setTextColor(239, 68, 68); // Red
    }
    doc.text(statusText, 115, 57);

    // Tally Certified Stamp
    doc.setDrawColor(tally.netBalance >= 0 ? 16 : 239, tally.netBalance >= 0 ? 185 : 68, tally.netBalance >= 0 ? 129 : 68);
    doc.rect(145, 12, 50, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(tally.netBalance >= 0 ? 16 : 239, tally.netBalance >= 0 ? 185 : 68, tally.netBalance >= 0 ? 129 : 68);
    doc.text(tally.netBalance >= 0 ? "TALLY SYSTEM: OK" : "TALLY: OVERSPENT", 152, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("OFFICIALLY AUDITED", 157, 22);

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 63, 195, 63);

    // Ledger Title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("ITEMIZED TRANSACTION HISTORY LEDGER", 15, 71);

    // Table Headers
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 76, 180, 8, 'F');
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("DATE", 18, 81);
    doc.text("TYPE & REFERENCE", 40, 81);
    doc.text("DESCRIPTION / SHOP / SUPPLIER", 85, 81);
    doc.text("CREDIT (IN)", 150, 81);
    doc.text("DEBIT (OUT)", 175, 81);

    // Let's merge both Petty Cash items and Everyday Expenses sorted chronologically
    const ledgerEntries: any[] = [];
    tally.pettyCashItems.forEach((p: any) => {
        ledgerEntries.push({
            date: p.date,
            ref: p.type === 'Income' ? 'Petty Cash Advance' : `Petty Spent (${p.category})`,
            desc: p.description,
            credit: p.type === 'Income' ? Number(p.amount) : 0,
            debit: p.type === 'Expense' ? Number(p.amount) : 0
        });
    });

    tally.everydayItems.forEach((ee: any) => {
        ledgerEntries.push({
            date: ee.date,
            ref: `Everyday Expense #${ee.invoiceNo || 'N/A'}`,
            desc: `${ee.description || ''} at ${ee.shopName || ee.supplierName || 'General'}`,
            credit: 0,
            debit: Number(ee.totalAmount) || Number(ee.billAmount) || 0
        });
    });

    // Sort entries by date ascending
    ledgerEntries.sort((a, b) => a.date.localeCompare(b.date));

    let y = 88;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    ledgerEntries.forEach((entry, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, y - 4, 180, 6, 'F');
        }

        doc.text(entry.date, 18, y);
        
        // Truncate ref and desc to fit paper
        const refText = entry.ref.length > 25 ? entry.ref.substring(0, 22) + '...' : entry.ref;
        doc.text(refText, 40, y);

        const descText = entry.desc.length > 38 ? entry.desc.substring(0, 35) + '...' : entry.desc;
        doc.text(descText, 85, y);

        doc.text(entry.credit > 0 ? `AED ${entry.credit.toLocaleString()}` : "-", 150, y);
        doc.text(entry.debit > 0 ? `AED ${entry.debit.toLocaleString()}` : "-", 175, y);

        y += 6;
        if (y > 275) {
            doc.addPage();
            // Reprint Header
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, 210, 6, 'F');
            y = 20;
        }
    });

    // Draw End Line
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);

    // Grand Totals Row
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("GRAND RECONCILIATION TOTALS:", 18, y);
    doc.text(`AED ${tally.totalAdvanced.toLocaleString()}`, 150, y);
    doc.text(`AED ${tally.totalSpending.toLocaleString()}`, 175, y);

    doc.save(`Reconciliation_Tally_${empName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const EverydayExpenseView: React.FC<{
    data: EverydayExpense[];
    projects: Project[];
    onAdd: () => void;
    onEdit: (item: EverydayExpense) => void;
    onDelete: (item: EverydayExpense) => void;
    user: SystemUser;
    employees?: any[];
    pettyCash?: any[];
}> = ({ data, projects, onAdd, onEdit, onDelete, user, employees = [], pettyCash = [] }) => {
    const [viewingBill, setViewingBill] = useState<string | null>(null);
    const [activeViewTab, setActiveViewTab] = useState<'ledger' | 'tally'>('ledger');
    const [tallySearch, setTallySearch] = useState('');
    const [reconciliationDetail, setReconciliationDetail] = useState<any | null>(null);

    // Standard columns for everyday expenses ledger
    const columns = [
        { key: 'siNo', label: 'SI No', sortable: true },
        { key: 'date', label: 'Date', sortable: true },
        { key: 'invoiceNo', label: 'Invoice No', sortable: true },
        { key: 'trnNo', label: 'TRN No', sortable: true },
        { key: 'clientName', label: 'Client Name', sortable: true },
        { key: 'supplierName', label: 'Supplier Name', sortable: true },
        { key: 'shopName', label: 'Shop Name', sortable: true },
        { key: 'description', label: 'Description' },
        { key: 'billAmount', label: 'Bill Amount', sortable: true, render: (item: EverydayExpense) => item.billAmount.toLocaleString() },
        { key: 'vatAmount', label: 'VAT Amount', sortable: true, render: (item: EverydayExpense) => item.vatAmount.toLocaleString() },
        { key: 'totalAmount', label: 'Total Amount', sortable: true, render: (item: EverydayExpense) => item.totalAmount.toLocaleString() },
        { 
            key: 'uploadedBy', 
            label: 'Uploaded/Updated By', 
            sortable: true, 
            render: (item: EverydayExpense) => {
                const who = item.uploadedBy || item.updatedBy || '-';
                const uploadDate = item.uploadedDate || item.date || '';
                if (who !== '-' && uploadDate) {
                    return `${who} (on ${formatDisplayDate(uploadDate)})`;
                }
                return who;
            } 
        },
    ];

    const filterOptions = [
        {
            key: 'projectId',
            label: 'Project',
            options: projects.map(p => ({ label: p.name, value: p.id }))
        },
        {
            key: 'shopName',
            label: 'Shop',
            options: Array.from(new Set(data.map(d => d.shopName))).filter(Boolean).map(s => ({ label: s, value: s }))
        },
        {
            key: 'supplierName',
            label: 'Supplier',
            options: Array.from(new Set(data.map(d => d.supplierName))).filter(Boolean).map(s => ({ label: s, value: s }))
        },
        {
            key: 'uploadedBy',
            label: 'Uploaded By',
            options: Array.from(new Set(data.map(d => d.uploadedBy))).filter(Boolean).sort().map(u => ({ label: u, value: u }))
        }
    ];

    // Compute tallies for ALL employees
    const tallies = useMemo(() => {
        return (employees || []).map(emp => {
            const employeePettyCash = (pettyCash || []).filter(item => 
                item.employeeId === emp.id || 
                (item.requestedBy && emp.name && item.requestedBy.toLowerCase().trim() === emp.name.toLowerCase().trim())
            );

            const totalAdvanced = employeePettyCash
                .filter(item => item.type === 'Income')
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            const totalDirectSpent = employeePettyCash
                .filter(item => item.type === 'Expense')
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            const employeeEverydayExpenses = (data || []).filter(item => 
                item.employeeId === emp.id || 
                item.uploadedByUid === emp.userId || 
                item.uploadedByUid === emp.id || 
                (item.uploadedBy && emp.name && item.uploadedBy.toLowerCase().trim() === emp.name.toLowerCase().trim())
            );

            const totalEverydaySpent = employeeEverydayExpenses.reduce((sum, item) => sum + (Number(item.totalAmount) || Number(item.billAmount) || 0), 0);

            const totalSpending = totalDirectSpent + totalEverydaySpent;
            const netBalance = totalAdvanced - totalSpending;

            return {
                employee: emp,
                pettyCashItems: employeePettyCash,
                everydayItems: employeeEverydayExpenses,
                totalAdvanced,
                totalDirectSpent,
                totalEverydaySpent,
                totalSpending,
                netBalance
            };
        });
    }, [employees, pettyCash, data]);

    const isEmployeeUser = useMemo(() => user?.role === 'Employee' || user?.role?.toLowerCase() === 'employee', [user]);

    // Find the logged-in employee tally
    const currentEmployeeTally = useMemo(() => {
        if (!isEmployeeUser) return null;
        return tallies.find(t => 
            t.employee.userId === user?.uid || 
            t.employee.id === user?.uid || 
            (t.employee.name && user?.name && t.employee.name.toLowerCase() === user.name.toLowerCase())
        );
    }, [tallies, isEmployeeUser, user]);

    // Active stats
    const staffWithTallyCount = useMemo(() => {
        if (isEmployeeUser) {
            return currentEmployeeTally ? 1 : 0;
        }
        return tallies.filter(t => t.totalAdvanced > 0 || t.totalSpending > 0).length;
    }, [tallies, isEmployeeUser, currentEmployeeTally]);

    const overallAdvanced = useMemo(() => {
        if (isEmployeeUser) {
            return currentEmployeeTally ? currentEmployeeTally.totalAdvanced : 0;
        }
        return tallies.reduce((sum, t) => sum + t.totalAdvanced, 0);
    }, [tallies, isEmployeeUser, currentEmployeeTally]);

    const overallExpended = useMemo(() => {
        if (isEmployeeUser) {
            return currentEmployeeTally ? currentEmployeeTally.totalSpending : 0;
        }
        return tallies.reduce((sum, t) => sum + t.totalSpending, 0);
    }, [tallies, isEmployeeUser, currentEmployeeTally]);

    const overallRemaining = useMemo(() => overallAdvanced - overallExpended, [overallAdvanced, overallExpended]);

    // Filter tallies by search term
    const filteredTallies = useMemo(() => {
        const baseTallies = isEmployeeUser 
            ? (currentEmployeeTally ? [currentEmployeeTally] : []) 
            : tallies;

        if (!tallySearch.trim()) {
            return isEmployeeUser 
                ? baseTallies 
                : baseTallies.filter(t => t.totalAdvanced > 0 || t.totalSpending > 0);
        }
        const query = tallySearch.toLowerCase();
        return baseTallies.filter(t => 
            t.employee.name.toLowerCase().includes(query) ||
            (t.employee.code || '').toLowerCase().includes(query) ||
            (t.employee.designation || '').toLowerCase().includes(query)
        );
    }, [tallies, tallySearch, isEmployeeUser, currentEmployeeTally]);

    return (
        <>
            {/* Top View Toggle Tab Strip */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-2 no-print">
                <div className="bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-2xl inline-flex gap-2 border border-slate-200/50">
                    <button 
                        onClick={() => setActiveViewTab('ledger')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${activeViewTab === 'ledger' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Wallet className="w-4 h-4 text-brand-600" />
                        <span>Everyday Expenses Ledger</span>
                    </button>
                    <button 
                        onClick={() => setActiveViewTab('tally')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${activeViewTab === 'tally' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Scale className="w-4 h-4 text-[#ef4444]" />
                        <span>Petty Cash Reconciliation Sheet</span>
                        <span className="bg-brand-100 text-[#2563eb] text-[10px] px-2 py-0.5 rounded-full font-black">
                            {staffWithTallyCount} active
                        </span>
                    </button>
                </div>
            </div>

            {activeViewTab === 'ledger' ? (
                <DataTable 
                    title="Everyday Expenses"
                    description="Track daily operational expenses and billings."
                    icon={Wallet}
                    data={data}
                    columns={columns}
                    onAdd={onAdd}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewBill={(item) => setViewingBill(item.attachment || null)}
                    searchFields={['invoiceNo', 'clientName', 'supplierName', 'shopName', 'description']}
                    exportFileName="Everyday_Expenses"
                    user={user}
                    filterOptions={filterOptions}
                />
            ) : (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                    {/* Reconciler Header */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                                    <Scale className="w-7 h-7 text-brand-600 animate-pulse" />
                                    <span>Petty Cash Account & Everyday Expenses Tally</span>
                                </h1>
                                <p className="text-slate-400 text-xs font-semibold mt-1">
                                    Reconcile cash advances issued as petty cash against physical invoice receipts uploaded.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-center">Tally Engine Status:</span>
                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                    Synchronized
                                </span>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Accountable Handlers</p>
                                <p className="text-2xl font-black text-slate-905 mt-1">{staffWithTallyCount} Employees</p>
                            </div>
                            <div className="p-4 bg-sky-50/40 rounded-2xl border border-sky-150">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Total Petty Cash Allocated</p>
                                <p className="text-2xl font-black text-slate-905 mt-1">AED {overallAdvanced.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                            </div>
                            <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-150">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#ef4444]">Total Spendings Tally</p>
                                <p className="text-2xl font-black text-slate-905 mt-1">AED {overallExpended.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                            </div>
                            <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-150">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Net Leftover Balance</p>
                                <p className={`text-2xl font-black mt-1 ${overallRemaining >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                    AED {overallRemaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Single employee view if they are logged in as standard staff */}
                    {isEmployeeUser && currentEmployeeTally ? (
                        <div className="bg-gradient-to-br from-indigo-50/50 to-[#2563eb]/5 border border-indigo-100 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-indigo-100/50 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-lg">
                                        {currentEmployeeTally.employee.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Your Current Petty Cash Statement</h3>
                                        <p className="text-xs text-slate-500 font-bold">{currentEmployeeTally.employee.name} — {currentEmployeeTally.employee.designation}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setReconciliationDetail(currentEmployeeTally)}
                                    className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-black transition-all"
                                >
                                    Open Your Ledger Details
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                                <div className="p-4 bg-white rounded-xl border border-slate-200/50">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Funds Received</span>
                                    <span className="text-base font-black text-slate-800">AED {currentEmployeeTally.totalAdvanced.toLocaleString()}</span>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-slate-200/50">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Direct Cash Spent</span>
                                    <span className="text-base font-black text-slate-800">AED {currentEmployeeTally.totalDirectSpent.toLocaleString()}</span>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-slate-200/50">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Everyday Bills Spent</span>
                                    <span className="text-base font-black text-slate-800">AED {currentEmployeeTally.totalEverydaySpent.toLocaleString()}</span>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-slate-200/50">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Remaining Cash In Hand</span>
                                    <span className={`text-base font-black ${currentEmployeeTally.netBalance >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                        AED {currentEmployeeTally.netBalance.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Master Tally List of Employees */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight">Personnel Tally Roll</h3>
                                <p className="text-xs text-slate-400 font-semibold">Consolidated tally sheets for each operational staff.</p>
                            </div>
                            <div className="relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search staff profile..."
                                    value={tallySearch}
                                    onChange={e => setTallySearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                                />
                            </div>
                        </div>

                        {filteredTallies.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-semibold text-xs">
                                No active employee petty cash or expenses found matching search filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            <th className="py-4 px-6">Staff Member</th>
                                            <th className="py-4 px-4 text-center">Cash Allocations (In)</th>
                                            <th className="py-4 px-4 text-center">Petty Cash Spent</th>
                                            <th className="py-4 px-4 text-center">Everyday Bills Spent</th>
                                            <th className="py-4 px-4 text-center">Total Spend (Out)</th>
                                            <th className="py-4 px-4 text-center">Tally Balance</th>
                                            <th className="py-4 px-4 text-center">Mismatches / Status</th>
                                            <th className="py-4 px-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                        {filteredTallies.map((item: any) => {
                                            const isBalanced = item.netBalance >= 0;
                                            return (
                                                <tr key={item.employee.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-600">
                                                                {item.employee.name[0]}
                                                            </div>
                                                            <div>
                                                                <p className="font-extrabold text-slate-900">{item.employee.name}</p>
                                                                <p className="text-[10px] text-slate-400">{item.employee.designation || 'Staff'} • {item.employee.code || 'No Code'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center font-bold text-sky-700">AED {item.totalAdvanced.toLocaleString()}</td>
                                                    <td className="py-4 px-4 text-center text-slate-500">AED {item.totalDirectSpent.toLocaleString()}</td>
                                                    <td className="py-4 px-4 text-center text-slate-500">AED {item.totalEverydaySpent.toLocaleString()}</td>
                                                    <td className="py-4 px-4 text-center font-bold text-slate-800">AED {item.totalSpending.toLocaleString()}</td>
                                                    <td className={`py-4 px-4 text-center font-black ${isBalanced ? "text-emerald-600" : "text-rose-500"}`}>
                                                        AED {item.netBalance.toLocaleString()}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        {isBalanced ? (
                                                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-100 inline-block">
                                                                ✓ Balanced
                                                            </span>
                                                        ) : (
                                                            <span className="bg-rose-50 text-rose-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-rose-100 inline-block">
                                                                ⚠ Overspent
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => setReconciliationDetail(item)}
                                                                className="px-3 py-1.5 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-bold transition-all cursor-pointer"
                                                            >
                                                                Review Ledger
                                                            </button>
                                                            <button 
                                                                onClick={() => generateEmployeeTallyPdf(item)}
                                                                className="p-1.5 hover:bg-slate-100 text-[#2563eb] rounded-lg border border-[#2563eb]/20 text-[11px] font-bold transition-all cursor-pointer"
                                                                title="Download Tally PDF Statement"
                                                            >
                                                                📥 PDF
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
                </div>
            )}

            {/* Detailed Reconciliation Ledger Voucher (Side-by-Side Dual Column) */}
            {reconciliationDetail && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md no-print">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]"
                    >
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                    Ledger Reconciliation Statement
                                </h3>
                                <p className="text-slate-500 text-xs font-semibold">
                                    Detailed credits vs spendings ledger accounting for <span className="text-brand-600 font-extrabold">{reconciliationDetail.employee.name}</span>.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => generateEmployeeTallyPdf(reconciliationDetail)}
                                    className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    📥 Download PDF Statement
                                </button>
                                <button 
                                    onClick={() => setReconciliationDetail(null)}
                                    className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Summary Block */}
                        <div className="p-6 bg-slate-50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-xs">
                                <span className="text-slate-400 block font-bold text-[10px] uppercase">Allocated Cash (Credits)</span>
                                <span className="text-sm font-black text-sky-700 mt-1 block">AED {reconciliationDetail.totalAdvanced.toLocaleString()}</span>
                            </div>
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-xs">
                                <span className="text-slate-400 block font-bold text-[10px] uppercase">Vouchers Cash-out (Debits)</span>
                                <span className="text-sm font-black text-slate-500 mt-1 block">AED {reconciliationDetail.totalDirectSpent.toLocaleString()}</span>
                            </div>
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/50 shadow-xs">
                                <span className="text-slate-400 block font-bold text-[10px] uppercase">Bills Submitted (Debits)</span>
                                <span className="text-sm font-black text-slate-500 mt-1 block">AED {reconciliationDetail.totalEverydaySpent.toLocaleString()}</span>
                            </div>
                            <div className={`p-3.5 rounded-2xl border shadow-xs ${reconciliationDetail.netBalance >= 0 ? "bg-emerald-50/50 border-emerald-150" : "bg-rose-50/50 border-rose-150"}`}>
                                <span className="text-slate-400 block font-bold text-[10px] uppercase">Net Statement Tally</span>
                                <span className={`text-sm font-black mt-1 block ${reconciliationDetail.netBalance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                    AED {reconciliationDetail.netBalance.toLocaleString()} {reconciliationDetail.netBalance >= 0 ? "(Balanced)" : "(Deficit)"}
                                </span>
                            </div>
                        </div>

                        {/* Dual Column Ledger Content */}
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/30 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[50vh]">
                            {/* LEFT SIDE: CASH CREDITS */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-sky-850 uppercase tracking-wider flex items-center justify-between bg-sky-50 px-3 py-2 rounded-xl border border-sky-100">
                                    <span>Credits (Cash Received)</span>
                                    <span className="text-sky-700">AED {reconciliationDetail.totalAdvanced.toLocaleString()}</span>
                                </h4>
                                {reconciliationDetail.pettyCashItems.filter((i: any) => i.type === 'Income').length === 0 ? (
                                    <p className="text-center p-8 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-semibold">
                                        No documented cash advances received.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {reconciliationDetail.pettyCashItems.filter((i: any) => i.type === 'Income').map((item: any) => (
                                            <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-250/50 shadow-xs flex items-center justify-between gap-2 hover:border-slate-300 transition-all text-xs">
                                                <div>
                                                    <p className="font-extrabold text-slate-900">{item.description || 'Petty cash advance'}</p>
                                                    <span className="text-[10px] text-slate-400 font-bold">{item.date} • Mode: {item.mode || 'Cash'}</span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-sky-700">AED {item.amount.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* RIGHT SIDE: SPENDINGS / DEBITS */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-rose-850 uppercase tracking-wider flex items-center justify-between bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">
                                    <span>Debits (Expenses Reported)</span>
                                    <span className="text-rose-700">AED {reconciliationDetail.totalSpending.toLocaleString()}</span>
                                </h4>
                                {reconciliationDetail.pettyCashItems.filter((i: any) => i.type === 'Expense').length === 0 && reconciliationDetail.everydayItems.length === 0 ? (
                                    <p className="text-center p-8 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-semibold">
                                        No expense receipts logged.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Petty Cash Spending Vouchers */}
                                        {reconciliationDetail.pettyCashItems.filter((i: any) => i.type === 'Expense').map((item: any) => (
                                            <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-250/50 shadow-xs flex items-center justify-between gap-2 hover:border-slate-300 transition-all text-xs">
                                                <div>
                                                    <p className="font-extrabold text-slate-900">{item.description || 'Petty cash disbursement'}</p>
                                                    <span className="text-[10px] text-slate-400 font-bold">{item.date} • Petty Cash Book ({item.category})</span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-800">AED {item.amount.toLocaleString()}</p>
                                                    <span className="text-[9px] text-[#ef4444] font-bold">Voucher</span>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Everyday Expense Receipts */}
                                        {reconciliationDetail.everydayItems.map((item: any) => (
                                            <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-250/50 shadow-xs flex items-center justify-between gap-2 hover:border-slate-300 transition-all text-xs">
                                                <div>
                                                    <p className="font-extrabold text-slate-900">{item.description || 'Everyday purchase'}</p>
                                                    <span className="text-[10px] text-slate-400 font-bold">{item.date} • Inv #{item.invoiceNo || 'N/A'} at {item.shopName || item.supplierName}</span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-800">AED {item.totalAmount.toLocaleString()}</p>
                                                    <span className="text-[9px] text-brand-600 font-bold">Invoice</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end bg-slate-50">
                            <button 
                                onClick={() => setReconciliationDetail(null)}
                                className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-250 rounded-2xl text-xs font-black text-slate-700 transition-all cursor-pointer"
                            >
                                Close Statement
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Viewing Attachment Lightbox (inherited) */}
            {viewingBill && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md no-print">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">View Bill Receipt</h3>
                                <p className="text-slate-500 text-xs font-semibold">Attached document for everyday expense.</p>
                            </div>
                            <button 
                                onClick={() => setViewingBill(null)}
                                className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm cursor-pointer"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 overflow-y-auto flex items-center justify-center bg-slate-100/50 flex-1 min-h-[300px]">
                            {viewingBill.startsWith('data:image') || viewingBill.startsWith('http') ? (
                                <img 
                                    src={viewingBill} 
                                    alt="Bill Receipt" 
                                    className="max-w-full max-h-[55vh] object-contain rounded-2xl shadow-md border border-slate-200"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center max-w-sm shadow-sm">
                                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-700 mb-2">Attached File Doc</p>
                                    <p className="text-xs text-slate-500 font-semibold mb-4">The attached bill cannot be previewed directly as an image.</p>
                                    <a 
                                        href={viewingBill} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Open Document
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
};

export const EverydayExpenseModal: React.FC<{
    expense: EverydayExpense | null;
    projects: Project[];
    onSave: (data: EverydayExpense) => void;
    onCancel: () => void;
    user: any;
    everydayExpenses?: EverydayExpense[];
    employees?: any[];
}> = ({ expense, projects, onSave, onCancel, user, everydayExpenses = [], employees = [] }) => {
    const calculateNextSiNo = (uid: string, name: string) => {
        const userExpenses = everydayExpenses.filter(ee => 
            (ee.uploadedByUid && uid && ee.uploadedByUid === uid) || 
            (ee.uploadedBy && name && ee.uploadedBy.toLowerCase() === name.toLowerCase())
        );
        return String(userExpenses.length + 1);
    };

    const [formData, setFormData] = useState<EverydayExpense>(expense || {
        id: Math.random().toString(36).substr(2, 9),
        siNo: expense ? expense.siNo : calculateNextSiNo(user?.uid || '', user?.name || ''),
        date: new Date().toISOString().split('T')[0],
        invoiceNo: '',
        trnNo: '',
        clientName: '',
        supplierName: '',
        shopName: '',
        billAmount: 0,
        vatAmount: 0,
        totalAmount: 0,
        description: '',
        projectId: '',
        uploadedBy: user?.name || '',
        uploadedByUid: user?.uid || '',
        uploadedDate: new Date().toISOString().split('T')[0],
        employeeId: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [tempImageData, setTempImageData] = useState<{ image: string, mime: string } | null>(null);
    const [uploaderName, setUploaderName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [duplicateMatch, setDuplicateMatch] = useState<EverydayExpense | null>(null);

    const findDuplicateEntry = (newExpense: EverydayExpense) => {
        if (!everydayExpenses || everydayExpenses.length === 0) return null;
        
        return everydayExpenses.find(existing => {
            if (existing.id === newExpense.id) return false;
            
            // If both entries have different non-empty invoice numbers, they are NOT duplicates
            if (
                newExpense.invoiceNo && 
                existing.invoiceNo && 
                newExpense.invoiceNo.trim().length > 2 &&
                existing.invoiceNo.trim().length > 2 &&
                newExpense.invoiceNo.trim().toLowerCase() !== existing.invoiceNo.trim().toLowerCase()
            ) {
                return false;
            }
            
            // 1. Check Invoice number match (case-insensitive, trimmed, not empty)
            if (
                newExpense.invoiceNo && 
                existing.invoiceNo && 
                newExpense.invoiceNo.trim().length > 2 &&
                newExpense.invoiceNo.trim().toLowerCase() === existing.invoiceNo.trim().toLowerCase()
            ) {
                return true;
            }
            
            // 2. Check TRN number + Date + Total Amount
            if (
                newExpense.trnNo && 
                existing.trnNo &&
                newExpense.trnNo.trim().length > 2 &&
                newExpense.trnNo.trim().toLowerCase() === existing.trnNo.trim().toLowerCase() &&
                newExpense.date === existing.date &&
                Number(newExpense.totalAmount) === Number(existing.totalAmount)
            ) {
                return true;
            }

            // 3. Check Supplier + Date + Total Amount
            if (
                newExpense.supplierName &&
                existing.supplierName &&
                newExpense.supplierName.trim().length > 2 &&
                existing.supplierName.trim().length > 2 &&
                newExpense.supplierName.trim().toLowerCase() === existing.supplierName.trim().toLowerCase() &&
                newExpense.date === existing.date &&
                Number(newExpense.totalAmount) === Number(existing.totalAmount)
            ) {
                return true;
            }

            return false;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanError(null);
        try {
            const { base64, mimeType } = await compressImageFile(file);
            if (!base64) {
                throw new Error("Failed to process the uploaded image");
            }
            setTempImageData({ image: base64, mime: mimeType });
            const nameToSuggest = formData.uploadedBy || formData.updatedBy || user?.name || '';
            setUploaderName(nameToSuggest);

            if (nameToSuggest) {
                // Already have user name, proceed to scan directly!
                // Note: isScanning is already true
                fetch("/api/gemini/extract-receipt", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        image: base64,
                        mimeType: mimeType,
                        type: "everyday"
                    })
                })
                .then(async (response) => {
                    const text = await response.text();
                    if (!response.ok) {
                        let errMsg = "Failed to scan receipt";
                        try {
                            const errResult = JSON.parse(text);
                            errMsg = errResult.error || errMsg;
                        } catch {
                            errMsg = text.slice(0, 120).trim() || `HTTP error ${response.status}`;
                            if (errMsg.toLowerCase().includes('<!doctype html>') || errMsg.toLowerCase().includes('<html')) {
                                errMsg = "Please make sure your server is running and configured correctly. (Vite dev server or backend received 404/500)";
                            }
                        }
                        throw new Error(errMsg);
                    }
                    try {
                        return JSON.parse(text);
                    } catch {
                        throw new Error("Invalid response format received from server (expected JSON)");
                    }
                })
                .then((data) => {
                    setFormData(prev => {
                        const calculatedSiNo = expense ? expense.siNo : calculateNextSiNo(user?.uid || '', nameToSuggest);
                        const updated = {
                            ...prev,
                            ...data,
                            siNo: calculatedSiNo,
                            uploadedBy: nameToSuggest,
                            uploadedByUid: user?.uid || '',
                            uploadedDate: prev.uploadedDate || new Date().toISOString().split('T')[0],
                            updatedBy: nameToSuggest,
                            updatedByUid: user?.uid || '',
                            attachment: base64
                        };
                        const duplicate = findDuplicateEntry(updated);
                        if (duplicate) {
                            setDuplicateMatch(duplicate);
                        }
                        return updated;
                    });
                })
                .catch((error: any) => {
                    console.error("Scanning failed:", error);
                    setScanError(error.message || "An error occurred while scanning with Gemini");
                })
                .finally(() => {
                    setIsScanning(false);
                    setTempImageData(null);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    if (cameraInputRef.current) {
                        cameraInputRef.current.value = '';
                    }
                });
            } else {
                setShowNamePrompt(true);
                setIsScanning(false);
            }
        } catch (err: any) {
            console.error("Image processing error:", err);
            setScanError(err.message || "Failed to process the uploaded file");
            setIsScanning(false);
        }
    };

    const handleConfirmNameAndScan = async () => {
        if (!uploaderName.trim()) {
            alert("Please enter your name to proceed.");
            return;
        }
        if (!tempImageData) return;

        setShowNamePrompt(false);
        setIsScanning(true);
        setScanError(null);

        try {
            const response = await fetch("/api/gemini/extract-receipt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    image: tempImageData.image,
                    mimeType: tempImageData.mime,
                    type: "everyday"
                })
            });

            const text = await response.text();

            if (!response.ok) {
                let errMsg = "Failed to scan receipt";
                try {
                    const errResult = JSON.parse(text);
                    errMsg = errResult.error || errMsg;
                } catch {
                    errMsg = text.slice(0, 120).trim() || `HTTP error ${response.status}`;
                    if (errMsg.toLowerCase().includes('<!doctype html>') || errMsg.toLowerCase().includes('<html')) {
                        errMsg = "Please make sure your server is running and configured correctly. (Vite dev server or backend received 404/500)";
                    }
                }
                throw new Error(errMsg);
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error("Invalid response format received from server (expected JSON)");
            }

            setFormData(prev => {
                const calculatedSiNo = expense ? expense.siNo : calculateNextSiNo(user?.uid || '', uploaderName);
                const updated = {
                    ...prev,
                    ...data,
                    siNo: calculatedSiNo,
                    uploadedBy: uploaderName,
                    uploadedByUid: user?.uid || '',
                    uploadedDate: prev.uploadedDate || new Date().toISOString().split('T')[0],
                    updatedBy: uploaderName,
                    updatedByUid: user?.uid || '',
                    attachment: tempImageData.image
                };
                const duplicate = findDuplicateEntry(updated);
                if (duplicate) {
                    setDuplicateMatch(duplicate);
                }
                return updated;
            });
        } catch (error: any) {
            console.error("Scanning failed:", error);
            setScanError(error.message || "An error occurred while scanning with Gemini");
        } finally {
            setIsScanning(false);
            setTempImageData(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
            }
        }
    };

    const handleAmountChange = (val: number) => {
        const vat = val * 0.05;
        const total = val + vat;
        setFormData({
            ...formData,
            billAmount: val,
            vatAmount: Number(vat.toFixed(2)),
            totalAmount: Number(total.toFixed(2))
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                            {expense ? 'Edit Expense' : 'Add Everyday Expense'}
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">Enter daily operational expense details.</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Gemini AI Scan Panel */}
                    <div className="bg-gradient-to-r from-brand-50 to-emerald-50/50 p-5 rounded-3xl border border-brand-100/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-100 text-brand-700 rounded-2xl">
                                <Paperclip className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">AI Receipt Scanner</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Upload receipt photo or take a new picture to auto-fill details.</p>
                                {(formData.uploadedBy || formData.updatedBy) && (
                                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-brand-100/50 rounded-lg text-brand-900 text-[10px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse" />
                                        Recorded by: {formData.uploadedBy || formData.updatedBy} {formData.uploadedDate ? `on ${formatDisplayDate(formData.uploadedDate)}` : `on ${formatDisplayDate(new Date().toISOString().split('T')[0])}`}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                Upload Photo
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                    if (isMobile && cameraInputRef.current) {
                                        cameraInputRef.current.click();
                                    } else {
                                        setShowCamera(true);
                                    }
                                }}
                                className="w-full sm:w-auto px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Camera className="w-3.5 h-3.5" />
                                Take Photo
                            </button>
                            <input 
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <input 
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={cameraInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    {scanError && (
                        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-semibold">
                            ⚠️ {scanError}
                        </div>
                    )}

                    {formData.attachment && (
                        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/60 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-brand-50 text-brand-700 rounded-2xl">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bill Attached</h4>
                                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">A receipt image is linked to this expense.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const win = window.open();
                                        if (win) {
                                            win.document.write(`<iframe src="${formData.attachment}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Preview
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, attachment: undefined }))}
                                    className="p-2 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                                    title="Remove attachment"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SI No</label>
                            <input 
                                type="text"
                                value={formData.siNo}
                                onChange={e => setFormData({ ...formData, siNo: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</label>
                            <input 
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Invoice No</label>
                            <input 
                                type="text"
                                value={formData.invoiceNo}
                                onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">TRN No</label>
                            <input 
                                type="text"
                                value={formData.trnNo}
                                onChange={e => setFormData({ ...formData, trnNo: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Name</label>
                            <input 
                                type="text"
                                value={formData.clientName}
                                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Supplier Name</label>
                            <input 
                                type="text"
                                value={formData.supplierName}
                                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Shop Name</label>
                            <input 
                                type="text"
                                value={formData.shopName}
                                onChange={e => setFormData({ ...formData, shopName: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description (Material/Details)</label>
                        <textarea 
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[100px]"
                            placeholder="Mention material or other details..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project (Optional)</label>
                        <select 
                            value={formData.projectId}
                            onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        >
                            <option value="">General / No Project</option>
                            {projects.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1" id="uploader-label-everyday-uniq">Uploaded / Updated By (Your Name)</label>
                        <input 
                            type="text"
                            placeholder="Enter your name..."
                            value={formData.uploadedBy || formData.updatedBy || ''}
                            onChange={e => setFormData({ ...formData, uploadedBy: e.target.value, updatedBy: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#2563eb] ml-1">Assign to Employee Account (for Petty Cash Tally)</label>
                        <select 
                            value={formData.employeeId || ''}
                            onChange={e => {
                                const empId = e.target.value;
                                const selectedEmp = employees.find(emp => emp.id === empId);
                                setFormData({ 
                                    ...formData, 
                                    employeeId: empId,
                                    uploadedBy: selectedEmp ? selectedEmp.name : (formData.uploadedBy || formData.updatedBy || ''),
                                    uploadedByUid: selectedEmp ? selectedEmp.userId || selectedEmp.id : formData.uploadedByUid
                                });
                            }}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#2563eb] transition-all"
                        >
                            <option value="">-- Auto-detect by Name, or Select Employee --</option>
                            {employees.map((emp: any) => (
                                <option key={emp.id} value={emp.id}>
                                    👤 {emp.name} ({emp.designation || 'Staff'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4 p-4 bg-brand-50/50 rounded-2xl border border-brand-100">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">Bill Amount</label>
                            <input 
                                type="number"
                                value={formData.billAmount}
                                onChange={e => handleAmountChange(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">VAT (5%)</label>
                            <div className="w-full px-4 py-3 bg-white/50 border border-brand-100 rounded-xl text-sm font-bold text-slate-500">
                                {formData.vatAmount.toLocaleString()}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-600 ml-1">Total Amount</label>
                            <div className="w-full px-4 py-3 bg-brand-600 rounded-xl text-sm font-black text-white shadow-md">
                                {formData.totalAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                    <button 
                        onClick={() => {
                            const duplicate = findDuplicateEntry(formData);
                            if (duplicate) {
                                setDuplicateMatch(duplicate);
                            } else {
                                onSave(formData);
                            }
                        }} 
                        className="flex-1 px-6 py-4 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20"
                    >
                        Save Expense
                    </button>
                </div>
            </motion.div>

            {/* Dialog Overlays */}
            {showNamePrompt && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-fade-in">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm border border-slate-150 shadow-2xl space-y-4 text-left">
                        <div className="text-center space-y-1">
                            <span className="inline-flex items-center justify-center p-3 bg-brand-50 text-brand-600 rounded-2xl mb-2">
                                <Paperclip className="w-6 h-6" />
                            </span>
                            <h3 className="text-base font-black text-slate-800">Identify Yourself</h3>
                            <p className="text-xs text-slate-500 font-semibold">Who is uploading or updating this record?</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Your Full Name</label>
                            <input 
                                type="text" 
                                value={uploaderName}
                                onChange={e => setUploaderName(e.target.value)}
                                placeholder="e.g. Sreeraj, Jamel..."
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2.5 pt-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowNamePrompt(false);
                                    setTempImageData(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={handleConfirmNameAndScan}
                                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                                Confirm & Scan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center z-[120] p-4 text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm flex flex-col items-center gap-4 border border-slate-100 text-left">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-brand-600 rounded-full animate-spin" />
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gemini AI OCR</h3>
                            <p className="text-xs text-slate-500 font-semibold mt-1">Reading receipt image and extracting ledger details...</p>
                        </div>
                    </div>
                </div>
            )}

            {duplicateMatch && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[130] p-4 no-print">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 sm:p-8 bg-rose-50 border-b border-rose-100 flex items-center gap-4 text-left">
                            <span className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                                <AlertTriangle className="w-6 h-6 animate-pulse" />
                            </span>
                            <div>
                                <h3 className="text-lg font-black text-rose-950 tracking-tight uppercase">Double Entry Blocked</h3>
                                <p className="text-rose-700 text-xs font-semibold">This bill / receipt has already been added.</p>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 overflow-y-auto space-y-5 bg-slate-50/50 flex-1 text-left">
                            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm space-y-4">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    First Entry Details
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SI No / ID</p>
                                        <p className="text-xs font-black text-slate-800 mt-0.5">{duplicateMatch.siNo || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice Date</p>
                                        <p className="text-xs font-black text-slate-800 mt-0.5">{formatDisplayDate(duplicateMatch.date) || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice No</p>
                                        <p className="text-xs font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 inline-block mt-0.5">{duplicateMatch.invoiceNo || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TRN No</p>
                                        <p className="text-xs font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 inline-block mt-0.5">{duplicateMatch.trnNo || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier & Shop</p>
                                        <p className="text-xs font-black text-slate-800 mt-0.5">
                                            {duplicateMatch.supplierName || '-'} 
                                            {duplicateMatch.shopName ? ` (${duplicateMatch.shopName})` : ''}
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</p>
                                        <p className="text-xs font-bold text-slate-600 mt-0.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 min-h-[36px]">{duplicateMatch.description || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
                                        <p className="text-sm font-black text-brand-600 mt-0.5">{duplicateMatch.totalAmount?.toLocaleString() || '0'} AED</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recorded By</p>
                                        <p className="text-xs font-black text-slate-800 mt-0.5">
                                            {duplicateMatch.uploadedBy || duplicateMatch.updatedBy || 'System'}
                                            {duplicateMatch.uploadedDate ? ` (on ${formatDisplayDate(duplicateMatch.uploadedDate)})` : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {duplicateMatch.attachment && (
                                <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-left">
                                        <FileText className="w-5 h-5 text-brand-600" />
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Original Bill Attached</p>
                                            <p className="text-[10px] text-slate-500 font-semibold">An image copy of the first bill is available.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const win = window.open();
                                            if (win) {
                                                win.document.write(`<iframe src="${duplicateMatch.attachment}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                            }
                                        }}
                                        className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        View Bill
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => setDuplicateMatch(null)}
                                className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer text-center"
                            >
                                Cancel / Edit
                            </button>
                            <button 
                                onClick={() => {
                                    setDuplicateMatch(null);
                                    onSave(formData);
                                }}
                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-all shadow-md cursor-pointer text-center"
                            >
                                Save Anyway
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {showCamera && (
                <LiveCameraCapture 
                    onClose={() => setShowCamera(false)}
                    onCapture={(base64, mime) => {
                        setTempImageData({ image: base64, mime: mime });
                        const nameToSuggest = formData.uploadedBy || formData.updatedBy || user?.name || '';
                        setUploaderName(nameToSuggest);
                        setScanError(null);
                        setShowCamera(false);

                        if (nameToSuggest) {
                            setIsScanning(true);
                            fetch("/api/gemini/extract-receipt", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    image: base64,
                                    mimeType: mime,
                                    type: "everyday"
                                })
                            })
                            .then(async (response) => {
                                const text = await response.text();
                                if (!response.ok) {
                                    let errMsg = "Failed to scan receipt";
                                    try {
                                        const errResult = JSON.parse(text);
                                        errMsg = errResult.error || errMsg;
                                    } catch {
                                        errMsg = text.slice(0, 120).trim() || `HTTP error ${response.status}`;
                                        if (errMsg.toLowerCase().includes('<!doctype html>') || errMsg.toLowerCase().includes('<html')) {
                                            errMsg = "Please make sure your server is running and configured correctly.";
                                        }
                                    }
                                    throw new Error(errMsg);
                                }
                                try {
                                    return JSON.parse(text);
                                } catch {
                                    throw new Error("Invalid response format received from server (expected JSON)");
                                }
                            })
                            .then((data) => {
                                setFormData(prev => {
                                    const calculatedSiNo = expense ? expense.siNo : calculateNextSiNo(user?.uid || '', nameToSuggest);
                                    const updated = {
                                        ...prev,
                                        ...data,
                                        siNo: calculatedSiNo,
                                        uploadedBy: nameToSuggest,
                                        uploadedByUid: user?.uid || '',
                                        uploadedDate: prev.uploadedDate || new Date().toISOString().split('T')[0],
                                        updatedBy: nameToSuggest,
                                        updatedByUid: user?.uid || '',
                                        attachment: base64
                                    };
                                    const duplicate = findDuplicateEntry(updated);
                                    if (duplicate) {
                                        setDuplicateMatch(duplicate);
                                    }
                                    return updated;
                                });
                            })
                            .catch((error: any) => {
                                console.error("Scanning failed:", error);
                                setScanError(error.message || "An error occurred while scanning with Gemini");
                            })
                            .finally(() => {
                                setIsScanning(false);
                            });
                        } else {
                            setShowNamePrompt(true);
                        }
                    }}
                />
            )}
        </div>
    );
};

export const FinancialDashboardView: React.FC<{
    accountsPayable: any[];
    accountsReceivable: any[];
    pettyCash: any[];
    everydayExpenses: any[];
    projects: any[];
    employees: any[];
    setActiveTab: (tab: string) => void;
    user: any;
}> = ({
    accountsPayable,
    accountsReceivable,
    pettyCash,
    everydayExpenses,
    projects,
    employees,
    setActiveTab,
    user
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [viewingBill, setViewingBill] = useState<string | null>(null);

    // Accounts Payable calculations
    const totalAP = useMemo(() => (accountsPayable || []).reduce((sum: number, x: any) => sum + (Number(x.totalAmount) || 0), 0), [accountsPayable]);
    const pendingAP = useMemo(() => (accountsPayable || []).filter((x: any) => x.status !== 'Paid' && x.status !== 'Settled').reduce((sum: number, x: any) => sum + (Number(x.totalAmount) || 0), 0), [accountsPayable]);

    // Accounts Receivable calculations
    const totalAR = useMemo(() => (accountsReceivable || []).reduce((sum: number, x: any) => sum + (Number(x.totalAmount) || 0), 0), [accountsReceivable]);
    const pendingAR = useMemo(() => (accountsReceivable || []).filter((x: any) => x.status !== 'Paid' && x.status !== 'Settled').reduce((sum: number, x: any) => sum + (Number(x.totalAmount) || 0), 0), [accountsReceivable]);

    // Everyday Expenses
    const totalEE = useMemo(() => (everydayExpenses || []).reduce((sum: number, x: any) => sum + (Number(x.totalAmount) || Number(x.billAmount) || 0), 0), [everydayExpenses]);

    // Extract categories/books representing accounts in Petty Cash
    const books = useMemo(() => {
        const cats = new Set<string>();
        (pettyCash || []).forEach((item: any) => {
            if (item.category) cats.add(item.category);
        });
        return Array.from(cats).sort();
    }, [pettyCash]);

    // Reconciliation Calculation per Account/Book
    const reconciliations = useMemo(() => {
        return books.map(book => {
            const bookPcs = (pettyCash || []).filter((item: any) => item.category && item.category.toLowerCase().trim() === book.toLowerCase().trim());
            const advances = bookPcs.filter((item: any) => item.type === 'Income').reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
            const directSpent = bookPcs.filter((item: any) => item.type === 'Expense').reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

            // Match everyday expenses where uploader matches book name
            const matchingEE = (everydayExpenses || []).filter((item: any) => {
                const uploaderRaw = (item.uploadedBy || '').toLowerCase().trim();
                const cleanUploader = uploaderRaw.split('(')[0].trim();
                const targetBook = book.toLowerCase().trim();

                return cleanUploader === targetBook || 
                       uploaderRaw.includes(targetBook) || 
                       targetBook.includes(cleanUploader) ||
                       (cleanUploader === 'jamel' && targetBook === 'jamil') ||
                       (cleanUploader === 'jamil' && targetBook === 'jamel');
            });

            const everydaySpent = matchingEE.reduce((sum: number, item: any) => sum + (Number(item.totalAmount) || Number(item.billAmount) || 0), 0);
            const reconciledBalance = advances - directSpent - everydaySpent;

            return {
                accountName: book,
                advances,
                directSpent,
                everydaySpent,
                reconciledBalance,
                matchingCount: matchingEE.length
            };
        });
    }, [books, pettyCash, everydayExpenses]);

    // Filtered accounts for display
    const filteredReconciliations = useMemo(() => {
        if (!searchQuery.trim()) return reconciliations;
        const query = searchQuery.toLowerCase().trim();
        return reconciliations.filter(r => r.accountName.toLowerCase().includes(query));
    }, [reconciliations, searchQuery]);

    // Consolidated Net Petty Cash Hand Balance across all books!
    const totalPCReconciledBalance = useMemo(() => {
        return reconciliations.reduce((sum, r) => sum + r.reconciledBalance, 0);
    }, [reconciliations]);

    // Financial Footprint Chart data definition
    const chartData = useMemo(() => [
        { name: 'Receivables', amount: totalAR, color: '#10b981' },
        { name: 'Payables', amount: totalAP, color: '#ef4444' },
        { name: 'Everyday Costs', amount: totalEE, color: '#f59e0b' },
        { name: 'Petty Cash In Hand', amount: totalPCReconciledBalance >= 0 ? totalPCReconciledBalance : 0, color: '#2563eb' },
    ], [totalAR, totalAP, totalEE, totalPCReconciledBalance]);

    // Chronological detail ledger for the selected account card click
    const selectedAccountLedger = useMemo(() => {
        if (!selectedAccount) return [];

        const book = selectedAccount;
        const bookPcs = (pettyCash || []).filter((item: any) => item.category && item.category.toLowerCase().trim() === book.toLowerCase().trim());

        const pcsMapped = bookPcs.map(item => ({
            id: item.id,
            date: item.date || '',
            description: item.description || 'Petty cash transaction',
            amount: Number(item.amount) || 0,
            changeType: item.type === 'Income' ? 'in' : 'out', // 'Income' is cash-in (Advance Receipt), 'Expense' is cash-out
            sourceType: 'Petty Cash Book',
            reference: item.type === 'Income' ? 'Cash Advance Received' : `Direct Petty Outflow (${item.mode || 'Cash'})`,
            attachment: item.attachment || item.signedAttachment,
            originalItem: item
        }));

        const matchingEE = (everydayExpenses || []).filter((item: any) => {
            const uploaderRaw = (item.uploadedBy || '').toLowerCase().trim();
            const cleanUploader = uploaderRaw.split('(')[0].trim();
            const targetBook = book.toLowerCase().trim();

            return cleanUploader === targetBook || 
                   uploaderRaw.includes(targetBook) || 
                   targetBook.includes(cleanUploader) ||
                   (cleanUploader === 'jamel' && targetBook === 'jamil') ||
                   (cleanUploader === 'jamil' && targetBook === 'jamel');
        });

        const eeMapped = matchingEE.map(item => ({
            id: item.id,
            date: item.date || '',
            description: item.description || `Everyday Bill: ${item.supplierName || item.shopName || 'Receipt'}`,
            amount: Number(item.totalAmount) || Number(item.billAmount) || 0,
            changeType: 'out', // Everyday Expense is always cash spent (outflow)
            sourceType: 'Everyday Expense',
            reference: `Everyday Bill Receipt (Inv: ${item.invoiceNo || 'N/A'})`,
            attachment: item.attachment,
            originalItem: item
        }));

        // Sort chronologically (oldest first) to accurately build progressive run balances
        const combined = [...pcsMapped, ...eeMapped].sort((a, b) => {
            const valA = a.date ? new Date(a.date).getTime() : 0;
            const valB = b.date ? new Date(b.date).getTime() : 0;
            if (valA !== valB) return valA - valB;
            return a.id.localeCompare(b.id);
        });

        let currentBal = 0;
        return combined.map(tx => {
            const previousBalance = currentBal;
            if (tx.changeType === 'in') {
                currentBal += tx.amount;
            } else {
                currentBal -= tx.amount;
            }
            return {
                ...tx,
                previousBalance,
                balanceAfter: currentBal
            };
        });
    }, [selectedAccount, pettyCash, everydayExpenses]);

    // Handle overall reconciliation directory Excel Excel export
    const handleExportReconciliationExcel = () => {
        const wsData = filteredReconciliations.map((recon) => ({
            'Account (Cash Book)': recon.accountName,
            'Advances Received (AED)': recon.advances,
            'Direct Petty Spent (AED)': recon.directSpent,
            'Auto-Matched Everyday Cost (AED)': recon.everydaySpent,
            'Reconciled Safe Cash (AED)': recon.reconciledBalance,
            'Health Status': recon.reconciledBalance >= 0 ? "BALANCED" : "DEFICIT",
            'Matched Verified Bills Count': recon.matchingCount
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reconciliations");
        // Auto-sizing columns helper
        const maxLen = Math.max(...wsData.map(r => r['Account (Cash Book)'].length), 15);
        ws['!cols'] = [
            { wch: maxLen + 4 },
            { wch: 24 },
            { wch: 24 },
            { wch: 30 },
            { wch: 24 },
            { wch: 15 },
            { wch: 28 }
        ];
        XLSX.writeFile(wb, "Automated_Petty_Cash_Reconciliation_Directory.xlsx");
    };

    // Handle overall reconciliation directory PDF export
    const handleExportReconciliationPDF = () => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const assets = getPioneerPDFAssets();
        if (assets.watermark) {
            doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
        }

        doc.setFillColor(37, 99, 235); // Pioneer brand Royal Blue top banner
        doc.rect(0, 0, 210, 6, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text("AUTOMATED PETTY CASH RECONCILIATION SUMMARY", 15, 18);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Corporate Petty Cash Directory Reconciliations | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, 23);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.line(15, 27, 195, 27);

        // Header Table block
        const tableHeaderY = 32;
        doc.setFillColor(37, 99, 235); // Deep Blue background for table headers
        doc.rect(15, tableHeaderY, 180, 8.5, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text("ACCOUNT (CASH BOOK)", 18, tableHeaderY + 5.5);
        doc.text("ADVANCES RECEIVED", 75, tableHeaderY + 5.5, { align: 'right' });
        doc.text("DIRECT PETTY SPENT", 110, tableHeaderY + 5.5, { align: 'right' });
        doc.text("EVERYDAY COST", 145, tableHeaderY + 5.5, { align: 'right' });
        doc.text("RECONCILED SAFE CASH", 182, tableHeaderY + 5.5, { align: 'right' });
        doc.text("STATUS", 188, tableHeaderY + 5.5, { align: 'left' });

        let currentY = tableHeaderY + 8.5;
        filteredReconciliations.forEach((recon: any, idx: number) => {
            if (currentY > 270) {
                doc.addPage();
                doc.setFillColor(37, 99, 235);
                doc.rect(0, 0, 210, 6, 'F');
                currentY = 15;
            }

            // Zebra style lines background
            if (idx % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, currentY, 180, 8, 'F');
            }

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            doc.text((recon.accountName || '').toUpperCase(), 18, currentY + 5.5);

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`AED ${recon.advances.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 75, currentY + 5.5, { align: 'right' });
            doc.text(`AED ${recon.directSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 110, currentY + 5.5, { align: 'right' });
            doc.text(`AED ${recon.everydaySpent.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 145, currentY + 5.5, { align: 'right' });

            const isSurplus = recon.reconciledBalance >= 0;
            doc.setFont("Helvetica", "bold");
            if (isSurplus) {
                doc.setTextColor(16, 124, 65); // Green
            } else {
                doc.setTextColor(190, 24, 74); // Red/Crimson
            }
            doc.text(`AED ${recon.reconciledBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 182, currentY + 5.5, { align: 'right' });
            
            doc.setFontSize(7.5);
            doc.text(isSurplus ? "BALANCED" : "DEFICIT", 188, currentY + 5.5, { align: 'left' });

            currentY += 8;
        });

        // Add consolidated metrics line at bottom of the main table
        if (currentY > 260) {
            doc.addPage();
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, 210, 6, 'F');
            currentY = 15;
        }

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.5);
        doc.line(15, currentY + 2, 195, currentY + 2);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text("TOTALS SUMMARY", 18, currentY + 7);

        const totalAdvances = filteredReconciliations.reduce((sum, r) => sum + r.advances, 0);
        const totalDirectSpent = filteredReconciliations.reduce((sum, r) => sum + r.directSpent, 0);
        const totalEverydaySpent = filteredReconciliations.reduce((sum, r) => sum + r.everydaySpent, 0);
        const totalReconciled = filteredReconciliations.reduce((sum, r) => sum + r.reconciledBalance, 0);

        doc.setFontSize(8);
        doc.text(`AED ${totalAdvances.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 75, currentY + 7, { align: 'right' });
        doc.text(`AED ${totalDirectSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 110, currentY + 7, { align: 'right' });
        doc.text(`AED ${totalEverydaySpent.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 145, currentY + 7, { align: 'right' });
        
        if (totalReconciled >= 0) {
            doc.setTextColor(16, 124, 65);
        } else {
            doc.setTextColor(190, 24, 74);
        }
        doc.text(`AED ${totalReconciled.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 182, currentY + 7, { align: 'right' });
        doc.text(totalReconciled >= 0 ? "BALANCED" : "DEFICIT", 188, currentY + 7, { align: 'left' });

        doc.save("Automated_Petty_Cash_Reconciliation_Directory.pdf");
    };

    // Excel export of the selected account statements ledger list details
    const handleExportLedgerExcel = () => {
        if (!selectedAccount) return;
        const wsData = selectedAccountLedger.map((tx) => ({
            'Date': tx.date,
            'Description Details': tx.description,
            'Reference & Bill Info': tx.reference,
            'Source Ledger Category': tx.sourceType,
            'Amount Flow Type': tx.changeType === 'in' ? 'CASH GL ADVANCE RECEIVED' : 'OUTFLOW EXPENDITURE SPENT',
            'Opening Balance (AED)': tx.previousBalance,
            'Transaction Bill Amt (AED)': tx.amount,
            'Closing Balance Amt (AED)': tx.balanceAfter,
            'Is Document Bill Photo Attached': tx.attachment ? "YES" : "NO"
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ledger");
        ws['!cols'] = [
            { wch: 12 },
            { wch: 34 },
            { wch: 38 },
            { wch: 22 },
            { wch: 28 },
            { wch: 22 },
            { wch: 24 },
            { wch: 24 },
            { wch: 32 }
        ];
        XLSX.writeFile(wb, `${selectedAccount.toUpperCase().replace(/\s+/g, '_')}_Statement_Ledger.xlsx`);
    };

    // Beautiful corporate standard PDF statement ledger report export
    const handleExportLedgerPDF = () => {
        if (!selectedAccount) return;

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const assets = getPioneerPDFAssets();
        if (assets.watermark) {
            doc.addImage(assets.watermark, 'PNG', 32, 75, 145, 145, undefined, 'FAST');
        }

        doc.setFillColor(37, 99, 235); 
        doc.rect(0, 0, 210, 6, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text("RECONCILED PERSONAL STATEMENT LEDGER", 15, 18);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Account / Holder: ${selectedAccount.toUpperCase()} | Generated: ${new Date().toLocaleDateString()}`, 15, 23);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.line(15, 27, 195, 27);

        // Summary Statistics box
        const cardY = 32;
        doc.setFillColor(248, 250, 252);
        doc.rect(15, cardY, 180, 18, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(15, cardY, 180, 18, 'D');

        const totalAdvances = selectedAccountLedger.filter(tx => tx.changeType === 'in').reduce((sum, tx) => sum + tx.amount, 0);
        const totalSpendings = selectedAccountLedger.filter(tx => tx.changeType === 'out').reduce((sum, tx) => sum + tx.amount, 0);
        const finalBalance = selectedAccountLedger[selectedAccountLedger.length - 1]?.balanceAfter ?? 0;

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("TOTAL CASH ADVANCES (IN)", 20, cardY + 5.5);
        doc.text("TOTAL SPENDINGS TALLY (OUT)", 82, cardY + 5.5);
        doc.text("NET RECONCILED SAFE CASH", 144, cardY + 5.5);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(16, 124, 65); // Green for cash assets incoming
        doc.text(`AED ${totalAdvances.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 20, cardY + 12.5);

        doc.setTextColor(190, 24, 74); // Red/Crimson for expenses/outflows
        doc.text(`AED ${totalSpendings.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 82, cardY + 12.5);

        if (finalBalance >= 0) {
            doc.setTextColor(37, 99, 235); // Blue
        } else {
            doc.setTextColor(190, 24, 74); // Red deficit
        }
        doc.text(`AED ${finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 144, cardY + 12.5);

        // Table headers starting point
        const tableHeaderY = 56;
        doc.setFillColor(37, 99, 235); // Pioneer portal blue brand headers
        doc.rect(15, tableHeaderY, 180, 8.5, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text("DATE", 18, tableHeaderY + 5.5);
        doc.text("TRANSACTION DETAILS & REFERENCE", 42, tableHeaderY + 5.5);
        doc.text("SOURCE LEDGER", 112, tableHeaderY + 5.5);
        doc.text("PREV. BALANCE", 145, tableHeaderY + 5.5, { align: 'right' });
        doc.text("TX AMOUNT", 168, tableHeaderY + 5.5, { align: 'right' });
        doc.text("RUN. BALANCE", 192, tableHeaderY + 5.5, { align: 'right' });

        let currentY = tableHeaderY + 8.5;
        selectedAccountLedger.forEach((tx, idx) => {
            if (currentY > 268) {
                doc.addPage();
                doc.setFillColor(37, 99, 235);
                doc.rect(0, 0, 210, 6, 'F');
                
                // Redraw table headers on new pages
                doc.setFillColor(37, 99, 235);
                doc.rect(15, 12, 180, 8.5, 'F');
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(7.5);
                doc.setTextColor(255, 255, 255);
                doc.text("DATE", 18, 12 + 5.5);
                doc.text("TRANSACTION DETAILS & REFERENCE", 42, 12 + 5.5);
                doc.text("SOURCE LEDGER", 112, 12 + 5.5);
                doc.text("PREV. BALANCE", 145, 12 + 5.5, { align: 'right' });
                doc.text("TX AMOUNT", 168, 12 + 5.5, { align: 'right' });
                doc.text("RUN. BALANCE", 192, 12 + 5.5, { align: 'right' });
                
                currentY = 20.5;
            }

            // Alternating zebra list item rows backgrounds
            if (idx % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, currentY, 180, 9.5, 'F');
            }

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(tx.date, 18, currentY + 6);

            // Details and references mapping format
            doc.setFont("Helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            let dTxt = tx.description;
            if (dTxt.length > 33) {
                dTxt = dTxt.substring(0, 31) + "...";
            }
            doc.text(dTxt, 42, currentY + 4);
            
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            let rTxt = tx.reference;
            if (rTxt.length > 51) {
                rTxt = rTxt.substring(0, 49) + "...";
            }
            doc.text(rTxt, 42, currentY + 7.5);

            // Source types
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(7);
            if (tx.sourceType === 'Everyday Expense') {
                doc.setTextColor(217, 119, 6); // Orange-ish Amber
            } else {
                doc.setTextColor(79, 70, 229); // Indigo
            }
            doc.text(tx.sourceType.toUpperCase(), 112, currentY + 5.5);

            // Numeric Columns formatting
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(tx.previousBalance.toLocaleString(undefined, {minimumFractionDigits: 2}), 145, currentY + 5.5, { align: 'right' });

            const isIncome = tx.changeType === 'in';
            doc.setFont("Helvetica", "bold");
            if (isIncome) {
                doc.setTextColor(16, 124, 65);
            } else {
                doc.setTextColor(190, 24, 74);
            }
            doc.text(`${isIncome ? "+" : "-"} ${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 168, currentY + 5.5, { align: 'right' });

            if (tx.balanceAfter >= 0) {
                doc.setTextColor(16, 124, 65);
            } else {
                doc.setTextColor(190, 24, 74);
            }
            doc.text(tx.balanceAfter.toLocaleString(undefined, {minimumFractionDigits: 2}), 192, currentY + 5.5, { align: 'right' });

            currentY += 9.5;
        });

        doc.save(`${selectedAccount.toUpperCase().replace(/\s+/g, '_')}_Statement_Ledger.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-brand-50 rounded-2xl text-brand-600 shadow-sm shadow-brand-100">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <span>Corporate Financial Dashboard</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 sm:mt-1.5 font-medium ml-1">
                        Consolidated accounts, petty cash ledgers, everyday expenses, and real-time automated reconciliations.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total System Liquidity:</span>
                    <span className="bg-emerald-50 border border-emerald-100/60 text-emerald-700 text-xs px-3.5 py-1.5 rounded-full font-black shadow-sm flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        AED {(totalAR + totalPCReconciledBalance - totalAP).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </div>
            </div>

            {/* Top KPIs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Accounts Receivable card */}
                <div 
                    onClick={() => setActiveTab('accounts-receivable')}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/50 shadow-sm hover:shadow-md hover:border-emerald-200 active:scale-98 cursor-pointer transition-all flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Accounts Receivable</span>
                            <span className="text-2xl font-black text-slate-900 tracking-tight block">
                                AED {totalAR.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 border-t border-slate-50 pt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Pending Collection:</span>
                        <span className="text-emerald-600">AED {pendingAR.toLocaleString()}</span>
                    </div>
                </div>

                {/* 2. Accounts Payable card */}
                <div 
                    onClick={() => setActiveTab('accounts-payable')}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/50 shadow-sm hover:shadow-md hover:border-red-200 active:scale-98 cursor-pointer transition-all flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Accounts Payable</span>
                            <span className="text-2xl font-black text-slate-900 tracking-tight block">
                                AED {totalAP.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                        <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                            <TrendingDown className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 border-t border-slate-50 pt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Pending Outflow:</span>
                        <span className="text-red-600">AED {pendingAP.toLocaleString()}</span>
                    </div>
                </div>

                {/* 3. Everyday Expenses card */}
                <div 
                    onClick={() => setActiveTab('everyday-expenses')}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/50 shadow-sm hover:shadow-md hover:border-amber-200 active:scale-98 cursor-pointer transition-all flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Everyday Expenses</span>
                            <span className="text-2xl font-black text-slate-900 tracking-tight block">
                                AED {totalEE.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 border-t border-slate-50 pt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Total Everyday Spend:</span>
                        <span className="text-amber-600 font-extrabold">{everydayExpenses.length} Receipts</span>
                    </div>
                </div>

                {/* 4. Petty Cash In Hand card */}
                <div 
                    onClick={() => setActiveTab('petty-cash')}
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200/50 shadow-sm hover:shadow-md hover:border-brand-200 active:scale-98 cursor-pointer transition-all flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Petty Cash In Hand</span>
                            <span className={`text-2xl font-black tracking-tight block ${totalPCReconciledBalance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                                AED {totalPCReconciledBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                        <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                            <Scale className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 border-t border-slate-50 pt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Fully Reconciled Balance:</span>
                        <span className={totalPCReconciledBalance >= 0 ? "text-brand-605" : "text-rose-600"}>
                            {totalPCReconciledBalance >= 0 ? "Surplus ✔" : "Deficit ✘"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Center Grid: Footprint Chart & Details */}
            <div className="grid grid-cols-1 gap-8">
                {/* Visual Chart - Financial Footprint */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm flex flex-col min-h-[420px]">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Consolidated Financial Footprint</h3>
                                <p className="text-xs text-slate-500 font-semibold">Consolidated accounts receivable, payable, everyday and cash expenses.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[290px]">
                        <ResponsiveContainer width="100%" height={290}>
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickFormatter={(val) => `AED ${val.toLocaleString()}`} tickLine={false} />
                                <RechartsTooltip
                                    formatter={(value: any) => [`AED ${Number(value).toLocaleString()}`, 'Consolidated Value']}
                                    contentStyle={{ background: '#ffffff', borderRadius: '1.25rem', borderColor: '#e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
                                />
                                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Petty Cash Automated Reconciliation Panel */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                            <Scale className="w-5 h-5 text-brand-600" />
                            <span>Automated Petty Cash Book Accounts Reconciliation</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                            Everyday Expenses uploaded by name are automatically matched, tallied, and subtracted from the respective petty cash book advances.
                        </p>
                    </div>
                    
                    {/* Search bar & export actions specifically for reconciliations */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                        <div className="relative w-full sm:w-64">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400" />
                            </span>
                            <input
                                type="text"
                                placeholder="Search Cash Accounts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs font-bold text-slate-800 placeholder-slate-400 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all cursor-text"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportReconciliationExcel}
                                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
                                title="Download complete reconciliation data to Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                <span>Excel</span>
                            </button>
                            <button
                                onClick={handleExportReconciliationPDF}
                                className="px-4 py-2.5 bg-brand-50 hover:bg-brand-100 border border-brand-100 text-brand-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
                                title="Download complete reconciliation report as PDF"
                            >
                                <Download className="w-4 h-4 text-brand-500" />
                                <span>PDF Summary</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-250/20">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Account (Cash Book)</th>
                                <th scope="col" className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Advances Received</th>
                                <th scope="col" className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Petty Spent</th>
                                <th scope="col" className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-Matched Everyday Cost</th>
                                <th scope="col" className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Reconciled Safe Cash</th>
                                <th scope="col" className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status / Health</th>
                                <th scope="col" className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[140px]">Statement Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 text-xs">
                            {filteredReconciliations.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400 font-bold">
                                        No matching petty cash accounts found.
                                    </td>
                                </tr>
                            ) : (
                                filteredReconciliations.map((recon) => {
                                    const isSurplus = recon.reconciledBalance >= 0;
                                    return (
                                        <tr 
                                            key={recon.accountName} 
                                            onClick={() => setSelectedAccount(recon.accountName)}
                                            className="hover:bg-slate-50/80 transition-all cursor-pointer group active:bg-slate-100"
                                            title={`Click to view transaction-wise ledger statement for ${recon.accountName}`}
                                        >
                                            <td className="px-6 py-4.5 font-bold text-slate-800 flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full bg-brand-500 shrink-0"></div>
                                                <span className="capitalize">{recon.accountName}</span>
                                            </td>
                                            <td className="px-6 py-4.5 text-right font-semibold text-slate-600">
                                                AED {recon.advances.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="px-6 py-4.5 text-right font-semibold text-slate-600">
                                                AED {recon.directSpent.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="px-6 py-4.5 text-right font-bold text-amber-600">
                                                AED {recon.everydaySpent.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                {recon.matchingCount > 0 && (
                                                    <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                                                        {recon.matchingCount} verified bills
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4.5 text-right font-black ${isSurplus ? "text-emerald-700" : "text-rose-600"}`}>
                                                AED {recon.reconciledBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="px-6 py-4.5 text-center">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block shadow-sm",
                                                    isSurplus 
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                                        : "bg-rose-50 text-rose-700 border border-rose-100"
                                                )}>
                                                    {isSurplus ? "Balanced ✔" : "Deficit ✘"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4.5 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedAccount(recon.accountName);
                                                    }}
                                                    className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-all shadow-sm transform group-hover:scale-105"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Ledger</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Ledger Modal Panel */}
            <AnimatePresence>
                {selectedAccount && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="bg-white rounded-[2.5rem] w-full max-w-5xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh] border border-slate-200/80"
                        >
                            {/* Modal Header */}
                            <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl shadow-sm">
                                        <Scale className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
                                            <span className="capitalize">{selectedAccount}</span>
                                            <span className="text-slate-400 font-extrabold text-base">• Statement Ledger</span>
                                        </h3>
                                        <p className="text-slate-500 text-xs font-semibold mt-0.5">
                                            Review chronologically matched advances and expenditures in continuous real-time running format.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end lg:self-auto">
                                    <button
                                        onClick={handleExportLedgerExcel}
                                        className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
                                        title="Download statement ledger to Excel"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                        <span>Export Excel</span>
                                    </button>
                                    <button
                                        onClick={handleExportLedgerPDF}
                                        className="px-4 py-2 bg-brand-50 hover:bg-brand-100 border border-brand-100 text-brand-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
                                        title="Download statement ledger to PDF"
                                    >
                                        <Download className="w-4 h-4 text-brand-500" />
                                        <span>Export PDF</span>
                                    </button>
                                    <div className="hidden sm:block w-[1px] h-6 bg-slate-200 mx-1" />
                                    <button
                                        onClick={() => setSelectedAccount(null)}
                                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-405 hover:text-slate-600 shadow-sm cursor-pointer border border-slate-200/50 bg-white"
                                    >
                                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Ledger Summary Cards banner */}
                            <div className="px-6 sm:px-8 py-5 bg-slate-150/10 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-405 block tracking-wider">Total Cash Advances</span>
                                        <span className="text-lg font-black text-emerald-700 block mt-0.5">
                                            AED {(selectedAccountLedger.filter(tx => tx.changeType === 'in').reduce((sum, tx) => sum + tx.amount, 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-405 block tracking-wider">Total Spendings Tally</span>
                                        <span className="text-lg font-black text-rose-600 block mt-0.5">
                                            AED {(selectedAccountLedger.filter(tx => tx.changeType === 'out').reduce((sum, tx) => sum + tx.amount, 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                        <TrendingDown className="w-4 h-4" />
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-405 block tracking-wider font-extrabold text-brand-600">Reconciled Safe Cash Balance</span>
                                        <span className={`text-lg font-black block mt-0.5 ${
                                            (selectedAccountLedger[selectedAccountLedger.length - 1]?.balanceAfter ?? 0) >= 0 
                                                ? 'text-brand-600' 
                                                : 'text-rose-600'
                                        }`}>
                                            AED {(selectedAccountLedger[selectedAccountLedger.length - 1]?.balanceAfter ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                    <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            {/* Chronological Table List */}
                            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-50/20 max-h-[50vh]">
                                <div className="overflow-x-auto rounded-2xl border border-slate-200/65 bg-white">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[110px]">Date</th>
                                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Details</th>
                                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[160px]">Source Ledger</th>
                                                <th scope="col" className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</th>
                                                <th scope="col" className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill/Tx Amount</th>
                                                <th scope="col" className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing Balance</th>
                                                <th scope="col" className="px-5 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">Bill Doc</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100 text-xs">
                                            {selectedAccountLedger.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                        No transactions recorded for this account.
                                                    </td>
                                                </tr>
                                            ) : (
                                                selectedAccountLedger.map((tx, idx) => {
                                                    const isIncome = tx.changeType === 'in';
                                                    return (
                                                        <tr key={tx.id || idx} className="hover:bg-slate-50/50 transition-all">
                                                            {/* Date */}
                                                            <td className="px-5 py-4 font-semibold text-slate-500 whitespace-nowrap">
                                                                {tx.date || 'N/A'}
                                                            </td>
                                                            {/* Transaction Details */}
                                                            <td className="px-5 py-4">
                                                                <div className="font-extrabold text-slate-800 break-words max-w-[280px]">
                                                                    {tx.description}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                                    {tx.reference}
                                                                </div>
                                                            </td>
                                                            {/* Source Ledger */}
                                                            <td className="px-5 py-4">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                                                    tx.sourceType === 'Everyday Expense' 
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                                                )}>
                                                                    {tx.sourceType}
                                                                </span>
                                                            </td>
                                                            {/* Opening/Previous Balance */}
                                                            <td className="px-5 py-4 text-right font-medium text-slate-500 whitespace-nowrap">
                                                                AED {tx.previousBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                            </td>
                                                            {/* Bill Amount with Debit/Credit color indicator */}
                                                            <td className={`px-5 py-4 text-right font-black whitespace-nowrap ${
                                                                isIncome ? "text-emerald-600" : "text-rose-500"
                                                            }`}>
                                                                {isIncome ? "+" : "-"} AED {tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                            </td>
                                                            {/* Closing / Balance after each transaction */}
                                                            <td className={`px-5 py-4 text-right font-extrabold whitespace-nowrap ${
                                                                tx.balanceAfter >= 0 ? "text-emerald-700" : "text-rose-600"
                                                            }`}>
                                                                AED {tx.balanceAfter.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                            </td>
                                                            {/* Attachment Column */}
                                                            <td className="px-5 py-4 text-center whitespace-nowrap">
                                                                {tx.attachment ? (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setViewingBill(tx.attachment || null);
                                                                        }}
                                                                        className="p-1.5 hover:bg-white rounded-lg text-brand-600 hover:text-brand-700 hover:scale-110 active:scale-95 cursor-pointer transition-all border border-slate-200/40 shadow-xs"
                                                                        title="View Attachment Receipt / Bill"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-300 font-bold uppercase select-none">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
                                <button
                                    onClick={() => setSelectedAccount(null)}
                                    className="px-5 py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                                >
                                    Close Ledger
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Lightbox / Attachment viewer modal */}
            {viewingBill && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md no-print">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">View Attached Bill</h3>
                                <p className="text-slate-500 text-xs font-semibold">Attached document for matched petty cash / everyday expense.</p>
                            </div>
                            <button 
                                onClick={() => setViewingBill(null)}
                                className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm cursor-pointer"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 overflow-y-auto flex items-center justify-center bg-slate-100/50 flex-1 min-h-[300px]">
                            {viewingBill.startsWith('data:image') || viewingBill.startsWith('http') ? (
                                <img 
                                    src={viewingBill} 
                                    alt="Bill Receipt" 
                                    className="max-w-full max-h-[55vh] object-contain rounded-2xl shadow-md border border-slate-200"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center max-w-sm shadow-sm">
                                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-700 mb-2">Attached File Doc</p>
                                    <p className="text-xs text-slate-500 font-semibold mb-4">The attached bill cannot be previewed directly as an image.</p>
                                    <a 
                                        href={viewingBill} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold uppercase rounded-xl shadow-md cursor-pointer transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Download Document</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

