
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
                        <span className="font-black text-slate-900">AED {item.amount.toLocaleString()}</span>
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
                        <span className="font-black text-slate-900">AED {item.amount.toLocaleString()}</span>
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
    const getProjectName = (id?: string) => {
        if (!id) return 'General';
        return projects.find((p: any) => p.id === id)?.name || 'N/A';
    };

    return (
        <DataTable<PettyCash>
            title="Petty Cash"
            description="Manage small daily expenses and miscellaneous cash transactions."
            icon={Wallet}
            data={data}
            columns={[
                { key: 'date', label: 'Date', sortable: true },
                { key: 'category', label: 'Category', sortable: true },
                { key: 'description', label: 'Description' },
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
                        <span className={cn(
                            "font-black",
                            item.type === 'Income' ? "text-emerald-600" : "text-red-600"
                        )}>
                            {item.type === 'Income' ? '+' : '-'} AED {item.amount.toLocaleString()}
                        </span>
                    )
                },
                { 
                    key: 'requestedBy', 
                    label: 'Requestor / Source',
                    render: (item) => (
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{item.requestedBy}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                                {item.type === 'Income' ? 'Received From' : 'Requested By'}
                            </span>
                        </div>
                    )
                },
            ]}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            searchFields={['description', 'category', 'requestedBy']}
            exportFileName="Petty_Cash"
            user={user}
        />
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
        description: '',
        status: 'Pending'
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (AED)</label>
                            <input 
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
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
                entityType: ar.entityType || 'Project'
            };
        }
        return { 
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            entityId: '',
            entityType: 'Project',
            invoiceNumber: '',
            amount: 0,
            description: '',
            status: 'Pending'
        };
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (AED)</label>
                            <input 
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
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
        projectId: ''
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
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{pettyCash ? 'Edit Petty Cash' : 'Add Petty Cash'}</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Enter transaction details below</p>
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type</label>
                            <select 
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            >
                                <option value="Expense">Expense (-)</option>
                                <option value="Income">Cash Received (+)</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                            <input 
                                type="text"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder={formData.type === 'Income' ? "e.g. From Boss, Bank" : "e.g. Fuel, Stationery"}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (AED)</label>
                            <input 
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            {formData.type === 'Income' ? 'Received From' : 'Requested By'}
                        </label>
                        <input 
                            type="text"
                            value={formData.requestedBy}
                            onChange={e => setFormData({ ...formData, requestedBy: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            placeholder={formData.type === 'Income' ? "Name of person/entity" : "Employee name"}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
                        <textarea 
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[80px]"
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
        { key: 'billAmount', label: 'Bill Amount', sortable: true, render: (item: EverydayExpense) => item.billAmount.toLocaleString() },
        { key: 'vatAmount', label: 'VAT Amount', sortable: true, render: (item: EverydayExpense) => item.vatAmount.toLocaleString() },
        { key: 'totalAmount', label: 'Total Amount', sortable: true, render: (item: EverydayExpense) => item.totalAmount.toLocaleString() },
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
            searchFields={['invoiceNo', 'clientName', 'supplierName', 'shopName']}
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
        projectId: ''
    });

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
        </div>
    );
};
