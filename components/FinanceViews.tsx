
import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Filter, Download, Plus, Edit, Trash2, 
  ChevronDown, X, FileText, Globe, Truck, 
  TrendingUp, TrendingDown, Wallet, Calendar,
  MoreVertical, Check, ListFilter, ArrowUpDown,
  FileSpreadsheet, ExternalLink, Paperclip, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { cn } from '../utils';
import { 
  Vendor, AccountsPayable, AccountsReceivable, PettyCash, 
  Supplier, Project, SystemUser, UserRole, ProjectedExpense, EverydayExpense 
} from '../types';

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

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { size: A4; margin: 20mm; }
                        body { font-family: sans-serif; color: #333; }
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
                        onClick={handlePrint}
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
                                {(onEdit || onDelete) && (
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
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'category', label: 'Category', sortable: true },
        ]}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        searchFields={['name', 'code', 'contactPerson', 'email']}
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

export const AccountsReceivableView = ({ data, projects, suppliers, vendors, onAdd, onEdit, onDelete, user }: any) => {
    const getEntityName = (id: string, type: string) => {
        if (type === 'Project') return projects.find((p: any) => p.id === id)?.name || 'Unknown Project';
        if (type === 'Supplier') return suppliers.find((s: any) => s.id === id)?.name || 'Unknown Supplier';
        if (type === 'Vendor') return vendors.find((v: any) => v.id === id)?.name || 'Unknown Client';
        return 'Unknown';
    };

    return (
        <DataTable<AccountsReceivable>
            title="Accounts Receivable"
            description="Manage incoming payments and client invoicing for projects."
            icon={TrendingUp}
            data={data}
            columns={[
                { key: 'date', label: 'Date', sortable: true },
                { key: 'invoiceNumber', label: 'Invoice #', sortable: true },
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
    );
};

export const PettyCashView = ({ data, projects, onAdd, onEdit, onDelete, user }: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBook, setSelectedBook] = useState('All Books');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedProject, setSelectedProject] = useState('All');
    const [selectedContact, setSelectedContact] = useState('All');
    const [dateRange, setDateRange] = useState('All');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
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

    const handleA4Print = () => {
        window.print();
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
    const [formData, setFormData] = useState(vendor || { code: '', name: '', contactPerson: '', address: '', email: '', phone: '', category: '', notes: '' });

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
                        <p className="text-slate-500 text-sm font-medium mt-1">Enter client details below</p>
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
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Person</label>
                        <input 
                            type="text"
                            value={formData.contactPerson}
                            onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
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

export const AccountsReceivableModal = ({ ar, projects, suppliers, vendors, onSave, onCancel }: any) => {
    const [formData, setFormData] = useState(() => {
        if (ar) {
            return {
                ...ar,
                entityId: ar.entityId || ar.projectId || '',
                entityType: ar.entityType || 'Project',
                vatAmount: ar.vatAmount || 0,
                totalAmount: ar.totalAmount || ar.amount || 0
            };
        }
        return { 
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            entityId: '',
            entityType: 'Project',
            invoiceNumber: '',
            amount: 0,
            vatAmount: 0,
            totalAmount: 0,
            description: '',
            status: 'Pending'
        };
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
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{ar ? 'Edit Receivable' : 'Add Receivable'}</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Enter income details below</p>
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Entity Type</label>
                            <select 
                                value={formData.entityType}
                                onChange={e => setFormData({ ...formData, entityType: e.target.value, entityId: '' })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            >
                                <option value="Project">Project</option>
                                <option value="Supplier">Supplier</option>
                                <option value="Vendor">Client</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                Select {formData.entityType === 'Vendor' ? 'Client' : formData.entityType}
                            </label>
                            <select 
                                value={formData.entityId}
                                onChange={e => setFormData({ ...formData, entityId: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            >
                                <option value="">Select...</option>
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
                        </div>
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
                                <option value="Received">Received</option>
                                <option value="Partially Received">Partially Received</option>
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

export const PettyCashModal = ({ pettyCash, projects, onSave, onCancel }: any) => {
    const [formData, setFormData] = useState(pettyCash || { 
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
        amount: 0,
        type: 'Expense',
        requestedBy: '',
        projectId: '',
        mode: 'Cash',
        contact: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [tempImageData, setTempImageData] = useState<{ image: string, mime: string } | null>(null);
    const [uploaderName, setUploaderName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setTempImageData({ image: base64, mime: file.type });
            setUploaderName(formData.uploadedBy || formData.updatedBy || formData.requestedBy || '');
            setShowNamePrompt(true);
            setScanError(null);
        };
        reader.onerror = () => {
            setScanError("Failed to read the image file");
        };
        reader.readAsDataURL(file);
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

            if (!response.ok) {
                const errResult = await response.json();
                throw new Error(errResult.error || "Failed to scan receipt");
            }

            const data = await response.json();
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
                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Upload receipt photo to auto-fill details.</p>
                                {(formData.uploadedBy || formData.updatedBy) && (
                                    <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100/50 rounded text-blue-900 text-[9px] font-bold">
                                        <span className="w-1 h-1 rounded-full bg-blue-600 animate-pulse" />
                                        Recorded by: {formData.uploadedBy || formData.updatedBy}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Paperclip className="w-3 h-3" />
                                Scan Photo
                            </button>
                            <input 
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={fileInputRef}
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

export const EverydayExpenseView: React.FC<{
    data: EverydayExpense[];
    projects: Project[];
    onAdd: () => void;
    onEdit: (item: EverydayExpense) => void;
    onDelete: (item: EverydayExpense) => void;
    user: SystemUser;
}> = ({ data, projects, onAdd, onEdit, onDelete, user }) => {
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
        { key: 'uploadedBy', label: 'Uploaded/Updated By', sortable: true, render: (item: EverydayExpense) => item.uploadedBy || item.updatedBy || '-' },
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
        }
    ];

    return (
        <DataTable 
            title="Everyday Expenses"
            description="Track daily operational expenses and billings."
            icon={Wallet}
            data={data}
            columns={columns}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            searchFields={['invoiceNo', 'clientName', 'supplierName', 'shopName', 'description']}
            exportFileName="Everyday_Expenses"
            user={user}
            filterOptions={filterOptions}
        />
    );
};

export const EverydayExpenseModal: React.FC<{
    expense: EverydayExpense | null;
    projects: Project[];
    onSave: (data: EverydayExpense) => void;
    onCancel: () => void;
}> = ({ expense, projects, onSave, onCancel }) => {
    const [formData, setFormData] = useState<EverydayExpense>(expense || {
        id: Math.random().toString(36).substr(2, 9),
        siNo: '',
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
        projectId: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [tempImageData, setTempImageData] = useState<{ image: string, mime: string } | null>(null);
    const [uploaderName, setUploaderName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setTempImageData({ image: base64, mime: file.type });
            setUploaderName(formData.uploadedBy || formData.updatedBy || '');
            setShowNamePrompt(true);
            setScanError(null);
        };
        reader.onerror = () => {
            setScanError("Failed to read the image file");
        };
        reader.readAsDataURL(file);
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

            if (!response.ok) {
                const errResult = await response.json();
                throw new Error(errResult.error || "Failed to scan receipt");
            }

            const data = await response.json();
            setFormData(prev => ({
                ...prev,
                ...data,
                uploadedBy: uploaderName,
                updatedBy: uploaderName
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
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Take a photo or upload receipt to auto-fill details.</p>
                                {(formData.uploadedBy || formData.updatedBy) && (
                                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-brand-100/50 rounded-lg text-brand-900 text-[10px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse" />
                                        Recorded by: {formData.uploadedBy || formData.updatedBy}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Paperclip className="w-3.5 h-3.5" />
                                Scan Photo
                            </button>
                            <input 
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={fileInputRef}
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Uploaded / Updated By (Your Name)</label>
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
                    <button onClick={() => onSave(formData)} className="flex-1 px-6 py-4 bg-brand-600 text-white rounded-2xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20">Save Expense</button>
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
        </div>
    );
};
