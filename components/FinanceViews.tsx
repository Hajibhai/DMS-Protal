
import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Filter, Download, Plus, Edit, Trash2, 
  ChevronDown, X, FileText, Globe, Truck, 
  TrendingUp, TrendingDown, Wallet, Calendar,
  MoreVertical, Check, ListFilter, ArrowUpDown,
  FileSpreadsheet, ExternalLink, Paperclip, Printer, Eye, AlertTriangle,
  Camera, Upload, CheckCircle, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { cn } from '../utils';
import { Vendor, AccountsPayable, AccountsReceivable, PettyCash, 
  Supplier, Project, SystemUser, UserRole, ProjectedExpense, EverydayExpense 
} from '../types';
import { PrintModal, PrintOptions } from './PrintModal';

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

export const AccountsPayableView = ({ data, vendors, suppliers, projects, onAdd, onEdit, onDelete, user }: any) => {
    const getVendorName = (id: string, type: string) => {
        if (type === 'Supplier') return suppliers.find((s: any) => s.id === id)?.name || 'Unknown';
        return vendors.find((v: any) => v.id === id)?.name || 'Unknown';
    };

    const getProjectName = (id?: string) => {
        if (!id) return '-';
        return projects.find((p: any) => p.id === id)?.name || 'N/A';
    };

    return (
        <DataTable<AccountsPayable>
            title="Accounts Payable"
            description="Track and manage outgoing payments to suppliers and clients."
            icon={TrendingDown}
            data={data}
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
    );
};

export const downloadZohoInvoicePDF = (item: any, company?: any, client?: any) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

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
        sellerDetails.push(`Seller TRN (VAT ID): ${company?.trn || item.companyTrn}`);
    }
    doc.text(sellerDetails, 15, headerOffset);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("INVOICE", 195, 24, { align: 'right' });

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
        clientDetails.push(`Client TRN (VAT ID): ${client?.trn || item.clientTrn}`);
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
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);

    lineItems.forEach((li: any, idx: number) => {
        doc.line(15, yPos + 12, 195, yPos + 12);
        
        doc.setFont("Helvetica", "normal");
        doc.text(String(idx + 1), 18, yPos + 6);
        
        doc.setFont("Helvetica", "bold");
        doc.text(li.name || 'Contract Item', 30, yPos + 5);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(lightText[0], lightText[1], lightText[2]);
        doc.text(li.description || 'Standard service charges as per agreement', 30, yPos + 9);
        
        doc.setFontSize(9);
        doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
        doc.text(String(li.quantity || 1), 115, yPos + 6, { align: 'right' });
        doc.text(Number(li.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), 145, yPos + 6, { align: 'right' });
        
        doc.setFont("Helvetica", "bold");
        doc.text(Number(li.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), 190, yPos + 6, { align: 'right' });

        yPos += 12;
    });

    yPos += 8;
    if (yPos > 240) {
        doc.addPage();
        yPos = 30;
    }

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

    yPos += 20;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("TERMS & INSTRUCTIONS", 15, yPos);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text([
        "1. Please reference the Invoice Number on bank transfers and wire remittance.",
        "2. Payment is due within the stipulated credit days from invoice date.",
        "3. Standard 5% UAE VAT applies to all items and charges outlined above."
    ], 15, yPos + 5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("AUTHORIZED SIGNATORY", 192, yPos + 22, { align: 'right' });
    doc.line(135, yPos + 17, 192, yPos + 17);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("Operations / Accounts Dept", 192, yPos + 26, { align: 'right' });

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 289, 210, 8, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Official electronic tax invoice generated inside Pioneer Group DMS.", 105, 294, { align: "center" });

    doc.save(`Invoice_${item.invoiceNumber || 'INV'}.pdf`);
};

export const AccountsReceivableView = ({ data, projects, suppliers, vendors, onAdd, onEdit, onDelete, user, companies }: any) => {
    const [previewInvoiceItem, setPreviewInvoiceItem] = useState<{ item: any; comp: any; client: any } | null>(null);

    const getEntityName = (id: string, type: string) => {
        if (type === 'Project') return projects.find((p: any) => p.id === id)?.name || 'Unknown Project';
        if (type === 'Supplier') return suppliers.find((s: any) => s.id === id)?.name || 'Unknown Supplier';
        if (type === 'Vendor') return vendors.find((v: any) => v.id === id)?.name || 'Unknown Client';
        return 'Unknown';
    };

    const getEntityObject = (id: string, type: string) => {
        if (type === 'Project') return projects.find((p: any) => p.id === id);
        if (type === 'Supplier') return suppliers.find((s: any) => s.id === id);
        if (type === 'Vendor') return vendors.find((v: any) => v.id === id);
        return null;
    };

    return (
        <div className="relative">
            <DataTable<AccountsReceivable>
                title="Accounts Receivable"
                description="Manage incoming payments and client invoicing for projects."
                icon={TrendingUp}
                data={data}
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
                                        onClick={() => downloadZohoInvoicePDF(item, comp, client)}
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

            {/* Zoho Books Live Invoice Preview Lightbox */}
            {previewInvoiceItem && (() => {
                const { item, comp, client } = previewInvoiceItem;
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
                                        onClick={() => downloadZohoInvoicePDF(item, comp, client)}
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

                                        {/* Totals compilation box */}
                                        <div className="flex justify-end mb-6">
                                            <div className="w-72 space-y-2 text-xs">
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

export const PettyCashView = ({ data, projects, onAdd, onEdit, onSave, onDelete, user, employees }: any) => {
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
                                    bookBal >= 0 ? "bg-emerald-500" : "bg-red-500"
                                )} />
                                <span>{book === 'All Books' ? '📁 All Accounts' : `👤 ${book}`}</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-lg text-[10px] font-black",
                                    isSelected 
                                        ? "bg-white/10 text-white" 
                                        : bookBal >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                )}>
                                    AED {bookBal.toLocaleString()}
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

export const AccountsPayableModal = ({ ap, vendors, suppliers, projects, onSave, onCancel }: any) => {
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
        status: 'Pending'
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
                                    <option key={v.id} value={v.id}>{v.name}</option>
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
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                                {formData.entityType === 'Vendor' && vendors.map((v: any) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
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
                        {/* Overall General Description */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">General Notes / Footnotes</label>
                            <textarea 
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Additional notes to display on the Zoho Invoice footer..."
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                            />
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

export const EverydayExpenseView: React.FC<{
    data: EverydayExpense[];
    projects: Project[];
    onAdd: () => void;
    onEdit: (item: EverydayExpense) => void;
    onDelete: (item: EverydayExpense) => void;
    user: SystemUser;
}> = ({ data, projects, onAdd, onEdit, onDelete, user }) => {
    const [viewingBill, setViewingBill] = useState<string | null>(null);

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

    return (
        <>
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
}> = ({ expense, projects, onSave, onCancel, user, everydayExpenses = [] }) => {
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
        uploadedDate: new Date().toISOString().split('T')[0]
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
