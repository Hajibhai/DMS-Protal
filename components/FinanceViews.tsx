
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Download, Plus, Edit, Trash2, 
  ChevronDown, X, FileText, Globe, Truck, Car,
  TrendingUp, TrendingDown, Wallet, Calendar,
  MoreVertical, Check, ListFilter, ArrowUpDown,
  FileSpreadsheet, ExternalLink, Paperclip, Printer, Eye, AlertTriangle,
  Camera, Upload, CheckCircle, AlertCircle, Clock, BarChart3, Percent, Scale, Home, Building, FileArchive,
  CreditCard, Users, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { downloadExpenseBillsZip } from '../utils/zipExport';

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

    // Use global callback to show popup modal, fallback to native download if app not yet ready
    if (typeof window !== 'undefined' && (window as any)._shiftsyncShowDownload) {
      (window as any)._shiftsyncShowDownload(finalFilename, blobUrl, triggerNativeDownload);
    } else {
      triggerNativeDownload();
    }

    return this;
  };
  (jsPDF.prototype as any).__isIntercepted = true;
}
import { cn, getPioneerPDFAssets } from '../utils';
import { 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Vendor, AccountsPayable, AccountsReceivable, CreditNote, CreditNoteItem, InvoiceCheque, PettyCash, 
  Supplier, Project, SystemUser, UserRole, ProjectedExpense, EverydayExpense 
} from '../types';
import { PrintModal, PrintOptions } from './PrintModal';
import { GoogleDriveManager } from './GoogleDriveManager';
import { saveEverydayExpense, savePettyCash, moveToRecycleBin } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Universal robust Date-Month-Year extractor that seamlessly handles:
 * - YYYY-MM-DD / YYYY/MM/DD
 * - DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
 * - MM-DD-YYYY / MM/DD/YYYY
 * - YYYY-MM
 * - ISO string / JS Date fallback
 */
export const extractDateMonthYear = (dateStr: string | undefined | null): { year: string; month: string } => {
    if (!dateStr) return { year: '', month: '' };
    const str = String(dateStr).trim().replace(/\//g, '-').replace(/\./g, '-');
    const parts = str.split('-').map(p => p.trim()).filter(Boolean);

    if (parts.length >= 3) {
        if (parts[0].length === 4) {
            const y = parts[0];
            const m = parts[1].padStart(2, '0');
            return { year: y, month: m };
        }
        if (parts[2].length === 4 || parts[2].length === 2) {
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            let m = parts[1].padStart(2, '0');
            const mNum = parseInt(m, 10);
            if (isNaN(mNum) || mNum < 1 || mNum > 12) {
                m = parts[0].padStart(2, '0');
            }
            return { year: y, month: m };
        }
    } else if (parts.length === 2) {
        if (parts[0].length === 4) {
            return { year: parts[0], month: parts[1].padStart(2, '0') };
        }
    }

    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return {
            year: String(d.getFullYear()),
            month: String(d.getMonth() + 1).padStart(2, '0')
        };
    }

    return { year: '', month: '' };
};

/**
 * Standardize any date string format (e.g. MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, ISO timestamp)
 * into standard YYYY-MM-DD for reliable chronological sorting and date-range comparison.
 */
export const normalizeToYYYYMMDD = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '';
    const clean = String(dateStr).trim().split('T')[0];
    const str = clean.replace(/\//g, '-').replace(/\./g, '-');
    const parts = str.split('-').map(p => p.trim()).filter(Boolean);

    if (parts.length >= 3) {
        if (parts[0].length === 4) {
            const y = parts[0];
            const m = parts[1].padStart(2, '0');
            const d = parts[2].padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        if (parts[2].length === 4 || parts[2].length === 2) {
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            let p0 = parseInt(parts[0], 10);
            let p1 = parseInt(parts[1], 10);
            let m = p0;
            let d = p1;
            if (p0 > 12) {
                d = p0;
                m = p1;
            }
            if (isNaN(m) || m < 1 || m > 12) m = 1;
            if (isNaN(d) || d < 1 || d > 31) d = 1;
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return clean;
};

/**
 * Downscale and compress an image file to prevent "Request Entity Too Large" errors
 * on mobile phone uploads or camera pictures while preserving high legibility for AI OCR.
 */
const compressImageFile = (file: File, maxDimension = 1000, quality = 0.8): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            
            // Check if it looks or sounds like an image, or is from direct camera (which has blank/generic types in some webviews)
            const isImageMime = file.type && file.type.startsWith('image/');
            const isGenericMime = !file.type || file.type === 'application/octet-stream' || file.type === 'image/unknown';
            const hasImageExtension = file.name && /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(file.name);
            
            if (!isImageMime && !isGenericMime && !hasImageExtension) {
                resolve({ base64, mimeType: file.type || 'application/octet-stream' });
                return;
            }

            const img = new Image();
            img.onload = () => {
                try {
                    let width = img.width;
                    let height = img.height;

                    // Downscale the image to keep the payload size optimized for the Gemini API
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
                        const fallbackMime = isImageMime ? file.type : 'image/jpeg';
                        resolve({ base64, mimeType: fallbackMime });
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Default generic or empty types to image/jpeg which has excellent compression
                    let outputType = 'image/jpeg';
                    if (file.type === 'image/png') {
                        outputType = 'image/png';
                    } else if (file.type === 'image/webp') {
                        outputType = 'image/webp';
                    }
                    
                    const compressedBase64 = canvas.toDataURL(outputType, quality);
                    
                    // Only use compressed if it's actually smaller, but always return a valid image mimeType
                    if (compressedBase64.length < base64.length) {
                        resolve({ base64: compressedBase64, mimeType: outputType });
                    } else {
                        const fallbackMime = isImageMime ? file.type : 'image/jpeg';
                        resolve({ base64, mimeType: fallbackMime });
                    }
                } catch (err) {
                    console.error("Image compression failed, using original file with fallback mime:", err);
                    const fallbackMime = isImageMime ? file.type : 'image/jpeg';
                    resolve({ base64, mimeType: fallbackMime });
                }
            };
            img.onerror = () => {
                const fallbackMime = isImageMime ? file.type : 'image/jpeg';
                resolve({ base64, mimeType: fallbackMime });
            };
            img.src = base64;
        };
        reader.onerror = () => {
            resolve({ base64: '', mimeType: 'image/jpeg' });
        };
        reader.readAsDataURL(file);
    });
};

const getMonthYear = (dateStr: string): string => {
    if (!dateStr) return 'Unknown';
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    } catch (e) {}
    
    // Fallback parser for arbitrary strings like "Apr 30, 2026", "2026-04-30" etc.
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const lower = dateStr.toLowerCase();
    let foundMonth = 'Unknown';
    for (const m of months) {
        if (lower.includes(m.toLowerCase()) || lower.includes(m.substring(0, 3).toLowerCase())) {
            foundMonth = m;
            break;
        }
    }
    const yearMatch = dateStr.match(/\b(20\d\d)\b/);
    const foundYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    return foundMonth !== 'Unknown' ? `${foundMonth} ${foundYear}` : 'Unknown';
};

/**
 * Safe, robust parser for mathematical addition, subtraction, division, and multiplication of numbers.
 * Supports formulas starting with '=' (e.g. "=10+20-5") and simple arithmetic strings (e.g. "10+20")
 * Uses a safe recursive descent parser that is 100% CSP-safe and avoids any evaluate/new Function blocks.
 */
export const evaluateFormula = (expr: string): { success: boolean; value: number } => {
    if (!expr) return { success: false, value: 0 };
    let clean = expr.trim();
    if (clean.startsWith('=')) {
        clean = clean.substring(1).trim();
    }
    // Remove spaces
    clean = clean.replace(/\s+/g, '');
    
    // Only allow safe characters: numbers, +, -, *, /, ., (, )
    if (!/^[0-9+\-*/.()]+$/.test(clean)) {
        return { success: false, value: 0 };
    }
    
    try {
        let pos = 0;
        
        const peek = () => clean[pos] || '';
        const consume = () => clean[pos++] || '';
        
        const parsePrimary = (): number => {
            const next = peek();
            if (next === '(') {
                consume(); // '('
                const val = parseExpression();
                if (consume() !== ')') {
                    throw new Error('Mismatched parenthesis');
                }
                return val;
            }
            if (next === '-' || next === '+') {
                const op = consume();
                const val = parsePrimary();
                return op === '-' ? -val : val;
            }
            
            let numStr = '';
            while (/[0-9.]/.test(peek())) {
                numStr += consume();
            }
            if (numStr === '') {
                throw new Error('Expected number');
            }
            const parsed = parseFloat(numStr);
            if (isNaN(parsed)) throw new Error('Invalid number');
            return parsed;
        };
        
        const parseMultiplicative = (): number => {
            let val = parsePrimary();
            while (true) {
                const op = peek();
                if (op === '*' || op === '/') {
                    consume();
                    const right = parsePrimary();
                    if (op === '*') {
                        val *= right;
                    } else {
                        if (right === 0) throw new Error('Division by zero');
                        val /= right;
                    }
                } else {
                    break;
                }
            }
            return val;
        };
        
        const parseExpression = (): number => {
            let val = parseMultiplicative();
            while (true) {
                const op = peek();
                if (op === '+' || op === '-') {
                    consume();
                    const right = parseMultiplicative();
                    if (op === '+') {
                        val += right;
                    } else {
                        val -= right;
                    }
                } else {
                    break;
                }
            }
            return val;
        };
        
        const result = parseExpression();
        if (pos < clean.length) {
            throw new Error('Extra characters at end');
        }
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            return { success: true, value: Number(result.toFixed(4)) };
        }
    } catch (e) {
        // Parse error
    }
    return { success: false, value: 0 };
};

interface FormulaInputProps {
    value: number;
    formula?: string;
    onChange: (numValue: number, formulaStr: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const FormulaInput = ({
    value,
    formula,
    onChange,
    placeholder,
    className,
    disabled
}: FormulaInputProps) => {
    const [isFocused, setIsFocused] = useState(false);
    const [displayVal, setDisplayVal] = useState<string>('');

    // Update displayVal when props change from outside (only if not focused)
    useEffect(() => {
        if (!isFocused) {
            if (formula) {
                setDisplayVal(formula);
            } else {
                setDisplayVal(value ? String(value) : '');
            }
        }
    }, [value, formula, isFocused]);

    const handleFocus = () => {
        if (disabled) return;
        setIsFocused(true);
        setDisplayVal(formula || (value ? String(value) : ''));
    };

    const handleBlur = () => {
        setIsFocused(false);
        const trimmed = displayVal.trim();
        let finalNum = value;
        let finalFormula = formula || '';

        if (trimmed === '') {
            finalNum = 0;
            finalFormula = '';
        } else if (trimmed.startsWith('=')) {
            const res = evaluateFormula(trimmed);
            if (res.success) {
                finalNum = res.value;
                finalFormula = trimmed;
            } else {
                // If invalid formula, fallback to 0 or clear formula representation
                finalNum = 0;
                finalFormula = '';
            }
        } else {
            // No '=' symbol. Is it a math expression (e.g. "10+20")?
            if (/[+\-*/]/.test(trimmed)) {
                const res = evaluateFormula(trimmed);
                if (res.success) {
                    finalNum = res.value;
                    finalFormula = '=' + trimmed;
                } else {
                    const parsed = parseFloat(trimmed);
                    finalNum = isNaN(parsed) ? 0 : parsed;
                    finalFormula = '';
                }
            } else {
                const parsed = parseFloat(trimmed);
                finalNum = isNaN(parsed) ? 0 : parsed;
                finalFormula = '';
            }
        }

        onChange(finalNum, finalFormula);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setDisplayVal(text);

        const trimmed = text.trim();
        if (trimmed === '') {
            onChange(0, '');
        } else if (trimmed.startsWith('=')) {
            const res = evaluateFormula(trimmed);
            if (res.success) {
                onChange(res.value, trimmed);
            }
        } else {
            if (/[+\-*/]/.test(trimmed)) {
                const res = evaluateFormula(trimmed);
                if (res.success) {
                    onChange(res.value, '=' + trimmed);
                }
            } else {
                const parsed = parseFloat(trimmed);
                if (!isNaN(parsed)) {
                    onChange(parsed, '');
                }
            }
        }
    };

    const displayOnBlur = !isFocused ? (value !== undefined && value !== null ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 }).replace(/,/g, '') : '') : displayVal;

    return (
        <div className="relative group w-full">
            <input
                type="text"
                disabled={disabled}
                value={isFocused ? displayVal : displayOnBlur}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={className}
            />
            {formula && !isFocused && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-60 group-hover:opacity-100 pointer-events-none transition-opacity">
                    <span className="text-[9px] px-1 py-0.5 bg-slate-200/60 text-slate-650 font-mono rounded font-black cursor-help" title={formula}>
                        fx
                    </span>
                </div>
            )}
        </div>
    );
};

interface DataTableProps<T> {
    title: string;
    description: string;
    icon: React.ElementType;
    data: T[];
    columns: {
        key: keyof T | string;
        label: string;
        render?: (item: T, index: number) => React.ReactNode;
        exportText?: (item: T, index: number) => string | number;
        sortable?: boolean;
    }[];
    onAdd?: () => void;
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    onViewBill?: (item: T) => void;
    onDownloadStatement?: (item: T) => void;
    onViewDetails?: (item: T) => void;
    searchPlaceholder?: string;
    searchFields: (keyof T)[];
    exportFileName: string;
    user: SystemUser;
    filterOptions?: {
        key: keyof T | string;
        label: string;
        options: { label: string; value: string }[];
    }[];
    onUploadExcel?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onUploadClick?: () => void;
    onDownloadZip?: () => void;
    onBulkDownloadZip?: (items: T[]) => void;
    isZipDownloading?: boolean;
    zipProgressText?: string;
    customSearch?: (item: T, query: string) => boolean;
    enableMultiSelect?: boolean;
    onBulkDelete?: (items: T[]) => void | Promise<void>;
    onBulkUpdateDate?: (items: T[], newDate: string) => void | Promise<void>;
    onBulkUpdateNotes?: (items: T[], newNotes: string) => void | Promise<void>;
    onBulkUpdateCompanyId?: (items: T[], companyId: string) => void | Promise<void>;
    onBulkUpdatePaid?: (items: T[], paymentDate: string) => void | Promise<void>;
    companies?: any[];
    renderFooter?: (filteredData: T[]) => React.ReactNode;
    statsSection?: React.ReactNode;
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
    onDownloadStatement,
    onViewDetails,
    searchPlaceholder = "Search...",
    searchFields,
    exportFileName,
    user,
    filterOptions = [],
    onUploadExcel,
    onUploadClick,
    onDownloadZip,
    onBulkDownloadZip,
    isZipDownloading,
    zipProgressText,
    customSearch,
    enableMultiSelect,
    onBulkDelete,
    onBulkUpdateDate,
    onBulkUpdateNotes,
    onBulkUpdateCompanyId,
    onBulkUpdatePaid,
    companies,
    renderFooter,
    statsSection
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [bulkTargetDate, setBulkTargetDate] = useState('');
    const [bulkTargetNotes, setBulkTargetNotes] = useState('');
    const [bulkTargetCompanyId, setBulkTargetCompanyId] = useState('');
    const [bulkTargetPaymentDate, setBulkTargetPaymentDate] = useState('');

    const userRoleLower = (user?.role || '').toLowerCase();
    const isAdmin = userRoleLower.includes('admin') || userRoleLower.includes('creator') || userRoleLower.includes('super') || userRoleLower.includes('accountant') || userRoleLower.includes('finance') || user?.email === 'abdulkaderp3010@gmail.com' || !!user?.permissions?.canManageFinance;

    useEffect(() => {
        if (selectedIds.length > 0) {
            setSelectedIds(prev => prev.filter(id => data.some(item => item.id === id)));
        }
    }, [data]);

    const filteredData = useMemo(() => {
        let result = [...data];

        // Search
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            result = result.filter(item => {
                const matchesFields = searchFields.some(field => {
                    const value = item[field];
                    return value && String(value).toLowerCase().includes(query);
                });
                if (matchesFields) return true;
                if (customSearch) return customSearch(item, query);
                return false;
            });
        }

        // Filters
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (value) {
                result = result.filter(item => {
                    const itemValue = (item as any)[key];
                    if (key === 'status') {
                        const computedStatus = itemValue === 'Inactive' ? 'Inactive' : 'Active';
                        return computedStatus === value;
                    }
                    return String(itemValue) === value;
                });
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

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(50);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilters, sortConfig, data.length]);

    const totalPages = useMemo(() => {
        if (pageSize === 0) return 1;
        return Math.max(1, Math.ceil(filteredData.length / pageSize));
    }, [filteredData.length, pageSize]);

    const paginatedData = useMemo(() => {
        if (pageSize === 0) return filteredData;
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    const isAllSelected = useMemo(() => {
        return filteredData.length > 0 && filteredData.every(item => selectedIds.includes(item.id));
    }, [filteredData, selectedIds]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleExport = () => {
        const exportData = filteredData.map((item, index) => {
            const row: any = {};
            columns.forEach(col => {
                if (typeof col.key === 'string') {
                    if (col.exportText) {
                        row[col.label] = col.exportText(item, index);
                    } else {
                        row[col.label] = (item as any)[col.key];
                    }
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

        const currencyColumns = ['amount', 'actualAmount', 'vatAmount', 'totalAmount', 'advance', 'deduction', 'paid', 'payableAmount'];
        
        // Sum totals for the bottom of print ledger
        const totalSums: any = {};
        const sumKeys = ['amount', 'actualAmount', 'vatAmount', 'totalAmount', 'advance', 'deduction', 'paid', 'payableAmount', 'hours'];
        sumKeys.forEach(key => {
            totalSums[key] = filteredData.reduce((sum, item) => {
                let val = (item as any)[key];
                if (key === 'totalAmount' && val === undefined) {
                    const actual = (item as any).actualAmount !== undefined ? (item as any).actualAmount : (((item as any).amount || 0) - ((item as any).deduction || 0));
                    const vat = (item as any).vatAmount !== undefined ? (item as any).vatAmount : Number((actual * 0.05).toFixed(2));
                    val = Number((actual + vat).toFixed(2));
                } else if (key === 'payableAmount' && val === undefined) {
                    const actual = (item as any).actualAmount !== undefined ? (item as any).actualAmount : (((item as any).amount || 0) - ((item as any).deduction || 0));
                    const vat = (item as any).vatAmount !== undefined ? (item as any).vatAmount : Number((actual * 0.05).toFixed(2));
                    const total = Number((actual + vat).toFixed(2));
                    const advance = (item as any).advance || 0;
                    const paid = (item as any).paid || 0;
                    val = Number((total - paid - advance).toFixed(2));
                } else if (key === 'actualAmount' && val === undefined) {
                    val = ((item as any).amount || 0) - ((item as any).deduction || 0);
                }
                const n = Number(val || 0);
                return sum + (isNaN(n) ? 0 : n);
            }, 0);
        });

        // Robust, well-organized helper to build clean widths and alignments for elements
        const getColumnStyle = (key: string, forHeader = false) => {
            const isCurrency = currencyColumns.includes(key);
            const isNumberCol = isCurrency || key === 'hours';
            
            let align = 'left';
            if (isNumberCol) {
                align = 'right';
            } else if (key === 'srNo' || key === 'supplierCode') {
                align = 'center';
            }
            
            let widthStyle = '';
            if (key === 'srNo') {
                widthStyle = 'width: 45px; min-width: 45px; max-width: 45px;';
            } else if (key === 'supplierName') {
                widthStyle = 'width: 180px; min-width: 180px; max-width: 180px; word-break: break-word; white-space: normal;';
            } else if (key === 'supplierCode') {
                widthStyle = 'width: 60px; min-width: 60px; max-width: 60px;';
            } else if (key === 'invoiceNumber') {
                widthStyle = 'width: 80px; min-width: 80px;';
            } else if (key === 'date') {
                widthStyle = 'width: 80px; min-width: 80px;';
            } else if (key === 'hours') {
                widthStyle = 'width: 50px; min-width: 50px;';
            } else if (isCurrency) {
                widthStyle = 'width: 95px; min-width: 95px;';
            } else if (key === 'paymentDate' || key === 'clearDate') {
                widthStyle = 'width: 85px; min-width: 85px;';
            } else if (key === 'description' || key === 'notes') {
                widthStyle = 'width: 200px; min-width: 200px; max-width: 200px; word-break: break-word; white-space: normal;';
            }
            
            let extraStyles = '';
            if (!forHeader) {
                if (key === 'paid') {
                    extraStyles = 'color: #16a34a; font-weight: bold; font-family: monospace;';
                } else if (key === 'deduction') {
                    extraStyles = 'color: #dc2626; font-weight: bold; font-family: monospace;';
                } else if (key === 'payableAmount') {
                    extraStyles = 'color: #1d4ed8; font-weight: 800; background-color: #f0f7ff; font-family: monospace;';
                } else if (isCurrency || key === 'hours') {
                    extraStyles = 'font-family: monospace; font-weight: 600;';
                } else if (key === 'srNo') {
                    extraStyles = 'font-family: monospace; font-weight: bold; color: #475569;';
                } else if (key === 'status') {
                    extraStyles = 'font-weight: bold;';
                }
            }
            
            return `text-align: ${align}; ${widthStyle} ${extraStyles}`;
        };

        const html = `
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { 
                            size: ${options.orientation}; 
                            margin: ${options.margins === 'none' ? '0' : options.margins === 'minimum' ? '5mm' : '15mm'}; 
                        }
                        body { 
                            font-family: system-ui, -apple-system, sans-serif; 
                            color: #000000; 
                            background-color: #ffffff;
                            margin: 10px;
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
                        h1 { text-align: left; color: #000000; margin-bottom: 4px; font-weight: 800; font-size: 26px; font-family: sans-serif; }
                        p { text-align: left; color: #334155; margin-top: 0; margin-bottom: 24px; font-size: 13px; font-weight: 600; font-family: sans-serif; border-bottom: 2px solid #475569; padding-bottom: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                        th { background-color: #f1f5f9; color: #000000; border: 1.5px solid #475569; padding: 10px 8px; font-weight: 900; text-transform: uppercase; font-size: 11px; }
                        td { border: 1px solid #64748b; padding: 10px 8px; font-size: 11.5px; line-height: 1.4; color: #000000; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p>${description}</p>
                    <table>
                        <thead>
                            <tr>
                                ${columns.map(col => {
                                    const colKey = String(col.key);
                                    const colStyle = getColumnStyle(colKey, true);
                                    return `<th style="${colStyle}">${col.label}</th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredData.map((item, itemIdx) => `
                                <tr>
                                    ${columns.map(col => {
                                        const colKey = String(col.key);
                                        const isCurrency = currencyColumns.includes(colKey);
                                        
                                        let val: any = '';
                                        if (colKey === 'srNo' || String(col.label).toLowerCase().includes('sr')) {
                                            val = itemIdx + 1;
                                        } else if (col.exportText) {
                                            val = col.exportText(item, itemIdx);
                                        } else {
                                            val = (item as any)[colKey];
                                        }

                                        let formattedVal = '';
                                        if (colKey === 'srNo' || String(col.label).toLowerCase().includes('sr')) {
                                            formattedVal = String(itemIdx + 1);
                                        } else if (val === undefined || val === null || val === '') {
                                            formattedVal = '-';
                                        } else if (typeof val === 'number') {
                                            if (isCurrency) {
                                                formattedVal = 'AED ' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            } else {
                                                formattedVal = val.toLocaleString();
                                            }
                                        } else {
                                            formattedVal = String(val);
                                        }

                                        const colStyle = getColumnStyle(colKey, false);
                                        let tdStyle = `border: 1px solid #64748b; ${colStyle}`;
                                        if (!isCurrency && colKey !== 'hours' && colKey !== 'srNo') {
                                            tdStyle += ' font-family: system-ui, sans-serif;';
                                        }

                                        if (colKey === 'status') {
                                            const statusStr = String(val).toLowerCase();
                                            const isReceivedOrPaid = statusStr.includes('received') || statusStr.includes('paid');
                                            const isPending = statusStr.includes('pending');
                                            if (isReceivedOrPaid) {
                                                tdStyle += ' color: #15803d; font-weight: bold; background-color: #f0fdf4;';
                                            } else if (isPending) {
                                                tdStyle += ' color: #c2410c; font-weight: bold; background-color: #fff7ed;';
                                            }
                                        }

                                        return `<td style="${tdStyle}">${formattedVal}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                            
                            <!-- Professional Styled Grand Totals Row -->
                            <tr style="background-color: #e2e8f0; font-weight: bold; border-top: 2.5px solid #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                ${columns.map((col, idx) => {
                                    const colKey = String(col.key);
                                    const colStyle = getColumnStyle(colKey, false);
                                    
                                    if (idx === 0) {
                                        return `<td style="font-size: 11.5px; padding: 10px 8px; border: 1.5px solid #475569; font-family: system-ui, sans-serif; font-weight: 900; text-transform: uppercase; text-align: center; color: #000000;">TOTALS</td>`;
                                    }
                                    if (sumKeys.includes(colKey)) {
                                        const val = totalSums[colKey] || 0;
                                        const isCurrencyCol = currencyColumns.includes(colKey);
                                        const formattedVal = !isCurrencyCol 
                                            ? val.toLocaleString() 
                                            : 'AED ' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        
                                        return `<td style="font-size: 11.5px; padding: 10px 8px; border: 1.5px solid #475569; font-weight: 900; color: #000000; ${colStyle}">${formattedVal}</td>`;
                                    }
                                    return `<td style="font-size: 11.5px; padding: 10px 8px; border: 1.5px solid #475569; font-family: system-ui, sans-serif; text-align: left; font-weight: bold; color: #000000; ${colStyle}">-</td>`;
                                }).join('')}
                            </tr>
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
                    {onDownloadZip && (
                        <button 
                            onClick={onDownloadZip}
                            disabled={isZipDownloading}
                            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            title="Download ZIP package containing all receipt photos, PDF bills & summary CSV"
                        >
                            <FileArchive className="w-4 h-4 animate-bounce" />
                            <span>{isZipDownloading ? (zipProgressText || 'Packaging ZIP...') : 'Download Bills ZIP'}</span>
                        </button>
                    )}
                    {onUploadClick ? (
                        <button 
                            onClick={onUploadClick}
                            className="flex items-center gap-2 px-5 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-sm whitespace-nowrap"
                        >
                            <Upload className="w-4 h-4 text-indigo-600" />
                            Upload Excel
                        </button>
                    ) : onUploadExcel ? (
                        <label className="flex items-center gap-2 px-5 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-sm cursor-pointer whitespace-nowrap">
                            <Upload className="w-4 h-4 text-indigo-600" />
                            <span>Upload Excel</span>
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                onChange={onUploadExcel}
                            />
                        </label>
                    ) : null}
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

            {statsSection && (
                <div className="mb-6">
                    {statsSection}
                </div>
            )}

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

                <AnimatePresence>
                    {enableMultiSelect && isAdmin && selectedIds.length > 0 && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-6 py-5 bg-indigo-50/60 border-b border-indigo-100 flex flex-col gap-4 overflow-hidden animate-fadeIn"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 shadow-sm border border-indigo-200">
                                        <FileSpreadsheet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-slate-900 block">
                                            Bulk Action Panel <span className="bg-brand-600 font-bold text-[10px] text-white px-2 py-0.5 rounded-full ml-1.5 inline-block">Selected: {selectedIds.length}</span>
                                        </span>
                                        <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                                            Choose to bulk update the invoice posting date / month, or perform double-confirmed deletion.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedIds([]);
                                            setBulkTargetDate('');
                                            setBulkTargetPaymentDate('');
                                        }}
                                        className="px-4 py-2 hover:bg-slate-200/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer bg-white"
                                    >
                                        Cancel Selection
                                    </button>
                                    {onBulkDownloadZip && (
                                        <button
                                            onClick={() => {
                                                const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                onBulkDownloadZip(selectedItems);
                                            }}
                                            disabled={isZipDownloading}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                        >
                                            <FileArchive className="w-4 h-4" />
                                            <span>Download Selected Bills (ZIP)</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (onBulkDelete) {
                                                const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                onBulkDelete(selectedItems);
                                                setSelectedIds([]);
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Selected
                                    </button>
                                </div>
                            </div>

                            {onBulkUpdateDate && (
                                <div className="p-4 bg-white/75 border border-indigo-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-indigo-950 font-black flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-indigo-600" />
                                            Bulk Update Posting Date / Month
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="date"
                                                value={bulkTargetDate}
                                                onChange={e => setBulkTargetDate(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-700"
                                            />
                                            <span className="text-[11px] text-slate-400 font-medium">or</span>
                                            <select
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val) {
                                                        // Default to first day of that month
                                                        setBulkTargetDate(`${val}-01`);
                                                    }
                                                }}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-705"
                                                value={bulkTargetDate ? bulkTargetDate.substring(0, 7) : ''}
                                            >
                                                <option value="">-- Quick Month Selector --</option>
                                                {Array.from({ length: 12 }, (_, i) => {
                                                    const d = new Date();
                                                    d.setMonth(d.getMonth() - i);
                                                    const mKey = d.toISOString().substring(0, 7);
                                                    const mLabel = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                                    return <option key={mKey} value={mKey}>{mLabel}</option>;
                                                })}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!bulkTargetDate) {
                                                    alert("Please select or type a new posting date.");
                                                    return;
                                                }
                                                const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                onBulkUpdateDate(selectedItems, bulkTargetDate);
                                                setSelectedIds([]);
                                                setBulkTargetDate('');
                                            }}
                                            className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer active:scale-95"
                                        >
                                            Apply Date to Selected
                                        </button>
                                    </div>
                                </div>
                            )}

                            {onBulkUpdateNotes && (
                                <div className="p-4 bg-white/75 border border-indigo-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-indigo-950 font-black flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-indigo-600" />
                                            Bulk Update Notes / Remarks
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 max-w-sm flex-1">
                                            <input 
                                                type="text"
                                                placeholder="Type bulk notes / remarks..."
                                                value={bulkTargetNotes}
                                                onChange={e => setBulkTargetNotes(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-705 w-60"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    const trimmed = bulkTargetNotes.trim();
                                                    if (!trimmed) {
                                                        alert("Please enter some text for notes / remarks.");
                                                        return;
                                                    }
                                                    const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                    onBulkUpdateNotes(selectedItems, trimmed);
                                                    setSelectedIds([]);
                                                    setBulkTargetNotes('');
                                                }}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer active:scale-95"
                                            >
                                                Update Notes
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                    onBulkUpdateNotes(selectedItems, '');
                                                    setSelectedIds([]);
                                                    setBulkTargetNotes('');
                                                }}
                                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                                            >
                                                Clear Notes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {onBulkUpdateCompanyId && companies && (
                                <div className="p-4 bg-white/75 border border-indigo-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-indigo-950 font-black flex items-center gap-1.5 font-sans">
                                            <Building className="w-4 h-4 text-indigo-650" />
                                            Bulk Update Buying Corporate Identity
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={bulkTargetCompanyId}
                                                onChange={e => setBulkTargetCompanyId(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-sans outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-705 min-w-[200px]"
                                            >
                                                <option value="">-- Select Corporate Identity --</option>
                                                {(companies || []).map((c: any) => (
                                                    <option key={c.id} value={c.id}>üè¢ {c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!bulkTargetCompanyId) {
                                                    alert("Please select a buying corporate identity.");
                                                    return;
                                                }
                                                const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                onBulkUpdateCompanyId(selectedItems, bulkTargetCompanyId);
                                                setSelectedIds([]);
                                                setBulkTargetCompanyId('');
                                            }}
                                            className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer active:scale-95"
                                        >
                                            Apply Corporate Identity to Selected
                                        </button>
                                    </div>
                                </div>
                            )}

                            {onBulkUpdatePaid && (
                                <div className="p-4 bg-white/75 border border-indigo-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-indigo-950 font-black flex items-center gap-1.5 font-sans">
                                            <Wallet className="w-4 h-4 text-emerald-600" />
                                            Bulk Update Paid Status (Mark as Fully Paid)
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500">Payment Date:</span>
                                            <input 
                                                type="date"
                                                value={bulkTargetPaymentDate}
                                                onChange={e => setBulkTargetPaymentDate(e.target.value)}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-705"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const selectedItems = data.filter(item => selectedIds.includes(item.id));
                                                onBulkUpdatePaid(selectedItems, bulkTargetPaymentDate || new Date().toISOString().split('T')[0]);
                                                setSelectedIds([]);
                                                setBulkTargetPaymentDate('');
                                            }}
                                            className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/10 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                                        >
                                            <Check className="w-4 h-4" />
                                            Mark as Fully Paid
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                {enableMultiSelect && isAdmin && (
                                    <th className="px-6 py-4 text-left w-12 border-b border-slate-100">
                                        <input 
                                            type="checkbox"
                                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                                            checked={isAllSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(prev => {
                                                        const newIds = [...prev];
                                                        filteredData.forEach(item => {
                                                            if (!newIds.includes(item.id)) {
                                                                newIds.push(item.id);
                                                            }
                                                        });
                                                        return newIds;
                                                    });
                                                } else {
                                                    setSelectedIds(prev => prev.filter(id => !filteredData.some(fd => fd.id === id)));
                                                }
                                            }}
                                        />
                                    </th>
                                )}
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
                                {(onEdit || onDelete || onViewBill || onDownloadStatement || onViewDetails) && (
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedData.map((item, index) => {
                                const rowIndex = pageSize === 0 ? index : (currentPage - 1) * pageSize + index;
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                        {enableMultiSelect && isAdmin && (
                                            <td className="px-6 py-5 text-left w-12 text-sm font-bold text-slate-600">
                                                <input 
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                                                    checked={selectedIds.includes(item.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedIds(prev => [...prev, item.id]);
                                                        } else {
                                                            setSelectedIds(prev => prev.filter(id => id !== item.id));
                                                        }
                                                    }}
                                                />
                                            </td>
                                        )}
                                        {columns.map((col) => (
                                            <td key={String(col.key)} className="px-6 py-5 text-sm font-bold text-slate-600">
                                                {col.render ? col.render(item, rowIndex) : String((item as any)[col.key] || '-')}
                                            </td>
                                        ))}
                                        {(onEdit || onDelete || onViewBill || onDownloadStatement || onViewDetails) && (
                                            <td className="px-6 py-5 text-right font-mono text-sm leading-none shrink-0">
                                                <div className="flex items-center justify-end gap-1.5 transition-opacity">
                                                    {onViewDetails && (
                                                        <button 
                                                            onClick={() => onViewDetails(item)}
                                                            className="p-1.5 hover:bg-white rounded-lg text-slate-450 hover:text-indigo-600 transition-all shadow-2xs border border-transparent hover:border-slate-100 cursor-pointer"
                                                            title="View All Details"
                                                        >
                                                            <Eye className="w-4.5 h-4.5" />
                                                        </button>
                                                    )}
                                                    {onDownloadStatement && (
                                                        <button 
                                                            onClick={() => onDownloadStatement(item)}
                                                            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-brand-600 transition-all shadow-sm border border-transparent hover:border-slate-100 cursor-pointer"
                                                            title="Download Statement"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {onViewBill && (item as any).attachment && (
                                                        <button 
                                                            onClick={() => onViewBill(item)}
                                                            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-brand-600 transition-all shadow-sm border border-transparent hover:border-slate-100"
                                                            title="View Attached Invoice Document"
                                                        >
                                                            <Paperclip className="w-4 h-4" />
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
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + (onEdit || onDelete || onViewBill || onDownloadStatement || onViewDetails ? 1 : 0) + (enableMultiSelect && isAdmin ? 1 : 0)} className="px-6 py-20 text-center">
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
                        {renderFooter && filteredData.length > 0 && (
                            <tfoot className="border-t-2 border-slate-200 bg-slate-50/95 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.03)] font-semibold text-slate-900">
                                {renderFooter(filteredData)}
                            </tfoot>
                        )}
                    </table>
                </div>

                {filteredData.length > 0 && (
                    <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                        <div className="flex flex-wrap items-center gap-3">
                            <span>
                                Showing <strong className="text-slate-900 font-extrabold">{pageSize === 0 ? 1 : Math.min((currentPage - 1) * pageSize + 1, filteredData.length)}</strong> to <strong className="text-slate-900 font-extrabold">{pageSize === 0 ? filteredData.length : Math.min(currentPage * pageSize, filteredData.length)}</strong> of <strong className="text-slate-900 font-black">{filteredData.length}</strong> records
                            </span>
                            <div className="flex items-center gap-1.5 ml-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                    <option value={0}>All</option>
                                </select>
                            </div>
                        </div>

                        {pageSize !== 0 && totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-slate-600 font-mono font-extrabold">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <PrintModal 
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                onPrint={handlePrintWithConfig}
                title={`Print ${title}`}
                defaultOrientation={columns.length > 6 ? "landscape" : "portrait"}
            />
        </div>
    );
}

// --- Specific Views ---

export const VendorView = ({ vendors, onAdd, onEdit, onDelete, user }: any) => {
    const activeCount = vendors.filter((v: any) => v.status !== 'Inactive').length;
    const inactiveCount = vendors.filter((v: any) => v.status === 'Inactive').length;
    const totalCount = vendors.length;

    const statsSection = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                <div className="p-4 bg-brand-50 text-brand-600 rounded-2xl">
                    <Truck className="w-6 h-6" />
                </div>
                <div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Total Clients</span>
                    <span className="text-3xl font-black text-slate-900 leading-none">{totalCount}</span>
                </div>
            </div>
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 animate-pulse flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                </div>
                <div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Active Clients</span>
                    <span className="text-3xl font-black text-slate-900 leading-none">{activeCount}</span>
                </div>
            </div>
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                <div className="p-4 bg-slate-50 text-slate-500 rounded-2xl">
                    <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    </div>
                </div>
                <div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Inactive Clients</span>
                    <span className="text-3xl font-black text-slate-900 leading-none">{inactiveCount}</span>
                </div>
            </div>
        </div>
    );

    return (
        <DataTable<Vendor>
            title="Clients"
            description="Manage your third-party service providers and material clients."
            icon={Truck}
            data={vendors}
            statsSection={statsSection}
            filterOptions={[
                {
                    key: 'status',
                    label: 'Status',
                    options: [
                        { label: 'All Statuses', value: '' },
                        { label: 'Active', value: 'Active' },
                        { label: 'Inactive', value: 'Inactive' }
                    ]
                }
            ]}
            columns={[
                { key: 'code', label: 'Code', sortable: true },
                { key: 'name', label: 'Client Name', sortable: true },
                { key: 'contactPerson', label: 'Contact Person' },
                { key: 'trn', label: 'TRN (VAT)', render: (item) => <span className="font-mono text-slate-600 font-extrabold">{item.trn || '-'}</span> },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'category', label: 'Category', sortable: true },
                { 
                    key: 'status', 
                    label: 'Status', 
                    sortable: true,
                    render: (item) => {
                        const isActive = item.status !== 'Inactive';
                        return (
                            <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 border",
                                isActive 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        );
                    }
                },
                {
                    key: 'driveFiles',
                    label: 'Documents (LPO/Agreements)',
                    render: (item) => {
                        const count = item.driveFiles?.length || 0;
                        if (count === 0) return <span className="text-slate-400 font-normal">None</span>;
                        return (
                            <div className="flex flex-col gap-1 max-w-[220px]">
                                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider inline-block w-fit">
                                    üìÇ {count} Doc{count > 1 ? 's' : ''}
                                </span>
                                <div className="flex flex-col gap-1 mt-1">
                                    {item.driveFiles?.slice(0, 2).map((f: any) => (
                                        <a
                                            key={f.id}
                                            href={f.webViewLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-brand-600 hover:text-brand-700 hover:underline truncate block font-bold flex items-center gap-1"
                                            title={f.name}
                                        >
                                            üìÑ <span className="truncate max-w-[170px]">{f.name}</span>
                                        </a>
                                    ))}
                                    {count > 2 && <span className="text-[10px] text-slate-400 font-bold">+{count - 2} more</span>}
                                </div>
                            </div>
                        );
                    }
                }
            ]}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            searchFields={['name', 'code', 'contactPerson', 'email', 'trn']}
            exportFileName="Vendors_List"
            user={user}
        />
    );
};

export const AccountsPayableView = ({ data, vendors, suppliers, projects, onAdd, onEdit, onDelete, onDeleteMultiple, onDeleteBatch, onBulkUpdateDate, onBulkUpdateNotes, onBulkUpdateCompanyId, onBulkUpdatePaid, user, companies, onUploadExcel, bankAccounts = [] }: any) => {
    const [activeTabMode, setActiveTabMode] = useState<'ledger' | 'insights' | 'soa' | 'duplicates'>('ledger');
    const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null);
    const [viewingBill, setViewingBill] = useState<string | null>(null);
    const [viewingRecordDetail, setViewingRecordDetail] = useState<AccountsPayable | null>(null);
    const [kpiFilter, setKpiFilter] = useState<'all' | 'paid' | 'pending' | 'vat' | null>(null);

    // Advanced Filter State variables
    const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterInvoiceDoc, setFilterInvoiceDoc] = useState('All');
    const [filterVendor, setFilterVendor] = useState('All');
    const [filterProject, setFilterProject] = useState('All');
    const [filterMonth, setFilterMonth] = useState('All');
    const [filterCompany, setFilterCompany] = useState('All');

    // Date policy / Quick Filter stats
    const [dateFilterMode, setDateFilterMode] = useState<'all' | 'current-month' | 'last-month' | 'month-wise' | 'year-wise' | 'custom-range'>('all');
    const [selectedYearValue, setSelectedYearValue] = useState(new Date().getFullYear().toString());
    const [selectedMonthValue, setSelectedMonthValue] = useState('');
    const [customRangeStart, setCustomRangeStart] = useState('');
    const [customRangeEnd, setCustomRangeEnd] = useState('');

    // SOA Tool state variables
    const [soaVendorId, setSoaVendorId] = useState('All');
    const [soaProjectId, setSoaProjectId] = useState('All');
    const [soaStartDate, setSoaStartDate] = useState('');
    const [soaEndDate, setSoaEndDate] = useState('');
    const [soaScope, setSoaScope] = useState<'All' | 'Paid' | 'Pending' | 'Pending_NoCheque' | 'Pending_Cheque'>('All');
    const [soaCompanyId, setSoaCompanyId] = useState('All');
    const [soaIncludeDetails, setSoaIncludeDetails] = useState(false);
    const [soaIncludeCreditNotes, setSoaIncludeCreditNotes] = useState(true);
    const [soaNotes, setSoaNotes] = useState("All invoices submitted as per the site provided time sheet and records.");
    const [showMonthlyAuditBreakdown, setShowMonthlyAuditBreakdown] = useState(false);
    const [expandedMonthDetails, setExpandedMonthDetails] = useState<string | null>(null);
    const [soaPdfModalOpen, setSoaPdfModalOpen] = useState(false);
    const [soaPdfOrientation, setSoaPdfOrientation] = useState<'landscape' | 'portrait'>('portrait');

    const handleGoToInvoice = (vendorId: string, monthKey: string) => {
        setActiveTabMode('ledger');
        setFilterVendor(vendorId);
        setFilterMonth(monthKey);
        setDateFilterMode('all');
        setTimeout(() => {
            const element = document.getElementById('accounts-payable-ledger-section');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

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
                label: `üåü ${name} (All Consolidated Projects) (Supplier)`
            });
        });

        // Add unified group options for vendors
        Object.entries(vendorGroups).forEach(([name]) => {
            options.push({
                value: `BY_NAME:${name}`,
                label: `üåü ${name} (All Consolidated Projects) (Client)`
            });
        });

        // Add individual supplier options
        (suppliers || []).forEach((s: any) => {
            options.push({
                value: s.id,
                label: `üìÑ ${s.name} (Code: ${s.code || 'N/A'}) (Supplier)`
            });
        });

        // Add individual vendor options
        (vendors || []).forEach((v: any) => {
            options.push({
                value: v.id,
                label: `üìÑ ${v.name} (Code: ${v.code || 'N/A'}) (Client)`
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
        const today = new Date();
        const curYear = today.getFullYear();
        const curMonthNum = String(today.getMonth() + 1).padStart(2, '0');
        const curMonthStr = `${curYear}-${curMonthNum}`;

        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lmYear = lastMonthDate.getFullYear();
        const lmMonthNum = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
        const lastMonthStr = `${lmYear}-${lmMonthNum}`;

        return (data || []).filter((item: any) => {
            // Check Date Policy Mode
            if (item.date) {
                if (dateFilterMode === 'current-month') {
                    if (item.date.substring(0, 7) !== curMonthStr) return false;
                } else if (dateFilterMode === 'last-month') {
                    if (item.date.substring(0, 7) !== lastMonthStr) return false;
                } else if (dateFilterMode === 'month-wise') {
                    if (selectedMonthValue && item.date.substring(0, 7) !== selectedMonthValue) return false;
                } else if (dateFilterMode === 'year-wise') {
                    if (selectedYearValue && item.date.substring(0, 4) !== selectedYearValue) return false;
                } else if (dateFilterMode === 'custom-range') {
                    if (customRangeStart && item.date < customRangeStart) return false;
                    if (customRangeEnd && item.date > customRangeEnd) return false;
                }
            }

            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;

            const amount = item.totalAmount || item.amount || 0;
            if (minAmount !== '' && amount < Number(minAmount)) return false;
            if (maxAmount !== '' && amount > Number(maxAmount)) return false;

            if (filterStatus !== 'All' && item.status !== filterStatus) return false;
            
            if (filterInvoiceDoc !== 'All') {
                const docStatus = item.invoiceReceivedStatus || (item.attachment ? 'Received' : 'Waiting');
                if (docStatus !== filterInvoiceDoc) return false;
            }

            if (filterProject !== 'All' && item.projectId !== filterProject) return false;
            
            if (filterVendor !== 'All') {
                if (item.vendorId !== filterVendor) return false;
            }

            if (filterMonth !== 'All') {
                const m = item.date.substring(0, 7);
                if (m !== filterMonth) return false;
            }

            if (filterCompany !== 'All' && item.companyId !== filterCompany) return false;

            return true;
        });
    }, [data, startDate, endDate, minAmount, maxAmount, filterStatus, filterInvoiceDoc, filterVendor, filterProject, filterMonth, filterCompany, dateFilterMode, selectedYearValue, selectedMonthValue, customRangeStart, customRangeEnd]);

    const ledgerFilteredData = useMemo(() => {
        if (!kpiFilter || kpiFilter === 'all') return filteredData;
        return (filteredData || []).filter((item: any) => {
            if (kpiFilter === 'paid') {
                return item.status === 'Paid';
            }
            if (kpiFilter === 'pending') {
                return item.status !== 'Paid';
            }
            if (kpiFilter === 'vat') {
                return (item.vatAmount || 0) > 0;
            }
            return true;
        });
    }, [filteredData, kpiFilter]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (dateFilterMode !== 'all') count++;
        if (startDate) count++;
        if (endDate) count++;
        if (minAmount !== '') count++;
        if (maxAmount !== '') count++;
        if (filterStatus !== 'All') count++;
        if (filterInvoiceDoc !== 'All') count++;
        if (filterVendor !== 'All') count++;
        if (filterProject !== 'All') count++;
        if (filterMonth !== 'All') count++;
        if (filterCompany !== 'All') count++;
        if (kpiFilter && kpiFilter !== 'all') count++;
        return count;
    }, [startDate, endDate, minAmount, maxAmount, filterStatus, filterInvoiceDoc, filterVendor, filterProject, filterMonth, filterCompany, dateFilterMode, kpiFilter]);

    const handleClearAdvFilters = () => {
        setStartDate('');
        setEndDate('');
        setMinAmount('');
        setMaxAmount('');
        setFilterStatus('All');
        setFilterInvoiceDoc('All');
        setFilterVendor('All');
        setFilterProject('All');
        setFilterMonth('All');
        setFilterCompany('All');
        setDateFilterMode('all');
        setSelectedYearValue(new Date().getFullYear().toString());
        setSelectedMonthValue('');
        setCustomRangeStart('');
        setCustomRangeEnd('');
        setKpiFilter(null);
    };

    // Calculate dynamic high-level metrics based on filtered data to stay in sync
    const metrics = useMemo(() => {
        let totalBills = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let totalVat = 0;
        let receivedInvoiceCount = 0;
        let receivedInvoiceAmount = 0;
        let waitingInvoiceCount = 0;
        let waitingInvoiceAmount = 0;

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

            const docStatus = item.invoiceReceivedStatus || (item.attachment ? 'Received' : 'Waiting');
            if (docStatus === 'Received') {
                receivedInvoiceCount += 1;
                receivedInvoiceAmount += amount;
            } else {
                waitingInvoiceCount += 1;
                waitingInvoiceAmount += amount;
            }
        });

        return {
            totalBills,
            totalPaid,
            totalPending,
            totalVat,
            receivedInvoiceCount,
            receivedInvoiceAmount,
            waitingInvoiceCount,
            waitingInvoiceAmount,
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

    const userRoleLower = (user?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || user?.email === 'abdulkaderp3010@gmail.com';

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

    const monthlyAuditBreakdown = useMemo(() => {
        const monthsData: { 
            [monthKey: string]: { 
                label: string; 
                suppliers: Set<string>; 
                updatedCount: number; 
                updatedAmount: number; 
                pendingCount: number; 
                pendingAmount: number;
                totalCount: number;
                totalAmount: number;
                supplierStats: {
                    [supplierId: string]: {
                        id: string;
                        name: string;
                        totalCount: number;
                        updatedCount: number;
                        pendingCount: number;
                        totalAmount: number;
                        pendingAmount: number;
                        paidCount: number;
                        unpaidCount: number;
                    };
                };
            };
        } = {};

        (filteredData || []).forEach((item: any) => {
            const dateStr = item.date;
            if (!dateStr) return;
            const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
            if (!monthsData[monthKey]) {
                const [yr, mn] = monthKey.split('-');
                const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
                const humanLabel = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
                monthsData[monthKey] = {
                    label: humanLabel,
                    suppliers: new Set<string>(),
                    updatedCount: 0,
                    updatedAmount: 0,
                    pendingCount: 0,
                    pendingAmount: 0,
                    totalCount: 0,
                    totalAmount: 0,
                    supplierStats: {},
                };
            }
            
            const amount = item.totalAmount || item.amount || 0;
            const entry = monthsData[monthKey];
            const isUpdated = (item.invoiceReceivedStatus || (item.attachment ? 'Received' : 'Waiting')) === 'Received';
            const isPaid = item.status === 'Paid';
            
            if (item.vendorId && (item.vendorType === 'Supplier' || suppliers.some((s: any) => String(s.id) === String(item.vendorId)))) {
                const sId = String(item.vendorId);
                entry.suppliers.add(sId);
                if (!entry.supplierStats[sId]) {
                    const supObj = (suppliers || []).find((s: any) => String(s.id) === String(item.vendorId)) || (vendors || []).find((v: any) => String(v.id) === String(item.vendorId));
                    const supName = item.supplierName || (supObj ? supObj.name : 'Unknown Supplier');
                    entry.supplierStats[sId] = {
                        id: sId,
                        name: supName,
                        totalCount: 0,
                        updatedCount: 0,
                        pendingCount: 0,
                        totalAmount: 0,
                        pendingAmount: 0,
                        paidCount: 0,
                        unpaidCount: 0,
                    };
                }
                const stat = entry.supplierStats[sId];
                stat.totalCount += 1;
                stat.totalAmount += amount;
                if (isUpdated) {
                    stat.updatedCount += 1;
                } else {
                    stat.pendingCount += 1;
                    stat.pendingAmount += amount;
                }
                if (isPaid) {
                    stat.paidCount += 1;
                } else {
                    stat.unpaidCount += 1;
                }
            }
            
            entry.totalCount += 1;
            entry.totalAmount += amount;
            
            if (isUpdated) {
                entry.updatedCount += 1;
                entry.updatedAmount += amount;
            } else {
                entry.pendingCount += 1;
                entry.pendingAmount += amount;
            }
        });

        return Object.keys(monthsData)
            .sort((a, b) => b.localeCompare(a))
            .map(key => {
                const supplierStatsList = Object.values(monthsData[key].supplierStats);
                const fullyUpdatedSuppliersCount = supplierStatsList.filter((s: any) => s.pendingCount === 0).length;
                const pendingSuppliersCount = supplierStatsList.filter((s: any) => s.pendingCount > 0).length;
                const fullyPaidSuppliersCount = supplierStatsList.filter((s: any) => s.unpaidCount === 0).length;
                const unpaidSuppliersCount = supplierStatsList.filter((s: any) => s.unpaidCount > 0).length;
                return {
                    key,
                    label: monthsData[key].label,
                    suppliersCount: monthsData[key].suppliers.size,
                    fullyUpdatedSuppliersCount,
                    pendingSuppliersCount,
                    fullyPaidSuppliersCount,
                    unpaidSuppliersCount,
                    updatedCount: monthsData[key].updatedCount,
                    updatedAmount: monthsData[key].updatedAmount,
                    pendingCount: monthsData[key].pendingCount,
                    pendingAmount: monthsData[key].pendingAmount,
                    totalCount: monthsData[key].totalCount,
                    totalAmount: monthsData[key].totalAmount,
                    supplierList: supplierStatsList.sort((x: any, y: any) => y.pendingAmount - x.pendingAmount)
                };
            });
    }, [filteredData, suppliers]);

    // Statement of Account Items filter logic
    const soaFilteredItems = useMemo(() => {
        const filtered = (data || []).filter((item: any) => {
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
            const breakdown = getItemChequeBreakdown(item, false);
            if (soaScope === 'Paid' && !breakdown.isSettled) return false;
            if (soaScope === 'Pending' && breakdown.isSettled) return false;
            if (soaScope === 'Pending_NoCheque') {
                if (breakdown.isSettled || breakdown.hasPendingCheque) return false;
            }
            if (soaScope === 'Pending_Cheque') {
                if (breakdown.isSettled || !breakdown.hasPendingCheque) return false;
            }

            return true;
        });
        return [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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
    const handleGenerateSOAPDF = (targetOrientation?: 'landscape' | 'portrait') => {
        if (!targetOrientation) {
            setSoaPdfModalOpen(true);
            return;
        }

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
            const { totalAmt, paidAmt } = getSOAItemAmounts(itm);
            totalBilled += totalAmt;
            totalPaid += paidAmt;
        });
        const balance = Math.max(0, totalBilled - totalPaid);

        let selectedCompanyObj = soaCompanyId !== 'All' ? (companies || []).find((c: any) => c.id === soaCompanyId) : null;

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
            companyName: selectedCompanyObj ? selectedCompanyObj.name : "PIONEER GROUP (CONSOLIDATED)",
            companyLogo: selectedCompanyObj?.logo,
            companyAddress: selectedCompanyObj?.address || "United Arab Emirates",
            companyEmail: selectedCompanyObj?.email || "accounts@pioneer.ae",
            companyPhone: selectedCompanyObj?.phone || "+971 4 000 0000",
            includeDetails: soaIncludeDetails,
            vendors,
            suppliers,
            projects,
            orientation: targetOrientation,
            soaCompanyId,
            selectedCompanyObj,
            bankAccounts,
            soaNotes
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
                const foundVen = vendors.find((v: any) => v.id === soaVendorId);
                const foundSupReal = suppliers.find((s: any) => s.id === soaVendorId);
                pName = foundSupReal?.name || foundVen?.name || 'Selected Supplier';
                pType = foundSupReal ? 'Supplier' : 'Client';
            }
        }

        downloadSOAExcel(soaVendorId, pName, pType, soaFilteredItems, false, soaIncludeDetails, vendors, suppliers, projects, soaNotes);
    };

    const { duplicateGroups, duplicateGroupsCount } = useMemo(() => {
        const records = data || [];
        const groups: { [key: string]: any[] } = {};
        
        // Group by Invoice Number
        const invGroups: { [invoiceNum: string]: any[] } = {};
        records.forEach((record: any) => {
            const inv = (record.invoiceNumber || '').trim().toLowerCase();
            if (inv && inv.length > 0) {
                if (!invGroups[inv]) invGroups[inv] = [];
                invGroups[inv].push(record);
            }
        });

        // Group by Supplier + Company + Month & Year
        const monthGroups: { [key: string]: any[] } = {};
        records.forEach((record: any) => {
            const vendor = record.vendorId || 'none';
            const company = record.companyId || 'none';
            const mY = getMonthYear(record.date || record.invoiceDate);
            if (mY !== 'Unknown') {
                const key = `${vendor}_${company}_${mY}`;
                if (!monthGroups[key]) monthGroups[key] = [];
                monthGroups[key].push(record);
            }
        });

        const list: any[] = [];
        let count = 0;

        // Collect matching invoice duplicates
        Object.entries(invGroups).forEach(([inv, items]) => {
            if (items.length > 1) {
                list.push({
                    id: 'inv_' + inv,
                    type: 'invoice',
                    key: `Invoice Number Conflict: #${items[0].invoiceNumber}`,
                    items,
                    reason: `These custom bills share the identical invoice number "${items[0].invoiceNumber}" in the master ledger.`
                });
                count++;
            }
        });

        // Collect matching month/supplier duplicates
        Object.entries(monthGroups).forEach(([key, items]) => {
            if (items.length > 1) {
                const item = items[0];
                const payeeName = (() => {
                    if (item.supplierName) return item.supplierName;
                    const list = item.vendorType === 'Supplier' ? suppliers : vendors;
                    const found = list?.find((s: any) => s.id === item.vendorId);
                    return found ? found.name : 'Unknown';
                })();
                const compName = companies?.find((c: any) => c.id === item.companyId)?.name || 'the same company';
                const mY = getMonthYear(item.date || item.invoiceDate);

                list.push({
                    id: 'month_' + key,
                    type: 'monthly_company',
                    key: `Month-wise Company Overlap: ${payeeName} & ${compName} in ${mY}`,
                    items,
                    reason: `Our rules flagged ${items.length} separate bill entries for supplier "${payeeName}" under buyer "${compName}" specifically during the single month of ${mY}.`
                });
                count++;
            }
        });

        return { duplicateGroups: list, duplicateGroupsCount: count };
    }, [data, suppliers, vendors, companies]);

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
                        üìã Bill Ledger Table
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
                        üìä Aging & Monthly Reports
                    </button>
                    <button 
                        onClick={() => setActiveTabMode('soa')}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'soa' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        üìÑ Statement of Account (SOA)
                    </button>
                    <button 
                        onClick={() => setActiveTabMode('duplicates')}
                        className={cn(
                            "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                            activeTabMode === 'duplicates' ? "bg-white text-rose-600 shadow-sm animate-pulse-subtle" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        üîç Double-Entry Auditor {duplicateGroupsCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-bold animate-pulse">
                                {duplicateGroupsCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Financial Summary Ribbons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                    onClick={() => setKpiFilter(!kpiFilter || kpiFilter === 'all' ? null : 'all')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (!kpiFilter || kpiFilter === 'all') 
                            ? "border-blue-500 bg-blue-50/15 shadow-blue-50/40 ring-1 ring-blue-500/20" 
                            : "border-slate-100 hover:border-blue-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">Total Supplier Bills</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalBills.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono font-bold">Billed count: {metrics.count} invoices</p>
                    {(!kpiFilter || kpiFilter === 'all') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                </div>

                <div 
                    onClick={() => setKpiFilter(kpiFilter === 'paid' ? null : 'paid')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (kpiFilter === 'paid') 
                            ? "border-emerald-500 bg-emerald-50/15 shadow-emerald-50/40 ring-1 ring-emerald-500/20" 
                            : "border-slate-100 hover:border-emerald-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">Cleared Outflows (Paid)</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-2 font-mono font-bold">
                        Payment rate: {metrics.totalBills > 0 ? ((metrics.totalPaid / metrics.totalBills) * 100).toFixed(1) : 0}% ({metrics.paidCount} paid)
                    </p>
                    {(kpiFilter === 'paid') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>

                <div 
                    onClick={() => setKpiFilter(kpiFilter === 'pending' ? null : 'pending')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (kpiFilter === 'pending') 
                            ? "border-rose-500 bg-rose-50/15 shadow-rose-50/40 ring-1 ring-rose-500/20" 
                            : "border-slate-100 hover:border-rose-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">Aged Supplier Payables</span>
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-2xl">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalPending.toLocaleString()}</p>
                    <p className="text-[10px] text-rose-600 font-bold mt-2 font-mono font-bold">
                        {metrics.totalBills > 0 ? ((metrics.totalPending / metrics.totalBills) * 100).toFixed(1) : 0}% outstanding ({metrics.pendingCount} unpaid)
                    </p>
                    {(kpiFilter === 'pending') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                </div>

                <div 
                    onClick={() => setKpiFilter(kpiFilter === 'vat' ? null : 'vat')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (kpiFilter === 'vat') 
                            ? "border-indigo-500 bg-indigo-50/15 shadow-indigo-50/40 ring-1 ring-indigo-500/20" 
                            : "border-slate-100 hover:border-indigo-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">5% Input Tax (Recoverable)</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <Percent className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalVat.toLocaleString()}</p>
                    <p className="text-[10px] text-indigo-600 font-bold mt-2 font-mono font-bold">Claimable VAT on ledger</p>
                    {(kpiFilter === 'vat') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                </div>
            </div>

            {/* INVOICE DOCUMENT RECEIPT STATUS TRACKER (Supplier Invoice copies checker) */}
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-3xl shadow-xs">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="shrink-0">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="p-1 bg-indigo-100 text-indigo-700 rounded-lg">üì•</span>
                            Supplier Tax Invoice Document Tracker
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-sm">
                            Track which entered bills you have physical or scanned invoice documents for, and which ones are pending. Click to filter.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto items-stretch">
                        <button
                            onClick={() => setFilterInvoiceDoc('All')}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-4 cursor-pointer",
                                filterInvoiceDoc === 'All'
                                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-350"
                            )}
                        >
                            <span className="flex items-center gap-1.5">üåê All Bills</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 font-mono",
                                filterInvoiceDoc === 'All' ? "bg-indigo-700 text-indigo-150" : "bg-slate-100 text-slate-500"
                            )}>
                                {(data || []).length}
                            </span>
                        </button>

                        <button
                            onClick={() => setFilterInvoiceDoc(filterInvoiceDoc === 'Received' ? 'All' : 'Received')}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-4 cursor-pointer",
                                filterInvoiceDoc === 'Received'
                                    ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-200"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">üì• Received Copies ({metrics.totalBills > 0 ? ((metrics.receivedInvoiceAmount / metrics.totalBills) * 100).toFixed(0) : 0}%)</span>
                            <div className="flex items-center gap-2 font-mono shrink-0 font-bold">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    filterInvoiceDoc === 'Received' ? "bg-emerald-700 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                                )}>
                                    {metrics.receivedInvoiceCount}
                                </span>
                                <span className="text-[10px]">AED {metrics.receivedInvoiceAmount.toLocaleString()}</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setFilterInvoiceDoc(filterInvoiceDoc === 'Waiting' ? 'All' : 'Waiting')}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-4 cursor-pointer",
                                filterInvoiceDoc === 'Waiting'
                                    ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-amber-50/50 hover:border-amber-200"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">‚è≥ Waiting for Document</span>
                            <div className="flex items-center gap-2 font-mono shrink-0 font-bold">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    filterInvoiceDoc === 'Waiting' ? "bg-amber-750 text-amber-100" : "bg-amber-50 text-amber-700"
                                )}>
                                    {metrics.waitingInvoiceCount}
                                </span>
                                <span className="text-[10px] text-rose-600 font-extrabold font-bold">AED {metrics.waitingInvoiceAmount.toLocaleString()}</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setShowMonthlyAuditBreakdown(!showMonthlyAuditBreakdown)}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-2 cursor-pointer shadow-2xs",
                                showMonthlyAuditBreakdown
                                    ? "bg-[#a855f7] text-white border-purple-700"
                                    : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">
                                üìä {showMonthlyAuditBreakdown ? "Hide Monthly Audit" : "Show Monthly Audit Table"}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Expandable Monthly Audit Table */}
                {showMonthlyAuditBreakdown && (
                    <div className="mt-5 border-t border-slate-200/60 pt-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-[#a855f7] flex items-center gap-1.5 font-sans">
                                üìã Month-by-Month Supplier Record Update Audit
                            </h5>
                            <span className="text-[10px] text-slate-400 font-bold font-mono">
                                Showing data based on active ledger filters
                            </span>
                        </div>
                        
                        {monthlyAuditBreakdown.length === 0 ? (
                            <div className="text-center py-6 text-xs text-slate-400 font-semibold font-sans">
                                No records found to perform monthly auditing.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-2xs">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                            <th className="py-3 px-4">Billing Month</th>
                                            <th className="py-3 px-4 text-center">Active Suppliers</th>
                                            <th className="py-3 px-4 text-center">Invoices count</th>
                                            <th className="py-3 px-4">Total Amount</th>
                                            <th className="py-3 px-4 text-emerald-600 bg-emerald-50/30">üì• Records Updated (Copies)</th>
                                            <th className="py-3 px-4 text-amber-600 bg-amber-50/30">‚è≥ Balance To Update</th>
                                            <th className="py-3 px-4 text-center">Update Progress</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-sans">
                                        {monthlyAuditBreakdown.map((row) => {
                                            const completionPct = row.totalCount > 0 ? (row.updatedCount / row.totalCount) * 100 : 0;
                                            const isExpanded = expandedMonthDetails === row.key;
                                            return (
                                                <React.Fragment key={row.key}>
                                                    <tr className={cn("hover:bg-slate-50/55 transition-colors font-sans", isExpanded && "bg-purple-50/10")}>
                                                        <td className="py-3 px-4 font-extrabold text-slate-900">
                                                            <div className="flex flex-col">
                                                                <span>{row.label}</span>
                                                                <button
                                                                    onClick={() => setExpandedMonthDetails(isExpanded ? null : row.key)}
                                                                    className="text-[10px] text-[#a855f7] hover:underline cursor-pointer font-bold text-left flex items-center gap-0.5 mt-0.5"
                                                                >
                                                                    {isExpanded ? 'hide breakdown ‚ñ¥' : 'show breakdown ‚ñæ'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[11px] font-extrabold font-mono">
                                                                    {row.suppliersCount} / {suppliers?.length || 0} active
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-bold font-mono">
                                                                    {row.fullyPaidSuppliersCount} paid, {row.unpaidSuppliersCount} pending
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-650">
                                                            {row.totalCount} bills
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-slate-500 font-mono">
                                                            AED {row.totalAmount.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 px-4 bg-emerald-50/10">
                                                            <div className="flex flex-col">
                                                                <span className="font-extrabold text-emerald-650 font-mono text-emerald-600">{row.updatedCount} uploaded</span>
                                                                <span className="text-[10px] text-slate-400 font-semibold font-mono">AED {row.updatedAmount.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 bg-amber-50/10">
                                                            <div className="flex flex-col w-full">
                                                                <span className="font-extrabold text-amber-600 font-mono">{row.pendingCount} pending</span>
                                                                <span className="text-[10px] text-slate-400 font-semibold font-mono">AED {row.pendingAmount.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                                                                    <div 
                                                                        className="h-full rounded-full bg-emerald-500"
                                                                        style={{ width: `${completionPct}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-700 font-mono">{completionPct.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-purple-50/10 border-b border-purple-100">
                                                            <td colSpan={7} className="p-4 bg-slate-50/50">
                                                                <div className="border border-purple-100/60 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 font-sans flex items-center gap-1.5 font-bold">
                                                                            üîç Active Suppliers Invoice Copy Audit Breakdown ‚Äî {row.label}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 font-sans font-extrabold bg-[#f1f5f9] px-2.5 py-1 rounded-lg">
                                                                            Paid/Settled: <span className="text-emerald-700 font-mono font-black">{row.fullyPaidSuppliersCount}</span> / Pending: <span className="text-amber-700 font-mono font-black">{row.unpaidSuppliersCount}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="overflow-hidden border border-slate-100 rounded-lg">
                                                                        <table className="w-full text-left border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">
                                                                                    <th className="py-2 px-3">Supplier Name</th>
                                                                                    <th className="py-2 px-3 text-center">Invoices Total</th>
                                                                                    <th className="py-2 px-3 text-center text-indigo-650 bg-indigo-50/10 font-bold font-sans">Payment / Settlement Status</th>
                                                                                    <th className="py-2 px-3 text-center text-emerald-600 font-sans font-bold">Recorded Copies</th>
                                                                                    <th className="py-2 px-3 text-center text-amber-600 font-sans font-bold">Pending Copies</th>
                                                                                    <th className="py-2 px-3 text-right font-sans font-bold">Pending Balance Amount</th>
                                                                                    <th className="py-2 px-3 text-center font-sans font-bold">Status Check</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 text-[11px] font-sans">
                                                                                {row.supplierList.map((sup: any) => (
                                                                                    <tr 
                                                                                        key={sup.id} 
                                                                                        className="hover:bg-indigo-50/40 cursor-pointer group/row transition-colors"
                                                                                        onClick={() => handleGoToInvoice(sup.id, row.key)}
                                                                                        title="Click to filter the ledger for this supplier's invoices"
                                                                                    >
                                                                                        <td className="py-2 px-3 font-extrabold text-slate-800 group-hover/row:text-indigo-700 transition-colors">
                                                                                            <span className="flex items-center gap-1 flex-wrap">
                                                                                                <span>{sup.name}</span>
                                                                                                <span className="opacity-0 group-hover/row:opacity-100 text-[9px] text-indigo-650 font-semibold transition-opacity bg-indigo-50 px-1 rounded-sm">
                                                                                                    click to view ‚ûî
                                                                                                </span>
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-center font-bold text-slate-600 font-mono">{sup.totalCount} bills</td>
                                                                                        <td className="py-2 px-3 text-center font-mono">
                                                                                            <span className={cn(
                                                                                                "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg",
                                                                                                sup.unpaidCount === 0
                                                                                                    ? "text-emerald-700 bg-emerald-100/40"
                                                                                                    : "text-amber-700 bg-amber-100/40"
                                                                                            )}>
                                                                                                {sup.paidCount} Paid / {sup.unpaidCount} Pending
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-center font-semibold text-emerald-600 font-mono">{sup.updatedCount} uploaded</td>
                                                                                        <td className="py-2 px-3 text-center font-semibold text-amber-600 font-mono">{sup.pendingCount} pending</td>
                                                                                        <td className="py-2 px-3 text-right font-bold text-slate-650 font-mono">
                                                                                            {sup.pendingAmount > 0 ? `AED ${sup.pendingAmount.toLocaleString()}` : '‚Äî'}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-center">
                                                                                            {sup.pendingCount === 0 ? (
                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-650 bg-emerald-50 px-2 py-0.5 rounded-full font-mono font-bold font-sans">
                                                                                                    ‚úì Completed
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-655 bg-amber-50 px-2 py-0.5 rounded-full font-mono font-bold font-sans">
                                                                                                    ‚è≥ {sup.pendingCount} to record
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Dynamic Panel */}
            {activeTabMode === 'ledger' ? (
                <div id="accounts-payable-ledger-section" className="space-y-4">
                    {/* Professional Date Filtering Bar: Month wise / Year wise / Range wise & Current / Last month */}
                    <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-rose-500" />
                                    <span>Posting Ledger Period Filter</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Select quick filters or input custom periods for smart month/year/range tracking.
                                </p>
                            </div>
                            
                            {/* Mode Pill selector */}
                            <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl border border-slate-200/40 gap-1">
                                {[
                                    { mode: 'all', label: 'All History' },
                                    { mode: 'current-month', label: 'Current Month' },
                                    { mode: 'last-month', label: 'Last Month' },
                                    { mode: 'month-wise', label: 'Month-Wise' },
                                    { mode: 'year-wise', label: 'Year-Wise' },
                                    { mode: 'custom-range', label: 'Date Range' }
                                ].map((tab) => (
                                    <button
                                        key={tab.mode}
                                        type="button"
                                        onClick={() => {
                                            setDateFilterMode(tab.mode as any);
                                            // Pre-populate if empty
                                            if (tab.mode === 'month-wise' && !selectedMonthValue) {
                                                setSelectedMonthValue(new Date().toISOString().substring(0, 7));
                                            }
                                        }}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer",
                                            dateFilterMode === tab.mode 
                                                ? "bg-white text-slate-950 shadow-xs border border-slate-200/30 font-black" 
                                                : "text-slate-500 hover:text-slate-800"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Interactive Configurator Area depending on selected mode */}
                        {dateFilterMode !== 'all' && (
                            <div className="bg-slate-50 p-4 border border-slate-200/40 rounded-2xl animate-fadeIn text-xs">
                                {dateFilterMode === 'current-month' && (
                                    <div className="flex items-center gap-2 text-slate-600 font-medium font-sans">
                                        <span className="p-1 px-2.5 bg-rose-50 border border-rose-100 rounded-md text-rose-700 font-mono font-bold">MODE ACTIVE: CURRENT MONTH</span>
                                        <span>Showing records matching <strong className="text-slate-900 font-bold">{new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}</strong>.</span>
                                    </div>
                                )}

                                {dateFilterMode === 'last-month' && (
                                    <div className="flex items-center gap-2 text-slate-600 font-medium font-sans">
                                        <span className="p-1 px-2.5 bg-amber-50 border border-amber-100 rounded-md text-amber-700 font-mono font-bold">MODE ACTIVE: LAST MONTH</span>
                                        <span>Showing records matching <strong className="text-slate-900 font-bold">{(() => {
                                            const today = new Date();
                                            return new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });
                                        })()}</strong>.</span>
                                    </div>
                                )}

                                {dateFilterMode === 'month-wise' && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">Select Target Month</span>
                                            <input 
                                                type="month"
                                                value={selectedMonthValue}
                                                onChange={e => setSelectedMonthValue(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 focus:outline-hidden font-sans"
                                            />
                                        </div>
                                        <div className="text-slate-600 font-medium pt-3 font-sans">
                                            Currently filtering for month: <strong className="text-slate-900 font-black">{selectedMonthValue ? (() => {
                                                const [yr, mn] = selectedMonthValue.split('-');
                                                return new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });
                                            })() : 'None Selected'}</strong>
                                        </div>
                                    </div>
                                )}

                                {dateFilterMode === 'year-wise' && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">Target Financial Year</span>
                                            <select
                                                value={selectedYearValue}
                                                onChange={e => setSelectedYearValue(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 cursor-pointer focus:outline-hidden font-sans"
                                            >
                                                {Array.from({ length: 11 }, (_, i) => (2020 + i).toString()).map(yr => (
                                                    <option key={yr} value={yr}>{yr}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="text-slate-605 font-medium pt-3 font-sans">
                                            Currently filtering for year: <strong className="text-slate-900 font-black">{selectedYearValue}</strong>
                                        </div>
                                    </div>
                                )}

                                {dateFilterMode === 'custom-range' && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 font-sans">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">From Date</span>
                                            <input 
                                                type="date"
                                                value={customRangeStart}
                                                onChange={e => setCustomRangeStart(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 focus:outline-hidden"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">To Date</span>
                                            <input 
                                                type="date"
                                                value={customRangeEnd}
                                                onChange={e => setCustomRangeEnd(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 focus:outline-hidden"
                                            />
                                        </div>
                                        <div className="text-slate-605 font-medium pb-1.5">
                                            {customRangeStart && customRangeEnd ? (
                                                <span>Showing range between <strong className="text-slate-900 font-bold">{customRangeStart}</strong> and <strong className="text-slate-900 font-bold">{customRangeEnd}</strong></span>
                                            ) : (
                                                <span className="text-slate-400 font-medium">Please pick both boundaries for range tracking.</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

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
                                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.clientName ? ` (${p.clientName})` : ''}</option>)}
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
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer font-sans"
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Paid">Paid</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Partially Paid">Partially Paid</option>
                                            <option value="Partial Amount Paid by Cheque">Partial Paid by Chq</option>
                                            <option value="CPD Pending">CPD Pending</option>
                                            <option value="PDC Issued">PDC Issued / In Hand</option>
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

                                {/* Company / Buying Corporate Identity dropdown */}
                                <div className="space-y-1">
                                    <label className="block text-slate-405 font-mono font-bold uppercase text-[9px]">Buying Corporate Identity</label>
                                    <select 
                                        value={filterCompany} 
                                        onChange={e => setFilterCompany(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 outline-hidden font-bold cursor-pointer font-sans"
                                    >
                                        <option value="All">All Filing Entities</option>
                                        {(companies || []).map((c: any) => (
                                            <option key={c.id} value={c.id}>üè¢ {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    <DataTable<AccountsPayable>
                        title="Accounts Payable Ledger"
                        description="Filtered list of supplier billings and payments matching specified constraints."
                        icon={TrendingDown}
                        data={ledgerFilteredData}
                        columns={[
                            { 
                                key: 'srNo', 
                                label: 'Sr. #', 
                                render: (_, index) => (
                                    <span className="text-xs font-mono text-slate-400 font-bold font-mono">{(index + 1)}</span>
                                ),
                                exportText: (_, index) => index + 1
                            },
                            { 
                                key: 'supplierName', 
                                label: 'Name of Supplier',
                                sortable: true,
                                render: (item) => (
                                    <span className="font-bold text-slate-800 block min-w-[200px]">
                                        {item.supplierName || getVendorName(item.vendorId, item.vendorType) || '-'}
                                    </span>
                                ),
                                exportText: (item) => item.supplierName || getVendorName(item.vendorId, item.vendorType) || ''
                            },
                            { 
                                key: 'supplierCode', 
                                label: 'Supplier',
                                sortable: true,
                                render: (item) => (
                                    <span className="font-mono text-xs text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-md font-black tracking-wide block max-w-[80px] text-center">
                                        {item.supplierCode || '-'}
                                    </span>
                                ),
                                exportText: (item) => item.supplierCode || ''
                            },
                            { 
                                key: 'trn', 
                                label: 'TRN No',
                                sortable: true,
                                render: (item) => {
                                    const payee = (item.vendorType === 'Supplier' ? suppliers : vendors)?.find((s: any) => s.id === item.vendorId);
                                    return (
                                        <span className="font-mono text-xs text-slate-600 font-extrabold block">
                                            {payee?.trn || '-'}
                                        </span>
                                    );
                                },
                                exportText: (item) => {
                                    const payee = (item.vendorType === 'Supplier' ? suppliers : vendors)?.find((s: any) => s.id === item.vendorId);
                                    return payee?.trn || '';
                                }
                            },
                            { 
                                key: 'invoiceNumber', 
                                label: 'Invoice Number', 
                                sortable: true,
                                render: (item) => (
                                    <span className="font-mono font-black text-slate-900 block whitespace-nowrap">{item.invoiceNumber || '-'}</span>
                                ),
                                exportText: (item) => item.invoiceNumber || ''
                            },
                            { 
                                key: 'invoiceReceivedStatus', 
                                label: 'Invoice Document', 
                                sortable: true,
                                render: (item) => {
                                    const docReceived = item.invoiceReceivedStatus || (item.attachment ? 'Received' : 'Waiting');
                                    return (
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border whitespace-nowrap",
                                            docReceived === 'Received' 
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                                : "bg-amber-50 text-amber-700 border-amber-200/65 animate-pulse-subtle font-black"
                                        )}>
                                            {docReceived === 'Received' ? 'üì• Received' : '‚è≥ Waiting'}
                                        </span>
                                    );
                                },
                                exportText: (item) => item.invoiceReceivedStatus || (item.attachment ? 'Received' : 'Waiting')
                            },
                            { 
                                key: 'companyId', 
                                label: 'Buying Corporate Identity',
                                sortable: true,
                                render: (item) => {
                                    const comp = (companies || []).find((c: any) => c.id === item.companyId);
                                    return (
                                        <div className="flex items-center gap-2 min-w-[200px]">
                                            {comp?.logo ? (
                                                <img src={comp.logo} alt={comp.name} className="w-7 h-7 object-contain rounded border border-slate-100 bg-white p-0.5 shrink-0" referrerPolicy="no-referrer" />
                                            ) : (
                                                <div className="w-7 h-7 bg-indigo-50 text-indigo-600 border border-indigo-100/50 rounded flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                                    {(comp?.name || 'CO').substring(0, 2)}
                                                </div>
                                            )}
                                            <span className="font-extrabold text-slate-800 text-xs truncate max-w-[170px]" title={comp?.name}>
                                                {comp?.name || 'Unassigned'}
                                            </span>
                                        </div>
                                    );
                                },
                                exportText: (item) => (companies || []).find((c: any) => c.id === item.companyId)?.name || 'Unassigned'
                            },
                            { 
                                key: 'date', 
                                label: 'Invoice Date', 
                                sortable: true,
                                render: (item) => {
                                    if (!item.date) return <span className="text-xs text-slate-400 font-mono">-</span>;
                                    const d = new Date(item.date);
                                    // Handle edge case of invalid date cleanly
                                    if (isNaN(d.getTime())) {
                                        return <span className="text-xs text-slate-400 font-mono">{item.date}</span>;
                                    }
                                    const formatted = d.toLocaleDateString('default', { day: '2-digit', month: 'short', year: 'numeric' });
                                    const monthLabel = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                                    return (
                                        <div className="font-mono text-xs whitespace-nowrap leading-tight">
                                            <span className="text-slate-700 font-bold block">{formatted}</span>
                                            <span className="text-[9px] text-indigo-600 font-extrabold tracking-normal uppercase bg-indigo-55/80 border border-indigo-100/50 px-1 py-0.5 rounded-sm font-sans inline-block mt-0.5">
                                                {monthLabel}
                                            </span>
                                        </div>
                                    );
                                },
                                exportText: (item) => item.date || ''
                            },
                            { 
                                key: 'hours', 
                                label: 'Hours', 
                                sortable: true,
                                render: (item) => (
                                    <span className="text-slate-600 font-bold font-mono text-center block">{item.hours !== undefined ? item.hours : 0}</span>
                                ),
                                exportText: (item) => item.hours !== undefined ? item.hours : 0
                            },
                            { 
                                key: 'amount', 
                                label: 'Bill Amount', 
                                sortable: true,
                                render: (item) => (
                                    <span className="font-bold text-slate-500 font-mono block whitespace-nowrap">AED {(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ),
                                exportText: (item) => item.amount || 0
                            },
                            { 
                                key: 'actualAmount', 
                                label: 'Actual Amount', 
                                sortable: true,
                                render: (item) => (
                                    <span className="font-bold text-slate-700 font-mono block whitespace-nowrap">AED {(item.actualAmount !== undefined ? item.actualAmount : item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ),
                                exportText: (item) => item.actualAmount !== undefined ? item.actualAmount : (item.amount || 0)
                            },
                            { 
                                key: 'vatAmount', 
                                label: 'VAT', 
                                sortable: true,
                                render: (item) => (
                                    <span className="text-slate-400 font-bold font-mono block whitespace-nowrap">AED {(item.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ),
                                exportText: (item) => item.vatAmount || 0
                            },
                            { 
                                key: 'totalAmount', 
                                label: 'Total', 
                                sortable: true,
                                render: (item) => {
                                    const actual = item.actualAmount !== undefined ? item.actualAmount : item.amount || 0;
                                    const vat = item.vatAmount !== undefined ? item.vatAmount : Number((actual * 0.05).toFixed(2));
                                    const total = item.totalAmount !== undefined ? item.totalAmount : Number((actual + vat).toFixed(2));
                                    return (
                                        <span className="font-black text-slate-900 font-mono block whitespace-nowrap">
                                            AED {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    );
                                },
                                exportText: (item) => {
                                    const actual = item.actualAmount !== undefined ? item.actualAmount : item.amount || 0;
                                    const vat = item.vatAmount !== undefined ? item.vatAmount : Number((actual * 0.05).toFixed(2));
                                    return item.totalAmount !== undefined ? item.totalAmount : Number((actual + vat).toFixed(2));
                                }
                            },
                            { 
                                key: 'advance', 
                                label: 'Advance', 
                                sortable: true,
                                render: (item) => (
                                    <span className="text-indigo-600 font-bold font-mono block whitespace-nowrap">AED {(item.advance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ),
                                exportText: (item) => item.advance || 0
                            },
                            { 
                                key: 'deduction', 
                                label: 'Deduction', 
                                sortable: true,
                                render: (item) => (
                                    <span className="text-rose-600 font-bold font-mono block whitespace-nowrap">AED {(item.deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ),
                                exportText: (item) => item.deduction || 0
                            },
                            { 
                                key: 'paid', 
                                label: 'Paid', 
                                sortable: true,
                                render: (item) => (
                                    <span className="text-emerald-600 font-black font-mono block whitespace-nowrap">AED {(item.paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ),
                                exportText: (item) => item.paid || 0
                            },
                            { 
                                key: 'payableAmount', 
                                label: 'Payable Amount', 
                                sortable: true,
                                render: (item) => {
                                    const actual = item.actualAmount !== undefined ? item.actualAmount : ((item.amount || 0) - (item.deduction || 0));
                                    const vat = item.vatAmount !== undefined ? item.vatAmount : Number((actual * 0.05).toFixed(2));
                                    const total = item.totalAmount !== undefined ? item.totalAmount : Number((actual + vat).toFixed(2));
                                    
                                    const advance = item.advance || 0;
                                    const paid = item.paid || 0;
                                    
                                    const computedPayable = item.payableAmount !== undefined ? item.payableAmount : Number((total - paid - advance).toFixed(2));
                                    
                                    return (
                                        <span className={cn(
                                            "font-black px-2 py-1 rounded-lg font-mono text-xs block whitespace-nowrap",
                                            computedPayable > 0 ? "text-amber-800 bg-amber-55" : "text-emerald-800 bg-emerald-55"
                                        )}>
                                            AED {computedPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    );
                                },
                                exportText: (item) => {
                                    const actual = item.actualAmount !== undefined ? item.actualAmount : ((item.amount || 0) - (item.deduction || 0));
                                    const vat = item.vatAmount !== undefined ? item.vatAmount : Number((actual * 0.05).toFixed(2));
                                    const total = item.totalAmount !== undefined ? item.totalAmount : Number((actual + vat).toFixed(2));
                                    
                                    const advance = item.advance || 0;
                                    const paid = item.paid || 0;
                                    
                                    return item.payableAmount !== undefined ? item.payableAmount : Number((total - paid - advance).toFixed(2));
                                }
                            },
                            { 
                                key: 'paymentDate', 
                                label: 'Payment Clear Date', 
                                sortable: true,
                                render: (item) => (
                                    <span className="font-mono text-xs text-slate-500 block whitespace-nowrap">{item.paymentDate || (item as any).clearDate || '-'}</span>
                                ),
                                exportText: (item) => item.paymentDate || (item as any).clearDate || ''
                            },
                            { 
                                key: 'description', 
                                label: 'Notes / Remarks', 
                                render: (item) => (
                                    <span className="text-xs text-slate-500 line-clamp-2 max-w-[220px] font-normal block whitespace-pre-line" title={item.description}>
                                        {item.description || '-'}
                                    </span>
                                ),
                                exportText: (item) => item.description || ''
                            }
                        ]}
                        onAdd={onAdd}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onBulkDelete={onDeleteMultiple}
                        onBulkUpdateDate={onBulkUpdateDate}
                        onBulkUpdateNotes={onBulkUpdateNotes}
                        onBulkUpdateCompanyId={onBulkUpdateCompanyId}
                        onBulkUpdatePaid={onBulkUpdatePaid}
                        companies={companies}
                        enableMultiSelect={true}
                        onUploadExcel={onUploadExcel}
                        onViewBill={(item) => setViewingBill(item.attachment || null)}
                        onViewDetails={(item) => setViewingRecordDetail(item)}
                        customSearch={(item, query) => {
                            try {
                                const supplierName = (item.supplierName || '').toLowerCase();
                                const supplierCode = (item.supplierCode || '').toLowerCase();
                                const invoiceNumber = (item.invoiceNumber || '').toLowerCase();
                                const description = (item.description || '').toLowerCase();
                                const vName = String(getVendorName?.(item.vendorId, item.vendorType) || '').toLowerCase();
                                const pName = String(getProjectName?.(item.projectId) || '').toLowerCase();
                                const payee = (item.vendorType === 'Supplier' ? suppliers : vendors)?.find((s: any) => s.id === item.vendorId);
                                const trnVal = String(payee?.trn || '').toLowerCase();
                                
                                const q = (query || '').toLowerCase().trim();
                                if (!q) return true;

                                const hasMatchingSiteInvoice = item.siteInvoices && item.siteInvoices.some((inv: any) => {
                                    const invNum = (inv.invoiceNumber || '').toLowerCase();
                                    const invNote = (inv.description || '').toLowerCase();
                                    const invProjName = String(projects?.find((p: any) => p.id === inv.projectId)?.name || '').toLowerCase();
                                    return invNum.includes(q) || invNote.includes(q) || invProjName.includes(q);
                                });
                                
                                return (
                                    supplierName.includes(q) || 
                                    supplierCode.includes(q) || 
                                    invoiceNumber.includes(q) ||
                                    description.includes(q) ||
                                    vName.includes(q) || 
                                    pName.includes(q) || 
                                    trnVal.includes(q) ||
                                    !!hasMatchingSiteInvoice
                                );
                            } catch (e) {
                                console.error("Error in AccountsPayableView customSearch:", e);
                                return false;
                            }
                        }}
                        searchFields={['invoiceNumber', 'description']}
                        exportFileName="Accounts_Payable"
                        user={user}
                        renderFooter={(filteredItems) => {
                            let uniqueSuppliers = new Set<string>();
                            let hours = 0;
                            let billAmount = 0;
                            let actualAmount = 0;
                            let vatAmount = 0;
                            let totalAmount = 0;
                            let advance = 0;
                            let deduction = 0;
                            let paid = 0;
                            let payableAmount = 0;

                            filteredItems.forEach(item => {
                                const sName = item.supplierName || getVendorName(item.vendorId, item.vendorType) || '';
                                if (sName && sName !== 'Unknown' && sName !== '-') {
                                    uniqueSuppliers.add(sName);
                                }

                                hours += item.hours !== undefined ? item.hours : 0;
                                billAmount += item.amount || 0;

                                const actual = item.actualAmount !== undefined ? item.actualAmount : ((item.amount || 0) - (item.deduction || 0));
                                actualAmount += actual;

                                const vat = item.vatAmount !== undefined ? item.vatAmount : Number((actual * 0.05).toFixed(2));
                                vatAmount += vat;

                                const total = item.totalAmount !== undefined ? item.totalAmount : Number((actual + vat).toFixed(2));
                                totalAmount += total;

                                const adv = item.advance || 0;
                                advance += adv;

                                const ded = item.deduction || 0;
                                deduction += ded;

                                const pd = item.paid || 0;
                                paid += pd;

                                const computedPayable = item.payableAmount !== undefined ? item.payableAmount : Number((total - pd - adv).toFixed(2));
                                payableAmount += computedPayable;
                            });

                            const userRoleLower = (user?.role || '').toLowerCase();
                            const isAdminCheck = userRoleLower === 'admin' || userRoleLower === 'creator' || user?.email === 'abdulkaderp3010@gmail.com';

                            return (
                                <tr className="bg-slate-100/90 hover:bg-slate-150 border-t border-slate-250 transition-colors font-black text-slate-900 text-xs">
                                    {isAdminCheck && <td className="px-6 py-4" />}
                                    <td className="px-6 py-4 text-left font-black text-slate-500 uppercase tracking-widest">
                                        TOTALS
                                    </td>
                                    <td className="px-6 py-4 text-left font-semibold text-indigo-700 min-w-[200px]">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-indigo-500/80 font-black uppercase tracking-wider">Suppliers</span>
                                            <span className="font-bold text-xs">{uniqueSuppliers.size} Unique</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-bold text-slate-400">-</td>
                                    <td className="px-6 py-4 text-left font-bold text-slate-400">-</td>
                                    <td className="px-6 py-4 text-left font-bold text-slate-400">-</td>
                                    <td className="px-6 py-4 text-center font-mono font-extrabold text-slate-800">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hours</span>
                                            <span>{hours.toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-bold text-slate-600 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bill</span>
                                            <span>AED {billAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-bold text-slate-800 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Actual</span>
                                            <span>AED {actualAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-bold text-slate-500 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">VAT</span>
                                            <span>AED {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-extrabold text-slate-950 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Total</span>
                                            <span>AED {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-bold text-indigo-600 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Advance</span>
                                            <span>AED {advance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-bold text-rose-600 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-rose-450 font-bold uppercase tracking-wider">Deduct</span>
                                            <span>AED {deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-extrabold text-emerald-600 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Paid</span>
                                            <span>AED {paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-mono font-black text-amber-900 bg-amber-100/40 rounded-lg whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-amber-700 font-black uppercase tracking-wider">Payable</span>
                                            <span>AED {payableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-left font-bold text-slate-400">-</td>
                                    <td className="px-6 py-4 text-left font-bold text-slate-400">-</td>
                                    {(onEdit || onDelete) && <td className="px-6 py-4 text-right" />}
                                </tr>
                            );
                        }}
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
            ) : activeTabMode === 'soa' ? (
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
                                            üíº {c.name}
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
                                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.clientName ? ` (${p.clientName})` : ''}</option>)}
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
                                <select 
                                    value={soaScope} 
                                    onChange={e => setSoaScope(e.target.value as any)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-850 outline-hidden font-extrabold cursor-pointer text-xs"
                                >
                                    <option value="All">üåê All Records (Combined History)</option>
                                    <option value="Pending_NoCheque">üö® Pure Pending: No Cheque in Hand (Unsettled Balance)</option>
                                    <option value="Pending_Cheque">‚úçÔ∏è Pending: Cheques Issued (PDC / Future Clearance)</option>
                                    <option value="Pending">‚è≥ All Outstanding / Pending Demands (Combined)</option>
                                    <option value="Paid">‚úÖ Settled / Cleared Bills Only</option>
                                </select>
                            </div>

                            {/* Optional Detail Inclusions Toggle */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                                <label className="flex items-center gap-2.5 cursor-pointer text-slate-800 font-extrabold text-xs select-none">
                                    <input 
                                        type="checkbox"
                                        checked={soaIncludeDetails}
                                        onChange={e => setSoaIncludeDetails(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span>Include Supplier Name & Project Code</span>
                                </label>
                                <p className="text-[10px] text-slate-500 font-medium pl-6 leading-normal">
                                    Optional: Show individual supplier name and project code/name details for each invoice line in PDF and Excel downloads.
                                </p>
                            </div>

                            {/* Statement Note / Remarks */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="block text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Statement Note / Remark</label>
                                    {soaNotes !== "All invoices submitted as per the site provided time sheet and records." && (
                                        <button 
                                            type="button" 
                                            onClick={() => setSoaNotes("All invoices submitted as per the site provided time sheet and records.")}
                                            className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer"
                                        >
                                            Reset Default
                                        </button>
                                    )}
                                </div>
                                <textarea 
                                    value={soaNotes} 
                                    onChange={e => setSoaNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Enter statement note..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-800 text-xs font-medium outline-hidden focus:border-emerald-500 transition-colors resize-none"
                                />
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Default note printed on downloaded PDF & Excel statement reports. Edit or clear content as required.
                                </p>
                            </div>

                            {/* Output Preview Card */}
                            {(() => {
                                let apBilled = 0;
                                let apPaid = 0;
                                let apBal = 0;
                                let pdcBal = 0;
                                let pdcCount = 0;
                                let purePendingBal = 0;
                                let purePendingCount = 0;

                                soaFilteredItems.forEach((itm: any) => {
                                    const breakdown = getItemChequeBreakdown(itm, false);
                                    apBilled += breakdown.totalAmt;
                                    apPaid += breakdown.paidAmt;
                                    apBal += breakdown.balanceAmt;

                                    if (!breakdown.isSettled) {
                                        pdcBal += breakdown.pendingPdcAmount;
                                        if (breakdown.hasPendingCheque) {
                                            pdcCount += 1;
                                        }
                                        purePendingBal += breakdown.purePendingAmount;
                                        if (breakdown.purePendingAmount > 0) {
                                            purePendingCount += 1;
                                        }
                                    }
                                });

                                return (
                                    <div className="p-4.5 bg-emerald-50/50 border border-emerald-100 rounded-3xl space-y-3 mt-4">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 font-mono">Matched Record Summary</p>
                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100/80 text-emerald-800 rounded-lg">
                                                {soaFilteredItems.length} invoices
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="p-2.5 bg-white/80 rounded-xl border border-slate-100">
                                                <span className="text-[10px] text-slate-400 block font-bold">Total Invoiced:</span>
                                                <strong className="text-slate-900 text-xs font-black font-mono">
                                                    AED {apBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </strong>
                                            </div>
                                            <div className="p-2.5 bg-white/80 rounded-xl border border-slate-100">
                                                <span className="text-[10px] text-emerald-600 block font-bold">Settled / Paid:</span>
                                                <strong className="text-emerald-700 text-xs font-black font-mono">
                                                    AED {apPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-bold text-slate-700">Gross Liability Balance:</span>
                                                <strong className="text-slate-900 text-xs font-black font-mono">
                                                    AED {apBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </strong>
                                            </div>

                                            <div className="border-t border-dashed border-slate-200 pt-2 grid grid-cols-2 gap-2">
                                                <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100/60">
                                                    <div className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-700 uppercase">
                                                        <span>‚úçÔ∏è PDC Issued ({pdcCount})</span>
                                                    </div>
                                                    <p className="font-mono font-black text-indigo-900 text-[11px] mt-0.5">
                                                        AED {pdcBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[8.5px] text-indigo-500 font-medium">Future Clearance</p>
                                                </div>

                                                <div className="bg-rose-50/80 p-2 rounded-lg border border-rose-200/60">
                                                    <div className="flex items-center gap-1 text-[9px] font-extrabold text-rose-700 uppercase">
                                                        <span>üö® Pure Pending ({purePendingCount})</span>
                                                    </div>
                                                    <p className="font-mono font-black text-rose-700 text-[11px] mt-0.5">
                                                        AED {purePendingBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[8.5px] text-rose-500 font-medium">No Cheque Issued</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* CTAs */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => handleGenerateSOAPDF()}
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

                            {/* SOA PDF ORIENTATION SELECTION MODAL */}
                            <AnimatePresence>
                                {soaPdfModalOpen && (
                                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                            className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-100"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">PDF SOA Page Format</h3>
                                                        <p className="text-slate-500 text-xs font-medium">Select preferred layout orientation before downloading</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSoaPdfModalOpen(false)}
                                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Portrait Option */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSoaPdfOrientation('portrait')}
                                                    className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-3 relative ${
                                                        soaPdfOrientation === 'portrait'
                                                            ? 'border-rose-600 bg-rose-50/40 shadow-md ring-2 ring-rose-500/20'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="w-8 h-11 border-2 border-slate-400 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-2xs">
                                                            A4
                                                        </div>
                                                        {soaPdfOrientation === 'portrait' && (
                                                            <div className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs">
                                                                <Check className="w-4 h-4 stroke-[3]" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900">Portrait</h4>
                                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                                            Standard vertical format (210 √ó 297 mm). Compact & clean.
                                                        </p>
                                                    </div>
                                                </button>

                                                {/* Landscape Option */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSoaPdfOrientation('landscape')}
                                                    className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-3 relative ${
                                                        soaPdfOrientation === 'landscape'
                                                            ? 'border-rose-600 bg-rose-50/40 shadow-md ring-2 ring-rose-500/20'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="w-11 h-8 border-2 border-slate-400 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-2xs">
                                                            A4
                                                        </div>
                                                        {soaPdfOrientation === 'landscape' && (
                                                            <div className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xs">
                                                                <Check className="w-4 h-4 stroke-[3]" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900">Landscape</h4>
                                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                                            Wide horizontal view (297 √ó 210 mm). Expanded table width.
                                                        </p>
                                                    </div>
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSoaPdfModalOpen(false)}
                                                    className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSoaPdfModalOpen(false);
                                                        handleGenerateSOAPDF(soaPdfOrientation);
                                                    }}
                                                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-rose-600/30 cursor-pointer flex items-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    <span>Generate & Download PDF</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>
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
            ) : (
                /* activeTabMode === 'duplicates' */
                <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                                <span>Double Entry Audit & Duplicate Cleaner</span>
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">
                                Automatically scans active Accounts Payable ledger lines for identical invoice numbers or duplicate group postings within the same calendar month.
                            </p>
                        </div>

                        {duplicateGroups.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-3">
                                <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-800">No Double Entries Found!</h4>
                                    <p className="text-xs text-slate-400 font-medium">Your Accounts Payable ledger is completely clean. No duplicate invoice numbers or over-entries found.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-5 bg-rose-50/40 border border-rose-100 rounded-2xl">
                                        <span className="text-[10px] uppercase font-black text-rose-800 tracking-wider">Total Duplication Alerts</span>
                                        <p className="text-2xl font-black text-rose-600 mt-1">{duplicateGroupsCount}</p>
                                    </div>
                                    <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2xl">
                                        <span className="text-[10px] uppercase font-black text-amber-800 tracking-wider">Invoice Conflicts</span>
                                        <p className="text-2xl font-black text-amber-600 mt-1">
                                            {duplicateGroups.filter(g => g.type === 'invoice').length}
                                        </p>
                                    </div>
                                    <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl">
                                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Monthly Over-entries</span>
                                        <p className="text-2xl font-black text-slate-800 mt-1">
                                            {duplicateGroups.filter(g => g.type === 'monthly_company').length}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {duplicateGroups.map((group: any) => (
                                        <div key={group.id} className="border border-rose-100 bg-rose-50/5 rounded-2xl overflow-hidden shadow-xs hover:border-rose-200 transition-all">
                                            <div className="px-5 py-4 bg-rose-50/30 border-b border-rose-100/55 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                <div>
                                                    <h4 className="text-xs font-black text-rose-950 flex items-center gap-1.5 leading-snug">
                                                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                                        {group.key}
                                                    </h4>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{group.reason}</p>
                                                </div>
                                            </div>

                                            <div className="p-4 overflow-x-auto">
                                                <table className="w-full text-xs text-left text-slate-600 border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-100 pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                            <th className="py-2.5 px-3">Date</th>
                                                            <th className="py-2.5 px-3">Invoice #</th>
                                                            <th className="py-2.5 px-3">Supplier Name</th>
                                                            <th className="py-2.5 px-3">Buyer Company</th>
                                                            <th className="py-2.5 px-3">Deduction</th>
                                                            <th className="py-2.5 px-3">Total Amount</th>
                                                            <th className="py-2.5 px-3">Status</th>
                                                            <th className="py-2.5 px-3 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {group.items.map((item: any) => {
                                                            const payeeName = item.supplierName || suppliers?.find((s: any) => s.id === item.vendorId)?.name || vendors?.find((v: any) => v.id === item.vendorId)?.name || 'Unknown';
                                                            const compName = companies?.find((c: any) => c.id === item.companyId)?.name || '-';
                                                            return (
                                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="py-3 px-3 font-semibold text-slate-800 font-mono">{item.date}</td>
                                                                    <td className="py-3 px-3 font-extrabold text-slate-900 font-mono text-slate-700">
                                                                        {item.invoiceNumber || <span className="text-slate-350 italic">None</span>}
                                                                    </td>
                                                                    <td className="py-3 px-3 font-bold text-slate-700">{payeeName}</td>
                                                                    <td className="py-3 px-3 font-bold text-slate-505">{compName}</td>
                                                                    <td className="py-3 px-3 font-bold text-rose-500 font-mono">AED {Number(item.deduction || 0).toLocaleString()}</td>
                                                                    <td className="py-3 px-3 font-black text-brand-600 font-mono">AED {Number(item.totalAmount || item.amount || 0).toLocaleString()}</td>
                                                                    <td className="py-3 px-3">
                                                                        {(() => {
                                                                            if (item.status === 'Paid') {
                                                                                return (
                                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                        Paid
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            if (item.status === 'Partially Paid' || item.status === 'Partial Paid') {
                                                                                return (
                                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                                                                        Partial Paid
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            if (item.status === 'Partial Amount Paid by Cheque' || item.status === 'Partially Paid by Cheque') {
                                                                                return (
                                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                                        Partial Paid by Chq
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            if (item.status === 'CPD Pending') {
                                                                                return (
                                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-200">
                                                                                        CPD Pending
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            if (item.status === 'PDC Issued' || item.status === 'PDC in Hand') {
                                                                                return (
                                                                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                                                                        PDC Issued
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                                                                    {item.status || 'Pending'}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </td>
                                                                    <td className="py-3 px-3 text-right">
                                                                        <div className="flex items-center justify-end gap-1.5">
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => setViewingRecordDetail(item)}
                                                                                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-black text-[10px] tracking-wide uppercase transition-all cursor-pointer"
                                                                            >
                                                                                Details
                                                                            </button>
                                                                            {onEdit && (
                                                                                <button 
                                                                                    type="button"
                                                                                    onClick={() => onEdit(item)}
                                                                                    className="p-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-black text-[10px] tracking-wide uppercase transition-all cursor-pointer"
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                            )}
                                                                            {onDelete && (
                                                                                <button 
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (confirm(`Are you absolutely sure you want to permanently delete/purge duplicate AP Entry #${item.invoiceNumber || item.id}?`)) {
                                                                                            onDelete(item);
                                                                                        }
                                                                                    }}
                                                                                    className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-black text-[10px] tracking-wide uppercase transition-all cursor-pointer"
                                                                                >
                                                                                    Delete
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* High-fidelity Invoice Image and PDF Attachment Viewer Modal */}
            <AnimatePresence>
                {viewingRecordDetail && (
                    <AccountsPayableDetailModal
                        item={viewingRecordDetail}
                        vendors={vendors}
                        suppliers={suppliers}
                        projects={projects}
                        companies={companies}
                        onClose={() => setViewingRecordDetail(null)}
                    />
                )}
                {viewingBill && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-md no-print">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh] border border-slate-100"
                        >
                            {/* Header */}
                            <div className="p-6 sm:p-8 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-indigo-600" />
                                        <span>Supplier Invoice Attached Document</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Rendered dynamically beneath secure sandbox constraints</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <a 
                                        href={viewingBill} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                        title="Open file in separate tab"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Open in New Tab</span>
                                    </a>
                                    <button 
                                        onClick={() => setViewingBill(null)} 
                                        className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200/50"
                                        type="button"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Body */}
                            <div className="p-6 overflow-y-auto flex items-center justify-center bg-slate-100/50 flex-1 min-h-[400px]">
                                {viewingBill.startsWith('data:application/pdf') ? (
                                    <div className="w-full h-[55vh] rounded-2xl overflow-hidden border border-slate-200 bg-white">
                                        <object 
                                            data={viewingBill} 
                                            type="application/pdf" 
                                            className="w-full h-full"
                                        >
                                            <iframe 
                                                src={viewingBill} 
                                                className="w-full h-full border-none"
                                                title="Supplier Invoice PDF Viewer"
                                            />
                                        </object>
                                    </div>
                                ) : (
                                    <img 
                                        src={viewingBill} 
                                        alt="Supplier Invoice Document" 
                                        className="max-w-full max-h-[55vh] object-contain rounded-2xl shadow-md border border-slate-200 bg-white p-1"
                                        referrerPolicy="no-referrer"
                                    />
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
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

    let textX = 38;
    if (company?.logo && company.logo.startsWith('data:image')) {
        try {
            doc.addImage(company.logo, 'PNG', 15, 12, 18, 18);
            textX = 38;
        } catch (e) {
            console.error("Error drawing logo on pdf:", e);
            textX = 15;
        }
    } else {
        doc.setFillColor(59, 130, 246);
        doc.circle(24, 21, 9, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        const initial = company?.name ? company.name.substring(0, 2).toUpperCase() : 'CO';
        doc.text(initial, 24, 24, { align: 'center' });
        textX = 38;
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(company?.name || "PIONEER DMS GROUP LTD", textX, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    
    let sellerDetailsY = 21;
    doc.text(company?.address || "United Arab Emirates", textX, sellerDetailsY);
    sellerDetailsY += 4.2;
    
    const emailStr = company?.email ? `Email: ${company.email}` : "Email: accounts@pioneer.ae";
    doc.text(emailStr, textX, sellerDetailsY);
    sellerDetailsY += 4.2;
    
    const phoneStr = company?.phone ? `Phone: ${company.phone}` : "Phone: +971 4 000 0000";
    doc.text(phoneStr, textX, sellerDetailsY);
    sellerDetailsY += 4.2;
    
    let trnStr = "";
    if (company?.trn || item.companyTrn) {
        trnStr = `Supplier TRN (VAT ID): ${company?.trn || item.companyTrn}`;
    } else {
        trnStr = `Supplier TRN (VAT ID): 100459382100003`;
    }
    doc.text(trnStr, textX, sellerDetailsY);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(item.invoiceType === 'Proforma Invoice' ? "PROFORMA INVOICE" : "TAX INVOICE", 195, 24.8, { align: 'right' });

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.4);
    doc.line(15, 36, 195, 36);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("BILLED TO", 15, 44);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(client?.name || item.contact || "Valued Client", 15, 50);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
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
    let bY = 55;
    clientDetails.filter(Boolean).forEach(line => {
        doc.text(line, 15, bY);
        bY += 4.0;
    });

    // Right Column: Invoice Details Table Box (Moves Downside)
    const activeRows: { label: string; value: string; isBold?: boolean; isStatus?: boolean }[] = [
        { label: "Invoice No:", value: String(item.invoiceNumber || 'INV-0000'), isBold: true },
        { label: "Invoice Ref No:", value: String(item.invoiceRef || '-') },
        { label: "Invoice Date:", value: String(item.date) },
        { label: "Month of:", value: String(item.monthOf || '-') },
        { label: "Project:", value: String(item.entityType === 'Project' ? (client?.name || '-') : '-') },
        { label: "Project LPO No:", value: String(item.projectLpoNo || '-') },
    ];
    if (item.startDate && String(item.startDate).trim() !== '') {
        activeRows.push({ label: "Starting Date:", value: String(item.startDate) });
    }
    if (item.endDate && String(item.endDate).trim() !== '') {
        activeRows.push({ label: "Ending Date:", value: String(item.endDate) });
    }
    activeRows.push({ label: "Due Date:", value: String(item.dueDate || item.date) });
    activeRows.push({ label: "Status:", value: String(item.status || 'Pending').toUpperCase(), isStatus: true });

    const startY = 41;
    const rowHeight = 4.2;
    const boxWidth = 80;
    const boxLeft = 115;
    const totalHeight = activeRows.length * rowHeight;

    // Draw background
    doc.setFillColor(255, 255, 255);
    doc.rect(boxLeft, startY, boxWidth, totalHeight, 'F');

    activeRows.forEach((row, idx) => {
        const currentY = startY + (idx * rowHeight);
        
        // Fill label (left cell) column with soft gray background
        doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
        doc.rect(boxLeft, currentY, 32, rowHeight, 'F');
        
        // Horizontal divider lines
        if (idx > 0) {
            doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
            doc.setLineWidth(0.15);
            doc.line(boxLeft, currentY, boxLeft + boxWidth, currentY);
        }
        
        // Print Label Text
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(lightText[0], lightText[1], lightText[2]);
        doc.text(row.label, boxLeft + 2.5, currentY + 3.0);
        
        // Print Value Text
        doc.setFont("Helvetica", row.isBold ? "bold" : "normal");
        doc.setFontSize(7.5);
        if (row.isStatus) {
            if (row.value === 'RECEIVED') {
                doc.setTextColor(16, 124, 65);
                doc.setFont("Helvetica", "bold");
            } else {
                doc.setTextColor(220, 95, 0);
                doc.setFont("Helvetica", "bold");
            }
        } else {
            doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
        }
        doc.text(row.value, boxLeft + 34, currentY + 3.0);
    });

    // Draw vertical cell dividing line
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.2);
    doc.line(boxLeft + 32, startY, boxLeft + 32, startY + totalHeight);

    // Draw outer frame border around details table
    doc.rect(boxLeft, startY, boxWidth, totalHeight, 'D');

    let yPos = Math.max(85, startY + totalHeight + 4);

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

    // Gross Subtotal
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("Sub Total (Gross):", 120, yPos);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(`AED ${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

    // VAT
    yPos += 6;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("VAT (5.0%):", 120, yPos);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(`AED ${Number(item.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

    // Deduction / Retention if applicable
    if (item.deduction && item.deduction > 0) {
        yPos += 6;
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(185, 28, 28); // red/rose text
        doc.text("Deduction/Retention (-):", 120, yPos);
        doc.setFont("Helvetica", "bold");
        doc.text(`AED -${Number(item.deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });
    }

    // Adjustment: ONLY visible if entered (not 0, not undefined)
    if (item.adjustmentAmount && item.adjustmentAmount > 0) {
        yPos += 6;
        const sign = item.adjustmentType === '-' ? '-' : '+';
        doc.setFont("Helvetica", "normal");
        if (item.adjustmentType === '-') {
            doc.setTextColor(185, 28, 28); // rose
            doc.text(`Adjustment (-):`, 120, yPos);
        } else {
            doc.setTextColor(16, 124, 65); // emerald
            doc.text(`Adjustment (+):`, 120, yPos);
        }
        doc.setFont("Helvetica", "bold");
        doc.text(`AED ${sign}${Number(item.adjustmentAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });
    }

    // Total Amount Box
    yPos += 8;
    doc.setFillColor(240, 246, 255);
    doc.setDrawColor(200, 220, 255);
    doc.rect(115, yPos - 5, 80, 10, 'F');
    doc.rect(115, yPos - 5, 80, 10, 'D');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("Grand Total (Incl. VAT):", 119, yPos + 1.2);
    doc.setFontSize(10);
    doc.text(`AED ${Number(item.totalAmount || item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos + 1.2, { align: 'right' });

    if (item.status === 'Partially Received') {
        const { paidAmt, balanceAmt } = getSOAItemAmounts(item);
        yPos += 8;
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
        doc.rect(115, yPos - 4, 80, 7.5, 'F');
        doc.rect(115, yPos - 4, 80, 7.5, 'D');
        doc.setFontSize(8.5);
        doc.setTextColor(5, 150, 105);
        doc.text("Amount Received:", 119, yPos + 1);
        doc.text(`AED ${paidAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos + 1, { align: 'right' });

        yPos += 7.5;
        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(254, 205, 211);
        doc.rect(115, yPos - 4, 80, 8, 'F');
        doc.rect(115, yPos - 4, 80, 8, 'D');
        doc.setFontSize(8.5);
        doc.setTextColor(225, 29, 72);
        doc.text("Balance Due (Pending):", 119, yPos + 1.2);
        doc.setFontSize(9);
        doc.text(`AED ${balanceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, yPos + 1.2, { align: 'right' });
    }

    // Advance position past the totals blocks
    yPos += 12;
    if (yPos > 240) {
        doc.addPage();
        yPos = 30;
    }

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(15, yPos, 195, yPos);
    yPos += 6;

    // LEFT COLUMN: TERMS & VERIFICATION NOTICE
    const verificationNoticeText = (item.description && item.description.trim()) 
        ? item.description.trim() 
        : "All invoices must be verified and certified within 3 days if not response within 3 days the invoices should considered certified and approved.";

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("TERMS & VERIFICATION NOTICE", 15, yPos);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    const splitNotice = doc.splitTextToSize(`Verification Notice: ${verificationNoticeText}`, 105);
    doc.text(splitNotice, 15, yPos + 4.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text([
        "1. Please reference the Invoice Number on bank transfers.",
        "2. Payment is due within the stipulated credit days.",
        "3. Standard 5% UAE VAT applies to overall civil items."
    ], 15, yPos + 5 + (splitNotice.length * 3.5));

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

    // Draw Bank Details Box below Terms & Conditions and Authorized Signatory
    let finalBoxY = yPos + 23;
    if (finalBoxY + 30 > 280) {
        doc.addPage();
        finalBoxY = 25;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(15, finalBoxY, 98, 30, 2, 2, 'FD');

    // Box Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(59, 130, 246);
    doc.text("Bank Details:", 18, finalBoxY + 4.5);

    // Beneficiary Row
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(100, 116, 139);
    doc.text("Beneficiary:", 18, finalBoxY + 9.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(defaultBank.accountName || "N/A", 42, finalBoxY + 9.5);

    // Bank Name Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Bank Name:", 18, finalBoxY + 13.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(defaultBank.bankName || "N/A", 42, finalBoxY + 13.5);

    // Account No Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Account No:", 18, finalBoxY + 17.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(33, 37, 41);
    doc.text(defaultBank.accountNumber || "N/A", 42, finalBoxY + 17.5);

    // IBAN Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("IBAN:", 18, finalBoxY + 21.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text(defaultBank.iban || "N/A", 42, finalBoxY + 21.5);

    // Swift / Currency Row
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Swift / Currency:", 18, finalBoxY + 25.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(33, 37, 41);
    doc.text(`${defaultBank.swiftCode || "N/A"} / ${defaultBank.currency || "AED"}`, 42, finalBoxY + 25.5);

    // Cheque Settlement Box (Parallel to Bank Details on Right)
    const hasCheques = (item.cheques && item.cheques.length > 0) || (item.chequeNo || item.chequeDate || item.chequeAmount);
    if (hasCheques) {
        doc.setFillColor(254, 249, 235);
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.35);
        doc.roundedRect(118, finalBoxY, 74, 30, 2, 2, 'FD');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text("Cheque Settlement:", 121, finalBoxY + 4.5);

        if (item.cheques && item.cheques.length > 0) {
            let chqY = finalBoxY + 9.5;
            item.cheques.slice(0, 2).forEach((c: any, cIdx: number) => {
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(6.8);
                doc.setTextColor(100, 116, 139);
                doc.text(`Chq #${c.chequeNo || (cIdx + 1)}:`, 121, chqY);
                doc.setFont("Helvetica", "bold");
                doc.setTextColor(33, 37, 41);
                doc.text(`AED ${Number(c.chequeAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 189, chqY, { align: 'right' });
                
                chqY += 3.5;
                doc.setFont("Helvetica", "normal");
                doc.setFontSize(6.0);
                doc.setTextColor(120, 120, 120);
                const metaText = [c.chequeDate ? `Date: ${c.chequeDate}` : '', c.remarks || ''].filter(Boolean).join(' - ');
                doc.text(metaText || 'Cheque Clearance', 121, chqY);
                chqY += 4.5;
            });
            if (item.cheques.length > 2) {
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(180, 83, 9);
                doc.text(`+ ${item.cheques.length - 2} more cheque(s) recorded`, 121, chqY);
            }
        } else {
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text("Cheque No:", 121, finalBoxY + 9.5);
            doc.setFont("Helvetica", "bold");
            doc.setTextColor(33, 37, 41);
            doc.text(item.chequeNo || "-", 150, finalBoxY + 9.5);

            doc.setTextColor(100, 116, 139);
            doc.text("Cheque Date:", 121, finalBoxY + 15.0);
            doc.setTextColor(33, 37, 41);
            doc.text(item.chequeDate || "-", 150, finalBoxY + 15.0);

            doc.setTextColor(100, 116, 139);
            doc.text("Cheque Amt:", 121, finalBoxY + 20.5);
            doc.setTextColor(180, 83, 9);
            doc.text(`AED ${Number(item.chequeAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 150, finalBoxY + 20.5);
        }
    }

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 289, 210, 8, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Official electronic ${item.invoiceType === 'Proforma Invoice' ? 'proforma' : 'tax'} invoice generated inside Pioneer Group DMS.`, 105, 294, { align: "center" });

    doc.save(`Invoice_${item.invoiceNumber || 'INV'}.pdf`);
};

export const downloadTaxCreditNotePDF = async (
    item: CreditNote, 
    company?: any, 
    client?: any, 
    bankAccounts: any[] = []
) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const primaryColor = [190, 24, 93]; // Rose-700 for Credit Note distinction
    const secondaryColor = [30, 41, 59]; // Slate-800
    const lightBg = [253, 242, 248]; // Rose-50
    const borderColor = [244, 114, 182]; // Rose-400

    // Top Brand Accent Stripe
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 5, 'F');

    // Watermark Background
    try {
        const assets = getPioneerPDFAssets();
        if (assets.watermark) {
            (doc as any).saveGraphicsState?.();
            (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.04 }));
            doc.addImage(assets.watermark, 'PNG', 45, 90, 120, 120);
            (doc as any).restoreGraphicsState?.();
        }
    } catch (e) {}

    // Company Header
    const companyName = company?.name || item.companyName || "Pioneer General Contracting LLC";
    const companyTrn = company?.trn || item.companyTrn || "100459382100003";
    const companyAddress = company?.address || "Abu Dhabi / Dubai, United Arab Emirates";
    const companyEmail = company?.email || "accounts@pioneerdms.ae";
    const companyPhone = company?.phone || "+971 2 644 4455";

    // Logo / Initials Badge
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(14, 12, 16, 16, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CN", 22, 22.5, { align: "center" });

    // Company Information
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text(companyName, 34, 18);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(companyAddress, 34, 23);
    doc.text(`Email: ${companyEmail}  |  Tel: ${companyPhone}`, 34, 27);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Supplier TRN (VAT ID): ${companyTrn}`, 34, 31);

    // Document Title Banner (Right Header)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("TAX CREDIT NOTE", 196, 18, { align: "right" });
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("UAE FTA VAT COMPLIANT", 196, 23.5, { align: "right" });

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(159, 18, 57);
    doc.text(`ORIGINAL REF: INV #${item.originalInvoiceNumber || 'N/A'}`, 196, 29, { align: "right" });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    // Meta Columns: Billed To (Left) & Credit Note Details (Right)
    const clientName = client?.name || item.clientName || "Valued Client";
    const clientTrn = client?.trn || item.clientTrn || "N/A / Unregistered";
    const clientAddress = client?.address || item.clientAddress || "United Arab Emirates";
    const clientEmail = client?.email || item.clientEmail || "";
    const clientPhone = client?.phone || item.clientPhone || "";

    // Left Box: Billed To / Recipient
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 38, 88, 38, 2, 2, 'FD');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CREDITED TO / RECIPIENT DETAILS", 18, 44);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(doc.splitTextToSize(clientName, 80), 18, 50);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(clientAddress, 80), 18, 56);
    if (clientEmail || clientPhone) {
        doc.text(`${clientEmail} ${clientPhone ? ' | ' + clientPhone : ''}`, 18, 62);
    }
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Recipient TRN: ${clientTrn}`, 18, 68);

    // Right Box: Credit Note Info
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(108, 38, 88, 38, 2, 2, 'FD');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CREDIT NOTE SPECIFICATIONS", 112, 44);

    const rightFields = [
        ["Credit Note No:", item.creditNoteNumber || `CN-${item.originalInvoiceNumber || '001'}`],
        ["Credit Note Date:", item.date || new Date().toISOString().split('T')[0]],
        ["Original Tax Invoice:", `#${item.originalInvoiceNumber || 'N/A'}`],
        ["Original Invoice Date:", item.originalInvoiceDate || "As per record"],
        ["Original Inv. Amount:", item.originalInvoiceAmount ? `AED ${Number(item.originalInvoiceAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "N/A"]
    ];

    let rY = 49;
    rightFields.forEach(([label, val]) => {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, 112, rY);

        doc.setFont("Helvetica", "bold");
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(String(val), 192, rY, { align: "right" });
        rY += 5;
    });

    // Reason for Issuance Box
    const reasonBoxY = 79;
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(14, reasonBoxY, 182, 15, 2, 2, 'FD');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(159, 18, 57);
    doc.text("REASON FOR ISSUING TAX CREDIT NOTE:", 18, reasonBoxY + 5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const reasonText = item.reason || `Cancellation of previous invoice #${item.originalInvoiceNumber} due to revision with updated billing amount.`;
    const revisedNote = item.revisedInvoiceNumber ? ` [Revised Invoice Ref: #${item.revisedInvoiceNumber}${item.revisedInvoiceAmount ? ' - AED ' + Number(item.revisedInvoiceAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}]` : '';
    doc.text(doc.splitTextToSize(`${reasonText}${revisedNote}`, 174), 18, reasonBoxY + 10);

    // Line Items Table
    const tableItems = (item.items && item.items.length > 0) ? item.items : [
        {
            id: '1',
            name: `Tax Credit against Invoice #${item.originalInvoiceNumber || 'N/A'}`,
            description: item.reason || 'Full credit of previous invoice value',
            quantity: 1,
            rate: item.amount || 0,
            total: item.amount || 0
        }
    ];

    const tableRows = tableItems.map((rowItem, idx) => {
        const rowTaxable = rowItem.total !== undefined ? Number(rowItem.total) : (Number(rowItem.quantity || 1) * Number(rowItem.rate || 0));
        const rowVat = Number((rowTaxable * 0.05).toFixed(2));
        const rowTotal = Number((rowTaxable + rowVat).toFixed(2));

        return [
            (idx + 1).toString(),
            `${rowItem.name || 'Credit Item'}\n${rowItem.description ? rowItem.description : ''}`.trim(),
            (rowItem.quantity || 1).toString(),
            Number(rowItem.rate || rowTaxable).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            rowTaxable.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            "5.00%",
            rowVat.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })
        ];
    });

    (doc as any).autoTable({
        startY: reasonBoxY + 18,
        head: [['#', 'Item & Description', 'Qty', 'Rate (AED)', 'Taxable (AED)', 'VAT %', 'VAT (AED)', 'Total (AED)']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 41, 59],
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 54 },
            2: { halign: 'center', cellWidth: 14 },
            3: { halign: 'right', cellWidth: 24 },
            4: { halign: 'right', cellWidth: 26 },
            5: { halign: 'center', cellWidth: 14 },
            6: { halign: 'right', cellWidth: 18 },
            7: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }
        },
        styles: {
            cellPadding: 2.5,
            lineColor: [226, 232, 240],
            lineWidth: 0.2
        },
        margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 160;

    // Totals Box (Right Side)
    const totalsBoxY = finalY + 4;
    const taxableAmt = item.amount !== undefined ? Number(item.amount) : Number((item.totalAmount / 1.05).toFixed(2));
    const vatAmt = item.vatAmount !== undefined ? Number(item.vatAmount) : Number((item.totalAmount - taxableAmt).toFixed(2));
    const totalAmt = item.totalAmount !== undefined ? Number(item.totalAmount) : Number((taxableAmt + vatAmt).toFixed(2));

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(114, totalsBoxY, 82, 34, 2, 2, 'FD');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Total Taxable Value Credited:", 118, totalsBoxY + 8);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`AED ${taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 192, totalsBoxY + 8, { align: "right" });

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Output VAT Credited (5.0%):", 118, totalsBoxY + 16);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`AED ${vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 192, totalsBoxY + 16, { align: "right" });

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.4);
    doc.line(118, totalsBoxY + 20, 192, totalsBoxY + 20);

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(116, totalsBoxY + 22, 78, 9, 1.5, 1.5, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("TOTAL CREDITED AMOUNT:", 119, totalsBoxY + 28);
    doc.setFontSize(9.5);
    doc.text(`AED ${totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 191, totalsBoxY + 28, { align: "right" });

    // Legal / FTA VAT Compliance Box (Left Side)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, totalsBoxY, 94, 34, 2, 2, 'FD');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("FTA VAT COMPLIANCE & LEGAL NOTICE:", 18, totalsBoxY + 7);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const legalNotice = `This Tax Credit Note is issued in accordance with Article (60) of the Executive Regulations of UAE Federal Decree-Law No. (8) of 2017 on Value Added Tax. It fully amends / credits Tax Invoice #${item.originalInvoiceNumber || ''}. The output tax and payable client ledger balances have been credited accordingly.`;
    doc.text(doc.splitTextToSize(legalNotice, 86), 18, totalsBoxY + 12);

    // Signatory & Bank Details Section
    const signBoxY = totalsBoxY + 40;
    
    // Left: Bank details reference
    const defaultBank = bankAccounts && bankAccounts.length > 0 ? bankAccounts[0] : {
        bankName: "ADCB / First Abu Dhabi Bank",
        accountName: companyName,
        iban: "AE000000000000000000000"
    };

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, signBoxY, 94, 28, 2, 2, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("ORIGINAL SETTLEMENT ACCOUNT", 18, signBoxY + 6);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Bank: ${defaultBank.bankName || "ADCB / FAB"}`, 18, signBoxY + 12);
    doc.text(`A/C Name: ${defaultBank.accountName || companyName}`, 18, signBoxY + 17);
    doc.text(`IBAN: ${defaultBank.iban || "AE..."}`, 18, signBoxY + 22);

    // Right: Authorized Signatory Block
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(114, signBoxY, 82, 28, 2, 2, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("FOR PIONEER GENERAL CONTRACTING LLC", 118, signBoxY + 6);

    doc.setDrawColor(203, 213, 225);
    doc.line(118, signBoxY + 19, 190, signBoxY + 19);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Authorized Finance & Tax Signatory", 118, signBoxY + 24);

    // Bottom Stripe
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 289, 210, 8, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Official UAE FTA Tax Credit Note generated inside Pioneer Group DMS. Document Reference: ${item.creditNoteNumber || 'CN'}`, 105, 294, { align: "center" });

    doc.save(`Tax_Credit_Note_${item.creditNoteNumber || item.originalInvoiceNumber || 'CN'}.pdf`);
};

export const printTaxCreditNotePreview = (
    item: CreditNote, 
    company?: any, 
    client?: any, 
    bankAccounts: any[] = []
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups for this site to print.");
        return;
    }

    const companyName = company?.name || item.companyName || "Pioneer General Contracting LLC";
    const companyTrn = company?.trn || item.companyTrn || "100459382100003";
    const companyAddress = company?.address || "Abu Dhabi / Dubai, United Arab Emirates";
    const clientName = client?.name || item.clientName || "Valued Client";
    const clientTrn = client?.trn || item.clientTrn || "N/A";
    const clientAddress = client?.address || item.clientAddress || "United Arab Emirates";
    
    const taxableAmt = item.amount !== undefined ? Number(item.amount) : Number((item.totalAmount / 1.05).toFixed(2));
    const vatAmt = item.vatAmount !== undefined ? Number(item.vatAmount) : Number((item.totalAmount - taxableAmt).toFixed(2));
    const totalAmt = item.totalAmount !== undefined ? Number(item.totalAmount) : Number((taxableAmt + vatAmt).toFixed(2));

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Tax Credit Note - ${item.creditNoteNumber || 'CN'}</title>
        <meta charset="utf-8" />
        <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #be185d; padding-bottom: 12px; margin-bottom: 16px; }
            .company-name { font-size: 18px; font-weight: 900; color: #1e293b; }
            .doc-title { font-size: 20px; font-weight: 900; color: #be185d; text-align: right; }
            .arabic-title { font-size: 14px; color: #64748b; text-align: right; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .card.highlight { background: #fdf2f8; border-color: #f472b6; }
            .card-title { font-size: 10px; font-weight: 900; color: #be185d; text-transform: uppercase; margin-bottom: 6px; }
            .reason-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #be185d; color: white; padding: 8px; font-size: 11px; text-align: left; }
            th.right, td.right { text-align: right; }
            th.center, td.center { text-align: center; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            .totals-table { width: 320px; margin-left: auto; margin-bottom: 20px; }
            .totals-table td { padding: 6px 8px; }
            .grand-total { background: #fdf2f8; color: #be185d; font-weight: 900; font-size: 14px; }
            .footer-notice { border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #64748b; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
            .sign-box { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 6px; font-size: 11px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="company-name">${companyName}</div>
                <div style="color: #64748b; font-size: 11px;">${companyAddress}</div>
                <div style="color: #be185d; font-weight: bold; margin-top: 4px;">Supplier TRN: ${companyTrn}</div>
            </div>
            <div>
                <div class="doc-title">TAX CREDIT NOTE</div>
                <div class="arabic-title">ŸÅÿßÿ™Ÿàÿ±ÿ© ÿ∂ÿ±Ÿäÿ®Ÿäÿ© ÿØÿßÿ¶ŸÜÿ©</div>
                <div style="font-weight: bold; color: #9f1239; font-size: 11px; margin-top: 4px;">REF INV: #${item.originalInvoiceNumber}</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="card-title">CREDITED TO / RECIPIENT</div>
                <div style="font-weight: bold; font-size: 13px;">${clientName}</div>
                <div style="color: #64748b; margin-top: 2px;">${clientAddress}</div>
                <div style="font-weight: bold; margin-top: 6px;">Client TRN: ${clientTrn}</div>
            </div>
            <div class="card highlight">
                <div class="card-title">CREDIT NOTE DETAILS</div>
                <div><strong>Credit Note #:</strong> ${item.creditNoteNumber || 'CN-' + item.originalInvoiceNumber}</div>
                <div><strong>Date:</strong> ${item.date}</div>
                <div><strong>Original Invoice #:</strong> #${item.originalInvoiceNumber}</div>
                <div><strong>Original Inv. Date:</strong> ${item.originalInvoiceDate || 'N/A'}</div>
                <div><strong>Original Inv. Amount:</strong> AED ${item.originalInvoiceAmount ? Number(item.originalInvoiceAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</div>
            </div>
        </div>

        <div class="reason-box">
            <div style="font-weight: bold; color: #9f1239; font-size: 10px; text-transform: uppercase;">Reason for Issuance / ÿ≥ÿ®ÿ® ÿ•ÿµÿØÿßÿ± ÿßŸÑÿ•ÿ¥ÿπÿßÿ± ÿßŸÑÿØÿßÿ¶ŸÜ:</div>
            <div style="margin-top: 4px; font-size: 11px;">${item.reason || 'Cancellation of previous invoice due to revision with updated billing amount.'} ${item.revisedInvoiceNumber ? `(Revised Invoice Ref: #${item.revisedInvoiceNumber})` : ''}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th class="center" style="width: 30px;">#</th>
                    <th>Item & Description</th>
                    <th class="center" style="width: 50px;">Qty</th>
                    <th class="right" style="width: 90px;">Rate (AED)</th>
                    <th class="right" style="width: 100px;">Taxable (AED)</th>
                    <th class="center" style="width: 60px;">VAT %</th>
                    <th class="right" style="width: 80px;">VAT (AED)</th>
                    <th class="right" style="width: 100px;">Total (AED)</th>
                </tr>
            </thead>
            <tbody>
                ${((item.items && item.items.length > 0) ? item.items : [{ id: '1', name: 'Tax Credit against Invoice #' + item.originalInvoiceNumber, description: item.reason || '', quantity: 1, rate: item.amount || 0, total: item.amount || 0 }]).map((r, i) => {
                    const rowTax = r.total !== undefined ? Number(r.total) : (Number(r.quantity || 1) * Number(r.rate || 0));
                    const rowVat = Number((rowTax * 0.05).toFixed(2));
                    const rowTot = Number((rowTax + rowVat).toFixed(2));
                    return `
                        <tr>
                            <td class="center">${i + 1}</td>
                            <td><strong>${r.name || 'Credit Item'}</strong><br/><span style="color:#64748b; font-size:10px;">${r.description || ''}</span></td>
                            <td class="center">${r.quantity || 1}</td>
                            <td class="right">${Number(r.rate || rowTax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td class="right">${rowTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td class="center">5.0%</td>
                            <td class="right">${rowVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td class="right" style="font-weight:bold;">${rowTot.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <table class="totals-table">
            <tr>
                <td>Total Taxable Value Credited:</td>
                <td class="right"><strong>AED ${taxableAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
            </tr>
            <tr>
                <td>Output VAT Credited (5.0%):</td>
                <td class="right" style="color: #be185d;"><strong>AED ${vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
            </tr>
            <tr class="grand-total">
                <td>GRAND TOTAL CREDITED:</td>
                <td class="right">AED ${totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        </table>

        <div class="footer-notice">
            <strong>FTA VAT Compliance Note:</strong> This Tax Credit Note is issued in accordance with Article (60) of the Executive Regulation of UAE Federal Decree-Law No. (8) of 2017 on Value Added Tax. It amends and credits Tax Invoice #${item.originalInvoiceNumber}.
        </div>

        <div class="signatures">
            <div class="sign-box">Prepared by: Finance Dept</div>
            <div class="sign-box">Authorized Signatory / Tax Stamp</div>
        </div>

        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

export const resolveItemDetails = (
    itm: any, 
    isReceivable: boolean, 
    vendors: any[] = [], 
    suppliers: any[] = [], 
    projects: any[] = []
) => {
    let clientSupplierName = 'N/A';
    let projectCodeName = 'General / Unassigned';

    if (isReceivable) {
        // Accounts Receivable record
        if (itm.entityType === 'Vendor') {
            const v = vendors.find((x: any) => x.id === itm.entityId);
            if (v) {
                clientSupplierName = v.code ? `${v.name} (${v.code})` : v.name;
            } else {
                clientSupplierName = itm.clientName || 'Client';
            }
        } else if (itm.entityType === 'Supplier') {
            const s = suppliers.find((x: any) => x.id === itm.entityId);
            if (s) {
                clientSupplierName = s.code ? `${s.name} (${s.code})` : s.name;
            } else {
                clientSupplierName = itm.supplierName || 'Supplier';
            }
        } else if (itm.entityType === 'Project') {
            const p = projects.find((x: any) => x.id === itm.entityId || x.id === itm.projectId);
            if (p) {
                clientSupplierName = p.clientName || 'Client';
                projectCodeName = p.code ? `[${p.code}] ${p.name}` : p.name;
            }
        }

        // Project fallback
        if (projectCodeName === 'General / Unassigned') {
            const targetProjId = itm.projectId || (itm.entityType === 'Project' ? itm.entityId : null);
            const p = projects.find((x: any) => x.id === targetProjId || x.name === itm.projectName);
            if (p) {
                projectCodeName = p.code ? `[${p.code}] ${p.name}` : p.name;
                if (clientSupplierName === 'N/A' && p.clientName) {
                    clientSupplierName = p.clientName;
                }
            } else if (itm.projectName || itm.projectCode) {
                projectCodeName = itm.projectCode ? `[${itm.projectCode}] ${itm.projectName || ''}` : (itm.projectName || 'General / Unassigned');
            }
        }

        if (clientSupplierName === 'N/A') {
            clientSupplierName = itm.clientName || itm.supplierName || 'General Client';
        }
    } else {
        // Accounts Payable record
        if (itm.vendorType === 'Supplier' || !itm.vendorType) {
            const s = suppliers.find((x: any) => x.id === itm.vendorId);
            if (s) {
                clientSupplierName = s.code ? `${s.name} (${s.code})` : s.name;
            } else {
                clientSupplierName = itm.supplierName || 'Supplier';
            }
        }
        
        if (clientSupplierName === 'Supplier' || clientSupplierName === 'N/A') {
            const v = vendors.find((x: any) => x.id === itm.vendorId);
            if (v) {
                clientSupplierName = v.code ? `${v.name} (${v.code})` : v.name;
            }
        }

        if (clientSupplierName === 'N/A' || clientSupplierName === 'Supplier') {
            clientSupplierName = itm.supplierName || itm.vendorName || 'General Supplier';
        }

        // Project
        const p = projects.find((x: any) => x.id === itm.projectId || x.name === itm.projectName);
        if (p) {
            projectCodeName = p.code ? `[${p.code}] ${p.name}` : p.name;
        } else if (itm.projectName || itm.projectCode) {
            projectCodeName = itm.projectCode ? `[${itm.projectCode}] ${itm.projectName || ''}` : (itm.projectName || 'General / Operations');
        } else {
            projectCodeName = 'General / Operations';
        }
    }

    return {
        clientSupplierName: (clientSupplierName || 'N/A').trim(),
        projectCodeName: (projectCodeName || 'General / Unassigned').trim()
    };
};

export const formatToDDMMYYYY = (dateVal: any) => {
    if (!dateVal) return '-';
    const str = String(dateVal).trim();
    if (!str) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-');
        return `${d}-${m}-${y}`;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
        const [y, m, d] = str.split('/');
        return `${d}-${m}-${y}`;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        return str;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}-${month}-${year}`;
    }
    return str;
};

export const getSOAItemAmounts = (itm: any) => {
    if (itm.isCreditNote) {
        const actualAmt = Number(itm.actualAmount || 0);
        const vatAmt = Number(itm.vatAmount || 0);
        const totalAmt = Number(itm.totalAmount !== undefined ? itm.totalAmount : (actualAmt + vatAmt));
        const paidAmt = Number(itm.receivedAmount !== undefined ? itm.receivedAmount : (itm.paidAmount || 0));
        const balanceAmt = Number(itm.balanceAmount !== undefined ? itm.balanceAmount : (totalAmt - paidAmt));
        return { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt };
    }
    const actualAmt = Number(itm.actualAmount !== undefined ? itm.actualAmount : (itm.amount || 0));
    const vatAmt = Number(itm.vatAmount || 0);
    const totalAmt = Number(itm.totalAmount !== undefined ? itm.totalAmount : actualAmt + vatAmt);
    
    let paidAmt = 0;
    const isFullPaid = itm.status === 'Paid' || itm.status === 'Received';
    const isPartial = itm.status === 'Partially Received' || itm.status === 'Partial Received' || 
                      itm.status === 'Partial Amount Received by Cheque' || itm.status === 'Partially Received by Cheque' || itm.status === 'Partial Rec by Chq' ||
                      itm.status === 'Partially Paid' || itm.status === 'Partial Paid' ||
                      itm.status === 'Partial Amount Paid by Cheque' || itm.status === 'Partially Paid by Cheque' || itm.status === 'Partial Paid by Chq';
    
    if (isFullPaid) {
        paidAmt = totalAmt;
    } else if (isPartial) {
        if (itm.receivedAmount !== undefined && Number(itm.receivedAmount) > 0) {
            paidAmt = Number(itm.receivedAmount);
        } else if (itm.paidAmount !== undefined && Number(itm.paidAmount) > 0) {
            paidAmt = Number(itm.paidAmount);
        } else if (itm.amountReceived !== undefined && Number(itm.amountReceived) > 0) {
            paidAmt = Number(itm.amountReceived);
        } else if (itm.paid !== undefined && Number(itm.paid) > 0) {
            paidAmt = Number(itm.paid);
        } else if (itm.balanceAmount !== undefined && Number(itm.balanceAmount) > 0 && Number(itm.balanceAmount) < totalAmt) {
            paidAmt = Math.max(0, totalAmt - Number(itm.balanceAmount));
        } else if (itm.balance !== undefined && Number(itm.balance) > 0 && Number(itm.balance) < totalAmt) {
            paidAmt = Math.max(0, totalAmt - Number(itm.balance));
        } else if (itm.adjustmentType === '-' && Number(itm.adjustmentAmount) > 0) {
            paidAmt = Number(itm.adjustmentAmount);
        } else if (Number(itm.adjustmentAmount) > 0) {
            paidAmt = Number(itm.adjustmentAmount);
        }
    } else if (itm.status === 'Pending' || itm.status === 'CPD Pending' || itm.status === 'PDC in Hand' || itm.status === 'PDC Issued') {
        if (itm.receivedAmount !== undefined && Number(itm.receivedAmount) > 0 && itm.receivedAmount < totalAmt) {
            paidAmt = Number(itm.receivedAmount);
        } else if (itm.paidAmount !== undefined && Number(itm.paidAmount) > 0 && itm.paidAmount < totalAmt) {
            paidAmt = Number(itm.paidAmount);
        } else if (itm.paid !== undefined && Number(itm.paid) > 0 && itm.paid < totalAmt) {
            paidAmt = Number(itm.paid);
        } else {
            paidAmt = 0;
        }
    } else {
        if (itm.receivedAmount !== undefined && Number(itm.receivedAmount) > 0) {
            paidAmt = Number(itm.receivedAmount);
        } else if (itm.paidAmount !== undefined && Number(itm.paidAmount) > 0) {
            paidAmt = Number(itm.paidAmount);
        }
    }

    paidAmt = Math.min(totalAmt, Math.max(0, paidAmt));

    let balanceAmt = 0;
    if (isFullPaid) {
        balanceAmt = 0;
    } else {
        balanceAmt = Math.max(0, totalAmt - paidAmt);
    }

    return { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt };
};

export const hasItemCheque = (itm: any): boolean => {
    if (!itm) return false;
    if (itm.cheques && Array.isArray(itm.cheques) && itm.cheques.length > 0) {
        return itm.cheques.some((c: any) => Boolean(
            (c.chequeNo && String(c.chequeNo).trim() && String(c.chequeNo).trim() !== '-') ||
            (c.chequeDate && String(c.chequeDate).trim() && String(c.chequeDate).trim() !== '-') ||
            (Number(c.chequeAmount) > 0) ||
            (c.remarks && String(c.remarks).trim())
        ));
    }
    return Boolean(
        (itm.chequeNo && String(itm.chequeNo).trim() && String(itm.chequeNo).trim() !== '-') ||
        (itm.chequeDate && String(itm.chequeDate).trim() && String(itm.chequeDate).trim() !== '-') ||
        (Number(itm.chequeAmount) > 0) ||
        (itm.remarks && String(itm.remarks).trim())
    );
};

export const getChequeAllocatedAmount = (c: any, totalInvoiceAmt?: number, balanceAmt?: number): number => {
    if (!c) return 0;
    
    // 1. If explicit allocatedAmount is provided and > 0, always use it
    if (c.allocatedAmount !== undefined && c.allocatedAmount !== null && c.allocatedAmount !== '' && Number(c.allocatedAmount) > 0) {
        return Number(c.allocatedAmount);
    }
    
    // 2. Intelligent extraction from remarks
    // Examples:
    // "PAID - 44391.90 & BALANCE - 149,814" -> 44391.90
    // "PAID - 64518.30 & BALANCE - 1,543.50" -> 64518.30
    // "PAID - 18, 945.85 & BALANCE - 39,858.35" -> 18945.85
    // "95,104.80" -> 95104.80
    // "Balance Payment - 64, 180.20" -> 64180.20
    // "BALANCE PAID - 39858.35" -> 39858.35
    if (c.remarks && typeof c.remarks === 'string' && c.remarks.trim()) {
        const str = c.remarks.trim();
        
        // Pattern 1: "PAID - 44391.90" or "PAID : 44,391.90" or "PAID - 44391.90 & BALANCE - 149,814"
        const paidMatch = str.match(/\b(?:PAID|REC|RECEIVED|AMOUNT)\s*[-:]\s*([0-9\s,]+(?:\.[0-9]+)?)/i);
        if (paidMatch && paidMatch[1]) {
            const cleanVal = Number(paidMatch[1].replace(/[\s,]/g, ''));
            if (!isNaN(cleanVal) && cleanVal > 0) {
                return cleanVal;
            }
        }
        
        // Pattern 2: "BALANCE PAID - 39858.35" or "Balance Payment - 64, 180.20" or "BALANCE - 64180.20"
        const balMatch = str.match(/\b(?:BALANCE PAID|BALANCE PAYMENT|BALANCE SETTLED)\s*[-:]\s*([0-9\s,]+(?:\.[0-9]+)?)/i);
        if (balMatch && balMatch[1]) {
            const cleanVal = Number(balMatch[1].replace(/[\s,]/g, ''));
            if (!isNaN(cleanVal) && cleanVal > 0) {
                return cleanVal;
            }
        }
        
        // Pattern 3: Solo number like "95,104.80" or "(95,104.80)"
        const soloMatch = str.match(/^\(?\s*([0-9\s,]+(?:\.[0-9]+)?)\s*\)?$/);
        if (soloMatch && soloMatch[1]) {
            const cleanVal = Number(soloMatch[1].replace(/[\s,]/g, ''));
            if (!isNaN(cleanVal) && cleanVal > 0) {
                return cleanVal;
            }
        }
    }
    
    // 3. Fallback to c.chequeAmount
    const amt = Number(c.chequeAmount) || 0;
    if (balanceAmt !== undefined && balanceAmt > 0 && amt > balanceAmt) {
        // Bulk cheque where no specific split is indicated
        return balanceAmt;
    }
    return amt;
};

export interface ItemChequeBreakdown {
    actualAmt: number;
    vatAmt: number;
    totalAmt: number;
    paidAmt: number;
    balanceAmt: number;
    isSettled: boolean;
    hasRecordedCheque: boolean;
    hasPendingCheque: boolean;
    pendingPdcAmount: number;
    purePendingAmount: number;
    statusLabel: string;
}

export const getItemChequeBreakdown = (itm: any, isReceivable: boolean = true): ItemChequeBreakdown => {
    if (itm.isCreditNote) {
        const { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt } = getSOAItemAmounts(itm);
        return {
            actualAmt,
            vatAmt,
            totalAmt,
            paidAmt,
            balanceAmt,
            isSettled: false,
            hasRecordedCheque: false,
            hasPendingCheque: false,
            pendingPdcAmount: 0,
            purePendingAmount: totalAmt,
            statusLabel: 'Credit Note'
        };
    }
    const { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt } = getSOAItemAmounts(itm);
    const isSettled = itm.status === 'Paid' || itm.status === 'Received' || balanceAmt <= 0;
    const hasRecorded = hasItemCheque(itm);
    const isCPD = itm.status === 'CPD Pending';
    const isExplicitPDC = itm.status === 'PDC in Hand' || itm.status === 'PDC Issued';
    const isPartialCheque = itm.status === 'Partial Amount Received by Cheque' || itm.status === 'Partially Received by Cheque' || itm.status === 'Partial Rec by Chq' ||
                            itm.status === 'Partial Amount Paid by Cheque' || itm.status === 'Partially Paid by Cheque' || itm.status === 'Partial Paid by Chq';
    const isPartial = isPartialCheque || itm.status === 'Partially Received' || itm.status === 'Partial Received' || itm.status === 'Partially Paid' || itm.status === 'Partial Paid';

    let pendingPdcAmount = 0;
    let purePendingAmount = 0;
    let hasPendingCheque = false;

    if (isSettled) {
        pendingPdcAmount = 0;
        purePendingAmount = 0;
        hasPendingCheque = false;
    } else {
        // Collect all valid cheques (from cheques array or single cheque fields)
        let validCheques: any[] = [];
        if (itm.cheques && Array.isArray(itm.cheques) && itm.cheques.length > 0) {
            validCheques = itm.cheques.filter((c: any) => 
                (c.chequeNo && String(c.chequeNo).trim() && String(c.chequeNo).trim() !== '-') ||
                (c.chequeDate && String(c.chequeDate).trim() && String(c.chequeDate).trim() !== '-') ||
                (Number(c.chequeAmount) > 0) ||
                (c.remarks && String(c.remarks).trim())
            );
        } else if (itm.chequeNo || itm.chequeDate || Number(itm.chequeAmount) > 0 || itm.remarks) {
            validCheques = [{
                chequeNo: itm.chequeNo || '',
                chequeDate: itm.chequeDate || '',
                chequeAmount: Number(itm.chequeAmount) || 0,
                allocatedAmount: itm.allocatedAmount ? Number(itm.allocatedAmount) : undefined,
                remarks: itm.chequeRemarks || itm.remarks || '',
                status: (isExplicitPDC || isCPD) ? 'Pending' : (isPartial ? 'Cleared' : 'Pending')
            }];
        }

        // Compute effective allocated portion for each cheque
        const effectiveCheques = validCheques.map((c: any) => ({
            ...c,
            effectiveAmount: getChequeAllocatedAmount(c, totalAmt, balanceAmt)
        }));

        const totalEffectiveSum = effectiveCheques.reduce((sum: number, c: any) => sum + (Number(c.effectiveAmount) || 0), 0);
        const explicitPendingCheques = effectiveCheques.filter((c: any) => c.status === 'Pending');
        const explicitPendingSum = explicitPendingCheques.reduce((sum: number, c: any) => sum + (Number(c.effectiveAmount) || 0), 0);

        if (explicitPendingCheques.length > 0 && explicitPendingSum > 0) {
            // There are explicit pending cheques recorded for future collection/clearance
            pendingPdcAmount = Math.min(balanceAmt, explicitPendingSum);
        } else if (isPartial || isPartialCheque) {
            // For partial payment invoices:
            // The collected/paid amount was settled (e.g. by cash or cleared cheque).
            // Only additional/excess cheques above paidAmt represent uncollected/future cheques in hand for the balance:
            if (totalEffectiveSum > paidAmt) {
                pendingPdcAmount = Math.min(balanceAmt, totalEffectiveSum - paidAmt);
            } else {
                // If total cheques <= paidAmt, all recorded cheques are accounted for by the paid amount.
                // The remaining balance has NO cheque in hand.
                pendingPdcAmount = 0;
            }
        } else if (isCPD || isExplicitPDC) {
            // Invoice is explicitly marked as PDC in Hand or CPD Pending
            if (totalEffectiveSum > 0) {
                if (totalEffectiveSum > paidAmt) {
                    pendingPdcAmount = Math.min(balanceAmt, totalEffectiveSum - paidAmt);
                } else {
                    pendingPdcAmount = 0;
                }
            } else {
                pendingPdcAmount = balanceAmt;
            }
        } else {
            // Unpaid / Pending invoices:
            if (totalEffectiveSum > 0) {
                if (totalEffectiveSum > paidAmt) {
                    pendingPdcAmount = Math.min(balanceAmt, totalEffectiveSum - paidAmt);
                } else {
                    pendingPdcAmount = 0;
                }
            } else {
                pendingPdcAmount = 0;
            }
        }

        purePendingAmount = Math.max(0, balanceAmt - pendingPdcAmount);
        hasPendingCheque = pendingPdcAmount > 0;
    }

    let statusLabel = itm.status || 'Pending';
    if (isSettled) {
        statusLabel = isReceivable ? 'Received' : 'Paid';
    } else if (isCPD) {
        statusLabel = hasPendingCheque ? 'CPD Pending' : (isReceivable ? 'Pending (No Cheque)' : 'Pending (No Cheque Issued)');
    } else if (isExplicitPDC) {
        statusLabel = hasPendingCheque 
            ? (isReceivable ? 'Pending (PDC in Hand)' : 'Pending (PDC Issued)')
            : (isReceivable ? 'Pending (No Cheque)' : 'Pending (No Cheque Issued)');
    } else if (isPartialCheque) {
        if (hasPendingCheque) {
            statusLabel = isReceivable ? 'Partially Rec by Chq (PDC)' : 'Partially Paid by Chq (PDC)';
        } else {
            statusLabel = isReceivable ? 'Partially Rec by Chq' : 'Partially Paid by Chq';
        }
    } else if (isPartial) {
        if (hasPendingCheque) {
            statusLabel = isReceivable ? 'Partially Received (PDC in Hand)' : 'Partially Paid (PDC Issued)';
        } else {
            statusLabel = isReceivable ? 'Partially Received (No Cheque)' : 'Partially Paid (No Cheque)';
        }
    } else {
        if (hasPendingCheque) {
            statusLabel = isReceivable ? 'Pending (PDC in Hand)' : 'Pending (PDC Issued)';
        } else {
            statusLabel = isReceivable ? 'Pending (No Cheque)' : 'Pending (No Cheque Issued)';
        }
    }

    return {
        actualAmt,
        vatAmt,
        totalAmt,
        paidAmt,
        balanceAmt,
        isSettled,
        hasRecordedCheque: hasRecorded || isCPD || isExplicitPDC,
        hasPendingCheque,
        pendingPdcAmount,
        purePendingAmount,
        statusLabel
    };
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
    includeDetails?: boolean;
    vendors?: any[];
    suppliers?: any[];
    projects?: any[];
    orientation?: 'landscape' | 'portrait';
    soaCompanyId?: string;
    selectedCompanyObj?: any;
    bankAccounts?: any[];
    soaNotes?: string;
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
    companyPhone,
    includeDetails = false,
    vendors = [],
    suppliers = [],
    projects = [],
    orientation = 'landscape',
    soaCompanyId,
    selectedCompanyObj,
    bankAccounts = [],
    soaNotes
}: PdfSOAParams) => {
    const isPortrait = orientation === 'portrait';
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = isPortrait ? 210 : 297;
    const pageHeight = isPortrait ? 297 : 210;
    const margin = 12;
    const printableWidth = pageWidth - (margin * 2);

    const assets = getPioneerPDFAssets();

    const themeColor: [number, number, number] = isReceivable ? [37, 99, 235] : [190, 24, 74];
    const primaryColor: [number, number, number] = [15, 23, 42];
    const lightText: [number, number, number] = [100, 116, 139]; 
    const borderSlate: [number, number, number] = [226, 232, 240];

    const cName = companyName || "PIONEER DMS GROUP LTD";
    const cAddress = companyAddress || "United Arab Emirates";
    const cEmail = companyEmail || "accounts@pioneer.ae";
    const cPhone = companyPhone || "+971 4 000 0000";

    const drawPageDecorations = (pdfDoc: any, currentPage: number, totalPages: number) => {
        // Watermark Logo
        if (assets.watermark) {
            const wmSize = isPortrait ? 130 : 145;
            const wmX = (pageWidth - wmSize) / 2;
            const wmY = (pageHeight - wmSize) / 2;
            try {
                pdfDoc.addImage(assets.watermark, 'PNG', wmX, wmY, wmSize, wmSize, undefined, 'FAST');
            } catch (e) {
                // ignore
            }
        }

        // Top Header Accent Bar
        pdfDoc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
        pdfDoc.rect(0, 0, pageWidth, 6, 'F');

        // Bottom Footer Bar
        const footerY = pageHeight - 8;
        pdfDoc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdfDoc.rect(0, footerY, pageWidth, 8, 'F');

        pdfDoc.setFont("Helvetica", "normal");
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.text("Official electronic statement generated from corporate workspace ledger environment.", margin, footerY + 5);
        pdfDoc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, footerY + 5, { align: 'right' });
    };

    let headerOffset = 17;
    let textX = margin;
    if (companyLogo && companyLogo.startsWith('data:image')) {
        try {
            doc.addImage(companyLogo, 'PNG', margin, 10, 18, 18);
            textX = margin + 22;
            headerOffset = 15;
        } catch (e) {
            console.error("Error drawing logo on pdf:", e);
        }
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 12 : 14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(cName, textX, headerOffset);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text([
        `Address: ${cAddress}`,
        `Email: ${cEmail} | Phone: ${cPhone}`,
        "Official Statement generated electronically on " + formatToDDMMYYYY(new Date())
    ], textX, headerOffset + 4.5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 13 : 15);
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text(title.toUpperCase(), margin, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    doc.text("Statement Period: " + periodStr, margin, 43);

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, 47, pageWidth - margin, 47);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("COUNTERPARTY INFORMATION", margin, 53);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Partner name: ${partnerName}`, margin, 58);
    doc.text(`Type / Category: ${partnerType}`, margin, 63);
    doc.text(`TRN number: ${partnerTrn}`, margin, 68);

    const rightColX = isPortrait ? 110 : 150;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("OPERATIONAL BOUNDS", rightColX, 53);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Contracted projects: ${projectName}`, rightColX, 58);
    doc.text(`Matched entries: ${items.length} records`, rightColX, 63);
    doc.text(`System source: Ledger Sync`, rightColX, 68);

    doc.line(margin, 73, pageWidth - margin, 73);

    // Calculate Cheques in Hand (PDC) vs Pure Pending (No Cheque) breakdown
    let pdcChequeBalance = 0;
    let pdcCount = 0;
    let purePendingBalance = 0;
    let purePendingCount = 0;

    items.forEach((itm: any) => {
        const breakdown = getItemChequeBreakdown(itm, isReceivable);
        if (itm.isCreditNote) {
            purePendingBalance += breakdown.purePendingAmount;
        } else if (!breakdown.isSettled) {
            pdcChequeBalance += breakdown.pendingPdcAmount;
            if (breakdown.hasPendingCheque) {
                pdcCount += 1;
            }
            purePendingBalance += breakdown.purePendingAmount;
            if (breakdown.purePendingAmount > 0) {
                purePendingCount += 1;
            }
        }
    });

    const cardY = 78;
    const cardHeight = 16.5;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, cardY, printableWidth, cardHeight, 'F');
    doc.rect(margin, cardY, printableWidth, cardHeight, 'D');

    const colWidth = printableWidth / 5;
    for (let i = 1; i < 5; i++) {
        doc.line(margin + (colWidth * i), cardY, margin + (colWidth * i), cardY + cardHeight);
    }

    // Box 1: TOTAL BILLED / INVOICED
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 5.8 : 7.0);
    doc.setTextColor(100, 116, 139);
    doc.text(isReceivable ? "TOTAL BILLED" : "TOTAL INVOICES", margin + 2.5, cardY + 4.5);
    doc.setFontSize(isPortrait ? 7.8 : 9.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`AED ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + 2.5, cardY + 10.5);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(isPortrait ? 5.2 : 6.2);
    doc.setTextColor(148, 163, 184);
    doc.text(`${items.length} records matched`, margin + 2.5, cardY + 14.5);

    // Box 2: COLLECTED / SETTLED
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 5.8 : 7.0);
    doc.setTextColor(100, 116, 139);
    doc.text(isReceivable ? "COLLECTED FUNDS" : "SETTLED AMOUNT", margin + colWidth + 2.5, cardY + 4.5);
    doc.setFontSize(isPortrait ? 7.8 : 9.2);
    doc.setTextColor(16, 124, 65);
    doc.text(`AED ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + colWidth + 2.5, cardY + 10.5);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(isPortrait ? 5.2 : 6.2);
    doc.setTextColor(22, 163, 74);
    doc.text("Realized / Cleared", margin + colWidth + 2.5, cardY + 14.5);

    // Box 3: GROSS BALANCE DUE
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 5.8 : 7.0);
    doc.setTextColor(100, 116, 139);
    doc.text(isReceivable ? "GROSS BALANCE DUE" : "GROSS LIABILITY", margin + (colWidth * 2) + 2.5, cardY + 4.5);
    doc.setFontSize(isPortrait ? 7.8 : 9.2);
    doc.setTextColor(30, 41, 59);
    doc.text(`AED ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + (colWidth * 2) + 2.5, cardY + 10.5);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(isPortrait ? 5.2 : 6.2);
    doc.setTextColor(100, 116, 139);
    doc.text("Total outstanding", margin + (colWidth * 2) + 2.5, cardY + 14.5);

    // Box 4: CHEQUES IN HAND (PDC)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 5.8 : 7.0);
    doc.setTextColor(37, 99, 235);
    doc.text(isReceivable ? "PDC IN HAND (CHQ)" : "PDC ISSUED (CHQ)", margin + (colWidth * 3) + 2.5, cardY + 4.5);
    doc.setFontSize(isPortrait ? 7.8 : 9.2);
    doc.setTextColor(37, 99, 235);
    doc.text(`AED ${pdcChequeBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + (colWidth * 3) + 2.5, cardY + 10.5);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(isPortrait ? 5.2 : 6.2);
    doc.setTextColor(59, 130, 246);
    doc.text(`${pdcCount} future cheque(s)`, margin + (colWidth * 3) + 2.5, cardY + 14.5);

    // Box 5: PURE PENDING (NO CHEQUE)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(isPortrait ? 5.8 : 7.0);
    doc.setTextColor(220, 38, 38);
    doc.text("PURE PENDING (NO CHQ)", margin + (colWidth * 4) + 2.5, cardY + 4.5);
    doc.setFontSize(isPortrait ? 7.8 : 9.2);
    doc.setTextColor(220, 38, 38);
    doc.text(`AED ${purePendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + (colWidth * 4) + 2.5, cardY + 10.5);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(isPortrait ? 5.2 : 6.2);
    doc.setTextColor(239, 68, 68);
    doc.text(`${purePendingCount} uncollected / no chq`, margin + (colWidth * 4) + 2.5, cardY + 14.5);

    const tableHead = [[
        'SI NO',
        'INV. DATE',
        'INVOICE DETAILS',
        'MON',
        'YR',
        'ACT. AMT (AED)',
        'VAT AMT (AED)',
        'TOTAL (AED)',
        'PAID / REC. (AED)',
        'BALANCE (AED)',
        'STATUS',
        'CHEQUE / PAYMENT DETAILS'
    ]];

    let totalActualAmt = 0;
    let totalVatAmt = 0;
    let totalTotalAmt = 0;
    let totalPaidAmt = 0;
    let totalBalanceAmt = 0;

    const tableBody = items.map((itm: any, idx: number) => {
        let yrStr = '-';
        let mnStr = '-';
        if (itm.date) {
            const parts = String(itm.date).split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    yrStr = parts[0];
                    const mnVal = parseInt(parts[1]);
                    if (!isNaN(mnVal) && mnVal >= 1 && mnVal <= 12) {
                        mnStr = new Date(2020, mnVal - 1, 1).toLocaleDateString('default', { month: 'short' });
                    }
                } else if (parts[2].length === 4) {
                    yrStr = parts[2];
                    const mnVal = parseInt(parts[1]);
                    if (!isNaN(mnVal) && mnVal >= 1 && mnVal <= 12) {
                        mnStr = new Date(2020, mnVal - 1, 1).toLocaleDateString('default', { month: 'short' });
                    }
                }
            }
        }

        const { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt } = getSOAItemAmounts(itm);

        totalActualAmt += actualAmt;
        totalVatAmt += vatAmt;
        totalTotalAmt += totalAmt;
        totalPaidAmt += paidAmt;
        totalBalanceAmt += balanceAmt;

        let invCellText = itm.invoiceNumber || '-';
        if (itm.isCreditNote) {
            invCellText = `${itm.creditNoteNumber || itm.invoiceNumber}\n(Tax Credit Note)`;
            if (itm.originalInvoiceNumber) {
                invCellText += `\nRef Inv: #${itm.originalInvoiceNumber}`;
            }
        } else if (includeDetails) {
            const { clientSupplierName, projectCodeName } = resolveItemDetails(itm, isReceivable, vendors, suppliers, projects);
            if (clientSupplierName && clientSupplierName !== '-') {
                invCellText += `\n${isReceivable ? 'Client' : 'Supplier'}: ${clientSupplierName}`;
            }
            if (projectCodeName && projectCodeName !== '-') {
                invCellText += `\nProject: ${projectCodeName}`;
            }
        }

        let chqStr = "-";
        const hasChq = hasItemCheque(itm);
        if (itm.cheques && Array.isArray(itm.cheques) && itm.cheques.length > 0) {
            if (itm.cheques.length === 1) {
                const c = itm.cheques[0];
                const parts = [];
                if (c.chequeNo) parts.push(`Chq #${c.chequeNo}`);
                if (c.chequeDate) parts.push(`Date: ${formatToDDMMYYYY(c.chequeDate)}`);
                if (c.chequeAmount !== undefined && c.chequeAmount !== null && c.chequeAmount !== '') {
                    parts.push(`Amt: ${Number(c.chequeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                }
                if (c.allocatedAmount !== undefined && c.allocatedAmount !== null && c.allocatedAmount !== '' && Number(c.allocatedAmount) > 0 && Number(c.allocatedAmount) !== Number(c.chequeAmount)) {
                    parts.push(`(Allocated: ${Number(c.allocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
                }
                if (c.remarks && String(c.remarks).trim()) {
                    parts.push(`(${c.remarks.trim()})`);
                }
                chqStr = parts.join(" ");
            } else {
                chqStr = itm.cheques.map((c: any, cIdx: number) => {
                    const parts = [];
                    if (c.chequeNo) {
                        parts.push(`Chq #${c.chequeNo}`);
                    } else {
                        parts.push(`Chq #${cIdx + 1}`);
                    }
                    if (c.chequeDate) parts.push(`Date: ${formatToDDMMYYYY(c.chequeDate)}`);
                    if (c.chequeAmount !== undefined && c.chequeAmount !== null && c.chequeAmount !== '') {
                        parts.push(`Amt: ${Number(c.chequeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    }
                    if (c.allocatedAmount !== undefined && c.allocatedAmount !== null && c.allocatedAmount !== '' && Number(c.allocatedAmount) > 0 && Number(c.allocatedAmount) !== Number(c.chequeAmount)) {
                        parts.push(`(Allocated: ${Number(c.allocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
                    }
                    if (c.remarks && String(c.remarks).trim()) {
                        parts.push(`(${c.remarks.trim()})`);
                    }
                    return parts.join(" ");
                }).join("\n");
            }
        } else if (itm.chequeNo || itm.chequeDate || itm.chequeAmount || itm.remarks) {
            const chqParts = [];
            if (itm.chequeNo) chqParts.push(`Chq #${itm.chequeNo}`);
            if (itm.chequeDate) chqParts.push(`Date: ${formatToDDMMYYYY(itm.chequeDate)}`);
            if (itm.chequeAmount !== undefined && itm.chequeAmount !== null && itm.chequeAmount !== '') {
                chqParts.push(`Amt: ${Number(itm.chequeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            }
            if (itm.allocatedAmount !== undefined && itm.allocatedAmount !== null && itm.allocatedAmount !== '' && Number(itm.allocatedAmount) > 0 && Number(itm.allocatedAmount) !== Number(itm.chequeAmount)) {
                chqParts.push(`(Allocated: ${Number(itm.allocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
            }
            if (itm.remarks && String(itm.remarks).trim()) {
                chqParts.push(`(${String(itm.remarks).trim()})`);
            }
            chqStr = chqParts.join(" ");
        }

        const breakdown = getItemChequeBreakdown(itm, isReceivable);
        let statusText = breakdown.statusLabel;
        if (isPortrait) {
            if (statusText === 'Partially Received (PDC in Hand)') statusText = 'Partially Rec (PDC)';
            else if (statusText === 'Partially Received (No Cheque)') statusText = 'Partially Rec (No Chq)';
            else if (statusText === 'Partially Paid (PDC Issued)') statusText = 'Partially Paid (PDC)';
            else if (statusText === 'Partially Paid (No Cheque)') statusText = 'Partially Paid (No Chq)';
            else if (statusText === 'Pending (PDC in Hand)' || statusText === 'Pending (PDC Issued)') statusText = 'Pending (PDC)';
            else if (statusText === 'Pending (No Cheque)' || statusText === 'Pending (No Cheque Issued)') statusText = 'Pending (No Chq)';
            else if (statusText === 'Partially Rec by Chq') statusText = 'Part Rec (Chq)';
            else if (statusText === 'Partially Rec by Chq (PDC)') statusText = 'Part Rec (PDC)';
            else if (statusText === 'Partially Paid by Chq') statusText = 'Part Paid (Chq)';
            else if (statusText === 'Partially Paid by Chq (PDC)') statusText = 'Part Paid (PDC)';
            else if (statusText === 'CPD Pending') statusText = 'CPD Pending';
        }

        return [
            String(idx + 1),
            formatToDDMMYYYY(itm.date),
            invCellText,
            mnStr,
            yrStr,
            actualAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            vatAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            paidAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            balanceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            statusText,
            chqStr
        ];
    });

    const tableFoot = [
        [
            { content: 'STATEMENT TOTALS & BALANCE DUE', colSpan: 5, styles: { halign: 'left', fontStyle: 'bold' } },
            { content: totalActualAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', overflow: 'ellipsize' } },
            { content: totalVatAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', overflow: 'ellipsize' } },
            { content: totalTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', overflow: 'ellipsize' } },
            { content: totalPaidAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', overflow: 'ellipsize' } },
            { content: totalBalanceAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', overflow: 'ellipsize' } },
            '',
            ''
        ],
        [
            {
                content: `BALANCE STATUS BREAKDOWN:   Cheques in Hand (PDC): AED ${pdcChequeBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${pdcCount} Invoices)    |    Pure Pending ${isReceivable ? 'Receivables' : 'Payables'} (No Cheques in Hand): AED ${purePendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${purePendingCount} Invoices)`,
                colSpan: 12,
                styles: { halign: 'left', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: isPortrait ? 5.5 : 6.8 }
            }
        ]
    ];

    (doc as any).autoTable({
        startY: cardY + cardHeight + 6,
        head: tableHead,
        body: tableBody,
        foot: tableFoot,
        margin: { left: margin, right: margin, bottom: 14, top: 12 },
        styles: {
            font: 'Helvetica',
            fontSize: isPortrait ? 5.8 : 7.2,
            cellPadding: isPortrait ? { top: 1.2, bottom: 1.2, left: 0.5, right: 0.5 } : 1.8,
            overflow: 'linebreak',
            valign: 'middle',
            textColor: [30, 41, 59]
        },
        headStyles: {
            fillColor: themeColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: isPortrait ? 6.0 : 7.2,
            halign: 'left'
        },
        footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: isPortrait ? 5.8 : 7.2,
            cellPadding: isPortrait ? { top: 1.8, bottom: 1.8, left: 0.5, right: 0.5 } : 1.8,
            halign: 'right'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: isPortrait ? 6 : 8 },
            1: { halign: 'center', cellWidth: isPortrait ? 13 : 16 },
            2: { cellWidth: isPortrait ? 24 : 32, fontStyle: 'bold' },
            3: { halign: 'center', cellWidth: isPortrait ? 6 : 9 },
            4: { halign: 'center', cellWidth: isPortrait ? 7 : 9 },
            5: { halign: 'right', cellWidth: isPortrait ? 18 : 22, overflow: 'ellipsize' },
            6: { halign: 'right', cellWidth: isPortrait ? 15 : 19, overflow: 'ellipsize' },
            7: { halign: 'right', cellWidth: isPortrait ? 18 : 22, overflow: 'ellipsize' },
            8: { halign: 'right', cellWidth: isPortrait ? 18 : 22, fontStyle: 'bold', overflow: 'ellipsize' },
            9: { halign: 'right', cellWidth: isPortrait ? 18 : 22, fontStyle: 'bold', overflow: 'ellipsize' },
            10: { halign: 'center', cellWidth: isPortrait ? 15 : 20, fontStyle: 'bold' },
            11: { cellWidth: 'auto' }
        },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 10) {
                const statusVal = String(data.cell.raw || '');
                if (statusVal === 'Paid' || statusVal === 'Received') {
                    data.cell.styles.textColor = [16, 124, 65];
                } else if (statusVal === 'Credit Note' || statusVal.includes('Credit')) {
                    data.cell.styles.textColor = [124, 58, 237];
                } else if (statusVal.includes('PDC') || statusVal.includes('Chq') || statusVal.includes('Partially')) {
                    data.cell.styles.textColor = [37, 99, 235];
                } else {
                    data.cell.styles.textColor = [220, 38, 38];
                }
            }
            if (data.section === 'body' && data.column.index === 8) {
                const paidRaw = data.cell.raw;
                if (paidRaw && paidRaw !== '0.00') {
                    data.cell.styles.textColor = [16, 124, 65];
                }
            }
            if (data.section === 'body' && data.column.index === 9) {
                const balRaw = data.cell.raw;
                if (balRaw && balRaw !== '0.00') {
                    data.cell.styles.textColor = [220, 38, 38];
                }
            }
        }
    });

    let currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 5 : 180;

    // Draw Bank Payment Details ONLY if a specific issuer company is selected (not 'All' / All Combined)
    if (soaCompanyId && soaCompanyId !== 'All' && selectedCompanyObj) {
        let targetBank: any = null;
        if (bankAccounts && bankAccounts.length > 0) {
            targetBank = bankAccounts.find((b: any) => 
                (selectedCompanyObj && b.companyId === selectedCompanyObj.id) ||
                (selectedCompanyObj?.name && b.accountName && (
                    b.accountName.toLowerCase().includes(selectedCompanyObj.name.toLowerCase()) ||
                    selectedCompanyObj.name.toLowerCase().includes(b.accountName.toLowerCase())
                ))
            );
            if (!targetBank) {
                targetBank = bankAccounts.find((b: any) => b.isDefault) || bankAccounts[0];
            }
        }
        if (!targetBank) {
            targetBank = {
                accountName: selectedCompanyObj.name || "Pioneer General Contracting LLC",
                bankName: "Abu Dhabi Commercial Bank",
                accountNumber: "11249315820001",
                iban: "AE190030011249315820001",
                swiftCode: "ADCBAEAA",
                currency: "AED"
            };
        }

        let bankY = currentY;
        const boxHeight = 22;
        if (bankY + boxHeight > pageHeight - 14) {
            doc.addPage();
            bankY = 14;
        }

        const boxWidth = printableWidth;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, bankY, boxWidth, boxHeight, 'FD');

        // Theme accent vertical strip
        doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
        doc.rect(margin, bankY, 2.5, boxHeight, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
        doc.text("BANK BENEFICIARY DETAILS FOR REMITTANCE", margin + 5, bankY + 5);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);

        const col1X = margin + 5;
        const col2X = margin + (boxWidth / 2) + 5;

        doc.text(`Beneficiary Name: ${targetBank.accountName || selectedCompanyObj?.name || 'N/A'}`, col1X, bankY + 10.5);
        doc.text(`Bank Name: ${targetBank.bankName || 'N/A'}`, col1X, bankY + 15);
        doc.text(`Account Number: ${targetBank.accountNumber || 'N/A'}`, col1X, bankY + 19.5);

        doc.text(`IBAN: ${targetBank.iban || 'N/A'}`, col2X, bankY + 10.5);
        doc.text(`SWIFT / BIC: ${targetBank.swiftCode || 'N/A'}`, col2X, bankY + 15);
        doc.text(`Currency: ${targetBank.currency || 'AED'}`, col2X, bankY + 19.5);

        currentY = bankY + boxHeight + 4;
    }

    // Draw Statement Note / Remarks if provided
    if (soaNotes && soaNotes.trim()) {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        const noteText = soaNotes.trim();
        const splitText = doc.splitTextToSize(noteText, printableWidth - 12);
        const noteBoxHeight = Math.max(12, splitText.length * 3.8 + 7);

        if (currentY + noteBoxHeight > pageHeight - 14) {
            doc.addPage();
            currentY = 14;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, currentY, printableWidth, noteBoxHeight, 'FD');

        // Theme accent vertical strip
        doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
        doc.rect(margin, currentY, 2.5, noteBoxHeight, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
        doc.text("NOTE / REMARKS:", margin + 5, currentY + 4.5);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        doc.text(splitText, margin + 5, currentY + 8.5);
    }

    // Draw page decorations (watermark, top/bottom bars, page X of Y) post-table generation across ALL pages
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);
        drawPageDecorations(doc, page, totalPages);
    }

    const partnerFileSafe = partnerName.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
    doc.save(`${isReceivable ? 'Receivable' : 'Payable'}_SOA_${partnerFileSafe}_${orientation}.pdf`);
};

export const downloadSOAExcel = (
    partnerId: string, 
    partnerName: string, 
    partnerType: string, 
    items: any[], 
    isReceivable: boolean,
    includeDetails: boolean = false,
    vendors: any[] = [],
    suppliers: any[] = [],
    projects: any[] = [],
    soaNotes: string = ''
) => {
    let excelTotalBilled = 0;
    let excelTotalPaid = 0;
    let excelTotalBalance = 0;
    let excelPdcBalance = 0;
    let excelPdcCount = 0;
    let excelPurePendingBalance = 0;
    let excelPurePendingCount = 0;

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
        
        const breakdown = getItemChequeBreakdown(itm, isReceivable);
        const { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt } = breakdown;

        excelTotalBilled += totalAmt;
        excelTotalPaid += paidAmt;
        excelTotalBalance += balanceAmt;

        let chequeStatus = breakdown.statusLabel;
        if (itm.isCreditNote) {
            excelPurePendingBalance += breakdown.purePendingAmount;
        } else if (!breakdown.isSettled) {
            excelPdcBalance += breakdown.pendingPdcAmount;
            if (breakdown.hasPendingCheque) {
                excelPdcCount += 1;
            }
            excelPurePendingBalance += breakdown.purePendingAmount;
            if (breakdown.purePendingAmount > 0) {
                excelPurePendingCount += 1;
            }
        }

        const rowObj: any = {
            "SI No": idx + 1,
            "Invoice Date": formatToDDMMYYYY(itm.date),
            "Invoice No": itm.invoiceNumber || '-'
        };

        if (includeDetails) {
            const { clientSupplierName, projectCodeName } = resolveItemDetails(itm, isReceivable, vendors, suppliers, projects);
            if (isReceivable) {
                rowObj["Client Name"] = clientSupplierName;
            } else {
                rowObj["Supplier Name"] = clientSupplierName;
            }
            rowObj["Project Code & Name"] = projectCodeName;
        }

        rowObj["Invoice Month"] = mnLabel;
        rowObj["Invoice Year"] = yr;
        rowObj["Actual Amount"] = actualAmt;
        rowObj["VAT Amount"] = vatAmt;
        rowObj["Total Amount"] = totalAmt;
        rowObj[isReceivable ? "Paid / Received Amount" : "Paid / Settled Amount"] = paidAmt;
        rowObj["Balance Amount"] = balanceAmt;
        rowObj["Payment Status"] = itm.status || 'Pending';
        rowObj["Cheque Clearance Status"] = chequeStatus;
        if (itm.cheques && Array.isArray(itm.cheques) && itm.cheques.length > 0) {
            rowObj["Cheque Date"] = itm.cheques.map((c: any) => formatToDDMMYYYY(c.chequeDate)).filter(Boolean).join(", ");
            rowObj["Cheque Number"] = itm.cheques.map((c: any) => c.chequeNo).filter(Boolean).join(", ");
            rowObj["Cheque Amount"] = itm.cheques.reduce((sum: number, c: any) => sum + (Number(c.chequeAmount) || 0), 0);
            if (itm.cheques.length === 1) {
                const c = itm.cheques[0];
                const parts = [];
                if (c.chequeNo) parts.push(`Chq #${c.chequeNo}`);
                if (c.chequeDate) parts.push(`Date: ${formatToDDMMYYYY(c.chequeDate)}`);
                if (c.chequeAmount !== undefined && c.chequeAmount !== null && c.chequeAmount !== '') {
                    parts.push(`Amt: ${Number(c.chequeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                }
                if (c.remarks && String(c.remarks).trim()) {
                    parts.push(`(${c.remarks.trim()})`);
                }
                rowObj["Cheques Breakdown"] = parts.join(" ");
            } else {
                rowObj["Cheques Breakdown"] = itm.cheques.map((c: any, i: number) => {
                    const parts = [];
                    if (c.chequeNo) {
                        parts.push(`Chq #${c.chequeNo}`);
                    } else {
                        parts.push(`Chq #${i + 1}`);
                    }
                    if (c.chequeDate) parts.push(`Date: ${formatToDDMMYYYY(c.chequeDate)}`);
                    if (c.chequeAmount !== undefined && c.chequeAmount !== null && c.chequeAmount !== '') {
                        parts.push(`Amt: ${Number(c.chequeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    }
                    if (c.remarks && String(c.remarks).trim()) {
                        parts.push(`(${c.remarks.trim()})`);
                    }
                    return parts.join(" ");
                }).join("\r\n");
            }
        } else {
            rowObj["Cheque Date"] = formatToDDMMYYYY(itm.chequeDate);
            rowObj["Cheque Number"] = itm.chequeNo || '-';
            rowObj["Cheque Amount"] = itm.chequeAmount || '-';
            rowObj["Cheques Breakdown"] = itm.chequeNo ? `Chq #${itm.chequeNo} Date: ${formatToDDMMYYYY(itm.chequeDate)} Amt: ${Number(itm.chequeAmount || 0).toLocaleString()}` : '-';
        }

        return rowObj;
    });

    // Summary block in Excel
    reportRows.push({});
    reportRows.push({
        "SI No": "TOTALS",
        "Invoice Date": "SUMMARY",
        "Total Amount": excelTotalBilled,
        [isReceivable ? "Paid / Received Amount" : "Paid / Settled Amount"]: excelTotalPaid,
        "Balance Amount": excelTotalBalance
    });
    reportRows.push({
        "SI No": "BREAKDOWN",
        "Invoice Date": `Cheques in Hand (PDC): AED ${excelPdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${excelPdcCount} Invoices) | Pure Pending (No Cheques): AED ${excelPurePendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${excelPurePendingCount} Invoices)`
    });

    if (soaNotes && soaNotes.trim()) {
        reportRows.push({});
        reportRows.push({
            "SI No": "Note / Remarks:",
            "Invoice Date": soaNotes.trim()
        });
    }

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `SOA_${partnerId.substring(0, 8)}`);
    XLSX.writeFile(wb, `${isReceivable ? 'Receivable' : 'Payable'}_SOA_${partnerName.replace(/\s+/g, '_')}.xlsx`);
};

export const AccountsReceivableView = ({ 
    data, 
    projects, 
    suppliers, 
    vendors, 
    onAdd, 
    onEdit, 
    onDelete, 
    onDeleteMultiple, 
    onBulkUpdateDate, 
    user, 
    companies, 
    bankAccounts = [],
    creditNotes = [],
    onAddCreditNote,
    onEditCreditNote,
    onDeleteCreditNote,
    onSaveCreditNote
}: any) => {
    const [previewInvoiceItem, setPreviewInvoiceItem] = useState<{ item: any; comp: any; client: any } | null>(null);
    const [previewCreditNoteItem, setPreviewCreditNoteItem] = useState<{ creditNote: any; comp: any; client: any } | null>(null);
    const [localCreditNoteModal, setLocalCreditNoteModal] = useState<any | null>(null);
    const [activeTabMode, setActiveTabMode] = useState<'ledger' | 'insights' | 'soa' | 'duplicates' | 'credit-notes'>('ledger');
    const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null);
    const [kpiFilter, setKpiFilter] = useState<'all' | 'collected' | 'pending' | 'vat' | null>(null);

    // Credit Note Filter states
    const [creditNoteSearchQuery, setCreditNoteSearchQuery] = useState('');
    const [creditNoteClientFilter, setCreditNoteClientFilter] = useState('All');
    const [creditNoteCompanyFilter, setCreditNoteCompanyFilter] = useState('All');
    const [creditNoteStatusFilter, setCreditNoteStatusFilter] = useState('All');
    const [creditNoteStartDate, setCreditNoteStartDate] = useState('');
    const [creditNoteEndDate, setCreditNoteEndDate] = useState('');

    // Advanced Filter State variables
    const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterInvoiceCreation, setFilterInvoiceCreation] = useState('All');
    const [filterEntity, setFilterEntity] = useState('All');
    const [filterProject, setFilterProject] = useState('All');
    const [filterCompany, setFilterCompany] = useState('All');
    const [filterMonth, setFilterMonth] = useState('All');

    // Date policy / Quick Filter stats
    const [dateFilterMode, setDateFilterMode] = useState<'all' | 'current-month' | 'last-month' | 'month-wise' | 'year-wise' | 'custom-range'>('all');
    const [selectedYearValue, setSelectedYearValue] = useState(new Date().getFullYear().toString());
    const [selectedMonthValue, setSelectedMonthValue] = useState('');
    const [customRangeStart, setCustomRangeStart] = useState('');
    const [customRangeEnd, setCustomRangeEnd] = useState('');

    // SOA Tool state variables
    const [soaEntityId, setSoaEntityId] = useState('All');
    const [soaProjectId, setSoaProjectId] = useState('All');
    const [soaCompanyId, setSoaCompanyId] = useState('All');
    const [soaStartDate, setSoaStartDate] = useState('');
    const [soaEndDate, setSoaEndDate] = useState('');
    const [soaScope, setSoaScope] = useState<'All' | 'Received' | 'Pending' | 'Pending_NoCheque' | 'Pending_Cheque'>('All');
    const [soaIncludeDetails, setSoaIncludeDetails] = useState(false);
    const [soaIncludeCreditNotes, setSoaIncludeCreditNotes] = useState(true);
    const [soaNotes, setSoaNotes] = useState("All invoices submitted as per the site provided time sheet and records.");
    const [showMonthlyAuditBreakdown, setShowMonthlyAuditBreakdown] = useState(false);
    const [expandedMonthDetails, setExpandedMonthDetails] = useState<string | null>(null);
    const [soaPdfModalOpen, setSoaPdfModalOpen] = useState(false);
    const [soaPdfOrientation, setSoaPdfOrientation] = useState<'landscape' | 'portrait'>('portrait');

    const handleGoToInvoice = (clientId: string, monthKey: string) => {
        setActiveTabMode('ledger');
        setFilterEntity(clientId);
        setFilterMonth(monthKey);
        setDateFilterMode('all');
        setTimeout(() => {
            const element = document.getElementById('accounts-receivable-ledger-section');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

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
                label: `üåü ${name} (All Consolidated Projects)`
            });
        });

        // Add standard individual project options
        (vendors || []).forEach((v: any) => {
            options.push({
                value: v.id,
                label: `üìÑ ${v.name} (Code: ${v.code || 'N/A'})`
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
        const today = new Date();
        const curYear = today.getFullYear();
        const curMonthNum = String(today.getMonth() + 1).padStart(2, '0');
        const curMonthStr = `${curYear}-${curMonthNum}`;

        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lmYear = lastMonthDate.getFullYear();
        const lmMonthNum = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
        const lastMonthStr = `${lmYear}-${lmMonthNum}`;

        return (data || []).filter((item: any) => {
            // Check Date Policy Mode
            if (item.date) {
                if (dateFilterMode === 'current-month') {
                    if (item.date.substring(0, 7) !== curMonthStr) return false;
                } else if (dateFilterMode === 'last-month') {
                    if (item.date.substring(0, 7) !== lastMonthStr) return false;
                } else if (dateFilterMode === 'month-wise') {
                    if (selectedMonthValue && item.date.substring(0, 7) !== selectedMonthValue) return false;
                } else if (dateFilterMode === 'year-wise') {
                    if (selectedYearValue && item.date.substring(0, 4) !== selectedYearValue) return false;
                } else if (dateFilterMode === 'custom-range') {
                    if (customRangeStart && item.date < customRangeStart) return false;
                    if (customRangeEnd && item.date > customRangeEnd) return false;
                }
            }

            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;

            const amount = item.totalAmount || item.amount || 0;
            if (minAmount !== '' && amount < Number(minAmount)) return false;
            if (maxAmount !== '' && amount > Number(maxAmount)) return false;

            if (filterStatus !== 'All' && item.status !== filterStatus) return false;
            
            if (filterInvoiceCreation !== 'All') {
                const docStatus = item.invoiceCreationStatus || 'Created';
                if (docStatus !== filterInvoiceCreation) return false;
            }
            
            if (filterEntity !== 'All') {
                const targetVendor = vendors.find((v: any) => v.id === filterEntity);
                if (targetVendor) {
                    const targetClientName = (targetVendor.name || '').toLowerCase().trim();
                    if (item.entityType === 'Vendor') {
                        if (item.entityId !== filterEntity) return false;
                    } else if (item.entityType === 'Project') {
                        const proj = projects.find((p: any) => p.id === item.entityId);
                        if (!proj || (proj.clientName || '').toLowerCase().trim() !== targetClientName) return false;
                    } else {
                        if (item.entityId !== filterEntity) return false;
                    }
                } else {
                    if (item.entityId !== filterEntity) return false;
                }
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
    }, [data, startDate, endDate, minAmount, maxAmount, filterStatus, filterInvoiceCreation, filterEntity, filterProject, filterCompany, filterMonth, dateFilterMode, selectedYearValue, selectedMonthValue, customRangeStart, customRangeEnd]);

    const ledgerFilteredData = useMemo(() => {
        if (!kpiFilter || kpiFilter === 'all') return filteredData;
        return (filteredData || []).filter((item: any) => {
            if (kpiFilter === 'collected') {
                return item.status === 'Received';
            }
            if (kpiFilter === 'pending') {
                return item.status !== 'Received';
            }
            if (kpiFilter === 'vat') {
                return (item.vatAmount || 0) > 0;
            }
            return true;
        });
    }, [filteredData, kpiFilter]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (dateFilterMode !== 'all') count++;
        if (startDate) count++;
        if (endDate) count++;
        if (minAmount !== '') count++;
        if (maxAmount !== '') count++;
        if (filterStatus !== 'All') count++;
        if (filterInvoiceCreation !== 'All') count++;
        if (filterEntity !== 'All') count++;
        if (filterProject !== 'All') count++;
        if (filterCompany !== 'All') count++;
        if (filterMonth !== 'All') count++;
        if (kpiFilter && kpiFilter !== 'all') count++;
        return count;
    }, [startDate, endDate, minAmount, maxAmount, filterStatus, filterInvoiceCreation, filterEntity, filterProject, filterCompany, filterMonth, dateFilterMode, kpiFilter]);

    const handleClearAdvFilters = () => {
        setStartDate('');
        setEndDate('');
        setMinAmount('');
        setMaxAmount('');
        setFilterStatus('All');
        setFilterInvoiceCreation('All');
        setFilterEntity('All');
        setFilterProject('All');
        setFilterCompany('All');
        setFilterMonth('All');
        setDateFilterMode('all');
        setSelectedYearValue(new Date().getFullYear().toString());
        setSelectedMonthValue('');
        setCustomRangeStart('');
        setCustomRangeEnd('');
        setKpiFilter(null);
    };

    // Statement of Account Items filter logic
    const soaFilteredItems = useMemo(() => {
        const filteredInvoices = (data || []).filter((item: any) => {
            // Must match selected client entity
            if (soaEntityId !== 'All') {
                if (soaEntityId.startsWith('BY_NAME:')) {
                    const targetName = soaEntityId.replace('BY_NAME:', '').toLowerCase().trim();
                    const actualClientObj = getEntityObject(item.entityId, item.entityType || 'Vendor');
                    if (!actualClientObj) return false;
                    let clientName = '';
                    if (item.entityType === 'Project') {
                        clientName = (actualClientObj.clientName || actualClientObj.name || '').toLowerCase().trim();
                    } else {
                        clientName = (actualClientObj.name || '').toLowerCase().trim();
                    }
                    if (clientName !== targetName && !clientName.includes(targetName) && !targetName.includes(clientName)) return false;
                } else {
                    const targetVendor = vendors.find((v: any) => v.id === soaEntityId);
                    if (targetVendor) {
                        const targetClientName = (targetVendor.name || '').toLowerCase().trim();
                        if (item.entityType === 'Vendor') {
                            if (item.entityId !== soaEntityId) return false;
                        } else if (item.entityType === 'Project') {
                            const proj = projects.find((p: any) => p.id === item.entityId);
                            if (!proj || (proj.clientName || '').toLowerCase().trim() !== targetClientName) return false;
                        } else {
                            if (item.entityId !== soaEntityId) return false;
                        }
                    } else {
                        if (item.entityId !== soaEntityId) return false;
                    }
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
            const breakdown = getItemChequeBreakdown(item, true);
            if (soaScope === 'Received' && !breakdown.isSettled) return false;
            if (soaScope === 'Pending' && breakdown.isSettled) return false;
            if (soaScope === 'Pending_NoCheque') {
                if (breakdown.isSettled || breakdown.hasPendingCheque) return false;
            }
            if (soaScope === 'Pending_Cheque') {
                if (breakdown.isSettled || !breakdown.hasPendingCheque) return false;
            }

            return true;
        });

        // Credit Notes processing
        let matchingCreditNotes: any[] = [];
        if (soaIncludeCreditNotes && creditNotes && creditNotes.length > 0) {
            matchingCreditNotes = (creditNotes || []).filter((cn: CreditNote) => {
                if (cn.status === 'Draft' || cn.status === 'Cancelled') return false;
                
                // Match client entity
                if (soaEntityId !== 'All') {
                    if (soaEntityId.startsWith('BY_NAME:')) {
                        const targetName = soaEntityId.replace('BY_NAME:', '').toLowerCase().trim();
                        const cnClientName = (cn.clientName || '').toLowerCase().trim();
                        if (cnClientName !== targetName && !cnClientName.includes(targetName) && !targetName.includes(cnClientName)) return false;
                    } else {
                        if (cn.entityId && cn.entityId !== soaEntityId) return false;
                    }
                }

                // Match company
                if (soaCompanyId !== 'All' && cn.companyId && cn.companyId !== soaCompanyId) return false;

                // Date limits
                if (soaStartDate && cn.date < soaStartDate) return false;
                if (soaEndDate && cn.date > soaEndDate) return false;

                // Scope: Credit Notes are credit adjustments against uncollected/pending balances
                if (soaScope === 'Received') return false;
                if (soaScope === 'Pending_Cheque') return false;

                return true;
            }).map((cn: CreditNote) => {
                const tot = Math.abs(Number(cn.totalAmount || 0));
                const act = cn.amount !== undefined ? Math.abs(Number(cn.amount)) : Number((tot / 1.05).toFixed(2));
                const vat = cn.vatAmount !== undefined ? Math.abs(Number(cn.vatAmount)) : Number((tot - act).toFixed(2));
                return {
                    id: cn.id,
                    isCreditNote: true,
                    creditNoteNumber: cn.creditNoteNumber || `CN-${cn.originalInvoiceNumber || ''}`,
                    invoiceNumber: cn.creditNoteNumber || `CN-${cn.originalInvoiceNumber || ''}`,
                    originalInvoiceNumber: cn.originalInvoiceNumber,
                    date: cn.date,
                    entityId: cn.entityId,
                    entityType: cn.entityType || 'Vendor',
                    companyId: cn.companyId,
                    companyName: cn.companyName,
                    clientName: cn.clientName,
                    actualAmount: -act,
                    vatAmount: -vat,
                    totalAmount: -tot,
                    receivedAmount: 0,
                    paidAmount: 0,
                    balanceAmount: -tot,
                    status: 'Credit Note',
                    remarks: `Tax Credit Note against Inv #${cn.originalInvoiceNumber || ''}${cn.reason ? ` (${cn.reason})` : ''}`,
                    cheques: []
                };
            });
        }

        return [...filteredInvoices, ...matchingCreditNotes].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }, [data, creditNotes, soaIncludeCreditNotes, soaEntityId, soaProjectId, soaCompanyId, soaStartDate, soaEndDate, soaScope, vendors, suppliers, projects]);

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

    const handleGenerateSOAPDF = (targetOrientation?: 'landscape' | 'portrait') => {
        if (!targetOrientation) {
            setSoaPdfModalOpen(true);
            return;
        }

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
            const { totalAmt, paidAmt } = getSOAItemAmounts(itm);
            totalBilled += totalAmt;
            totalPaid += paidAmt;
        });
        const balance = Math.max(0, totalBilled - totalPaid);

        let selectedCompanyObj = soaCompanyId !== 'All' ? (companies || []).find((c: any) => c.id === soaCompanyId) : null;

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
            companyName: selectedCompanyObj ? selectedCompanyObj.name : "PIONEER GROUP (CONSOLIDATED)",
            companyLogo: selectedCompanyObj?.logo,
            companyAddress: selectedCompanyObj?.address || "United Arab Emirates",
            companyEmail: selectedCompanyObj?.email || "accounts@pioneer.ae",
            companyPhone: selectedCompanyObj?.phone || "+971 4 000 0000",
            includeDetails: soaIncludeDetails,
            vendors,
            suppliers,
            projects,
            orientation: targetOrientation,
            soaCompanyId,
            selectedCompanyObj,
            bankAccounts,
            soaNotes
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

        downloadSOAExcel(soaEntityId, pName, pType, soaFilteredItems, true, soaIncludeDetails, vendors, suppliers, projects, soaNotes);
    };

    const { duplicateGroups, duplicateGroupsCount } = useMemo(() => {
        const records = data || [];
        const groups: { [key: string]: any[] } = {};
        
        // Group by Invoice Number
        const invGroups: { [invoiceNum: string]: any[] } = {};
        records.forEach((record: any) => {
            const inv = (record.invoiceNumber || '').trim().toLowerCase();
            if (inv && inv.length > 0) {
                if (!invGroups[inv]) invGroups[inv] = [];
                invGroups[inv].push(record);
            }
        });

        // Group by Client + Company + Month & Year
        const monthGroups: { [key: string]: any[] } = {};
        records.forEach((record: any) => {
            const client = record.clientId || record.vendorId || 'none';
            const company = record.companyId || 'none';
            const mY = getMonthYear(record.date || record.invoiceDate);
            if (mY !== 'Unknown') {
                const key = `${client}_${company}_${mY}`;
                if (!monthGroups[key]) monthGroups[key] = [];
                monthGroups[key].push(record);
            }
        });

        const list: any[] = [];
        let count = 0;

        // Collect matching invoice duplicates
        Object.entries(invGroups).forEach(([inv, items]) => {
            if (items.length > 1) {
                list.push({
                    id: 'inv_' + inv,
                    type: 'invoice',
                    key: `Invoice Number Conflict: #${items[0].invoiceNumber}`,
                    items,
                    reason: `These custom invoices share the identical invoice number "${items[0].invoiceNumber}" in the master ledger.`
                });
                count++;
            }
        });

        // Collect matching month/client duplicates
        Object.entries(monthGroups).forEach(([key, items]) => {
            if (items.length > 1) {
                const item = items[0];
                const clientName = (() => {
                    if (item.clientName) return item.clientName;
                    const found = suppliers?.find((s: any) => s.id === item.clientId || s.id === item.vendorId) || vendors?.find((v: any) => v.id === item.clientId || v.id === item.vendorId);
                    return found ? found.name : 'Unknown';
                })();
                const compName = companies?.find((c: any) => c.id === item.companyId)?.name || 'the same selling entity';
                const mY = getMonthYear(item.date || item.invoiceDate);

                list.push({
                    id: 'month_' + key,
                    type: 'monthly_company',
                    key: `Month-wise Company Overlap: ${clientName} & ${compName} in ${mY}`,
                    items,
                    reason: `Our rules flagged ${items.length} separate invoice entries for client "${clientName}" by seller "${compName}" specifically during the single month of ${mY}.`
                });
                count++;
            }
        });

        return { duplicateGroups: list, duplicateGroupsCount: count };
    }, [data, suppliers, vendors, companies]);

    // Calculate dynamic high-level metrics
    const metrics = useMemo(() => {
        let totalBilled = 0;
        let totalCollected = 0;
        let totalPending = 0;
        let totalVat = 0;
        let createdInvoiceCount = 0;
        let createdInvoiceAmount = 0;
        let toBeCreatedInvoiceCount = 0;
        let toBeCreatedInvoiceAmount = 0;
        
        (filteredData || []).forEach((item: any) => {
            const { actualAmt, vatAmt, totalAmt, paidAmt, balanceAmt } = getSOAItemAmounts(item);
            totalBilled += totalAmt;
            totalVat += vatAmt;
            totalCollected += paidAmt;
            totalPending += balanceAmt;

            const genStatus = item.invoiceCreationStatus || 'Created';
            if (genStatus === 'Created') {
                createdInvoiceCount += 1;
                createdInvoiceAmount += totalAmt;
            } else {
                toBeCreatedInvoiceCount += 1;
                toBeCreatedInvoiceAmount += totalAmt;
            }
        });

        return {
            totalBilled,
            totalCollected,
            totalPending,
            totalVat,
            createdInvoiceCount,
            createdInvoiceAmount,
            toBeCreatedInvoiceCount,
            toBeCreatedInvoiceAmount,
            count: filteredData?.length || 0,
            pendingCount: (filteredData || []).filter((item: any) => {
                const { balanceAmt } = getSOAItemAmounts(item);
                return balanceAmt > 0;
            }).length,
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
            const { balanceAmt } = getSOAItemAmounts(item);
            if (balanceAmt <= 0) return;

            const refDateStr = item.dueDate || item.date;
            if (!refDateStr) return;

            const refDate = new Date(refDateStr);
            refDate.setHours(0,0,0,0);

            const diffTime = today.getTime() - refDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const amount = balanceAmt;

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

            const { totalAmt, paidAmt, balanceAmt } = getSOAItemAmounts(item);
            trends[monthKey].bBilled += totalAmt;
            trends[monthKey].itemsCount += 1;
            trends[monthKey].cCollected += paidAmt;
            trends[monthKey].pPending += balanceAmt;
        });

        return Object.keys(trends)
            .sort()
            .map(key => ({
                key,
                ...trends[key]
            }));
    }, [filteredData]);

    const monthlyAuditBreakdown = useMemo(() => {
        const monthsData: { 
            [monthKey: string]: { 
                label: string; 
                clients: Set<string>; 
                createdCount: number; 
                createdAmount: number; 
                pendingCount: number; 
                pendingAmount: number;
                totalCount: number;
                totalAmount: number;
                clientStats: {
                    [clientId: string]: {
                        id: string;
                        name: string;
                        totalCount: number;
                        createdCount: number;
                        pendingCount: number;
                        totalAmount: number;
                        pendingAmount: number;
                    };
                };
            };
        } = {};

        (filteredData || []).forEach((item: any) => {
            const dateStr = item.date;
            if (!dateStr) return;
            const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
            if (!monthsData[monthKey]) {
                const [yr, mn] = monthKey.split('-');
                const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
                const humanLabel = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
                monthsData[monthKey] = {
                    label: humanLabel,
                    clients: new Set<string>(),
                    createdCount: 0,
                    createdAmount: 0,
                    pendingCount: 0,
                    pendingAmount: 0,
                    totalCount: 0,
                    totalAmount: 0,
                    clientStats: {},
                };
            }
            
            const amount = item.totalAmount || item.amount || 0;
            const entry = monthsData[monthKey];
            const isCreated = (item.invoiceCreationStatus || 'Created') === 'Created';
            
            if (item.entityId && (item.entityType === 'Vendor' || vendors.some((v: any) => String(v.id) === String(item.entityId)))) {
                const cId = String(item.entityId);
                entry.clients.add(cId);
                if (!entry.clientStats[cId]) {
                    const clientObj = (vendors || []).find((v: any) => String(v.id) === String(item.entityId)) || (suppliers || []).find((s: any) => String(s.id) === String(item.entityId));
                    const clientName = item.clientName || (clientObj ? clientObj.name : 'Unknown Client');
                    entry.clientStats[cId] = {
                        id: cId,
                        name: clientName,
                        totalCount: 0,
                        createdCount: 0,
                        pendingCount: 0,
                        totalAmount: 0,
                        pendingAmount: 0,
                    };
                }
                const stat = entry.clientStats[cId];
                stat.totalCount += 1;
                stat.totalAmount += amount;
                if (isCreated) {
                    stat.createdCount += 1;
                } else {
                    stat.pendingCount += 1;
                    stat.pendingAmount += amount;
                }
            }
            
            entry.totalCount += 1;
            entry.totalAmount += amount;
            
            if (isCreated) {
                entry.createdCount += 1;
                entry.createdAmount += amount;
            } else {
                entry.pendingCount += 1;
                entry.pendingAmount += amount;
            }
        });

        return Object.keys(monthsData)
            .sort((a, b) => b.localeCompare(a))
            .map(key => {
                const clientStatsList = Object.values(monthsData[key].clientStats);
                const fullyCreatedClientsCount = clientStatsList.filter((c: any) => c.pendingCount === 0).length;
                const pendingClientsCount = clientStatsList.filter((c: any) => c.pendingCount > 0).length;
                return {
                    key,
                    label: monthsData[key].label,
                    clientsCount: monthsData[key].clients.size,
                    fullyCreatedClientsCount,
                    pendingClientsCount,
                    createdCount: monthsData[key].createdCount,
                    createdAmount: monthsData[key].createdAmount,
                    pendingCount: monthsData[key].pendingCount,
                    pendingAmount: monthsData[key].pendingAmount,
                    totalCount: monthsData[key].totalCount,
                    totalAmount: monthsData[key].totalAmount,
                    clientList: clientStatsList.sort((x: any, y: any) => y.pendingAmount - x.pendingAmount)
                };
            });
    }, [filteredData, vendors]);

    // Outstanding items helper for list below aging selectors
    const totalAgingAmount = Object.values(agingBuckets).reduce((acc, curr) => acc + curr.amount, 0);

    const activeAgingList = selectedAgingBucket ? agingBuckets[selectedAgingBucket]?.items || [] : [];
    const activeAgingLabel = selectedAgingBucket ? agingBuckets[selectedAgingBucket]?.label : '';

    // --- Tax Credit Note Handlers & Filters ---
    const handleOpenCreditNoteForInvoice = (inv: any) => {
        const comp = (companies || []).find((c: any) => c.id === inv.companyId || c.name === inv.companyName);
        const client = getEntityObject(inv.entityId, inv.entityType);
        const totVal = Number(inv.totalAmount || inv.amount || 0);
        const taxableVal = inv.amount !== undefined ? Number(inv.amount) : Number((totVal / 1.05).toFixed(2));
        const vatVal = inv.vatAmount !== undefined ? Number(inv.vatAmount) : Number((totVal - taxableVal).toFixed(2));

        const initialCN: CreditNote = {
            id: Math.random().toString(36).substr(2, 9),
            creditNoteNumber: `CN-${inv.invoiceNumber || '2660'}`,
            date: new Date().toISOString().split('T')[0],
            originalInvoiceNumber: inv.invoiceNumber || '',
            originalInvoiceDate: inv.date || '',
            originalInvoiceAmount: totVal,
            originalInvoiceId: inv.id,
            revisedInvoiceNumber: `${inv.invoiceNumber} (Revised)`,
            revisedInvoiceAmount: 0,
            entityId: inv.entityId,
            entityType: inv.entityType || 'Vendor',
            clientName: client?.name || inv.clientName || '',
            clientTrn: client?.trn || inv.clientTrn || '',
            clientAddress: client?.address || inv.clientAddress || '',
            companyId: inv.companyId || comp?.id || (companies[0]?.id || ''),
            companyName: comp?.name || inv.companyName || (companies[0]?.name || ''),
            companyTrn: comp?.trn || inv.companyTrn || (companies[0]?.trn || ''),
            reason: `Cancellation of previous invoice #${inv.invoiceNumber} due to revision with updated billing amount.`,
            amount: taxableVal,
            vatAmount: vatVal,
            totalAmount: totVal,
            status: 'Issued',
            items: inv.items && inv.items.length > 0 ? inv.items : [
                { id: '1', name: `Tax Credit against Invoice #${inv.invoiceNumber}`, description: 'Full credit against previous invoice value', quantity: 1, rate: taxableVal, total: taxableVal }
            ],
            createdAt: new Date().toISOString()
        };

        if (onAddCreditNote) {
            onAddCreditNote(initialCN);
        } else {
            setLocalCreditNoteModal(initialCN);
        }
    };

    const filteredCreditNotes = useMemo(() => {
        return (creditNotes || []).filter((cn: CreditNote) => {
            if (creditNoteClientFilter !== 'All') {
                if (cn.entityId !== creditNoteClientFilter && cn.clientName !== creditNoteClientFilter) return false;
            }
            if (creditNoteCompanyFilter !== 'All') {
                if (cn.companyId !== creditNoteCompanyFilter && cn.companyName !== creditNoteCompanyFilter) return false;
            }
            if (creditNoteStatusFilter !== 'All') {
                if ((cn.status || 'Issued') !== creditNoteStatusFilter) return false;
            }
            if (creditNoteStartDate) {
                if (cn.date && cn.date < creditNoteStartDate) return false;
            }
            if (creditNoteEndDate) {
                if (cn.date && cn.date > creditNoteEndDate) return false;
            }
            if (creditNoteSearchQuery.trim()) {
                const q = creditNoteSearchQuery.toLowerCase().trim();
                const cnNum = (cn.creditNoteNumber || '').toLowerCase();
                const origNum = (cn.originalInvoiceNumber || '').toLowerCase();
                const revNum = (cn.revisedInvoiceNumber || '').toLowerCase();
                const client = (cn.clientName || '').toLowerCase();
                const reason = (cn.reason || '').toLowerCase();
                if (!cnNum.includes(q) && !origNum.includes(q) && !revNum.includes(q) && !client.includes(q) && !reason.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [creditNotes, creditNoteClientFilter, creditNoteCompanyFilter, creditNoteStatusFilter, creditNoteStartDate, creditNoteEndDate, creditNoteSearchQuery]);

    const creditNoteMetrics = useMemo(() => {
        let totalCount = filteredCreditNotes.length;
        let totalNet = 0;
        let totalVat = 0;
        let totalGrand = 0;

        filteredCreditNotes.forEach((cn: CreditNote) => {
            const tot = Number(cn.totalAmount || 0);
            const net = cn.amount !== undefined ? Number(cn.amount) : Number((tot / 1.05).toFixed(2));
            const vat = cn.vatAmount !== undefined ? Number(cn.vatAmount) : Number((tot - net).toFixed(2));
            totalNet += net;
            totalVat += vat;
            totalGrand += tot;
        });

        return { totalCount, totalNet, totalVat, totalGrand };
    }, [filteredCreditNotes]);

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
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/45 shrink-0 flex-wrap gap-1">
                        <button 
                            onClick={() => setActiveTabMode('ledger')}
                            className={cn(
                                "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                                activeTabMode === 'ledger' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            )}
                        >
                            üìã Invoice Ledger Table
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
                            üìä Aging & Monthly Reports
                        </button>
                        <button 
                            onClick={() => setActiveTabMode('soa')}
                            className={cn(
                                "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                                activeTabMode === 'soa' ? "bg-white text-blue-600 shadow-sm" : "text-slate-505 hover:text-slate-800"
                            )}
                        >
                            üìÑ SOA & Monthly Packs
                        </button>
                        <button 
                            onClick={() => setActiveTabMode('credit-notes')}
                            className={cn(
                                "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                                activeTabMode === 'credit-notes' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            )}
                        >
                            <Scale className="w-3.5 h-3.5 text-rose-600" />
                            <span>Tax Credit Notes</span>
                            {(creditNotes || []).length > 0 && (
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-bold">
                                    {(creditNotes || []).length}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveTabMode('duplicates')}
                            className={cn(
                                "px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer",
                                activeTabMode === 'duplicates' ? "bg-white text-rose-600 shadow-sm animate-pulse-subtle" : "text-slate-500 hover:text-slate-800"
                            )}
                        >
                            üîç Double-Entry Auditor {duplicateGroupsCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-bold animate-pulse">
                                    {duplicateGroupsCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            if (onAddCreditNote) {
                                onAddCreditNote();
                            } else {
                                setLocalCreditNoteModal({});
                            }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-sm shadow-rose-600/20 transition-all cursor-pointer shrink-0"
                        title="Create a new UAE VAT compliant Tax Credit Note against an invoice"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <Scale className="w-3.5 h-3.5" />
                        <span>Issue Credit Note</span>
                    </button>
                </div>
            </div>

            {/* Financial Summary Ribbons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                    onClick={() => setKpiFilter(!kpiFilter || kpiFilter === 'all' ? null : 'all')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (!kpiFilter || kpiFilter === 'all') 
                            ? "border-blue-500 bg-blue-50/15 shadow-blue-50/40 ring-1 ring-blue-500/20" 
                            : "border-slate-100 hover:border-blue-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">Total Billed Invoices</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalBilled.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono font-bold">Invoiced count: {metrics.count} bills</p>
                    {(!kpiFilter || kpiFilter === 'all') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                </div>

                <div 
                    onClick={() => setKpiFilter(kpiFilter === 'collected' ? null : 'collected')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (kpiFilter === 'collected') 
                            ? "border-emerald-500 bg-emerald-50/15 shadow-emerald-50/40 ring-1 ring-emerald-500/20" 
                            : "border-slate-100 hover:border-emerald-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">Revenue Collected</span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalCollected.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-2 font-mono font-bold">
                        Settle rate: {metrics.totalBilled > 0 ? ((metrics.totalCollected / metrics.totalBilled) * 100).toFixed(1) : 0}% ({metrics.collectedCount} settled)
                    </p>
                    {(kpiFilter === 'collected') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>

                <div 
                    onClick={() => setKpiFilter(kpiFilter === 'pending' ? null : 'pending')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (kpiFilter === 'pending') 
                            ? "border-indigo-500 bg-indigo-50/15 shadow-indigo-50/40 ring-1 ring-indigo-500/20" 
                            : "border-slate-100 hover:border-indigo-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">Outstanding Receivables</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalPending.toLocaleString()}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-2 font-mono font-bold">
                        {metrics.totalBilled > 0 ? ((metrics.totalPending / metrics.totalBilled) * 100).toFixed(1) : 0}% pending ({metrics.pendingCount} unpaid)
                    </p>
                    {(kpiFilter === 'pending') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                </div>

                <div 
                    onClick={() => setKpiFilter(kpiFilter === 'vat' ? null : 'vat')}
                    className={cn(
                        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden",
                        (kpiFilter === 'vat') 
                            ? "border-amber-500 bg-amber-50/15 shadow-amber-50/40 ring-1 ring-amber-500/20" 
                            : "border-slate-100 hover:border-amber-300"
                    )}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono font-bold">5% Output Tax (VAT)</span>
                        <div className="p-2 bg-slate-50 text-slate-655 rounded-2xl">
                            <Percent className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">AED {metrics.totalVat.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono font-bold">Collected Output VAT on ledger</p>
                    {(kpiFilter === 'vat') && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                </div>
            </div>

            {/* CLIENT INVOICE GENERATION TRACKER (Client Invoices checks) */}
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-3xl shadow-xs">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="shrink-0">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                            <span className="p-1 bg-indigo-100 text-indigo-700 rounded-lg font-bold">üìú</span>
                            Client Invoice Generation Status Tracker
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-sm font-sans">
                            Track client invoices you have created vs those you need to create. Click to filter.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto items-stretch">
                        <button
                            onClick={() => setFilterInvoiceCreation('All')}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-4 cursor-pointer",
                                filterInvoiceCreation === 'All'
                                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-350"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">üåê All Receivables</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 font-mono",
                                filterInvoiceCreation === 'All' ? "bg-indigo-700 text-indigo-150" : "bg-slate-100 text-slate-500"
                            )}>
                                {(data || []).length}
                            </span>
                        </button>

                        <button
                            onClick={() => setFilterInvoiceCreation(filterInvoiceCreation === 'Created' ? 'All' : 'Created')}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-4 cursor-pointer",
                                filterInvoiceCreation === 'Created'
                                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-200"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">üìú Created ({metrics.totalBilled > 0 ? ((metrics.createdInvoiceAmount / metrics.totalBilled) * 100).toFixed(0) : 0}%)</span>
                            <div className="flex items-center gap-2 font-mono shrink-0 font-bold">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    filterInvoiceCreation === 'Created' ? "bg-indigo-700 text-indigo-100" : "bg-indigo-50 text-indigo-750"
                                )}>
                                    {metrics.createdInvoiceCount}
                                </span>
                                <span className="text-[10px]">AED {metrics.createdInvoiceAmount.toLocaleString()}</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setFilterInvoiceCreation(filterInvoiceCreation === 'To Be Created' ? 'All' : 'To Be Created')}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-4 cursor-pointer",
                                filterInvoiceCreation === 'To Be Created'
                                    ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-rose-50/50 hover:border-rose-200"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">‚è≥ To Be Created</span>
                            <div className="flex items-center gap-2 font-mono shrink-0 font-bold">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    filterInvoiceCreation === 'To Be Created' ? "bg-rose-700 text-rose-100" : "bg-rose-50 text-rose-750"
                                )}>
                                    {metrics.toBeCreatedInvoiceCount}
                                </span>
                                <span className="text-[10px] text-rose-600 font-extrabold font-bold">AED {metrics.toBeCreatedInvoiceAmount.toLocaleString()}</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setShowMonthlyAuditBreakdown(!showMonthlyAuditBreakdown)}
                            className={cn(
                                "flex-1 lg:flex-none px-4 py-2.5 rounded-2xl border transition-all text-xs font-black flex items-center justify-between lg:justify-start gap-2 cursor-pointer shadow-2xs",
                                showMonthlyAuditBreakdown
                                    ? "bg-[#a855f7] text-white border-purple-700"
                                    : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                            )}
                        >
                            <span className="flex items-center gap-1.5 font-sans">
                                üìä {showMonthlyAuditBreakdown ? "Hide Monthly Audit" : "Show Monthly Audit Table"}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Expandable Monthly Audit Table */}
                {showMonthlyAuditBreakdown && (
                    <div className="mt-5 border-t border-slate-200/60 pt-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-[#a855f7] flex items-center gap-1.5 font-sans">
                                üìã Month-by-Month Client Invoice Generation Audit
                            </h5>
                            <span className="text-[10px] text-slate-400 font-bold font-mono">
                                Showing data based on active ledger filters
                            </span>
                        </div>
                        
                        {monthlyAuditBreakdown.length === 0 ? (
                            <div className="text-center py-6 text-xs text-slate-400 font-semibold font-sans">
                                No records found to perform monthly auditing.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-2xs">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                            <th className="py-3 px-4">Billing Month</th>
                                            <th className="py-3 px-4 text-center">Active Clients</th>
                                            <th className="py-3 px-4 text-center">Invoices count</th>
                                            <th className="py-3 px-4">Total Amount</th>
                                            <th className="py-3 px-4 text-indigo-700 bg-indigo-50/30">üìú Already Created</th>
                                            <th className="py-3 px-4 text-rose-700 bg-rose-50/30">‚è≥ Balance To Be Created</th>
                                            <th className="py-3 px-4 text-center">Generation Progress</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-sans">
                                        {monthlyAuditBreakdown.map((row) => {
                                            const completionPct = row.totalCount > 0 ? (row.createdCount / row.totalCount) * 100 : 0;
                                            const isExpanded = expandedMonthDetails === row.key;
                                            return (
                                                <React.Fragment key={row.key}>
                                                    <tr className={cn("hover:bg-slate-50/55 transition-colors font-sans", isExpanded && "bg-purple-50/10")}>
                                                        <td className="py-3 px-4 font-extrabold text-slate-900">
                                                            <div className="flex flex-col">
                                                                <span>{row.label}</span>
                                                                <button
                                                                    onClick={() => setExpandedMonthDetails(isExpanded ? null : row.key)}
                                                                    className="text-[10px] text-[#a855f7] hover:underline cursor-pointer font-bold text-left flex items-center gap-0.5 mt-0.5"
                                                                >
                                                                    {isExpanded ? 'hide breakdown ‚ñ¥' : 'show breakdown ‚ñæ'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[11px] font-extrabold font-mono">
                                                                    {row.clientsCount} / {vendors?.length || 0} active
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-bold font-mono">
                                                                    {row.fullyCreatedClientsCount} created, {row.pendingClientsCount} pending
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-650">
                                                            {row.totalCount} invoices
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-slate-500 font-mono">
                                                            AED {row.totalAmount.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 px-4 bg-indigo-50/10">
                                                            <div className="flex flex-col font-sans">
                                                                <span className="font-extrabold text-indigo-700 font-mono">{row.createdCount} created</span>
                                                                <span className="text-[10px] text-slate-400 font-semibold font-mono">AED {row.createdAmount.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 bg-rose-50/10">
                                                            <div className="flex flex-col font-sans">
                                                                <span className="font-extrabold text-rose-600 font-mono">{row.pendingCount} pending</span>
                                                                <span className="text-[10px] text-slate-400 font-semibold font-mono">AED {row.pendingAmount.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                                                                    <div 
                                                                        className="h-full rounded-full bg-indigo-600"
                                                                        style={{ width: `${completionPct}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-700 font-mono">{completionPct.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-purple-50/10 border-b border-purple-100">
                                                            <td colSpan={7} className="p-4 bg-slate-50/50">
                                                                <div className="border border-purple-100/60 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 font-sans flex items-center gap-1.5">
                                                                            üîç Active Clients Invoice Generation Audit Breakdown ‚Äî {row.label}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 font-bold font-sans">
                                                                            {row.fullyCreatedClientsCount} of {row.clientsCount} active clients fully generated
                                                                        </span>
                                                                    </div>
                                                                    <div className="overflow-hidden border border-slate-100 rounded-lg">
                                                                        <table className="w-full text-left border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">
                                                                                    <th className="py-2 px-3">Client Name</th>
                                                                                    <th className="py-2 px-3 text-center">Invoices Total</th>
                                                                                    <th className="py-2 px-3 text-center text-indigo-700">Created Invoices</th>
                                                                                    <th className="py-2 px-3 text-center text-rose-600">Pending Invoices</th>
                                                                                    <th className="py-2 px-3 text-right">Pending Balance Amount</th>
                                                                                    <th className="py-2 px-3 text-center">Status Check</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 text-[11px] font-sans">
                                                                                {row.clientList.map((client: any) => (
                                                                                    <tr 
                                                                                        key={client.id} 
                                                                                        className="hover:bg-indigo-50/40 cursor-pointer group/row transition-colors"
                                                                                        onClick={() => handleGoToInvoice(client.id, row.key)}
                                                                                        title="Click to filter the main ledger for this client's invoices"
                                                                                    >
                                                                                        <td className="py-2 px-3 font-extrabold text-slate-800 group-hover/row:text-indigo-700 transition-colors">
                                                                                            <span className="flex items-center gap-1 flex-wrap">
                                                                                                <span>{client.name}</span>
                                                                                                <span className="opacity-0 group-hover/row:opacity-100 text-[9px] text-[#a855f7] font-semibold transition-opacity bg-purple-50 px-1 rounded-sm">
                                                                                                    click to view ‚ûî
                                                                                                </span>
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-center font-bold text-slate-600 font-mono">{client.totalCount} bills</td>
                                                                                        <td className="py-2 px-3 text-center font-semibold text-indigo-700 font-mono">{client.createdCount} created</td>
                                                                                        <td className="py-2 px-3 text-center font-semibold text-rose-650 text-rose-600 font-mono">{client.pendingCount} pending</td>
                                                                                        <td className="py-2 px-3 text-right font-bold text-slate-655 text-slate-650 font-mono">
                                                                                            {client.pendingAmount > 0 ? `AED ${client.pendingAmount.toLocaleString()}` : '‚Äî'}
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-center font-sans">
                                                                                            {client.pendingCount === 0 ? (
                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#a855f7] bg-[#f3e8ff] px-2 py-0.5 rounded-full">
                                                                                                    ‚úì Completed
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-650 bg-rose-50 px-2 py-0.5 rounded-full">
                                                                                                    ‚è≥ {client.pendingCount} to generate
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Dynamic Panel */}
            {activeTabMode === 'ledger' ? (
                <div id="accounts-receivable-ledger-section" className="space-y-4">
                    {/* Professional Date Filtering Bar: Month wise / Year wise / Range wise & Current / Last month */}
                    <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    <span>Receivable Ledger Period Filter</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Select quick filters or enter custom periods for smart month/year/range tracking.
                                </p>
                            </div>
                            
                            {/* Mode Pill selector */}
                            <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl border border-slate-200/40 gap-1">
                                {[
                                    { mode: 'all', label: 'All History' },
                                    { mode: 'current-month', label: 'Current Month' },
                                    { mode: 'last-month', label: 'Last Month' },
                                    { mode: 'month-wise', label: 'Month-Wise' },
                                    { mode: 'year-wise', label: 'Year-Wise' },
                                    { mode: 'custom-range', label: 'Date Range' }
                                ].map((tab) => (
                                    <button
                                        key={tab.mode}
                                        type="button"
                                        onClick={() => {
                                            setDateFilterMode(tab.mode as any);
                                            // Pre-populate if empty
                                            if (tab.mode === 'month-wise' && !selectedMonthValue) {
                                                setSelectedMonthValue(new Date().toISOString().substring(0, 7));
                                            }
                                        }}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer",
                                            dateFilterMode === tab.mode 
                                                ? "bg-white text-slate-950 shadow-xs border border-slate-200/30 font-black" 
                                                : "text-slate-500 hover:text-slate-800"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Interactive Configurator Area depending on selected mode */}
                        {dateFilterMode !== 'all' && (
                            <div className="bg-slate-50 p-4 border border-slate-200/40 rounded-2xl animate-fadeIn text-xs">
                                {dateFilterMode === 'current-month' && (
                                    <div className="flex items-center gap-2 text-slate-600 font-medium font-sans">
                                        <span className="p-1 px-2.5 bg-blue-50 border border-blue-100 rounded-md text-blue-700 font-mono font-bold">MODE ACTIVE: CURRENT MONTH</span>
                                        <span>Showing records matching <strong className="text-slate-900 font-bold">{new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}</strong>.</span>
                                    </div>
                                )}

                                {dateFilterMode === 'last-month' && (
                                    <div className="flex items-center gap-2 text-slate-600 font-medium font-sans">
                                        <span className="p-1 px-2.5 bg-amber-50 border border-amber-100 rounded-md text-amber-700 font-mono font-bold">MODE ACTIVE: LAST MONTH</span>
                                        <span>Showing records matching <strong className="text-slate-900 font-bold">{(() => {
                                            const today = new Date();
                                            return new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });
                                        })()}</strong>.</span>
                                    </div>
                                )}

                                {dateFilterMode === 'month-wise' && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">Select Target Month</span>
                                            <input 
                                                type="month"
                                                value={selectedMonthValue}
                                                onChange={e => setSelectedMonthValue(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 focus:outline-hidden font-sans"
                                            />
                                        </div>
                                        <div className="text-slate-600 font-medium pt-3 font-sans">
                                            Currently filtering for month: <strong className="text-slate-900 font-black">{selectedMonthValue ? (() => {
                                                const [yr, mn] = selectedMonthValue.split('-');
                                                return new Date(parseInt(yr), parseInt(mn) - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });
                                            })() : 'None Selected'}</strong>
                                        </div>
                                    </div>
                                )}

                                {dateFilterMode === 'year-wise' && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">Target Financial Year</span>
                                            <select
                                                value={selectedYearValue}
                                                onChange={e => setSelectedYearValue(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 cursor-pointer focus:outline-hidden font-sans"
                                            >
                                                {Array.from({ length: 11 }, (_, i) => (2020 + i).toString()).map(yr => (
                                                    <option key={yr} value={yr}>{yr}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="text-slate-650 font-medium pt-3 font-sans">
                                            Currently filtering for year: <strong className="text-slate-900 font-black">{selectedYearValue}</strong>
                                        </div>
                                    </div>
                                )}

                                {dateFilterMode === 'custom-range' && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 font-sans">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">From Date</span>
                                            <input 
                                                type="date"
                                                value={customRangeStart}
                                                onChange={e => setCustomRangeStart(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 focus:outline-hidden"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">To Date</span>
                                            <input 
                                                type="date"
                                                value={customRangeEnd}
                                                onChange={e => setCustomRangeEnd(e.target.value)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 focus:outline-hidden"
                                            />
                                        </div>
                                        <div className="text-slate-605 font-medium pb-1.5">
                                            {customRangeStart && customRangeEnd ? (
                                                <span>Showing range between <strong className="text-slate-900 font-bold">{customRangeStart}</strong> and <strong className="text-slate-900 font-bold">{customRangeEnd}</strong></span>
                                            ) : (
                                                <span className="text-slate-400 font-medium">Please pick both boundaries for range tracking.</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

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
                                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.clientName ? ` (${p.clientName})` : ''}</option>)}
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
                                            <option value="Partially Received">Partially Received</option>
                                            <option value="Partial Amount Received by Cheque">Partial Rec by Chq</option>
                                            <option value="CPD Pending">CPD Pending</option>
                                            <option value="PDC in Hand">PDC in Hand</option>
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
                        data={ledgerFilteredData}
                        columns={[
                        { key: 'date', label: 'Date', sortable: true },
                        { 
                            key: 'invoiceNumber', 
                            label: 'Invoice #', 
                            sortable: true,
                            render: (item: any) => (
                                <div className="flex flex-col">
                                    <span className="font-mono font-black text-slate-900 block whitespace-nowrap">
                                        {item.invoiceNumber || '-'}
                                    </span>
                                    {item.invoiceType === 'Proforma Invoice' ? (
                                        <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-widest mt-1 bg-blue-50/50 border border-blue-100/30 px-1.5 py-0.5 rounded w-max">
                                            Proforma
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mt-1 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded w-max">
                                            Tax Invoice
                                        </span>
                                    )}
                                </div>
                            ),
                            exportText: (item) => item.invoiceNumber || ''
                        },
                        { 
                            key: 'invoiceCreationStatus', 
                            label: 'Generation',
                            sortable: true,
                            render: (item) => {
                                const genStatus = item.invoiceCreationStatus || 'Created';
                                return (
                           xúÏ}›o‹»ñﬂ{˛ä›´5´nµZ∂Ié,…sçÿñ÷÷ÃΩªÜqá›,usÕ&{H∂•æZΩmÚ$ÿ`Û X‡>%ª	∞o˘'ÊæÊ»˝rN}ê≈ØÓ*í-À^s0≤∫EV´Nù:üøCà∏ˆ√âÂëÅkÖ·+kLn^ÎüÕk≈Ò\«£ÌKó^'¢„∞=†^D2¥&ÌÕŒô\∑{¯œ¨ΩIÍŸ‘nªC—Î®˝v≥;π~G¶ì	VHIﬂlxˆjM¡∞¥Ì˘WÅ5YY◊—êzo"+öÜ‰‡‡Ä¨‘ä®ΩJ¥¿Î	YÈ€ég;CøΩ”„í_l¬7l¸‚Û√nó\˙^‘ÜÔ´ÔªˆäYw{¨ª¿©“˚ÿÎv7vwxoÏã∏ØækﬁÀs∆~Ì…‘Ö?Ü”~‰“≠æ◊nµ«xS6©O»Í~˜˛öƒ_Ïë’ˇ˚óˇ@.|Úî∆ﬂﬁju¥øÅÑ∏xPkˇ|Ó-∑ÛIÖ^O¸ ∫Ä˘‹#-$ÿ5rp»(∑„x|g@Ÿ®_æüˇyÚæ•-œÈÙf>)ºß3ò≥Å?Üwü=∑W◊ÁﬂÓZ}Í¬o®Î¬F9Êœ≠ŒÁÄ¬Æƒ˚ÓÕÃÿKﬂ,úÍÅÔÖ¡¡ë“‚Ét(õì∑Ô÷:ó@ˇ≠÷ iq–qlF!l>„ó¬˚òKÓè»q,(ÉhxDè/Ì€ŒÖü≠Û¶ﬁä˝„hüt\Ë…ÎsG6g<$a08`ç∞6nâÂF‚3Œ ≠:⁄´ˆC2Çˇ˝˛ü—A‘Ü%à,«SYß`íÇMÑ.ÓˇM`¿B„$ìv8n8
Ô}ªª≥wIÉÄÁæÎf+ûﬂñ_≠ê˝iXÉÌm¯Úô•ê/CÌªS∆Ìkcvª›Ãª±Ø·’6‡>eÚ˙g”0r.gÚ#gê¿áyÎ◊°rƒƒ”¢ˇﬁÚ∫iq:`î4ù%dŒ+ŒV◊:¿à√˙∂∫Î§∑¶« „I€ÄY3X˝÷≥G˝J˙‘‚≥≈	ÍQ∑O^LΩ|I∆÷u˚
NÌ-<∂'FcÓæ˜`dŒ–”>3ÿKiû¸^≠©]tƒ,Ì Úu"Éc‡î›O6»y‡#ª®v,ﬁ”Ö, r5	°ò¯≤t˜∏k≤3A0â¯`ìÏµ:rc*õπynØÂÜãŸÑùú:Õ}dDnŸWV•^Â•∑a≥%
v„‡=éˆï´e2≠πÔ«e∑Ä¸Äân«Æ˜¢–6ˇ¡f'FcÆ-mÉYc8F"›Ìu$Óû{sÚ§’wÈÚIj∞u˜û÷æŸ≈}stzBnÿRÚ˜ÏD˛`πÙ?å÷nuiy≥ˇ¡äéå‡á£“⁄˘fÕÑØUù÷Ù~ì…7F<n‹›µ˚6≠ëYÆŸƒ^‡#˜ì∞ô^õ=î≈Pﬁ6fÒú‹Ôta4÷Â∑˛»ˇç–*ÃuÃq®zÜ‰9?yˆŸ´ub ÏÇ°ƒá˘”}“«yÓÜˆ?Üﬁà6≠º}JˇêﬁÔO£»˜ådgﬂÉ£z˛‡¶≈÷√ˆØ<◊∑Ï?˙zŒ…®ÖM◊:[÷u1ßÎ§oyÔè‹°°¢ÃÎëˇ»T∑DÂÃÙ˚uçﬂúVÓ@∞ÒB	≈F?eÃhd@.åÍDL¡y¿˝BƒdË∑f¶¬Ï«=¶T⁄mPi∑”z¨ëZΩø¡I‚Ni(§—y@?8ÙJL⁄s†û÷…π˝XÑC«4∞\{¥Ûº∏$Ú¬˘@âòç•—ŒÈåñíçÚ¢˜ürFñgªÙlBΩ„Ä⁄NÙ èË3?ì…Ä¶Föƒµ»Ö›ºZyÜSJ.¨k¬_ò‡kh9xzE#'$‚ê'-⁄v»•§¶F∞1∞ºu]fR^[uΩA©ßîæ‰Ã,ë∏Óªe%d÷|mÛ∫∏€PÊ’Ωn»ƒrÏ£1;†]$¯ù‹rËÕŸÚb.·ÜºÒ≈¢îs)î¯PÒ”ú[A‰XÆ;#ØÈÄó≥Wcëπ‡æ‰Æ5çW·S` _·5◊êƒ‰+4]èèŸ{Ïå9≠êË~ƒÜ%€)§¢xîôa–dmç˚4`«{ò|î≥ZÛÔ—s˜®KÆ⁄ó¿1ÍåÚ /¶°UYﬂn?£-ÛŸ|OÊÿ˜¸¸['Ü˘
Ô_¨∞À£Û!jâ01{Ñ©äbeB\}Po(h7HeŒx:~ÎåÃ˘ƒ:Q∏Gz(Tô≠ÚAÚ„já¯ÁÕ∂sˆ√ßñ+ﬁ=a)w˙˙ÜnÉ€5ÿﬂbÅcÉ$¬ú 7Èœ»Òà˛4•s˘•≤5ü¿˚˘≠?}·±Ö<VÜXt”!y.+˛∞,6´¨‘6˚ÖÕ~a≥Ï™»fèœO»9HÀ09Kd{ELiA‰ôS o/¥dºü%<
?‰~€3Úf‚•L’R<‡K<KOéA&ø¥ºeÍwπ»ìi0qi≤Œ‚s~©≈ÃW[ô≥˚ª⁄fFÙZ—§ÀZMÉ¯—]'™3è
ïGaL)Î›^ıé$á˝¯ÅÂÍü{Yë°Vq;±çZèÇL¬D’Wb‚çÓ6 ‘‘ÜÙÆ¯	ﬂ;≤ÌÉˆOŸß∂·-¯oŸ='‘•≈ª¯oe˜=ù∫Ô≥˜æú∫ë¨eﬁ3ﬂOl{N,˛\˙õ‚Á®án]÷ˆËf ØÄﬁ‚õ”0Ú«o®F7âØqùÄ≤Ãt¸éQ0[p®é@d H°kíª„oM≠r/ÔéaÁ∑oXòg_M—27ú˛∂j€6Å3AŸ.nY˝Æjªˆ∆D»î©@ß'ùö°NïG≤∏„„èÎ:N¸◊È9J∑ Œ–ÏÕ5∆ÚŒ€ÖÌw`|„E›†Pı’OkÚ∏≈Yc\⁄ávj”¡û∏S ﬂ÷OåFKÇÍ2~ZŸ'∆œ≤˝a˛î ı¡˘¡!ÂkpKV4ë]$Ó"ë¯.Ì– É÷ )˛ÉrüÙÃsô2ÛK™,woeù,⁄b≠/-7úC2≈Ï˝∂¯Îêu˛Ã°Æ‹º]M≠ÛÍ:YUñnµ‰ Â©œórQ]æÌoí◊-ñA¶!ngæ·VÅäãëÍ®o†Vˇ•os6o:√QÆFÒgÕ0\ÄúµwKÑ˙õço…s4œû»—ò˘’àR„w–0$c
ªío7äß)€m∆_Á?iÔí±Ω7i?äe‰∑ 5t¸éÑ#ÀˆØ⁄·ò,}Q◊iK!Ù¡~¸´8¿æO£+J=aùQ/àæî±JÔåºﬂﬁa∂¨≠z“æñ—b¥ï≥‘ÙQ($KÖ	° ì¿$5dˇ©è`
∂“û◊2jÔ§Ãó&æW¶AÚÿ\ASGûÂŒB'$8|Ëá⁄é∂4Óö‰fÉ˛”·…‹‹Hmg:^9dÒ  ~‚1O¨!%C ƒ	â|Ç!¿÷#vΩM¸i$¬t L"IÿŸﬂòh≠î@ôéû_92éW‹∏a,DI[¢#œ~	34rgß◊Í∂Xƒ$L¸ÈÈñ,
◊…òﬂpÅ~c¯ÿr@Jã0ê[À≤ã?••6É∞
-k2h€[L◊Üﬂ≈v'£◊>ÃŸ;TX≤†k7ŒIî„@éî“úÑgXÆß]˙A{‚;lpÇÉıÆC=’¿äG—õI@-;&•7Ì∆ù‡O≥ 	∂OŸIGÿ“õ•£ÖX,Ö^1rPÉZy‘-{î˘ Ó!˝ `°t≤lörŸ◊˙dﬂ˛Qi≥Uõ#÷8àV˛ﬁÎ∫(C©Ø)Ó≤œÑX°H9hÛÙ øÔilrˇG£ÿÛÄw—¡≤	_˝Â¨ÜìLÁñå∞¬ñ…•óLBÊLâ	ùÒ2ÌØ∂ ûz∞‹ .õd≠ö$ùÈ”cGÛ !ÀëÓ)í®q°∂@:⁄ŒÀönâº˛(N¸»ÓÁ¢<è—v≠.˝{±≤wlvHæªTΩcçg(cà‡‘≥¬ˆ&	«{…«qá GÆ1m/X˘û3Åø¿°aKÂèkù±5iµﬁæß≥u“gﬂΩ3äWôï˙É¯◊£§}¶[C€∫˘ìAtv…IÈ «™…!È¢vŒá){»FÓæ5Ú-¡ç≤G∫M√û\Ê7Cˇº»á‚ø…œjö¨ty‹ ®˝	€™ã—lS¡•zŒñÄb¥3Ï<î.]8fFémSœ¿	áWLt∆1Ë?K	ÌrtÑœe£◊ï'‡ÿñø%˜nÏêπ0ÕN∑˜ŒÃØΩx	Kg¥˙ıñÇ⁄†ÆI«lëñ=◊‚”_»èr}Ã;ïté!Â`ÿâÌÏT2^ù¡\X¥∑)6ÉyƒéÏnÛ∑q4X◊u<ÎÍÖ^ˆMÓeW„ıb?˚„Ãí∞oπIRä! Ùõmjy≈S‚˙Åq&>iıJ-ÑŸ∫„UeÌM¿9H π˚Ûfª∑õªEkóò?]j°Ë÷ˆ|è
Ÿ*u–	Vf∫πC*ó;QsGåïÌ|ì»0úgŒ5µ[õk∑ﬂˇíKFC“^ Ô…Núÿvˇ‘
»:£ÂrûÄóõàÓÕÂ îﬁ7b/.w˚;L∆vÓ‘¨KjL⁄iÆ≤2‚√Q«∂≤û⁄≥k∑ÊùÑ—ÃÖn0Ùh¥G~¸ZYÍ€o~$∑Üç%3iáAÍ´çãQÊl~uC
ÖB◊¬ˆ	3ÆóªìXÎGÓàòzJ∆æçTh9—"«ÀÿgﬁX›¬◊gÇoë>Äv‰0q?éÁ`¥5RÖ?±N4Å~ù¿œÕnôoRΩ˛]Í˘Mˆº÷„Ù„wr}∑ı:O;Ì§lÇ·Ëã‘˙-¶÷Ôp7ﬁÓ|—Ø¢ó§X~õÎ¢Îq§≠	Hw&"^F©/«îz[ª∆5=o¨€¨D)†(˚Æﬂ$±üâËø´¨cq)¸ƒ*∆T±1ÂÛ;tÇÌôJ	˚a¯Ã?ñ>8œ··7:∞=ˆÇ	≠–{Ló•-≤é§ﬁ ¯Ø"åßﬁ…	Aßﬁ0›¶úÜ“[à¡,—ñüAö/mÑG¥æí3ÎGW0ªWAƒ'VlÉ,ç>!èË‡˝±≤ô¿õLÿ»xıPâ_∑≠i‰„fÔôˇDo«?Lv¸ ·9»5pVÄP≈'æ™/ZnñQ•tTøÚ•ﬂŸ¡'ƒ
∏a¬û“ò™ò±£yË–fzÆi6(Õ§gm‹ƒ,uƒ≤ _(j`–=2hbﬁº‰9◊ö ˜34£(l¢îk†Ù$2˙∆L¸"B®f!/òŸ®[ÃxÂP‚F¸b#5›∏¸`Òã1Æﬂ2:zÍ 5`ê2?Å›µ¨∂œƒÓ}:kæuí¯i†#Â$‚VÁeu»y?h‰,G¨Z/T`öJVaÔG}ﬂû©Ô<6`{Fƒ/B‹›©±ö=dôÁ¬‡™Ë‚æá»∑≠9 ΩbÙπ((∑ÏbÌtB˝“üa´ªŒ˛´ÿZ@/qDÍ‡x0˘îÖÚ«¡Ã€_´#€πÑûf!ÙÙ“äF8`¸†’‚Ø4§—Ö3Üy!m9¢‰ª5‡H-–c∫‰[≤ˇËmØ’Ou¸Ø}.?ÇΩ“Ëå‚≤ØL1Á)ˆmNl∫ ôPÔÀ¡ÊT<8ì°ÿYñ'ÍÃ±P™Ü¿|ñË=QôCoT5_ó5ﬁ NÓ¬>¥@ôÛ|<n~?UŒ∆÷Â"Eí•≤7”]v›dSb Òp3wö˚
äÆ¶¶◊0º∏âÂm#UK{ÌvÚª≥•njﬁeH«Nbn¡xí√vı’∆—Íå≠"NCˆ∫âèı}{ƒ¬—œÖÉHÕaJcK«·É0mTôÅW~$Û¶väy¡≥iàÁJÁ@∆§ÍL@ºÇ∑ƒ∆uúX(¨58ıÿÿRwÇß%‘ûå™Ä¬˜|
•"Yˇê© Yv›ÙhŸï˜îÍXù‚c#)RíT/â%È8«^Å0Pˆ:FÌ∆‚u&` î≤ËjHdÀAî¶¢v%BjÚã)jiq+uˆíπ±D^‘NS*Ü¡°ç≈ƒªÕ¨ΩÕ≠Áèy#Òœã™Õx¢ãoùÁÇAO∏H  <æüúX·®Ô[Ay–Ìís*w‰T.±ƒ¥≈˝c8Ã<€ ÑÁ+ã¶Xƒ‹*Wàst4ò>¿hå`xˆ/®=‘À[\ú≥X!_qÄ‘‡˙CŒrN«c+òa<Q&)ë8ık≥|:#˛¯ÖÂŸd"‚ﬁå{üDRFx§rVÃúâNƒÕﬁ/bÜÏmÿ?YXñb≤u≠c´(JA^Ê„ó-;à≥ëE¨ñ„2ß‘åF]l∏‘b…~aÃ=lw5Êw–º\iy!?zA/£Ω,W‚$N.ÿ+ÍãÂòîF–H&8LÚ¶k][›R›ÇU\ÇYw`.7&óGæÛq]Éé.Åoìr?¯Ét\˘£õä>ûÚŒU«ïê´m“5gm©]Ky}©˛∏äΩô…}∆2mÁXR]œ¥å^˙ÿ`Ó±Ø„ì>◊=†#Ü5ÿÈ#¡¬¬äå˛Â YçÙ}F9Ÿ´ñﬂ#ˆyÒ`.é∫o«N„ŒéR•|K‡z>bWƒt’“h ë3Æqßõ‘bÇﬂ—Ë2≥• £ı4∆õ,7m›…⁄y$b.©"1Wî°ïDÏ«8æãAoh¡∞ÿäzv¡ª£∑D•IÄt≈jLD6iìWMπ7TÏMîz#Ö^[ô◊\âı5Æ∆˘¡	ßò¡+Ûz0ﬂ	Sœ#V§ı"&¢¥Å7≤_H_H.ï§ZÉlÁtX4IÁ%föuﬁP'ì¸5Ì gµhÆN>u…4£≤È:?M€‚·@∫—ªs_òUÔµﬂˆvô‹k3:	⁄õ_dºÍ…"8˝sÑπ¶sùÎ√(ﬁ_çó-uà>¨}¬.®/ùìwÍ˚µä{LVE¿·HãÑú∫Gj-◊|va„Lj°§è⁄[D˘PÎ¢≥≤Ê§å∫RìÃãc9±IÃ(ÆÙ]k˚“Õ0∞l4Ëµ#ø„¸qJ≤ÇoU«u&ÀÕÂúL≥T™{ÖTÏUê'òOÅ´›ØZvÛcÃyΩÇØ5ƒﬂÎınê@Pt•)mÍ}r¥&∫∑9©	◊éŒapª¬¬#∞MñC^BnOWπ4ˇÒH´aû¨{ÿfä¥TNÎ);•^$"‚…iãò2›ÿ	{ØˆM+ETkçˆWc©*>∫T•œ ÂXˇ÷9≤îÒ	˛ZUTò”ô¢Zã±¢íPá*∂qÌFuAC‘¨Œî‡ì
7Î5‘(±≠∞◊tc Ê˝ö~†ﬁîÆg}VÒπhÀù]	/÷íy>'¥-sÇ5o≠W¬<Jû“áµ}´—™≤€ø›»w∏»cöÇ%€.”8Ö˙“≤ÈÛ2≥Lihw•æ9;"«ıú<ù:.öIZ;x∆L«^à]”éıÄQ¬Ém$óˆπc4Ì{˘Qå$™D~/(’˛xÕ≤¢yÎÊRÜñ‚_Jt{“Ç’’⁄øÀ˝X¯"ÁÅoOà-ò¯hVgí=ï°°|£ê·œ†–ŒπÖÎX„ô?è°$28Ñ©‚…©«;ﬁΩF,IπÕ/}¯'”"PA‘»¯{Ò4ÅI≤P!+êﬁ	µœÏC%ûîXbáUÆj™I ¯∫r(^@º’1(&@æ≥˝÷≠ÈÛ6¥óÏ™É‡πß"ÒF‰∆˜éG®N‹P	ò¥—¢ù»
Ü4Í∞ˆ5•“9ÄD;;ÅgÈ5˜ÚÃòÄ†ZæA∆Ùßì§Ì)Ω<ê@È˝^8pÕ3‹Á’v¯tØÅF}?»k:tBËd5æ‰!¨˘∏è≈˜7¯3z‹Xo‡å=$¨›–BbÎ6®b'FÀÏƒ;_≈[I,…7Üˆx|–‘ŒltPëÅ”≥˝°%*-d?røÚ‘Jr8C«€x√*˝|≤lHú∑pòøvÊ-ücb∞lÜt,sYÎp§∏ëœÜ%e'ç€…øﬁÍê,ôï«© ≠ziM›àú√}F˛K
K∞f»—Ú…œåßjs¥À;Ñ∆>òÒ±?¸ÓØ˛ë‹ÏÍœáì	(rxÙ	Û. ∆0Ùéq†DˆNË∂≈˚¢e3≠sY·Æ”ä˘lò÷≤ôèò± “ì(L(ƒ¶I¬bRåc¢2ˆ·˛al ˛U
A>!?í÷◊©Ôn◊~${d3v≈»Ó|á≥Ã·7hﬁ2›‹SKO´HVQCf\Çµ∞Leã°Es M∂¿Ü‰xì©&g¿ãw¨`*πÅ-a)lî¨Z™˛”Öl%n®[¡´÷¬ã[IB@tÅËòÜ4Ì©˜ötO=˚ﬁ.å±	≤Õ|!Z=Î˛bï56Çæ¯JéÆ‡',ÚÒë â‰íâ∞ÀıXßuƒ<÷@Ü¨â2Ÿ„ã§W È˝·wˇˆﬂn6¯XŸ¶%≈=ÚK'å`ÈuÃL'¬µ˜õW˛Òà˛4•ÿ„˙[r>(â#^˘Ñˇ·9â¶ı÷˜J,ê@mf rˇ˜Øˇ›ˇ˚_ôåÅ&#8?9%ÁŸ4¬°ª‘
Ù˛óˇ¿f]Õo⁄àÀ,ù–±Â©kQØW^µâ⁄¯“ˇJ§`¸Ï±ÎáÀsô
{Êπ3˝éö§πç’rÿ9j‡NCñH|·á˘ïπY∂≈¢g7ØI∞nû˝ñ¯Í`E;;â /ä/øE=Q∫aâ‚» aÑ˚˛µ>,{Ç⁄åi?Áuµ.∂QM§<O7ñpr—aUeõåí Fi
ÿí¸1ÿ«•?òÜ{≈&A?∫ï;å™ˇäón*¶Û>à≠-«æ≠ù¸£HÎ‘ÓÿIªW…ƒmÔ*EEÇ±•ãr'∑¯y3ÚØ¢ùplLN( ∏,Ì^ºı ﬁzÉ}k+†Î‘åd˛>¡√yˆ˘…3ˆ(+»>]‡ÅÂ≥•óñÆœ¡éò)XA?û⁄ õLÉâÀífyô¯F~=Z.?ÀÜAÒ51ö«;M26≠p®ûQ8î)≥ƒ´*√ƒ´ÄirZa§b-;èy*ç÷a†l»ô®XÏòãäœ>”n5Näóq°…Q/¨ÎÙûvë(l≠„W°Q®ôAòŸMkê,ÖÙ∏ÿ„¢`ãÀ©±®cv.a»¶WËQ∂0FUh¬9oyKé$àÅSG-¥ÏΩÕúÜb÷6væ¶ó.≥Ø˚óóŒ¿ÅÉ#G®ëO,9.·µ3cê<È`›¶xFÚ¯}<j	3»’ñ~Ø€zá'b≤…u@·xzM~~!#÷A=´ài¯˛=∞=ñLïë)èN7_TÔî£p⁄;*”VTıàíÉ$A÷Bî
8õù1bR1Ú
∏=†≥b»•8–[ïCï?iòSPXUÃB´±®~fÊ∏à¢c§y#ò0[ı|4c⁄Øi»*ã±®ﬁlÇ„ß≈ùı8yV@-SÉ"ó¨j3Rîâù<Ø¬ÉõûﬁÕX‹»«8ËÉïS^∞=Ê	¢”ÈË—BÃˆVYäªzÙÂLô(Ì…†©7Ábf`[ÖŒo)ó˝æêéﬂ®•vê0^2ËÁÿnH»$V/1ÙŒBÎL,`ïÎ√9≈≥ìh—~»"&Xe"úÖü¶›wx0OÚ‘≤ádâK·A|”jiÊÙª»4ë≤†ìÉœü8∑£˚ü≤‚ö∑OÏÅÈ˝,<ÿ‡	ê≤Ñ’÷¨ß‰9•«ÖèG„±D‘F›∞sÈß÷`ÑıRåÀ•pÿÖ>p’˜H–º6ÀM·OÂ∞Ìuÿ»S›˙1¸—A“ºƒ\ét€`îëjaﬂ4Äízæœ˝¨	≠6úK“˙*yﬁ	ÖÌ|Õ ‰B–`˙E¯ ü€éA≠üëà#J⁄Y°$"∂d&„c„‘£€‘Ñæ8îŸÈIH˛Vor°nm<Ÿπå)Y|◊≠N#¥ípq8oÏfÕà1¢uùgª≥€u"î ∫nJã€OÉÙ®à'Û°x2Iˆ⁄âbœaÖÏÇI~‰ÿ¡ënÃ√©g∂IÙÅåGÆ	vì—™∆wX•ÍVÓ(ë©1ôΩeµ\Õ §T=◊SAo™—NY›EYñJ®Z’aKî$VÅ5®ô√≠äï.m2.C[:ÜBÉ∏Éí≥he)/Ã#≈Ñ,rNÛ%zΩ◊…;û3ûéü<Ôƒ:Q∏GzïÍTô°
(˜ññT(ú5©»Z2b`i4%GÚp	TÖÇ„gESuôeÜ˛/§?4ò«fñuoÑU÷›"û2®≥Ô?SA7"∂ËSdûñ˚IPy-⁄…"úî·ÿO"î
ÖÇ*ïóôEmvÓ|GQ#ëæ2[H‹â"€nU‘MèÓPF∞CA&ƒu@»¿πì„$VÓFjí∑∆®©jÄÂK(ru≤Îƒî<N™M3}A"Vû∂)πÆwªíΩ∏IIı‘Év”GùùXXà)>c9ë,ÛEMVCˆ¿ûÀoNSÉí’‹≠…ÓÎ›Éç…“Ï∂ÃÖ’‚ÆÃ5Ó˝ÓåÁe	{3eä˙Lˆhåœî⁄°πpÍ:˚sâè4ÿ¥¿@}ªÜÄÔ%ﬂQ¥ìà’Ä≈åjf˜mípú+=√í"=$É“|è¯÷ﬂ•‚ïËõ≥£Ûìg∫∞˜∂bÃèX+≤Ò‚E∆âÂaÖih≥ÇLI fòáz 0YÙ`™Õ4ÚfRBß@æ¯ûZêÕ0z<˛N<„˘6Ê_Qª±ç·X,àª”F]„«A‹:(a’ıÉáu=¸ïh2GçÃs˙ÈPc
LX§jÃ¯¸hAƒﬁLjŸ<4¶9“‰^Û∆âS;<ÌÏàÌé≥◊œO_]]<?{Eﬁúæ8=føΩ<;9z±òÔk;LıåàˆÂKﬂ∂‹≥	ıÙ√´r≤'Ç∞¬Rê»oA\Íuﬂ¿≈e®yÇ¿°√ƒ0¡‹@ ÅŸÅ?AÁ®’∫ÒlTIQH#Yd¨»±\D/ΩG∫Î$D°~Î<ﬁY'’Êé)Ç± 'L5º7º…ZÌö6JØù®˘°ï´Ã!*hÖXŒ·
’ÿCJÓ—õcP^R ôÅµ/ƒd˘Ã1≈Jóâgr^ÎWàs9¬J1ÔtÌoïç/‹o·4å˜Ì: –%@éª0Ã]c4÷∏—Í\=xÌHL†i]@ÃïC!“êskH…3åπé„HŒQ^ÕJ‚yBﬂbÙ.8/iÄPsÆ5ÛßÍÂƒEu˙Ù“u\ã¡T◊´≠U’«jOÖÚVj°0¢W=1[óñöÄ®W⁄-íu±rëN˘R›Ì∞Ÿ3uÂ6Îñ˙ÆH"ø.@y≠ƒ™În¬⁄_h¿7)€$/ÓË∞6N$Û*Uî∏ü;·,a2≠’âxÕ’⁄‚ÊG,ƒ•ûmBÜË)•b3ZKFWâ£Ñíö*_õ◊ÉíWò}[føqÂÜÒzBVU´0sâ'ñ‰ÌÆ©∆6al=˛è¥∏mÙ∫ı˙ﬂã˚OºX±ò L“îse-´°JeéÕÂFÄÕÎÎ
f„6*NÕÁ∂¬ŸaçS<}°LWRç8spƒByùJ£xmWüïz•PnÌA≥Ï†¬Ê÷ç…µ)€übUIß,.æÕäeœË1¶–•ƒÜQ‡øßÌ∑[Ô*K„q'ı÷´≤É‚£È˘Œp\ÆÄ/(œ<3’oQ“»ÊËôÊâgö^j;¶zÉë(V``Ìë3∞05“Ímv…ˇ˘è§˜¯!è◊:îé,õƒ[ú9R˙ÚwÆÜHÅ≤í ˜±p÷Ñ~Êíú+ﬂÛüé(óºÚYÓã,Wﬁ◊ q#Ëæ»rÕÀr…&¸"Ã}ÊÓTòãèˆœEö˚ïc#«úﬂBO À±Ñ€äp(…Å@«$π”Îâ≈0tXŸw^ΩÛSÁ*tVﬂ∑T»!®gs'ênDMÆ´{)6oÛæn!ì
â)953“I! Â·açÛÑ…ª≤Åc(ø{GÕûºOTSC:/£7≥R©ÍUvñ@*vP±¶qzÏ }†dVæ¯·V–Ú®¯Mv≤±ïA+≠ÒwW¢}qgπFYLè§ ÚÄ®!iï”mÍú=˙∑'1-ÕÜß.&⁄–é&ö”·ºÉÕ)Ø—âæG^·é⁄˝bG#Yπ1$/xƒs§Ë÷√
r>ºÎÇú9â†GÉpŸÔÅ5/DÔKmFô_0Ú>ÏùË=…˙cVe˝[.Esd3CYìl£«‘ˆ≤î⁄ÙÉ uB=ñP6ØÁfFÓåDTÜW√«Xî´ëﬂ∞Ö(ìëè ‰tÄ˘22⁄o«¯ï@T)lèoÓ-öÇJ&PW≤Ï#◊e˚^ËªXÇû⁄ãaùÚ’©Xƒ¨‹˘(} ´öù≤#‡0ﬂÊ•$R»∑q@Ì¢ç$DkÓi]Ò9∫≈Ík√OÉ2ª/-§Ú+?xﬂ˜}≠Õ±¯l\§É›X≠ìØv*Æ∫∞‹t™ıl⁄1¨àX>’‘V∏˝2GCQöÁÊN
óDc√æÚIﬂq]Ä…™\bòÉË¢ﬁ/nS:dX˝ﬂΩã
˜ŒØ˘Mˆg*∂µ°`åÁ®˝vkó$q;\∫@∆≥∂5ÖÅN-$Á‹B≤\„IÕÒ°∆,¬ûêlzK¬ªÚr ;E‹)¸‘±ô¥˜ ˘–	ß˝êßYu◊…√5FNl,z“øGª8ÍJ[≠p:^g}qÕHÈèñúbh>0lˆùÏÆ≠√ˇF#Xe⁄@<∏i»ç¨QÅUm◊PQï1ä‰ø9am>nMƒ+ﬁ €Y∞N∆ﬁ;¬◊©N\'j≠∂WÕ∆ÚÇ·•è^±t—÷ƒ
B˙‹ãZ≥ ﬁ,˛4ˆ÷`òõÎds-ŒÀ√˚Enﬁ™Õa¯VYn“ÛYu}o_Ã®¿'o:¶Å3X’√O¬ÀC	/∂gç¥VﬂÁØrPxC“´R#¿òGÅ YÅr…ˆ	
8Cà (æ,hOÜ·∑/-˘Æ¢œM‡Ósm•Õ◊Eyª†ÖUÓ‡u’o8¡ﬂV≥eók.WÅ5…ãNX>ˇù≈Ÿ∆s@/§U-^ñàŸÉœQ [Ø$^öÅl‹å”ÄR‚ÏÜ=zX+ô= qÉ¥√r9+ÃÊ¸Æ›68§=ß|TJÓòWTM£√R†N [ø4 1>~ö,aà’≥ãÎ{8VòÃ°Ô]qŸJj)ßÇ≤øÔ‘:ú±Ì“k:òF±>∆§:¶Pr°Æ∂=¥«`ÆÈ¶ó="$Ö«≈ ‘Ã»\∫‰N:‡û˜ìOC›P	Ω/b«“…7?ê%Ò‹ﬂï9un §ô6Xÿ>€rl˘Ô÷é û\.Q£õ‡>ë4„ç1=«^Å¥ü‡Û•‰&Ö3≤ECÿƒ¿ÙókÂnº⁄∑k®Gã DŸJÏÔ≈O|çj%¬ö|†Vˇ•oSÆûÚ*"ò?N√’BKœ∆∑ãü˚v#?Ñ}7´ î83Ú`?˜√ï }h)cp_é- h˙D|oP",uH°“–Qê´Å#<‰Á¯˘ø˝˛/»œÛ˚ø¯˘?ˇ¸?~˛ﬂ?ˇÕœˇˇW˛’á_ˇÀÔˇıœ«?˛œüˇ˛˜ˇÊÁøÖˇˇÓìp,ú…"@ﬂùíé.⁄Ë_pãgÎWÖ·Éá‚Í@~@PñùëÄ¿¥‘é?·õ>GbèÀ†L'æGœXìÓû˙L¬
‹˜él;)zf˝ùy¥•i‡∫%‘Öù¶ﬂOH#¶A%]±Pã÷Õ≠nèãOñ¸1Ω à;r#®FﬁwòäÜ‡¡◊≈ûÜº3ÁÓ4¨· Ï ∏Û≤Úé|3àX2è≠`F^R–√!yjsì!LQ©‹°Úq[˚¨J'Uk’‹E´£B:XÛ–ç∏˜‚√oG=¸D…-nW´ˆAë?zRÆ/<w«ÃµbâªI
Êâ•‰ﬁ “ßœiÆ˙Ÿxî+G^·Ùl´≈„Ùày1œ/&Yy Gπ K%äB?G÷5ã»nN‘nò0‚zY∫–:	òeÆÑÄ^—®≤·:∫´c6D±È‚hÖ{zç5=—¡µÛäIÀ%Wk‹⁄,¢W˛ó;#Xﬁ]≈ûM#¨aSS+iÌ|£Ù©I≤| K°Ÿ¨Oôf˘ƒÃ'Zîãr˚≥-Ã≥Íî+sﬂrÑÀ˛pgtÀz+d¥Ï˝´È-ãÀ∆bl„˚à´’*‹ö-BçÕê, =ë°ÖU4nß!~´%ËR+å»¬aç›∆ù∂™]‰®ñ\Ω£çV¶ÃØTÆì¯</∑ÁÚj€xx˜ir”Íáæ;ç0®Í2b‚»ü¥77z§Õ¥;v„ø–7ñgÁ	8.}Ûx™Ï¶xŸ˛L’
»/÷eâ¸ıÿ≈‰ÖuÚöZ°ÔiÂƒKT%Mò
ÔÔèß40…W)=.j∞Z…Rº
ÎáŒ˜ò(Œçâ€~åQj¬ı—#2<îâW®h^I—òkÂ√9Usõ÷{jR`ÒZ›AA‰|>XÒ"ØöB(ãÔÿ ç¡XÚµd√ÍÄ§--æÁ◊MxûñU∂XãÉsé!O2]Æk3g8Ñ’Y[3<HmÒ£1!é*„>ã¯åLc¨í∑h@á>0·ÀÄı…W±H9ü≥pÉˇ]ø¡õ‘≥ÅÚ¯ﬁI$ÆYøãX¸–qÏ[I)Ï√!¸„¡Z‹¬øt˝=!?í÷◊‚”Ì⁄èÄ±zk>¸5Mä ©ì—πé«`c"ûé7ªØ;ìèÆ—≠©6˘eo¶Ø≤Ω…L§Å áVŸ§≠Å|XÜœ≥Ì:hdª‘Ì >˛·wıè ª=˚©Ì 7<h˛~nJ>∏&˜§⁄‚ó-ôæ ∂$ü≥*[1”"wH7HÌÊé&8»1xñˇRª¡ì¿∫åVŸ?µ„‡.é/˛’¨Q„ØqÀ‹{ê∞:cnr©«L"È≥°;‹	>Aãa∂Ù`b5⁄éA¡u,ßZ‡ı5tcµ(£´ôﬂÃAœî‘îµ:Ÿ‚pÊeTA≥öiì…Íò[0 G‹ÁÊÕ5¬∂µ˘µ;å+ÑoÍÒÎFM"Û	Ó0ÚÔ=!úzvsd ˚'C⁄≤\´ÿxp±˘Å|Ö•pæØfÓQµñ≤õT1jŒ=|√¶ø∏fPà«0æNœ<€üzNπôÜMV≠÷RöeÌÊRBq≠	F]o ‰N7j≈ ™®¬.sÙf¢Û“i	Àï«_SòÇ8_öPSj‘5æ÷ç◊Ò+¶¬h/X®œ<iÚÊRTôKà†&&ÇäÜÄÃ{7Â¶L"÷YºzYåªÆõ≤h „kûÏv’ﬁD?ﬁÊˆ‚*GÀÁ,
#z®é©óîa`0¡Æ|ÑÇŒ+?ô˝ßL?ˇ◊4ñ\ €D.#∆6d&*BPÜêçÿ‚≤Ú'˛îå¨‘[çd<:⁄Rs32âà<øÑ? treÖ<ûÒ<âMÜ\9˙π~`i%&FÖÎºqbe[&√ˇÄxõ+¬yÿëf‡ê≈kè¨¿BÚi!,ç&9å»ÃüQSû‘øp?x [ p,„√ôCÿY—5óÈoh“uız∞˙“GÕ–zﬁw•zºåCÏÒ™fœz÷∫SÛ`Wˆ∑„1y|âë˜§4C6™~È‡jÚ±|dΩπ£vNÑ=¸∏ZJç–≤?õC¯ƒ@=Ç1Á±˜Ûv§G]£Ssü£ÁmΩ	§øËb‡ªÆ5	©Åôäw0¢ñm``åÇåˆö	∏ "Êıí ÓY∏ı$Ü0*òâ‚7Ã¬á7  Rm1k˜ a*¬g#5’0™M∂w8C«≥‹8È5Ωl≤˝◊‚$^RÛ"˙aÉ\º~’Ï∞1˛™πÖÏÀL 4Ä÷—È…⁄í˙¿àÌùoñ⁄Öö·Ça·ÀËJñz‡*˚≤Z?b¡≤ÜÕ√›ÅÆc√ÄÛÌG}ﬂû©ÉÜ£ XU{Fƒ/â¶&z&"zëŒ…˝≈ﬁsÜ∂¶äc∆Ê$ÕÖiÑtÀ9¶/œNy¶—£ÃTﬁ{á?1{n3#s1¸Á≈–‘"∆Ÿ≈“Ë‘ãúhv÷ˇ3¡≈Àw(˚ÓπΩNR_\Ã&’˙ã|ÏÏ’£¯e`6] ∂L√ ¡ƒ≥"`›–.áâÉïÓñﬂÑíá¯æÖÉ€ õùÓ‚¢=√rﬂ≠ﬁZ•·|∞¢d8·HgDÒ}ŸAµÒı2c2î1˙öºP‰‡a|à˚†Ïƒ\QùçáÒ¢U°∞"ªòU≈π≈9(æ3.¿Ì6ûèn»:≈q≤.òƒ†ÿr
“>2Ñπ˙H µ‘ Ã;[®TD(ª$!$ÜN®’‡cÿ»ÎÄnmDÚsÍIM‚Ü†LÌÜ&…KŒ®m‰"KΩKÛ≥–Ë˛ôÏQóÏ≥{3À(¡ƒíX´Gº~!◊Ã ÇÊ˘V¿ClµΩZ}G∞´±+‰U2Jq’Æ=≈Üiú]1{±î±Ù	Z¯¶kïR«¥ƒNO´Xcu*S›oû"I[ÿµ”˚oëìh·,ëa±ˆµôñäÁóBÚ√›‰)?›˘##Ñ»€3Ûp^µ/ù®°M8o!Ó«˛)eìåêçv!3T IA£ëJhÍU¿ãﬁ¸#2FºöZ‹ö√©[4p°Èz· ÊÑxm°º“Æ;Sï6},Käé⁄∑¿ÈXú‰d ,2µÚ6ıñëÕ©Ïäï+fï¡ŒQñåM3¯ÖéaÊ˛Hû¸E.o©“Ê„ŒNÏ›`5#Ÿª∫x˝j/ˇb˜„å˚\dƒ:¸Aß&i7D∞çmvD3Û42∆¯p€…•â‰Ä˛è€f∂Öh¨∆öUÆ@⁄∏Tü8@rvπ≥l⁄.«§ú»∫˛» ÖSÙq&7Å
j|r?|®†¬)∫”…-@µiûr˝œ~rÖ}{ô∆x`©ı‰
fÕ∏·™µﬁ0nbeΩ÷(ƒ¡†V0‚IrΩ"›õ9\ÙbØ√
Ÿkz4"≈NG*≤ÒàRñä2+ƒ∆ß÷…ë%Œ‡lΩÂ‚®†∫cZâqÎ‚>é\b◊3AÔ»^kI b
—R-ËÏ≥q‡,çÛhGo“≠W£˙ÉzeÇRmQf‡¬∫N¢∞'èu∞∞.¢÷IﬂÚﬁÀ¢R¿ah≈ÃVwòÉÄìãñGV]tY}ü…ã++qYÜ6K)d¢&Îı÷ÄYyNUÈÜΩ¿’Àô§ZYqO@ñä“îç÷Ozı±©ªh*Dxzx◊~ésvÔöçä•Ùú¿a}÷“HPpB“H»≠%≠rèQw#∆˙rä¯“sË9∆æSr~·|†DÃŸΩ£Í”-•h„rﬂ•Ω‹gÇ6°,ªxæÃ)¨kıÑôyW∂mq|∆ñ]ïÚmÊ]eπ8Õé∫v+	∫eW'Ï£ªfIHK˜è·H>ï”ı∆˜N®K#öPxCn•Ü∏^Nór+é§m»ç˛	iSxIçäMK≥Øf|}˚ÅézÛ©ùvÎ¨ë›Ò)π ı3E‰eíN™ß«Kt2Y"`Ω«&ÍÍ	¥ß‡A÷ÁY"p¡2|ƒ"}˚G.¢ã¿±ºaSÖ˙xíÓâ?≈Ù∏S/
f‰hä‹Ú9ë´Lé]jy4–´∞®ÊﬁÍÌM#Ë
ã5Û¬ú/Çlâ¥ªê◊t@ù,–Â—èP„qln∞∫<i“c±m!¬ƒƒ.5ﬁæÔ„rÜ‡¿ÒTAà°4	Â6∆¬∑ÛkÒÕı∞/D>â«Ù¸§aìﬁGÑ0È!ÑI/äöãl42—‚—¡˚c'd∑÷.åi˜1Q6≥#!LæZÜ… ·ü ≤∆úçÊÑÃdÑÚñ¥Df“iLŸY€e»6ÔpâÔ–i
p£q¨ ù£E^7$«V`áïJÄ‰ ì¿Èó|‹“™ÛW÷v¶ﬁ–vCıÜ‚ÓñRwHU®S∞CRªÙ_<Æ
5àV≥åÿ†ﬁÎT_.^T–,∑NUö≈6]ÿL‚˚ﬁ%ÃŸ“ñ()‡eà•ÑWÓdÂ…€≠!Í⁄√¢UrXp¨’5qˆÍ+GwHsÀ%mÓ‹1iîWÓ|âÚg
œ_u$∆πeR«òø–oDˆ¸=†]îœ≤£M˜8…MC:‚ÔU–ÒŸpX~8k"õ^r4©ıÚR¿=1®è >è—z§M+ì\ùÆcläUì›î¢í≤ä–∑±ïá÷ëØ±±≥C“I·∏ºF=¸≠2uv‘M5¬ÍuX|Ñ>ÊSíßﬁŸπ—¬í†Ì–õÎ‘0Q†H§Áñ6Yá∫¡ÿA¶@±U%u≈Ù‹ìE·È›º—Dàóiab–"hºRÏwü.GJ=SP0‘UÖ‰Á‚pIÂá·qÜ¸≈\ïq(Ã`∫Úœy¶òÖÍbÜ≤æ,	ÒˆqyÿiöHRguX7´3èƒBck môÙó˝[n7"ˇ≤‹éﬁ``™,e3[n_'‘û≤hÂv√ı9û>∫‰…´p•ﬂG
ª´‚UÆ/cøÜÚdu&cÄêU'Â^àx(p±—aXRj¨…†¬Q±ƒ«&{dR!√)C¬'9+L˙%rñÚ‹s{Ì	«ÃÇáEÌ6˘®RΩÌ√¢GWø˜ﬁ{˛ï∑Z/ä"Ø„Å=ôÉÊ§p¿‘Qµkéß2,Tˆäa¢-ê®ùÊ@¢Ú#ôáÎ“±S 	£BìW``<’É”ÕFUöZ\ò—˙∞±åVºƒäeÒkÊÊ§√Ú9p8¥g{Tòö∏õ9/HNÑµO∏Õù-~v ;]˘%è¯√»T+gõBî‡˚Cä±/õ»∂vw„N4◊>ñâOCkå<É6Ë(xÅÌU‹œçÁ«e/%_NAûQ2EwI[¨ø‘ÃìÀ^N6Ï‹rrIjYÂ√˙Y_„"á˘ª’I@&OlaÒÎB<¨ì,ñΩÍ&èeØÂ≠õ·˛x5√€Z:RïàÊÊ@;◊dZiók∞6Ü*Ö‘u.^Så∑ﬁqÀk)°ÊŸ+ÖÍ[Eào&ªdX”∑Ç∂TIO2”ÃxÛKõÉ$YFòìD¶åSî”¸oœ^È _"ŒﬂT¥{F≈Í•‡3ŸdYπIî©ñƒtûª‚dYJL∞ºöe`xù–»r\Ω¬Y∫W3Ò∫ŸÎÜßõ4áFß^K„Âx-óü„ï™«ôb‚|C1ÙŸ´tÀ…Ñ∑t\úp¬>}2€ØÊ∑^∏>ÕÒRˆ]√'©|Ÿ»◊ùgxan HCóN0n˝xP,/F¨~ËªSÂN≈wWñ±⁄f4[HGõ-‡∆d©yÙZD`ˇ‚Î´ô¥~>˘q≠…Dƒ¢KíÁÇÀ•Z]ÇîÑW€V!˙”âQi0ù›/Lõ‘?=∂] 6›TˆÜÍnDy’`50ƒÙ“©
\ú^ï»hÕn_”xˇÇÿkÁÉ›¶Cs0n˝O˝ëOû˙˛˚ê0 O!Å^†ï™Ô_ÁÇ⁄o&9çôâ/eß4∑3Î‘‰Ä‰[Àì#o¬¶ó÷‘çûZﬁ{,è§"±§*$ıq˝éûò…°Ëˆ∑›w¯[ÒŸkÒ{ÒÄÿ#+Á¿≠)ú€ﬂQÕ¬¯1D=oH^º8.1Tcü¢Å£˛îúå¨æÉc8	_•‰QŸ=‡˘ÕÕﬁˆ„≠ÕùG†Æw7Kr†CÏÎtÛq∑ª˜È<^9ó—±o≥Qû?=:=:*πé™ÄzÉÎ„$T›ñ-≥Fæp¬HzÍŸH6…'ô¯tXVˆâ˙h·{‰-–ôΩGV7W◊â«f^x†¬A‡L§jµhê:y,uÏ ﬁá–ÑÚ4 Ì‘∆⁄∂X˜äﬂFË5L±ÜËpÆSxÓß©≈ñ˜»Ê:	¨HéCÒ≠Ê\ ˇÅ‹æÀO„\Á;3 ór’2å°à„Ö4jw£À∆.|q≈¸	*¶¶&˝∂˝ˆ1\Ô◊ó∆ÿ=ôÍxSBÒ_{∞<é˘0v• 6™MŒõ∫n	úü:_˚)JMÉÓw˚⁄%#òáÓá—ª“å‘¢p‰t¥Ø29!˙S≥≥U8∏π»üœ≈â£ù0Ú'Á∞Ç÷ê5‹ös:Õ?êÄ∏}∑oCç`dãrõ
ΩŸ¿ÊÅƒ˝=É;%IEÙ∑Ùtk&#jF⁄œK{»˘ä%,Q	û'∞5≈⁄Säµr®πÚ¥=ıÜN°7Út“Ú∏yÏ:˘ô#~Ø,ûcı’ÈØ»˜ØûˇÒ˜ß‰˘´ŒûüÆﬁ.Nf£”œöúÔ≤2	y7∂sî ‚˙à9Bx√º¿R˛Õ®–tLniªa¶–tAH~\dZqµßÀL~!~D€›ÿÏVRD§Í9ÄÉ¶O‚ø√‹Î-ªëÆXóHåè•¢+es¿eZÑ<¥[ËØŸP“ΩR‹¯¢˝∫ ô@øh∏ˆÈÎHè-¶Ã0N≥;kàïì=õÖW{ √yœ3‡ËÒ1œ≤‹S~µI{3w∫"u¯ÖëD¯óå–ƒw?˚kÖD˚bqÂÌÊ£Ì1&c«kè∞rˆÀ?ºÌÌv«âÃ<@Õ¶B	é~≥¸eƒ¥Tì=ﬁ
˜‚¸√‡ﬁñ:N{àˇ¬∑~A{Ù—e˜7õìÎuF±îâ?ØΩ#oQ˙≤Å˝[∫∑π;π˛˛–≠–¢GíFñ .M0’Ud‹Z9ﬁjoÍöIõ2à˛¿1˛aÒ ÔàÂK%íD≤«#û‘iöeÉ√óõ‡ó\ä{Cy ^ù∑òü±ﬁcqa©Îd‹á°ût¶âö∏©1_ßMDéÑÕ˝¥F/QÙ"¶˘ê©Q°\§„˙Cør	π}gq08`ç±∂nâÂF‚3ÍØÈÿËˆÊ6ÒY…eòk∆»‘c†Œ#Êà0{ÙíÇú˚p∫ÕV<ø-ø™î-WΩ§Uv9Rê!ÒPDï_-TI≥B<<#8ﬂXç0¨ë‚–‚$ Ï’†ôÇ∞z|∂∫÷	ß˝ê«áÇ÷ﬂ´l2≠dxÆ–[cY£s`îb®•ï*‚Òq7ÈÈ]ï&8’f√Úíôn“d¶e∂PﬂÃ)@ÒìÄ∂Ÿ± ”\Òº¶v≠jïÏΩ-€häÑÌKG†‰ë”±0¥Æ€˝~P+Ωï˜C«¿KÅÖ˝xäøÏëØ9Ûa_ﬂ˛õ{U¸AX$√1·—±hScòå†E√9˛èÅ}Õ«Pªß7"‰+së÷G‰˘…⁄û@xŸ-|¡øZ∫ΩÛxÎQ~Èv∑*ñ>∏œâ∏x¿æfpfÌÿæ˝éX€ä¨⁄gl≠à◊˝4™"kk´ "÷ò≥`ï÷*eπàq Œˇ“∆ñ©0L{ı¸ıŸ≥≥◊/èb;	Î≈—ØªIÖUıÓ¬ø•ˇ®(%9ë/@¿„êZFÇÈÿé0pê%∂Ì©ÉuY@⁄&bôUƒ„ëñ“Ωlëıë*©rù-ŒØ*≤É∏?ˆˆî∑kJf≠QR±™Õ”ı·nò¥Õï√¯´‰Ôèv4DáüvÁ_Â0êãÃì≤˙É/aû¬Õ§Ñù
”ï4§Ç*85Úä_WN¶}ÀY'çÀqg\:x@ÿü§Ä–H/¸¸«^Ä˜"DÄ:Ωº¶g¬‹ÕŸ£_Ùû:¸„§‚ÏﬂzÙxª∑U˘Ï7>˜Î‡íﬂ‘Á†l,YìS±]H’A≥^0i•N'Ù6éÎ¡<ö®ôí<Ø‡—´üñõÕ1¬Ù"Ù9uvJp≤∂ì¬ÓpØ´ˆ€ÌÓ7ÔR÷Ãç›n‚0zÂÔ5¨d<b‘alª06ôjù˜UÅ†’∆›πZ3ı≤^’'∏Í•´˝ö^ﬁ’äÁ≥Î3çc·‡_ñ∑°ÂEhûèº∏ &|YO¥H¸ÀèºñÒÏÀ.mhUœyhŸG^T ¢◊R∂ö<ZYµV} _ø±≈'/Œœ>˛	,Ç_L¸W˛}ÿ›1Ä@·ÜÍ¢@›Hˇa:g‹Z#_!ÂÆ6êZuW§≈˚ZyΩ¡)B∑IS"Ä÷ÄÀ),^≤&PSÍWç…1Ì"™_°…2ö<ıÏ{Dëbπ>iz¸¬ìÈ˝–S¶îmji¸¢∑4s
E”pπ+€◊[8ñÍ›(qØr6—”–Vwäów°q*[ôá·L±/˝¿ÚÜºÑ]˝Å4Ü+•JÒ  Œíä˙‘’¨‘«büBr•ë´¯∫“x⁄óã9dÃõ[«\¡ë¡|√W"ë£ñ%Éq^≠Q÷pôK„}ô›ºª)uê4ãpû+mRpû•Œñ$ÃRWu’8ÂÖ3«À≤hn"‹É·lÎºÚõG°ñÆ≤d[\¯Äú$πâÀÎRA¨ÉWÏmØ˛q¥pÚ‚Ó∂vW_£¸’::=YªÀ^9ry›ÍsÒˇ  ˇˇÏ}›s„Híﬂ˚˝5⁄Ÿ!µ#R$ı—[“¨ZRœËÆ[í%ıÃÆ€” 	âÿ	. ∂§ëaø¯·^˜Êpƒ:>€oéãp8Œˇ…‹Î˝ﬁ?¡ïYU@U·´ RΩ”àË	ıôïïôï˘Àî7‰[—Œ‚±Ö˜2®o◊A8∑%‚Æª<\…\1Èù‚∏—Æq îÆ¡£Á 
&ÂÃêóTÔñ6î|M⁄sBáÕlœƒolÃ[˜ 4D_ ⁄Q:5ë]¯Ãˆ?≤ÛDΩ-ÿÁàŸô«Ÿ\”\tV◊Z¬c	S•Dæ9cpÍsY€≥‚ƒ˚íœq®DâœØ;˜Lè”‚À¢˝îçÅà]á∏wä5jïÀLËsï<	ø“€K‰§ g4ΩƒyÛ∆˚Œ•]“–íGÈU“éö_¢[Ë˝ö—lıåSJeA"‡gUEâ$¸^Ù∂-Ôé ŒÌéÀík¶Åªîmû–8]* /w¢‘¡ù8>95bêˆ§b>≥rŸQUµdˆg”·2‚∑æã›YvÅÙΩ6’.ô@®œC£/¡6*:ÌVãIz2”æ†ıµf´ıÎ«õ¿èV∏˚	Œ·≠ñŸ∂¢∂F¿>ÒÔÄÍS˘‘´"¡DX}≥”∂8 ùµ|já‡'A;WoÃF?QÈ©4ƒà¶ëûR„·	˚`¡àåŒ¨Ãˆà7_+È‰ñxlûT7ì˝ﬂÄd„˘ÆnÓ◊F!v‡iƒ&˛87f7≈Ë_©ÍYl˙lUÌFm&u} ±†ç}]ªõ”:cl∏^œÆiQ7¯øÀn~MîÕW£∑øÙ≈Xû«ë‹Àâ‘’hÿ £!‚Áç#P‡´f¡a≥/Õ€Û›ı„®f%Ñ™T^°OB x ÍÃπ[·‘∑ÚyÈyHL3kSB=)´Aï |–—8ÅáI,ÜIX∫Ó¥˙òa-0‚¿–U¢€∑Ê"yç Î,«©äÚIP»Í
gOpËòDõŸØò=ZI∑7øP˙?ˇÈÔˇ3˘ﬁˆù ÂIÌ»ùæ›çƒW≈‹∑∞KUYxê—bmÚﬂßRÜEg∂o˚!˚vÂÑCgLV»¿∫	 B|ÏÖÑíÎƒCHçÚk8¥„rÉ°7•Ω`L8ú≤ÂB°
k2ÒΩèˆ†π†@¯™ë≥ﬁj)±üÁßØœ‡@ÍlÔ’ÒŸõ”É≥YÿÍ	ù:Çú“5/Fç"ÑN‘ç7ıÈ@èú0¥∆}ªI\ª˙ﬁÿÈ”Aù‹Ô"zÕ	à ù"ˆìwA…¿AkÆ?Ò–ähM√°Á;?!q4KˇïÃÖÇAµõèjCâ¯Ãú÷ÙUc•ìqÙ
»îC8Sò'QÂD«aæô~1åÚ(Ì–}ıÕ˘w«ßáˇönØgáﬂÌûS⁄õˇé˛v#ÖÕÚè4PíóŒpÅ~O.mD8Âs¿„∫†˝£/ºkRﬂΩÄ]˜‹ˆGr&⁄…¬Ãã3J>˙ó±}≤Äå‰‡Î¿v/xîæÿÒûPD<•MW>úï≈Ã,˘•ùr~uñï2Xú©ï‰‰áçŒJ£Ì_ä£{Wæ5°cièm‰›˛Õ=⁄YÙ,X2t…≠>ﬁî†¡Cq√W?çyÉ5Ä ËO`÷˚Á)SâÏëíY∞—√œêíJ;mÖ°‘˜§&,í¬&Z„Ú3Ÿê±©™Eò\¿?pÇ[39(g¥î~f3íWäˆ,aÁ≈Ó—=M~Ï-"Â&WPﬁÙ-ê-pÜT®“<)"–W≠¨⁄N™Cº`}Â$o /®Í≥LˆDvÜáY hŸRÊ) $qG[£¸"G<∆,>-˚ñ)@˙ÃIcr~Œ¯IÀt∑XOÀsn]ì=ﬂÜÏìG†°#ﬁ≤q“ˆ&ºhú7¶Ωíù=F-6+IËÖﬂSı[ÿ„íuÉl+%'/√∫feH/[igRﬂ§‘¬Mº§+~´Û&-ìv≥µ∂ﬂóê¢£ﬁYÃl¿G+L4 >C.nCÙlJ3º{Fës∫HÂGô]Ù{R~óT™¸&ÒFÍci9^ﬁsÇ¥.-ö&†.~ıÂ≠T¶Ge™öªá2ÜÃ›{-ÀãÙÇo[w|	^.Ï'0ÙŸ$>˙IO˜¬2JÚ¬…Rª$zıãÃÌ¢ÆÿœÈ]rÔ/9Ωœ∑hÊ©}O	^"Gë‹/"$H˙ŸI^å•Ü7ªê^YWêl‚:ê]T€^eäIc‹3Y<àsÕHå5˛(yÌ5ˆOw_û∆Ô˝Ú—PZàŸ$d§…Ö&/M¥J‘‘®˜íóÜsÖœyiíóF,üãJ)l…=2µ0j»ä¥LDÍ§â"2ﬁ$¬ª≥©Ëû	Âƒ«rSËDWãÅlÈ'H/UD∞¥ÎæS›˜l~¢ôçtı˚s^£Ãkd∏ˇã¥AßÄ…\!uP≈¥Aâ‘‰“ïœèƒùzWÛãsQı	FgŸJƒ§ÈÜ á≈TÀs≤5l'‘ä7≈H4 NpR…™eEëÖj5ıÃ¬…·Ò—¡¡)˘ˆ‡Ë‡t˜Ÿ;>:?››;?<˙SW L–Æ0`I u∫Økx6¬ñzÂP‰d‚î8Îr:Fz•1®í»#u‚CëÃ£≤‚œOèÙÙ&Ib·@Á tæ∫∂˛lcÅŒb\™òÂÁö[$’@@wè≤∆_¯Uõ¶›ﬂëΩ”É˝√srt|~Pa‹+zñ§v_∏”<ûÿœ]DNøbè˛áüˇ˜œˇ˜ÁˇÒÛ?íüˇ˝Ûﬂˇ˘?êüˇœœˇ¯œ˚Ûˇ¸Áø}∏–=[Cs"˜;Èƒr&|Ñ≠…éŸëï{vd…ÓW‚èŒ∏7^Ó‰ôP‡dç=UâCïo*ágÀn!K{ÿVSv–åÌˇzìﬁ˙"Í@ä∂˙UÒ°¡Ï›∫UŒ>:Å=P™ò"≤‹†ù≤˙aÿÜLDi£V‘°9åYïàï'u¯˙\:T±¡TGßêz—o—YËDä#™ıË)éV	wªF˜ï<«À»ﬁΩŒr<U‰Ñ≈lC˚}>~vaCÛWØD{|è><;{s∞OŒèI}ÔÕŸ˘ÒÎÉ”≈Ó√ÌYìí∂˚JN±p)[ZÖ^°√/∞ÙJè(J+ZDuﬂ™dówcM"%˘“¬”—(ÓWì`,
}ê∏
°%SZ8Zﬁ}¬ZƒßœèNvœéè»À„ST!v˜ˇö≤£◊GÁè≈ç4zìík˚¥MfMM∞:ü∞€TWéÖ=Œp 2ä>`mñÇÜ vãŒ#»ØÚr»Ub±Óõñ+#i¢áŒÏIuóàÇT‘ë*≤‰®‰&˛™§ó1À, T*}mKãﬁ Ã[≥D´áÏ∏èŒ"P™·ÃjhTâÑOIñE$Ã˝V,ÚÀœåQYT7:ù[◊Hú R˘ 2¿ö_œ
JiÿªyÄ`V√´~Y¯rñÏ¿&`óIèV”ã˘WÇ<©∏´*–wIØÃr•ˇQ/ZÅ˝õπ¯–A°›ézÒ¨q÷b?ZºX^˛oH´ŸZõµ‘KÄR ˝ö◊TΩ‰\ßN”+Ò¥˙¬èÀd1 ÕÓŸãÓƒ4n√Ω"ò¶ÄrÈ‡•s(’QEø˙*_ïHå∫˙æh€Ï˜˜=ã
8ÆÁ|‡ﬁi(#»ÅXÿbÿ°Mó3ûEê2åI}b=…:_„}Ã¯”≈@≠∂i‹U≤nWÄM-ô:˛Èc#üf¿ï£,∏“˚%Ω' K°ÄËv|hÃ2…X1»•“¬]Áèß mÖØ=‚åO√…4ƒ¿ 1õ®Ò›ÎîF˚JbJY¥Ÿ/dJu‰:~Jñf±Ï’©û`£∞rhø[˜=X$%‚ ˝¸æpÏRDßOû¿Ã ÒÍñeªŸÛe·…ë4∫Í«∂%!Á™lû…s¨4∏1∫ı„¡ûàô⁄;~}ÚÍp˜hÔ Ω¶*°ùù ·NMoqÃ∞…‘¿$BBèº¥òbﬂÓ˚∂›Äà≠#ØIÍãpn–iµü0[òª ∞\˙"ã%cÍtÑÁ0fŸõÓç®~¯pÂP»›ãÆ4ñπËc^S¨ûò‚ºàµÁ f∂∞# ¬æ""á“÷ƒÚ1†∏J™1µ9>˙tp´"/-◊Ö heµøˆ`ö‘±
\x#ééaO•˙cm)ÅW¯`jú‡xbè∑oCjßo•C)JÁUJ+ÚÇtËæ:ñªoÖ÷vj≤^c|g˚v@ﬂ„€wÈO≤#~˙‡G∫´x~ê˚,˙;PlÙ1Ôy9"m˚V˛ñ˜ñ7>≥>“1≥Çõqü‘˙e∞w‘%q«,ÒŒ©≥B‰WÚ-˜÷ïEÈGKTû£˝gÔˇπ≥ù^‡]≤4-vI"i˝–‚Óûˇ’_Ÿ◊œπ˝[ƒõûÿax≥g√ì˝ódõ T1?‹∞Gìo£4†‚Â>}vl_ë?£ûÁΩXV°ı˘t‰j1∫˘îR,˝e4íÓ] ö‹µVkxÛnëC&,/√ﬁJ~†Lî>‚†˚“ìB˘ÆM…eõ\⁄!áe§ÌŸ≈ªu>ä0ﬂÏπÊï(Gûo⁄pÒ9Yóv‚¡%R;9˙∂∂DV®0˚lmâ¥W≈í\{π{v^„ı›EMﬂÛ\œ''ThyT7kıƒwhŸ7ÏÁmÚ∂MKÎ¨,ë’ŒªÁﬁôÿ¡§wõ˛»o=k/ëhLkM~m]y-⁄#;zeÂŸŸ‹Ñ ¯+/8VîÙÜR¡ãKxº≥∫Aü]k¡J”÷ZQy(yÂ`¬∫
√J«Ú•„∫X=n €÷ª%©eo€Í◊Œ;>íPÑo˜√:m4¢Mˇ€Ä—ÆIÙÒ¬ò √ÒÖßTKÖÇ˙¬w∂˚—ùæµ∞D–eU*ô?uÊ¸d◊€ÍÁtÔf≠ñÁ
€≠‹hÎ7î∂ÉPèbrˆ_üëì„”Û›W¥58Âk¢ŸçÊ@èÕﬁÃjµJ-ÿnÌV;y+•Ì«>˜`4qΩ€&»/0≤Ô=*0€à‡ˇΩ7Ìmüwm•≠ıû•UC˘ÚX8ì◊–Áã ŒÇE¨IìºÔıßXÕπ∫ˆ,Ωö5d’»ìOÒ¡˘˘Ô…ﬁÓŸw‰˚„7{ﬂú¬8t>â9~œg‹íª‰W'{ﬂ7ædHŸŒ†L{õXz0Yo@¶¶”oÛôÍ§œ6O¯Môü3†ÔwXL»ÒG€è^RÊœÈ}π£˚æu≈:⁄È¨À¢∏≥⁄ZîÿPá3.˛8:˝‡¬aùÍçRã ≥$µJãho‚©Ó3õe´iwc*v{ΩüŒÃ8óƒQü€“Á$√PÓ’ﬁh±åç<≥_+¶ü\zo›c;†˙¯ÒÔ»29=ÿ;<9<8:'áG/èO_ÔûS¶G€÷°˝Xõ}	(”…Fﬂ≥÷Wí/å+‰À[[¨D™á¥èV?N—‡€ú⁄Â[/–M¢ˆf¸aLeßàVj∞÷÷x+J˜ì5$"<@“›z÷ö≠[}Z6˘hy7j%Z±ï˚vÄ∂-ÓDüe’>àN6‚Ÿ,ç:≥h√∆jvƒ≥â&‡K:Ët*63V
ˇµ'∫¸ˆœ^º9=; `≤pæ{¯ÍåoøÌvKÍÛ˙dÇ⁄‹E3V›ÁY °©|≠¸ò©´]¥Œn©Ïø‰Ä»Ú»…‘üP›öÚ&P≠8+jw;’¬œ˚ @ötCπÙ¸˙‰F∆ì'÷Mı4[ÏÔiœÒÉ9ÿ˙‡±ıË1uB¿ÁàyWaéÒ†¨Q= ÍÿHåHjæ&¿ıAÄ8∞π˜¶‹]”|ï´ïNjy}>PXœï+-„ïgD 6F#∑“)f)t2âÌ=úl|ôíTQFAD˘f]mj4{«”‰
eÓ$ë•µ˙
¸`,≤¨H"K$ó∞Ò¿ädv ~ﬂåÿÃxÇ›Và⁄äßG¡tƒ,†sìe∞=´+∞ù¿áta&˘–˛ΩqÜŸŸ)*&®vëH7aR:èK}-—Ü»"g/Å<IÒq”SY±QÌìø'ıÔN)´Ÿ›}x¥(v´ÕTiΩΩŸ‚&óÕbA(_Ä‹HÚrû√„xb˚|(©`‚FùHëmonŒ&ÄﬂÎ»Fxtê·•{á'ÁH¬≠Ù—e˜[Çe‹√¯û⁄}€˘«\CõX=Ô£ç\»£ïÿµCõÄWN3nÂ¶D‰¸,ïÓO}◊rFöÿR∂uœ≤ß`^v<Wú(;k,ä|‰
∂oOË*s:qF‡6é›}Fnd¬Ñã&9Î[c:ãæ›òNÇƒhHÂMnp∏Z ˛¿v{K, ¢«]≤¿c bª)v‘˙h◊ﬂGˆ›eÒËGYÛ˘,Ω¯ë2ÓâkıÌ˙Úø	æ^æ§˚«@◊beÁGn¿HˇÊdpÒ>Õ∫’ Dhvö≤MÍ∑®S-âìè%¥€˙ﬁË~
⁄ú±¢`)›B}◊%¨4L?u	;B˘Ë9ÉÁZ°Ù7gMó0C;i¡èœ„⁄∞¥∑ÔûßVä?“±ç≠‡`R˛Z±(|æ¡jˇ\≤¢:¡·òR∫M;ÕíˇEY9Ÿ˝ö¸0mÜxN¥ËÄúÎQ˚ÿÅ»bÛ¬ÍıÎÿ*>‚PÆˆ6Ãk÷ìLO¯∆î@~€¡c◊"·üoüuﬁaÙyÑ;@∆^¡µcÁ≠ëáŸ∏R¡}˘!◊ˆÌ-Ò&V1ó)˘#Ë.˝‘‹\_" √ºñv@¬Qzïó€—Àm|≥ïˆb<ô7/·+®ei¿¡Y°q*º/pâUËª‰1®Ñ¬ïÊdí»ºt›X/¬Â5rèä"ÊÇ!ù∆ç¨àCpU!»¢«RK¬“¥cˆ¬¥ºWXˆPâCE¨ﬁ¸<ª—≤˝Ü¿¨ÿpˆpœì©ÿòG7ˆ”Õ¨cÒ.mpkÿ…q…J	¯/pﬁêm‹ +≤  Z\çkq9 º[À√N©cz¸©µ2B©‰\¸ŒÙ∞FìòíFPîRvñt÷úlõ`OÊÃùÜ-πä‰GˇœƒóÃ∆ìÃr?ÉE†è TÏ˙∂e∂ÙÈ èR†∆úÈÜÅ>ˆÈz˜Fç†Ô{.BÉsh»¢UâÈZß#êN©ƒÏ≥‘ò‰%-ô`Be8ì{·\rˇ®,?∏2Ÿ∂$∑ÀIƒ»4å∫¯ŸßÌêÅÈ˝‘≠JN¡¥ö√2˘¬Ú™pçn∂yöm	r%~H‡´§ìW^NÌÃ¥pL†4Ôƒ¡é±Œ[ïÛ•∆I'rÇÈÈáäSùgwîP‹ÿ–Ü:z@`.‰#»ö§0øï⁄R√cœ√qÜN=@…ôÑò(¸‡zbè—ﬁ(ÃÑ«”,¿67Ò¸“ ‹ÿ∂([
∫¢Ås_ vÄáæ6;„=µ/ùÄÆò¬N≥ß G§;ñJRßˆ9‹[ñ3∏Àı˘,r5KsÅÃ¡ÿ“ $Fœ {$∫∫rÀ1ø6†ãJk◊QΩ◊3ìu±8…rKVY£Î|ç™q_Û]ó_„l‘Óz¨À&59}ﬁÎ3-Íbø«Ã]˜5’®—kÔ[ ˇ2‹Yë¬$y}U∑Äè¸ò˙yÌYIw_Xd˘∞;â¥Ω‡oÆ€íT\eçÂÉf °≈±ùdrxr√(üÇ›œ¯ÂÊ ‹Îæ5qBÀu~2ÁæUé†püqG˛îf´›ß Ü∞xSøo#S•2é3A,∞e≤^¨ñÛi™-+⁄ÎÈ§ïÇ+ÿˆ≠ë”∆/jFªäyiøzÂå?ÿ¬M™2π3•yŸñ?a7˜∑=c›X3œ#Q‚∂VùO|˜>ÊÙo<°≠GE6u¯fà2„∂ûQ`¡Ñ‰L∑®ë›ÿTiwæ÷ÛOzB_YTõx√Ïp˘(ﬁ„,	ƒ2Êòp‰2ã£iÀEΩqTÅJ;≤|”ç†ªRP»†äÚ+p8∆Hö_UCó›À,i~y#ñQ∂ÓL|ªÅ9NxNñ5PÇËˇ6’'È»ìÛq*Éå£Òmà√ÂÌ‡#<»ÉeÃ¥—∑é
⁄œ3◊ôÖÙt´⁄Â2é§iU.…öÿ—œ%”óñ5IêntRÒIåf≠êøG¥•exû£î5\-≈≤≥öGN¥g°uq!Êtky∏jÿ’ZkMœ«-Ë·âC@`t|r†”ÂæÇD ”π◊G&-˚4ç¢ôM√2ŸπÇQü·\z{ÅΩ`ñn+#o°|`^gá¸¥œÜ¯6ÍI%f|„˘çÿπkFÊ∏»?Î|U>ÔIµ”eÎò…DÖ¡®tz2C∫KœF∏Ç'H+9'H˙U*k°Y:3íÀÁ˜‡€`î÷ ’>õg‰^óá3v3â2ΩÃÅ˝asqÉfúÊµé|›ÃÏ	Û¢bìpµâS#ê:ﬁTΩıçÃøJ[
Âì,õ4à"ëK=NòÓ7;…’åA;G‹÷/∂π2˜ß›êj‰Cl—7à©p÷9°d–ì| •Ûî¨ΩÍô1⁄®°ØDÌ8*˙ƒÇY¶≤LfK…N;uòr¨#A}ºùÇÁ∂£-4:∑ÿﬂ∂»d 
}∂£ÃfL,˚ëÔµ‡x∂P
@¶˙AzKöxí¸‡Ñ√z›⁄bπÑ-eˆeqïﬂü≈•Ì”Âëiôo⁄ï3&€?›õﬁƒã∞Í2¯À—"ä¢Ï≥.˙js¿#@õW>ùû˙˚-Á¬⁄¸˛ˆ¬óÈSv∑@!∂ä∑(]·çÅÎt[œ!Ωbó
œ1√"˚‘ÛËhèÿg<dØ ¥∞KY¿Øüì°ç˜ÒÀôÓ
Œ∆ÄäÔl-≥∆ÌºØ0Vwƒv©p[m§,◊ˆ¡ªŸõ4¶¶iRçâúP-éñiè1taÇøÄU)aâ”¯Bïóz#≈”.Ô »eŒ%π˚HŒävµñ√‘SRªÀBtÇ%&/∏d•lµpïÉy˘Ê‘QsFS*π∞Åån≤ôìnU!OûSÜJ∑.˚¿$≤€k®´≥»~Iı∞@o4ˇÚü˛Àˇ˚ßˇHé<·t-\∑„%BÜV@z 1saR…£œPv9…çC;ôIJﬁŒíØ–w+¥¿£}@$¡ ÃÿaôIbY&\fÃÓÅÍ[ö—HX<™ÿ9r›YÀX*Êg•êù2•¡_&ﬂ€æs·ÙYƒ¨ <0≥^ò) pÏ„]b¯€≠µeEùﬁàE\YEP˜¬Ê`ÔÕúµÍÇ∫†ú9KÈ˜$°oΩt\ÇQ2ÖÛ«g)/ôóê ±íÕVñHn%ÖqF∑Td⁄úå/ÕÂqCY\Ø~6	º¨Ù]MÚûIÍûìƒ=É¥m*i[üÆå]Yæ~hŸ⁄\P.!SÁ…^≥ëÑÈhOàˆk]åéXndπΩg	⁄\z¸Ωh'5¥òJŒÖ≈≤ á!ÍC•‘2p r0B«dÑ1s [ˆΩ—Ñ÷—uÌ@d°å›¡˜äeã9(ñ≥l G”1j5´´zLïÖíå¯cldΩb8çƒ”¡KZ’DDN≠¥êòı*#’ba°åiÕ]Ê€æıhÇ}ñ+¬r√Dâ]ô.Ëj°d-rÜl6≤ùM6≤=pØi†î'‚3Û≠“TêôiE-ä*∂_ÃtÃõyí®)π¸ˆZR…çV÷ÚZ‚ﬂ\À•j≠•éhÑ2ë1Ä–„+™ﬂ&U€0÷Z≤5⁄|]4„Èƒ}	L€,æiMa*Ÿ∏ŸŸ| ≥E<b¥7âêæ:áY«BÖ1nfbd≈H8’Ÿë∫u£F¨¶ÍA—±jtê
3¸—ÓbtlcsMﬂ¡„ìPˆ*ˇN◊ˇl¡sÿÁ«çÇ 9ıVFˇR Ñ\£ùc‘agt& Z}w0Ä?'\‚0∞wﬂ$É%2l_â]∑ÈË‹¨@‹zêÍ€¿∂¸˛‹ˆG 3ûE_ﬂ—¶–bGœÆ◊nJÙñK[f ªàøﬂPﬂ‹•”wÉå"¿ç[)n$ä»xô;`*ÔÛ{¶EÏ1_[•~Ø®p=;µ∆ó¨˝˚‚[—k,‰Ò$!x_ﬁSÔÂ>{ˇ`<–ﬁÊw“ﬂ≈ˇñóÙ…•‘·rYO74rÃüD¯ùûwIáî 'Tq8“oˇıL;˚¿Üù§ˇ&7qãë{7¬D#d˚Fï•ã0;2,1Øò5ï>πeX·ıûR/2ª@A3‚}H$™ào+≈6Cfôæw6ñ√ÒdB4æG?l}w˛˙ﬁ=p—'zWz¨∏Æ} äÿm†£sjSÚl≤[¡Ló(OSˇYâ¥ ZÑ›§ÑviáM¯|”|€z´Üà-ÅRôÓmêﬁƒÛø“Jˆ eÜˆû‚Ÿt¿izË";ﬁ6I3Rp¸
Z} H#tBoù™‡BOHFRŸfµp˜—CVY∫Jﬁl6—ù(ıG˝ƒØ+zÈ€¡‘|hN…fØ3∏|Ù—Hºsó‘‡c4Ò,{˚µ.ı5≈† 9Í∑‰∫J	áÜh‰ﬁ§ª2ïˆ¬E}àöà?GáæVãªKê¸Ÿ d˛ÕÈ´:èÄ∫é!{ÿûzj„¯¿UòU0ÙÆÿì¯[ﬂÍ=Ö^Xn`´\ÇmﬁÁV_>ﬂûP£¬Jçr™„ﬁ‡_—¡>ÛXW¸qAµù:æ†÷3\úQ—Äéy¿xi¸]ib<Èp‡Õ—y∂∂#åh·KÑ›Z".,˝Ëù˝Ê T:É0¢o‡h"~>ÏäÏˆ∆‚ó`Ωg;&m£e°àËÙkÑœˇæ6€”Ó8Ä¡ƒ¶P„¡¥Ë≠ÁgÍΩ‘	d∞Cé”ßõ§@π†B8=Hùè9›∫•⁄ÿèX⁄k{‰’uvƒû¢Ôú±—&mdGÊlåKy˛]∆ı¡>Öπ	ñ</bÒÄˇÆ›ó÷É¬CGÁ≠$V-á⁄ı}Î¶y·{#Ëj∞»˘˘›J)÷ªúöéù?“5»)4 î`¶ìâÎÿæºr¢üãFãù”h±#j€#£í|	ã†:3bL—çÍãi‹⁄éS!?˜<É3¶Lã4P‘bì™$aΩNe˘ˆŒjbä{Vóo◊{¢Ùƒ<Ò¡JàfG–Ä§‚>0H®hÉéAU≠zﬂW'ÒËO"0ß¡båJåÅ	~KŸ9U¥¿ÿ±¿†ß3›ç\y˛<l≈·îzs¡ﬂ >ûCFT£!|˜‹&o)m„¿H`ÓS _à©º`e$dld=Dõ˘®2ˆ°…ä´3	dá®¯0:r·Ú:UöjL^Àw—≤≤mRaMYLÈ¢“6(>≥mú®Úö'ô≠ÖQ<6Sk"Ø"≥ï\ÉpPŒêÚ,ûÆ⁄‡,qFÓ√jfm1SQ∆Å∑\„3ô√¬Tt˘A¥Å™{á„9ÿß6ê1ë˜^yWTˇyôAKt5ÚóNºZG”˜›)}™é≠Y§eî§‡ÇT/Fü®ì@a)JôÛâ∞ aã|ˆT|<ÖVÂ´8<;…*ö]aΩv^[L(qëyÇ·˛aiïòÑeà…}aßôiıù =¬a¢R÷=¸≠®{Æ”∑!˜√3b|CØ∆hT©Ú·ì®{—®+T|sª2P˙†.° ~æÜóÎÉÊ•¯∏H§≠=)íÛÿ_«C3»ëôáAÆÀl(pVo(Ô»	¯)1ß¥◊/©¬¯{˙Œ∞ËÃÏ‡’ôµùŒá'5õ\öphºRv∂â^\ñ©Vœx3Uæ%*ÖeäØ1‚˚+ZHóànÍU≠∂	3l¬®õó%si¬™¥Y÷VˆÜæ7ˆ\Ô“°Ç≥{C@¢¶Bß=Aô7PUß¥ÁVø?Ö¸> ﬂ^“æº9è¡Ë◊≥\Äñó5VP—){Ë&G6ÖÌÃV–∑«,¯˚Eæ"á˚–öëı¡µQ’ŒÌO]Ê≥`tç√Ûﬁ09WñèﬂÈ™C*◊°sUÇa±≈°ix3≈R#ø"S+R§_Ùıâø[êóGØ≈h
´"ŒãÒ†’$¥6Õë5…≈x¢5S˙Q|ut•t´_Ú6maâ¶}ΩW°-ô,Òj#˚’¥ÒKîiaÙ¬Ïä’:íÜXº
1IÎÈ{'ò‚B8Tt∞núN¢rÊÉ’uåxŸH™ÚZ·hn¬8A˚ìπ∏ﬁQYÏ£Ì«í&46˚i=ïÄ‹®ohí o}8V)O‹?ûÜÍÚ†Eä«†JﬁÍ
D)˙ïÛjûCÎ$6c)qèV†ﬁÏ	
Âoà«‚∫äIÛ[p•ûjç-˜&t˙ö∏aó“§Bë÷ÕN`P$7£@¡Aó£åpì Ø´ãûX€∂\˙üã.H7`<≈Wr∑G“ÚÀ§‚RBÀk„€h#óFâá†º—Õ•®#≠•∏ô5ø•ü"®\*QGﬂÇjßâ´˜µR⁄QyQ§óUfôog«Ë°ƒŒ5Ç:´8≈òΩU/‚Vxô$iß™_6£Öv)˙íê¶≥wõî”®∂öbÓ≠òêg_∂º iÂ ”d!Gß]ŸHù\“•7ﬁ¥£F£§ù.ô)HÖÊ±˘1d—8Iøƒl õOH£√Õ¯tÇLòÜ‹Ç«ejKfeâ“LYá“˛¯»«¥"1π«Cjç){z:Kä∏L]mMí=à:_9%Èå„Rj‚bÛû3Æ◊ñHm1:4»“∏ó‘ÅªÏ≈œ[¸cë§ù‹aÀÁ¿rxIUyŒ<XãF,E∂äæãY¯…‰q+ÃÂV»πF‘U˙©ê]òÒZˆ#Ûl¡Ã|@î2ÉÑ=Îj|¯Uƒ3Å…gˆÖgVè∏à»åSòz|ñΩp‡πºï3‚ã¢s#¥çÕc›`…èªpxf]9q1ø®•Û÷	b\*H;ÑFÑé-áYøfª∏»ûÅª´¯Vä]^ŸuŸ—¸ßRJy~œ_8óPæááyêO~;fﬂRW>ﬂÇM≥Ü˘»`∏X •∏l˚ ;/-6–ßï ‡(ÙÔ“éå/nu^®D∏@˘ã:˘¶î◊˜m:îº»zü®iB} D7¥£Q‹–∂MkBGs∞7t\ﬁ¿Ÿ%.¶‰®‹1Ù¡Oìˇ^)˜∑òåç‡(•¨°ﬂN ÷Í6›%?@áØ/o˘5A£B$|π{û˛ä˘ä_bw∆∆ﬁÿÆs òS·àı¯‘⁄hÑ@ÕÌ˝êVe2Ñ¢Án≤˙√Vì‹8LèÉÓ¨noÏa≈óT≈@Å:Ñh.í/úXä¨1KàÅ›HqòÑ+.¸¬	œ=)Ç"ÚºQólv~-ˆúÂ’¬¿PBk˙x•¸(ÇΩ∫ÑG{I?b;2ÄöWvÔÉÚ•Å}lXë˚ﬁª¸÷∑&C∞Ö—ÊŸ◊ËCHùB¢¥⁄ù\Yj-˜Wz≤WqπCÁxGË&Ï7±ãÎ79!∞ÿ‡.˘UØ¬^¬)‚.1⁄§!ﬁæ¿ÀÏm´S≤ﬁ‰ºOôÒ¯€˚∏òËè≥∆âíODe^~Óålo&d-∏–ıÉ3ºØæäòòî∆·x•åsÚ©¶OÖπèv7S˚qπI[≠úM‰‡∫oª‹rõ‹ûxúy¿E…l√)ÏÌÃ—\/¶ÏÚµ3óyµ.¸Næ&mu«Ø¡qbM6é™?≤e8›œ	H/*vjâJåoÈ3E~4˘®‹CPC”ók¿ÛƒÀ™∞™=»œ_È≥˘†‰âﬁc6!ñÓETîÈñÂJêcSä±.£ÉT\ü}¬ß_-O5P “⁄Û]Qö˙›´≥ﬂ5ß°„Õ?ﬁ¯«–˚1⁄vXgTó|©ßæÆ¡?éÌ+yIÍ?3@î€[¢5/±„?=˝¯ \⁄˛Ç^¬Ä7<æÛ˛À[≈Yq[uV∆Lø˝∏€G5  ˛,?«ki^ª¡ı{mEf›åÚ≤i—ÖòÁ"l3R<¶‚ëƒy$q4˙Yâx§ﬂSsü≈Ä*ì∆F5¯∂”\Û!ﬁ&¸À⁄ÃHÏôŸZ÷*ñùçe_3K$)∞É| Áb X¸&g¯[…≈⁄˙¡rÒRÜ]Ÿ √∆FN∂æÏå=˘©ÜÌD0äö|IMÍ®e`ZÿAEÇ•„d∏µ<lóBèCéŸ◊ëÜ´ ≤ÖΩ∂∆¯á‡	‡O¯a¿≈båb Àqo‰`‡ÄÖ™·`˛¸ŸP∆Còu€s'˝⁄<˜db√ÃéWCo.n%ÇVKL˘L¢PH¿•ÃE q"·Âöy®nÈDñ¿œ&ÛÉúU]$ IºñÄﬂÀE%‚bép]‰Ånòœ$síEL„˛•O+Zh≈Y”Ò–‹…dè›UËuØÛâa◊¶”∂M[º§ƒ¡'ßá•ø+öV®yà|â5gπùëˆ.o“‹iê2cπSDMŒqVräR√Íì@òäv$ì0ÖK	9@<Úä•ñ0Wxp≠ûÌÊg\‘êÍ95‡Îë[ke‹±µn-cÖU˜£Nå>sÕ2ÏNzÙ¶ûf7+´.€AAÌÍ°0öá &Õã¯h¢F∆†$•dk›qﬁ˜Áå"~—ΩUÎ•…«BõR"tzjdé~°}‰ZÕ[yfÅ®ifk˙ïgs-¯Z1‹g7.¥≤ãÜ/*,˙ˆ`JIQ`F[ÄFD0,ΩÜ¬b1eA1!¿π–)ÏC¨8ê⁄»
ôóÓπ#è~{g{Ê?åûédQÑ*«œy¨∞?§K‡ #Êu4J4oﬂ-Fdf€¶Û)ZïFä¶xw¸8◊µ≠1œÇÂc#m9Tj|	ãÎ1uå˘‡7Û…F\\!d´<†dXÔ·¬“C‰_Hk!,´‘ˆ@[K¥>
íI/çó¨ªˆJs.∂,£‚)«≠Â‚B´Z‘c?”Æb‰ªGönÓ#ã8å„¥ßVQ\'ú‰àJT$É∏É©ó˚Sj∫S^¥]˝(1πøkú,f:MX™]Ø”ë8Ω^"2õ°?êØI˝Ça√≤X˛eÏN¸KœqÂZãK§ï”∞ú§™É3Ì€ˇ¢ÌDÈOŒñë0+•]¶pßÏõm;äWRä¢%…»ì∞ƒKf´ÜKRÀrºh≈uµSAJfzcº+ﬂ™86\ílfÙ<\,„}lRÙŒME©Y0/µã• 
m∂&õ–Iã!˝
¶Ω4¿≤9e\!¯ŸPÅ~îX√R◊‚ïÜ¯ƒ9ŸXˆÚd¿c_F√€0;ΩbÕ-ìéHQOƒ¢XÿπM‹ø!µ?ˇÈÔˇ=Å[≤u˚˝üˇÙwˇç|…x¬˚R9VnÜºC≥\~îs)9¿Z©:a15ÆÆ”à∫§°tAœoòÕ˚RbÿÊìÄ”F∞áÌl¯‹¨i†kﬂ;˚CFµ‹ÆÃÏñµj√|¶/sˆ3|~f∂‰Õ¶z˜`ü‹*≠´@cf–˚E@∆"Ã]6Rg ≠ÑMhﬂ
Ü=K¸Õ…aPh∫ÙùÅˇÄ’ç6úO≈_Wpﬂ^/s∂$c=Kce^≈˚|,¨ÅûNÂ$ù¿£Æº3©,ÎXµîﬂ’Ìc<?-∆˚~F]=Èw⁄Qóú∏ß4Î∆%ƒbπ/`…%4Á‘ÏfuŒ‚,ÎÍŸ@—dû˚,∞˘çñ∞mù 8Îπfﬂº ¸≥KÔ9l¨í	¸ß„ËËX€É‰⁄)Œÿëíûx-7ÌÀ≠»u‰Ãõ˙}õ∞cˆ¬πKÉ$AA?∏⁄ŸE Ø‹¸cÀœ©xÊœëéß·|YÓggG¥eOÇÈbÃZ5>)eÒúà€≠!/d.Ãs·CB°‹aÂÊ¶Töç	eÍyL©òiˆíΩÄØ@+â„ÜfE0ÁO¬∑vK"Õ4CEñ\˛π$ÃQyN…X„R÷´åGR!=:>G6?w3À0±ó_ùÖïÚé<*+≈ô®F«Ï°ŒR[c‚U»uùç~~w“‹‘û&ˇˇÜï,∏àÁ ”Pç∂ó7Zw;'—ôuaÁ÷≤º–í≤ßmi∂»+äñP ∂óo^…¶?…h)˚æàDì©(©˙»d[9äË4kÜŒ¶˛ƒùXÂæ}·Ùùp!/K’Ì/ÂV¬0¡R…ŸF§»,!…ÏÎ“ˆh(±ã`µå·"ﬂ≤ûÎ#ã	=,ÂÖcSÒ"+/Tbç∫¥¯å{£ÌÚykìW#ïaıœ 0∞]CﬁBo“h/wHeûº°$6î÷m's ∞<5`~(3ﬂJ7°KŒRŸí‘Ò^»Ò¬ÚA,]fo6õ˘≈b0‰ˆmå≥ñøAycñ4`˚÷éé–ƒõı(- Z∞’){rôâ€h∑…ƒ∂Õ]·Ù§8ì%'ÁJ:*jÆ»ﬁ4tù±Õ^º˙”†˚0%Èã≈nÈ‚`∂”KˆîKCY|z |	”N&£a≠’ÔR	Û“Å §Xz[WE•‘x—∆gí@Ùw))>syq3÷yNˆ9Ù‹KB˚r˛h 9èkÁn‰h˛7[?
pa˘E§º>ÛJ∫û◊z6Î2ŒêX@I,4ê˜¬.]ú;p«,ÿZfÏÛÇG≤¿0	-EE7»#»õÉŒR1wÇ‰{; 7≥ñ.ÊÊzc‘ñ+id.Ñ}ãöRu•¿ªüóIb2ñ	åñ·—ä Õza˛ØÙ˙Ò∆daá˝≠Tƒk¸Å˘É_@Ü@Âkµ.!pív
ˇV £‚ä_ümπ
˝ß±byk™.Z˛˙ÁuõòäåuÀÃt{ã2s‡ˆ&%Ê(π£Aèh+√/;Ù8mﬂ—ø}◊Y[ø!ÔI˝KÂﬁ›"èaÏçqÒˇ’îä’èºx"‹Í≤À& ¯y¡$Ü?c¡¿êU€Ë07ú——?’
àÚ–R ÿÅÒ+ÁXÿy’ãäˆy£ CøRA,ànz¯ó ]ŒiÛÀ∏ù∏èö´7fÉK˙Ë‡£È–˝Ÿπa¥.··€—"í˝yçÓöWv«‘™ÂjÁ•ÔçåéKäÕXp1Så|±√ô–ìT #nçKj©OÀÒJ∏‘8Ã`îmñê8?ÄVÁôä'∑Ã$ÛG£⁄A˛¸D»Ë‹{
Dƒì?T'!^¿/âÄb,4”‰m⁄íÉ,¡…qƒªw∆≤Jr4h…t…nn∞`X¨*Gú⁄¥ŸLj»ƒ‹pÙ!÷»&ÎTARòk9á¨	ÊG;•èutﬂáá;ZLpñÎÊ}Hë?„–Ä'Àµ&AÓIM y,%Ùµ°˚ÚÚ≥5QW/1&&ˆÓp®-kåœ_Õ:
5u[ÿZ€ZáèŸÜ(Û!ÑR<vcNÌëÂ Fùf=võíÁè›"n	xÏfÄ!Òq€¿=PòKk|Bí›5^XÓShô£∞7äõDüÛDä∆º"<ß‘!∫ô–Ê5 g~à‚Ú
ÃYR÷†¶kè/È0Å2Æ≠ºN® /Úå
∞€∑õwi3—Ó»CYH¥—ñ"÷å*ÜÎ»CLgëÍvˆ(òÙÔÕw¨¶Ywñ√Ç]ì?U0<ã§k0 ÚE`ãe¿‡‚@ ÙÕ◊Ü⁄YóQd±|ÅÅ&O¨¨û“Ù'Ió◊.ÂBıê÷2Wz$¸Í†j`FKƒ˛.Ï‹F∞îwf≥n“îí=¬¢t2v%k«∆í»{0â9ï®˚«~eÂõ◊m2ÁÅ»ôbıµD\d¸Œº&'EO‘^k]ƒ˝)&vX °∫6ßp…c»0‚Oæep‹—r√¯∏¥öá<Yë¿“-(ô´y©[ÛÑ–•BòÕ⁄&≈$«˚W¶XQqX‡∫ÕƒÑ≠Ì{cœ	„£7˙‘Ó;8H™∞0±≥3k©=ö∏ﬁç Ù•Bø-Iˆ›ÉVã·’ÒTù^¸ åî.Åv¬YA0…UÉÚÄ¨…ÃÓ2Ω˛¸ßø˚r¿â|ÔM˚C)ÌtÈQöaæJƒ≤Àõf	cÊ¡¶πÁN—€!˛‡Û⁄cN„ﬂˇSb(™(√√Œ£!òÄ˙ √l¡˘—XY◊m>Ïˆß¥ΩVp–Ø‚pÑÕL≠8)*õ·=ËW¨ë¿÷Öj∞ã"ÜyT∆¸•¢ÍÇ7QUy^’(ŒTQmœµ√®B˛u^u2∑´®2Åâ"#§Ã≠*ÀD˘^`«•≈CøLë2ÙÎV4Ì”‘9¸
¿4XÍ‹BıvIIí∞–zº·√íK∫‡¸5  TÎbáu=k◊‚∞?‚˙Lr$ï‰t=n
TRê-Ü6ì€zr´LoåñR6b™&ñ'ß{∑§ÜJÆTñü…F57Ìs6Ì¿z±Ë“]f..f,¶#Ö ®|¿$DﬁÒ†^øé-–◊òémõ€î„6º-∫ﬁ’Ùß8Wﬁ˛Kûpà÷5áJ
¸'L.[‘MÕÆ›N±ƒr´–öÍu!4X…éØÇ
åJªòëraüèß0-:û≥>€RÄk+jT2NUÌ‚
´*ò3*•(CÅÈu/8∞C≤KwìC∫Ryjjg^k≤ ·Ÿ,óÔ]Avt<=µ/ö˝©	–æˇ˜˛SÌ¢“£µÚ zçö'Û®,FÈóJ∞òj¢ñ~!©ŒÂÿÏÜ°’NöÏ/3>e1;¶6*¿u∂Ë™h‚î/˘Ï'≠◊Ãíú·OÇÈbŸ’ô≠Es‡≈ºYÇëãûÔÕÍôƒπ®ÖsíÀ‡JFúü¯ˆG«æ:”ö^ø≈î›Ùï≥Ñ©2~ƒ!8∆Râ®9\‘Rq:´\U§g$mÒﬁèàsæß≠/≠ôÀü}u¡µupcﬂ«Ú¬≤Á≤ƒf ú≠äù®XÂÃÇX6b˝æZéÚJOãw’+ôA?hÍzhLÂ∂ ÎáA@æ"˚<Øv≈EZù3ã¶CU^;≥≠óySü7>8·"∑8O⁄|òı,t@Gfû\Û©Õ¸>e;°˝tÊ>BˇzÙô?˜≠`ÿysÔ„≈n£‚2I}¥òˇHnd8:gE‰`Jf\i -ÂƒÂ|«Bd@Ÿga¶‰¬Û…©w’pÌè∂KˆPTépÂ$¬Éëo…U√B›.hI™ıÌãÌ[Õ‹ê´ﬂ∑'·ˆ›\/ÌÂﬂ,Y¨–∑`=,S);Y¨Ï› Pòèƒ·q,≥Ï)kª©6a9@üÔ≈ÑÎ‰„Ùºk≤LéÈ˙u≠õƒ ›N“uètµ	MÛ©3/€Îùk:1ŒòäLÓrcı?,Ø”œÙÔ¿˜& Æ¯p∫ÛS„Ì&ΩﬁÂÄ?ÚØ¸+$gL@òÅøÉ©èCA}È¸«\€O]7Ö3(=s$¥—àÇ∆x@Û]Ωv)£zª±ˆq¯NN<-b∆ ¶YS3uKÉ¡R…£±íwÄç∆`⁄Õ Ù&'tV¨K|9Îò©d0l:"ÆòÕË∏±j§X~‚ÏË©·JjbõD⁄lj–œY„+“ä‡t≥µ<\1®9ôG[èé¬Fˆ¿ôé"ßaN #Hæì±6HfÆÏ®	≈[í±¥2Û*“/EÈò@Â•$<V]ì·2ò?uØ8w.æU(?Tà+◊=˘yeƒ8XŸ∆zQ¥OùaBW±~p¬aΩÜÊ(‹Òjãf°@ŒË“Lf¸˛vnCe_À•õ2'N√ƒ?2™).æàQŸGØÓÄtßlVû‡¸öJÃ°ÊÀ†Ñ5É ∂Ô€˛âGó⁄Õˆ¬ÿkà[≈¢uaBHQπY÷‰„˘æ¡Ù¯†SûåzÊÛñÿûÛåqìà∂e‚õ«úåxZ.8Œ$,‚ç4)#w¯FåL”»Ì∫∂û˚VıPÙváNI;¡ÊG<œı®WBgSw÷‘-—	z ø¡UtrÑH¸fL'ê~r&l†È5j¡abkßı≠q†P+P√ }k<ˆB“£h”¡ß™3†˙‚ﬁ f~8¥≈™\"tÁ 7ﬁﬁâ|(õá\Õÿr˙—ı0Gs”ºÂñπ¡`àzœñ#\¢Ÿ¢c^†4:Ë6≤í®˜.eÛTeûtOOâ¨îgä©√Ã∆QB´œqpÄA¢ﬂA4õÛeÀ$µP6ÃµîÕêr{Ò.©¡nWΩíz--Ì‡w'«ßÁ‰¸t˜ËlwÔ¸¯Ëåúúùì◊«˚ªØH˝$“&ß6Óuã©•Ã±M¡–ª:∏ÓÛ⁄Xnééù©NSçπ›i*ÃröîT˝[‡êƒ"„M «!Æ>øÊC†p)H'ÇU\‚rb≠0¯EûGUçâ5…√¬ <`†•ÓÕôé«∂ˇ›˘ÎW€∑∑?˛8Gnóºœ$ŒﬂÇBeÒÊ˚ü`¥¸oúT>:Å”s\'ºÈÆç·å`"-H∑ú˜jæ*Ù+l&ÿÃ®¨Â-%oïn!~¶£xOM4hÕƒcÏ≤Kıö∂. ´ÈíV©wBoRˆï+gª§”nçF•^⁄`UÎî\ º8≤¸Kg\∂ùk ÓZ]“^+Ÿ–}âm}•ﬁäpï∑Ò$†Kò√v©jΩÎìJª—-ÀΩ“kÖj8tﬂøÓíM~ÕaÕ§ˇÚ˛Ó.a≥◊÷»É≈“Ã5):c∫¢,ó≤@‚M¨>.Ù÷≥˝—OÕÕµ%BouZyÆg‹h®“é
ic	π§A>…'GQ0≈⁄πñoÿÃi6ﬁnv¿@™Fäó¥N¬¶uäyaeo<8âtxÎ:íún®Ïò‰éõì)≥ì¥(&ì∆6ÕjêÑQu'>¢ƒ¶X¡4p8c≈çI>,Êç„≠»©√N%ckRA√ë
ÏëÉ≤ˇ(Ñ‡F»üNƒ"tá£ÀÉ ·§Á69C y™æ]xæM.πn·ÉB≈ÅÔToÛ©îC´d˛œ2ã Åg™úYø∞‹¿f8Å”…‡‚å˜-˙…¿_U3ŸÊúGP∆˘›§Ø
g|O‹Çõœoº	Gæ»2®H¯V/(œÉ¯II*~tfƒ¯(ÑÊöAîùrÃÕÿ|Dï»Äcû5GÆ˛∂fπnmâ‘÷¸· ¯ëÉ»¿g¿'™Ω#V¿BRˇ∞ﬁ:v´§?'—Ãù—í'&lER*Ä¶ñpkõ¡|A¿èw≤OqÔË['¥\Á'ª 4ºú+∏-∫åq@0C•^áKJè®Ïpkæfyœ’ì|=çCmñ	4úNs√–m»WX
j ≤~0¶™¥î iâÇ5ÖÌ[7ç+∫√U*E,I,âÉ5ŒPöX’¨8˛≠zy»∞¨ÎOm!Ó€∞(sÔüº‘	¨§¸=ü©~ˆ™o‚_ÍçRÁØ∆LEb&\bœÁ)Ÿ[ÖÖâ”ªÃoasÕ,∞~i}ÊåB$?à∂H¸ﬁâŒ¯ÖMW‰≤TÑ˚x-:z.Ês` øºrÇêßœ®Ë‚v≤ˇíàÒy ©Á5UÁ®öLVﬁûˇ°@J	<¸ƒ;’˘≈ À§hÀ+Ä<éh„ƒ€nn3=ù§åBGÙ\5ûujcäv⁄•Hw≤Æ`#˜û¿uˆiâp|ÕÂ%?é~3ë∂^Ü¸€ãT!.¡û¯úmôy¿§çMîﬁ¥D¨vfäò“ﬂ[Æ’£d0S⁄˙9æµµå•ïlA~Ê÷ï§0Ω¶
“Fr¥~Å\å∏dÕ‹ç‡ìP˚	1:¯…\äNto∆()î≤Éü™ô§∏)I€‰-i6!J‹X¬9?£Boó–nœ5«XÕû√¿°S‹gí‘ıK¶¶%±Ë@eâ‰2‰Ω¨πñ&boT¬Ÿ‡W≈ŸöP±*eV˜*/í3ì5ïÚB7SïÁü+>Å≥€◊x¶|bÃ∏Ôç&‹¨1ˆ| ô·Ä&∏ÒËÚëπÒËÚ·∏±8 £ù˛Ãã•KÊ≈låê”a˙•r‚™T˘ô'KöùÔy>U¿w˝®◊p ‚zóﬁ\òr¶°
∞TF0ê…≈Ü˙Cªˇ°Á]W[+ŒÄN‘¸.ÈËT+`É[ùƒ†ÃW¥»jk"ôì+üKã⁄∫$ ÷≈[UôkgÇ˚D~|©È-ïz%>*?¥¬˘∫o§óû/O¨Af≠á_€(v¿¥GNolSRˇŒ∂¿Ãˆ™Úb˙1!∞uÌy.ƒûPı<+jË…e”.ë±WZñ·–UÄ-ª±i1bK*-≈‘Ïµ+‹‚õ8},ôTO•˚rK¥¬Í‘2®Bœú>›™ÿoYı3h”¢YbVÉ™8í…¬Œ˚ RÃ’øım{<«z\˚“Çr«}€ìSÔ∆rI˝§Mú[#¨êTÀyÕ>ÄŸ#uJü~ﬂ≥‹äÂ'¶M√òèïy4-rÇ≥ú¥@Ω»wd∆ÅãaŸ¿E˘:ÚB∫rÅs	gíÄXæM`TGTç`Ë3z˝søYÙ≈(AHˇ∑¸Ÿ]%}<hí◊Ê8•ˇ\˙c@UZ}œÛ©ñ!÷x‰Z˝>m6-™zÚ`pö≈≠ËÇÚr”¥GfLF.Á≈Ü}»ÔıäıÇõ•œÜ∂=Y˘ãBÏxÙÑÃ®ÅtJX+Fô∑P#Ë˚ûÎˆ,ì‰ ˘ë√ÚÚ¢Ó|k∆8+™¿±2…µG …9≥øjºEWŸwÑ2Ö∆ê~€|ﬂ4oœw®z⁄Ω	-Ç6˝C£•+¶∫‘∆|EﬁÇ{Î;È@Dúıhaœb¸1^≠Ñ^ùiœ‰ñÒ ¯mªM9¿\äÊ∂vπÏïyïÕ¨˜r—k’ãñ¨
ëq
ã¶≥!œÀÍ*@Có(Ω”ëãﬂ0#oCŸc	¿◊FÓ•5r‹õ.Y®¬ ≠QEÜR.eÍæs±`‚˛f∆÷ÅE	Ò}Fr|C% *ç˙ê∫OHÙE<J\9⁄0.ÄÑs◊§>´¸Ë;:®ó≥UñÓ”5Ò≤ œ©äk5åæ‰¡kt«6ã{˘p£∏$¢8[4£I∂¥åïñö˚A∑˘≈9~ø´
CM	G®ë∏-_é+ŒFÌ˜Ø^ÌìP—®E|ˆänxC˙Øhêf»ìë≠Kˆb¶ä‹,)mRk±zÅÁNÈÆF5ë∂Î6a˜ÙCQBÕpG‘¢Ã†∫¡ fùöôrÜïá™¯ZY{fµv€âÈÓ‰z≠ßd]
y~WŒUyAt3Ò¡ìàÆıaªBç=«qµSÈÑfÃπê# 9SçŒÑ8˘äÏRÚBp˝è…™∆ëªFçåÕ Üé'ô¨(9z,ÑøKv]≤Îåó»noJˆáVœY"ov»ø¸ªˇJNº $/ºÎ.iwVV◊J∑±öô…¯Ò45óo$6¥ ú¥ByLqcSshF01*¢@⁄â'l%kÿL©4˜lü2`áÍÉåäÓsvï$¡•ÙO],îﬁLcK‰ã≠Ê–t…Ìê%ÈÁzúFæÚÏ5{‹¯ˆEmÒ.ıAÄW\"∑dËM˝.©u™ñ¿y+U^¶†sG∑J  Øé¸¡?ö9≥˙@íïroßT∞˝¶…s4`vs,∞Åw{É©K˛$““yDKByÎç±§}6ÌôDΩLò˜ÅzÕ$^G™Êh–≈œæwüëà~OΩ;ö´¿™,êf6-g/*ø	gdIú!Ωÿ÷NÌK'ÓÑ;VH[T6¶Mó	 {_ƒ©’Qp´áofxäæâ}õ˜?ΩÁ]%Gº˝•Rÿ›˚≤K»$≤-~z^{ÊÑÚi _˙∑,õô71‹nÅ§P·iT¢#”,¿2Ã∏öJPﬁÛ„Ω}aÁ¯‰‡t†#v_ëW˚ﬂúñm‡=≤ø›Ua•¬0’qún g”Q„oNô◊sìº˙#XxSÀm0¥<¶=[Üê˙‘îÜ@Xà£|» TÉê_UŸj9d∫e¶k
3U`é∏)>∂w ˆO5Cû¶1∆¿©£∆ΩlbbYé√$ÇZ^Å†Çô+e«:¢Rñ}R™nÃ≠2~æU¶Ö∆ÿ!ÂjÀ.ÀÿÕ®L.µÃcË'¬ﬁŒΩPùéÁ«ﬁ®Êë«ﬁUï∑§ÙvâôÈBh–§=éıút∞"/®Í4 qÈi:zÈ≥Ó}ê∞É.ÈÄkﬂuÍ/ƒÔ{„æ¯x-	:v3":VJÌ@n«”^ÈçßÊºZ£çˇ•€°§óŒòROF9B™‰èõF})Wﬁ≈ñ”Zèg›Ÿ&≠(U¨‰°-ù¥JNPy!Ù“3Å˛-Ñ22oû«F∫“∏önRÊd_ñ f˛2
:„¿ß6∏XT4ßÍcó‹^`(ß=ÿ∏U◊_Ü√ª“„äèÔaÍª˛M-∏˚é?¥F§N…f±LyeïçÛ°-!YPΩ¡,æS©2›ıÇ{–πÇÏ1Ú*º@)_é«l°{EäÛsª` fåAL©P-˘ÓOï◊öP⁄íåyU\ìC∞cU<3
ï ·,ãu|äëéR^Ç—:†¡ñ0«A™S«k«jÏÿÌ
MÁ,∫[À·ë—¡Fú⁄#Àˇ@ñ…æÙ}›€±QÌUháYx¸vp|ÜGl»¥0´í)∆•≈∆ÖÎvO¨I(ˇ?ù6Eíd’&ôÁ¿—ﬁ™∆\∑0”ç< tˇ¢íC„Üë«`Ußè ë®v˝TI˝`Ù&}¬Ñ⁄Kƒ\w…x:ÍŸ˛bıò@÷-ü≈ˆÒ‹øwJjöDío0êøÉ-®:A±˙ıTÒ‹«<)Œié„†k‚f∆4•±á0V:T3Ö∏Æ3	ú`aáu,£wÚ⁄ól{;≥ÌÄIﬁÛmÎC„
≈B•)5¸lÉ∑;ﬁÜÃÆQ{–^D>œZÿJÖûp‡ Ë~èÃ/nÆgFÒ$k;»wGÏ˜Ryÿ>≈ni©˝ZØ÷/¿T¬>¡ûrˇbõFéisFˆÎBÙ£Êp8Ó{#Ï‡,!∫5¬3N⁄È÷b%›õjÿ§Kj%è’ı(CÕ≠z˜0Ã◊{|g˝X;±ßÕmÏ}E™®:ƒè9∫’d>∏ ÜlÛ⁄≤≥Êºîûı0≥eq.Ú•9äﬂc9>6bºHJì#b£BÎæ,∆≠êO A[ÉqIfú|‹¶EJ"+f<ùø2=áF›É:]µU8â\e$GvH>Î÷˙uK9ÂN`£ΩµizïÈyÈœ¥<¶W>∫ëQ°
Ω^IÖézzíí⁄xŒ©2«Yc–'ÔZÛ  vΩ+»ûAæˇøî~©,∫Ω˘∏ÒdìÅû£*"Üí2q1 mî´z|Ú√üvœ>–xz#˙Yı(]€W=dËÔœÍ«'°~t§„Ct[2j»
;mÌ€Œ$|l=F
€Û“˚ÚSN™=iüæéAB~O®at€|¢-;õˆ–èÍ≥vî∏n93W5§ËºqÆGåº™'§&•@èËD˜W7B]D4Ëaî£t¨§xuJ;cı”4»Çó¢ËÒé©öﬁóÚÌ_¶˛1ÔßÑû˜•rˇó9»sWÚpHgqP˛¨ﬁºÙÄÍùúãÈ≥~˜IËwk≤[&˙Å`‰'£Â}"áMON—éùR⁄˜ˇ  ˇˇÏ}€r€Hñ‡{Eñ™∫IVâIIæ»í≤$w+∆≠Â™ûá£ëêÑ6I∞–≤ö°àyô}⁄ÿéÿŸßâ›Ëââÿ˝Å}ôÔôò˛Ñ='o»L$ÄHŸ≤KàÓ≤‰=Oû[ûÀm^<I‡ªì±Ãg.0Í'≤x__ÑîeB$Ùà9ø<YÏN~!wÚÀWΩ»wÚK∂ˆù¸¢»/2˜ÎùÏÚ%».ÎîÖT”Ùí?ÒÇ—gæv1•ó◊·öù¸[%¡Ù§"w@ªU"Bf|H—n’ 
ÊÓû(˜ôOŸ≈Û˘)ƒD‚øhÜ.¿ù¯r'æ‘j·N|)]¢;ÒÂN|qØTY|qk∑ZËëÁ&Ò∆SrúO¬≥3í«l<âk_ô&Ì^ü·˚,‹‚ΩL úqBì‡,#o˚Ç°∫/0‹wh4\∂76V™&Òs
rù;(2å@éâ¸©àî<πZNÑËBOr œï<ﬂTÃfZ<7lûÇ«£™ dk:g˚eÎüˆ¶”÷!Ÿõ%a$WÏ‘ﬁ4LPÚùÊùI3#`7ånF3$‹é†›4q˜”0LHÑSêÇ≠/T ú≈5Â?#´]I-µGyï√~ù\≈@íE∞~ëw·¬ãê ømr˙‰j2@ê†â\ÍÖˇ¢Î◊#·È’à˜µÑb%E ‡a ƒIoì=¶Vy‚°$R
 ¿\G"!K>0îFy+ŸÈ‹Ë“F»	Nêì&
°÷É–ÒÌ8âB8±ˆTÈ€b»ëàöX†Ï‰˛"ßˆ¥ Êiß©^ú–›2Iπdè‡)Ì›“ÁÈÁÁòJ”ÎRµ1Ö¿Ê@°ﬂz$>©ôV≈'á‘`¯Ëç$ænBg~ ‘~&g™)9‹ìi€U]àGCßo≈»˚∑nÈ¯ cU∫°é}$!#‘·ö]Ωﬁ>^ ÷˘{«ò±ŒÆ‹ìªífñV¥Â%õë∂ÈÆ∞F1<NÒ∂à§acô>Lg≠óI	Ω§=‹>‡)Fıõöm€ôiímx1M[Íòé∆0‹»ä˝”8ƒ≈ÌXKX*ö◊L€§(J»¬døú˙ìùy”LOHÀ”‚¯)ä≤aÏ‘ÿÂ(Ø2«3∂6hAÏ1Twg¡y∂FÇ…OvVh9bÀJ•√“öA£ë.ˇÑT˘5Ã⁄3d€O√è‰% 8H‚,È´qÑÏèı˛m[Nûï§≥∑n%ûØKªˆ„û]ÁìLÕÊd6ÂÊÁ~rÖÑ,>±˛€^«OG·ïÔ«;s˘ßΩ§HÍõÓ¸¡”ùπÌm∂˛Z`ÂZ¶‡‹zÙ´ÎGø˙ªEN"N`J,üπ#A (Ÿ!MüΩﬁ"ºò?‰W…îΩâ©nˇÕ[F;iw¨Éa8Ä0”czs.GÜ>S¿Ã0æ∑1m§!ôgì ÅW„±ÚÓï‡¯÷€h–ó◊0•}/p–¡Òâ©ÜK>¡i~[¿¥$≥h"√oë5Ú"sl<íÂy11’ŒY06õ”Ù:c⁄	ÜÙVUÍk{ºïk>÷µ5%ó8f˜fv2¡|ﬂ,#7M»˝+É Ë”`4¬<ıQs˝˛*y¯pïÙ◊7[èd‡Êífwï¿ˇ˙=¯œÉU“x⁄h©›±$ë,ï®÷4–™Ê Ô¸—?˘ceï¨PvTiùó¬4≤Õ~_ˇHYoGµJ6‘Hõ+«G/_æ"œO»o_Ω¸Òò<{} =—*bòfW;õŸACeó"+πcÍ¬bÙz˜‡?Î≥√b;I8ìﬂê'∞Œ( ≥0Ã
dc]Ôömº; ¿~Âü¡ô8lø:‹o7Áß§L>Ñ¡¿A£/" àq ‡E5-?æ~Ÿ∏~«€ﬁÃ¥ùfÁ¬≥Ò]I™≥÷µΩàí‰¨%:€Ë*∞q@/˝"Ú,ò¯Í2Dﬁ%[∆~ˇÓmw´´Ø5V˙}0L.ö›ŒÜÚ	3„QêÿÄˇ˜“?î>ü°Uƒ>UFnâ’>öúÖ@fØk¬K
Î ΩU≤ôÇ√ø?>|qrHN_˝t¥ˇ˛¯¸˘ﬁ´?ﬂ\∑@gÖA=Ëd∂uÂ‰®fã˜pØW»iC|S3`’n¥ÿ≤”¶+ûAH~›2d}¿¥ç*≈X1,à‰˝∫Éƒ√∫vƒNô≤†˜◊ó¥†ôúÆÏ˝`¡Ω«· †áö£9Óáu«≠=9~N®éÜb–ï¯äjW≈	YâÂ©?ÎF6¡˝gGá/^cS/˜i,ú^ˆ(Ò¬¨_öMî[⁄Å–∆Öñõm^o±sqÇüLè*G\˚Ñdép‚À0∆\˚ò¸8E∆ë^2»/ÌåÃx„,k˙ñÊ„1ZÅäûù…â‘?:?≤Vµy‘>3ôy(#∂OŒúázöî∏Ô‰ƒß˙…JäT®øA˘sÏí«Îo ˇ÷ﬂDfnSe¶(óá”~ L`Ô“¥æ∆Ë’£Q>ÀânûÏø::∆á˝˘·ÛóØˆ^¸¯zÎC≠áπlùç$"*Ái8◊»Î´)≈ÿLØ[hs∏„ÄLH7”Øß0ä#t2–T5ö2^‘ ≥4D0ÿÏãÒU_|∑%¶‚(@<&Õ 'ÉP]óÀ_Õœg£$h#G.±gu‚ŸTjoò»‘=HËwX'¯ªy“˝6[4ô°π{ÃêMÛI˜6î3«.©ó®¡J»<«»E*‰∞!“y&˙¸FŸ[êsÚ4È
;∑c©\ñ=çjÎ¸\å/·`>»?ò˝MD!¸?¿yzÙbÔ≈˛—ﬁ3¡Õí£◊áœè˛A“„˙®…d”r*˜ûø¸H95øƒZ˚∂jh-‚çÇsﬂÈùm# µmz^∆ÙÌ»OP_uÜw∏#F´0qÖS	/Ioo}f–»˛õÉ7sEÓî“)ﬂ®ábõ*ak)‹®≥¯£íéÒˆÿä4BmÚı°òî-–±¡hÜ∆Ç‰ßΩ◊-æÔ˙‡ÓïŒJãﬂ±h‚L{¥oﬁÎcb{]dlT=‡‹ÌtªL~F»4&VñU˝-\§¥6v»√∫⁄–n˝‰Z#{C‰_{Is≥”˝µºnfK«~£&‰&¡ËÉód`Hæªç ¥æE~ãó0Ñ¨◊$;Ç) §^Øeu◊QàˇÈoñÉ∂fÅ∑^9◊U»‘Ëãl"yrÙÏŸ—ãﬂí◊/_ïjΩÿˆ„æ»≈TÂ2VÂê˙(Õ¿üÚˆSC‡˝2  åb(‡%≥»'‘Ä*VY3Ò	iløﬂ≠3eÍΩ>Ïr⁄ òÆ˙;|Î]ΩxÔ¡¶QæéKπ•∫J`nÉÃﬁÅQsπ˚é6<ÿêùŸa˜πlO∆âŸq˝⁄¶TœΩâáô·OhÉatEµ>˜´Ù!ˆùöÚ∞§>÷Ö∏oaÂã¯g…ê¸«?˛
™5<e˝A8ò	UwèÔÉ~Ÿ@Nº>ﬁË¶£ÄÕw\ı3W´ˇ,µË?WQé3ï∆ug:<{gª≥“Ô™Ë‰iŒ	Ú^z!µJ¬	ê6¸Áp$¯ÔÅ®øJÌ…uz}£ﬁW-„ÈFÆéxKÈmÈ6öıPπg€ºñ”oÂEØvÈÎ◊ªä®∑≥¬`ñ Å£åb¸b≥b˙Èî›ôƒΩ• rg˛r†h†ﬂW‚6a4Ïƒ”ﬂsÂù˘Ì5>st˘XDi¨íëwÍè‡Á…Qá˛∆¥X∏[0Z`hÆ≥…]E®ÎQ8`?›Îk–´4§i§ø≠‘d™¨T⁄S‘£ïSıàÍB©⁄ÀÜΩÅÃ+|X´*;≠ZKäÆ4i≠aO≥ã†·G[,´=£9≈:.u_(+ZπŸQ´ŒV2ûeSE˛∏π˘ÎV˝YfÏÅÂTsπﬂÂÕSap f™rπãÓ©’«%ùx€µº©ß˙›≤ô˙Z™ÉŒ´¢ü“úB⁄2eÌ)c>åD]^Ñ@óËjÈäj˛JU¡∑Zdoç5ÅòP4äıiÂÇ∫H˙pﬂ†+}õ˙—ßµ
¶¿Åí≤wﬂÕ°âk“'¿çgÔïØ[ÔÚ«ío€«;Ç^ÏµØ≥õdÄ“[Ωq RÏÃÈ?Ê‰2˛k~cú~eeæs+…1ÌÃ”ÉTn£CÀ¶¨èaæ˚^4∏x¯£!R◊kÍo|•Q%ì¨4U.æ“éTCa√X@∆»ÅÏ3ú`∞åSÇå⁄ı]I[YÀ7f2Og≥¸"T.∂›nÀr¯”hÎ'8®aƒl¸(w˘Åæ@6π_¸óŸπ¬_–.5≤ã∆y\ÂÑÓ üRÜù˝x-œ¯N6õÊíıi'’Ÿ3÷Èt¯(3üíxyˆ±≥„ù-√Pf±,…~2ìj£j©2å‡=nhZ-}ÖUﬂº’Í\ßG1›T1%˝<¬°èÈ⁄\äL≤Â5¨{ÏG1µ(3ø{√a‰«±Âã?ˆÇëÂ˝Ùd'[O<nîml ô€∫†ÎoÆ∏Xm˚‚™´¨!_?)éeÂ”~ûÜ$	 ÙìvóZ3#	^€Ñø·ﬂaN·Õ,j«„ﬂ˛ÛœÌ7˜ªo…¥Ωaòﬂoß&µìÿIêﬁhg>á≥‚ÇVUH€·Ø™°‡Uøk≥û˜&–_´‹ìï{¥¶µ¢D∑Ÿ~2~‰èﬂ
ãj¥·Êq\∆ﬁ«ˆe~õYnt£|⁄ûé≠,∂ƒî9°Uz¬ÛƒÙ§‘vCçc∞ôÁº]l}—œp†8˚¸tÉ“áM`ßú<&$u‹Ñ§ÅJ-†ä‚'j˝Çad÷R◊ˆsÃ∆4ˆá¡lå•=“«P6T:2√c*ã"/Œ\P"fDLCA≤Áx≤ŸàsóÈM –˝µæüÎ©=ø≈+@∑„7¸…XE√gÉ√c<^Ÿ›˛{›ˆ~ì\¥7—ˆ>ﬂ>>œó á¬ÈrÉB¸E˚ÕΩÓáã∑)‘_π_öZ˝ÇMQ‘Ä´ªÔ6eÃÎ˚`∆âπ„v Ó}ö*ûˆQ2é`2ù%Â)òÕîç±‹3„^«ÏÃ´–AÚWÓ∑Äy·MŒ°¢œç⁄{Lp)Á¡»©ﬂIºË‹O:¥;'Ø˛l∞+≈`]EI£MÄj s úcƒq¶î·,AÕ0+yÄ¢Ñp£¸`^.õ9ª)∏¶îyå‹6ê‰\∆ÌÅG.sô0)Y©;∏¨¯©∏ﬁ0ˆdÉJ†’R]°‘Ñ–IÆéx‹!ìI°ÚKÅ»h¨ n_<≈˝Íi"€¯JeôR§ıŸpÓ¶‚_¿Œ˚—Œäﬂ9Ôê>*Ou¥-≈˝e‚m*œ~fî='aÂ£˝%Û<∑Sí‹ŒBU›,óÂ’tBw<F≈O_“?DMﬂÄ=’ Vá{ZmôŒ5ôwpû˜˘ñ¡„1jòo¶˙ÓeÇ#W†ﬂÅc≈O≈hwΩ>⁄E#õ6ﬁ°ó∆œπaQqè]∆‹>˚`vÍ´‰«Ω√ÍgÜﬂ*-ü√ñ◊Uwß'ÔÛ-CÊ'Ù:œ§Y»írò6¡-{#ªLòíÀ95 „':uãÓwª≈0ËÇ*dNkl?Vÿ⁄ØÏ≤∑◊ÿ◊ ÕM<ﬁê¯À≠©Ì5?ãûJJ≈>ô&>œ5ØW•x˚b={’«∑˛é<K¿“‹öí~£Âò4_“ÛF‰ŸÒÀò¸ÜÏùG>5åâ[€kÎïÓ ı0}2Í#ªÉÑÌ—‹ôıÏÕ,\‡ Èj¿Pp-&u¢’?⁄ Gƒì„!Ä¬ÀNadÕÌﬂÜ·˘»?¿Àa:^gh!†`”¯¢L
s¬“;Û&∂‘*¡öQ|iÊˆÎÄæ-≈·‰ï?Y]>ä£aïqå°√B 6œ∞π34µFÉ5—E˘»ò’7jzj]¶“£Øø¥∞ÎÙ0µB:74#WâØ´/»9kˆ]∫"©©”Œ\˘Q\ã†õGwYÍÈ*∑ﬁ∫E>Bc∆»gØÁ]Å;Y`3¿vãhÇ5b<j4±4ƒ£¡zÌ≤1á‘ÀLÖŸ¢1K7	~≠“âπÖI‘ÊcâÜhè~8:œF?Ï›°Æ(≤JÌ"ÙW∂ Ä%—“ˆ4√E|Ï]°•ØbËMWπı }tïá·ü™7äi78†°π>˙É„à≤ÄHqÆ·p„ù)û;¯+°ˆÑÊ[’∞p⁄eQÌ©MU∑HdOë‡Ì¿ÑÕk>ˆŸc~t;¥\áˇÇí]≥ ¿ƒå≈ÛÂe”∂‚öß±h]}áà]:ÊÈ$Û1i¶ç≥4ÏûßŸ‰lß√¡¯YO—dÆŸo°ß^¶ßñﬁ¯ñk[ÊåRßW>ùÙÖ>ó«Êg•Kuæ'›Nw≥∞O’’ë˜™æ≤ˆ´»È˘át2Ö›O=§R¨Y˙∑ußá®„úÿd˛”Vt Œ°>!˝e=∞PÁ‹f√nãÅYDÎ¥ï Œ≠>˙ï1QnA…≠ÙŸq·V˙Z‡∑£ìó¬YÇÖ„h6^7Zo∫oÕïŒ|≠M˛öÕú~|íË bvÃœ3ÛH«¢å∑ï5Ωg~s@H^4á31P]≥’ sRßUlññfìòìA˘Ãáõƒ›D<:sç¶)É“Do˝o^ô£b“‹jÊÓﬁ˛Öˇßrt‹Qå˝~É8◊∫⁄∏Lt[¨":YÏEëw’	b˙ØˆµÖü’<‚7B∂me˘,¥4S◊@I”eﬂê`∏Ev|ü{…E)r8¶»W{˝¨˜Ï4N¢fï<lŸY^÷ÔãõÁô¶ßÂiå:YC lqvÍ‰QïFG‰bØ~ÍMﬁ”(e–°¯ª®ª»{—˚ãÛ?ãJÖÀ@UÏÏè|ÙKnd!¥e ¸uº∞•T^àïR^â˘ÁÇ«õ|X“ŒgFÏ≤˘ñYU⁄À∏Ä@È¶óÌs¡ﬁæ-⁄Z±os1ç’)∑âNïù’Ü7˝πà≥÷ŒÈ¬+Hœ¯,∂Fß,z!∆!âQâü∂ÌcﬂhD0µ0æ`1Ÿ8èmTì°]øm}héPb•2±çJåÀ3+∏˝µBÔç≈J}ß∂Û´∆ Ò°eTqÃú¨ç“L∞∏íã S¬.≈$ÚáB-ÄíØÅR" dpŒ"1"˙∑Â©L¢ÒÖq=Ê≤pnÃÿS`îÃ7
∑ï˘Ñ M(oRÏá«0sù÷È∂≠ê´à∏tÑï¡TV‡áÅa)$ ´¢*˚‘(\´ÇØ¨êü$ﬁ‡◊RHEÚEqÒ8S>ñÃäÚN¡~|úm"Sfã”?e\è…„’[≤EµìY`F!x6ÚTòÊØÚÒÄ^G{g]ı Ò9˜'O≥Ú póS\Ω(`0¡‡Ÿ˜O®O'ï›è”ﬂö¯ﬁhËıÿ√A88qË#≠∫ßΩ“jwµ Tcä∑∞Ø¸3V
˛ÿ˛›ÎÁœË€√UpK5ÉRì•#@Ì#ªÑ¢·‰1Ú3ß√^~@ÂM¶1´ˆÅjª°∆üE@¡‰e’ô¢MÈ$6Ë'_"\GÜMÁAx`9bÉ2ÁÈ]Øø∂˜π0¸ÿﬁå!)6-ÖÜ-Ø9+≥¿ô*sC˘Å®≥áëmò¸û7Ú£§˘Ó9XD6“;¯4
/©˚ £fÚáp&Vjt€˚¡'ﬂÕ≥›^ÀFöq´ÛŒ`\≈HH7˜"ÚΩ·1Ïn”Ìf3†⁄n‘cgD%Œ˝†¸…km≥‹m6#?G®yã|dr\ÏqÒ∞m8èˆaë6…˜§◊ÌoÚdSætTªæÚ›ú∂@≠–W0üÔcí\¯dÛ˘2
∆AíYât8∏&Œ‡0ä¬®Ÿ†m“—–öº=å@Z(ˆñ	∂˙è√ƒvÏÌ}—¥4œävBñŒé0]Eæ≤M˛~ŒF	&{·—r
⁄ÒqéJCtÚ¸+˝ñ_ˇŸãÒ4¸¯Íª¥2XÁñ %+ÑÉFÄÛ6ç¸aSÖ3`Ö/¸IìM#ŒÇ	[5Syárôaä;ßf‘⁄"	b—Ô”Ÿ>AØØhM°tSáW8ç3Q∞ëΩ≠°á buË-≤1˘åD»∆[¢° ËU—≥ Fe^Ô)Ázo∞Xco;Ò»Êùÿ∞ÏC˘Ø¸Å7Ã^¢ôåC„îŒsbg®¸áRX‘"˘è3Ù0h›DHb‚E√"WÃæ6Ò≠J≈jµàÌ-∑•ÿëa5Æ-tRY4<lñ±yê÷ö¯q´åÀQ¯¡k™ﬁˆÚå¬™q;¥'ÚH´#U˚\à¶ï<E|÷ã´
~µF™∑TRï‚j•TølåI*ãµAqù™•ÆÇVK„+[Q&’ËeÈ;≥∞Í*ú:∫	≥±úl˜ëÌÛÅ≤Üˆ?y˘µ˜‰‚ÿø≥µ∞¸üΩÒUõÄ‹!…&èfìÖRÒp=(î⁄+[À¢:Y!([Û¿5s!…“ÌÉŸ≠F≤Uè5à°umì≠¯;zh=+ÙàßhÙ,®ñl¨)V≤-V&Á⁄%∑m‹d¨j|îÈòÉ Ïœ‚$Á1AiCzÏ*FÕ24ë˛AΩhÍ¶∑$zIÀ\Æâ?ä˝“°hK≈÷ØÇL6_æxÈπ˝aG u∂!Ì¯ÚÇ¬ZáÃã¿ü÷"‚0ã.á¨≈(¥Ú2¯∑µ;€ºÄ©¿§K
™©'ãTû"R4“L–7—$}ïS^• & ”tsµ`¥Ö·.0∆EÓô—ÀÏ ¯i*p1l–* Jì1…∞Ñ∆¸&,§XÖŒ¸ärÃ†5øJÜ"ß∞õ_Iß åÛãîY@¥ΩÇ"[RéAá'çmPo˘uÇ~Qåπ”É•X-Ë7ÕJœvﬂ9˚Ä›≠8æƒY»ÂN∏unk«$k∂nmA#«YÜµSaX¨a[`)J∆ËM≥6÷V^•¨+≥EnkÎ`≈¶ìRHU∂ú€
∂"˙ft3v$W” D7‡XƒRÇÚ≠\äÊ˝•d±¿ºd!À÷ÙJVWÂ˜˝„"nfËAWæÏì£8û°‡i˘L»Ô@Ã~Û"ºä	(ï?Ω"Ïj"ØÙË ,h\∫∫ª;⁄∂¬°TÊh‰˙4∞õF. Ÿ∂õÏ9›÷CyÍrŸ[+¨œ˜⁄·≠≠ëøÛ˝©vcCXió/ Ò’dÄS‡¡∂ÇòxD‹y¢U9ãOH¬32∏@•µuqîwè¨•i◊Fi|g?@ÚÚ∂qù”(1I>Ω«•∞*/rÅ√íÜìDƒ4xÃT$ÇÊ∞UP[Qëƒ∫%t:P¡	«
˙˙Q÷NÜÊ∂DE5Vêñ»[47∞8∏ÇÇYÔ∂áﬁlÏYÏÀ¸ºµŒ%coÇL$5˝‚””U.“úãiZÿO˚˛—FrI±l©hsùÕ¡‘>?É=X∫,K2	ã"Õ(LŸ»|üÄNßÉõRnL@ô[◊{Ù™ñ7vÔŒ∞a˛µt˛Ì≥’é$ˇ⁄T”≈“-z‘Ω·êQ<‘¢N#∂ÂÒ·x~[≥ø≥ﬂ3Ë≤œÜµ*[u4R◊*5 ‡„s∂!–À3Ç‘K§íahëÌÅﬁQéç0gŸXY√¶jÀ4IM©D€E6u“¨J.∞®2¢hë=ù¢Wœ+Œ·CÆÒ#ú_¸ûc*B}°ª4÷NPíî{˝VË2g®z¿¨Ÿ'ñ5t€∞Âñb:ÓS¡∞Â6Ê=eõ
˙Ü˘#¯˘ﬁøF;b´Ã;“¶Næ—)õ∆Øˆ;‚ÅíØ#á>…`∆xÅ∂Jﬁ–©æ›"‹ô÷EÂ»õòö ∑uÏ˜ƒ!ûO◊ﬁäÂ¯’+u2C¶*µ@0ñ'B"·7QŸ≤≈ì–¨eπ‡Ω¢›≤ÿ¬aËf$@fªa
ÄiH
Ó%êF≥RÑ⁄®Ÿ ‚à`ÇπÔvb{Ò¶RÎ®ùô∫“é¸√†%à•ºY/éÖ˘í»y©‚oæÃn¢jÆb≥LdÄJR{9–ó]ì”üπt˜. ıM†^øã@ùÅ⁄õ Ë”‹O$≥:úÄP"cQø@{ [ÅõâN}ÃrKÓVdH¢>7C%c0¿Ä˚ÇﬂÖ¶.
MΩ)BSﬂ_^hÍ∑ñKÁ3EY¶ê®‹@¯‰ÿ™G¡¡ZïëÿÏÑòó¡Ú¶RÙëÇ8¯ò à∏¶≥â9üv+-òAø,Å5o’õá»∂pt˝NG! w|ÎÙæî‚o˝ÁˇJ˛À0Fü¬·V^6ßl˜4ÿIi9|≥3Ë∂y{Ï ≤ô7≥æ∂x<AªaΩ9¡µ9Z™ºgmçÄ¥Ì°ieíÙSr·)Å≈æ®1F‘CqÖÿªÔÊW—u˚ª˘xr›Óˆ
≤,Ÿû¸,ª0oØãûÚSNKπSi G`É·œ ìap"*ê‰ëøÍ	‚Œc0∫ùìTBEFÌi–Ûf‡£î£X|lhVµ$«ﬂ\≈ÑB∞¥˜irYá†PÂ«#^— nªM@& œÚHªÌ˘üπbµ?'L¸ ∫OÆWIÛÁUî§?3ã¶π¥Q52ù”#≥?[hSU°6ÜÒﬂ˘W6ı≤æ5ï[}FY÷.KÖáì‰Õ78Vh`∂Vä
0‰E·õ+ﬂã‡'»ÈÄkçJ«êtbÔﬂ˚W;sú‡µÄG˙cwŒÜw-a¿≠b^ﬂäï*ñ3æ¨Ëq3∆”ëÊz˛∏ä…´Ÿ»øâH‰5Y<’cm9ºû–ë|mÏ^û¸&?ÊãÅTÈ*ÓÅ’f7ç12 yCÑ<`0‚¶ÍEC2à|î≥ÅûçAßQHYL˘v;¬î“t G/~jwªÎõ’∞ÊŸºîl¯Oﬂ„Ã≥§0å≈:å//;uY%hr≥—RS[ì•¿ªì@ˆU%¥A£ÒÇ˛í„£
£ûï]ÒWÌ©Ã–I˛¸ÒQÈÁ[v`Nÿ∞A6≥¢b´Ñ6Tç4£ÌT e7F…ÊÔ˛ˆ◊ˇ˘ﬂ	ÛYÁ©üÀf5H≥L
ız„∫”Èº+?i+(~Ûub&+nˆ¶¢®Êa_ß:	‡Ë∆ßL5aú˘¸ÿê‚¸åL≈˛8(ƒ=;P6eÀÄ;˙Se\åè]}óàºAÒ| íëµ@/pö‹±Ùºô{jK,:ã#–äGZ†|(≤»»{∏˛Õı¸ò„ôÚçÇPé˝@ç:SÂ •Ì:n∂ÄOåfÄäõJiΩHãUFœï´jÅÇòÖÈx±m¢nêÑJÊ∞‡ÿæ˘†ÿ?…øÈÊ®ÒïµA˙Z˛Ê7ñaπÍ‹ˆüö„®>Œ#÷W∏PRqEÏŒŸæ_œŸîæ#ÕÔ¯ØÎ÷;¶AùÎÎ&¥SbDö‚g´¡JWSÑ∂ ◊†'π)»≤òî:¿Ÿb⁄È¢·˚öaP’Û˛∏¿H;3Bá„¡!íÏ1Mo˜ÿ:L∂ÆåÊˆtö+p~ü®™=f¸¶3æ¸ŒAM#áOÔÀ0q!ÀYËG>ê3å#NŒ5ã==ûfü_o‹√∞˝å+¬EfÌ∫ﬁÀ—!Û—‚¡[â⁄[‰°zAÿ-vâ}©¥K¨ =cóÿib73Ó˚ÒˇÚØˇ˘Ô!-Á3≤ÍI˘WDúØΩû%&∞a∏ªë‹]Í	‚':&kdD–S]}≥‘Õ)>rh0›i8Ïw0ÕN·®»ØÀ*À8áK·ïï(ä_<≥|≥â`VvK=tFp:_ÑÑo{6Zàg¸Œ¥*ø£Ò:Sï◊ô2^g yùiáajkœ9ıù‰{‹«ﬁ*ÅÖÖµ0∑ˆ¥ßâÿi2ªB3ø˝0öÜ^íaYÉƒ1w{›CØ≈ı\“•ú;t˘G_úQÉå≥◊@∆◊67o§â&tkçrV‰ˇix∏ ô7øIC∞¬∆eB∞rsd’Îi "HP‰J<ûªB·.*ıÚ≠ü7µYŸ<*j†¥Åä“Ëè›ø˝ı/ˇF‡oä◊n	∂*buÊkﬂìê  É >ë∂ûDæ˜~^NÄdû˛ﬂØŸGòaâµ√£/©÷MkΩ.ô∂75£_Å&´0RT~°…^Ä#Òxã˛Öó¯wπua∆ÿ\ê¿Ù¥<•kK1&T£Ö¯<RQ¬´Õ$ŒÑG© c)yŸÓw–:∫œí‡•ÑCÏEí“J≤Lï*ûÁ≥Q¥™, Â`^SîMñ ¡sBôovê¥ªŒkuÀå—-«8óÈ»◊…1bûwV…&µw8Åm†ˆM-TÄtvÊ£Ôπ£˜‘74Óê◊Ëƒ≠ÍID≈«^–Ωø„∞2©ŸXÅRà‰ˆ˘é∑'¨p9Ò1r3π©B•/´“1’„d„˝µ,>–∂á∑ÿôŒ‚á‘g‚Aˇøˆ˙Û"ÅË{–-ÚbB⁄EÊ…JUE&mè‡ΩJEU='ÅÌÒ∏õXÖ*“ﬂªZGÃuºRtﬂ´TA˙≥W™•8:◊sµà¥1…zoqæ\Zt0^÷óÂ%°F=li”“îk’ÑöH3l÷9Êzò˙¶ﬂ¢ﬁpÌáõïòjt<ö≈:=]ßÙ˛ÎD,—L%ì‰UxYÇ‡ã2Â±å‰ò¢XçÀ/’\õÏ›Zæ"Ìûö–Pëût6qË≈˛0s•\ﬂ˚£ò†BHLÛJ>ó¬·ë:‰DX∆ â <wìs‘£&1Ò¶”—ïLúZÆò.!–ÂäË<›¬∫pF[Ô“ôﬁh@?úL.KÄÉäL¿]S°i(ÊG·l]EÇ¬)PÒ	Z¢îÊ`W!	•"4¨É‡ﬂ·∞ã”,6«CjııÏuuÖcÒΩ”8Õ•ÖS CGËJˇ≤£&w&≠√◊&k÷MÑrÂ∂@Sh∫¶ûYW»ã5Ã[„ä≈Á€9¿∞M=79«
˜9≤é#k>’òZÛ©≈‰öèr zÿ“Ì©n"—-ÿë©Ë£%ûrfa‰ )òè£€ì˙(`}—æG.·ˇ•ˆ œQ˚ö}—Îöj;ÒzÌ^WGÙC_$Ùó*ÚéáŸØL˛≠¨í3ûiò≈P…˛jÌU?ü€Ø#†≤˝E¯≠πRV$[√I_"û⁄h9s[èï€∫ç¬º…Æ}∏ÍÙ≠mÂË˘∫rƒ:¬_Ÿ•ê¥ñ^Ô8hı≠„™‡…j>\äË…K´#|j{ öèÜoﬂ(â4úÎ®Y∞=ÿÙ†|oE¶˘bµË¶≤~á7à≈Ò©Å…Ò±ﬁ≠Ùø¡ƒ¬´U·∂*5£ôn*JˇIyA˚ÕJÖKU€S˝Ï‡≥‰ÀW€≥ËÖl—∞?«%≠Ì)ª
±Œ¡…‚,[´A¬Á+"≥”∂‡>æ≠O3‹lÒmO˚|€£yü¡L‰€z)¥Àí_ÛóLøJ\ËÓhÿ“∞‘JrQjVô±/— Z+›fT˜{ºâ˙âå–Në≤Àì–1@ëuÑ∑ÎQü[:ùcX,êIi ìƒáÂ£FùWcƒLÍﬂ_2>‘.ŒÓ∞·ƒ—◊√Å_
§hj„;≤Õ≥’∆{*NIr◊ÉL™7Ö—(≠iYçk∂ö‚®&vïúù$—ö^˙‹8∫*ƒW¸æûŒFO"çs[e›4Œ™ã¥t˙XQ–ÁV°æÂ1Çu9¡j≈kÎmÂ]ﬁÇ∫YCˇ€_Ü˛∑hºu<moŸH˛I0í9xö{án^˘„[È„£ ~/çå]Ûx„£aKR˚öæ	ÄœÕì|äHÅ0ƒ¢”“m	ƒ üõ&¯‘%
¯ËÑ°SäÁk•¯T§¯‘·ñiΩ[âP˘3‡”4Aj≥Ω.]@aÄS0Kõ˙`'˛tg≈õ‘T
‡≥Óä
±»"Ô•©˘$ªX’ ≠`yä3˛ÔÇ˚‡Î–ı≠¬∞∫°àc‹µºÁè_•è˚ Æ»}á^ŸsËU$<æCÆ*3,úÓPÎm@≠f‘ã;‹Z∑˙c482ÏJ≥Î2u¿v%7Ç]E∞;‘*Mﬁ®O’^ΩxU¡ü≥÷®≤LÌØa˝À2*≠ì©Ì%◊3)µ•⁄•/Q{ÏÓíúi±éwK|c°"<{ŸMÊd#©„òQ<4≤çh÷l\)î÷‘Y√≥wx@Ê5≠3Êœhf¥›VK¶∞‡Næ2á,M_LÇÒl¸4ÚhïÉ‡<H ŸÙW—È ˙≈)âu·j.˙≤Ÿò†“¢aI!Ê2}›ƒ	¯iÔµ‰öÍü |òIa¸ìóÏ√î√±{–î‹	◊t|2ü≈°Ãg)éQÊÛiÆL¯Shôn‡9ÛFÒB∂>ÍÛ)ÆL¯≥»Õ	
2¨ôÆﬂf‹y≠F»–,ÏK•>ıO®x0’in˛⁄-˙kﬁS›% |jSç ¨ñ¨ZäÆyåôj·S¨]ïak(‹Ê∑Mo∏N∆wç˚¥≠¿¬,äπyÒYéÿãœD_|ñyJ4)XÜ≈`·D»SeﬂKñ
£åbtQ≠»b¯i©24>üå˙∞é`13)≈bÚ’≤ã‘ã†àÙ)ÒN®›ÄF
ìh1´WÒ|"*∏ ¥K˜2o£S¿ã|od1^ÿ†˛ôÆ!·„SìÙ‹"y•TÜ0ì~ª4‡◊ƒàA:Z Ç›å$ç»Z	dƒƒÊØDjæ¡*äª∆√.çYb&'äcÖhÿn˚Àâ»√˘Ù*]ÉQ∆LÃç˝»BF∏Ñ,	ßòF≤◊‚)ñFZÿ#ü<cqÜûÁ≥É≤cc»u¥ÏÃ_øƒ∫ÏÙ∂6´‹Ö-=ƒyU_Õ ’ÕÈÕåt\’üA∞Í-‘0bÕµWµ1Ueﬁ é»∑Œ5Z~Ü©~•pOÓ1óµúR+9∑,]îCàÕº„¿•\oûÉ°ÿá „QŸÍ;{>j[yW: Â6“éGdƒﬁÈ»*3P%ö«" ﬁÆÎä‘î›S‡ô&ÓögÀeGsô'Q·P›Ciñ.'HÀ+≤ﬁ’XÇá2Nî ∏pe‰$L0‡SxÈW@‚^10ìÕi¿¿‚ tïÉPÖXÏ≤é∫J2Ω¨‘»1°S÷¨ÏÓã#3$gQ8fÅExdWV|1.ñπ]\áº8≠Ü^”2„S]£XQs®aôˇÃõçXÊmÖp∏µî!tqR—±:˙ŒM	°6ùoxRqß7≈x‘`ÏKBÈü
7WÀæ©pJÓXππ¿bµ8∆NÌ,åtevV#Î≈ñ¬ë[•‰øß]æa6~ãCºI0∆ı9ÛÜ0ñ
:"º)kÀÛ7‹RqiÈ2≥Tï«B¥‚N"VLË%ÁW@ùDK¢Pè<•UÀ•M ˝…Ú	”óA~jâ∆≠»ù§p')‰èÙãìÙª!WTlÃ¡<á™ÅqØHifﬁf=ËjÊ»é¨ ΩJôù[q3‰	_∞{WcÃ&¥?ÚΩà¿bªG-´NΩá–|=
:e√ƒÒ-ôÜ*-◊J˙áœç®üÎ
VU.ÎSF/óÛÂÅSƒ%ñ{≥ç.ô&•±UnŸ	„N®_SÏ»mdî3’]D]Ù2e>ñüÛÏ~qWGüÁhHi˛ó{8jÖßp8Òæv—PPeü∂\7‚æÙK%%êƒ∆f∑Xp‘ÉN‹âëwbdV2®Óﬁ˝’°Á™ÿNGëÛgÁZ2ûΩ∑V¸†En¡ôIqßëX.®}A∫h”¿+]T-À*QEg◊û§‰ÜE≈ê7bÏ'êA7»‚ñi]◊“„Ëc˘Ç595≥°Wìà˚•wAu¡È‰Ç^˛≠Ïû$^2ãIÛπ7AcÖó¸f„ª›Ò¸PÂ‘√D“1Ìµ|€ê3k™ñ"»äí7ËÆó∆f®$?ˆsB2…k•-`·»pìûvËÿt79_Ÿ˝èø¸?¬êÊè$k-˜Ã<f´Pö¸_ˇD(€—|
ÎwEN¸$…cëf£$¿{;¬;¯ó˝œˇ·Øy_z°Ö;7°¥Ò”+≤·ˇiÊØÏ˛ÌØ˘øzœÙ„ü‰ ÏÎègˇ¯Ä»›˙€_ˇ˘üàÚÜ4˜gÕ#œ∫!Gq<[h©ˆyÿŸˇ ÿÄ¡Ñ¸‡ì«…œn=îg\*√–ü5*&‘0"«Q¿ÅOÅ≠˚?2ë„~8Ω"p˛©÷û·€íÖº‘+):Òbö"Ld6lÍ¸!'@·S‚Ô%â7∏†„~L¢$˙6~Ô‚öú7–¨∑éÂ´¬È∫z`≥D∏©|ñ≈ Q¥ë¬ûx∏°«È(Ù–Ìpı`-Ç=8 0™¬ +˚n
ºE1MªZçT·‰\–ÀMq]/¬ƒ«ƒCØ¸±Ω/wMŸ∆Vº»˜äœ{VU)≥”üM∆Ù¸éç&EäWa—8&∞π1Ê
PDF#‹‹àÕÄ\¯ëﬂÈtä¡⁄IZêPß‰¸ﬂ≤≥¢Ê_`&ûG’VéÇs£H±ó#{¡¸|Ì{¬#Õúpﬁ€ g»∫3ä»0
ß∆©5A6#db*ßëÕÁOà®øEæ_ÀqÃ9ME.rïÒ”RB≠
≈˙'îÍWv˜(Ììÿlçö5"ƒRNÖ&\6˘¢Â¢yto6‡Öœ1o⁄ËvåöY€{Æºm¸–˘n´uΩ∂!	GÊ.ú}EˆèB˛Ekß˘-\Fﬁ4À π§¸Äe≠≥Ædõl∞µ˝&Ø∂ÌC´U≈‰ó≈ñqOÀW/∆ìÀ	u˝zÂüuL"yå9_ÔõúµïmH∫oâ(∞ı–ã/Äs—T£Î]#ì;?0õç©¥¥Ñ\–Ò∂Ã#ü⁄NÂ˚ÎQãH|·√K†"nÎ[¡m¸x‹πF·6®k1˛◊_*enﬂÆÓ(?∑ûyTäQP•Y©C|ìw»ò<GWh)M5¯næÅ¸
G‰Ç‰ZÔ*èhã¨0º»2+"W$®ÖB#Nòúˆ|6JÇ)–ﬁ6°T£U-.á˚¡™˘¿=<ïãä∂ÚM¢∑eÛ’s*Ï˛4ŸY	∆ﬁπøˆ˝™áõ3|ØMágn=F˛0“
Æ´zõƒò€ß–{S˘ñË"}<Ìv%SXŸD
†Ì°8Y«¿Ì ô"«ëˇ!/s˘@ŸD”5‘ãoÑºÊ≥ N∂HLoﬁ`¥°:ÑØGúñˆ±Ωyß∫[yË„çÂı[(˛Ê≠Cp¢“¡iäÖÛ≈P›¿g2ã&dRŒ£Ú†9lÕ9µﬁ$¡P¨∏h˝ç'^ŸN0¶¸÷}À.T:‚√™Á≥4> üH√º›ÎZÉà¨CÔP¶Q¡{	A_íì◊ﬁiL~Á{ÿk¿M§àÒ4Ed$ÑaLzDèiwäº—Ç9ÚYdwŒF¿µ|l£Áåàûr`õâ—5Õ%ÿéΩi≥˘Û*	Ü)Ç®ÓîŒ¶VM|ﬁ˚W;s¿B!ŸU&8ˆ”SDLß∑åH·ÛwˆçÍÀkÂûÂZ9«‡Kóü¨Ôã◊‘ëEM∞î€2>Ì¶®F 2¿ÎXò·≥≈¬l‚Ûò4Ù;ta4S*Â£‰”wºE;fô!¨M;é¨hQøˇÎwı‡mÅò»ÕºÜ)Ír»:ïCøÒêÚ˜ÌjH¶ ø"y¬#K~ ΩkˆÖ‹ÁÊs/ò¥Ë5D„z·¿ûU•h€≥ºË…)¢Òó:ŸÔƒI8=é¬©wNô‡ÊbD2Üb6R<ÂpÀú`òuƒ¯t˘Ü°Ö%ÙjQ/‹&>
?∏%&Ân-Í÷≤lX≤Sw∞å0–»bfq5™îüó≥ÃY™˘‹K.ÄC¯ÿÏÆ}Çú‹k-#ÃıB-,-DË¸›TI‹SZ@	6F«SàÙ ÖQå˙o¨µ ù∆'áT6MÈ$≈®Ü6\	ﬂ-Lè‹∫dK<IêåËÖÁFFÑºZÈ.*|˚ÔZàîp1Ú∑P»ö¡WÀBHÊtS≠NÕLã—÷•d"`‘ÓË‹%ê·e'ú˙µ…(b‹K‰~Mq|4{Ÿ'°s¡Qnæ€Œ" JGÉùïÔÊfg◊+$NÆF2xÁV˜6a´;˝¯àå¸≥Ñ˝u&⁄ô˛a [ˆÁe0L.∂Ä}˝ı#r·”˜Ï«ÿãŒÉ	66ıÜx˚è
sã©¥≠Í˛Ä¢e<à@ﬁ›^c£›}WsQØâèiÍ/†7Ú£§πr<ÚÒäêéèL√ÈlJ√·~oõXÂ:+u«\πVrTt—ø#/ΩmTƒ#ÎóGNµ–≠Ã≠ìêû°ä°˙1ÊXˇ%Ó#eı£…ΩÏg[S≠ÌÇ?¬î&ﬁËL)G™E ò‹CgHÖ∆ì=Åh’¶[◊‰©<Mu$¢ÍTß*	@E√>©æÌ˛r’0kùõàÖ éäáÃ]˘ñ¸ß‘âQç™¬.⁄o÷ªÙÏp›A0ôTN˚ïA√h	%ÒÔÉ‰¢Ÿ ˛◊€2n+´∫Œl;<˝£ìy†Ì¡qÏd)FΩ∆˘6Ô`Íµï5Å]Èo“]IìÊU«.5y-F≥jì§ÃŸU^Ç1ª8ˆÏÇıôfééèûä„˚	ì2–ÆV≥ÖW8’˚
∆ÁµÊµƒ≠ıF	Hèe~7œíÉk2eõPS¥R ác:6l•Å®O®Ï¢ê˘g>,It.∏⁄YôÑmÒ™zÉAßÇÄs˙ãƒÎVëÂLππ´Ììì—^ﬁ€}å‘ø°]≤I˜3»_ﬁπﬁK-;Ûü€ùVYî~⁄R6Rèro</kö<C‘¨&µe&Ç. X√:Qœ›°'3XŸÂæÃœÜbÑÁ»…ÎπÜ{f˝%NÕêtÃ˙M>∑LÚ MñãÇÛài^}wÛºo9√◊ˇË•=w˙|™◊‹}'Ô;,E’r1øﬂ MÍëô)a∏øŸåg„-¬|≤W…`ã˙v–+ ŸhCì{-x=Ê∞‘béú´uù9—€Ì∆nIæ¯¥©
˙£Í:#COƒnˆÜC∂YÆñç∫U£Ñ2°§z_˙Íæ~UiÊ~∂ÀÎí8^Û⁄ç?ñ8‚„H˛≤FâRJ–Zè≠^˘÷:Iü∆∂ö+¶∏#©Axçc»Ìl ÑØ∫ôk
“H€ÏYÅÌbªŒ7’≈®^djK
e‡@ÊÈÔÉŸùPõ30fFLº!:°OrƒÑ˚~w∂◊¶’√ñäÿÆtÑ6^QwºKÁö8 ¨gæ˜≤∂ 2¬Kj>Pò>=Íπÿ†NF’Ö,íSK ùã°¯‡êéÏi≈â+^†›T“L}b@ë Úƒal36Øe¿â*2…ÖåÌêRè[&˚¿©…æ¥•,ä¯FWÉ°rÊá31ô/Ké6ZÖ≠q ≈Wî´.Ú|±ú¸[2ÙèÏ1Frû°ˇQóÏ˜Ëê®Ÿ›†√ˆä∂t≠ì ıî)/Q⁄¢T˙PÂƒS⁄X«ÍÛ¶S“/ËîôG\E"À®nNP√FìãíﬂŒ©H™xgP„û·6\3"¥ ‡¥°¥Ü˝¶π√Övd™ú™-∞©⁄,ú]∑í†‹;ﬂ7~=ˆ:∆∂ø¨ã±õøó*è3!o]Ÿ÷º>™ƒº ¥ï„í˛†jQ<K9 i‡{ÁËWôAU˝1v¥qT5oÖ4Áuøsﬁ!ΩÓ∆É~=5w°˙Xï
±‰Ã«ÍÔ˛#µsSŒ*iàŒ´Üœ{Mõr{njÆé(t≥Ã∆ú≥≤ïœxI ˘OÓ—`Òéøqeù,æ_¿•±‘?Á!•—‡Î5`ú´™a·Õß‚…¬ÓÓŒñ˝π;[x∂û¬ê»O4Ã ú≠œzŒxà’%êC˜Ã†ÊcX.\£-øî•…cb|ﬁ˙Töıó9“0¢ú0≠8≤ØÚ¿Wâﬁj>øƒ£ü*%w˜F£p¿ÇHï˜—‰;ˇ_≈ÈßÃ∆∆˙√^Á·¢h¿ãe≈hŒl-Ç Oò?™0∫¨Ñ-‰‘nià”ºñ¡ÏK)ﬁP‡˘°=ÏÛßA#¯pÖ√3ﬂ˚‡<MÆ––ùﬂ/¡¡
'£´ÙòaÙ∞øêªD¶aDái)¯üG‚È(H0ÙÿÈlÙû7XfÃˆ‹,™ªY•√˙W´t`ÅÎ„Z*p1ƒÀ¿ó±¶ÒÎ1ãéxdŒØëK˘d6π°è’–∂§y∆IÂ√*±0∫¶ÈŸ|"ôˇ†q7iÄ‰•vı∂m@ª˙ﬂˇç4∏$∆‚X§ØÚXúˆZ_õ®‡™'ﬁ‰=¡ñHÛ%]HoÙ9Ÿ√•jJ«A‰a,“OV…ﬁ¡˛ìUrpÙdA^ÒVå.ÿß–àŒæ˝3Ωπ”∂µÏÛÀÉÏ"ﬁüE”0vOÏó⁄Ì:º"M_0éb4Bk‡Ur ,Q`˝Ä‰ Ì[Ï(ã¯æü‚$ÛæÓrﬁÛIÑò%E∑ÚzÜÉïÇgMgDÛÂ⁄áe„<* √oóΩ,r€eÖæ#‚œh.(ÌÖΩIò\¿ πﬁ ıàÇ	ÚÌ≥›Ñ’`éπém±e Ÿ
§çô¥±Õè∑†ª$
aB*–Ìãa˘≥≤{;≠ˇA2†spEnñBK0ñÀâVnØïß∂A_ÂüºQ0§´Û°Ã§+Mê2 	Xìí`X·âªÍü†æláîEß`ÖùˆÒ?1f\x≈ﬂ¿éæyõÔe&„?Ú µ ÿ©´@æpa¥`#
∆M"ó~¥úVQ»Ÿ≈O fá——PçÁ˘Åøs®æéVÆÙ˙Ò“°ÅÁpî.˛Äπ—w∞Úg:[‰<
fí˚a‰'0$8#˚·‰†!!;< g^D`MuÔHx&v±,‹∆	aE—Ç›“Ì∂pæ  3øÿµ∞„⁄‚$`•{[‰h§ |$c3`(l@ŒL+1Í≈ÅJ¨Éπø˘ç—'¶¢VK+‚[≈‹⁄9ﬂ©U lëüPÉ\ó¸8ç|Ô}â€ÁvÆøENP–fáP>˝≈œf}Å|–˝MÄ:2Ù\¨·¡p€‚‹c≈wª‰P·√wR"∂èX˘ÉÚJC!lç"•ãØ°ë¥óÅ˙NG5i?j!óé“u¡ÎÆ∆èì˜ìr“‡›Ê≠÷6†|±xck£´ü˘îoÆ§Ñm¿e3å˝D–d_‘1Z»¶S∏ ˙ê‡¨õF3≤7o[2°¬Ñï.fS13x·LX˙R†K ±π∑Fç´≤Ì·Îä-ÊèªËÁ8$°@P«√ﬂ…¡∂SÇT8›«ß»∑ÓãÂ‹—6Nuj†[£Æ1ﬂπ'a8ÚΩI´ÛGÄöçU“hâ∞◊U˚ß`å@KﬁT?Ω±ïkìﬁ[√VN´”5øq•wÍ’GÀ/‰çÒ.I¬(âNêv„ŸÈtƒ…+èÃ9íñ:#◊j/¬≠8π÷≈Õ0k„;◊˙l˘Ãÿ€bú[ÑÏ¨_Æsv¶4Ç{÷„ıÅ™JK≠⁄IN‡%ß\><,ØT•¿(˝èÆM]QªázΩ{®’€pœ§›œO•ù¶ä1\47Õ_òà«‰ËølN…îKß¶ÑÖ»zå€gdÛ6◊ùƒπO’Ë\¸%{YÎwWv©Äz8I¢´ÚYÁ¯ÃÜ=Ÿ^á8ÆNV,üMboèë—&˝!j»˝§›%nøÈmtﬂñ«ˇ“R<Ñ•ÿ ®ˆÔ1eZ˚t4ã0≈ONPñt˘2òò@vg>'1Í_∂H∑ÛpsïÑSo \:¸,
ˆÁMÇ1L©›S™ˆä™⁄Ç¶	z”¬¸ñpe9ãˇüÇE?„öG˝ñ‰©ñ©∫dÏ4Óë%Üî¥´›√«L·(§ÓR
¢9µè®r¬Ølá<'ïlWwËRúeËs-◊∆ö|ﬁ‰|‰Î*QTàñ{I9∆qq ≈zFÌââ’{6'>T“$ˆ”Q	ö=ΩîA®Xìä’Œ˙‘«§!yC_A~ÔE®-Æ–pM·Ïtƒe‚—CwX«$˛–·⁄k{ÌbΩVà{–
`Ä™◊lÊ^s:Æ¸ﬁ1yÊœaaÖ&@áIïÑ}X0 áÌxãã„çä'Uªúã˝q`ã Ï= µ—a¯£Ô‚2Î∑Æ∑›oˆ&R≈+4áﬁDÔ·πbí\¯›"£.áèÑ≥ÈŸÎåÙv¡ Í<`∆í…ô"„¡Q=Gq+ªﬂŒÌ⁄bëÄ°ì¶8jÍÀ ô@*ıQ∆ƒã∞(¶¬SÜavß”èÄﬂfCñPU£ ô¨é„MÉ√≠§s,¿
ˆáp;ÉCÁ€ƒÊÂ…\π“¸Uf—•óo0ISKgª"“7¨J$*¶ﬂ	¸¯1»∫ì°!õ e© k=ÓLÑ5°+™îêé]a†ﬁºy)V˘Û•}zÔ‘!«##∞∆dœÄèΩ"xm9°pƒc∏¢…1^ÃßπäÈAö˙JcÆ["tØåã•∞%∫mz6ï∏|yn7ª’"Ÿo?"aJ©è 8$–≈§UΩ¶¶µ·â„T‹õCÅÌ(Ì›ræ1,6§ÓS∂ÔäˇãyFs¨Ëe–W;ÇjñïWÿöí¯§É^⁄k‰Ë†jËÖä`¢…ì∑PïíÌT1'˘´)su¬˚Ö◊”}è}ïÎ»ÿÅœôôõ∆vµƒP∑}ç’òHKÜUk* !·rÛìfÓ ÅórÀy±ôZ7πUÍƒÅ$¥±£JÆ4À¬›Ç·X#«ﬁïø|å„‹>ÓŸZÕá] Lq
xñª·Ï∫ˆµñƒ¸QZÃWå8+∑k+7Ç5-È8’Í	8∏öõM‰1˚ó±ª[≥#ó∆Ì‚B∑‚ä#>õœè≈-≠ÍH˜’Ø	 Ûû:ÁÔÀ¶Ãﬁ£5è√∆X’Ùj˚‚;ù5ëÜ°X,ªÉ»d˙L„áõpñ…Ÿo»!»‚Ñ¶¡.ÅóKê¬èÖÍñåµÇSºËJÈk'ã &wº¿ØBÖ¿ÎX”1%P)ƒZØñ,ÄjÉÃ‹´•∫†âè∫;é¬Åè˛ÁÑﬁS…Mp@Ä.–Z7,øzçÂPQÈF˘
Äó¥˛GÙãÊÑwo0@F*>f°yYÏ˜Á·∏C†∆szÂ±*àÍjJiW…4
1ô¸ÖP¸›*ëz!rùR]ÙhéÛ6fÀ4æÜæÖq8BOoTWaH:c˙U·(ôÑqô«	[«∆5z*{ |IOk{ƒhÆ@ÀU‰3Ã¶®¡¥ÖM± J_ª¡áÃöyÃ˛lÑdXq§˘|ï%⁄ánKÑÌKÑ_æ¥%‡¥∑PN+Zú◊Pœ≤6_∆xS8Cv ÛŒà>2qz≈Ë¶ÈË¶⁄ËxAw Õß≥n„sR1”¶ÍÂ˙DÛWhf$*NÄˆ–ÿ¬"'ê9Ø≈xÑ∆AÉà©Ã $3ä,È`ÿØúÿFŸ ∞C©ä≥§ÕOÍ-¶Ë˝}œÁ'¨SXıí¢”œ[":Iì˙{“Ìt7Q~~äVÕæﬁï≈E/™`nÌG-êÈÈpnG‹Ô'eπ'"N\-)óD)´/”#ÌÃC•†àÚ¨ï∞}ròñ•?ã&¨IßÃñ≠-{o+Û3ñ@≥›9éÄ≥a>'qŒ°ÃÔiﬁP#ÅhçæjÚ^ )ÌUj	¨ØlÒ1$c\¨w/±ço-\«ÖÔsÿªe˜	ﬂf7ﬂmÈ€ÔÊt·r¥k¨ñΩEöZ4üµ:áWd^ÃìSûÛÃ£´-_≈0íˆ,X%mL%Á∑Ÿ‡pÄ·l«~ú=*nèf¶‹"ﬂˆ¸˛√ı”í¬hÍsNY›∂®wFüb¶úg?%ò$µ∞$ıÂôSIØ≥Y’zün)ÏH±ò"Æ`X"W“ü~$¿∫¡…˙÷Ô˚Œ∫≈„‰Y\”Í•3ck +¨óVÒt‰¡&£`R\TiÖx’+«Æπ∏7hq]oúO⁄‘$àu’:^kŸ)‡¯2[É‡œ>,Àf≈•/.˘¶>ËvI†ÎûıÓ˜=ôPZQÒÏ‘“Gèˆ!Zº∑q„¡©h±ç©{…&(j◊ßx∑Õ/?~º„~Ÿf&^XöäÅTRDYw+’¢ñ?IPçÇfnìs4òÎ˘„2kg∂X˜77Ô=,.kúì^zNß√MøWÌúl:∫oÂgƒ8TΩ¬Ê Ä^èoº<éX∂xTÙû‘îj¶¬uH’‘˜ífïÙŒ¢∆π7]p.‘ﬁ–q>ÂËÖbÖa±cÇVÿ£Ÿ∏ ≠é≈∞p?b•Iéò8/7ºı”Uècw≥Ë<,ã~ÂæXÎïÎ~ŸbâYØØoÙ6(1>⁄±≠	∏t∫Ïä”aŒÇ¬Úî‹’Í8a`io‘N(€\‹1KÔNhJw§	+8Ú¶1u}`πØbÌÛoN)π(„Ñ,L›É3Ôl∞l"Róz¿¡Üzé‰ˆeï ïcù•„ôJ;∫uÜÈ¢⁄Éã`tKîr;ô÷ (üeÛ*∞»l/*Ó^i·ä˚°mˆΩ¢ÕÆ¥p•€êA∏Ê©)ÍèÊÌ®>¬&`ü˛?   ˇˇÏ}ÎrÀµﬁ´¥i[ˆ&H∫%Z¢
ºhoS$CR⁄>G•≤Üò!Å¿¿3 )ZfU*U˛óƒï8øN9Â‰T*/p˛‰y¸Ò#§Wﬂ¶ªß{¶{0†»}4eksÈ{Ø^◊ou“¥è£ã’Ówéá€ Zª]B†ÙMÉ~÷Ç>πL@∆Ø;}Á04Ã…X¬ÓE7rñÂççı’µ?,‡ j‘-<_2k8ûÉ≤¡¢¶&ÍsTñ.…e\bâÓ-Û“àÑ5∑≈≠5àk´∂ô'*u…«M^vus1«•¬π≠”>	azß¯J£¥E‘BﬂG£(!Z–xÑ~Òy›∑FÊu?ôÁÕ|4juˆÊÏ–C`ìÁÒËﬂ∫≈+ˇ]£§ﬂ≈7à˝5{N_Êè)&åã√@aW…‹2ﬂÖÍï9ÔˆuNfŒÀÂˆsK⁄F@Wñ/÷/0ı4~ÉìxqÑ˝´îú‹9¢Á‡îCp7SµIX¥≠Î2ßêÚ¥·•{B— éYo)‰ÇÅ·U#¬öS¢p˙*P0ß)gﬂq´ä+¢R
ïC2ˆ|n´XZyf–eÄ± ‚ÍÕöÔ∏Ëm»# L'_ı	’Ã–Lˆhîƒ⁄æ∫≠:—–_Ÿ∆ı†z‹I”≥`@«è©EØz'eC„Ùù¨H<ŒÇO`“M–Íˇò•≠@ÙCr“§YK„Ñ ˇN1ˆ‹‚±ƒ‡O¿`Z`ù˛–êÓﬂ5?–ºcä·8;9‰·ïç∑ù3Ãy\ˆS||¬7k!≥‹‹ˇ@zNó(¯LIK%«ÿz¬/·Ï¿W\¨„°¯»Ëó·TdjÇa—~úÿÕçŸ;âÉüÍ§'5å˛Ò(x|ﬂÈc)•S˘G¯çÇ6¡˜ÖΩz>±ÀŸ;NΩ∑~àØíƒóóÄ‡>)L˛[v=Ú±—Nm¢ˆÍ%iy…≈c‚’%|P)<ÊyÇgbvf∞1Œ˝TX˝ºÜîÜ-¸‚sﬁY£‡Â`!@aﬁ„Ó
ÁâF´∂·Bôæ`ece#>Ÿ}„—]á∫∂¸'y¢7≤[Hj˝ê˙”<˙±ÉCüoÿı_ÇjÅç&»˙áçy=–1„Ω∞Ú*ó8\‹∏Ô¡ïö·7:‹˝õù˘$à1'~Px‘w9ÛD;Á1ædg@*◊.÷6¢ui£+>cèzYäÇX⁄öé„ÚF∞∫&≠BÊÖ˜Äës√T{ ˚"Rlø˘ú=cÑ:Eï?ÁH˜Œ–qÁ;€{Ë¯ËtˇlˇË∞nj´uc
LÈ∆?-–’/ô√"ˆpı)˛ó)ƒ‡dÓ¶ä¬¯¡ﬁªµèÀÏˇoäS\nÎtuAäDµ€ ê∆7Ebùüj¢˝∂\º¢Ô9lyV†I˜Nå{`oòD∑ Q.≤Wy©\s˘Û∫
$ú]»’JeRYÀÔIlqï.Âœ%>ﬁˇc~∆U¯T9+‘L9íÍ»å§ˇ◊rºœ˜tΩL∂ßM(óÔ·2P#
@€]gavÍ£÷È∏ÖÈÀ°uÿË'(t≈≈q&£k)ÃD	¢∂«¡º√I‡◊j”ŸﬁÈ∏!6ÁÙZÎÁ£∂£&õóçV?⁄≤0JªIÃ#¶jóuhUuèx⁄ûY‘zzıäÔ‡◊∫ºJÉµV“yx>_[_m?ìÜW
≠yÄÕ¸;kÆ⁄y8m%mÀ-U∂ï_ßŸ∫´ø‚,BÏaç≥¶ÙXóΩ¿VWüv•U¢¡∆‹K' ô ∏>p¸˜yàä∫ |˛Ø+9WQW2<!‡s?F/ÊVÁÏGXÅ≥ãÓIö?Àv‚i1EŸù^á¡is~∑”,«8q˙†€ÕpË?el	æ8ÙüÿQ'ÄÁ}V∆}<nuæ).ıaµXw  ﬂÛô7ÖæJçT}ççÛV~X◊"°Œ–ZµÁπòÍ˚h≥ì\[,≥
ΩöÈ!ÛF)‘π…bNEïı`=å!ıƒ“ıñ©œ∆&wœ√V˜!˘Ó[}:Â®Ä0H{QvPÁÇ/KNÓ¸à¡ÀX¿∑]ÊÑß&‚*–Æ)M•©¢	IX{H8åˆG¿UP\ÒÜZ?´Ôéeæ4>ƒçY•y:O˚’tSõ≤πóï
Çëîâz*\Ç%!æ>Ö´CXjöè∞pÊ	ÖÇTqY~J∫XM”j(à≠Ç√∏Æ©◊j=eeÈæ∑É—«zJ5ƒ·`≤ıHÙê›|¨‘ÁÃ¥ü.R¨nÎf!S>õŸ©õxExÄR*&`ñπ∫ k©¶L§’Ki€¶’ÏpV˛Æ‚â][gä%—{wÒÔ’_∏∂ Û;…kªUîvÏ'©K`Å(¶!Ò◊¨Õ˘Q:%5ı˘©&˘Oµ¯X¨¨o¨FÁb-(4ÓÀÁ≈~(|{CJß§ú∞H∑ÿi6æ–”g€9ıã≥ã7˘Ã‡ÊÕ˘/‰r∑ê°¸·‡GÓñ÷©ﬁŒKSÊÉÑ_‡Ûn:ª~Á	U´i»:ewM{>M=åè©`Ÿ¥Hñrx¶"ˆ∂5qÍôÃa0 Ö S XU	ûÁ¢NQ0’«x®¢(AªØO—1–ﬂ˛√ø†ŒÊNâÊöÖ<PM√N<æ%œ˜wE‰e?¥≈[@\Û‰˘˘í
ΩˆAlì‡‹√∏{KnÒ&¡U7‡#	(«¯f [ñ∑.[©¸0ç&g˝a_Må0ÔÚ∑‰o=ª¸BÆÊª¥≤ﬁf7x—\“–‚4åeôÀÛ3B"«v˚=Iá#Úﬁ∂<·<;"f!¬h§≠ö¬Ïå’≤2V»∆XúÖqq=üáqÌ”¿ûàQN∑fbÑ¢z≠wœ⁄◊Ω˜*s~Ö^˙Q`·(Ã‹7K˘~s¡s˛,´9∆ñVL9˘$3@7[ÇM}ms=eêÀ7{5√¿^gÿ"∂úaïÕAROπ&}|~ñD# fª`:SÚ=n†^k£0ﬂ£Û‰zjW9–>)´∑íœ∫7»ôCD†a†Ëm?∫¡Ùs≈ÎË%ç¯‹π%sõ"`Á„€Vˇ'ü~ë¥ﬂñnQ,≤'È“û+OÎóŸO–â¡	b?aÔcÊ#	Ÿ™„øMùm ~o°9¥Yµ (€‡…ïcﬂøåE›ÏßT5ª„Q3 ;-J•ø§BÈ(≥¥ƒÊùõà)£'∏dÎ¨áÕßÛ, @	…`ÜX{¬˜u”1˝—F.Mœ‹V92˙ap‹™X„U(•ãå_Öπ@ÀcUçè 23»©øÅπ≥ø™ÊÏ’sfàƒΩYWÈˆ¨ÖâÏÎñH√/ÊHsÈÈÈùÛ¯7>	ÅÌYlA¬Ÿ±æ ºç”nV‚äéß?¿rH“t>Îyö¡çFèFÃä¢Ó§m9^†A*§⁄&	Mm0µCK˘∑åÜ·¶úpp)˝\#á›Üo†Â¨¡å><dé¿∆äÒ±Yvè?œ'Æúqnk
DâNHTl®•J‰Õ5‰±OApK+WÓißù?ÕÀΩœlGÁ<l≥öûLÉ¿…¯"Z»”$Ò¿CYåÛÑà∞Gácﬂ$¡8'•Q>p0Ëè”~:«Œ™ÊnÎÔ˝”ø†ö—kä`%ÄH+∞- „BC j•÷´”ìgœıà◊/nÅ˚ät¶™g›ùzmÎâ3†o’¶6¬+*ıˇIs!fd
“ágrüçaòıä´ Ë(§°zŸ&='Çûñ	ùëS	∫«Ä‹Û‰âe±`b´©b∏!c˝∞N∫u÷i›-#C÷€Î¨	QÿøfÕA„Iñ¢9üÑè§hˆ_.T˛¡‹≥M¬÷‰jm∞§5rvrËû⁄8L|5äO"¡PÜ≈$nm¢˘√x¬`é¢$
kYë”ûµﬁîÌùÆ±À‹V8ñI)CW⁄=ÿ+Và,.Ái˚Áˇ\y!∫±oïŸ	‹Ìn´
‘itÂÖ[∆4dÿMm*Eß‘tÏÃ2ΩZƒÙV≠ òúbO]µ˙¢`yeó∫{´Ó€7óâ^at÷Ju‘¶2eí∞AÿoYgQF⁄n*ﬁÇ|«.zRutÁ4´i6ë§≤"}[ô•!¨ö-‘èw¬(íﬁ>ÎI˛Ñü$Ÿxù16≥öUí OÍj…§í˜(3ı%¶ï5œ™VÛîf5œØNÈÙ@b≥ùŒG∑IG°±˛À˙g“`¥Pf≤22óÁVùAßÈ˚2õQêª9é£¡!PH‹–7efèUÊr
ƒØŸnG¡ñ/ïMhf†¸3*⁄	S b9z÷l…¨$©(S:-ŸlÁ53vóN¨dÙ˛3õµt]zÏúŸN+Ø67ØS¡¢ÕnRùú/Ê¥âñ¶ìO:Û™Iá.f‘5≈Ô@w4êû_›˜¬∞Íî	yVÊ≠‡‚©0Ì d+‚0ö˜ô√ykR^Çı°ƒ}I}Å2À`Œ» ⁄@Âs˚Ü∞*6®RkÕÆã˝rV	Pî1«©Bá!ã≤7S£Ÿñı‹÷Î´¡§ﬂ"3√Û‚8.Ê⁄î>Â∞~4om+ÜHK˝èK°˛˚D*lå¨¢VT∆Nì!˜8!nd∏ ÚTè™ÂΩå'⁄=(’)x6{?±1˜fﬂ“ï6‹&[◊¯ÎKÅR]ï¿zƒ,≤~ÈN§„[ÍHY1—°Ë
∞â•V√N,-òÈ®Ôß' ¢_·ä¬j6U ¨*`"ƒ¨äó∞g÷é9≥2≈«l ó!&˝Ípã	eo∫SDÏ-∑òZµn˚CÚ˛*U†∫8zP8'À‚åÑ˙’çGÈÅçä®^†:–&1ô=å9•ù/NChnÁlŸ‚}Å\±‚¸*À≈»∏^p~ån_PºÀN^öß+>˜økÀŒ´$+ı<ÿ≤äC}«hæ´ï3`ŒQs$±L˙≈èó¥!Y,ˆÑ∂©1?Ø.‘}Ñ¬</h$œªÂï6Â=ÆF]¸ö0Âj†°w[ı¿à∫¥ó?§ÀÇ‹¶Vq˘–ÅÒu)•¶∏R^π *{'√´A@|u4ÓZWLÓ:#à]˝\ô,Ÿey¨ÅyPÓsü÷0ÅÃ0W⁄kFìO€XÛÏ+Ö>äÈœåŸÙ’Å8mñÖZ:GïyjÔ¶«|}ì¥¿rÔ¶D|]ñ(M´HyØ«ﬁØ5u¬Í 0|Ω+£Ãz[¯·,˙Î.ôÒÀÉµøs¿ˆ±h∂ñ€Î$ﬁ®˛]Yok{'g6ÚR«eç!à@ßÄÙyıŒ∏à–Ÿh∆tj
<∑ïi€,a"hß0BJª+∞ubª•N¨ÿÚz˝†ÍﬁP˛,à|å’ÖG¸E{ïÁ=Í-˛¢ù215`—>È‹∆Ãë@oı˘{àLàW∑D ù“≠á«mxÈ› <Aﬁ≤ó™ÀmXO$$õôôﬁFIò}O‡û¿hˆvÂóú4®´eQL}å{O3†"#vπ‹`FîWOÄå;1 ﬁ∞ò÷ÌÔ˝Û_Ã≥ÚÌD…Dü•í5„·ÍÊÎ#1Ç*ﬁähµÃ:√™4dãÃ`B«O)ﬁ	(I…≠(úoRÙ˛”iwÍ–(™ß°ÇÃ| aL‡¢.GL'£∏áã"…Ø“]<ç>W @‚Vöx∞âÊˇˆß≈\;⁄ŒÓK>”∆û€·U2ï?€[xDQ@‚íh ÷òd'Qã
€õ«≥«#5◊Pü{Å1˝@Á∫&˚◊Ÿzªt˜Aù˝IØ?B´(nS‘ø@£xÇ‹
,¯D⁄”I/  M±Ä1â=
ƒ©H.™∆„$æé¬≈π
àÒe>Q1Õ∞˚£ãfUG)t$˙‘O'©›S™!Éœ75ÿQwh“¶üsï|‘¨∏5À‘èƒ%ﬁÃT„¥«ç[ôÆû\§4˝ ª!î=Ú/ ûd•ÌH|˙£ÊõZ‘˘Øö¨∞*ãCòÊÜCZùÓêï—I=„ÿ›,	Œ	
üÁH,ñ¬`o>5%‘±úÔì∑Qﬂúû¡%;AÕ$ö¿ïö$1¶vgR1πŸ¸3˛Åa6”û∏2ÔnÎØD-Ë∞<=ryîØLõÔ©+)qN%‡Óﬂ@öDÓ4 Õ∂ñKBy@:¯Æç\ÇmW98ÇØû¥íE≤ê
òlé‘máƒÇKå˛\d<p[|•≠—}(ÙX!b46Ê9o@õÓsÏ“&ÿ‚î•—ıE Œ’˘»∆◊/¨∏¥ˆ•ÃŸÆ8öQ“àü˛åâî\µNuäRUó¬+JƒÒóf&ô˘{ºﬁtIÙQ^\Ú7xÈ.–Zkûá†ﬂ≤3/7∂ƒ÷sKLK¿‡ˆc≠ÆÏTìÏÄ”l‚~∆NêöFœ|TMë◊AT˜–ç∏√Û\63[xE\±^‹sR—n∑9p°PEz®Já◊XºÉI ˘âqÄy~t~ãñPÙ©aﬁ?òt{Í'2™¸√Ì[°@"_øÍ"~f0õ&¡ÂÑ•Ï´U≤EËA ﬂ∫øO úÄ‚~j=%ˇΩÂu÷∞ûæNJJ©ßNz	Gp-µ“÷ﬂˇ˙_ˇ7’«~§ªh√Ê∑8ı…∫Ïº‰ß[«p}6,¢:\v˙˙?ˇG¥G6∆i|ït#≠´aä ÛÚCqÔ!Ì€/πÓˇ¸GzxÏ¢ !>ﬁ∞y¯ÂÛ¯K#pO£_ëúÔ≤‘5háésg2	∫=rÁ8âÆ˚—çãYÅ∫kdüz—jP˘Àë1O◊≠*§-…WéÅ6¬oıØ£∫ç∂<) åqÓ´Ìåòò”@√bM∂Îå ∏Ó g¯S’Ï∞JÃ¯_?É¬]6ò8J0”3í0sƒcÀ©fª ÀN‡‘‘…ÌXÚÅõ1X§60Âg*∫hƒ⁄zÅnh~¶xçÙ¸MEﬁtçõ¶g‡^.g’áÁ˝ã√4Èæò˚ÖæOÔÊ‘<±õÌ_!»„ErÖÅO)˝ãeè%◊˙'MÍLs:˜h™K˙ÉÊ€ÃíÉ¡ü<N~ì¬d˛j¸&i7¡mÎ˘mÏ÷∑^¶'Ãæ'ì∆‹1>∑§hèØ∆)Ó>Ç©B–Æm ,]úÛiõ”õÜ¥S¶´»Pïë	ù;êÚg∞ªOÌ˛-˘ÄDÁÑÚ≈íkçï°C}:®“œï‰H|ˆ>·fars I,j°d§Ÿ˚#tàOæ≥‡‹ù\Ÿ2|®oUÅcr∂≤¿°TöíM V∏
ñjluù¨¶ﬂ«’"õM0§ıI&Èè˝IØ1O$ƒ `¬©≥”“8ºòo:Y¿» ƒÁ≥ﬁy´A}/r‰Õ˝{z4hûsˇ>èÃÉ⁄&É*A;ïÁ°ﬂ†”ãˆ¡Iê(Øä˙ ñ„(Eﬁ˝Ê£«ªØ8œ‡˛ΩÎV_¢Ã¡<Ï§‚%eˆáóŒÌúnÇ¡‰≈‹Æ~…±\yﬁ} •…Â§ÅŒ,∞K>TirìË"Jí(9éÒ.ª}17ä[¸ñ[!≥;ù9øXà≤ºùªüÂnz«üîå*îº]âEà<1ñ€r/Œ&iQô†©|YÀ‹a,õ"Æ"òf‹ä$Tòﬂã~Nè5ﬂ¸]4ıÛU2a·âÓ>¿Ω`¢c»’zuÒ¯8ÊGÖ$„,«%È≤öà‘<¥b,≥ƒ6⁄`Z|÷t~ÅÒÉK˛óhÃ“r€âA,ÿodX¢D=S÷Î∂V¬∫ëORÙ:∆û≥hÿÎœó≤¨≥ŸÈEÃ¸C*›Ë”8N&L»€›{’yspˆ€˝√∑G˚;{ø}ªw≤ˇjßs∂t¯€√£≥=,>4ÔTΩ<›'Õ®±î~Ω@çœ(HÃJYÚ¸'MÉˇàGß¡uˇ›5€`—îG˝?$∫#,“ôJ—ùKCõé§GéB x;âoˆ√t}•›|èõÑoÄátém‡ˆ˙4¬L»V˛e“+2º¢¸\¥è._RÊÆ~W)∑ÕTTD2OùFA“ÌëRˆ§rç˘yıÀã8Óbˆîıá˛Pæ–ïÙ√0∫ÆË:~˘3ÍáõËu0È-¬ˆãá0E1#‘ÍFs1Ω:«„—XY@œö–w¿pI~“Ù∆ÔÆ“tí˛≤jm¢ˆÖ6&âì3˘tA¢+!hÎpu‰‹¥ ë#µ~ex∏Úûºez5‡‡>P*˘õYﬂt@˝9Ã¥4⁄YÛZPy”XS¯Ô;√	´)¢Sß∏'¯EíI˚J§F˙vﬁÙâÌbUeq^Üe7ô±‹-YWæAÌ≈ˆ:L˚+»“›Xi˚πíŒÿ‘àoøÂm „aÈŸﬁ≈]/≤^BÃ¡∑m¿kµË_¶X®Îß¯eË©¸XÙUû¡¨ﬂfm”:ohKŒB(HK“,ú‚òÊw÷&iâÔ0ë=H1åBK'Xõs/âﬂÖÄÃ“O≥ó»gZÎa¯OX·0bÑ7!Ú—⁄âmiŒÉê‰“Ü(Ôπ¥•≠Ì8—∂ñ:ñ≈ÛDm¸È&ó]ËÔw@sdë_î,…∑ù$	n˚)˘ØÙåç≥üJxÉYc»¿ø§o$ZÍ7kW5ÖÓ.“0\WJmgô„©8¡Ãó}Cå\(ÁµX˙ù{±MÓwˆ"∏ø◊¶Ó˚UP-sÉO$ﬂ±¢/ËVÜ§MMÃ{∂®±;}üêõ≈kä¥¯…GP‹‡#R∏ÑﬁØì◊á÷n◊íÎü˜
…àÎqZ.Î†dÓﬂªL=ü/ÌÂªfCß\ÏÕ¸ƒ...b&9w[aΩ˜ìÖ¨Q¬$›Yƒ /z: onñK˘™ôL ß8©Z˙M¶˙,¯ƒIÆaòY¬“˝êÆ˛À∂H§¸¶ÚE$Ä≤”¨˛Ém2Å"Y¸±Ë[ˆìûÒb“4å˚‹Ñ?Ûœe~rì˝2º•Òäõå9*zìµï≤U˘€∑…ÿ¥¸+ø¥)Œ⁄¸k|c(áw˛5ïcŸTOÏ¸ÎóR˙™¬Gl™âΩÇ"…7l”?(ì%m>å'¿?^*wﬂ∫b9€°≤!∂©¨7uU©™FNmÖR°r:Ò‘ﬁ£ËÜx∫êÉeˇÙàù-¯d¡ÇÔ§16ﬂ|◊~o%'—ÖL3O[SÜÒh“;¢o≥ø≠ìFwÂ¡8fÉ)ﬂ∞}D,J¢≥‚óù.dâ˝m{ï®Ωh/·/Fé…ﬂjƒñxcΩ32ïsçƒÀ0πßQr⁄úúË~u{£~ør´‡ˇ]&>¸å2Ω*ï_Ωm8ﬂ´ß`v(fØ*<ÂékÓWñ2ÿ2∂0˝ì‰÷pË2’Ç\∑‘$◊<ﬁœ˙Èapÿ/£…Yàõ€¥Òq·"Ëä†XÚ6ÌFWmÄ¬å=› ?¨‰Í⁄FîÄ‚E}»*êz)ÕNSˆ.·úä™iÆÃw*‹DÔíï'µO{Ã)ó:Ìhi	ÌRm]™ÿÏbÆÆOï!äGº	§
•–åì–˜πÃ&X∏føÖ9¨÷<ûc2JÉ8NÀm∏¯=>rËÙå<0è!°z{µ‘®¥Q*¡|CÛÉÄ)7.Ò⁄ÖΩ–ûIlìˆDeòÙá9>…˙õ£oıÂ$”?O&XH\Â≥†m%ï“ö&3<⁄#ç¡iõÀ5Oãës—_º…ª˜@„5≈àÈ]”™ëyÛ3ﬁÉ‹”å˘Z|8≈ıÄ∑1u›áµ@¶-í‡»Áe¯;IKûù\Ï‘∫„SYGºÀ¢pá∂áj‡¡pî;t8|÷X|Xæ{ﬂd˜í6®À·Ôπñ?ìñ9æ[@Ô$kH˛Ω˜j+Ònø‰÷ÖÇ&¬a& í$ ¢ß„ƒN?⁄xø∏5GÌñ	’_´b_V•3◊ª¬ñú2këµ)¬ú§∂%ï`ÍjÀ[bÆ≤∂ÑY≥‘vH9Æù⁄°Ø!∞$e¡–∂Ö|y≈Ê6mΩ¿F8Ω∫ºåRöµ€ædË˚∞ü“”h¬¯&¸≥£m…ÑbÇÇBﬂÕˇ∆x"–¸Nêåâm~¸B˙◊Î çG«Ï≥§ﬂÌ‰ÁÒÄØÁÈ$ä4¯‰Á´¥=‰%ºPÄÒMcÚ`otŸEÙ•›TÚ◊~¢X‡Ôª,±VºŸãxd˜ÇnØ¬@é/aÿµ4,›LôS+k/‰¯FÌπ®ºÅœÑ¢LP9~%D‘j≈#+£*ﬁ»™Ñü.Ÿ?†n‚Ö4b3‡_†ÏŸ9tÅ‰vé~1ñÙáCb•0›V±Á,¥Ö}Î‚˜¨L'ˇÆ∏ªkê˘…]©Í¯ÆhÎ”yºH0ø»ãôÏ8ô4§£A[5⁄Ê∆S∫W‡√¯ 
«íí®n}"Á•ôòE@ #ëÈeÜ⁄¢º–—µÚ˜ÄnΩ$"¶‰5m©I∆n|ﬁD◊˘Öò3$ãéò˚ì‚/SD˜'‘û(°ÃÿÕ– ò‰,bÍ”MD⁄˛≤8£åfπˆ¥Cc¶\∂‘R+Ø—f&,÷¶Y3ˆ$˜íËê—‚m≥ì3ìw~îTJ^1T)ôÀÕ÷Aª{ÊlmÕfh≠—`{M∏Â:´ôÑÛñ⁄sn¢%o+2ÖV6êEÚRj2ƒö(•h	ÈOûÑâ∫5âá U»•®¬˙⁄u⁄RXïî∑®∞´¢¯ú%ÇY√(N∞V∑ªe⁄fU 
í5≠µÅõ‘x~·Âp/à@mﬂr≈Ìê¥	Ï;|ß¯EÕ¿>r®Ió÷7„√π≈Í K˜¥(´Œìü‘lS.-°7c¢fáhöÎ~ü2nƒ¡"*§3õˆ7ïÙ+Ú5¨Çh@íòaAõ2XXËcn:˚yM4∂9.é1Ú|È!I$°| M 7±qÄîÎâ€åÏñ\q?√;°?ö¯Uy§‰≤…+ts≈Ù<ÏBÈ>Ë®≠¸$≠˚w∏Z∂Dh3yaMÉ{ñ˙mí˚6!ˆÔÿk¸‡ŒWø√ÁqR‡rEáaΩRŸèî©√ã˝â∫‰$N“Ãˇ5ƒ‰kîvü∫6fˇæ$kç,(	.Ôsjƒ°Ëï-ÌQ‡ÇƒÏòZ¶≥%Ó,Pmî†;h±N-z_^H{≠;ì±LY•fÓG‚P0ç6U¬*]ë˛‰Ì0ˆãM¨Ãì¯¶†+7_–’⁄ˇwòÈc¿ö˙ﬁÿ€$∆◊ë⁄·åÈ÷õ‡ÛhYßZ`ºàâèva÷.">ŸÉ *çoà7=ÍÇõ
ﬁÊ¶≥K=X8%w„¨£¨É-∑∞©ÙÀn#,8£.˙É	PX˘ò¢á“œË°‰∞\® ”ˆf$∆:ÌYñQxÕC˜´4Vñ{’Ö"≠Y´∆ΩñËŒôz<Sã[yï|ÖMÈa∂q#±¸ŒòÏÁäâaÀFËcÕSÉ [Tµ1f¶÷æBwŸº°æœ≠˛bπM„°ZJ‘ää]jÈªöú¡òƒ]‚xŸEæì¬5éø\‡5…Ì_¸’"…;ÛÍ%Rô’Ò’(e∂+¸òJu‹MóÓ¢Öl%IÊöf¡“=!î;[Ω÷Ì[W”MÕ‘Jﬂ˛åVπuÖä¶ÆŒˇct_®[å7∞ÒÚÃ¸Lª¨;>õ5◊›b1.·åÄ—U%<¬ PwuM∑q«‘oõJÜŸÿõiˇUíD¿é¬[ßWCÖÅ”Üß&4l›‰BÕå∂HáfârDuÙTH|Æ≈2–îJ 7õπor©{Ù∂˘Èè KS¿»}hÂFU*G¸°S⁄Íu3sOO‡Ÿà~ŸµÇÁ◊«ì'Høß`Nü≠Fƒﬂˇ
È3}˚πûÀOû√Ç&£˛SáVõ¶∫;Èˇ7L‚1 Ó&$\¥,‚˜ É◊~è ëT G‹Ë-Ú¯y:ôèoe?/>FÒ8Ë¶¥„ §àˇZ|∂±ÄÄO]7°°`.làßU˘xY|ºLælõ>4°h†Ÿw+ãÎx‰—24ö˛{ﬂ=¶ò5Zê3-0ÉÏ∆¯€€÷Sé©Ò¨}›{ØFƒÊ£P≥XÒ¢ Ùâ7√RÒ‡p≈Jôd5Œ‹B^)?Eâ=èh¸YñÄ’˙‘ZÖ»Áe-Ø¬‹÷?≈Ωm«ÒG·Éˆ¬˛$NJSÿÙVrmÖ7√œ>ì€7!πŒÜáÙOü±åW¯\/—h3˙≈ÁL íúÛπˇ<Ñõç¸MÕÔÓCyÌõËM
4ì˙´/ÇÆÎ≠xÂ 0(ï∏wäT=∑µ› ¯y–ß∏C–<8•Ü‡Z	ºÈÏ·#,« yj–'ü≤£0H¬¥,IèÒÉê°H8t.g´Üs∞¨„$®q˙©Èî!'‡ûbDÜe¿á{˛5‹ÇÌI®}i¨ºëzä7exycƒÉàq øß˙·B)™—x⁄¬Û‹-o¢ù£◊«ù√D?ÓüÓ°”ΩÉΩDO–¡—˜GË¯dÔÌ˛ﬁè>	Ò≈$	Ò6§ìÑú#ñ·ñs‚≠˘Êƒ« ‡rì¸ùƒ7§aÉ—s‚
OeÚ^B•äI‰ôb˛q¿)ê|¿cºö-ìZ÷Ö÷2?U}ô<Á—¿p∫,€O*¢î∂áBJó÷◊iÑ…GÇáÅà˝êzf°hT”rb¡¿è˚ç;îÈæ√ã‘£—•äH[/2¢ØEuπÅq[¬ãœ»8[#Z§Ïˇ"©–1ÈvR
3k¿¨N1_MHö,IE0&6A,¿•K?ÎAMËmŒ^±:MŒËmÑºK}ºNJ_vD≥äi	ù‚ππ≠S∫.`!√q«&ãﬂœóË´éπÑÚJ–\4¥SAr#I"!–‹Ò%I~@â≈*ˆi¢["∫O6Tû’¿Ì‚∫ú3gΩHxsïÌ|ä‚ãpÇHº∆ æå©“~ÅZå√0â“Öà›`÷Öòë1Ø±>X∆ß˘˝ \ïÅ„å€¸ù‡¢¡-ﬁ'§EcÇ»¢„›WÈ¢ïíØœöcıÀ≈	ñOù°˛¥SÉeµ≥É‰ ‚¶ãY‡eq¡,´∏¡úH‰sTÚû∂◊•‹∆¿˘{d¢zæ”ã∫w˙IwY )Ûyº]aÎH‰ag‘Ÿ…!^ó˝tp?"◊€ñ>%0#Y˛¥§" ›∂·hπØE¿3H•ã,_ ÙuëØ“Ùw Z÷a˙≥‹Ùï'ü3>ÖSÑ[™ÆÄ[ÖL°ò˛ß?õ—ÑÉoª‹û3Ày”«¨‹¶ëË†°∑ ?~Úf=Åc¸∂”¶j[.‡ÿ≈∆3z
°Î‡<∞s¢4K”<C¯fk∑é¸†e~f„â‹&åÉ3œ®@Øµ≤Ü9ÔµrÑ>Pd™T%,cÜ°Ä]Gó∏êqNc6¸D≈9‹W¸ß+8y˛DÅs”ôöêÈ/) ¶N
°®;
°	#<óáºî¥Ä‰O˙rÆ«“u7ª„äíﬁh”+/#.X˘ê)Sô7X
Ô·ˇ´©L/u≈b—“–ˆü|ï‹“Ù¢^MÖÎ•_Á*dn´#[.?ÓaLÈGkıNa‰ë‘¨ñúfe$ªHVí¿ökgV6—˜{á{'ùÙzÔ¨≥€9Î†ÔOˆwùµ1≈‘h—"e≠-…jπä◊™ô(–{€5dì`ÁrFXx'˘ﬂYˆ◊Â˛"$òÚ§) g≈¡EçWïê´¥¶ïÄ@à5!N{)VLäÄ‡YRjäﬂ(ñ˜ŒmUtó&KïŸw°X+PÁ∂Ù;nEóÀ–e» vÀ—4≤.[Æ?_9Ï8ä%ÆÂ⁄ }w¬Wﬁª∞<XÆÃ#èam®õ≤8té_ªŒxbG÷tzÀ≠3§Gq”®ﬁœî*¯∂Àƒ⁄+e=aClócŒë"ò€U@ÏCÊÄAÁd!C˙ê˚h
ßÃ5Ïë≈;º@xt‰róÂ/EÊµÇŒ¢dò6È§À¨NF,„«Œø¸€Y¶¸TßÆ\3XúP´ˇ‚TÄÜf¿fs£Ø’˙®\,]\ﬂDù››}p¿≤)CBªXF›?8≠‰+∞ÊÓ+∞ÓÓ+–[ÀmEΩb’GhfÒπ≠Ní±óˆQS‘Û•ﬁö˚∆/ñ»◊iNsœ‘åÓƒÑ|=cÇ0àá±ªmﬁë®¿ÂCX‡≤‘X…ñ_Nc®Y◊}‘ã*Ê≈\¥xπàNˆ^µñ€+n=Æ≈?‡ûâ\% ‡
È‡∆¶xPv(æxê€AA"≠{/ø⁄6¬?\·ï∑“^Ÿ¯∫„V`XkË‡¯Ë°ûy®›∫wÖä`Y€÷¿c⁄zˆÏÎÒ(7∆)¯¶Ç˚’ç)üÈ¶0 Ûﬁ"nä∏Ù-¢aK◊Ω?$◊äõ„ÎÍ~X´{è‡!=äµ≠@°◊Ω≤Ò◊u-_’Ûå∫j+V7—Œõ”≥£◊{'h	ÌÏÔû°É˝√_K¡ıÿ”W¿{Áqõ◊úÓÏ≠ÎÆÎå¨xÖ[1√;Ww„ÇÇíÓdàau…Y≥ÃÜE◊c≥‡ÃÃñœ!!T∂·seÃR±ø*E!êÁ∂vHh‹ó7˝k—≥‹ùå∞Kû⁄¬Ú®◊±=†L)∏v$ºâ›êÄ¯ò®äÇdN˝t&Áe˜k‰Ã∞|ñ†Båª£cwYöd˝¢Ã˝jŒ˝3sIÅîÀ=ªzﬁ˜Wx &qJiàÑIÓm‰æÈ·§â˙√∫1pÓﬁÅ ˜:È6ÖI≠Âk∫DÍ‰€æg!Å.{Q+BxÁ\Q∑ñﬂóØÍ.YèÒ˘√ﬂˇ˙ﬂˇa<–$f3%«^lÌn—÷^úƒÒMîÏ`˙”hﬁaF‡É˚
g\ãº•›?ŒÀ V´ˇóÅ+@
ÙÑFz¨XÉrâ@	ÚP˜b)£∞¥‚Ë»AÀ—C<ÁèúßÒ‡
Ç»¢ã	Ìîa˝ù€ÇÁkÍ‰^<U§)Á=Î=9O;ŸÛQ∏ò¬5]î(	kËN¸£CK”è õ¿3Y8ìµ%•#˘ô¬|¸·à‚ﬂΩTâ‡b‘\a¨!øÆæ”§_S“zX±å¶{gHºÏ∏Jº,\JÃÏXéô”òY:wüÂ¬j¸Bπw◊¸@¿=£k·râ∞ÖÀæDX"üâˇÇHD:’ÇHªqx/K!≠e)§ÚRHÈRHŸR†}·ãÄ˛˙¢”œ9<˘,Éçˇ‘_L˝ıTS}oS]À‘_ÀSMß˛öM˝µ2ı◊˜1ın±ı\∆g9Ôï{π_‡0úÔ+=B>·'Q0»sì‰Æ4<∏D- πM>…#}Í*öéç ÛÃ+EsÀcS-î€aöyA√1Ç{∫Iâ›.ôT=˝<Ê™Òÿ†IØürÜ…9™⁄qÏã£©ù#.Ö¶ŒÇ,‘j–d‘é„U'sÊ!4ßé≥RMyj§ÚFLbë=F«ÈtÅhËû+óƒ5.EmìÙ	•Ymä.à”ë«∏4·M—ïuì_|N÷è!ïí⁄Ë}‡9t(µ˙lÁx=?ﬁ›DáÇ—4C‡—u º∆Æh»µ¶ﬁ“◊‹^b+üøãŒoë-˙JjÅÙÅÔ»íà2>º¨2¯Û9j˘˜Aﬂ“˘Tö;˛qÖ˘ÉãÕaµoÁ≤hµjÒŒxÜ…πkÔ‹iå5·S—eMUtq vi!BÊˆ—≠_1z
$6ñ~Ö»âè*†%XbìÌ>An3ˇSúùôôûs[˚”øÚ#50˚JiZ≥≤≠ò”G\Ú_˛òQÀ Uﬂ2§Í∞zÒyBå+˙Áˇ˘ˇ˛ÔüêN˛!‰PyÍäÌÁh–ˇÙ‰V–gøÌ∞[ΩY ¯Ûët5v(à:´ÌNSïƒL@UˇØõÏÓdå˘KpÍ
˝:ı¿Ä¨nó1ë Aä1 ﬁ÷Aíƒ3¯REìì)†G@…8ﬁ˛AÅ∆:ïÚÇ`Ëp( jm9É=_¥bF‘ïÂÛlΩ]3ëgSCC∂¨ÿ]ÙÌßÈ`U$g1⁄≈©'â¥t k˜A |!w‚ë_‰§ôGßÔƒÉsï‰.ì6w»œM}P(¨ΩÎÒf±ÿ‚ÿ èØ§sÀ9Ö<y§n≤xô!('[ì∏uû Hl-îwKœ⁄Ë∫¥‚Ë‹¯oñXyŒ∂‰ä™·[ï¨ˆ´ü2úË5û˜°uÑ—˛(É‹≠‚&\Ã“aÜ§-ch„˚Fd3ÓIt_¥¸\ÌC—ü∑V+¯¥òœò'ÔvRûÓ'pÛ¯ˇ:êüã∂ŸÒy—Ÿ3¡[≠<ZY“›b“i^ŒXh?d∑ø˝Ûˇ*"Oœ«r∆ÍsÔ[aêtÓmº≤p.£#TÆ‹È=ä»◊ãPÙ)¿åMÒã∫¥ﬂ†œ∆˚óÂHX#‚”ò`üGH$›	0pç„~ E=Í,zíà0}—Õ≈’g≈-Câ6ˆb£]-Y+îe]¶`£pù00pÙçãµ≠‘‚‡πZÍˇè©aˆsïFÔ{≠D8ùóÛí;ıˆâ^™´©©~—?§´l C∫∫HâöR8M#”i„ùΩ›¶7^§9'Å‚£*'ºz$& Âª:ìóÎvﬂ4ˆPÛã„(ª÷3Ê;’%è≤˜ {zë¬E=Ii¢8w_R∏“I4~1◊^l/˚}7Ïè™|¶Ñ·‚œKd˝“ÂM-Ûúö.SŒïfxL¢eÔ¥—KÎs9=õˆË˚tû†·˚∏á√U…z(_‘àwMÂö0Lòvp ng9˘4ßZS¿t&«|Àk1?Êã=∑X‘ﬂ>W%Eø|UR˙´-P5˜∏/’ì5¯S§iÚŸ:√wÂúáïJwTÚ+ü¯öÑ¸v´—≥|y\ÀÕë¶&UÒóMÑíhU˛!Ñ-"∑g®1•ûS4RÊº3¸l#'òß…1ıø\eBwújsñï1à:ï8∑Z‡)”lÁÃìJªÖáê6¸B5HXY9îKàJ<!%CÌ€˙«ox5|Ö9Iòæ›˛eín¢Ps
ˇ-«±u†\¯~∏Ä3_Yƒ\&œ› Eø›~äè˛€G«ïﬁˆ;·w‰ºDÚ# å-¿xœû6ÈØYÄôI]FÁª ®âîlô€—˚πéKoÜn˘‹.ÿ5¯</NL‹újc’ .—àøl›GwÉ*»ﬂê0èm)mÈ0Ã%xyy¡t:É§,‰’bÍ™JÇ’àÎIt¡tH!>J∫ì¡-ËÑòÁ*qˆ#*∂¯u∫]2≠ç”£N”McT;±[]ÃDjÇÉÒÿ\ñÂ”sû∫NÄP∂JQïÓà&pŸ‰J_h∏‹Ìór-ï„Ã‡2“˝U™X,‡?≥»Fˇπn:Úi≠hﬂÈú•∆J÷øXLàå©Ù|W8ô¸õ>ª∆LâvÅá#≈”t{†∑¶Ùß~ 3≈+èõ6˜emÌüÌΩ>•SˇtÙ√⁄>:˙ı):=ﬁ€ŸÔ†Ì˝ÉÉ˝√ÔŸk˚ßgMg$NÁäYﬁ»Uù7<≥Ωä‹‚D;ÎöÒı o¥≠EO–èqÚÌFi7È€vä8Ó≈≠”…Ì Bﬂ'˝∞ò/ts›p≈DƒBA2˘Á$æÒr© ª'eHŸ€’©ôÆ…ùe≈É¬îjZ∑â„¡Uj…ªÊM‘	CÑ•dÀ0Js$Èà–n©◊EÓè Ö∂å"ΩRfKz>!Å˘CF$ò„ïÉ˝/ßëã°z“ãÇ–ëÿOvŒfûiE9áÃz>R §ß84ëÎ¶ıne˝óÔ≈4Ld&§ˆœmqX:çíkÇ+èxæ4È’X∑RŸÈ’yK"@òsÓ∆c¿õÆ eŒiP!†Ÿõ@˝Àk∏~,Oµ‡o:Jk˛›‰vV5oH5ØÊk>!!C‘6ì¨¥•¨Á@4Gu¥Ä◊Ã(Èh≈rKÚÀÕΩ6¸f‚¬±8Ó„ÁìÛ8ºï€é…ﬁi≠[ƒ˛HıÆy3ØC8LhlR)}4&0$ ∂?!∞rÆK~∆zÈ‹¿¨ÙP*ÒÛò4a¨‰˚P[0Ö@!≤[iXí~¥¨˝ûî~èœ∫˘ªw~Õ M±ÿL+§L$≈U0U óÄSΩ≈§£áb@-¢bó˝tÿÚ≈ƒB<	$∫r9ÒËLÆ ıJõÏôhOC°Z≈ˆ‡*ëjÄTX$kÿ´hs≠¨∑ß™WëvØ∆ xCoaÏh∑–<åﬂ¸™åﬂ£_â7<üOûèº'è˙UD€RW]Yÿ≠ææºÌ%ÚÂëŸYæt »·E‹ë&Òò˛WÂïxL+∫∆áMJª^≠§;ΩË:âGªÒçÓ`(3’’˙Ëü†ï_ï>*¢›Œhv¶À:Yƒ•ÕÊ¨M„–i~·µßYû‰[ö"◊Íñ+nË˜¿_œ4ÛIÌ}ÊFç—¶ÍÊs~Q˚>≈Ûà¬”´ÀKÃ¡	˚ë4•;ı#ÖößÆÆ‘Ô—`ÁU 65Ñè©ÎÆË≥ _bjµ≈A4∫ƒå&qc©Xj∫òØDŒ˝[PÏ2%^˚Ñ8˜1Ô‹ÔíÏ«CH4•ãË8â“îª•∆(√EJ¶§Íáî÷u”H”ö^]˙„∂ÿ.¶ˇ©•,∏($–’ÂÙ£¿/EÒT[©ÒËuåI0ú&ò	äj",ÚW|ÙÌF¡’`“®a W	ÎÑÁ†Ê
≠<a}’x˙“]EÍßåà‰ƒ5ïπÀ T5„Ö‰	”çq‚h≠(ª¶; Â´æ=Ëé“Zv5ß\)wÕ∆"¿L^ÖZ+‘ˆ|i‚®‡_(ö¢›a˙Å
¨÷4¬˘‘Çπ"î-#≈ì(%≤˘’y+§y ´Ì≤L,3efµÖ‰(æJı‘%≈öm∂S
Ø"¨g¶‚´ßT6˝>êÙ¨FΩÚŸÃ€æZƒ}ﬁ”wû_ ﬁ™XF∂Ö~w8∂ôÓ^	ﬁ<fßÛ:7—ä$OPç|ı˝D|€™©Ö–ª`<éÇºˇò˚E?ÑÔ—ª'õõ≠õË¸c“¬ÔC;∆x1”C˘˝fˆ+EzùÔ
_Ø∂*Î°æ4%»Ÿy)% Å4’æØ¿√Ø)#r¯ïîƒ)O∫Èr$&P¡WBÚïê‘EHJM∑˙ÍéOeÄ|ÔÆ˜f∂òÒ'ÕSF ‹øò¢°´–aﬂl.ÚU1≥ã|iY^íh_Gô´”T:e¥ñÛ¶9„¶*%—î™£ìˇF≠hS9KÇ¥∑Rß©¶ö&¬oΩ∫π1¿ÂÜHM‹ \4â√T	$ı“7‡`˙`π¿R1XjÜ¡§ﬂ%u„·x·É¶∆xOïπï?yY˝<Ì»™mÅÌ£ïfÍfóÿz›^B‹*@È·S°Ää”9ÁËáµR6œóxèg˛√b◊7—Ÿ—YÁ‡Ìtvﬁt ı·)⁄>8⁄˘um¡ˇqCå)ò'h‹&ØG·ì≤O)z¬A‹òÜ•pÂÿt◊<Qp<≥¶÷Ï‚+ ùÿ¥3≠·ÛqH4]KËUOFÏÔ∑Q“øËw)ÿ~oOG7,èPâÃ%JRXë@ˆ›ΩWù7gø›?|{¥ø≥˜€∑{'˚Øˆw»r˛Ì·—Ÿûüù∫“Y=≈ùœ¿fã©ê:æÈ–k_f©(Ë@¯%g|>=π· OÄù◊“∏›~'‰IÑ13ïœbÉÀÔPv:3›u`É$
™ÂÅÚ÷ªáÈ(K™éÙÛùP ÀqÚp-ìáô1∞cá,l¸Ÿ{<ƒñ‡F÷íºﬁ	÷–òÎ¨¨!»VΩ÷ªgD]S⁄~Va÷±@|#±iI{‡±ÑgÑÕFäV¢äb∏à˛1æB›`Ñp•∞}t…öÀR=@]0∫ùÙáQyQiQx&[¯¿wm∏LrÅÛ¿"úß˙©_1ÏzÍª!ﬁMÉtCD∂˘óGõ»"ŸR,∫ÖF˘HCÆPb◊¢ú6z0„ˇ(Ü2	—‹•¨‡¨bÇküÄå™wI_R¶á›„NJ[®ÌÔcÁ0Êöì¿:»¶⁄?+lõM-»ºÍV*)àr√¡∫~«X}€s<4À‡:ûR¢;o`(-â¬´n‘h§WCH;|u3?z|}ãLE’eﬂ—ò˙&’T-L£≠ÚsÖÛ¬˜`™¯NU˜f“xZ|0ÑÉ≥tR}=#T›¶ú….˜WZ“%]îIJ;l…∫Túm2É~ò√käÃΩîà £c:#ÿY≤\”¯Yé˛…ª⁄&gNö.©¥H+rªkÇÆ…!Éütb)=´§ç˚W±≈¿9Ø”6œΩ}Ju +qnƒÔìé–„Ê§‡Ó)Á–båŸ¢36®i`Ï¸I≈SçTR—;s:ü…z)\^∆e*jMk-b23ßª¬)î◊Fu™J”pU–VÑˇ™,!;‘˘U?I'æ‰á‘VI7˛l‹qtßíûﬁYÏG±HÄÈMLÍñ‰¡ÛÜpy±jøÙvÑ´¢]
€X∏ﬁ	í∞¿6Ö:Wì∏u‡”:\pC6¿BG›áKzUi˚˚∫û€´êf≤‚Ç¢_y1Ü™®ÿ©A¬Ëóf™§≈Ö&ÛUÇ∏ÙìÔtª∑	≠|S¶Qy&ÀÅØÑ¶¬ùïR%WèøéBÖ-W)çDîÃ¿fSDñ1ı«œ?ì	√ÇÎr5zÍ+g*ﬂNÑSOàåëÌ;!nåÛÎNs¨Ø≥?«ÑK íaòùFïP>a¶=I¯5ÈO$ŸÙô)]iÆJENÏZøÛ)∂r(á´0ö˚Œ‹≠íêd´KXôßâ:∂ÿàüz2±–Ö∂À§ﬂxôjççõNÆZ ‡R,V—‚Â"j∑◊÷÷W¶åbf;ÆDƒ√ÊâÆg∫4S%toà˜®DË–<Ø¥N$∏Ãﬁ£L'À≈πD‰éxÉõ‡<Ï>É—≠˙Ñ›Ù˝c⁄ÚÓÛmzy9]A⁄ˆ¨i∫<7Ë.u˛∫EÀØØ[¥hãæ¬MC$xÄbm=®Ì:U‘øjäﬁ‡ó∂ˇçiU^"ÌÒÊ}”ZoéB‡ñôcB™$a—ØM?™ÊkêØØîDSTÄ"´3ƒ]‚€#¨K˚£ké‹˜¶%Ñ„_[[}∂º¯¨.¢¡¥•k2øB5Ω4<ºG¬£UÌE{DgOÇmX !Ú†îeã?ó*ÊP$∏òÁ 
Æ#«ì[ -bÊ_º„—‡6o¯e∆71iíKB´∑Ù≈(®Sﬁ˘’‡#+”—£“t›/ΩŒÍøM>=Iß	©Î°óiñ>ùeèπ/rGkŒS9öK˝ßÃJUﬂˇ”·ÈhI”Ÿ|´È“ó–ÒÓ&rËHô€8é”Ik◊#]∫gvQêêîÌ˘#b?pv£qå«
ràR”Uøçß∏K™ˇˇ	±∏˙¶ÊìèﬁZ_iˆ¯‚ØÇåØD∑É—GHéGc≠ê8ﬁôh∏˜Ü} H—·ˆÓÍÏÓl/†›˝Ìöÿﬂs<¢áÚû(9ØÙ1È”Xà∆Wç⁄"ê–.˘°J«W	> ¢ü:-8ÓÏÔ¢ñÅ—¥›9ËÓÏ·õÀkœû.Ø’D6¥˜IXù_©Ç„ıEÑª~“¥eÉ2]s˛≈!†ŒmbóÁ˘Ú¯¢Ë%1—SÙó¿≠≤âHzÜ™ƒqIò':irwÇZ7I0.Œ?IY4ûxì’/Ï≥]óèha,U˘≥°zê{$eÆ≈Ò≥Æ(g∏ÍıÀ ¡(ûÙ¢ÑØ‘≤yäV∂åÔ¡?€ÊGgö
ëô±@ÛÀ–•í∫d(ÊÆy,-ÒÉãÛÀi,Ü€7ak˝N±•(&Ÿ¸¨œÅ0ÔÉÓ’Äé#ÃÙ˘ ~®âmågÚÚzv&ø[¡ªÊ=∏í™X!•h‚‘7≈ ëÌ‡].«dÚœ:øÈlÏ°”7€ 5æ?9:=mn∫Æé‹¶Õt€⁄n°G⁄LÛW
ÒŒR?ØÍsúe÷ÇΩ}bπ*Œqiå≥’cú›∂(Õ›Ω›7; ¯∫£Ω≥ΩCÚwÁı—õ√3˙ CM`ZHˆõwÏÒ∆M°ºƒ.o?ïæÈÃ	≠≥	[78 É◊∑ƒ cíƒ·˜,˚ı->Ø™0ÍêQ<éÉ/Öb…“ïg¿|vÇ=èå`S“ej3™=/,ÅJ	úΩM⁄H’}Â("?5äùΩîD ÕÅˇrYÅ+J√)≈t9§Õ˚vj TÉ¥>ÄÇ„Ñ¢√¨Pâ›ÑxJñE.s¥X,ÖË1*UP‰y-é‹3p‹+∆9√r·;SµpD9éHâæ]‚πõH|çúL◊ú¥Óúzûl¸√Ω3‘Ÿ9{ÉŸ©èN~çﬁvﬁÏ9sT¢ú"Æ*ã≈√¨“U0`N/_¢Ü∆p° œGs*a√ç1,_Lej´& vrº}ÚPô5⁄∫Ô¶„÷:ªˇÊÙÏ5Ê“ãÜﬂb∆≠’¨∆™!t@pÿÍyú[GÎF˝åù<MÒCo>˝ ∫° ¨Ÿ\>>4æ⁄∆jZ∆íUvÜ=ã//^‡ÃWãî‚	)qí¬QÔén"P	~5ZM˜∂À©tIæ„^ÎôA5©°u”?FEÂ=ÈUÿì_¯e3ê!Y
fÌºø≈Í%ö«D4î—êBR—ìAæ%Å˙˛)ã∂‰o‚≠^°õ§ÇÕ”Ÿæ‚™π4?Ô\Ì›∑’W%l\õ`–øu‰–=·Åä§9Ã°UÍHŸ’ªå‚WóÏH*òqßpZˆïÚ‡2HzŸÏ{	xpÈB^é«®`«5 {ñSøñº•¢üM£À&'˘q¶’EÙÀÿäe?∏ç¥~x]Ø8ää’ô—JåB⁄X[wÖ≤‰ú˛7«ÿ7 à∞ªj^î_`⁄ ‰—{.a6ä“§'ukﬁAQÑõﬂöˆŒÏUˇ§≥ıãú5dD§A!`»ÆÁN@/tŸºÈÏ°∑ù3tz÷9‹ÌúÏ¢∆˙/gaππÓc´o ßG∆x4 :Ç~ Ùå†‚-Õ˛‚2KÀ.[Ÿl∫Vã7Ÿ‹÷˜'x˙∏˘mˇpÁ`fuäâ§π_/Â ≠sK\O»Ï~h≥åù≈“Àcß“÷…D'Ì®„p!øÒLÂr mçz∏≠8aã÷ñ˚Çm*õ7éWåÌ∏Å< @ëçπ”±F]€ÙP‰xä#∆QMáFJ°ŒÎwﬁÆ6îã(ÜékﬁW.Ø˚Ñ˜.€T”…b4 ,@Ö{Èˇ  ˇˇ ˚‰£xúÏΩ€n‰Hñ ¯ﬁ_aÈïïÓ îª\
).™êÖ§»T#B°)≥:'*êA9Mrf–ù^$]óRÈaÄ≈b±ÿEfﬁÃÏ;”≥/ã∆Ï,fˇ$Îµ`ÊÊªêfF#itwEFd'Q)'Ìn«éù˚Ÿ˛+‚¯<M&ﬁòB/Iéº›j•Ù:ÌæY]ù\ø%Á—8ÌûÖﬁ‡=ôN&4x	%iøÉÒE˜*)9È5	R:J∫:NiL.ºIwµ∑—⁄vÉuW›52Ñˇ«—tÏSø{>Crv—ç£Ñv7˙˝Yi÷√1˚0lÚÃΩÒÄn∫/—
éÕΩ3˚í&#u9Ÿü£hˆëMÍL™Ÿîvˆ…ÌK/ˆFﬁußøL:ÁQ<⁄˜RØóF©Óé`ÒRÚÁ?ì˛ÈíŒ—ttF„ºPL4∏§>/∑ƒ.A›—¿ÈI√Çup˝œÉ1ıó…-„`4= HÉhº\i≤I÷»›“›Ω¨Ë”?∏¨/ÍP¨bÄµ≈ß¬∑≤˜∑+_íóëÔÖ‰y·yÿÉ≠é£0!_Æp€È,ë≠mrkÌ{çìîΩ±“g∂çûxóîlë™J¯Á§ÛY∂ÕÉhÀ}sË/UT¡ˆ<N;≠„ê‚AOhH)ÒèOŒ ä'QÏ•î¿…ßAzCD”‰<àìÙ≥÷“Ô*€èi:ç«ÂeÓäÀ©/Eê{qx·IÍ•”V"õd"ﬁlmë∂(ﬁê◊¬€€UeîßJV g7doHˇ8•µUï5®ÖuxÒ?∂WæB∏Á∆˙‘Ì7_T¿ª£÷≤=pÏPΩ¡ºA¿=ˆH©b:˘îéº£#√Pb∏O∑©Uœ¶˘ï)ôà≈ı¯p‰\…yçXÅA@i“MaJgî\ƒ‘„ïª˜˜.ıÍ ü:†«ßÂ:àiooâÂuü˚ªSe∫Ÿ<≈º;xá|~À[üÛ/ëÅ7Glù ¶°ü4"QLËıÄB_∏ú_«Ä∆»)BÄÏîOdˆN{ˇa|xŒög‰Åò”–K` tà+MClh¬w [wAYyqŒ`òÌÏ‰˜ﬁ-l;Àø‘`8ÿà(ˆ≥—Î IaA^ã7 ˙oﬁñ˜À´¶Ò·¯2
Œ^ŸŸ≤◊p$±±vn˙8u¯ÖE„=X£N≈d]0‰Ë´¯óäw’˜‰}§÷œ.)á^¬ï:¸ûz14pA”Ïg>[éj≈LJ?Ñ4Ö!¬≠}ƒbc ≠Ú¶†K“Q˜éDÁrÎŒ®8◊P¥¯ÁÁ€ó5¥
 0•’¿V˘qeo 8W7…!ª¥·§"?ª]:X…QœTrt»˝‚£Oxa¿6¨ñVƒ!ö[{+vjô§7∫I⁄bBmrWè	Œ‡Bx?+"¿«mÁ÷6…	∞Ú>˙äˇ:4Ÿ^FìIRL·° _ê8n;\z™ƒf◊ú)≠-Cà⁄?à+_M‚ËG†0˘ªv€	F≤Ü9Ñ®?5ƒƒ°C˘\ªùb‚≠„ Í;ymmŸ
πtî/ıgHË};~?éÆ∆m—m˘◊fmãf/rB\Ö7?à)ﬂˇIqπ29πi%¢s∫æ≤ˇùzbµ≤˛fÅ¯∂4i#®°fUÕßxÜ#©übÕ˚Õg†
jàtâ§”7ÎKWˇxÿ5H¨]†Ùˆß(	8J÷1Z®`;	Å:t·ï.Ω09ﬂñh‰’@ºcT⁄RÔ<ÅWËtõ	„÷kOIg Z9är8)oV∆π∑∂èóC±=|›∞E±•≤)5⁄∆≠wRLG^¸>—∆#ﬁeÉ©‚∏\@ÄõŒêÉÿìÀπ•m ÙD€uç≈Œ=ã"‡∆KΩ£`‹i/ìˆíÀ-eÎümÄ1Çêé/‡zÜ•ÉC÷Q?Ω±ïÎí’∑Ív¬H¥:}Û+–apg≠8¢∆xcÍO¥”I¶£M àñâ≤Çè2aÁ}πûﬂè∆(ﬂÍ‘ﬂRΩ^OûºÂ˙;ëœaSõëkµ£h≥ NÆuq3Ã⁄¯Œµ>_>≥˛∂æ˝≤Ÿ®πæﬁƒ◊9„2uYç_W”‰4ƒi<ﬁ“Fò$∑ÿ`Ã!Ÿ°F≥fR/⁄ï”}J’¥G’›`˝rW»\8@:ÂÇf?∏TUìÓcTj$!ÄEw£ø≤—'g@m—∏õ ?¯∑’~üÎZPΩÚ†FOÙlö¶—Œ”\}Ô∑n·‹üNÌõÎÆí…u˜!ô‹t◊q W√ ÔY¿@Íb÷ÆC¢+5¢–oX·áPx]“xSôjé∆IÄrúÆÜ≠m>¶ß+|¥nS™ÖÖlŒ¶ÿ¸ÆænÕ‚úÖS>56SæT’Kí≠´˙®oÆIÜû]u√˘óÏce≠èƒ|≈›	‹@p%µ*á_Ø!πé`∏â	Úq‰_D√H ⁄xUÏ1Ò¶˛æö}≠ﬂ∏
µäÂ»›-uÕ”ïQÑK’+™Zn}ì‹Cö¢xÃw\Süc ª}ÚßÓõ’ı˛[ãÛ«iíÁ7ÚÁÑC Â'∞=ÎpPΩ¡{?é&∏gpJF%áÚi>ár∆“›[∑∑$AY(0Ω'À$öx¿dì‹ïÔÜ7F00•ˆ™Ruµ™™≤4ŸÒó0˝fH≥∑‰äÎ^ÅË™êäØ#
¶≈Ã;AÉ($xŒC®1|üé˘1	ÈyjáË
p* œáäFX¡ùgˆ‘‘µx¥–·Zo#ÎrUbˆÎ°ÇØÒ`u˚æÎ¢—}∫ãb˙”8∆!’u‡dÿ›®Uu;(?ü∫iQá
äÎ3îú+™kÕ?·çõ§¡≈0uT`Oo≈úùÕdpŒ˙d@k˜g7…ÔΩx√k– √˝hz[ÒíÀ:êÒŸß)£Pj–">OWÜV{b1ºËÁÜŸ•*ÕVoîbƒé+ø˚öº†˛,ÃwH{àö@áIMÊ√2çyˆ›rº@b¥˜o√ì ñÌ:·ô–Q`R( ∫¿‡°EH7¶°∑Ç√
∫¡ÌN®⁄›⁄cwúÈÉ§ö¡·∆ˆoò∂5ZÙ⁄ÉK0AŸØâ`‘ä)πıâïz{k£“m§Ñ™(Æµ˝õ[ªjÈNwÙ»Àiò8FRßu +dZ}î	Òb,ö§qÄßUs¯I„KJº©§‹aÄtcœ—z§~çëS^¯Ü}MagpËbõ¯"†‚uúÕé^:)⁄«ïç+iwëY[<Ö≈âpL€"πmÏán9Û–dßwå}C bÍ£ríùﬁaŸ*¶He∫	!ndƒÊ≤ãQ:/I∑∂o+‘|wY[=≤+%ûÜ@ ø S¥[ sr;É5Ç1ô8N#	≠	ùx‹»ÖÔR¬T|˘T’Ω ﬁMd˜âï/RÎÚjÀ àR;Á@‰*$åç\Öb'Øπ–6vÛ¬'x…Â7ôJ]®ó⁄í‰Ωéh)å†–‰,CH9≠ó±©@o)3n ÅƒúÏﬂtµ>3óÍ"ÜCÅˇ Uõt◊	y#˛{kß]:&Ru∑Ós#’f_aÀä∂∂Oz‰("+ ∂sõ;∂ç
r≤\üô˙˚ÓåY—üc5%ä“æôè∫¨"¢√_‰:r“‚ÁÅÃÇâC∑˝ãZcní≈E∑ÜUﬁ9ºäΩÊó:3_ÓîÆº°1,-Á)JE”òlÈ>∑Jù8\	]Ï»ÈV¨^æ∆;∏«IírÃ*‡Ø=\£’ﬂÕ¬êsK¯T[8W=Ü1…)c¥ ¡ÄÊ•îäµ®—Ä9ÙÀåXjzÂ&,•Ö2Có9Ûh≤e.33æStî Gc)y@∞c—D¸çe/Åé‚ƒ¡˙—><¡ûl…qJéÇÊïÖ≤Æ3Ù',¢√ÒÁH63S¸B@Q
]ı¸<û˜ hiÆÑZ´ıÒiÆ≥·®¬jÃÅVòcU·¨£
Gàn´5\:	o‚\C∆[ß·28º%.~ûWôÛGˆ9 nóé'”jÈùõä≠Úc•‰´`fU≈FÂ
¯ ‚~õîì;^p∂KPüF6
Í≥(≠∏÷Ê|rı©“ñkÂ‹∞hÌÅµi]-«‘v.À¥ÆÂÁR™“∫ìiò–n2=KCZ}XÒqª ‡¢fÓ_Ê∆ïÅ•√ï‡r~gıoSu¨ïnîØ h¡ÈÅ¡%›É-çΩ=o6sYªÂMÿªÂÏwï˚Wwõƒ,TjüÆ√A`Ù¸2#*1L ‹ôØ7µ)‹„4´‡a√¯4zMœaP”Ñ¬Oø9}˘‚;|{“¿¡∂ä x•7–%ıFÀàONÿüoy}4ï§O_R?¯{ÚgÊ1`kÉ∆q≥&/≠>•ä >ΩDi$´æœˇ.Å8üGoﬁnwﬁº5Ê ∞â(ÂÛŸ/-£⁄Ó¥€“vÎ5ı ˜CÅÉÛs®W†ÓôÎ·ÿª.º4ä{£|TÃ8≤‰–—SÑóîä¶¡ß\≥NÎ˜Ùl ´Ï†TBÇÑ†ﬂR≥Qúrø∫õh
W{]%p†!cE>-¯kôŒ<9h;≥£[+ˆ“!w`ß˚%• ‡>+D∞¨¥9Ù±íﬂ{¥3øWY¡ Ø˜∂ÈÊp–…Z¥√…æ+Üáe&µê»Î£•°/ﬁ⁄L8¥7w∆‚ Æ;p '
ièÚ}6óö∞˜≠e¸Ø}5Ä∞ˇ‰@òDû·!"NO‰mv∑LÿiqáqÛ0-†	ãq¥QÄfˆ∂˜) ªåêV8`yRÏ*Ì%i4È,-©†Yõ–⁄∑ ÒHl+∂Åà`ÂÊ·ﬂLcò”r"‰é(∂R &rËÜ±˜/√ä¯ŸX‚ ’ˆ‡ÍçÈÿjœmñÈ%Ò‡’hl·ägaàÈ‡U"∑Uô∆Sj¬wÕπ,U”%õmÈäKòΩ±Ã([“µ 9â√úwË3î,4?=í9‡&HLh<
íËÆ˜Ω @–ÍP´úw™	±¥∂¥pÂGè∑˘Ò”◊Î.GÊÈ…êàÍºØêA6TR‹jï(öfÂÕro|È±€%Lë†Èòuü o:m^@ΩT¯õﬁU‡√Ì zË±œ^¡’˝pΩ_(?§hı£W¯ÜøÉÎè˚Ö°•◊PZ‘Ü¿Ë@~w⁄kæ:ÊÌï^õõØz~Ï]éº O»2È≥ˇ©X÷ágl£t©A¬2K!ßˆÌÎùvÄ≠Ø¸8°Êµ{œ`ÖOF¸
“wôîåáWìñ»À„Z√«µæã·£fÙ¯∏hÙàJcCdQ1ÎvÖÄGCô∑(˘“¬P1,¨≤˚)ÃÁ á}F”+t˝VÁTfòi1v+3hFK∑rÀ+‰wxdáIJƒˆïõÄŸ¨≥ëoπ”er´¶|iUë>Ö¶.Ä÷ÖUÚπß€ƒ–∞ú-É¬ÆŸRS®¢r]1Â,≥+’å·Téø¬‹´˘ßøˇ˜ˇÌø˛ù∞ùÖ.aüÀáÃÈ°ÖYä@‚%∏-∫ë3	Ö*ª@»7≠e≠V’[À[èÈ˘÷≠º)Óà7M£„–ª!¯'9á¡ÿ∞5egp»ˇ1‚°;¿—T@Ö}Y,õ∑í˛Œ¯èU~∆°§T\hÆ£D´U”Ω3:ZVÊ∆ÄŸÈnmsˆáp	∆”÷^E"NN•lÊ“ßtÎ÷$j| 1∞à[∑T»≈úÌqy^èıP# /n˜§ªñû:ØèÎ0óüÙºÉi≤â¢hO˘Å<ÿEƒ÷7ö¶r›q4Æ®UK∏2(b|˛2\g>ΩfïÉ∏9ö0c◊˜ÙfÎ÷œ∏ÿ;π7 +W#Ê5†tﬁq`!üﬂ≤!ëØ»Í›;;a>®¡^•dè√‘‹'‘z´2#y2IKµ⁄µ2|T 	¿Jµ ãÔ¬“¢ÅÒ≤zãJö≤{√b±•éõ:+pÁ¶Ü∑)>∑uHë5·¢;q\{|Ø)A√‘†ß≤ù»ŒΩÊ&ﬁ=≤˚OŸ7#[}I}VJÜÕàT$ov<å“®‚úUÌôÂÄZéûÒ™(=ß◊(ƒ ©wΩS?Hè¢îÚàr(EÁºeˆÅ´ÅÑ˚PÆkÊU‡	‡ùÖYAn” ˘Y˘Ãp`ãºyÀ_Â˘;a(†º·ä%Ìç¥+Vﬁùy„˜ªbH kÆWìÛì˝B4ÄJiA†äëî÷π[ñ…"JŒÃw—2&™P ZŸÀÜ/¶∂#)îùl≤@‰…YrÔ~µ±Ú{G»Ifª¬˚œˆD≠ ”yle≥∆
RJâ„ù.L»ÑbÚÜ?{[.¬W⁄ÎsBΩx0¸õ)çoXcáÖ◊N≠ºp @JY{‚áV≥ÕÏπ⁄Ì∆Ωk‹•64√_#K ,ò∂«#~hmùqÔ¸ÌŒπ&‘X§LÎä’üãZı¸\mdªºüû{”0=.íA—• ˛&åÅ!Õ"ÎHÿõ=x∏‘K¶g∞JùµeÚdiYØâv*õ9ÃÏÙ¢8∏∆^x®YÓêwp˙	&Ò.º «$ç!ÉDÜh¡ﬁ¿›;4ÜQö`0πÎ#ìå†∂1,ü&É8`î˜Uªùƒ@E”$º!AíL—hñŒ.FKúzL±Ã<µ/1sÜW¶ûõÌ)/Õ(!F#ÏsÛVi∂">d—≥„◊mæ™A!TfŸ0kò∑ƒ5¥‘ıPÚïW#«?Y»ª<fåYN	©“¡Q¨ê’^!Ô9
v:k¶TI∆+IµN·˜ÆcøYQ≥Î.N≈ËYﬂj.ã*
»zΩ^÷~—~!Güº7eü{Ê7Nsukè3nË˜W€wÔä=˙:L2˚i¨0¶WÃtõùÏ√ìW“ò¥ó¿çòv⁄ßÌ•7˝∑≈ˆ¨#P;(¢≈û√(ºo÷ÚŸ±%¶°¥≠îaøãÕ!BH≤Î¶8K€˜≤°Èeã#≥}Áò°–î4≈T´´Êô∂Ós£—b≠ÃîÙ;FXjs≤‡HGÍΩ¸mYØä5éYÌ¥‹æáÿı˝ò&I±¶¯PZ[:pi5≥∏eHtdî ˜⁄kÚ@2•m&ûø∂¥óyçU¥h.Iˆ÷“^fπdi.¶^çu8¬7¨ß∏BÓ˙ùg\ÊñÁO)w–√2Ãoq ‚&¯‰,‡û^-˜,+Ì	 ,Y¸òaUGc9[ U≤i?}<Úó:7Áv»nhÀ†ò<\≠ƒ^∑æ“CôÂ7—%#ç,(ê+ö¸›‘¿ﬁ¸er’u"V≈˜
ö∏√çÜ<LÔ¯O¶‘`!3IHáˆ.z"å/„‚Ë
œŒ‡}ﬁÖFªüZ/ıQNµŸo~Ω˝Úﬂô„ˆWF]Ih˝ß”;s (∫ $k«K∆Cà÷¡"⁄V÷Üï™hBäÎ‰ëïÿ£€Qh˛äQ‘¸•ø¿_L√ê˘§.›¡76îÛ0ä‚Œjøﬂ'_ÈÉ#_í'z…§E|ì6ûá© B¯\*ãÔõC)!3,É5oùj™„‘ƒmFqÌ¢*ÉﬂX ˜¿z≈◊P*;•§JGáHÁ5Øµƒÿ,Û˛©°hÃ>KI9≥SIœXiô'b∆J»Ï‘P26*fßöå)#avÍi˝≤3c'^vf•^¨îÀŒl§KÅlŸQË$k©òﬂË@€Ñ®ap›îLÍô≥ÒåoíC
)îﬂRzç*Cí ≤?&·≥sîèBı‘í7“vHrÕ@‘|√dÇŸ¬r).;£b&äc§Ã®∞[ï&r†îm!®\öÇS∂hlﬂäˆE6)"∂ÇíÂ6<Ï¨æ:˚ëEœÖ®YÏSÙ˝Rp)}ø∞AÉix´hGYK¥ì…™µ˛&yì≤˛¥ôS^máπ$\Î1Q¬_ñı®}êÌh¶≥∆⁄b 	 ÇL„‚Ê≤t≠g[§∂Ñ*6púe|CÙV‹QvŒæcÜå¸ª,¿óöØ≠Iﬁ	©.oF)\J`^⁄e[|$¥- êº3Çˆ≤T¶≈ªÏ*S(ìo)"ÂbD¶{÷i“^Øá_©≤K[}'Ì≤)Â%'Í@w·…¨#òqí¡2£qö¸nóNËÂˆ≥Û∞ó∆ÉpÍ”§SXÜ%Ö7>1R‹⁄^9˝d†¨,_T—PóÒ§TƒWÂ4TÜ!s¬!GqGÍõhúbÿ&Ÿx^¢î÷R⁄tDﬁ¥ 7î¶‡M%	¶¥ÊÂƒWﬁ¢Bë)≠ä∑öÅår¥&È2ﬁö,SA¢©Uµ≈‘È5µ=À˙È>uYÉÍ
jõ⁄\a	è@•î«QTç˝PJJÚóh¢Í@ÎôÁDI≥√z(∆FXB˙Ì‹¿L"*âÈ$ÙÃFò”áÇUë˝Ùﬁô£¥±WÔÏÉ…ò¶˙ÏR%Ã.Ì$ô|ÕÏÇ4ø-æô3ã·ä:õ&óÊ‹@¶ìkØoAUùÉ™kÉ¶îﬂ¨Eæ·ºOu´ëDáù`∆J˘^ÆxÉ6Âlp’"ÂH⁄ã%3üÚªæD∞.µnJ)È€ÏE˘'Ÿ~ﬂÍ~∑Ñ˜ÔõBGvÁÇπ6≤z3´ŒèeÛ
®mó£∆‘⁄™™8µ‡õVÜq‰#∂*/V(•[™ºÕŸI_›Â|…sÊóFºK/ˇ°ÖD+0#‹ç-√	Wπø§£®DÀ˛G¡´Y"!5Éê»`“Ä°ã°Ñâ≤”ÛG…Ú∞
˘GÂeñ≥°Ñy ˚3¶ ¡
Æ2ˇë FÈ-ôóf8Ø†6¢ﬂåN≠ TÎ≠òà…•ïòy’WΩmÎ€õÀõSÜd‹_ñ¬[òß˘GmæÉQ©Øto"ˆﬂeÚFÅ†eRÑ…∑Ev]úD∏°.\πS∏R—fä6Ñ	Zq±ìÛŸ¯-˘n˜t©¿ºüÊ‘Äh≈ò^ùÚ£<Ù∞Â¯$ﬁ9Ø5‘D-≤ráñsyùº	7~ÀZ5„õJjœ 3itR÷]%)VEáYÈFÁeÑG˛KR»>ØÌaπ¨‰†yî√ÎHzŸ¿∆&Í%jÔïxXúhß‰8†ƒq (o∆r¸K=–epdÇùÄ»M|I˙u`ó
∑Uˇ
õ^0ÿy*ƒ5´"mˇ¡¿NØ=u≠føc√ã	oë'Ix‚\
ˇÃÏ:≥fÙeffÚõ§ıOˇd$◊k!6nÎGØ”M7Èv∂\xxÙ]ª°Ë;_âeáŸ0ÚONI¥}ZVnÈ“√Ÿß%'@Yêrn;æí«"„$h”yw<¢Ò µÍ˚A¬Ãk°—◊ÙZ¥Om˜"∆ÿ&Éº¢üWå9wâµ3*y∆i7ù…… öP¬i0¢…êÁvê%3…æ„ÓækM„dEPÈ(êıtb&ß¡y %fŒ.bs˘ãYÊ«˛zkÒ'>ôûçD©^r3êé]ç√»Ûè˜üÔûß»ÑYL«Ld-äÄÍÌdπ¡Ùµ5rÑOË 8øaÅê_âf¥ù”;£,„ì,nﬁÂq8åLÊÜƒØŸ =ÕVååõãÏu◊>Ï3:WèÃö›Œñô⁄ñÖ⁄„	©ƒ† ÇD}=—¥√à≤?YˆZ‹≥[VÇP©65Ä‘ëjË‚x/˘SÔpg∆úÛ«∆6»¶si*\^˘[+ŸiGTÄqäBá§soR—°±bÖ´∞äkµÏâhŸÕ**÷åº™m,'Ò|~6GqÀBn)K¢	´ãeãÃ2"Tf°E)«∂ï∑éQˆ<gMóàÌ≠ﬁa˛ﬁ±·”x\lÖ±ñfOm	∏ÕV≥ÄıƒÚ“hµ<˜¥Ω’¬*(∑≠e∑u»§Õñ¶ã+ëΩ/R—ÏÙ™˚[qd˜§‘¢TÛ[ïÛ≤3»dßï'¥cÖ∞˘$p”3π'ƒ~˘R<À†π◊•∫◊ÜÖµdSÕßè¢´åë4“¡7l∏ÅÆΩYÀ∑Bl,`óP1d¡>Àƒìö2Û´‘å©.%HÅ#I¶≤Ä&˜Ç≥¡§wÂ°ÄGüÃ˙ØÇö‘†5V	Më"é¶≈ËVÍ#õ“ú°›|4À÷óÿ-kÆ~∂`>À‰Aﬂtê—ß†x»©¬;¬"ë,™pUxßã∞hz@±oõBLkóÕ%¨⁄9Èf¶xˆÿ+´ãäΩí«ã∏Èbàáôc±¯õòãíádYáóÂ1Yx‡ña˜ÕìµÀ·[s V‹Æ|Iæ°ñ˛r≈‚AÎÁÖîd¡¿!ì≥“R÷^eä+∆2y†∆2±ßà+œûWT˘U∏z(áádÿ}Xô%Æ.b¥S˛∏˙erJ	c	ª^,<√únºC⁄,V≤ÅXÊKf6X¿+‰/ˇÚßˇ¯”ˇ˝óˇÂß¸È?ëü˛øü˛Ò/ˇÎOˇ ˇáˇ|˘˘ü˙OãÀg›ü\≥ ∏ìõnø4Á†áù÷b§∂†sÊå˚v˜Ä<?›E©≤√lÎ¢ªD8/¶∆ªNÃêG<ùlŸtDF)Æì√Ñ^ùüL<enxLœiL«T†8£ rdRvÊ¨ÛŒÑDBjò Á}¡Æê`ÃVÂÔgQÙ>©Œ˝TôQØ2fo˘ß∫¿f§˜h+¶"$Uñ ∑2$ïäyÖQú4Œzﬂë´‡V˙õ),yÅ“fÇõeê ƒ.,”EÏ˘Hu”®≥∂≤t•è`-"{Ú≠ä‘™Ú.ªê¨x:K≈öå6ŸﬂËeﬁ§≠>∑ß	±ƒŒgc\@≠$;Îj}ÇÅÁAHO°"÷"÷ı{∑>Ö*C[|ﬂE¸'∂ÛŸÜ√…>πI`åuÆˆª=ÈÀÍ*"m#(ïÇ·Z€«86%{ ‡#$∏∫ÃNíﬂ!-#
ZF‡Î£™UaíÍÙg´H2öŸ–Í»§ö=`°éÎÛ∏6∏T5Qmam√(8€jqÖ>∆àŒ$ÛB Ã§øÀDH7êUÏızıÅﬂEÏ®¢Ω@=]PÓuXh•Yx/|,!æÆ1ÑÊ©+…~¡Œ»ZE@=ãGçﬂUÔK‡∂~ı¬›+ù ù'\7ÆP•ÒæïÂUüÃ∏üıV)Ûˆ‚\÷·≈Rÿa Ç=†Ø˘∞p•¢œ%õØH˛µæAá|ü9ê‚"PëVkª€%åfb‡0¬=
Ó‹övoBâóŒ-ën◊-÷>≈πΩkπ]ZÈÜø€ÃÁ÷¢))öiqÛ¶í<ZŸuÃü$ÑèB^¥eS§ë5^,ô4è€{3ÆL‡ËËÌ£÷mÛnõÕ#MƒTfv¬Y™¥Wo7è7“|‘k}sL[ÔÃfô‹í∆£ÈË9aê˚¡Eê&õdÕ9µKA‡U˜h±9x›)w'˛lñUÓË;Úõ€@¯6˛ô‹2¿ª„YçŸÔêwùœ≥üw¬WÀ≤¥É∞†wpt5/ö£àyÓµ-Q–K'Ê|®Òq¡≤µ9~´‚=ÚM˘∆*NË•Ñ/öQëÁ}7∆ßöT|¿H≈2yvjQ”€∫µuΩ®±ïrÉLom€\8÷Å‹u&u52W5i®æ≈,5∞®∆"	õ‹i¶ÀÔ1ù†©Ö˚
“Çã«2F⁄!åmeÿœ«F∞⁄ZzÉdieÀ◊∫:Ç≤”A`ë>ùc¿áª¿CÄh∫Êò–ÃÚ!/Çyåé_‘.VOx¢èB˜EB1⁄Ö˜Œ¿é$X‡…Ëy	íüøL¨aÒu˛åG}hmÛˇí≤;¿P˚nîô—÷.3>Ä∆ƒ(ı{Ür¸ôZ€èΩÛ`ˇ3S¬†î˝Yﬂ–L!¡´h¿Ã∞S
Õæ»¨∑·Æ5qâó YA˙≠ß£≠ïzó»Tgƒ3	§KÑ—z®†¿ç‹ïb0&±-¨˚3fEõŸãÆ·S[-·≠¯VG∑'#Mƒ´ëÒÎç„.(ü’+A˚OfÿÕuƒ˙ÖÖ¸çe¬F“\"›L ù…ûùEÕ’V€≥àùÀ.ûíêI |fê.‰˛©%ÀÒôO˝q¬7ﬂ˜ ‡åüPÛ@µ˜¨˚≥PÎ¯¸,†˙œ
@{“œ√S,›îrÁ≈YÒ£ıµGOz´Û#„\0{ØP.˝'^ú–Áa‰•¶¬êIÉ¸üÅ¶x=ûìŒ+F¿{·} ˇ<4H£Ötôî|µø±¸¯…„ﬁ„NDyE{öŒx˛ÓÑDÆNX?Ï”‘¬Eà˙◊jE˝ÿ725‹˚¨s'É¬`ˆ∏∂l…Yû‘Ä≥‰õY«S≤N>æíç„Ÿ4y:Î
ﬁÚÄΩÅ±”âpµ >R@Ä±	Ksõ:ï†·:3a'©>ıÖ‘Ωﬁ´«Œ=3ôohxœY%©‚GÁJJÏ6}®çõ¥pm∂|5ÕPwjå∂v€©ˆ¸¶,˜&5ù◊xÂ∂ïÃxDJ7µΩ¶≤®
{ˆc˚ñ;¶° ùÌÍ€O_míœ˘ãL„ÓÆ"Ø s»ÜT´˚f•ÓﬂäP"Nò/È†˘kz$Ä˙Ÿä	øÁÊ$ìÅp±Ñíz¨O›ß·Ö8µÍWN°úuLÿﬂ‚ä¸ï*¡q|õ†£fIB1+jË7†J≤5œƒ‹Ÿ‚ˇl‰»}s`˘ú˘)%ÃÇâ&ÔÔÌ°R+Ñó…LX≈)∑P¨¢ƒº˝Ñ∞ Ã∏ühÕ›Œ¨itY·cÉ/v]°k“·æ·cá•>M¡i÷;
üè˝û¬ßæ˘‡†!ùŸWöçñÁ;6;Ähi<ÓH≤ ÷ü†ÃuíœÖJÜx»7ÌÕ+rÌ3∑Òr’]≤ºº9qÚAÌÖ*∑BY›s¯ßˇ¸”?¸Ù‰ßˇÎßˇ¬\Öˇë¸ÙˇÚ?¡œˇ˜ßˇ?ˇ)úà…óõYkûTA	ñ{À∂∂π?√ôª€DƒÔÉû¢+Õ´Ã¡sÃ}Oô„·UÏM¯IFgï∑‰≠\ê3±|§ÀdrË_;∞≤¬∂ˆƒ1€¨GZJuBä˚⁄ÚïrlÔùœ∞á[◊îÇí¯kïhÓπô«Æè œpØ8Èf>ÂeHO¥U‚π^HˇÛ’¸∏Èi‹ª∫*N„$äªì(`ºFa¢ƒX>≤±zÏ–‘â™“π„S&å®Ñ{úø{Y~«—U≤uªV>∫¢!£º|]	á±7¶≈™º60'”$5πâ≠Ë ¶JœÀOŒ†—rüW]πª"¢ÄMˆDd_\∆ë —˚\∫öØõãëπìO∫öBﬁ÷ç¢•ÃÓ^^ŸíÏlHôÛ˘ìÊŒÁµ2Åch)ÁyûA ≈˛ÀXœ‡Ïæ«XLãÅîLæx0j56∂˝P©ùˆe‰”Mß!éW˜º˜1.TßÕÍ⁄çÆ‹€¡∏£ƒiY’nBÌŒk-≥ ›ÿSâﬁ»…éÈCŸE»Û[ëlí<nìM£«µjÊQó0`‡Ò›;á„AÿÀ£◊ó=ıó*+ı·∑ñ¿˛põ+˙˚¯∑WD?ôû1Äúswgî¥7≥BÆˆƒoQ#T~ô∏ﬁ÷˝º∂B˜ƒl‚ì]∆Ùò%]ÕÊ›óô]}Ò$•ì≠Vø◊_m(á*3yÛÿﬁ51∏dY	jlÔ‹4˝•â:óZè≤«A°Ì	6Ób≥‹DM1£”¨lz!Z‘H=*%"U7ÎÅJ$¨pÂt'CÕÎ}ç)~Ç4«…9]∆K¯Z∞∂„(≈ã!∫¢~=¸÷‡Ú:Í±(ç[+öñàG4%WQ¸û¨êã(Ú~n»ÖÉC1EâK0≤Jú+¯ï_ }5M'2FLbﬂŒFØˇ€•_÷Ó¬5o„⁄<È*‚∫π~*Û^u‚™à.«≤£ì∆ßtQGêÖ‹œı¯Ú¿ƒÃYcŒ√«)u3ï¿G|3∆‹ï≈ƒÁkLhŒïù√
):_¬O„$.“'¡Û…QCf^¥@	ö·g£ÜŒ¥‹=§J*®°åQÕ∞®‡Uì—Ld—„èê, &™‡éTÛ ’¿ÅêÒÙ—üe∆]p–÷*YÛ(B6}ó	}›ÏÒÎ≤0h1æ5ô§›uπë©æ£ÂA©k£ÕjBá†¥S0îo~ëÑÄI^Ò–„p¥ò∞ÊAùK—∏jÙÿµMÉ÷ÚYï¿Eï\e·+ÃÂcj)›~Ê%(ñ¸B9Ò∆:?—•_•kŒi∏lïs‘”D|oD—Ám]Èÿ8ÊﬁêﬁÔÒ¿ΩŒ$˛æ¸,Åb%P≠Zˇπ!Çe™X @dàV◊B?öFæ¸K∂ø≤÷H¡s≤/2eÃ_ê¨ë„˝Á≥AàÂñ1^)?Åö¬Ùz≈©†„éiöﬁÏy…HF“un…Dæ[&2„≤HKÇˇÂ»mô–—$ån(M»ù®í∑˝FâjìÎ©ﬂÚ<—ëáíë`”¨{3ÁáàCX$SÂH–ü≈Ê|ícÍÔ¶©7‚ùÓVä€π⁄Jz5-ym`ZO9QÌ„ùôw§tÍ3gJÁ¡≠∆ÙäE`ıO^â™PqRhü∂ó0›®VSL^DÒMqNzûÙ∂=«™ëmQ>∏û–qb¶JèÈßò)ˇô•7ó∂°“ë¥q]ç/ ï∞/ñ=´ÇüzÿqÉõ*ò)¬K"=ÎíñÚKmì∞su¿˛TO’”◊,-Â”Ñm(Üî¬ˇnownçfŒÉê"¸ö%ÚÜ˙«”oN_æ`oBFow∆ÄÛ+&\‚<4Ùü©Íõd]Ì±˙l¯'ŸO1®)xîä∏>«q4ö§YÂ¸U]p'LGﬁÕp“©˙F[¬[‡˚M"qå≤_„ä‚ÃlÛõN•”ògöÇNæU^hCl∑ıöAr2∆cæg,ë¯Yª2PéÅ_˘Kõêπ1n•N`T£,I¥H7
Û~M·‡Ù¯áÉKdã
[mMçFH¸ùÏÙ Ø‰XN§´√∞…2ŸeˆM[3£ñ:Wu#)¶Êí9åìi»R©≤d[Ë'ÖÜ≈pÓ6êb÷Æœx≈≤Ï◊m)∂“!≤]àT˘ÄZœΩ S…"ëG4ê∆<#<|_f∂Où3!¥ìA•6	ú‚%˛`©MﬂHÛt¶rLœnX∫»¸53‡2ﬁ*xôÀôäΩË«“‹∂<≥W[s{i˚
Öz#X<ò6Kh_U‹µñsñ/	O’yæ‘c±çœÉxÑì⁄˚ÿ@~<l…vU$‡î¥ñì¶7—4fŸ≤˘5œû´a9˚ë2ˆ«\Ü∆áŒÂ‘M‡öùªs
–i≠xì`ÂÇbÑÍ`0Bu7¶
tDkŸr∆F4FpI∑é_ùúZ‰bCñ^,Ÿ,e∂`SLœÇ«£Õxû6àñïüWÏ‰,ÚÅ"˘ÎìWG=éTÅ∑(qÿßU€í{ióÈ…£kV¡˜ˆúÑj1RŒU2¥LA◊Z›©Üﬂ"fÉ,∑GÓ≥LÓò$>‰E¢˜6làπâ·ËæL.†QÂ–‚UE‰•ªE “G	MæñúÌ ì@wpò%≤‚lYUû3ë	ˇf…Z(0î}$Yãÿk/	1±Bô¨ÆıeÆRl˚›7ßß«"?˚Á∑Ÿjâ`°ÔÏÉ≈ïÂÕÎÈN{¡xNÅƒÓ¥ü~ÊG‹u2LG·v{)üHy,⁄.` Î§$ByÔ)I¶1ÂH)°1∞Ù$HH<exÅ†jfÄhÒ
·ü1lkﬁÙHÁ;dÛ}z)k¡`2CE≤≠øÑÚÎ˝ıïç~…läõR{„Ú9nTÌ'¬%‹jû^»v>O´]gÂ∞R «<xÜÒNı“|MX
"±f`”yˆÏ©H(ò˜Zfé~JÍjBﬁ XôRﬂH"ß6âF‡ZJ
¢°Æ`∆ç·Pz‚≥œù„≥ﬂ’Õhl"k  P|—“¨ïu”Ú«ÂÿÎ9/X√‰Ù¥Ê0®ªv©ˇ√ké"¯¸÷çMøÎM∆Ç°cå$˜6ØÅí,≤ef¬UAêsÜ⁄YñU¸b!UR.“âπ›±¿ê—`0çç\ëcHdÎÃë‡kF ÃOﬁâ:Im¯ VY„[YÈb9·i±UH˙QÃ›´3“UŸK:t•µ++‰eÜŸÂ	 ¨é§,ø°’£Çænâƒ⁄çç"∆∫ØàÍZ…qy`õ“‡5rÄV+ƒBóä´ Ìà{4äy -<ú∞Û¬ÒdÜUIëqPJ9ú!ß„bXôa8…ºO‰ßm®y{ßœ‚≥‹◊Vàﬁ2v"k.˚Ñp∞'ˇÜ≠√X÷Ï Ü5‡tµı∂M ß[§Ø6+^C£¬¨`Ñ90œ(πà©áÏJ
S'¢q§4,c&±¸éâîïà'∆µ±ì∆Ãï6†ÇÚ≥Ñ°R÷CÙ£tÕ(&¶?”œ€ØÂ≈{$ŒÄ‚í1t©.Fµ…„Å@	1`ƒN‡5¢q…
+74NÁ’
,{ÔÈM“…F∫$rGëm\˘2Õã◊1ÇŸü2â∏òæ®®√-s‡ÇÒÉ*W+kyáºi≥§™î†àUƒ¬°q{ô¥˜$açv˝KT‡ªgﬁ¯=˘=†q?ﬁ"ƒW¬	]Tg˜\˚m÷¡&t|JCPç/ÈçlIÙä‚,Xﬂ‡À$5_"4ÄÌÒÕ±«|O0h˘9PZÏd^”âƒËjÉYnÄdøù-´∑ñ¨˚°ô¨˚Õ3é™”D˝©˚ÊQˇ-)⁄∑?E8«°pàT«[∑∑$öxÉ ΩA¡:ﬁô!P˝ﬁìáÀ^≠nÿlcº1ê,)’*ØfïWYÕæ≠bUVqÊJ∆Uty*qû[~g√áÅÔ”q©óÉ÷eQ’Öˇ"F Ò$B+∫&Ÿƒ•ûr£"mx≠/∫ÍoX·17∑?VSÔ´+f]4‘låÿ¿xeî@πÛ›…®¢z7µ·Zy⁄n√V‚âìiÌm¶Ó ”s£Æóg%#/®X—ÌPºñOu.æ√µŸ»ÌáÚxIöí:ZîÕﬂ)ısÃ’åÅÊ!6=$s°] \eã*tÿî` |)Œëeë~OÈnóäπîX$-$Otfí3kíh√ ¨43¥›¡ä'âûW;o‰å^gß˛]`ﬁËÇ¸"mj7Úvﬂ∏æÕ‡∑ô äâF›dGaxÊïÖ∏@Ñ«Y≤{HòÃÓ6∏ù£ëYR3Ñ∞¡≤Qc?∏àD“5FY!!5´î·H´¡ôı¢ìXîùq,B1K ,(2IΩ8≠MCaﬂúµÆJ¯døiêË∆ÈÿC√ì0ò45˝`µ´Òêª√0ÜÎÂ˛–œˆ2sô÷6¿ñ ¬>ƒÄJ◊F`±π,D"…Ú•&◊DIQ0ô#8@:¶»ùzLl6	)≤©ZÊkÅJ{ïvôÚπu◊q-ë/æpçïi@Li∞<3›-	ÆávR´‹µ¥œ]$,Æ‰Fâ
Xftj,r7£˘lîE*a`tuQÇ˙pvc= ˘xÎºÊn±õŒ>µ—Dg§ƒ>Wá∏ëxp)oL[π:úUwEÀg.Oi7ˇ&∞≤ßëd¨qCúT«1≤r=úÕ"X≥Ç|¿O˜öv¢2“(ªk,vêy ùæHß‹£Fè∞ìõÕ:Ÿ>"r°Ø‰„pdÆá≈¿†NXD‘>∆+†Ê7à8Q$ëë;yùqKòï ¶9¶é=˛â¸?Ôé˝8
¸ï†ó“$ÌåΩÀ‡¬K£∏7Mhº{ÅßŒ=˝{÷\fÓ≤Â“—7ì9œ–T≥cL(\L∆ØôóôÜï=}`Ñ°ƒÕÕqÜ|˘ÀE|cfEßH).i4rdÊFµeÅ€ßìt´≈îÑ+_∫8Êûo›™◊]# „‚5'D&º˛Lìø˘|∞>Üxd∂Zt|ƒ—ÖøéÎÆc®OeÂgwûôåV≥=EF:wÙ(ƒ\À¢yÈÖ¶øá00c]D¯¸”ﬂˇ˚ˇˆ_ˇNÖ«s˘“,›ïGÅg2ÊzÅ†Í9QNÉû%∞Z™\íY6NÄ\ùU‘¡€∫«7âx`N¶b)Î"ì∫D…6BUN^¥ p dâ+•¢ˆ¨Ôa çË®«h¯:8%.M
5‡Ì¬sù∏;3Ãíˆ–%N:y¡
˙a6ü,7øgã“R.≤3°∏c∆‰ <Ÿr"©>ù˚Ÿ$-C
^ç?q	Ç4w@∞ßß@~cÜ)tAõEêâœ±w√lù^M1ôÅXt“È~2a„u®•í¸◊3}gZ¨ÒÏGZÂ±~Èß˙€ôî¯0˝Ï·ò'¡·∆1ùØÊ=–$R`uÚA|X‡Ö‰a©âgäôSü+ÁÉ“q¯ò´Ÿ2ó¯8∆Ïcäaâ/ÈΩ‰:qÀ5çè˜k.:ÈÑ?k>i|ÏQØÑ¥á+‹ÚãöYgñ*£V´j[ÆÉÀ¬WØ™?dÙ®/}†ï«V c;¸órfœséÛjÍ
Ω≥$
ß £‹ﬁÌ¶€'»ú√&!ÉÂ‚Ì/n¯.E˜–Ñ£-'ÛÛ ¡¯:q‘i¬"’œ√!÷4+◊?πf«áG Û∆7≥!¥fMÒô)éi9
î.˚<Ωa!ºó+©ãèbçÕ[m¢É√¨0÷ñ#5mµÎ∑µu æÒôÅ «'ª!¬ÓÍôƒU˜D5°˛aØ˜Ø⁄∆3™‹à≈™çNÊV∞Â[ÄÒêdïÜ£eè„Â=CD‚˘M~nıEr2D©1øQRÇà¥º—{ª´5§©XπyímJ?ÖÓ¶p¬rΩf…CíÈ≈s √≤=Û|¯ΩhiÎìQ±ˆ>8°¨"„‹ÿRJì¸˘I
	*ôÉâh÷¶©*Bgñ≤Ø;óÀ|6ÿdüH ◊üÖ¥xr
ïµﬂ⁄UYÚ≤∏<¶•˛BTΩ•D;Æ7tçï-»ÌnÆ^±öª∏·Ï∆ù}Z∑Æy^?¸}[sœ™˜Îm•wVã'≠–úå8~√ ld,b.˙
-+^A7nüG∑ áSqo„≈Ôù~±Äú5w>©òhZw˘÷pœb)Ò`_›R∫ªäœÒ·)ﬂΩ‘ç@j&p«g&°;>N¯ódFf§)≤S∆µP§'üèÇ!±Â¿˘ES£\•c+Å6g˚„S∏D^Äç∂àKˇ•´ÉäÑ◊LÛw9?>jH‰ºÂ“ÜoÃÍπ7©â€¡v”…ïÂH‰-|4"~;:œ‘ìøi°1Ø∆s’vlí∑aëâßXå≈E&òÁ±õZ~—wK¶âzˆL©uxigƒ¬rä}l·Æµ∂ˇ˚ø˚◊ˇÖWOW¯Á∆Ìºb/ÿ“ˇˆØˇAæÜ∫Únfnìyã3U÷9r€ˇ˝ﬂ˝› ⁄ªô[ﬁ¢ﬂ~k˚ü˛Ìˇéd¸ß<K≥∑Í≈>[Àˇ,¢=ØÏ”≥ }€cﬂ≠Q‡rŸ)úO?Ú"Ä5J#rÃ„¢˛bpûúõ_Á[O/\Ñ≤ÑØzΩ
¿D~Y‰ŸE‚=%úÌØ»Ô^ë÷Û/…◊tå÷ §si0∂‰é	nellë¨\â∏ÂDô…ÅÒt‰Ω¿øì∞∆~ Ó˚?°ìrªw_ûòÇ≈'Ÿ!ÔHÁsÌ››j∑Ô‹'PEŒ±∫b¶äO•‚ﬂ˝ 9Éß˛ nFñ 	◊ÅàƒL:pT»w—t0§Ò29£ˇ4˘Çú≤†O#V≈‚5ï?`nŒ%	!f≤@-‚ƒ≤$ª&Ñ≥≈eß®Ì6≤¨`ÓÇ≥Ë⁄!U+äyq>À√Â±∞Ô)ãÌìa91Ñ&,∏äGsºW ØÍ©ã2_ıîÜØ{å(ËÓ≤W¡Ccß*ÿ9NR8≠Ï*O≈yVÄ7˝∑KÄ©‘ﬂÄ°0‹öªD‰cÿÍl¶;ŸüÄüŸÚ¸É"“ú*l}∞0¿sLeª˜ KıÚ˝F‘åÙã◊0ÚMÄÛPß6TCö=VˆËí≠›9–¬£~çOµÿª-ÔCºORÔ¸m´≥këÂÎ‡Bqdkâ≈Ã…ÓS{5qì¬z\å=V·µàY∂TYß.	Ω†∑À9ÀÌS≠¶ì*Æpå∑ Éú{>=ªÿ8ÕÃˆd-,ñ˝!g∞—Ô[€\Û-6Ì%Es'&ñ£G>&G£Ï	ÉEZC∏D0õâJêœÃVJ¯[áç˙8TÉSrøTÚÊ®y˝˘œ‰Õ€•ﬁy0ˆ;ùÎú¢øFåèãì†Å\ü‹d¯Ãtõ·£ﬁh˘$ö∑ì]Yî›*tˆã
Ì≤≤¥ÿ®¡F∫|Í£Ñ∫<3Fuy‹œñ£Rü
i¡/[V ü!tLŸA∑KˆÜQò=ªZª]wé[>∑Eî√d¥©¡(ì%PUñ¿~l√ò@ì¨Ò˝∆RÙi˚ÆÅ‘C>u¬ÉldµBÑºdµòS>÷ã€Îœ Ó3µ|—opˆPPÂ·—≤¥õu—µπ¢§D&âì4‹3ﬁ§Jƒ[fs ˘4WÙÀgfÖø|fΩù- –„‚„ãœR„Ô?Ô‰≤Zhª)wﬂ(|p‚¡√÷qÆTkÎ—Ö™‚⁄YLó,Ò˝∏¨À’±Ø'ªå˚a¿gÊºã∂ßp≤`£›èT¶2otöE¨#û3 }rC∏tØ—q∂`4◊pw¯–Zk‡°>J èÊï80∂›Kæ˙]-Æ™¡«≤¨&ıô¯ÁÕú!≤á˘‰ºNáŒàŸHúì®5ydt∑Y®]}d1¿º≈¬5b4ì◊ÏÖk@'€√õÏEÏdb∆òb4˝YûÒ_Ê33?V_!Õ§Xë∞ŒKd&¬Öw≈3ë @0"qÆˆ≥8ZÂπ°ˇ≥õ‡&˚˙Ö-ïüÛP◊jx…7º™∏Ë©Ò†0ÔÄ˝¬Pm•ñÀJ%§ãt¬ﬂ∞ƒ9√`®èÕòBÚcf[ßFE´$p&— WÎ´4h∂Õ∂kêƒŸ|r6»vû— R§f9·§Ü†qò›¥âÒ• 7QÚ
Na\-ã‚§>ÂÀtø<`e4ÏIÒ8¨¢i)«¬Ÿ	·ë≈◊Y0Ó>I¯O«®†hJfVŒ∂ÖËÄ€Ó}∑ﬂ¯pU6bºZÙ1≠ø«ﬂ‰÷vÕ˘¬ÏU¸¸¸ ŒOiM'ß%m¥ÓßÇˇ9y;ïÀ:≠©≤K”c#≠03cl˜(3BØ∞wè˚ä	TvÁ» vhÌÆŸ∫[C⁄m$ê¸ÙÖﬁ‡}®˜ƒÚæ¶#5£Æg`N›JÄ €KB˘_bØSc.î£yé)WòÓíªá>ª!ù=)Ωˇ’=‘X∫jUÛ~4ébXMë˛J,£ëÚjEæ'ªIËΩVa‹ƒµT4˛!<KyWü≤ciu5óòÜ÷íÃœåı´”eÕc@ÚßÏs˘˚!À;~∞tCäIja+í¬|-ˇˆ9$_≥!bQñ˘13f√Às„±∫ÛQÔ4˜¿¨ª§ÒÆÚ
÷rƒ—’kzNc:Ñ¶˚Ø£´_L®VeZÍl≥%Ë∞Ï¶∏«˚œÀmÂu’I#6◊¥ÕZ”j[€ïçÇCúÖ≤“4hµÜÖöŒ: ≤Qv}¡a∞ÎãEw©Ã-≠û+Ót#iÙb§œ≥Hõ&]^ê4˘Á∂ﬁÒÓC.lÊ¢ûM‹Ã√πÒŒÕ,—ù€µFÏ†ƒÎ —qùM#>&Vïπ!§y£´1‚ÏR'AˆENô˘üâº)≥ ˛¬¶,ØWπ§©òµΩ≈ÔzÍˇ owÃÛæÚADMN€É—,≤’k∂vH :Ë’ w9knÿ¬⁄±¨_èÂ
L0ÔpßÌ√∑ÕvÉoÍ3ãƒM>≥Kﬁ‰3∑)ç|¯çzå·ÑÅ∑ÈE:ûGSã;45èh¢'©®ﬁU÷y˜48èÒ$Ò`´ıπmÉÔZÑ·òk´G7Io¬åJ›Ïˇé§—dàÒﬂ±–ï¸Ø≥ˆbƒˇéÉã°xy:‹Ã˜€ﬂë!eÔŸèí4∫Bùb@¢€OW¯–∂ﬂÕ£ËlÍsc{ºê∆ißuMÄˆ‰∂‰‘Ôë„ê"ØA«ﬁ–mˆ5Aß <g ùﬂkÕ3ÅŸî™≥USpPMí≈Ç4»HƒñøC¡AQ*,´Í§¬πΩïM*\T>6?˚ÕıÅ¯<=∏°F6%ñ˘ˆAEÊ€∫1ss§ŸH˛,üÜÍÄY1Û|Xπ°Nƒ3¥!&—=ãü9EÖ™ƒv(ö©JÓÎPÃ†oˇ€EÆÖi®!ozØ"w(ÜäÆ≈› %3:ôYFÇO©QµÉÕ…M—€z{«ù∞Ÿu<P{hÑøvÜ;ìÚñ,ò[jñ§¿w!5 ≈d?ˆ.òtÖ|Cc7oß∂πÛDg—¡•#IÉ9}ΩL˛˙ò˝s ˇrπ'¢Êπ⁄˘l± A∑u?syÒ˚Ñ¨ê#/éô•/Ÿß@ó‹˘„SoÁ3 g)˛öC~çCbÍUãt	%Ú5m§J´ 'ë7Ÿ8¬ÀΩ•ìQ?òé>å:måª√Óõ'xÚÏ;1MÇ?Òæ™—±ñ˚ò+®Ä≠Û/`¬„(•	û˙dB¡y0¿|éB'¬√ˆ'»´z„ÿìÚnfTF}+rú¿~ÀÛö£I¬)û€ß|&Ì3Î|McÇΩœ£YZ†é\çCÓv »MÑﬁ·9◊[û Ô{?.sf%‡cbÑ∫<ˆ3Ë›+êEﬁõâ+õËÚ„A#UFöÍC\Ú∫>K˙Ä'`ó+^πÁ]BûGQZr∏ã	S7à%`h™Ø/≤MÂ|‘[1 ∂9‘¶<w„y3ﬁ˛¿–·]yãÍØªÓ`d±ïPUT£¸ín&/§›'Â)≠]xÕr¸ƒg_JU\›¢7B‰	‹p2=©ÛÜ<4˝Vg∑Ø{ÊJËºÓº™¯=r„˘+¬πN§&ö´Ò[àå”¯Ü©ùx@0*ñ%(∏|À,x·È (¬∂zE‘¿„ñyatA^¡,CÔ¶¸6FW∏@§å&%fm’JpHÜßZÍÁË‚âpàÄ+‹è£	ÓFåkZÎzÒ'T<ıﬂ2˚ã∫ƒ #èBﬁ¨≈tÑm=îLÙ»ªÓñ&ODcY±˝k◊πZ≥~ ∂¡®˘&3©Œ‰√T…ï «åUπ≠•X À’¿9çŒúú∏ÀêL6P+p—Ó=>(¨÷í}äy≤~3∑∂3
È{A!=]>®È¶òjFóFlπwa∆ia∆à¸õá≈t p≥Sô~¶Œ‘≤åä^Ä!.[ºB:IMŸ≈(ƒNi¸è∂Íá¥ëÅ£Üùcñ
B2fÒ!	Iı[•~3£P|4∫|*+’  ÿ»*Foö˘ÊQÂWõÖ2edÁöFÉ"Ÿ«†ZøÁ¨ª¶iÙö’¥§!ƒ3§&hCó‡µÙâ|>L^ÂÌ≤Ïú{a‚jﬂµOÈh¬LÖŒéu•I⁄!ûΩ◊ÙºTJL1/ùÌ≠`∞∂Ä≈[pÆÊ,æÉŒ´≈º·¨˙>J(ØJ€‹DÒ‚ís™î8ñO£ﬂ˜åôm˚yèp¡w«˛…¿´ëÍ·SæEÜFY•ë-‘µÀÊ4£ïÂ„∞M|ﬁÚÊ<Áv’ã≠^õ˛ö∑AÇC#I0/ù¸»§ìÎ;Îçê`^S	ÊJûRíy“}úm˝ÉÎP•É3öπbP,πÖù®ñ‡’ê~æ¬¨íC¸G4∑^lWJ$ä¥.ªo•y_2	∆ïDÎ”Z˝âç\Õ.g±ZN~µ∂øJsê›CÚjÔı}ê∞ò.H:49F¯dn¿œ1≥mXü0æ£gÖ ⁄ß©Ñ	6≥µsú%‰;˜<th-9K/ÄÅÁˆº	 jbœ(°ä}√I÷≤∏†Ì¯eF¨]®äL»√ıe2
FuÁÖ{¸ñØÒ&QŸdˇV&z2	÷F“€ro™Í&çßUÙV Ñ«¬÷—+∂Ö∑ó∂ê+`ë*†Õ›˝ÓØ˛ä^O¢8Ç">ıÖ¸À»˜B4öøxgo≤d…2l9J`ñâ.ìiÁ‡.Õ≈˜ù∑˝&q+“Ô∑–:‘¬¸m¥cíè,B#Ô◊43å)¿⁄ÿXp¸‰Pﬂ4—:/dÄá-äe^‚€¿∑UÑ◊ÂusÅ}VOST‘1∫Àﬂ⁄j*∂ı˘vÛïLô^à<9[ÏxááÿÑV¯/¸Wæi≥@¥
©+WZ«8¥ó^:Ï!Øç:KΩ4:aûùóz…Ù,I„Œ⁄2y≤§è3	é¢b¥Pú€&sÙÿG@¿÷O^â°πI§ùˆi{ÈMˇ≠^3_F¡ÄÚ<’≈ÜœÇ0‹W’ØfÅ<áBÒêiÙEƒΩsä_Ø¢¯}e”p=LΩpW‰ßÓÎ/Ω¥‰K••µîL!fo*pÁ;^VÜ¡ñÿ};@)†[ﬁú
©Fk98rXB‰≠†NùÛiäP%ÄgÄ◊⁄Z[Zóò‰K“Ôı7~g|gk'J|Ö•Û∫ Mõá¶´ÿBhµt·œämd?Ú®¸N¨à8b˘≠]K˘2zâypX©ﬁb˜ßuJÚi.˘.“∂noI4ÒAzÉ∞IòF ˛Í=ŸX&j≠oªè©U^Õ*Ø≤ö÷ä’ÇÈﬁM+d∂&°∆»•aÓê.˜ï3®k÷†ŒhY®ØÇJÔqf\¢∆´
`xDV$‰p≠@œ‚lÌ§Ù.»‚tä÷ÌËœØ‘´¯AvÛì,˛ ò]ﬂ/ºøb{≠bdEB;'∞5ä_òüp2õÁzïcÑ49£∞s•¥t-$Ö¶∂ër6^á-\LÉO7$æäÒlÆÕÃ5‘€¶˘)ü2””Zmî ÊzÑıa˜Õ√˛ÂmÓ7]E:2∞F÷≈µi?6¡˚…aÔ(∫/yª´∏]	t-2;ßòïÏ#ïû/N&˛s#∞˜ ãHi5áE¨µHX‰t˙Ø∞Xˆ˘#É≈g¿˝¨râ¸Ê£¡êœ∂H4ò¡_·¥¸”,îA}ÊèÌ Ï1Ó˛^ıÒç°_…⁄∏@–WÂø¬}ŸÁè<OêÈê¶è@U±◊b	YUúˆ+êñrBŒ.¿{_Ä+≈yNÊz£óîÀ3¶[˛©ñ?‡´¡fN#MmÖ‰πê›ÚÕìπ.˚Ò}%>ÆÚµÆŒUÙ©úL$˘Uø¿Íåc_C˚≤®C\PÍ¸BèÚ>i(˛>äﬂ7≈Ÿ<6E‹¢†¨†ﬂ˚§°L˙`>∆MΩWê≥ãìe4H9æï›™ﬁ±¬J≠V:)˛‹ƒ<„√‹wôÆê0Ãı~˜@—s›hsö^Ud6¶Èã∫⁄±òf·Û”™˜XÕë∞Èπ>:Çû}˛» ıª›S“Ÿ¯m=…n|È¶Y‚	 C\ç÷ÊkûÈﬂ{iÑúeH•…»\¡Í?±˝<eFMPé√ûÊù8@~j3SÊf°Ès;â∂ãÇ≠& z`„«^ñ˛≥∆{∑Z[ùÁÇdæùÎÓ€kußN≥g/	Ã‹⁄Êcö”ˇµëß7Èn3ZØï∑+åó°·züï6¨-¨OÂ„oP≠ﬁ<À^=7+±m6ÕZÃ“¢∞El4–ö ¿‹®¥£ÏNÖïÏùõC¥ÌÏ‰¯Õ‚∏a?2πœ´˚®Hc^»ø≤^0≤øu®Â¯ãπ7ªõ,6≥c≥•†Õ∑‹K˜Édz7®ÿF=‹@–;õ"Ù¥rí—`˜3Ò}IöµIø)¸(æıÇÒ ú¬ç÷iw€KK3ø	FoÖædqaˇŸUÕ±±9VÆ“ÒE:d…†ı;{˚¶ˇV˝∞^b@¸ÓÛ[^|ıÌ›ä¸{M˘ªˇˆÓ›Ô» 
y˘reÂ{xƒ≤dÕÒ[äˇ+ö∑,i‚°%›üË±~
Üäêñ-¶¸√XT,ì≠h´≈ó!§y{€âµjµxRÒ¡–ãmÜî,¯¡œ=¸3ÅÔ¶ùæ±¿¨ÿ6¨Î.,˚ıtã¨Æ=,YNl fàl¸n©˜cåqî¸Ö:ãÏÔ^LôigÂ…W+À§M⁄K=XùQ«±ZÁ…óXbU%Ëàë‰•e{Öùíâ†—Ÿ˜…t4Ú‚õÉk∏q◊ŒÉ0•1ıO·[@&˝|Û∂`ˆ~uÖˇˆ≈…ﬂˆ¶)záúE—˚∆ÙJNA)GWÙF√\∫ä&Ñ¨ãe¯◊öç¨âæu“;äZõXÑ|EVóïx/íóîqèõÃ"1KìÕÓS•lñ‹Å¢P8œø≤´†˙÷>≈T_LπCV»>ù§Ö™æRZ0?‚Åcq‘-≠ø4àßbœã„Ú<äØºÿ'ù›É˝%ŸMƒã<ÛB§T∞≈x∫≈¢HÏÜ°–?%‰HØŒÈPˇ+˚JEñú∞Í'ñ_£Pk?àÈ e_’e∏πÒΩ&HJ+ÀbfuN’„[üº˙ˆ‘Rì}”bˇ∑é #º¶ NÉ ƒÄMb-¥∫cöä˜J≈›¡ )pÇé”§Xë@Sƒ<€}±{¥w∞œí¿º˙Ó‡ı…Ò¡—È ˛¡Û√Ω√”ñ8ﬁ∫≠∑∂¥á?ßp^;ﬁ` ‡ÕÄ˛Ó˙∂∞M]Z&M)Õ+{0KjıÚN¥Ωö•ΩÅÚé‰÷Œ“GV∑º˘£|_õu† Ñ“:G¨ÄΩzìi2¥‡£V´µæ~Ω{¥ON_ùÓæhU`!≠+≤—JTù˜∆G}÷S>”Ø:€∏G7ÖcmÏi’±6∑ø—±∆t#®„”7ª≥îÓ«$ˇêF?$CJ”BÖY≈¬PÁM6Ã[r5níá‰nô ©ÖPc~|∞Å_Ò£>f°UYH≥‘⁄ö(•@Q°ålI°“v8‹$∏ø•e28©.∆ÅÀ¯•eŒ¯˛ Ùaóƒ*•"ÖH‘sïºiÜKﬂFü;æbcLÚƒõ`ˇbØŒñ°Ù2ûé∂v‘áBAIé5¬¯c4YVÌ›Ò·´£ÉÉ◊?Ïø<˘!´˛´˛É®˛√Á∑nn_wΩÎ0π~ÁN©Ö›ÄNÛ£ÅH5Ùcrºˇ\AbQå fÈ*T…hHx5)Ô8o oΩı∂∏5¶î2ﬁÊÇ¶«–$•1t∑ÀﬁJö)o^ÆwÎc Tï‡Ü±ˆ<ﬂgN≥ÖÇ@Î}›^&è6ñ…:¸5˚ô€Û`8è¥üÔûúJöX8c≥®D∂ÖQ‹yhô<y≤L÷làíX±`ßøåÓ?kO†ƒCl≠-g)Æπ”“í¶¡¿k-cRª–o)ÌàR'@Öw÷÷Ù»Ò1¨n`ˇ0µ2:ùñÄ.–Eæ~˝Í€cÚ‚tz¬*´O,b]≠ˆãc0F:∆=[•CÍ√‘WWaﬁ´ûFµ€Öèòôü¡»'‰¢\3‚$°˜+RæbkÎf´Ô^SÔ‹Z[~¿h.;›Á¨'óüæ>∂dﬂ0≠Nlc98„\ .¨§·íÈhôè‹|:bÑCÅ¿Æ°}™à´ö™…ü±ÂSﬁC˝S8=kÎèaÂ7òl‡Ω{W¢–⁄CÑÔ5‹Ùæy»V1@√ˇCÅ’GÚ†U*É˚GΩçZ¿∑QW∞gÙ˘Hπ@<  ?zÄ¿WRp˜≈ãW{ªßx^◊˙´%ëŸ˙>∞<:8%ÇÄ¡R˚¢îuû4«4Ô>ø’N;V8Ωµ~°(êdDœéã©◊P-∆±MGœc√p?∏R∏§÷Óÿ·eKS›;.sÙ@ˆê]=◊gﬁ<˙¢!8<FÑª&∂êﬁ¶PiÌ\*„ˇ≥»6ø| sÃ°aÕ<•ı’»$‡>?^√?JØî’9OV≈áÈ’——¡g·≈˜‰ı´p$æ}˘r˜ı˜‚∂XoéÇ8‚¿∫Î∏BÄXó]‚lÇèÁ≈è »îÙãß˜‰t˜˘sÚÚ‡Â3∏Àø ˚ßªá/Zﬂ≠[Ó◊›ìo8˙»Y:ﬁ¯:@’-ÒB†ÈÅâa˘ùZôØµ∫§ßßﬂ÷cr≤6V◊‹9 È˚˝›Ô…≥√/NÚ&∫7°†7ÖˇC`uoC¡|y˝ıc`@;p˙-‚lÄ±Êô|˘Ó…çá3QL9¯îÅ≈ÄÆÿ„[õW2ê”ﬁ`»†Lˆiç0©7f6¢[¶Ñ±wQ‹yáÜ§ÇÕª%5√ó`Ë$¸cÈbv1'◊W*]ôX≥Ê§U-w>rúÒ@hLßÇ•ë±¬ëüF¨F∂|À$√éÉ—wﬁ6úG÷Ö¨éXË≤¡d“ÚoXÆ6hÑE"y◊Ä˙N6Y©ˇ˘í< ¸Ö4\÷±Ú	?¨I√Ø¿xôw∞ÏDﬂ‘x&Ïy0CEÈ¿H©E´™“Fm»Ω–,„Ö÷L$ok∑àÎõC¢R∫
˜´EÎÔÄ’G•’ Ô¨XäˇäUﬂ	´∫6UyG4l´ÙÆh:&Àùë≥Ú¡{cm√êäXƒ
öu†¶›'≤‘ù~¥Q7ˆ[≤∆¥¬´∂C=€!ª!]"œYÜ9ÃÛ¶e3‹å—p'aÕh2LMêˆLpoìã†ûËƒo|a"Ç%øáMDT∏⁄[ÀÀ‰¯5ªúq¿sÄÏ`9oj'∆≤j˝µÖ»[YAŒÚ5Tn’¢ﬁøÆKŸÏs‚çmsÈ´s…o£¥êÂÀ¯çq%Bé∏ı0KöF„ﬁÖo,÷¥ŸÃ±∂ïÄZ$µ•( ñfc˘ΩÅ≥´¡Üñû’–¨ù≥ãf∂ﬁ5”Ã˝?úπ)qõµkvôUt≠£oã^∫ãWJ)ÿ)∞%‚uêV∞∫%+2ØÃB‹….À·~1,z·¥iÁ∫CA‡ÿ¥ zGô^≤¨'óµ)≈FuÁqhvµKC&EnvÉå‘)jjL&¡ëA®dÚa≥aS‰(BÆ>
±VÒü5U ì	πêzër.ˆ˜LÍ'âñ¢Ó?Ÿ$>£1‘.Y—EQ9VgÌW 6aö7ÔÕÆx®5!ÅôxÊ^*-H≤•cSôÎ*™[2µ+9¶πÓÁÁïzãß™øèHÓpü¸   ˇˇÏ}]SIí‡_âf4M1RI–≠hö	aÄz∂á„ö§*ÅUU÷ffÒ1f˜∞fkgvvk∂ªO{∑7{gvÔ˜∏/˜g˙Ï¸Ñ˜¯»à»àÃ»™—=J≥nQôÒ····Ó·>ÁIÂh2∞ºûÚ•˝∞{jΩ≥?„7ô¬R€ÁWˆ¸mè"Ï{M?˚öl>∫]Ú[qüNﬁ≈g±¡˝]‡√•ƒÛ:¯¿∞?‰öPúG]Ô˘ç^pÉô5M®Z$ñbq]•Y¯®)C•ÉÜòÎÉxHæ!l7yPLK¥c«~@BΩ7TBëE’Cr°mj–hÈç8°∏ÏQ÷µ>jZ*¥«8Û ,
wS˜f© ˛Ÿtt§óÅómB·Á87Jàk%¨(¥]`äRêá<åœE›¬ ≤zQßZÇΩ≥ÄlNc˚\ﬂ›”mæﬁÿ¯qÁÄ´6˜≈››ÇkÒWj√√ïèbº
JtÛº&&âŸ€bNzÒ‡åàç˙‘ÙGΩ,ˆ∏æ
ﬁì»@'Óç˙G⁄ÜC∫Ï
©∫å‡ÙI‘RPKœŸª
5ÉÎÜWéh“Ü"h+kx-®G~EñZÀsÇæäUF$L5∂Ù [Óñÿ}√BéÜêÕ:BvLb–¯eAºœ¢Y‰SñN∂Ê@Œ≈öçPÇMÚ£Åœoi,ÿÀy∞”’¿£sT}±Ï Œ">ﬁTN«Çô;‘ruB<Òå
ì<ß†ÆB*:ÒÍ∞ë"˘Ôö#ùdqä£ùLI§è÷Xk¡°+6Ø\‡¬Ô–ÎZp-óÜΩ≠˜Ø∑w∂w~-ÆGVu+h¬≠†Wgæ)4˛ÜõÁ√≈k»‡$mò]Õç9j9Ö®BÌ2á–6>Ó‰/nè2^'îI3∞AÚ#í«µWCHÇ’˚uÜÉq§%FVª6°IÆ–öß∆T~ñqﬂ£H¡ã<õ*S"z‡¨â¯©`Ô;ñ=» ó˙≤Å„≤&€[Ô∑Gq˜`ÔıŒ˛Îç ßío∑˜>Ï}Oﬁmm˛zkèìk9Sè…¯É‡Ñûˇå◊œ.$•i–P-ºh7’ÓÍ1g§ÃiÛı¡^÷ÍÄΩ(íŒÔw∑(√º∑ıvkoãY>}QUiskco{ÁôrWﬂ~ÿÖ>ÓÓæ€∆©˝[y{[õ€§±ΩÉw `¸©U2˚Ÿ‹zm|¯xÄç¨,˘5í£l6õR˛%9ÉËî„Q§∆ﬁ@Ü,©Îí¶œ)ˇ©î–9O‚]à3∏qÍ]+˚ëe“Çœπ•>xä)*Fstg?ï‰hmòI8√zv7â‚¥£∏k∏¨'·)-`u94Û÷Ñigïÿ@btZ+œ+*èíaoî
“°ÌGtZNπS„i˜)'–%π+ﬂMg-RH7ÈY“â≤1[4Ú·$a‘%ˆ1·—c˝THU”OúÌ¨a;∆qi.)mQ6(3¶0<`dvm¿π\ö™£h1ƒêÈt∂  ZÃn:q?úÖ≈T0üÛsê:„òΩÊŒ`±ê∂z'◊∑s«6ÇûDD≥/à áiÿ
0Ç ús‘Í2…áΩ~q÷≈ﬁÁ∫æ±çi√	Ê4Eˆâ?6È˘≈£Z\ƒ˙ésõ=Î‘ciezYêä[d?•Á1Sò—˜s4§)À"áEyÑÃBÛbaÏÛ-dÖjÄõ9h0ˇqï%¢8ËNC6è‰‰Áçiá{;§¡i»i©>Â@tàö»º≈YR û›Æ’CÆt#ÓÉ$lú®ﬂDﬂ¬
T9!ÑaOM≈‘8°˙`rd£/Æmˆ†0S‹:O"X|Y@1›O-∆úÿ4eONU;éºÑt÷Çû”
¶BQAM…)}óùáP‰tHY°Ë"jìÀ®õùßFﬂ¥ÅJN:nÆ◊ÖN++√∏Ëƒ∑ﬂFj
)9g∂êÉ0Ï≤£ÖÁqè/çﬁÄ˜›@ØS≈0SÄœu$Orò‰õÖ‹™âgﬁÍØ»rk≠O^†êRRHÜA∂Å˙∆yÿ˘<√eà`ì /Ü¡YÓ7i3ˆ\|Q«ÿ•z∏R»\®8¶)®¶»V∫∫◊òqB	,õÒWÂ`’2&-≤Ëfªü’òTa·KlG¸{IÊΩÃXµ»π◊¥º¥∞Ì^-h?§a&:Zg«3Í“›àôÌŒ0 ì∂YÔ–|sâc∂ß˘Ê.n:∏Ÿ–ôrà√¥9À–Ò⁄ Æ¨â`Ã(&Üßa{¨-J“È“s;t‹@Lœ~ç:nFEÁ‘¡YaS‡ö∂îíÄO3;©◊2_`*ÏAƒg€ ÃÒÖü⁄Xî[b√^qqÜ+Ô‘/„*)A◊ú)ø'Fˇ¯∆÷=~òVÔríÛ‡tÁ⁄◊»OÇŒ…ç´¢¨Yj$*µ$∏$[î•ò@ßvÕïi◊JªøÜ@k,zBJˆ8OÇ¿T˙.Ÿ5„ÃLiok„√Œ∆ˆªÌ◊Hı´%æõµJw¢„ØZØª’πW.zn7"‚ExŸ√F(b≥Îºb0ØfÁnß`H"ƒC.~Öó´îñ“·¥ﬁn¨1≤◊l´f…CC§1XÈƒáx∫€]%,T%6ª‚ı }<&ó—j°fH®–≥8DR\%˚◊)-˚ë˛Õﬁä´◊Ù◊âq¿Ö˛CX"tåTF?5NVÃ	ãﬂºØ÷æ=xˇn¢Ooıä]ÅÊvùÂ˝Ó™i30È7ùî'|û»Ò±‹ﬂOrPQm˜$áëˇ÷Ä£XT»~A◊¥@Ù«D·ﬂÂø’\·k<Jﬁ	$R_W”©ÛÜî©†:Âã±©◊Í≠±Y&eŒ“ÊfqˇÃÆ7ƒ;ΩU¸∫IÁ€<»k©Ãgçzâ∂961√)6∞g˘†¡FW∂dî,eEÿ}'≈‰klvø¯æF´Q˙ªh∏…£™‡aNõ‹6^j„U3‘ÛF˛ÈÜ:£Úm N⁄∆ÔÙweS∆Ω6Çﬁ{J≥8eP∆Yò·«ﬁ∂œµ®H€J2H<>€vµ˜}1ÌÕΩ•sﬂsÍ°Çi%ò"2”N˙ú=◊–ÍIê¢	.Ë:¢<»∂b∏∂V¯∆Ç‰Î3ZÆà≥ w	ˇ™°.€2N§1Ö&_r§¨Ñòal
‰i$VE∂ç’ª¡±>·cøÆÊ
Ug0çÿŒ ⁄¨l›8ú/Ä◊XòØøÊÎﬂå®‹
ÃÜ1ñÍ)PîÅò«i∆úŒ*·ÉqB+Á$∑ßGüBúˇXWõ”ñÖæ—¿ìZ1ùJ≥y]>JV5Ô´◊∞^ë¯=Æ¢ÇÄ‚nZ˛ÀF?6Îp∆B:¨©·\æ ö‚˙z–1Ê<÷•„AÇÛ$%AJÀ·Õ‡(Ì]ìF<†ˇßExÛ‹^ûÙÉ¨sNŸã∂0§`˝9¡>mùûÇL?∆˛\Q‘üC>¥∑lb´«Üsò√,¿ƒ£ˇÁ,∞P¢ﬂÁÛ¡^ºühj⁄)J•ËºIò˝Î*…íÖóŒ[C•}º⁄˜böµoºíCÅSaõFS#e%zxL.†a,´1Fú1Iå
V,xJÈêxÓÉŸPßrY…ì:ı– \a™Æã$*ÙŸ
÷£oYÖ‹êG Ba™éåÛ6JôÃÛ>Ó=∞*‡Ï¥Ò∂äüfa˜˜≥pàı? ü∫(—¬…Ö˘öaê§Ù«øY‚W'¶“Âmª ÓhıÙûC÷ˆbàI;ﬁøLÅ‚hΩqxdZ¸
‡‚ï÷”Æ7⁄∂Fﬁ≈gj”¬¨ÿÄ s0VJjµ®Ñã™∏∆wBHt@ˇ∫∞EHÒG4LVJûƒ)9 Ÿó«»∑©Iònûp‚PC•‚∆ú¨Ü†∂ãÌ≈gÕˆ≥Ê‚‚Ãìb)ë‹õÖŸ›ﬁ˘ré,>]∂ï=ÿ€·Â†-‘^\n”Á©≠∞í9jÜç{ª∂‚˚¸÷\VxΩπÛaÉlF∞*'#¿*kµÛx(´<{˛åº~Gv>¸ˆı˜˚∂“Jj-Z~ai•µºh)˘çd©Á≠•∂πPrÊ@[Àœ[Ì∂•ú¢ˇ?æ€oÆ,ì∏ìTºœ£NÔôGaœ:ã‹ÏÍæuî·Z'ú4:>˛3µ˝éw»Lÿ47ó⁄÷ı•7ìËÇïﬁãÆÉ“Ü¡L=˘ÅÇgﬁ,Ëˇ≤p ¨äÙ∑Oj„∞’,8º¸ºmEwÖ€œVVVû.˙¢p”oﬂ«î£|€ã/¡!iıÄXZßLC]ú¨7IÀkW⁄vå‘∞÷ÅŸ÷“°{amÓ˝üû¬L„Ö?®œ≤8ÓYGß".ü#k9y˝÷Q=q‘¿G˘Î»d‰ÀÉTÁÑπ  U•oÄ«/|r—RÍÌ™•˘√	LnÎSxù*@∂èXrèœˇ¿É_ø`Å˜5∞ÙÄÃà?l˜Aó˛ÉÄÉ,Änµ√ée‹É.¥«C+á´~YœªÑπı1wM(µá/ö(	oZ1û¢¥$
Å†±Œ,óÜYrm!2¨Øì≥—ä<#·´Â.FΩÃ≈aÊ04†>\sÄë‹*ô=âAr=[¬°^¶Êdyy“⁄áïR Èb‹î¬È!´o)Ì®ûóõxã!åb¨CLt¥n ∂›êsúYä÷1†¸¬õâòˇ)Ñ‚5≤hìR‡	za¡§b&ªü¬=â·øD˙Qö¢õ”Ä0?◊2-ƒc ›‚QÆ⁄≈¢
e>∑—IãäÓ≈™`ö‘Ä¬~ßˇ¨q;§h––˙=HÙ¯±k∏“â∂≈ÎFñUì
%©$DˇaítÉNAœfiÔË›I∏f™2œzm)^ë)Ÿo‹Û	Ì(9ñ¿Œê0œY¥4‘?É$∫øŸ>r3K2àm_≥d`ö …úsÕ)<ÖÖå‹c:°;Ùì£ƒ·‰ã€EÂÎ®√pƒHÍyæX|ŒÖ≠$õ{}A,ÉwÙuØ∏Ã!iùFÉ.vçΩ*AüŒïIôÕ<Sm–◊∂)óùlKªÿö=ô+m˚ˆ˜'&ªø#ÚŸ⁄d‘ZlÄîõ.‡A2®?8DT˙“
æÁÄïA≤ëß¶Ø	K`_ÏôΩÁõ±¨Î}’JπfÁ¬¬πÿΩ¯¢PıÛek‚ä9Ÿ÷‘uÅ¢ı, È§I˚î≈I≈$Ωëˆ’^–0Ù„t“ä≠*’>BÆV◊«ttÇ*ÜrXø©lkÄz·§Ôúêd¡U9π©zÌ∆ÜXË%@É0∂.’
≠.˝Ã´˚Ô‚u{Z¸0Qâ)µ`]¬Ñè
∫¿Öß⁄TÅ◊+v^ë5µL0æ-ÉÜãhuÅ·&≈üT†2‘jv»µ)ñ≈@≠öçPÛ/éìßT–*&o÷∆(¨e£élÿ‚ª«qQvÃô"À∞‘D1!h«ª(ÕtW;≥“®V˝¶ p•iE)ÆMUJ9 ‰if≈ßß˛µ]SË’ 7ÌK35≠7∑ı§†ŒØ∆ÿd#a=,Ï(∏ÙËπq©$†ÇCä !W ‡RV∂≠6å”c∂¨3©Z'håßÛ∞Ö˛,®ãπF£ù◊7ç:EBpÃc^®èî»ÚΩ&9®AﬂØ"(}WO(KJÑ≤Ø†(HπT*”Ø}iKY4Ö†Ûé‡˛.5(‡´"ŸÂíBá|3,Ã*1W*æ”*¯%$:!D‡«YóËÑ0ÁΩVÇâS_˛V^Zà´«ÜVÍl%Iúk8´Ñl¡π$„gªÈ§êâ`6ö\p>‰oèÙI-ì&Ìö°¬pU¬\¿V;´≠–¢Äñˇâ´)!ù-UmÈ´(›	v‹!ê76W*7´øU
ìµF3Â—€ !Û√…Ô’mvõdqy˘Ÿ ˘yÒl©›¶ˇÇÍ›≥y]x7ıqE}úWŸ’˝À¡â9öí“ﬁp*;ó˘«rÂZV∑‡rŸ˝l,z‡√B2É
 ≈".µZ5à∑§ÊÙ`©B∑"|€Ïg@≤Hz„ÅhØrÊ‹3∆=(ì0ç{0qtK£^ÊîE{Á€Õä¶h)ê/˘…†a‰ïAzÚÇÚdXµ≤)0í!jî-õu…¯õ––~CÇQ7yFº
·. †¥4ÆHÓyrOi–SµPößˆÒ˚øiÚX9‡¥3ùüóßœË6Å6lxó·À«·Pp*◊¶§ÁåkÜ§í®∞0¯∫jQX!è^¡äH◊
˙œøU°îT!iñÇíÍZ!SOT G˝ZêV÷{r“\§*áäê/ïPàrîÒé¡%Se0EST -ˇVéüπ:åJÖπ‹ÌÂ?µõ+≠ÊœFœ<˛!‹BŸÙQ8Q1ƒ¡ÃïD(Â'O ÛÚSÄëÎç8î™©∏Ûèûê™5∆á’…—û®J¬/‹\ÛÖ¢©ìÎ„.ûi:5e≤§c‹(u¿KêNü
ÊKKËvıQ!‰S™5˘+“nµó…<Y†ˇ â}]Ö›∆¢Me!mölç6Ûn=õ,ûRAØ3Ía(Q°5ùª¶#§G˜5ïˇY‘†‹’B3äpùWå•ÄπU¬ßV[°™πÖ&î˘≠*ÓZ
∂ûsV9oÀø$8cÙlßlô9W™-Jmæõ-£y\J◊%ü∑qj⁄ê˙ÌV´Ó~ïr8_N^Ã£îÆ°ºU_%o ‹ñ≤äD∫Ω IH⁄cÒ∑]MÀn®›ã"z˛±Í–Vã™Á6≥=°.¢ÄY8NrLKî+’U{ë≈‚_*,QŒóÛ î≠§o-»^™ì™k›‹ªzìM(Z]02d∫^€◊aò%q…˜n¶eıô£˚{–ƒùŸJÂÑ≤L≥`ÒËòQxîÕohDâ ≈6—](ìã®¨ Ñ.OÎkè6ˆ¿R•>=∂2ÃPœ˝]Xïú>›ﬂ1ﬁ|ΩÅC¿Í°˚∑)¢kçs¬c*Û…∆˚`á◊˝Ü g%ûß/H…Ï£ãm6?U⁄óvÇ¡q=
ä_òmw^p•ß∏í+/˛°ÜÍìQË˚;’v»hœnºRNÇxõï¢∏ÅU?h¬_êÔêˆ◊ZZ`æJ≠ÿØz^ÊO}%pˆÎ£-VX©mkºx¢>äae|T∏*æ(U["ÄÎ_±xºèz]2àaΩÜ ¥ØË¬∆0êÜÓèåô˘¡6qÌ	V]-_+¬o8◊∆e_~ÈYî|Ÿá™Û^ÛV]p‰%q~a\‰Ö}%ƒJ’ ø$.^ª&É˜úQ⁄≤(Â5·ÑßÄ	äjπvd\Kâ¨´∑EGÚï∂¯µ‘ú«ÿW˙„a/Ë|Çp¥tÓ¬Aù^É¢S†“.ö∞~j|58ª‰<ø_d±}f˘e7ƒm®–Í•¯≈9îöeÂK.Eü0∑¢˘9ÌV˝Òc{m…î®MàæÁ¥Î˚“&ÙûÏÂTÎ[‘OıÅÿIwµÇ¢Å÷l˛0K7/ÂÒ \—â@}‡6{UlÂj˚Ò„ää<bi~µT^\™øW’xy5Tfó…5œ#UT∑%πzµºT.€ñóìÚu≈Hs˘πb‚]1rÕG–£ÚRÚ ^UŒb O‰·ëJ´Á÷´öqÖo≠èÄ—äÈá_ΩMD>øã˜™ëkÉœ+’É^#ÚH£RˇUÉ_ÌÙ^5Û⁄Õr’<ì’Ü‹¸èªFâ›ﬂs?TÂÙpπ5á<é‹Eì‡ÚÜÎK¿«~ÙYN!Àq®∫74¬ÔZ‹‹ÔV?*Ñ_˜∏Õè’'W=©˜\Õ≤ÃºÊ5›êé—_yq3û$\`±{≈Ω∞Ö3ﬁò¡ŸC]¶	sêöycÅá˚“º0;‰O¢Ö∂uK÷'Ã-{îÑ-zÓ}¢øÈü$&l0K%?*‹^“„HXÜÎ_≈OΩ‡yˇºNﬂ†ª'"–©’,º
;£,|3Í}böª‹aÀmC:çWD⁄0%˜Pü≥î^„ç∂Ì+∏Ñ7g∂1H.CJ!NB)√c¢C˜‚xÿjµf§ª~>Rƒ#Äàqp˚ø∆ö¥8ıï∆á}£MÅl∆òùt!ÖtpHAÉø¡iooÔ√ﬁ*\›3≥ú˘^Q¥âp5ZÃı	jTŸ®‘^Ãiø’c—»P ∫·¶Õó ï’äÀ	+"ØQpù≤n9fƒJ§‰4Yø“n…£:¡IﬁÌŸà˚˝(CÜøÖêÕ£ÀﬂB¸~ıK…ü4πŒ}ï∞–ãj1Ö©π•0¿3û‡2à N¿EhÑ	l(M[Ìä˘ÍŸ¯ˆ‚ÊaÏ3`O£—à0tô/¨Î3ı2/Dº»„W«˘Øƒæä9›D/WH=HajıÈÉ3f%¸6¢GÚ[(È>*%êÕpÖ›Ÿ€Íïπµmü⁄Gv‹Ù|å|«˛”˚/dˇ˚ù≤Ò·˝Óª≠ät˚76∂ˆ˜ﬂ~|˜Ó˚ØÃ
˚£NáN∆ÈÓ #qŸÚËF¢À-‰°{tcÆ¸≠°©°s,ßR¡Â#ft<è-b=K0ûJ™≈¡∏°¬˙IH9ÇYÉÄaW“Y‰F‡í;´ÚQyŸˇF‡™õl/8äæO≥Ï¢£Ï{àË®|Í(¯zòD=µ‡í≥E≠„e◊xFÉP-˜ÃYÆßµ˜‹ﬂËlîfj…éí˚·êÓ/§P
Ø8
Ëd±^t°Ì(∫_òÕ.∏ñh3Ï ¬a—#É àO Ã–ﬂá˝∏ÒK,6œµ◊I\∑ }‹≥⁄ıÉﬂg∑<îó;Q∑"Äór‚Œ	‚M√ıÕ‹‹ÀŒQå≠v8KgÄí	>?7!ÜD.qÌìGòqMÔBui®Ô‚b}„ú©…√}YöÊë∂D∂˙¡ølÚFy4–öÅ¡ÙmãØ¡!€ÚÓTú–◊ı	)ÑUB3Íã˛{ëƒM3suIË„bCu}˙€◊›~4‡ïd#⁄m/˝Œ.]E:Tv»‚§ºP:ÜEÇN∏§@8∫ ÅÚLﬁı≤¡BR’w€<ÈRπdö·”ˆB˚ØŒ‡SãûBË!˘’W¨¬PûˇÈ+ …ﬁ *ºe-´3ƒ£©&BL◊+¢u-¨D;§ÈB“-·C˚#.E¨û⁄!/Æüàü¬k⁄	(')=êÑzõ‡o†bña§NPYEtœ+n≤üeı4LfçHVx÷`dD≥πm±YBÔ…LÓ4¿ %q±÷l≠]∞]PUΩúIáA'l^7€≠e2ºn.Ã¨[ô»5Zn†÷;•ª´âî¢øàüﬁL·6†˘bπM+%^1˚pïŒ¨3ﬁ”ísjm⁄∂w´UbÅ∑—7®8.◊¯∞ˇ√ï·’%Ä√±˘¢›&'g¸«rª=øL®ÿ±Vÿ? óÖ6AFÚΩ]5ÿ4¡lı3¸áûC l7YûJ§ÆöóÕ√ÖÂeËÁ!©cZÀß˜§áﬁ 9ÿ+ v/Üó…h r‘Ã˙èˇ¸Øˇ˛oOπΩ.ª°Á∏T6´Œ^ïU\∂tıÊ⁄∫ oÆK◊–ß∑%Ÿ[é9˘ƒB>Ÿ≥è¿Éà9¯qo!©˙u≈0÷GcnÆ˙jûW§∫M["wø÷—hΩ‹U¶j˛◊ÊÈ∂∞û+∂l)ù_Ì[à$^¥(Tí≈Û¢Ø˘åR_	;Ê’àz;£Ry52ô_C¸ÚFmD)´Oˆ•3∫ÉÍo8æOüÊõ;/@*êÊi/ºbAÄõù}R)Ö[Ùç“«h–çŒbJÍ»ﬂ/¥%mlˆŒ°‚üÄ¿2“ª–ñÑê—≥x£t@ólÏ'ÿ‚óêœ±πŸÜñ6IZ>AÊ˜Åu-¶F:p¨Ÿ¶Z‰ÓNc8f˙Ù6áΩ4sùÀCEÖ`ì«ÛÂ9Öä5>L¬&¨æ§ØIÿÆ¬Æ8°Õ<èM8°áéﬁ°‡M åë≥`Ë‰'p≠4≠‹gª≠Kï)´⁄L!}‚2	Ü:~#HpÑÎx.N˚˘Á&¶≥/ã¿!qù„∂¡Wúëd∏$“z=ès¨»6+ÜÙœì[›†Úó“ËeÛ)ùÅs¸ø2ågtÈ9=£>5€3dﬁ≥mb9±@'Äw3.¯)ï≥—ôFï0ƒ,‹cV≥èxûÂXgü˙ò£ËïŒøB¶¬∑rÃïÄ¯M'µ≤Ll∆û∂€3ÎÙï÷‚:émUÍ-˘‘´µ;ÄèŒn˝ÒÄ`≥"¯¢8Ìrd÷eÅÒ˘18≥æ7hÉ$M2…z¨ylSØß7·‰+jªHπ∫qsÀı-∑ò´O˘ãáç"ï9ËÛJQÓG¨Vµ¥_ôô∏óˆΩ%}2¸âÜm≈”¿Û¿Ì"ßÊÂÅ6≥ŒM@&ﬁ/Ï(˚ë©2xΩXÊ«õ∏cwÂÿ+ûä= œçAß≤Tå7π≥ïRŸºAå‹è¢Ä8”!§l·ûQJg(@îmÛ¯ñt≤∆.*Ò¢ºæ˘õ%j¯<¸kµúúm˚*ƒ6¡Ü1QÕW}ÖÛdXΩ9UTïÒ™ÊÈ0´jã+⁄,Ã¨∑ªQvÌΩuºÀa±ywsÀIOépØ»Ò_â{{˘ïŒ÷`}À˚Tg÷¸üˇ4Ù|»°éFlu,¸]ùëå∑çµÍ™∏rÉ]E7§xë¥CO|‹ßgDqw?¸π≤î£ƒïsÙ	0$÷/ê)“2.i`¨+è£?˘®r‰{îb9§j%ﬂ…¶∫,ﬂÀ–,˙™‹⁄•Æ˙»KÃdV«§X‘úá∫J-ªegFyëX‰*R¬Ó	˙ ≠†πé…fëï«"T©f‹πq≈'ÑKx Ìõ≥y‰?vb€}&¯ÙÒ£Zır©Q ≈5mFÈ∞\£∂_iËvÓÿfÏÎhò∂jÖô‰Á»b†ır∆ß3§5æ°§x¡‘åØ1k]Ûßhÿ1‰)x›aK	◊Û
fà˘¢ôü˙ëNYÂ^à“eÿä∫ÿ‹JkKuË*t˚@*VrkD∞%1¨K∏m	ñÓË≥–ë#Í‘N~¡`\6L0—∫m(P,’«ê 1§µ∆†›∂ÿ«!‚cO0•óªèJEKâ()î®3†ºõ
LÈ£…QçÙQiDb~Lrá#J!¡23nN»ÎwÔîÑ“jÄïY‘`Æ	0_ÍEiñb8Ã9M:êtÚ±§
≠Wôç1;è›ç7Pﬂn:÷»S[s'gæ∞§“Æ},Ü_ﬂäàu¿˜TtbÒ
È_<≥Ÿ0∂]o™rﬂ·->Q€›îW•P ÆsFÓQ‰∆˜1gäzÍ†w†jÌDèÕ"©`ºû∑Ci©Zı∂ôˇ∆™ÖÏÃ∑ÕˆÇrÍ(Q‘vÍÙÿ^0ö4˚—¡º]˚ ûÍ]v°˝J∂l±É„Â§ú∞vC=nÁ≤Cñƒ,Vmvg∫ÅG√§-
œ|ÿÍ?ŒcH´¶Èó"GÄÄc+¬›´P˝˜°§Ù4}Iû⁄∏¿à√ÄÖ≠Q/°D_ñX8r$Ÿ6´teï≈#›+Õ£L›®:M8”—`â≈68Ö^◊``ƒÍ]À≈ÎkkG1Î∏ˇÎR9œXIΩaoî`KØ¥u[p=â“7!≠ÓÜIwÎ`®‹`Ôf¢´3I+ÓæX ÷ΩZÍ+V•%«U÷	ˇbV!króO∆ˆ†˛DòcwÄ÷∫ó%*gﬂnåZ¿¸q≠Sy7◊ﬁ™µlRÀÄ≈∂∂‚◊ÃTÉâTÙDU0ñˇ∞#‚§¢ßˆáìﬂør%>íñ≈à´≤~5∂RûgÉWp$G*Ù≈¿¡(È¯W+ oCCyn⁄^¡Ï :6"‰ƒ±[õ!3ùÌŒ'vxÅwX*Ày∫Ä0'Óâ…OÇÀ< ‘ÚÃ•K¥AØå^ªÍ±®X»–πfâ˜AÁÚèt©√p$>•rÛ‡OÄ>Ó≤Ùs^ñ√Ï.›»ù˝=e·{(w#ÚÒWãîÂŸ@Tl Ùo Ë}Q_µõÜ◊suiûπõ1ê◊XC±~}ÜbƒÑ^>	ˇf¶ôzDúûæYü
b„¢ÿÂUCjr¸äKéﬁN.5±AfÃ!d0⁄ÓaüÈæ„•¨ª-/¯$Äó I´@™É‰‹∂ Ú	rY)	œ®†Œ"R¥rû> S • e05úSÿZ#9—˜,MáÛ6Iî∞“'DW1Tn;êHÕ´;˜ˇûW(Ö»íCWΩ[NeÂ9øßHQÜk›nCØÁqæ∞£äe˚Q@xeÈ≤’jÂ%äq¿°^Î÷Ê≠X&N+,í¥ÿã”˘éŒO´•ºÁæõaØK>1<y<z‰[Ã@jÍeÿËª:[Ÿ›hæ˘·7≥Ü∫“mÜ\6Bè·ÃÓ√§M@Ω@º∏bpWŸÊîRfÆØËı8o∂ªÅbmA9axz:‘ÈõdÖÏëù,[’∫◊+_§W6Z5vå≥mÂL¡®´únàVïœ’#(›‘Ê<om	ıA‡òbìk∆ODoOî!“4ÕChf@}L“¸Ü—êÄ[D˘Ö“ÿÜ´i2§≤Qd^H dà‚“úv,À–CCn]U\ÛÏ˙hïMÜ69uZµ4≥±øÓ^¿–QH„‡ÀÜ±’‰?cŒˆ†C¢@∫Ë›Q2ò<!2÷)yLDñï®≈ÇI≥x·sOàô DÎ3JË¥“MçBO%¸fi∫0àk+
ò·ä>î;>ÏH~»Ôj˝ ¯˜≤∞*M“∞L‘c+‰_lëÊgG∏îoAÒh‡É‹Ç|ÏJ∫WâÂBµPÖ·¢i„˙–„Ì=XUÇpÌ§ {a8≈„€ÏØuõ°XObÕà#®≈Pg‘Wë≥‡®t}üLΩ‹G˜æπ≈\KÓﬂªkÛÈ∂U–±Vr¥–ÒƒÜ¨XC_ç¬
9Îô”`ô7ò,ÈhΩè-Ì€†ÑYÅÿàèçŸhÍ›⁄ö£›°W!X∫§"·†smy4S5ÔeZiò5‰!^‰"E˚´93^dÔ${Ü4nµ∏cäUÑ±Q√F±"Ö|◊ËN£å÷[zo°+V–ó™¯][9«g_%4ÙqîË`··%nøEÁπUq_›©Ù{è¡p ·f4p»◊)HÑŸ9eKœÉà;uñB“ Ú)áº<Â∏!`Jû”Eå.¬úYÑoÆV‡Ú∑M•@?1EÅleÛJç jıxê3±∏Œò9”œ˙àﬁ^ä±º0pÒsyØá%¬‰ÉÒí`ÚÒ:¥≈µDU]‚/≥pêÔGdaù·øÊãlÒE∂x@≤≈ô‡ãLE&¯"‹çLêÁ|˝Bw∫j˙ò˘K‰Ø\…†íÜ8{ÌÊ/ö∞aˆ;Ü®Å-è+n¿S_‰‡µÍâTâTà≤H©"KUà!≤ú[ÅßLÅßB$Å«q¨ƒ©4ÑîRÇ¡µ"®åêÁúø≈à_Uûí4Ü¯üøÑëÏ§„—∫–8ë}Ë∑Ü[NDQﬁÇÏB¨…–¿≥ ÿ∞˜-GL°(∑K)1©`ÓæîGW∆7Ò≈òXó¸«≠¸ÂLVsÿºåÁ£ıríË›#¨µØ§é∞«‹EÓ£íﬁƒDLyÁ®u˚x»¶8ª¿Çc≠9Mæ‹°ı‡¥Ùx˜3d=Ö':rG¨è∫l6üÿŒx¯õr›ô˝∏√ ∂∂Ï$omEº2OÚ…«ä©£û~£˚q¿ââ€‹“™¸^˜◊[;Õ≠øﬁù-íÏjU‡°%mÉq[P…KÌgk∫xËé €≠•Î[%Ìjuüª–}j¸¨” ©≠˚4»—üõH)ûñÕÄæiCê˚)ı{OrTxBÍçR°t˚òäh†äCîSºlK”8À
 Èé=Ñ¢≤g XºÎ"»W–ãœŒ¬n3»=åæ◊
à<§¶Ë˙ÄùÛNGf#™KöFΩ^!f.˜Ì`∆IYACòIE]ãW‡ËÿÿGÃº≈U>™*€P
]+-~,ÛÂ-ﬂrqW¡>‘'∆≤?!Ê˙ºFÉ4L3¢∫¡†a›o£ÏAHAe+a.ÑNüÖy†mÖ_ë=+˜≠{·º≈•ÀZv	´Uê±Ê§êV9;6¯å}_¿Y° ◊w5+∂◊∆†˝¶M”?däÚ¡ò√úGò“$°¥–˝Lì$Q`:ì$OëiO“û∏ÃY2Q≠iŒ+¿(Ûƒ,¢ÓıÉ„≠¢ü¯ÄÖ£íõ8Ë∏«Ë¥¶v2'sø–·ÊÆ”¬íKpŒ„K*eQ¡s4à˛fÊwbÛÁåùJŸ•ÜÿÄ;3#R2Oß/÷wkL“*Í•zbáIÖ\ Ç¢sYR0˛6)À”?ºxµF+∫Ú	Â6¯¥ê’ø*}+t¿ç€ÂÄQÆe/À‘∆Á’”Ë°{ïﬂ"Õñ~ï'◊‹9É–∑}e—DÑ˙OL»÷ìó5∏mØËêÌƒ„–∫K	¡FÏ⁄U1 EúA˛yò}ë0∂”Ø2îÍà
üW’œ„Ñ62»fìÓÃ∂¨«éJ|<.p\,Rô56ˆ^∏Uy&i≠[∏°Æ—ài?\’V)c•ÃTMÍœ'0∑|7"&ﬁÃˇäƒCA‰Èggî'á`Ú‡∑3$øö◊]oDÏy´1Ωéâ≈s{~’#˝´f0ÇåbWÕ%íˆWÈøœHÔ˛}QÊñHˇ§πHqsHâ†3>´—˛…èú1ô^¥)ñt>uìxÿ<Èçíf⁄',æì’¥HQ#DA•E#»kèÖ(-	Æ¥v2 2∫∞ŒƒÉç^‘˘ÙÚÜ—î4Ã^´Ò˙"ZEƒ≠|¿7«tæ0‚¢2,:*^ç6ï%¡ ç ˚ F*±«èZ‹I„§9å#|˘ËFÕ4 ‚áÚ¬“È∆òhj∞9àÓîû›‚ˆa∆X#Ï˘9∞´z,›Ÿ€c˜ê+‚˝ñéÑ©°¨ñ»9˝˚8Å4¨≈™2xéiËöS¬íñT« gp◊(ÇˇacÒ¡ »>Ñr‚«·/¬”%˙y‚Í¨ò˚ƒe˝ù®1öæR¶múP˝töö.»∏ﬁøX\~ˆ4<9“b…©qÈƒRBÚ,-úZi◊‹X§Î[ÓV˜D[†F®0√u®Ñ˘«¸^r@ß«˜7&ËûÃ9∆7ÙOÛ∞sı·y¨Uf∂ñÂrJœÚ¿ÉáÙhK¬>E⁄∑æïBÇC∆q˙∑∂©?J!ÔxÛ$Ã.√pÄõ|)ﬂ°U©5º"ß.˙D8Ñ¸™|Ú''Êÿ¢50üAÛÙòÓÓË˘6Ÿ”OSà≠Áú«í0ïO}ftjk„ûM5Aï›1çp·£e%·”Z+h)S2{ïÖ5⁄/ıH/’1j≈CècÃ2ÚÚ&‰«Òæ⁄PÉ ArfLqÓ¸V< <R⁄TÜH>ì°kÀªqò˘xî!?ãi]åìö¨*è¨˘îNƒI:„5ˇ∂7,ë"∆Í€≥4î=k,∏ÑøºÈ≥Yæk*~Ø”ø0ú”Ì⁄<+ÔﬂúÁöQ≈Ö˜âNÍU˜ß∞9Å÷›„ﬁƒISÿöò±ÔÀŒ¨xn0A%nÃÎ	7Êµ‹í◊t3ÇjÎö4©∞ÈÏOicﬁ4Ù†9¸#—√}˘á*gÏpåVe?ªâÅÎ)M≥∂¿Uû-‡™’¿ÌX¨ò√HÜ]OË>Ç¯Áä4Ø^∞d',ß lJx©'èëõ	>-¥óÔ~+ÌÖtÓ8SËâ¥U ÒL|Ω‰3ˇdóâä˘ZµÒ∞î;‘˘¬Æòd„å'S’îN@≤Q≠8i:B∑0U)I=µúF∆.j]yÖÅøÆ!ORTêì®4¯Á?˝√ˇ™«‘Já∞ã5f¸HÆ„Qí;X3ƒ$ç3∞g3—∂Çπ
±Éø‰lÓc≈	≈yﬂçAΩrÄÕµ»¡yˆ•Ù?∏ôãgÎ7 &Ä ÎÏ-ø‚√¿ú‰]p;îÙ:Ö8ﬂ£Õ3æ«Y„8˚(öÏ˚Ú<~tﬁn	’¢9Ax&¥oLÂ‚‚ÊrNZû4¨˛sùm™»ú`2|˘ûØÑ€oÔÏ√E6‡´Üì®¢∑”eèﬂÅ4˛ic™Ùd8[ @∫[-ûEYè.XA1Ôû:%…ﬁÀvœﬂ¢ﬁ5ÿ `=2’1Ñ‰„*•-w£Qá∂v√n‹ÿ≥ˇ“r~∫kƒ /o¯ÓíÒ‡u∑˚Úˇ)+µ’ç2(ˇñï€§[-£LªØ}%≥yB∂UŸ@Ypmñ/YÆqßØ¡Fì~·éOYtŒ˚!˜Ês%åª¡«Kt⁄µ–z S3w©öÇ‘»G)”¨ÍqˇEnkë™zVÀìáÊyFgµÙJ ûùgˆ»=(äéq˙œê—'ÅÓ?T£;¨[EwÛZÄ{Å†¸gŸ23~‰y∆}é∫Œ€)´ˇ>Ó=‘Ä8î4ù÷cµˆ≥pÿ†´Kœ’¶oH´éZuÎ™ˆˆ‚À¥qx‰€—nü%aö6L#ugçwÒYE¬KÓñíe Ò{?Íe;˘^ﬁ¿ïn€¯r 0¸.æº	“ÎA«k9–^§Hò`øU∞˚Æÿ∆ÍÙ¬$kÃRˆMF—]òÄ-IpAI/Rx √w9Ï-üÉ]8„óï)?˜È<â)É¿£~H+	¨8†~c„‚Ç%ÀÔ∂w…ê)¡YÿjUéÉ;+Ñ)ä!yc∞Æäh≈£û3fˆŒÃ˙¿Í$ïÒ˝Å1æ>-˝!
∫AœM ıöÓ˝ËFŒ¬-˝!∫øm—Í«JtÒÙ1Üˇ°jf= Kò√ÛeeÛ8P]‰jMNqs<©N,ÆLâGÈ(d¡É MqHö(π@Xπ€_í&ytÖoèã˛∆ÍSçÈÖÇ1r«ÿ!UÜào•£Ná÷Ú'+P)Líò!Á[JO ΩmNMpO“u
+∑£õ\îHÒ‡Õ®˜…Fv≈∆Aœ_¨UR∑2æ0(Øú"ï€E¬dNä‹tnΩÈúA	Ñ,W†∂ﬂ˛¿%f$cÔkp~ŸˆY€>2f¯_˝çªÓÙYzycº∞◊¥ÿ4ÿÃcËa?5SKaÛ¨ƒ<Fÿ9Ö	˘6£ko√òRÛïEÀz∏(mWû!å ö0A©“÷µÆ≥Ìwsù-˝[”ò“ﬂV›≤á“Ì|°hÅÇ:d¸µÀVkî¶Lb˜≥YtvûπÚ¸””[,·ûìs˙ün\CÇA‘Ü#JÍ%˝TÌ„D6ÜØ¸)A”3Á˘ÇG©°#çÓí–Î	ûLí‹œº3¶ M¿7Ãﬁ=•T"Q≤§jZß‡,à–ã˚¸:ÖåPÑ´(@)F√,˛›jM⁄¸n¨ãº≥*m Ã
√™Ä•·e¯;≥Œ\!∂îÂ	±≤ëeõeÿ˜£nÒí^|êñ‚≈s9ÿNîWˇÜ°•=ÎnkŸ€`Œ	˝esëÓ≈EΩ?mH ∆§≥;≥^ÁfüÚ´ÁI<à˛¿Ω´Jaõ‹¶≠Ïz8WˆG˝~ê\ì˜añDù‘y™`{ü%Qó¿ˇÄºßt⁄ËÅñˇ\Ú¶‡ñ€AaÊ°⁄Vùvúa>;®Hô&5Õ·ÈVÖEÌ
wˇO+ÈÖ¢Ú£àQJªÈ§=´ô≤ÛC»ò Än≥	”^7›fΩ^0-™•I6l;Ó#rÇ9≥ı√±÷&º):3ﬁíÔÑ$æ$Ô–í4nlnÑ∑¬aZLyπÄCæÉ„ClîO◊∞MñJ∑	-≥PÍ9#;ô÷&°=>À∑à èÙËÇﬂ„]në◊[õ‰∆pã-K^Ï ]|;w{áKóƒiXπvXË~/˜∆‡À'%«x?+'¸óﬁ ÂÏ@˘‚IÜÁ^◊OÙäp'Ã»ª4É9I"Í/‡Õ±ma…»£õÇ˚:ò'Ω"3&è7CÖfˆ±‡ª=æı#€*b»û∆ƒå;ß◊„ö|?F«—À]‡…xÄä––`˜¬úÛ¡î% ªzIóÎp2o7ÜÁÒ◊_ªb)¯€Ü—mpñ]∏Ëmf1=®1ﬂn3¢î‚,ÜùAŸ˙^:QÕ/õÉóúÆ¬ië]1U¢ì"h0ä·I%Î◊≠Øœà≠5 $Åh≤PîM8∞Ü·å{–¸ßIâ{gûê¡scçπ°9z∂K.⁄µë˙YNâIÒrÌ¸iÅ†ˆŒ‹G–Ã˙˜`ÁñgëL≈!F¨Õü?≠@ë†S◊¥î¬;ÂÏ´gıñ¸¯üˇ©j˙'˜ÍSPÎi¿VÀŒ≠ZˇO—ﬂV˜Í‹≥ ÍY#8x®ªlŒÚΩ3ø–ŒM…Ã-≈?◊cÀ-‘lÓº”24+Ç» .D	õ°{21√"Â™ÄPËTdò˘)ªÏ\Waæ«
†u4π«NAµÜÍÃ˙[
e

Àêää›⁄∆∫† ÷Ü€gí3Œ’·¢Lé	ÿ‰È∏˛÷éÖ‰§àdˇ3/üÒÀ
z¨†ºÎ`˙úá±àZ† /ÀË±åπHâ{q{Ä:∑Ií≤ÊJ>≤/õ„÷*”>+»¥ÀudZx‹8ìw^ƒOénj5Å—9ù0%vÿûc‰á r!1›Å íNÃÖ˚FbÚ{n`ÂN{T∏<è∫] Q˘\∑’≥Ç¯òw©_Ä_ıÚp˙∑&ù—ﬂwy^îÑJàYÒ⁄{f}7L“x0{|ùˆ‚^œO™îÇñÑ$ÆÑg÷7‚A˜"ê«¬l—≈	√xÎÑÑAÁ\s#@ÌGÎŒ.iΩBx0G3·k2óõÑê”Ú"$óL¥ß\R
„mW¿BÍ)'tGtCÙ¬”ú‡‚asa~ë4Q(¡©ø∆Zxè¸~À€Ê Gôü®§kaà0„_	-Sœ)rÑ…À>V¶Ù&1⁄µJ¸FÃá{J+‹&Òy?»õôäÀ;GÄaØπBGßà´UŒÔÍmiµˇ˚i‹•´p¢–÷ï˘ùõ·He;^CÛ	ÛYÇ5LÊ.Ãﬂ>0ç4øEGøáÜ∆r¸∞≠eπÚ
«ë´)§j}yπûœ\ÆSu€Rkœ:MÅÅ GÌ≈#≠Jºk∑V^.v˛í˚ó	ª>¬ÁUö'DÇìK≠´^z57mÔÒ50›&a–≈ÉFﬂéOÒ~ö˛ﬂõ&bõ,ñ˙1ËkqÆﬁÓÈX˙.–y∑{z'»¨®◊Lï€_ *Ônæ%{! ≈ù 1X∂N{)ÃwÉªSì=‹FNÎA nº∞ıªø∞»Pë„X+p÷„H⁄â9Ê7ä)#º¬hÛ∂ÛÀg.»
±A¶Âñå3i∑i.õ)@1Îf¶óŸIôv;CUπ—9sC˘Ó^0+?‘ÀŒ)ØÅÊYbëìeÎä∆ó(Byj7j‹≥Òix·‹ÇÓ#ˇ˚>/ÿµ˘Ï|*Ì.©Ë=≥˛Åer…MÓ¶’6úLIc{0wWù©7{L3x7˝ÿµêw”ób©CFŸùMû¥¡Óí˝‡4ƒiº´æò12ôóá^6ΩnûÒFLµÒö˘5◊kùñN|√$i-;âª◊*Ãî‰R“º&¸É
±üœ≈—”ª—»◊¸û¬Ò±»*‰ï="◊ß]ë¡P¶÷ããUòÓ˚ }«¯h«èn¥L‹-ñ¢gvˆ∂i~…s°ﬂﬂ™kaÑà„F.Ö»Vıp4á¥Î†Ûc5áMN’$≈∑óÀÊ oæ(™‰òÎä›W€hÖU}V˚Lµ=$∂aqNçømã≥ââ[¿V4%¨!Côf0ñô∑#Òá¢`wÆpHf⁄‰|f¡ÊõÎ&”DPñzÉ˛=;9ËÆ‚’ÈŸQÉó’j⁄©âq¿é=&6È∂¥≈ï"U%‰•*xï:La”;ÓA¸@Gcß<≤éª˙nP∆∂™w9XˆîA2˚c˙œﬁ‚Ì¢•‡]ŒVNw%Bi;ˆ;Á %zWÌîp<tg,0ï÷øﬂUTÁhÏ¨:°L˚‡˘ÒÔ˛ñÚ–IrMﬁ∆…eêT{ÜUNŒ&yBíW≠J®¿∫¬_R¡ı∫∑[Ìˆ§30&¶?Xj]òL#&∏Î<fπ÷*ß•6dﬁ˛ì-
ÉDœÑ+“N5¢\ZâZp¡»¬¶m:q?úù3É§ﬁjƒgY£=À⁄É)íñ?˘ô¬åRÒà éQVmzZ:£_ˆ´ﬁ|	Ò{VπOKåVÂQ	~‚{Uãjˆ´9≠∑‰"uŒ√‰ÀéΩØªRt§.ﬂ¿•Ü¢˜µÖYL–b
tôøTÀ7œ±kÓ^v≠0PQΩ’üvmûÕ´|ÀÍÓÌw≥gkN„-Oƒ+™}Ÿ™ÊV5#πÁŸ£\õJ81èΩü¶3úõ„≤ÒpcdEy~&«ÊìOî€‰¯.ñ®ÎÎ0eí¶ ±á√±—CÍFŒå¿8Óh;S&j?˛è¬üô6M_œêf ˘õŒä∞Xw∞ˇ¸ØheîøÂ¨(\N˜˛L\I¡M{ãSg'u\eÀO7Zå?π*◊ë¢ÀñEKøßV≤π‘±|´-)ât3æqÌÛlœ‰{p/ƒHÃw¬=X«”Ÿ a’Y8 øãPÛUC—;@´RÑ ≥Û:*è=±¯p
”î˘ŒÄ®)π˜œ˙«ˇ}fúΩ˜KRÒ‘…ƒÊÌ¢áˆ>>v≤h89ë•¨¶	rBœˇäG†≤ëàõ&¯é)õHclóNÆõ/Ÿ=≤Å©VÊ
˛}7âÂ‘≤Î
ÁstÖ°qË—◊lì?¿voU[ïh1W@Õ◊&'TÎ&Òê2i£tâ£◊˙1@€àú+@ß,
z/onH<:QvΩJ⁄Oöù”øZ+Àe±êy–;≠ˆÇ¨ΩPV’Ê&Ypá‰ñ∏,hÒ“UœÂ	Q†§≥ö‚ó÷=oÆ,^ú9c5Z°¨Áq…cU8^ñ«¸—¨∏ÓÃÕrÃ8√û<%ﬂe∆ﬁìgãY”É3WïO‘WR~ìD.Rí às,Õ<	XêM∞DPªÇPÒ+—£»*⁄ø‹’§‡Fg	HAë¨Ù®`Ör”g$<^∫˜	¢Ù8A€tM¶á≠YŒÌI~›•∞˚‚»«aà°'`†˘˝ÃŒBû÷¿íq‘Ã+—[◊€ôG∂°±ùòÍÌ√s±û*≤è©èv4,⁄%-Ls]”ÖGâîﬂ∏ÊnfF¡í”BÇø÷Wúπ¸\π¶ôP–˘]"Ω@≤Õ7xπU'ê4QPŒ„ÁeŒ7Ö®”Ù|Õ>’ÉP/Î	`kFT”‘éô¶ºÆáËeßF≠ïQ∂¬ÿI±ETxvÊr: ]w4Î≤qª;ß‡ïÔë˝†Ù±ï|^¥ï|^;8®GÔw/t‚XÌX§à~<ºs—ÂüÖt~êx'C<3+Ê…5f:ÅíP%‹f-«@~Âg≈É˚2`sï+‚:<»eÊQ“–HA∏úMïÂΩnçuæ®ø†•V¸÷Jﬂó•L˝µæ9..$_Úúótôñ∞cÖ†„∆%Ô"?Aı∞ÚÍΩ„¢ÔÅz7(¥—ãS`F˜QÊ9zœÏHUH∑iÑ)ØË¯s!>Ãæ¢º˙ß∫@ÍÚ¸R¡xÕ≤£°qAÛ‡ò_\69~#∏Ï"≤¯œÑÓqy˘‚¸®ÇR¬0ﬁmΩ= ˚€õ[´d„ı˛∑dcoks˚`øt∂qà®‰^!¬œól±–l¨ÕzD8„	¯i7ëu$BëÚ¥*Aà∑%ã≤¡µudÚD†[ÔìA6T§4ú±≥9).<•dÊ!0zˇ¸˘R…fèó\ƒ|Áº-'˝Oõj\aÚ#/o/9èé¶÷ÌZ·ê{n;‰tC©ïÂvçr∞#R
ıyRö'ä∫‚£≈Åßñ˝ùß˛ñPm^zÖ‘Zw≥\yp¬ˇÓo«1ı)‰∑Bl©“bD&£íÖ($¶Jcˇ^∑+2ø[k>_V Îb⁄O!Rw£®›4˚£dÿ•,PPáŒ§±:e3É)9»0â‚Ñ–£$äª5∑ã˙–≠≥I©'ùr¬aØÓÆæAHÌ’¨i9P∑xÅÒ4Okä®bc˘Í¿Ó@&ûœ≠
ÀßπN∏0Ø%ÒË›>Ú…|˝Ö…±$RµÒ∆‡aé0≈]
›IuÄz¢ó∆|hsD+∞¥ßôı?ˇÈ˛o›ùbãÛ;≥æπ¢;#∏sÇ;^-ok¬π∆Í–Ω≤OTÒ∂v±Û˛}·ô*ﬁY"‘≥q^+5Bq=%› ¢Óm˝Í≈ã=ëyû	â[É,π◊J–føV;U©A·vÊy;◊†ys√¸1èû õ¡¸Ÿº^8*∑'îÁE·yÂ®æ ∑-ƒYáåÏhä<!L5È≤ú0ıÉë≤p≥ ¢èÕb£˛·j$ìFz!&Ño¶É—ôà ””Ne‡ò]%?4£Bƒá)Õ|PJ¨ûfö3*∏Xº’∆œ}Îz¯—ÜX(ù˜q7\Âo˚"é∞ŸqÌ˙«s'”‘zú°@ù∏Ï÷ñã¯hπäb?˙™ÎY–≥•ª `iµ˛‹’¨2Ám‹:∂ÆJ%	ËÛˆ∂˝≠PËÌÔnÌlnÔ¸züÃìÕ≠7D≠á⁄‰…ız¬;…G±'<éjiˆ6√TÏmâê≥,ZÒTî{“õjÌﬁƒûúu¥{U•¶¡˘Bº @ªÈ°≈c¯/UJ˘«ôöî¬#,3°dH7 À¥˙”óM(q4"ﬁ¬Ó¶˘Ó;÷∆¶äÓ?gIÁÜ¥Z-Ë‰	âR>◊´¿¨Üﬁﬁ!ÍÛy% $€Oó:"rÚE™Ç∫QzBMÇøHBπ$¥ªA©eû≈Tên∞è˛˚vÓg"[dM·’ÏÎΩQË∑\R“√t|nY	.â5£Å®º∑√Øø¿wffùü˜àc»xµ8ÎûüÓÃ" ÿ®…Ÿù·˝ãa∂q‘	≤L˜ß˙)±õrÚ5=∫ÈIz~a lÑ‹Ï√Q“9“/JTÖu†€ñ¸ÇS
ÜNT∏ƒÄ‰ÛØgoIêÒÈy<‹·ôÿã—pÿã¬Dºdæ0%˝é≈l4îê∂}-D]À_µÁ/¢x∏˙9≤zs$¸∞yÿ…õı”:W|ÆeÏ 's8´´aÖT:Êì°√€s∫ﬁó∫ªÓ3¶åñåF!Yäù’X∂hm6±2~ê¡(T{„*•C™F0b=}h´ù/Kplm>'1yhn•Ï≥àS·¬zÙ /ﬂHã\È∏±7Î«ﬁX∆ªzÏç¥O±7û®1Il°=~ ébéﬁŸ¯Q8^,O1
 ‘∑î5§M’≥Ú_ûZîéÁSä“aw%)w`Òé¯ÁiFmŸfES )ìOsã=§ø’–ﬂøÂU+®R8«∆;g[Tû¶lŒ∆åe‰mè‚Ë∏≠lﬂ€”FA'\Zñëô´êsºò˚åk®Â5$º/ÆÉi∆ºâí-M«’	ÀYnÊ!Up©Ô°˜Ì⁄p"å˝◊„`y$q©æ]ˆÒ9üÔ≥iü∆`˚\!˙îò|‹†ú†_¿çIYªÒ¢lx3y•ÁÍ¥‹Áƒ˝≤p§Ûãz ÄJå|M∏Ùª•C`ﬂƒWµ-g4%åá≤qÅ˘·‘Ÿ\GkîüÈÍæ◊èwÓnÃ6/›≈l&ÙN5~iŒ©S‰Ñ+?Ús7I÷¶xº1J√
ô¢Qw6©-°Vï∑QÏFhn"eÃÙŒW4∑9”"`#]ˆE©Uéù Iûåïó0î±3È0Ï`û FkŸ»–i¿_{©~ë…*I….ï‹¬$ª&òÍ{\√;?#óµÛe∞o{ù4Bó‰aÊﬁ”Ωd=®ó=‡0FQRƒÓGTqf…Î¡M }M¯&Ún*#£™ﬂ?≈Òôuç˝°•ÍÍÌY…¨7RâÀ¯Œ¨€w‹_¿ñhŒ‘ RC9M†Vöîµ˙ûöchq'Aá›‡îbhD>∂y⁄(!¨ÿQÜ™á¶1T€˜?˚{·)ôß¸Z¸IÆ<òEñ3„ÏM	‘Od˛f¶‡ËˆÊ·L"Äzsü+∞Êû“◊–‰Ê+'U•Ñ¥\¡Ò3£¥bXÛL≥?T”.ºgvÊ_ˇú7˚¡ﬁiWd/<£ãPÀ;¢àIW!K+∞È.ÿÁÜfT”Îw√“„Á}(ÊÒ ©h¯{:ücù∆≤«∏i0}©hÛÈPA<#√'ø'/…ê$›∆Z∂®úRÅMx˘ÌnçÃÊìÑŸ(0^·?±tD@∆k¯vÆ1Ü5‚œ√Ò~™Üzz√J  |YGp¶ò≥°—‘¨ö~ÆÀ˜›Î°¯n,ˇÚ~ŒqÔ’ª≤/ãW≤xá‹˛˛$ÆeèÛƒa∫WÅû2¶|„<ú—y+;Ø©ﬂÏƒΩ&ållô^SƒTkœ/ZÃ¸ÀÇnÎ•[≠†!(õ‹^x:n⁄æR\R¡NC# ”˙èˇ¸Øˇ˛oOÑÃı>J˚A÷9'ØG›àNÙ$≠1»§∂‹6ot;Ë	LóŒCiÚ>¡ò…eêí ‹7i7˝`0¬Ñe◊+£Ö”N0ÄÓ#[ùÔƒ:Ï±Õc}îÏã¸ûÕ∞∂‘êpò±T9jLò$r¸⁄ÿBçàª∏‡Ô„.ªÔüÊïˆÔ¶∏%<®ß|˚Ypz:ı” ?9VøÔbı„A¨¨’A‘[/^
K…j-∑sP¶ÑÓ‚Ò@17_E“ù∆ ºƒ{"+õS¨9◊:3¯£177yKx^ë⁄ ‹÷î YEû`2,¯|[j\'ë˙’j≈ú≤∫π¸Oƒ0¯π©ñï@_Æëxï/◊HüÒ	+8¡pòƒÕÿÕ›{,ï°Ï	Y∑Z´˚¬cuÛÈõ[{0æ∫©jÀZOcß˜‹Mxû|ûGù^Òu:Q–„¡’ÓÔv>*ÂÕΩÖé‹∑à]vT™pŒåé l2Y…!√∆1¿bùº(`π“2÷`W¸ÔˇO.≈◊ryﬁ≈gûñ@>∆^X“K•Bf_ë5 ÔÎXïÙI™7,∫P>w{·Yî“’E‚XdﬁJ†‘Ñ1e‘ËÇA±√tcﬂd÷5Y∏ﬂ©ﬁ≈È@:Ç^‘ç≤±ØÉ`ÏK0˚Ìf$(òQÅÍ¯Qyë[“$« Ôå!ÓX[L¨î8Qì˘¯9!–>Ã2ÿ™~Ë∆˝0ÔºYó‰S)ÿ|;pÉø%ü˙«‚Úg∂≥∑ò_”Á^
Üˇ¢–¬˜∫$et3â.(›ØÕ◊ó‹Rÿı¡ãî%Z˙‡q“òLÇ%|îPÒNÖº‚ù¬ßW[Ä˚êÔjH e ÔÖ˝ ˘î˛‹Q&ÁŒÿpÁ…NúÖÈt—Gÿq`@ÜûÎLƒƒIü ;‚éä˝,G/˛√Ø˙®Äyæı¬{]ïd¶í∆…é&˙¶üY? «*·ÀX≤$ª´w≈∆∑ñòVXx)JbÇlK8¶ﬁô+•ˆ¥X’O˝Ω—¿ˇ§Öı3°0óûE=äUÈøA©Ò:ÀÇƒyª¶y·ùΩõ∞–!ï
ªw`ÄçÇáHÍ2ÿVäà∞÷Î§=Á≤¢ÃãªJÄÂ”v?8Á&‘°¯˙Î’∂dˆÅ›∏ÛéÓ÷Uí‚5”·±é=áµÿÓ≠©4\´µURÖ´˜äNÿ∆WGí√£πo¸√Zr”…ö¸ƒßpe>@„\◊4f∫æíc_=JÚ"CÑŒìMû"*%çæ8˙én◊Wìß◊™V˚⁄t°NRù“Ì∂ ∫V‹SŸé>vlk¨€x¸ÚLÇrR∏bÅ ¨Õ$≈(0TÎOH‘Ω#Nka<,÷¬ƒ7,ík˜j≤xx‡>¯Â´~RÛ)È¯éû∑ê≤è±ü”C
¯—∆◊Ê£«nì±å¥ F\ô5‘0v;;#Zõç ìÕÂ‰∂-ko£^x@§«yJŒÈF ∆ !^≤ƒ+îj bí«dabõ)l∂2<I’„u±ÿÛX◊´u¢NÀÆÃ§¥ôä«Ñ§4˜µ±ØéU«„™-¨∞<±F\∂3⁄«PÜd˚Ã'ßÅ?&= G
∫—>ﬂâÑûjﬁ"SÌßøç≤Û∆,ƒGXçÄΩöE.›VÊ<ÀÜ≥ssåû±x1€cbã°«√ÓŸ¬‘é%¿ó0ïñ‡±çƒòƒÒ2ß‘&‚:"*)!ò‚/°§_πODd√…èDÒîçÌ¶p*¬3ùeÜg-ÍüMo©·IìŒÀ>‹1Ç–ó=A/{9√9rŒ¢C>A¬h€£“i©‚pu£õnê—@eœ”8ÈìÓà›Gc2NDÎ¶H~Òh  '·iò$a≤Sº~93àõ‚’Ù–{
ÑxL˙FÖí∏7 Bô5∂⁄FsëÓ\üQÒvA∏À_Wì πT„)ÛJGh™$µΩ‡¶,¥™É)U8^EyÂdOi!ôª` £¡m]áß	Qı‡ˇS·.˝!g)”l]—ü9≤8;örõ˙ösÌïìòrÕ}Ì
1ÏUvPÏπ°¯*-‚‹âraeÙu¬èÍfx*êÊ Ñ⁄n‰µ!Kπ\ò¶å°¡∞‰wq‹à9•¶¶–Ã^⁄∑$Ï—u|†<2Eÿ%5>#Áïß≈€ÖÌî æ0uê}Æ†Íü4¶Fw\Eœ'%rÎäN¬ Æÿ∏÷í¿¶IÏ÷ÇÈq1Áî_π¶ë xg!Â†gÍ‡”Ÿ.*» ü√≈µA,˘≠;õuWziN ≥åI√Ig¶√Nèd¬≈ÛÄÏÑó†íÌ˛   ˇˇÏΩÌv€Hí ˙û"Õu∑».ëîd…’VIÚ ñ‹ÌÓ≤Àk©jgé 3ÜHD$ÿ (ô≠÷3ÏŸ=˚kˇÃÓ9˚˜yÓ‹yÑô	d&@Ç¢¸Q]8›.»Ôåàåàåè;={CÔ´ß∞K’\6–≈…PZò4∏≠Ç€ÿ›ÆåjW~«{ëqúµŒ∞]ì.E’ÌïRßêŸı˝•KYQÿÏè}b+Û,πQ*Óyda:•tæ–éª"õ⁄ £<Û∏(Òµ§F⁄#Eœ¡æGVˇ<˛»∫·t$Ë€ﬂ+ßGπ*‘NK¶EÅ∏uZîk7°ƒÜOìÂ˘PñœÑ2ÿ)ÁBA›˝“…Pûl\ç+R÷Ä°%Ëz:Ÿùc∫™§&;+Jj2~TŒk·`më»¢ÚDΩŸœ:à<¥†–Ó«è∆P {G^ ºNEËä‹¿ó¨ÙEú0ôSÊdoŒ¡~ø…TeÛ2I∂Íì$`⁄´ª$IH'≠ÓOv“ñÅÈö#¿∏ˇxu©*?W#üô¯¿ÂF"_ˆ°`DzM†è6b"®§øˆ¨™øcO]Ï–ú/ËB@È—Qæ#eøä·é≤ï°æW»3,„Âõ2˘Í≈këˇu©$ÚπìJæj{hØ÷⁄NêÛ´IÆ´)S¯BÁÿÏÍziWúln∂¬?’™ìGŒ™Iü∞J˝¥Ω•–tÍHú˛X∫˚®Q¬ùrÿÛ˛vÁ y≤[¥˘c®(·!`3n∑ägLò hFÜ1é@HFúm>ZÚ¡µ–…pùK{ºƒgiΩJ•ﬁƒ›µX|°‚®æf;óaŒ·¯ÚıI˛Í[	Ï:nî=Zƒòú∆ﬂ¬ÓZÍÔæßVqÔB*©tÉ%Ö JDs˚ßªäPa √ÓΩä}/¢È1¬ê…‹Ép¥lö»ª%á¥âD€wâ>{~»{ê®Ú§”¢U≥ÅlSÚ]˚¥π%h⁄“ﬂ*∆Ö-8Å8Ë<?Å¡<f.¸:µ„Ëf‚Ó∑≤J±4O;(Ç/•ÏEb|9ô≈I∆ﬁ¿?^‰&™“ÿñWüÕ#â§èañ#≤qÄ€à”,]g≥ K–jåÉp≤¯‚„+äòﬂ©√·¢§∂»Ú"ÔKì¬w/º(æn…?L1/ïø√˜Ò$f<¶ˇ ∑V?…/L~Æ%…4ª—˘ÖÑlJ⁄
ΩñŒQèõgsù·¸œí9ORÊ@≠ 1´©ou)y¶™g¥™È.0l◊SB‰”`2C¿rˆÿ∞&9æÏ_& =∞Œ˝,ÓóÇ¶' zzè\1w!Æ:rÏxTäëKO'Òµ8®H√ÄÔkœG<«∂[ù±≠w[Øê∂˘W;ØLc‚‹(NPZb?
îHÄ£z⁄ú5µ4Çˆ"eC¥›n‚yÇ¬%™:.¬À9FÃÕ$(]áŸò=ò Ï€|2ecﬁjä◊$pzAqÿVÔ:
R¥ØÖs>∫£4µñ10ñpü…œ_LövC"Lªõ—FFkã…{1ïy¬¯«˘	¢‰ä∂Hï[.b%∆Fø
Ñ…Ë≈∞O˛Up_*8g%ùÁ⁄>sp“Nåm81∂[[∏‰m˝Û˜'ˇú”µ ’∆]§çØ“_é»'£q0Òÿ:cáJÊ‰Ê@iyø¥…ÖOœ€∞–•h‚ÉÁ‹	ÕËFò=Áx.&¯[ˆ" ˙ﬁŒ#åœ–Ül5Ñ€d∑îZ≤-a∂›∏+˜ÍR°ÆŒmÈ]◊EXU¯kûßZ3˜%1ÊLÄèèPÜ›\iLF-2N;Ù‚¡¡EÁÂy,íwYOyØÆ|RFaöıÅÖÒøÄï§Xvó¢`X¡xzŸîYWúº<…(’8ÿïb £¥ü›`p9`ˇOˇ’´˛—√kD¢8¯π∑7ÑŒ>Õ(e¶ JÀ&«*+H'LÛx˚üp\2Kñ8ƒá∆Ü¨]+òrKk·NÅ6…sÏ»≈˝C•‰>fW^4òÄ5íN˙%˜o8èñäNÛ+-.ZoCãsqÈ”ì‚fBó3d'î©Ë¸˛ï"◊#‰€◊:ù;…@æıümÓ¿†.√åaÇƒD	& ˛”'$t≈m–`ÕZµQdá*öËŒAò≈ìŸYøÇØù->Â1£Ñgóãè¡Ç◊·®ôya≤.≥"¶ÎÏx!à™—O68ßÏµ8‰ƒ◊[ÆºhÖG£SVˇÓYÜÑˇ‘Ù˝ä∑ßé8à—^ÒÆrS¬æBπâ[“rÅ,foº$Z IëwD•ìÀÍº]2‚áiŸÕ˜R205ÑÊAS—=“mêá≈éñÎ
ıx3ÈÃ"`Z‰ÍJ
r˛j+“qÖΩq‘n‡IªaÍ‘UÁ2”¢¨êoe2íßµÈ»&ÜƒÙ.È“Øv)ú øºé‹¸H˙+û'Ò5¬JÀ,Rçö¿mS»yÊ8…R6¯•◊È?¸Vg0JØhÄ)Ä<éjkÁ’≥ˆc
ßpÇ¥˜k·Åg∞˚%úbº—(òe˚mN8ü%⁄RVî_?/—F<Â)wˆo∫¡Ç_Å/ÿ>‹åf@[Ùt∞t¯˙¢«`å>ÜÆÙ|§Y¸e˚6kÆˇmO§É#È·P–º˛ô•«K∂OwÛÛ*»<¥“$˜ÑÂç•ˇÈD—√mﬂ˘íe	πoïAEG7«É\˙Dr—¸˘8}X.)bÖ»Ve  B„Ü2Ï˚ñΩÖc·ƒ∑lY°B46M~¯R∂MéÁq±qoÇ‰±WxuØ';ˇVŸ∫+L}9∑NfF©JÉÚElç≤iˇ’K¶tô»—$H„Ë*óJ]ÏºJRT±{◊büsì8µPKz˚•lFŸΩ“ „$AÊ∫{Ú!Ñ⁄˜ºw4uÎ¬ÈßAΩ∂bÌ˜Ò%{ñﬁºqfCTú√é¶Ïx¯~•WÑ∏ƒÏÂ4≈ãB‘Äa<∂ª]	∫®ÑMªPaı…ù]≠d+«ì°ï.jíó¶éÈõmÍJB>d`ô"oñ.£®‹À–î¬ ('6+“:i"Ë§ΩY£miıËìÂ}‡aÍÜï)ﬁ?„%◊˜·$‚lº⁄∂˘Ö€™[U/»V›v~…5dxSµÍ1Âˆ®úÂÌıÓcërrÅRÀ<]æ®πÃaÄgÀ‡ÁyÏ/‘	ÒlÍ/ò¯£@V(pπâ›–/RWi8âØ◊Yx«H√Ä†"B≠¶›–çX]<wõ{ÚM≤™«ËAg70√A‚]„è[ÿ†%v«e Ö˛ãwHG Ô—Ô≥SoöötŸLößGYøéÔqLì¿ÁÆÓxuè:paû`_Ë/∫÷_ª’æ›¢oOŸ{÷}h˚t€√kv ç≥æèu+dù‡~Á¢Àn¯ÌRWY “À:\⁄L‡˝ùé∫[wåzãµ*¿JÈÄ‡⁄5‚Í[¶•Æµ)a‘;Z".Êà¨*‘t0∫•Tª¬8v{§ò≤DÛ∆kÜ:›≈jVkE1¿V ∂BX_%l¨»Jº∂è’¡_°E1†/◊›Ï—,£ …Nì–õ^örSá¥eRß"”_0©ÎY›íÆ:*g˘bÌÏâë™⁄ ûúªÑ;„«TúÒrŒ6ﬁ›∂æT´Áj"Eﬁn
mÃ?.nÊ*25•vÔ˛0Ûü´∞QËÂæR¥◊
Î“H˛á”Ó⁄:[Î˝“pÔnL‹rr4>Àd—ÄﬁPénkûDäπ/BìÀ˝Ìñønu˙Æ8À˙mrs:˚…™OŸgˆ«¸¶ª´;9∂‹~=R‡c·UJ¶§òhrá“ı±uﬁQgÉ'øØöf{⁄¡™0 ;
/»$ûõÇµ ‹∂©mÓ∂…¡«`4œt Á˛ÊwŸ“ﬂóú‹6Ó‡‰F∂p^ã.-nl[´›f|
/jÂó}√Ù{Abn6‹W™% -¶£qO√ø¨v∑˘-Rî%Aö≈…=ª≈≠†XkÀö¬Å˝é∂5ûÆñ,<úf:˜"ˆ&â/Ùg}Ê’GqD+≥T€—aûM§pôÎaº!ÒŒÒ‚H°@òÃ◊∞mÈK›±ª≤≠€ﬂ|‚ÎıÎ‹)£|ΩH_0öK*°Õ"\C8ù∂OÑÏ®ßÍ—/	UbÀÁ†N®} o%<–uËg„]∂∂Òõµ∂&~¯(ÉDKÔñ ‡˝2-ÑóiY0≤kmtV€” Ò˛0ûQäh≈ËM$ì›v–˚ÂkµÖß9È¯Êt7” å¢£c√…'õ8Óümm€Ïƒ=H<çÀŸ‡•“v3c&‹·‹„Jk=ÿÁu¿5?X6â(-ø”√V¥{=ôËË…“˙Vú¬?kÇ^<51%vÈúÒaPñ«ww—
‹¿ |íËÙm‰◊/3´π…*°ÎVdÅ´ Õƒ2’ïò%%éP™L|q”5ÜWÈ¸›ƒ¿]èÕ¿¥\Q‹◊À◊,⁄Å›úﬂRÑ]&◊ïÌÜÂ	åˇâ{¨—Äs_‰€14YÁ@a˜Ñ‚?hI∑Wò¶ù4çÄ´@¿X–q*ß—‡¢˜{›EØ^Ó*\ˆ‘`iâ∆¬)¿⁄£Ë§ ['x-œ˝B@c¯Øw∞7QéÉT»5™kˆcé⁄öh‚—{∞9ZJCw4#%C’RxE}o&åW‹Û9j,Î`á=±¨PàÿÈÜüJvï¥u≠ºË>€>æ¬¡P^Å|ÜùîÊ…˜∫u≠pø≠ˆ–P∑Ûi´	¿ÿŒÂÏXÕ¯z `@‘w G¥Ÿm—J!±¨=êjŒ∂Ò°+îú’U£z”t∏-ÈKÛ!7É}π√‰Û(Ü1£€Ë€‡N∑1;Ú“ÒyÏ%n◊ãÓ»/*ftÒï®ª˝Óü˛)¯Hº˜◊îA]E0Çvó[8xÒ|è£çH≤kñfgòéÉÛ,â1Û@∫ã˙7¸ÎL∏|∆”†Åu)SÉŸaÁU˙≤so:
`]„À<¿ÖM\üÅﬁL˙¥‘≤Ï√∞≈ãÄä@u|}{¿ˆY˜FNl=¸∫Ìz>êuÍxΩ‘4pˆnΩhú~≥[ÖÿÕë‘æ|:	_«ÿÛ<Ùw·îL É÷Ÿ0V˛2ho†tké}l•∫AÄï5 Äw.z˛≥≈èp8É¥5Áˇ)}B¡æQçöV∞.π‘∆ ãøèØÉ‰9‹<hÀÈØ{yÀ
ô3Oh	∫ÍtÖ Í¢<Bp±4gòï¿ÎH≥_àÔ`ï† Üµg@≈A◊<–≈8ê¿®üb`Â√c0Hÿ)}ìA1vÛÙ9ÚôõÆïkP—”¡@V…_U’	¶>∫5ƒãöÚz‚EU˘‹æ˜á$ºD_Q≥Ù	€(}lhò˚ú˚•V≈{¨MnSœUM<´\oΩúæ,Âoº≠ë€voM(÷Å˝ïóçxº≈ì.Zƒ
8Ù∏7HÁÁÄ¯›≠uˆ§ßè3R±[¶ÑOà√|råøòJkÊ5£üÄd\3ÑÍˇÂ…b0ÄYf›µ”µﬁŸ∆;Ωfæìª•EÃí©Ìı(¬¯ªØâûôﬂT≥kÀWaY]˛ÇŸD∏E1∆˛◊>]yY≈≈πÙÕ“QŒ∏æ4ÉwÕ/‚ÑxÈó?$p∑¥U%D¿0˜“ZˆhÈîgìmÃ
…1?Âî≈Ú¡^√B+*ä‰Xo¡Ì2^◊7"«R†¢8!z˙¶2V”+o:˛tqÏcz¡uŒÊ€?™GH˜¡y@–°gPıû8ôxwaz,ñù∑ úƒQ‘r:Æ…Z”@ƒó,÷>{@Ù®ó:
PÅä∂æè—ÈJ*}√8ıÜƒöA™Q˜ f^ÜiXÚ‡«î˘-?©PŸOÁóóAäò¢Ù,^ e{ëƒì£•êª—0L5ÚèÚ—˚@)ﬁìDtm≠†∞º[,ç+Öı- Á¿\_®Q™ƒ5 é2ä/√ë6làˇ(ö√_›5o≈ÛâxéÎ'?“äZó^j}üï”xd˝‡˘Ù•ÇWY√)ØŸŒ'u]xê≤•V&°™÷ë]Ñ≠Ô'
}S‰ß≠ﬂKÆ¬äoì`Ë⁄ób6üé`÷ˆöŸ¢ÍCXÒ·\:>€G9ÛDõ$≥~éCÄ4¢L÷œ—¸CaN≥Íù„õ“∏w2∞‹RªG«¬>?—Æ˝cF
`•Ììß$ˆ=ÚfÅ\Ä.Yﬂá”÷˜#X˙$Ù+x“¸µW±≥óI<™;ˇV5ÒkXd˚≥¿≥#®ZÃXlØ˘áXW?ˆf’p#¢rNQMÉ¬ˇ˛∫ ¯!X\„]@ƒdﬁ«–:®˘y≈¬¿>¡ƒæfrˆØqdßÖ©Övòò 9∂#Û‹æ°⁄^WçÓ™Ç£ÁyPÉª˘“jõ†.˛èYú‚≠À™F¡3;∏Xsl?äÇk;p¶U.™>êænÿWÃü3˚·ïÖ∞gûΩ“lÑ§•`⁄±tÊ¥~ˆ’òÀµ≠ﬁ†|˘+7ËE˚√W0¶N;t≈+(˝t4Æ`–£˙ËπR˚äM`T¸ÊyB«äaÔ*â ‘Ÿë
NÇ ôx…áä]y6Ï’p!∞:Ï∑åñ”æ‚ßßÎuì¯¿fr>˙U0âK™—F=K⁄ï:¢ÅØpö¢◊ıBÖ§~~◊+¯eÒL2∆±∆ªZﬁiìA~‡πR‰A'∞“à`@Düä4#\¬`ìÿ/Båwπ AÍ7è/û’™†zP%≈ ßØ≠¸ŒgîÏàj)s€ÂYví°èUÌÖ_Ît^j/∫Œ§◊3œ'\}µ¸:´öÂ;]¶√‡/1t„€‡ÇÉ¸±˜«”Wﬂ”€„(¿Tê<Y¥*6ç<¥ŒX™ÍY:éØüS}íOÚüö¨®ﬁ)QπÒ‡rñÂïãWM`Zõóò-5◊tû™o4uÁœ´Z®ó'a°^f∑BeoõüP8êÜfΩß‡/¥!Æ≠È5A“ƒ|Ø‘…‘Úg„ @9ä√ƒE˛“&$F^=n" R5jÈH{UßÆión@âÎ-Ü¯ì˛Æ›@I á"‹^.ïÚ ∫\JSÃ¬Ö√]áR	
€âwM◊u6î…%k7Eí)}„ΩÉ(âç‡œâ*sc7√˝ŸøŸæÌ√ø[‚ﬂá√A»›M{yˇ©EP˛dA€]°Â!¸Mv°ùÕı≠€ﬁŸœ√ü˚?ﬁY_l≠oﬂˆç…MbŸ>˚∑uP ËO3 öÌ•¨°_œb[ãD^E†ÊfÀlüÓF◊“îAÖu∂π—clgCIl>yx≥Hn1pƒ˚≠˛∑ﬁç~/»◊d2Å6iàÉ⁄œÅÑ ‚µç5„
Y,!jÅ`ZÖ≈VºßQÙﬁL&¯ØÔ´#≤Hºè≈ƒ∑o”v√&—ã“&…ÊÃ8Ûo∏5˘.¡‘põdùÜYYóçfjY!ßπ”Ó‚ÁXî”Ås˙µ˜∫À.“±v{U|í(ÁÑâ•õÜ6®|k'$8:AH≤F2íY’sàM
y»Ïƒ·AZ£€Û&≥IÍÔäﬂˆ~N◊ı&üM äB£˝ºâ*dËô¿ˇÄkıCÃ„ª_Ù˙]©¬8û'©äÕcBÊ2YêÌŸ¥ª≥	∑Ú∂ˆÿ&˛˜7˚£][û⁄æ)Z€gUx ∂Ñ ı ø8b{A|ö∑§ÑŒ€#¢œgõÔÏÉ°è[ÔÏc“œû√µû"…≤D§Üñ }«®\±©ûs†§”÷8>
ˆñ^¨eÒ≤ßÔSIwú7ù%Û¿Ñx4ÆÅ1¬äX≠›2z/)ÔTÈÇø~_•óΩCOVΩ∂ÒA’küTΩ∂ÒIË¢-_Ç  XJ≈ÄÒI’Ü€Ü∑fµ∏ß~Œ£Çwà„qÖŸäMº*ôw‡ï∂ih°p Cï[¿‡cÏ3ZM a±lâVCïM¿óJ⁄jÄ^Ã"otágˇÍıˇ∂—Únú¯özÏÀ%SÜ\øú^·YcTñ´∏¡ÔôPÖNì©•
›€äüÃgñ‚*ƒ[kaí+K5Å∂*2WIπ÷ˇ¬ÉUŸ™í’È≤
e4{*W›¯`ØÃ“Í·\Ñ»RóJë•|)n∫yÏ¨Ô4Ì‘Qò&¡%¶ˆπƒt2·&:Ìœß·_Á£Ì«⁄‚âÌ	ŒRcda˙^]FÅ‹g$@ßgkS#O†£˛w‰•c¸o¬)+˛I*G¢Ÿ¯è¯ó˛S›9/ÄñÑÄöÅè?f^ËØΩ+ôw©NQ@∫≈∏iÍwÉèaöïòâ?ÚÎ@1©∞\I·5d-÷'¯® E—∞%‘:
V‰uLúPÀ+hëóØ@
≠öÇEΩ2V®uƒ»´U°ÖZW`F^G«Ìu=V®çjàQ¨ñé˘˚§à±9`«îË˜0Àº—µ7<ò:P]<=•◊ã∞!{sÙ¢WÇ°í4ß ëW4å@©d>÷Ür÷Âôr¿0òÑcÛÕïÏ£G‰∞4ß’∂I∂VFü€“np7$XQ	Œ)ÊéA%c@ëkﬂ·e*z“dFå© ’•\–ß	`à?‰;>/¸ãST¯´ 5Ù°«ÅJ˚¿¢hˆ˜øó¶ly∫Úd‚CÂo≈ O1
¯S¸ñ„–>â≤-G2∑dn«¸>áQ,»|ıÎa`ª‡ùì©ä∫Ç'°!à?¯´IˆŸNÒV˛≤“<oí…∂≈~¿6x„ 2ËÛŒi§¯∫œ?˜@ €lÏX53Rôèöà+µ,ˇ y"˛i!w[ñp&*à›˜xÛøkñ~©3ÑtaöŒÅŒ–
_`Ÿ*ò˙q2`ß„`¡^˝xr ^ˇt¸ñù£©Ä8 ºî]FÒπáÊ˝î”œ#«⁄È†DUîÿö0±|æó≤O[≈[±»$XÚCí„gîˇ=ôP¿][QØ«N$Hã‡‘9A*ï«aÎƒ«6 |*©">e#»π¶m‰;bÌ^¯Í:âéÈî «Û‘⁄µÑˇ’uÌãÆâw8|}Ñ^ÜËåAc(U$¡;«ïZ\´P√:”6ŒóÁx¬B¿/˛§Råß9≈@´Ëõ,;dîÍ]¸Ï±ÛyqÑaC“ﬂ9ZhSæEÉa®;Ñã“</v¢ø©‹ÎNô«Ú´êUg∏Ö.‚è‚G@˝Ütå5˚ØXb∞8ˆSŸx _—0—ûê~ÒŸîyÆúê√6k{^Ö-xëm9ç<*}›\¯Ì,¢ª≥qª®Ey£rOSŸ0…»£¶k¯∆K–˝äaê˙ÑAŒVuO¯Üí$øQ∂‰uC‰/2fY"DivädMî[˘Q|R(¯#˝ã†‚J-Á≈Ωó¸!hRˆQﬂZKk,o˛zE‰Ì^Œ
cÛÌx{k’ÑÒy«çõH£íõBµtÈ”≈?ŒfÂKo´˜ëKF?:Îyö>>^Öo—.Ñª∏
Á•ﬁ˙™7¶¯†"œv't√–âıÒ6ø⁄>]Ãvã3Ωˆ¬å-ÜÎ°ÀÒ™DÅ4\ﬁàm√≤q_”Ì
WG8‰f1z†€>Y}ËÇeßg‚∞˙Àº≤ÔÊ◊ÙÍ\vïYŸS‰XN„aÇ≤_z(ÓYË8SºF|ou◊·{ ˇÊŒ
'ôwqaHÌÜ@WÅÖ==

¿j?'¢hÅ‰ä∫öëÕE∫â6Ö√4_ÕÑóÅMµ@áEÜ√ƒ.ºyd ãﬁMtÜﬁ,^ìp)É¡(ÎZﬁY∑lÚ$Ä°˘ª¨ÛÊáì”N˘,∆‰Ä’ª›y£Is÷«›Í@3ﬁåΩa<˛%çße÷€r'ató˝È‰á◊Œ`ÑãŸ>:∏XãH‡)¿»^.£2©j≥åT?åü ˛iW¿µY\÷©ÀGªÌ‡*k≠Õöõ,»RÒá*öäuAíºJ/°mG	Ú‰÷óõß(ëñÚ†°È∑A
≠”—e`G]„æù(ØŒ√˙íúKﬂÏuo—Ñ
N≈ÍQÂ-”ÕH
¿t7÷ŸÊ÷Üº¿>ﬁˇÒÙÙ„]>º…Wëª6-‘á©‘EÂΩ÷ﬁ?!∞q6â¯=MS,Z6¨ú\ÁM†É˘ƒ˚Äà´"BIr≈9ÈdN	q√$˘]B!¸3·Ñg¿∫?°+ª\…Z∞ÁﬁË∞©,Æ†¸ˆ∆ˆpgc£W ¥%ˆç≤îqd˘X‡§\Ω≈—ﬂ|ı¿S:Œ^Ú‡9&“y·e≈‚\ ÖñãGûO#§¿8éûyÃïÁd•‰˚]A#l∂áˆô’æpßñæYOÔY¸‡‰=iûg’›ŒUáS≠È>¬Ÿ≈9T√ì´bzxW-Ó∞o–‚íRÁﬁ⁄´ ÷⁄Váo>9é˝(:ˆjd(U ù/[‘Qî¸T∞v˝…ôkø|ŸœÅ´nMÑ+Z9⁄J€V•@>ïÍR‹ﬂ∂ò≥∏31M˜∫zâ@+?/œ¶∆=ΩÍÅ(ûE_Ö`Ù¥d‘µ+∆e8§◊túªâÌI_Û⁄NE°¢KÕCΩæ√#c’•3|Ì¬ãBZáÖ}›“ÍæŸDá™K´Ó¡πq©“Ï'l´«óÉÊ§ærá´∫.ÑH—b2¢Fªπ˜Sı\/>a*THv%©Äh	¥Ø’çh7¢"\âPYx∆u)¿U˘mF˙€&`≤8OS€çÅåÍ\´´ã€‹¨´Kó\Æ’ß‚à˜π∫~ﬂb∞”0RAƒI),+‘m%”o•ZõGp^bTé«ˆûáÿ±nóÿ*Àπ6¿9p°€ëZÿBfvAp•/ñ±kä*4òiä7‹ .ù√©ê‚—hû É|=F=N*{@…ú˝ÅƒÂíÊ¬òÃe¥(π•(CQ<UQ≤JC€#‹k’Ωc@„üñ<V‰c+ãÅËÊi¶Mœ⁄•Ó“‘©ΩtãnU í‹;n£ ñ≤⁄KÅZB©â¬Ω‰`∆Å≈XQL4 iPk· ö∞Qø◊∑ï:…Á¸éUH¿§bÖn“féß˙¢È÷\Szu•º»#®í¨8Â7]|RÅ?0Á 5îÂù·VŒ*î⁄ıô∫˜NiZk<Uûπ§&ï(ˇXJ/mKÙ≤I¶W¡˜´“ÖŸmj5\eÂsÉzkI’Vµ*aYï÷2Í¨zmƒ=™±>ü
ÎKS_ïœ8ãﬁ…Eee\F!\"s™≤ÉùœUıpV+˜™µ2¶Â¶Å∫ÌìzÃY0S(ûZ*ù⁄*úZ+õ⁄*ö⁄)ô h∞¨r…M±T´TjV(} §œ¢H˙§J§O™@rWiqÂTÁÏÜ“Ózñ{÷)∫"óÒ∑V©*"gÒŒ∫¢œ†'∫ìé®Ö~»]7‰®≤ú w‘9ÈÇ⁄ÈÅ áBù˛ßJtèùÑwGœ=©wnôPÊî√4®p\‘7mT7≠‘6∑•n‹’5-U5EW’ Œ\‰&V›+ƒGi˘i±†∫¢6Pä˝Œ∞¬##Úﬂ`iM[ês¶˙‹Äy»ck‘Ä©–be»T·ÅoÄ∞ø?~w´g–-é™®@Ô‘*≈äFiã
ﬂöRû@lH	Ã≤ø¡˛ÜI6ﬁ5Á…—Ú~<Ÿÿ>ﬁ 	…O‚Yˇ<ö'˝t«v'Uf$Ó®Mgß$îy©0z,£8ˆò≤Ì…Œ:ÉW[∂®¸JπºÚf^yìjZ+ÍIÚÙ@¸g[Éù›’E@û‹√Ûõ©ˇD}¯§Î0,¡‚KiT~/eúóìß8§.R∞ÄLZë(•>ô∆ﬁx´î©¢6PëÄÄ2i7dgπ)d¥5îWò∞]C7µCﬂœÑÛu1˙«[5)g*≤	Òüë”-√˘§spLkÍ√i∞–≤Ù»!˚Aﬂ“AeFù∫§"iFûCµø’˜´H°É¶Å(R;å‚(NR3ù	Øj§5–òNjv∆L˝éÈ∂Wfh©Œ¡PïFƒÁzö∞qˇÏ€ç´q9Îﬁ@<ûÙ”à◊—πWïBÛ!ÚCñæd§’~„MÅõ¨ ÉXJTsŸøL<£f˜≥∏üêC§¬ÿÄâïÙbÄ[ì ΩyÙ122Òzõú ﬁ‚?∏mòVã˛FùJ-2_z≥⁄‘≥5Y¬π96®À;dÆ»S≤)q•»Q¢$&q»ƒ¥˜céé¢p¶Cÿ@ÿNc án©Åö3Tâx™Ú´t ºÑNÇ¿l$nŸŒ,ÙHM!YïÈlÁÒ`ßs¿MsüàŸ8‰ ∂3Cı¶G≤·,§º®ù&ã]`Ï¢f¢•>7]g3Êû[∂@πEÍ‹aJõ d·4
ßAø|™!‹bÅŸG á≥Œ_É»°í≤3∫T·Ûâë”I…‰‰4R≠ô9Íö3¶µ,ÇZ6¡sÙgs‡ÿ[%∑‚«(·.ªqﬁÄ[KY°'yÕ√Æî=
”Y‰-Ho`-ﬂ„Å∞*™8™´nﬂ;fõuKI’êd≥°ï¶œ6∫I$˘:Òf9}û∆ÙÅqKÚ|Ì⁄%ì•sä,ºˇÄ≥áJ7ßZ*RÕócŒ7ØˇRi∏⁄⁄ ÿû÷v≠·§\”x5ØíCíØvnﬁõÄÅDkâ÷ñB-d
/AÔóH„ï3qÕ"ÿáé€[Œ]‡ºOYGKân0£∂ê#Adõ∆Œ,æ¸é{üª‘'ñÅëBﬂ‘Ù4gÕÿ’D√éxqHká«#:<‡_ßCA¥è˜ËíÌóCà‰Â–´¯ú{¡√7º˙Ô·œábˇÔáS?âCÚHóSÔ*ºÙ≤8!◊™√K§ZnTÇﬂ¨âûÄÕigëd}{+•ñMµ#É, .•≈¯µ ª¶MmOø\Ì˘J	Æc“ œ@r9HﬁÖ‰û¢µ2Ç"b∫“[≤Îk,ÎçF¡,€Ô–M⁄wÕí‡bˇFeñ⁄†Xák1õ{2Nz˜˝”Ÿπæª&ôˇKX¡ë7CQzøLØ¬$û‚≈¶„∫ÎÙ˘kY˘⁄|ß’πÅoÚ∞·ıÍÄä|·IúZ“Ö”€ú¿—/CÒdœﬁ î˝øˇÎˇˇœSÜºTˆ◊û%f	≠D.\Î±«‹◊DÕüéÎS≠]Ãi{Æ]ºì"—6ªV¶Iõhk…–(Ó‹Q°H] ¿ü¢ùÁ:Ej¿MaNÖMóy˝’ië_aı0πã¬ëF`S:nT)5Ö„aÆk‰—˙¬îE·Ù∑~Õ∆SŸ9©]Tπn⁄ﬁf0›ƒÒ7èàüÁNÎÿN<¬gÈ§Á\–π—,_‰,è1ÁyãDÂ(ø@’6
>Pe‡«£9≈5ºN`YªÔ˜¬ãÑ"”$£˝ŒCëªÌ0*¬i”~g£√“l·r—õ›çÔ bfª uﬂ1D˛◊yk9·'xq»ˇpœ∆ª@¸ÛÙû~tÒÆ»˚ß£®⁄¡ﬁêÌ‡}õÓnBã[1ï»}Ï?B!dìì:ŒW1‰9meÂUíX»1K 1FÆ˜
|iiGrsºÓ¬ä„Û&	Æ¬‡⁄Å†∏fÇ∑()@ñZÓÓãÓ%¯>Xµ◊ôm≥±<ï` wXfàR«yés"∆úÑY∆…≤∞¿nLƒ°f)ÊÕ)yÅµÈ†≈ï»¸˚ˇ¸å/‹Jµ¸h~Á÷`RçO{rçèA≤Ìâòr;bÕ‰1è∞åπï‹®>UWˇí/.‡˝züﬁ=6 ™Û›WA@⁄€`›)ìtk°≈=€i‚•∫±…5pΩc`U]IÖ;	∏∑•*q¿§óIË3¸m R8,⁄ﬁÓKsâÕ&F>ÚŒ1—ÆùÎk>AÑï¢WöDÿÈ…Kˆ:ﬁRÎ´‡±≥f–"EÈ~¡~†Â∂ì¢Y»…Åâ–7ö’û∞œ´qΩÏ≠&k–KöI©è|§Zc…ÉâyÈêvHƒ~«ÛåÆ≈©‰pcÈ.ﬁ∏uP~HQj√DznœO„˙%]N@ü?3XC^∆D˙.´öV7ˇt„@9PxP !˝goHÔ›™óf&©vÁ‡w.›f°ù@{Ã¬Z´ƒ,Ó7sÔò%L¿«¶Ö◊Zö˝RëÀ§˘ytÎ/áÁn≠a¥Õ5„ÅÎ@Î&dÚ˙±Q„BñG∏£Hõf«^z^\p˚tÈ¢ã˘D◊»µPˆZ˛R7¸±àQ≠*âQ›„ò≥¥Íiå˜d>˘ZZÏÍÍÂ˛7bAóm Ωr‰ûÄ@©Gı1<{¨>™K}‹õßË£ ãUÜÇ1-˜ke°@∆üù€‡fÎX≠l’M:Èãáúè…Pß5Ry˘à{å#ä;û
_k≤DÕ˝{Eyçy<NÏ·+Æ~¬n¨pz;hû_ìû∑ÊT_ˆ~i¯;Ü8¿ïêøeîÙ5Ã¨{H1i§µå'(Óµ±ıV‹$LπãÀ(*O‰%Ì≤5ãÅjGèŸy´È»≈p†Î¬3È⁄_ÉUn∂≥nsQÒmıEEöuÏ€%£§c∂ÓX—´ø≈h…*Úı&àò‚ˆ£∆kÅe0™[¡Ñ=—ë›X0$pÁ¥¡B¯&ŸÑúßª[€co°Áƒï—ÿ93|⁄pg¯(	œˆ;æÛ€›G;nïKrΩÓëÓ¶Ik!Ê˛ÛKH$¯Xè=R˝o5+˛ÕÛ/G±Ov˛·≥üã/Méß>‡ªÒå˚n›'ä∏…◊¯òPÆ≈&X5åÁ~Y˛è◊ˇ ƒ_ãrhÒ+·øßK˙Ïbi≤--M§ÀmÌÄ~«ê…X«¥O—›?0¯Z<!L–Œ¡2\äg¬DGGÛs/dœΩÑÂ©y2X<Ã◊ä˘iØZ“iÚÏ]Ê™gÎ´ªÍ¡ÙQ_ê è≤∑ÆR%M˛n{˛Q‘–œ#Ù fÿ‰î#iïêY¥˙+x˛JáÛ\y_‰´…±WzØ¥˚+Ù=@äÈ[ø, YÿW
ú¢Õ_ÛŒdŸ`ÔXèÇtîÑ§b›W-	ΩhxƒCd4K‘{ÿ®ó^= óL*ä^ÎÅ•ÖUE—dkê¸≤¿ëM¬)FˇŸ‹¿Ω≠NM€
Û√>Nƒ6‚EPúç1Çìy2T7W⁄hi˛¬∏r¯˙ÿçÁÛ2Nl»û≈Òá/Üûè‰∏ıBKŸ}‘1Â¢¢9[GºLÂÍÚª hÅ¡œﬂ’ï˙´ªêoﬁÊ≤Íê‚º —È:{Ãº∞¡rπÈB?œZ
Îè∑¯e®B≥î√]ø%¶+iΩk≈b]´ÂAh\˝À»Æ?˛˝¸&R?·y‡j∑H-|√˙v^IMf¯zjªËdÁ"Gá|tß
SïG®€]eî®hÇS≈`±"æü(Òm· ü{Û‰0•@ﬁ™ÌÙ¨£a“≠['Óˆ˘ó3M&¸ıQù∏U0è<ÊÄ]7gkHç÷÷Ÿö§G¯7ßH¯◊)Ó’,N2¸ÒcF∞oºÃã8ˆŸoŸ´¿ã“µwÉâ7Îé0ÍÏ¡=˘∫|ËtûπÉçƒ£∂∏+öøÎ	+ü•H¡Õ{5Vù<U'/üåô¡ba ∑c@˘t+¯%”‚3Rå(–∞Ú∂UO¯<U¬Ç<ˇùªΩÂ.ﬁÓ@&ü]÷±,V∑:-*InCÂﬁ•kË:wäÈéç-òV‚¡Ù’»"oí¯/¡(c›ZrÏqü…fyƒî1fºøón—´ÖÙº—_Ä÷àÅàæΩ›»^8úÙ‹4GÏ@ßsá`äquAÍ|3±Ô{C^ ·†ãú“A€ù)O[1:EgÉ–øï∞A?‡?h({ˇ-.g0ƒ&Î>‘ﬁ›ˆﬁìˆ≠˚ÿõqöÉÛÍ£∂G¬ñå±ÕN„ÀKu∆(lMÍlHãñ≥ ã‹ñygc∏mræÚÀ∆pS∑±]ç!≠Èd˘'ÓìÌÀ ¸¡˘tsá~˛s…'h¿ﬁDdz·P9doÇ,âÒè#`™ÈÕºÙæ¢ûîB-l†'·Ö¯o <ônÜ]‡(?GÙì“iõ0ó*®¶l∏Åﬂáπÿhå>ú«√ Qqå˘‡A·n°Ê˙Y Ù´mÄ1
’ÕKºróÓËˆÑOk◊'|åºIb‹Ì⁄Äéª‰"<e7f.%Ãâ˜aBÜÁJx|w<ıç7oÁS-Ñ7∑ÓBE+q÷úº
»á@K›Í‘Ukcø4È«”h¡fÅK‚lP›Î˛Ê&¶[(ò:p∞ª>ÁÀ4æM@éÖxI±ëªﬁEÜ!"êu£¶>ç2‚ÄÊvã¸’H§î=[[{'^yÁiÕÛY<Îüm!!ÂøÒ∞–^‰ñêZ'|,è0J∫ÚZ¸–fƒ_¡9'˛¢p@˘/É%’fïüæËÔr‡Doõn˚d¶;ıj÷W	[èÿ,CÊû/Zf·°ä0Û·î]x>˝◊57K0/ı◊X€ŒLQ›Ã\]€®çfCjâíØ⁄ÔKÍV$R2% ó¨ƒ«_õ•´ıv^°≈±,ü∂÷‹Ú)_Õ˝Û3∂πıh€—≤[>¶òmI≥ÁÆn√gÈC_>5‚∫q .yŸgtvá≥J>-4í¯,a®^Pò≠Uÿ™ÁÕ›¡V]>ŒëÄÍiµVˆE§˛¸äqÔ@;â2ÏÓy’ŒÅ™W˚b	œ„w“EÉ ~u7∫%a∫+.¯‹ß¨T`˜”S4.Œê„'Kÿ
ûÇz[<O ®]Ç¬âdˆSˇ'=ÿI	À6óÃßºπn>+}·Å√]jÔ1«kW|ËÁ+Ç±Ú"K—pÂ¿h]ÌîY™Ö\ììj'ÎÕê§∆◊∑uøûÄøûÄJ_“	àíøû¯hÁ,ÀjN?\ﬂö≥?∂ì/?|>˝πß∫&'ÎŸ«üUú}§p‰s˚ı‹´y~=˜ö Vù{‚"Ü¸UûÄßîµ`¸O±í÷∫`ö¢“·∏g≈ù!/ˇ$w»·¯≠VÀıQ“ö⁄%9’0ÿr⁄ı⁄SÆßÏ˝CÛÌóNâ[8õﬂ∑oŒ⁄~ø≈iÎx‹¢®+÷-„3AjpW¯e±≤R„|îÑW¬ÔÛ»◊ÆB!}ÖÏp<	¸ï(§≈zﬂ]!›¨^Ê]-ÜD>_ÓY_'ºS—_$5xLº‰CJrYê˛Jòï"Ω˛·97Õa¨óyä∆	)‚AñÑ≥ï–	πüÇPàæ~•l’î‚Ó∆X[ï∏A≥–ﬂÔàIü˙Ëp(-|o—üO√øv~	‚ÅÊ¸»Œ≥g÷˝óxŒπ_ib‡ä¸ÜRÕ⁄8¥Ã≠ıÚ≈«De1qˇ9H(Øiöœú‹L›ëπËÕDd¸&∫¸ ]∏Ô’À˙S‚…Ÿ⁄⁄y¸(8'NÎ√4/ßòXIÊ]bá£¨cFÓ6h¶ö-ÿs/≥SÙ8r¿
ÖR\<—˘K	ÿlV´
5Ídˆ“_"ËΩ–Ñ“¥÷	€êY™ >˚› _‡€H®ó•ŒîaK( €+ãÂ›ÂsS2™ò≠Nˇ©˙ãGŸﬁUº≥‹»OØÌ~˝∫a`»o>Í€U‚ñëAcç›7iEtóüáÇÓJ¡ÿ”ô•ﬂßòÖ}ñêù/Ë¥\«ÿ'ÛsJ“Ôªyä‹ÿD..≥çìãÊ‡¬Q0wq?›ò´ˇ¯˜ˇ˛i0‹!ÜuÈo û@"yòy%ò|≥ÒØ€‰Î\dÍ›cÓ…C$Áb"I±<ˆ0˛ªöÉXÁôy©ÕZÃœÌeW§qÁÁO*;¡Ì¢}∏^_˙aÍùGË¿$q<µx≠ÆID†î&åfi»<O1
(üuko?ûoõWÊ∫ˆ+≈V~7ÔÀ4–ÖÓô>6®/øõóﬂ√Âˆ Nõµ™|¶€;y‹Çiúı)çk‡Ø°[äükM>∏_o∏4Â~:<e›ùﬂ8∫≥V^∫'%-‡∞r"'Gıß¶ÓÂ°Pâx«ìë2Õ}ÂZ¥-…ÁﬁO~ı÷ÜÜ:Ïi—âÍsN:ˆ¸¯∫?q…wßÑ÷≈—‚]¨¯Tu^ﬂ\È˜Ë’Ó•ê<˚øGüæ-yêÀ¨™:¶–€úf—/√cS◊{ÂÓÇUy]çÜéÙ1IOΩg6wçÕùZ^·0
íÏyò†∏ú#6∂ÈC_vS¶.»\–€:Ωp≈fŸ≤ûñùbØrÚâ*<[äÛÇ÷≤Œ”DDE)¢ê¿ﬁtD∑¶G/O–¸ëi€=2˚Vy¥Ñôÿ))B¯òÍ√:»©TÓS¡ÖÈâwÿ¯6¡¿´12_/]LGÃ%BKñ,tXEÉk8ïjò∆™√!; ¬øÄK>„7¯Edˆ[ñÖì uTL∞S≤ç˝¢!¸dÆ ±aáI)MOe´•¨Ok:exæ∂Vû‰ôqîâ‡o≠˝<¡MÎŸ46-(¥›A.∏n;o˙å¯ÛF#xkÁﬁCis√uí‘ÏO»∞ÿZÕ9ô%=Â'®≠YÂp•Üª⁄‰æQÂ∏®£6¡|∆¯¡üçU√÷}êcBœ=$¢â¬ù70Ê<5=j5¯¡Áq0¢—:m¬"j¥Â¬ãRWkÃ$»Ê…‘!r¢€ ™û˝È,aÚ<VúîNKl˜u]n≠Ö•ÃîåÔEHy+*Qna{ã£4ùZÎ±Ωà1Ù⁄tÄèÚ˛FÒ$@`√°c∫√¯àÄEAö≤DqVî†^ù·PÈı(W∏îè€ens)78?‚È≠≥<GÒCh$ﬁ÷ï 
≈1®ùä@Ìrr”ºS≈9p™6›}¥!Ì±÷ÏÂy≈
∞;  V$onwµ6`ÊbŒ´¨∞TKN]sûjXeV‰¡a¥Ÿ	fgÈxù•ìwƒÚ¶È,
≥Ó⁄ÓZè„ú¯¥XB—~ ÌE˚b†wnùŒ‹‰í◊›t‹#mˇå[”C≈€‡U8Ma®Èò˝é=ﬁ .¢r--…TÓ;!äÉ•ƒ˘ Êˆä±∂ù*>U(H UÅÇÙS›éÅ;A¬Ê{ã÷'ÄË|ß >mO|‹M{>·π¡a∂√;çaeÇ]v,¨Ed¸∞}«]V/gù*¯î…0ß8nïÚàÊôT≠qcPãl°UkﬂVû~Nì∑⁄∑SH@ªö∞‰V;ótvUÈ√≠Æ"ŒÏÍ≤O˚˚ÚV∑·÷t’Æ}Ê6z+ç7#çÉº&∞:¿4‹§)ÂÔ„iñ,∫R9$±y{-§∏ºœW^6+M‹∑úvÀ(Ë8PÔ⁄A§ú‚b¥[ó;≤ﬁåÉÂé∆p∂%â∏vw≥®â£`à≥ãÙ÷)NÜç€Ì ◊ë∏0ñ”*& ˜xóÃù^àâ≥;	Ú»tLHÎƒ¢qã9◊ì0HùN∆Âñ¥z9oo´yLı.‘¶ƒ-nDî;èz›mÆ¨Õ√õóù‚Œ$∫îÂΩ†›ku¥IM€ˇ–P“‚Uh<ÛFa∂Ëª#o>∂◊∏èl≈Ugµ⁄æ‹ACx)X”Ç\ﬁ*˝xûúûﬂ.n™{cÈy–.q·ëŒ¬)Üﬁr33Á∑|f2).’˜j.9Pµ⁄∞>≤„@v€‘g•πoïöﬂrm≤7úƒyÉÚ5Üc=
Ω(æd? ÃFﬁ¢Åı&«◊∏Woíx2´HRQ
p~≤ \xêı7äÀò' ‡øáﬂﬁËÉüƒ≥˛y4O0Xy#ƒˇ≠∂ππÒéÓ”‰¶ã(dU◊6∆àÚ˚	@g[	
_3¿uq:Ò>ˆØïmW6õ;Y∑‘(≤Ã%v©5ﬁ©òöÛ=≤â9ïÅ7çµõ©Wª;Êm≤JÀ&Á˝-ó@no<º™é¬ôé…è1ö`cúX'<?*≠◊9û(ï!^;/}ÃÀt±`h+û—≈ﬁp¸®°õr∏÷èim®÷Œ¡«ìï≥oHA‡Ñ%nˇ¶à≠	QÀßµ·Yøpc3*:ôﬂø@$πœÑ{Œ—”•¡≤…ˆ~TÍõˆSÕÌï=ÄNí Hºø¨≥?AÉQ£c >_ã!Ω|ºyø¿ÜjKÆŒ\*øó« ◊≥¨ë.5ﬁmÀß]í•rè Ñùháf+M‘>Ek	0Ÿdﬁ"~]Â KN—‘ﬂ‡ì Ømoeºß·vâ¿$+≠ÅÛfŸí¡H©Ò≠≈ÚHs˚2i#∆tÌõœ5nC—pxπ‰Õ∏o`‰∆†œ„ÈEòLp¡ß˛…»kHÚàOıÅM~)À>.€ì€Ü≠z£¯ÃŸoŒ˙é∂¥≈ò˙ ¥KB—	∆»‹ïc˛÷‰òëÓÁI¶Fq‘»:o	÷π9êE%€åFUZÖÇŒ˘ÊöAqªv+c-¡´%}›ﬂ‹~s3ó∑ÀÌÊ≤cô›-ÀèµáW≥ﬂ¶Öc≠4óÆIIêfòòdNCv¯í˝¸Ì}p±îé¨s6‡,0¨A¢]àGY>A]±¥Q‡_j©MóÂkÔÄLæ¶G¸|"Ë#ÅG”∏?~™
\˜
Åª˙—L…ãˆonò–⁄Ï≤çuñ¢%,¸5x≤Sw‰
»’joÊµ7Î™÷≈Éã5ë8!éÑã~˙ g©Ë_Ö‘:5¿ñ∆˝≥'W„äL>Ó®è2{:Ÿvû∫qmˇºd^k7óuì‹©{SÚµ≈~◊®]di≤∂=MBêPL{[íßs"5õπÈ⁄ÕY›B— LäFÛ~¬-R9À¬ÀqV–∑Œ¡Q<?áπ—≈{ÜA)øô¨— §-∑ì∂⁄FwNQ«À*6Ã	€ÿKô%@ÓÏ< ı à˝Ê*+Œm¶¿méOã>JVπh«¥\\ö3¨6©ΩÏ¶‰Iv≥‰·„\ÕßóKÆ§ºÁUÂ‰)!rARfÁ(ŒVe±u‹ÙD°SãMm∏•∏∆x&i& \$uo^0ß¨BÕÕ‘ªÚ»V¿„Éç}t⁄LŸpã,ïôè¨FÌ€µIôN^bÍÉ!{y‰î„®fµ(”.¸≈ °wºîÌcR5«¥ÙôVˆÂÙ*Gé}öµ≈o/;
”Y‰-∞€Æ±⁄dˇ_Ó◊Ò™õV/ª™:‘≥DÀ¸œUÏö∏N1£*0#‰ÛËÒzx¯ã€±”∑Ø1ªï%”O±SÍÏ·ÃÈ#ÍtèT≥Äw8;x÷ÏïC„xˆIàús¯îN1‡◊“Œ»`ªPf•aﬁj∂–äœy‚P˜ı˘áÄ†£ %!≈àXÙX|˙8ò¸>øPî¨U`NQ†~ÙS„ñPﬂ/Ê=ZuˇÁªmìEQß∏[WQ◊¬,Òi…áô}˘ÿùá˝:ûQ\∂/ü∏ÍVñ•èjË£ìE
BeÀ‡äU˝	L øÄÄõô`µ^ÔÛf˜@ÖµeÃ’Ò≤Ãç' µ7Á*§>J
îe‚‚‘Ëv›“7Wß øm:cj€Æï†‘ÀEr÷J»1∑C°ñx⁄9¯!	/√)c’áˆ|-hCEøπì;áSqq1äg_ê'∆)dHà	îØº0Bœv∑ú…˘àVΩúäÚIÁQ¥ª#ñœRÜÚ·‰◊·îÌ„ø~|=àg¡¥ªÑgT_∆™¸x4GZ1∏N …∫Ô˜BÓ9ò&£˝Nâ´-hÀmáQANˆ;Ä0i∂àpÈÕÓ∆w,ãgª [ﬂ1DS˛◊y+<·'®¬ÊR"ÿ] #ø˘éçzO?:å
·5	∞Z@DˆÜ|ÄÔ€f€p.›"/áJ6?í˙DÀMŒprï∞aäQ\òñÉU4òh8€ó%ıU∫]7∞oÅÿ«„™◊gåˇ∂"Æ?Ö¡5Q=G·b;¬K6Rì⁄tK_KX,œñâôí˜‰jcP´≤ÎŸ@-iﬁ‚å•æÏ˚+Ç±ò@≠Z]¨ƒBâŸ±fü“PiY;8€6∫«{à¢b4˚i"©ùÆ>öJyV-"™∏7æÚ )F”´íb4¸È•Ø¬eü÷n´¯,Â∫äœ™‹WÒY•´€J‹XÒπõ++>wqg≈ÁÆ.≠¯|∑VﬁÔ˝∏∂‚sÎÜ›À¯j.køL‹C0	/2ÃcÂÀ
Ÿä¿nn≤´d»·Ïp∫∏ˆwdj≠˚T/3áä%#?Ù3{Ó·öV¯}^º¿soñÕì¿Œ∂ ´ßÅ¬Kû‰-C|;(``?j™¢≥—„Ìu6°–!µO…^ˇÜÎ#vô⁄».˝[ºúàM ‘ÛÀKÙ∆Ÿøj◊∞'¶å÷mÕ q9Gû[fI€“◊£®.–á—pRr?aafÌ"@&¥3Ùf·íålá¬“µ/L≈:ÎßÛ$»∆±øÀ:o~89Ì4SŒqÄÀúÓ:¸ùÁ@- Û˚ßãY–Ånºg¢ΩÜI]¥@∑ÕÉ:è}†‡:˘·5põxi^,∫éè4v™Ç¿è”·h‡˜Å wdÇáY◊o¯<»∆¡¥+‚X&A:tl¬}˘p‘EöÀ„	»¯÷EsFq{ÚZÒWµYdË–ˇ*ΩÑæUè|@iŸq;W›Bs GDÚIí∑A:èpÊM3/IÉ.Œ∫Ö,ü@ﬁèaÄdåså8%¢&∏œ"ÔG<H—ÇÓ∆:€‹⁄Ë /&¸.Ô˝OOﬂ0>§á7˘.óõÕ”€˜Ì¢3Ò.ı ÁÉp:äÊ~êv◊ˆ¯ÒÅüç≥It∞÷+°∫]kﬂ©Ä±a‚}Xäg+EmÄ„”¢SÎú;≥†w¿›o.°˛ô àe—b‡b¯¨*Ç>Ÿ8âØŸ4∏fyÑ
ò—ù£oP”Œÿ¿.-˛Ì¿’úkÁÂîGøî»¯=#«˙+ÿå˛,7±ã—90ç≥Áà£!Bâ=%&›ëä™IwfIpÂÆi‚æçÊ®ìÛO–ÇsüIdd2Ì‹-JæÜ}¬¬]Œ9ÕCëÈhùπ2DÂaÑ)FﬂÑÓ˘o9	¶Y—b¥iKpwmï∏zÓTó–0¯RıfSóÂ),éáÖ’E ¶;p ∞ÒÀì§ÕÑå|w∫÷;€xÁòàE◊‡k⁄3u`R	¶ó(Fó™

Á<H¯‰™	_—≠Uv-uoy«A°Àh€ÌQ±5öKﬂ–ZÊ›JıN´nÉvT[Ni°aÿ2MPÍ)q[∑√ë÷D≥ﬁpÜ‘•T'KO^¥p∑πó•Ìÿx|¥√ªí⁄¡ h	µØ-jºW–à"Ã¢¿Wr†äHò ‚Â∑9XÎo9pØRı‰\MÏRß˝÷—’π{Ñ57K∞7bVlCS§Æ∆Åx¢nó∏Ì"„XÎËgπˆ…D"YÏ˙¨–rP%-ÏŸ·TàÒàB)¯Ïz]ê»E=^áŸòq7ﬁ&>´i1.–¥&Zt]/ﬁt•àS‡¥öÔNÅÙ Ò.t1v∞≥hhá%ù°¸S—(BGXº8…ÇæÄUõéB/:Ú“ÒyÏ%>ﬁ’Ô≤∑Å7 /ûÔÒy<©f˙∆[†y€ŸªÔ¥oƒø]ï>œ0'f‡‘ﬁ˙eO™WI‚ø ÆøÃìÏioaIGßﬁ9ê∂ˇÂjÉ´8xàG ’‰?Gﬁdñ>Õõ∫= ’µŒuΩbíÎ˙Ï÷≠”Z◊Ê≥ÆOdΩ4Éı|®Î≈(adgÔ˛ÈVkw9í—¯øÃ°ÀuÇ≠‚7KÜfN2<îÅ≤ß◊„	&E¶TQW{ß÷ﬂ„Î…˛N°ËTe¶hêªæ”Õ]§aÉﬂÎÔ,î∆€˜iJ+‚Mã6Nå•˘ﬁ|Î‘÷†|¿[/jÂß‚wªí+~˙ë;=jK._jM\÷¥¯!∆õ≈XBã«•◊N”úIOÕ%{cæujKFBc‡•÷’Hï⁄≠ÕÛ8∆æçãv=µ÷…|4ÇSfù„N˘CªÕ	”#ÿ	\∏”èb§≈ÁÜ©∂’®∫úµ˘⁄πE?Ñ:ﬂ#ÛÌrê¯*ûfcÈç}è·\≠ !ˇ‡°µÇ/\A>îc‘õ£Ê‘7Œu¶û	Ω?ÈÔ™aó¬t8®Œ.„0,¡©:3qï}hÏ¯íh_\@âÇl´YŸ‰^Ö^Üáõ¢~˜ôA¶ë°*ù˚fªÉXÿøÃÇ…S„*¨mmyPIá´∂ıëøæƒ8∂∫kbZ©q˜f%c]eez•Ú%JUP%•îçPÿ.Êl8VQÆå‹%>í3b∑Îˆ3@?sh$ddøeàN5•à’„ R≠@˛˘ˇúq£:Taü‰B‘iHfà©ˆóíJWñ‡ë˛®å, _bèU@2ﬁ∞†Q*Ω.M~T?iò"nGê∂ Ç3°nIsI◊í»‰Ûœ€–7[«Í(.S6R,,¥L˙Èó”¨;·§r”ñoA…!1°v∞œ6˘_{◊Vïú*:¬∂™âÀ´î:Ú¶s/YÄd÷yú'ÚÔWÚ¯«·,	#˛Ü>¸i>j.\·{DÂÁóÛ/s;'¡v”√èFY,˛|_ÂØèÄ˘≠Œ¸Œ.«® QL˜l¬˙l≥¶äÄ‹∞r!] ∫˝ßÚ_L¡ÂÉ ZÙ@∂O;¶"ÉÍ 2‹µ§∏Ú
Æ·œÈ7C∏QÕAL/°g +4®DŒ6,Î¢¨	/d.ûê@K›b
òÕÂ˙≠]XÄy¥©}ïj\ƒxÊìΩ`—¨x˛√íæXiBˇ™¨.Ô!CÔò/O©ﬂ8_¨‡æZ£g!DBë£LÍÁÚ
2√ ÕEeA¯BhL9øÒ*òƒ%~@4ﬁ5‰LÔŸªﬁÄ∑D#«z4ûæÁ7¸«<‡rìB«KÏ^¡•…≈≥…yÎÍÂ«î>ÒB0n3˜¢÷ó0}E∏_b˚Uóe0’À.¬2ì.©*ñòÚs°ühö'◊c,39æ©˘&ßÖéÅ~Á$Ÿy⁄4îeÊ˙FjzÊõkÖ>ÂÜ™(ßŸó)Yp&Iêº≠
aÊ p+‹7•âwKTOL^ÕGA∑õŒ'ª"øË:˚X®®·=Ê±fÊKˆÂΩu˙ˇôŸ¡;MÚ¿≈∏åmF&6¢´Ê£∞N°lãkoº–_CrØø>Å≈çÌûÁV⁄Ö@÷nŒ€Í%P)Û}Ìè“á}ã⁄çÔ‹%cÜr£$—óâ*J;s|\=Û“â±¢Ì…?òŒ&Ê§Ã®3C⁄ûœ
‰≤`ßa∆º	◊#Â]ÁåS,ÿiÒPm˙´g.∂Yy<vıSe…µ‡Qºi≤⁄{1˛∫’†~uÕG˝}ÒÔ}ƒ-t$ˆ„~∆‘fµ$¿¸ë‘hQô=·2T–±ã @Ô¯˙ÃØ@îâ7~,ﬁ¢ÓéG-°…=n√–vªPÕvÕIB8|Î…Ûw√î®Ô}ÏvÄcyp\ªQÓ≤)"<ºÁ»%ê∫H?(ı}è lÈÚîËÿZﬁT√¬Uﬂ◊Uc]µ	˙ˆ∞0k¶˛pW◊Ûf≥$æ£m,Ìá#∑Çan%#«1Ÿ’‚MêL¬Ã≠¬àkÔà‰ª’ò0?◊•ßÈ<A◊Q∑‚Á!¶3N\◊AÔ8Ù›
«Ÿ8Hî9P$`Äß‡˝T<|!î!1âT)ŸØ¯òÅS≤ÉBç∆%[¡ÁZ_l¶h≈A®…Àßy˙=Ê®∑o%ÿÄE…í◊⁄€«5√ Elπ∞∆+ @vïK.æ‰‚U˝wñA„Aw?ßn:ây*}NIyèü˛áhn eYŒƒ0Y®og^ö‚5}ÒÂ;¡©$îA9ã
ùR≈ƒ¸∂∫ÆÚ∫u√Iä6Í'>]W	ŸÑußöe¸\´¶ı±nïìMÎ´›Ã»ÖÔ9]◊‹qn\{◊08cﬁ’ÂOˆö{∑6Ã]Wﬁß°≠8öHn,’Z∑U2FÏÛHOÓDÜŒz„¬OËb‘∑-ï…¸”IõÌhNº’›≠ﬂ6gZávçR}â•g¥^ï˜¬_{64ä}Ω%|!ÈàDﬂÁ‚]Î÷·À•÷:º/ß^1Ø˝p'3c∏ìô;¥jLÏF±åPΩX	åañúæàNÌDÆÛ¯∞3ª@∏g≤f˜(Hºki94‰V‚‚Lg|ücuqÎ€ÖO+Ó◊¯Sº¶≥7/ÿhd/,p±∞4¬ÌíÆ¸ıü˘/»©—åµ>Ë∑∫%ıM”[EÒ<˝ã7	ïuç≤Ä≠U˜"oBj|„ª¥ΩÌ_*-‚ã?¨ïêWé7	(9Yw¯Û˘œ◊√Àu·JG0è1 èvÂp[Ï˙€¯|éŒ”"ÑeÊ≤$‘–ALy2Ö È)NÑJg»o´	HÃ´‹„„”Xµ=0ƒlâà
ûΩïuêB=„}W^∫ä;ß›â@12>Uà"uîW4€7/ãpíA˙‹õ˙°œçÇª#˘£
Ë®î%Îxº
(Í9`B$Î∏Q9OYL!øhR◊Ü3íZ‘¯E°áﬁcQêñZSöC
8ø™lóä\yxıµΩ|@ûpï¸≠Ÿuéè∆ª˛•Ì-C|ÑnK˜é]c y≥ñ˜¢iÀlæaI9ıÁÓÆ1//L®∏ã}ßœ‡rÄó‡IÍe„éO˘Ç˝y>ÒíNœvÜ·Ty.AÂEŸœiˇ›7√^È.UE1Y3üVcÌ¶®Í@ù,±:ú‰Ëw›
ŸëHMúÆ

⁄Úkä¬∂aŒ‹e{’¢»ΩV¸u§YªÆRd9_ëπÇr–k™[n:¬ÑôR§√Û8˛ÄyIgIêbíTÙ„es/bt˚√ËJGÍÊá§‘ñ)7byªíŒ´fe%Múa¢‡¿u∂'Mm§âZÔ;)ùt$Ó†@ˇ Ü<çß®÷‡«à—§Á˚oÅÒ ‚
¸G#YÖ2J¨ÏZﬁ’æ∆™`€V˙(ÀçZZÕ˘Y∫éÓ“^»fËqÀ%ΩtˇípDl_ ±ômn~;ÿ‹Óë˚mJÅjYM*…HeŸ£‡*à‚ÖY=ºIØ4õ·øû˝Ï) a∑òü}’∆W˙»?„O¬©˘2ù#[aˇƒÉÔ÷.Ó:¡©íeÉ ‡c/ÌB)´4~OÉøØ˚cl…≠ï^XÓ=„‰ÿCïúw±Ä!áWé∂“f–ËO+O3¿ ö*¡–˛b®ïWÔmG¨–¡ÍiÑØÌ¿ÕRe“Vöû†‹áI‚-(ätq[)çi
åÌ çì¨€ı÷Ÿ9ÕŒDï˚9äbI–=Ø∏W6ÕFN%sÖ äÒFˇ,‚ ö“–îLﬂêÅNÇæó¢dâ®¢È4DUÖ1n¶™ ¿Ç™ûŸ^AMÛbP` k⁄-ÃPïè]N∫à8ßéâ`’dÁ@¢U« ã˙SBîìN¿$≥™j‡˝√¸IMûaÌñÒ◊ëßΩ5É´ ®1≈–ß:0™≥(√Tj6¥ÜÎÖ∑KYE]Á!∞ø¢‹m—I∂Ñ
¢|%?éJoMuímÍ$KK.
%k˚RëƒA‚Ä¶Z5¢⁄2ŸZ[/èMSfPö\ñíFÅâÄƒtEYxK Sq¢J∞<◊.∆–:˝®ŸZc§,∆™Œ0ÕÍqO,v¯ˆ◊∆^ôª@“ïUÕ*h¬Æﬂ[M€Òó™‡¯èAË[Á*ˇ”–—NΩq√Êd Ë:OFNà3¶nb≠⁄Z‹\≈£ ê
É-ä› XÛ_Áª`/®ûå≤Ëˇ  ˇˇÏ}kW„∆ñË_—ÒÙ3¡Äö:ã:aN70@Áú‹^Y›¬†€ÚH2èpXk~ƒ˝p?‹OÛ”Êó‹ΩwUIU•*Ω,:t“Z	m[R=wÌ˜√Ú®Dûî(d¡ìô$}\â'`NM∆æycßÂZŒF†ú»˜ Œ4cµf9ì‡§zöÔF;›1ùW≥Ö¶6≥”Çc+XhŒµ5∂≈‡¶â=Æ∂7âØ`ŒÆ®úªÌ‡:«<àXbu«ÏGL•~ÔåÉñø™ı‚ÅÚ±ıùÍc“=Ï≥l\íÙàähKXgEc∂È
q7@º∂Ve;∑»˘ÉqÂ&«|)Çù‚œ˝ºÑ¬QÚ†vSOô˘<Íö`N2EåKW…∑	eOÿ¸ŸG€ :Ò›‡È◊˛$C0Y‹êºÀï»•çÚ=y{“Ω’iéN”`+1,åƒ RB! à≈LG˚=åÜ.òî:’Èh1hÈ‚RÌ£ëπ5!}Ù‰fI^˙8`Õ™B!<∏Áá	 âlO>¯,6À…¸Ïû˘FˆW›ÒÍ>Œ{¯Y%Hãˇ+É±≤ª≥ 2d"QÉ‹"ñó√_azMc+	ºrêTâHæ‹y?	>3!ó<V0”JÒäí…ÀÉ±¸ëœ,æ{©2 âUÎ5H{¿Å^∑ës|ÙˆÁ$a”é¿"0o–¡*raOQ-6¢8í]EC•Àba5;L›∫<vß$Ω€Dlº«,\¯…"†Yﬁ;‡XR◊rãìÆÊ(mÄAóıXÛ¿9ß‰ª]IÑW¬∆yF2el5‡Cû
V¥,ûﬂŸ+ôc?/…oIˆ´d+2÷+W∑jô/0^©#ñ2@íπiQj1sØ†U˚∫>öa'˘FP°Ìç“y8cœÊÃÆæ™:RCÆÓºktÔ1-ÂŸîπ7W^"D67>]Ìœ,xÇÃä‰ÑÂáûê1√!$<¬ ùmóå–Ä …1ø–ﬂº&k==≤D]/ö·@ÃC¨v:íö+hÒ˚ß{F◊l¯¿‡P±@:ÍÃˆƒ,æs”E⁄¶ı…r!¢√Ï©ˇÏMe8Ÿ€ô©e{∞«JH[¬l¨Í˘∂h€Sç&p.Œo^têZﬂ¯¿^
:∏Ì q4—∆dÓ|Æå,.!ÅZ™ƒê˙≈·h$‡3DQ∆
GÁzŸΩà⁄·≤ËÄ<◊óWWªôÑ“√“zóz^Ÿ˚·≤≤“¯\r?´4Œêÿ%kîÂíÒ0˝°ìeG{◊tÀß•Ÿ.ëY5«#ì—ìZ¯⁄T–kÌ*@ €-Î8-cÏK÷k-.…cí◊íú_ŸäÂ“Fì¨≤meyEL√m)Â¥Ïéå9óú–Ä)e¯7 B©∑}ÖŒ—°rÜÚ˚<–h¬Ωj'1øﬂ”5¢ä≤÷ùÏjtÉ56ã©±Ê‹-Oßa$4 ñ≤∑ˆmt$;3√˝tπ7_+»˘1ÎV™≠ÇeGÇüœíy±ÏhÇ:&GewQD≤!…øHÁãFq≤wj†‰^‡:&±ÓO∏ú%¶äÛ|hücíc–yÒ4Ù¢ˆÆy‡†ÎPpUzë¶4∏fÅﬁnfí9<ã∑Ì,H±ôK<Bq[∆.°â˘1˛•ªzÒr´ª W}H⁄Q∏ôN§ºÀu∏Ã$äÆ=îgıf§f.˚/Ω’s3vâîl<Ü¥ñzSr•‘Ë∆⁄∆∆•er,H(©¥ˆTü˝§Ω≠ã˛‡r√≤X)êNNıFM–¯já‚¨˜∑ùU©ˇ^cÕKÈbÄ;öÏL≤∂Üï±$∫VN‰uL`W‰Ù4dFIñUêËVÕM"®ÑÆyÄEˇ@ÿ∆”Y,Ú…£˜7Ax ìPˇìLIy√P±s¡∫èƒÈé1·µt
¥Q,ãa1C¢ºîp#òÁR√ŸLS¢w£cˆj:ìåæƒñ!WOÚd:í2˙ëj∫ë zëﬂM'“º>ƒ‚CöÖáÈ zÁNßƒn-ÍÍDF≠¢öLi#uE6À®üfå~ÜÎ›ª˝˝4wÜñ£&2˝))Oy¶òÙRy3lÜ
{Y”™e	ÿÕ¶¡Püfq™¨êèY´ÉˆtÔTB#†O@=…=?¢·t _¥9O„Ú¿%öó‰9hA’ı&FY£ñVõWË]ã‰î˘Ω πÒÜ8ˆOå≠‚\ÀÒ,æÅê€~Ò@mçE–ŸX?iK*%WgÎôñΩOæê nrCmA∂f±6$Ã°™˙)Hæ3á á´{º‚%µ¬3˙O	ªÇ‹Î∂√w,öa¨9+uñÓ¡u0MÀ8.<Íõi8UÙSˆÛìûèll2ƒ∑Ó=;‹û–.⁄èD∆(i=Í:âCË¥'7…¢˘ìõ¿xG-–— n%PØ	—ò≤î“xÀÏ Ëf?z$sì˚?∞.Ê^Åõ34ƒt‘W°Epà±\Q¬Öhßˇ¬g—d∞Tä¿‡KË"Ä˚›'–D∆o 
P´òAÂ"xÂìÂ+f˜kK!•ô^#Â»¥pQ‹R=¶à¡ÜzFøvË7#Ys·$Í.éh∑P:ä=bâJ_ìø¸jFfkJh æ≥-e∆fQ*«•Ìf'ﬂ-ßÁÖ·n†,FﬂÆttﬂÇÿ«)XY°ÙÌé˝Ìr:a °¯.´é’&û}Ä√ÍÓeåÆ]ÈàÚÙ¥ÙÔí!Ôyég≥‰∏Z¨a‹KÚùhåΩs·Å»‡ëÃêËÀÑo˝…0∏M’öB¬¿=¢‰œrß∞≤6ÌAÙí»·âW¨,&,Ò&œ≈à¸„OŒî¸äı@”v)øjIÉã'Äç7‰Ñî∂*˙‹H$4NohµqäÙäiñ“u¢pCùê#·MŸ;;FB¨•¿œ(›ù¥é∫Ω˛åÜÈ˜Ωì§L<«£”àπ≥8∏ºd–Ñr©zR∫0C%)ÙˆX;Í¸4ß ˝i=O∆_“<&Dv/Ió?gRπfrXõKõTSÊ∂˛ëf∆Ωî2„éEf\Wd∆≥Ã∏ˇ†Ã∏¯/ÀÄÎ&p#9nêf¿ùHpá"Æ!C+ﬁ·N…tÏ¡–ª;æTgjMn*Øµı pZ¥.œ‚0w•óæu∫ãÀSóUo˜@fX’}mƒïÖáO/Ó;/∞›«Œj◊PµÒ±≈∞µΩ⁄Õ6˚h:Ä ˚«\œáËT|u/©
4¸ÇÒäÜ}`…EOΩ–ÜRﬁ2Âl§»G•ﬁ®Í\,©Ç9˝:øã≤zéπ|¡®?PQ:¡üÀ?~ß/õAﬂ ıìÉö¡DôíÙ⁄CòëyY¶∞Âvà€>••èP#0~PÎ%+Õ$Ë¨pÏÆ3ü	],µäÍ¥)	Sf˘11âŒ)Ö!H	é‰•T±ª¥ ñ(O%íëΩπ¡W2A»ç&◊ì¡√`
'≤ú8mË–≥•∂Cö-ìI@∂‰≈ceÉˇíô˘_îAeaâ«öSÒ©ïœ\j¡i˘nKzÊo}≠Œ§∏!€égJƒ$v[Õ¡Ë√[π∂Zµ,DêU˙ÀU€m) l
íﬂæ”Í(óMu““÷y†uÙ=‚Y¸D^Ì F_ ⁄Oî1-˜6•˙∞Q6⁄x/¬8⁄mMçV>wã÷Ê©w…õLÔ˘<#Yü∑)9$œ’(g›úœ◊ÿÓò‚ˇÖÖVÒZL 'JÕ¡ﬁ‰zÚQ≥')îë˘_Nﬁq∆]EêÏGÚÖØeÚ=¡…<í/ÿ˚új£ÚŸ†b6»í%:CvM"≥jˇåÔ$h≤?&ì∫I‹®“7j∏ÊÏ\ì›vd¬ˇ≠qm:∆agÉà’’Â≥Ùª*¨[Ñ6Ò≥˙∞IRµ=êJ≠Ü'‘UH°≈™Pee©ÑôVãÃXV,'û@ÙÜ0K'B4„k~3ÃiçZwoƒˇ≤b}íÙœ¢FËg’ØÄΩ∞ìâaÔ›F‹önsÕ@çTõ∆¥h–Mã8ißù∂Ÿdè£%Ì-l¬h‡¥wˆ•7çªΩ†Xòä˙û’+paXÊ˘çBgäM^k"«wpAÚé9s/=f<Q_/-\¯—sG¿µ±T•ˆ∑ÑQºız˜ÌÓ—ﬁ¡~}kˇ‡Õ·ﬁ·πV¡eALÎ'b(∆ûπ€êßL“Ö‚?£*èuà h¯˚€≥ø/œb-ˇ#
&„‡ctÌyqõ¡Kˆ•ı%¥}|úx∑2Á£ﬂFEÒd(⁄ΩXÇûAî÷‡O.ˇâÈêp#ˇ7î!¡h6ôB™îhÏﬁΩı02á|·[{yyôû@ö9≈}0¬Ô/\Y\r∫}©ˇ€Ë√¬_†◊hÎÜ}P6·¡π\oãnøu÷e	ÈÅ^Âk´UﬂËˆmolI$ımgnC?ˆ@fÛh/Z∏“ct?˙H«Ì#ÆœGus>Ó‹¥|7äÓƒVe√·
Q€…˛õ*(∑!¥!¨¢!‡<ß·+ÃÁ3â]f [¿ñC◊è5;œl‚«pw<÷~øDıﬁq◊§î·8‹(Ú®2–ïü@Oû¬HvÈW=I{v˘÷EMû˛™3J0L p8vØºÃ√KŒ¬…—KŒZo…ŸÏ∏Æã?í¥µf˜Ï\VÛHå6aR®èa{ms…y˘r…È≠ıYí!>Á"DÂÛipå√Î—„˝ßŒÖ;ôHG[√-mØ.°Rµ◊Ö?8ÄyëDü@€≠Ω—ç˚’h¡h(xÈ…3ˇ7Ø›]Àﬁ<˜Ób6ÙnáΩ‰¨˜¥ßbx§›⁄}~¸n˜¸`ﬂ998?ˇŸŸ€=˚—9=ÿ;>⁄;|{∏{~x|‰úΩ˜n˜ÙÁ|¯´‹∞ô⁄6o‡[À˝‹ëØ¬Buª∞T›µó¶¡⁄B V‰±%≥}r¸¥h¨»˘ßÛÉÉ«ÕëJˆ∑d∏‚≈ÌIûx4?ÇÜ≥‰ëOlIzkÜ%Ÿ›[6ë^oühÏ≠Øfg¸ Úo˛0ænØ.ØÈ+2Çõlª/ÈÉ¶Ô‚9P<ß‹ £`´vÚbº√û˙ŒﬂZ/ª%vHﬂ˜º)mÃ´x]2◊.ÍÔööç≤¿écñ;F¿Å˝Ñ=oÙ∑Ú‡ß◊«’‚Ã¿ø∑w¸˛Ë‹9⁄}wÄ–Ω©V?¢¸Õ˝üê9c|ºªŸ3Ωª4∆˘WàVCˇÍ:^P«§ÌÌ¬ô;wŒNéŒq$´[s5w”¡Èœ˚ªpúèœ®Ωı˘Ü'†	D¥VÛçÏ|˜¸˝6¥U8¥ëw…€QÙœ‹û˘3ÂTﬁ K˚¥±I¶!¢ø<U®?º!EñpIØØ‡$ï»ú8ù m2(6ÚèúÒq+ı–ññ§€Wogµˇ€ÍÂDÒ=cD3ët¬3”ÜÖq˛’ÈôÌë∆iı÷∑‰·ò˚Ωºâ!¶X¬4AmÂ±ÜˆtsH˜SÏ—Ô¬:√»∂ÙMI`∏ùëÁR5óîó·ïdgN)9ó,-;F"=SÂ«Ññq:&qEc‚èg„7!≥MÏ˚W>Ücıâÿ!ñSgRp‡ÌÉëÑ“˙„!<Ÿ–Äwé!≠ó]#eL"YƒŸ,úéf¨Ä¶]∂BCâì@ßYÙìsí%FY∞ﬁ:û∆¸zﬁD=õ6£f∂±óà†±Õu÷ÿ©7\Ÿ˝qhMñÿ≥ÃÍÃ±oõu@)˜Tn.[qG∫—Vm£åˆ®"RÚ¬é≥eQ£ `8‰yx8wù!J‡∏ËìÉ®ã9	—9&o|§≤äú&√çY»!Ñà`ih!~YπN‚ÃW◊∞E¸”3»"2gneÃ•Íq]˛©!F∑@T ÚŒèœwﬂû…rúJëâ¢°à¬4í©Bï–¡ßã‘bÀ	÷Ë≈2VZˆë±£≤{çë˚Õ≤‹Ω<ä˝ß†ÛµFr4æh,
¬‘!≈‰ØîOSºf"π˘‰V¬âπ+ï∞9zZzÀLKTÅJn–HZ!˜∆kW‘ÂNáóUÆlw¥2ÔÜE7=Ù^èÑ„*•˚e—r≤≥™¨€e∂6õô*/v-k∫–åY™oô≤∏U∑c°Óka[8‚Ëv'…•ÅÂñä¯≥Èçå©H∏,|√B'ó{)Òf–^·&uÓ.ª«cŸÿ;©∑Çn◊béo0æo≥«Flä◊AïÁoÆ”AÌÁ¡·O˚nt¸˛¸Õ€„ø9?98⁄?<z¿¥4ö|Axﬁ	6]¿†ﬂ\?m%	≠	∫	Hos[∂˙7›&ΩiÔ»ni⁄õáë≥f7D›ù\XpÖB,º!Ô3ç-Çì˜Û¡∫£„ñƒO>7Éôâ*aôÍˆlˆ%´·iÀfF≤5’´˛FusXœl√B=]rÍ;w1À·Ç^CH5ÊS
}≈ªZ'1jsü>æx04±@ﬂ ƒ¬Ào√ÁÖ«O&äd0ª}zÒ†·:U≈"U(äæ≈E?û	º˚ë¡∆ãyÏèdû˚î≈ÈØ=ÄÌr6ˆ@·ì°…&ó‡sÅŒ°{ƒˇπ∂:6≥ç.õk'Ê´)ØAS^÷nÒçtí˙˝‰‡ÙÏ¯h˜≠É
ÙÉw@à¯˘áÉ”Ábù£®âŸEÏ«#üF!‹	VV≠oπ˙±™≠Ó”|8M∑0bËˇÑúﬂ±ÛÙÜ!É’–[üZ”∞ÿ[€ò»ÿ÷ÃcÀÿsOr≥œ¡Äy6√aø'˜`åQu‹i8g ÿ∑–zi≥9®∂lâ∫K√\ì/›Â~Chec9◊ZhBo/{xÙÉ√•+ß}rz”bãì≠π›
Jz%Ê2êDèıç^Ÿ◊œà±>˙·ÃÅoov⁄¿r/
hQGÁéÑœvﬂ$ ˛∫˛~˛Rf’«≥úDo÷v>çDØéoÅ^⁄énœ∏ûE&Ú†‡sŒA¯ò5AT¯4ﬁ‡ÎZ2Lœ «NAÛ˘5Wx}Tfâ?Óº∫0À4RÍ¢π8WKbÖG3o‰ÎFY´~\ZMÉüc≠d†ØfËì}XX$J’”¿óºAçN4˝ç*N4¬]˘qw‰\ê;πé˝æ˛3õ˘<^±Õ>0°úXîÙú9?›=:€›#«≤˝ÉÛ›√∑gŒ7Ä√ﬂú Å∆÷6J7vv¸˛àV¬#Ïï|È‹≤ {∏»úˇ›Ÿ}áﬁDÿ÷∆|Œ1ßÔèî°Ω\Ø–ú∑ëãÈ‚~ÛNÜóú«:«IùCÒ¡RÔ–V?/˛3<¢¸åó®ª∞òΩ≈√;0gù9„w:v™ÕΩCÈÌPyb]Ó]—ﬁ$“Ä⁄Ùñ˚ÏQΩO¸ˆ›ˇûäﬂÓn¨ ˜U◊£aˇ Ù`û[F·òû“ÉﬂÁsl“B=Ö[S|GÓL÷<#0Ü<JMs–⁄ˇ kàÖ¶⁄—#’L≠`_»KG"?†“éP¬6u“Ræ‰dúã<SÛe≈Ê`¯º5•9‹†ímÉ±p-¸¯¢Ò(FŒ,Z∑«`ÚgÑ ~¬ænÛÿFˆ6wT~ëbøi≥mπ˘∏¯â¢¡ÓÚR¨∏Äi∞ãÜ˝ÃzÆ•)DÜ˜0	‡Ñ¡-êRDÇä‰®qgEDÔ0 }6∏I±tªπS√∂°®˙cÃè√⁄rﬂ¥µÏÈΩÂ˚#<∫–ÚNÁ˚cúB-ôà.ˇ7©Sd%KZh'ßGg≥à)c≈y–Ä©–}iDØ»‡&˝≠≥∫‹«\AÊì‹˛HK/«ïtªH†‰Q~Î¨gﬂ(Ö§7¯’ô∫W¿°Î°Àk  /Ÿ˜“ﬁ–sÎô9`f~`0&∑T¸•¨Ë›“¥£∆FH
¿^ñS¥µ_ŒaL{√‚⁄$=UÃ@ /d…n/√∂eü/«Fñj ƒDñz—»Bä7K8èi3“»⁄-ôÿ«äçe…J ìÙVu‘ò≈–ª»öL\í¶~#?c2y˚¨ƒÙ≠ÏjeN˚Áı5NJ	ücåá @uˆ(»Œ$◊v·5;ñ“ÊÒë˝‰Ö1œk7Ä˘Å∏Ic%»≥ä¿\3]ƒÇŸ£–›ÆÍµ—N—Ìä”[§T9Y^pùˆﬂBñ‹1Ú‹Ò»ã¢—˝b…≈ÀÒÂñÙ∞.Î]`ÙU)^dıÒÑä&\4…%gthd§ï%dO"÷ë÷omyWﬂWI≤g%˝JkÅ÷F	–¬‘›XC X7SyÔíl«óó¨^4üZ!Áë¡	'¢-rXwëµ°!‘ Îçéaπm|µ2Kû†˘	hvOå˚Rxàä§ˆSÅœ≤íx n™ªgX≥|1≥çx)K¶mÁ‘æù≈[™TyO){ÜQ\/¬ﬂY,9ôçΩd™ºk‰u»	ö'ß6àw¥G¸úfú¥†Ã,∆Txéj‰§LtÀ¶AlT≥ªî/qúeÍ–{∏€®‹`0yLIî:>¶=∆»)uJGlBãõH¬{/Yªáì°h˚©7!»W:7=¸˘πt≥‰K·„û!móß©˘í’SçsV5]î**,”5K»c®≥ÆDÈ–÷Aı»îö`g∂ßQÊ]¯Ù‚!YÖÔù÷∑‰◊iaº∞úó®Æ…Yˇj;√O∑ÏÙgMÑ¯<ñPmm(F…¶"K·1	¢ñT±FW·Ü¸œ–áÿ‡o¶•ÉHÉ⁄”R0I9å _â	oíóÚs›`—ç”Äú7?(Kı ÚP2Çw‰¥Â<Ël*RÖà§5§‰hì≠”!á0Á'òî≈Ö•ƒ+7ÒSJRÔ·O'Ã>Í§E{∑f‰ñ”›”«OY'»J#Â’kƒ0ﬂ˙ÓÖ?¬ÚsC=1ï'Ú◊«yRwú:Ué`†»ØXÜ%]‰ÅΩx∞’„º›£s#í‚`fy5ƒDÌQÕg´¿C≥1Â”ΩÒúÄE~±é_≠D#œ‰ï∏SˆæXﬂ‰ºâéb˚ﬁ4à )X‰‘›™Ùçs<°√Ñ;ûnÃ	†⁄QPì¿…:Kµ∏é∫_…Ä2./)—#ö£//)4ƒ™ÜT˛Üç%H«rÈ·8voÆƒ¥›õ+lÈçáÃ¡ˇŒ∂{ã®±Ø5˘lÒ"ß-gp6ƒ:iC˘ eÓEÂèZgÔOOﬁæ?SÇ>ÍÕÎÖ•∏ïWÓ~ÎˇÁÃ¬Ÿ7L†Õ¶î≥≥#P√¢2≠πw«ΩÅü	„D‘kÁ÷¬gÃï5¢˛9U‹/®^‹¶æç∫yˆëõbèDΩØyÕæÊ5”@"?j£«√62Ô≠i†D¯Mî @ÚÄ,XåœÑµv∞l¿ÚCVTQÊ·Qe≠§ã>0mli¿+Ë‡gQê`OT’¡J#Ÿ
	i;∑ºùâHÂ`ygﬂ√B;¨‹{cò˛í˜"’≈ò‹'√•oy/¢°9),4√mò∞V	Ú1∏öÀ>{Vzû4ïã°ñ·±0∏¡*ÉñÊ\˛@^#˚á{÷˜á˛ Ô’√∑«ˆ©å/ÔÂ∑ˆnGπΩLbÃ´ÜÂbk>ƒû…kkèd_~∂≠ç1	ô=î◊⁄;oH%ÙlÌåŸ˝‹%ùD≥ê–âD¯yÕºˆñ¿⁄ÃÖx"ØŒ5Ó[€¡ì‡ÛZ9éØ—Zjk!†€%8ı0úQ∞Ùˇë9•ﬁe‚Å\2ƒïÃÅ˜ÈIƒw™Y√PZØÉÊcﬁ5Êm&bÆª&+ˇzr(‹[’⁄ÈA;á ~_Q¨Üûs≠bck–òR~”yzÓØò¬Ω%ØÑ)F,·Ì>&”˙»ßÙ1ïﬂ)ˇÏ£Ùf†µÜÇ’Õ”6&Ø|Õÿ¯˘26>ãLçÎŸõ•É¿ˆéèŒéﬂÓS≤∆Ω„”ì„S4Ôæ9<ñÒp˜≠ÛÊ¯¯¸‰ÙË<ç{.Aa©ÓÙL«Û:" äŒ•&
øhQax\Â«ªˆîúî1;ÄßJπiX‚Ü#®–ÃMTkJb*‰¿‚«ª€Ñ…ﬂÒ\>'Óƒhób©™EL°{…àÃqbmùªLÙ·`≠—çZäs±•'„pŸQ«_~∆8…7«ßÔ»¢sxåÍÓ˘Ò)ÊÏ°ØÄ-±JıÛPÂ4hË’œÄ\7d√*:õﬁüàt◊ï⁄ª"[SVgÀäN∑LjYIõ®hO1‘
ÿ|I„›mÁì¶v’ïÙp:∏‘†Z“G!TÆöÆ5∆â6å€0NÍ#S
ì¬púsVí·‡@*U≈J(Ti¸‘ÆKÂ£1®K⁄Re0™ÜTÎî*d¥¢Ü5J‘§6ÌhˆùúıB≥]5™_U}¶´jT{“g“hÚëíO)·¢v™€\Ãé◊§‚‰ñ¥òæ–bæô·Ótô –ç
L>ÉBÂ%ˇ>tx≤7RÎ°C(&M°®®ñEÈ«œxÍW16∏SÃÈ9µŸE¨äAe÷Tuc“á†Y~âPì˝9Zƒx˝‰…£∑â„QÂßº;2áMÌì8¢™˝sK°≈Hà‘µÉ÷8Ídæy9ANÊ9"¯=>d¨3&Õ øJèãˆÊ!¬Eq©≈L`åõ2¶g?üÍº=¸è˜á˚áÁ?o∑å0ƒcHH1ûh„—ª†ÇÚ›ƒÁ1¿—⁄}:2qcΩm'…1%g(◊ÛíßÀœ1,ø	A√¿cñ4Åüb^úyY·œñ≥˙8Mø™≥•U3ìwW◊≥s*pÇˇ¬&E Ò6-ÈÎ„„ø.~Õ<˛5Ûx’Ã„˝∑‘*N¶yŒøÍ⁄ÌìKÉ@Õ◊ˇ¸◊'Ó®&ÕOŸ&g˜ oé.z[∫ó¢ﬁpô^Ï©/ædoñqıÕ=˚\Ïƒ¸Í%\ü}ÜıØ‘øfPÇÍÍ°{B?’/(S∫æ~ﬂ<È˘Ù¥4˝Ù≥!∫ô∫º¶Ê¥dDukóWë¶!ÈÙª°„Fn!äﬂiç›ªŒmgÛn‰åÔ:Ó„πÔ:ÎN4ﬁÜ7ú—˛ªÂLÔ·O4u^?π ≥0‹Œ%b“z•™ÇV˛Mà#œ˛mE=8˙0.GﬁùÉ:É Ü2‹¶œiü1í1ÍíÃ¢ÿøºÔ\xÒ-¶9∫rßùum ¢áÏØtÁ∫+wç;ŸÈ¡¿úÈÛ|æÑÓ\å‹¡Øö“â0æÛruãâ~ÖC‹â)ÏÑÆ¥fêmÍ¥sq’!õYßøÍpK â˙fw6†ÔË⁄∑ùh,>±[ ÊÙG}˛Õ3ùv{ª{›Ÿh9+9C]±."›Äòº 5‘~∑Bœò˜aÂ∫kπ3Õl€Ä>n };„∏”≈=√ó˚l«–sc∑FùnŒä®É\mæ‰LIk¿tKÑP*¥Ÿ^¢REÖfËπ#  ‡ë‹DÈjíáeŒS®öóŸxF2†÷≥Lî6'≥å∫´”ª_8xπuf»⁄¡úΩ∞—c2äe∏_G c™{›ós;wáı1 úñ›A˙:€Ü¸ü‰@Û ﬂfÒ€¶ÿ˜ªÒ”Ï7`$‹vqZ.g#Â‘¶G≈ºlnﬁ’~€ÈAg◊ÙWÈRô—jÇß3‡4ZØÚ/‰™˘æ÷‰%,–hû ˘O<Øú%å	—±äŸõøqò>á¡(*$∞ö∑◊∞W…ËÖﬁ¯RPˆ N à¶Ä«¥ÕNËPØÑé¿ÁB:≤a°#vJ¯'È>g¿lù=j√FÛqj·≠≈|ΩxEhÌg	¿ÃØù’|¨oƒpÚ§„eA°£"Î÷+ÊsÄ∆+ü#ÛÜù‡ ∞ﬂ#†ãy7a®lã{ÀN,l”mg}5≥Ê¢Í#ó¥ﬁ†muGcÕrﬂ&ÃùqÁ°Ì±™$^|&øﬁÅ¡Øºxô∑^qegßHÏÄı‰l§åƒÛFEÙ¶Ïv‰ç}¢“æ"2æ≥h;ò≈h?ÈLÄ±Ê?!NB®Oø∆fu•+ﬁ„£IÓ†Äaár¬h—[Õ%ÁIj∫eù◊∞tZlãZ¿µ^s˜2ZËH]¯nÖΩëﬂÏ√á÷øªì∫ÔÅ–˙∆ª≈Áwò?ÏNCƒ~°ˇ>ÉY–ø#˙æ;ªÙÉüŒº)˜/ƒ/« œ¸„Qpì¸ºÔÿÁ_»’{L—πCîgˇ´wøÛ0~Ä:~|ˇóõÈbË¡1&òÕ9={◊ﬁMd(∏U–â{+>C$è4Û8 äº“s:1h (ªß8Dt(≈Tƒ N/‡∂uùA±°4Â"îù¡)kOÑSH∫´çRÌØÂÈ1
ÆsTÉÏÜ°{ø|„ˆÉ√‹Z∂¨ôÓ¥?.9>m!ÁÔ$ü8ÿ?t§†]D„4på˛‚"!Ö˚H·>A
˜ÄÓˇÑH¡ÚÛL cﬁ¢8Ù‚¡µë%\Kπ0Àÿ.fq¨hî/8Ï#+úuq‘O0QÅw‡ÇﬁÀqò{¬e’√]ß/©¨Ç∏F'ÏÌ‰î»∂^¨tÿ´0àYWp‚2«+XzhîvﬂG∏Ï‡1ccãPÇÅıun<˛√À-˝‡´ÿ*’óXóá≤ıÔ¥¯íR&'tè1»âW'·I0–ôí€Á•97∂ôsÓ=◊J ú`≤bV˝ïk¢ÑÃg±xÕ	{ˆ‡˜:ê')ÿìı˙d}¿ó“ú
!êÀŒ\wû∏ÏÙ à8‡)
¢iËπC
Ú®å‹qñæoL1ÖçR†…'A√˚Ω†éo}làR≥Üeî™™xR8å∆s¬a¢Ò+Ñ;
åq@£¿b•Ω
»Kë°!ö¨u˚¢∏—ó4C=0´†Ú:¶Ë˘9?Ñ˛∞P•uÖ·d"¶≤NøˆP/ï~]sÓF“◊ì¢«—]vLûÁòÇﬂ(ø–»åÀíÂ(v	öŒ›ãˆÇPêw¬§è{a“‰°~.’Ê-˜ãÙy)¿sgﬂ«CqUL⁄ÉW
@_;8*Ô¶´ÖÁ`¬Ãiû+ËÒÙ¶kËÜqÛê0∫uùiΩ»–S¨ıœCKµ?Û$lΩ2 Zën€>ú^@°dC™tÆIØ£#_r∆Ó]%Ìy2…ÇÖ(≤¢ôÌÅK§”]≈DòN(.mpÒiÉÅoG%}˘(–GåN,Ç®ÛêÖ|ºüÃuÕáy∑tu¥Äü˙XE®˛Y1áñä≥ßRfM˝–œµür;õ+©pﬂç¿/ÛOØh≠Q?sÉmUªMFÇ”ìé2z2j3e<Rz_…å˛ˆSì^œó∆db„æDÉê-Ë~˛›hãÆ¸≥RëﬁÆi·[®ëïÊ!µa≤≤∂Ïd”5MWÑ#OG8Ú<¬‚¢QÔ+i—ﬁ~"“í±gK[˛¥Ö∑†.Ï€gß/&∑«?e·˜¯)ø&yI˜êFC»§Q|ı‡ŸBıEÑ~√$c}Ÿ1Dˆ7M3–≈3 >•fˇJ'¥∑õ°|q%Bë¨gK)‰Tö¡7C˛u£ˇô©∆èòm˛OL3XÆìD´X_ﬂ".u‰ÊFiJÚ(Eø^%IXÊúâ%iÀÁòL“ÿ_v‘¨~MSEÃ$Ÿ¡ÃéœÄ4ﬁ¯wüù4‚≈≠•¥PhÅ«“ÔÜ=îm˜ù;qØºœJc˘.ıS´@Ë≥%Ør*•?yMˆAŸñœ.îÌÖﬁ–è˜-˝ââl^B.⁄Í	i“¶ÍRZR∑†tñØÜI”∆≤c(q–4}¢0æÜÒ=≈<ÜæänÍ€O§‚ÀW“Ú…H[ƒDdˆÀKKß“$ä¶g∫˙ ÚHYˇ¯È±
M2ÙıG MâÎ±∞ˆY	”æ˝g¶Izö∆ ä¬íÁAÏoﬂt
B'ä´ÿ$ˇÛˇ˛K^¡2?¬˜ˇ€ ç\®IÍ?)øQî,€0t‹vﬁA<Öì;{◊ÄfA^‡≈l™˚¢{‡ñ≈=»˙ÃÒ>:Rp~⁄øïÍÊá‰rÍ]ÁŸÇr%uÆ;÷{àÓk«≈Í∞?æ T àÆ:û.‡ëÈÖ1ID˘˛ä≤:òZô‹€3Ÿ†BB›k7§]´äßËÌ|‹,ÊPb◊k˙]AkΩR¬∆†˘› ıZâadÛD†√æö/Bâ:”zﬁFNÍ€∫‰pœ#)˘cSÅ≠∆„ecá
K]L5Jü@<Jèü¨ﬁÀúìE≠úz—ñ8HåÃwÅWÒe äæÛ ÁÂø≤zç;–ﬁ£sK˜ZpÔ_[Œµ|á◊¬Ÿ˜«∞4@owÿ”€Nìr≥áÅ≥xπÍ<>:CÔñ| ¥¢øZÄÎ`ßPõùá~∆B0<7ºÚ©+`∂L≤n#¶!bü.Ç8∆[WÇÕ˙Ñ“ÿã|wBÆ›QøzG‡bºﬁNkÕYkÒ_wZˇrŸΩÏ_æ,<t‘ﬂwÔ¸à¶ÒW¬,øRK/◊›µã≠Å*&?Ç=Ë>“∑øÒïﬁ¿=âAÊ¡Ïı;óÓ(ÚKı¸3ı\ß´7T∫ê»Y7ÓàD-ûÁ ê!xŸz#Réù¡(ˆßÖ/‡u©émÊQfG‚>F^ªÜºFª§Ué£$Èø‰sø‚Ê#¬pﬂè<Ñ¬@oWÑ€∑ùÖπ§kaâ”°SwËœÄ∑^Ë.˜êt&7(ïæ‡ıº≠ÀU˙˝ÓåË&¸∫Í†D‰t˚ß≥¬´óßCƒˇñW˚ã ◊Ö.≥	p‘Rduu[NHﬂy¯∞Ei±”_J#º“√ Í‹Q°ß%@CèU*/éUM∆∂Ár£à’O¯ÿyÒ@Õ ¿]˙£—Œ5æåUŸ√R áW^k“Û
,KûH*ŸÓS±öíú&DV≥¢ÚZ5í±ËE6x:ñÒ6ÚÜR∂*Æ®û_ÂnîÜ÷¬gÖ%ÉÔ∆d`˘l†-ÌO>„cbxFWI ∞˘3ÜırÛ—l‚©&3sÅ$È≥ecïI%®HÇöb¡?èe´Œ™QÇØÇ5…˙Œ¶NÜ≈vÔ© Å„ÜIí.,ÍÚÌòuƒ|ƒ£ëèêøãf∏Q∏ óOÅø![èÙvrr0,®Â$ŸIs÷√¬"Ê~∆ÒTüyòZ»fUbØ¶∏⁄cÙ/˘‰Ä0Íô»J'≥ò/™ù3°p*o)ë`q+—g È46Ú6jEW#&
"@!|≥Jú ¸ì=s”À"ñM%PF
„€aZ,Œ?ê¥TFAÈO¶≥¸Ñ!x≈˜S~≤Ï!û‚¢
Í◊p»ÄÅjÒ…0í¡œ˛ÚÚrq+Iö|ˇ?fpãI™9SI“@µD%x…Úˆê<j†ìÃ#ÜÙ%I0oBPùœ≥àäó´I€BBí.†¨á.ï•·L'öÂÄ€ä·`éºèsg-£V
Ç∫≈eÓVISAﬁq©±ﬁÎÂÛX¢¯{´Ü4ÖçÖÉ7ˇù‰)∆#<<âÃ9nU≤¬“_à‘˘Õñ¿®MßHÊ—·˘í«sÛ$O5∫π…	ƒe‹úî-∂‘'6À`Cè±M9ô
ƒUÆ
3îÀ‡í¥«‚Äˆﬂà‘Õ@kuÎTŸH∏õ´‘·i£e≈∂ëˆWWz÷îG1&ïb˛§√©7t◊π¬ù«a˚ÆÓçƒ¶∏@ÊÁ8— @ñòÂñvD7àr8@‘±X∏5;∂’‡ùDF:ÌDN[¸n%ænr†§@m`§\2‚©º·3'œs¬§_*£LäízÁZSâw/àûÎÄ•:TÆA∂È°rö3˜XyIy™ü5äüÈ0Aé˘–]gVù$…∑èû»Ah¯>† <TzÔçäA+fúD¶}∞Umb·C¨@èÛ}ôºÜep6{Ñ—–÷ùáÕG”÷uW≥{ónRöH©\áxLÈÑ¡í")±>^"Ì¥kíîÒØƒ9{%=U∞ãŒvâeµÌ©ÙâΩ2‘œ≤]Ûç±]ô˙E äYÀfª»Óê©çÙX≠ë¨√¢»Œ Èz∂˙R	’á|Ip¨i8ÄÔ⁄≤i	≥M>TÇ#óu#≈‹∑|1N¸·S‚œR(b◊LY	¯∞´Æ %C•Â√"*øÂ#^ÑH[‘ë0©|Íi9åΩgí€ã§zû4kh	7c∑∫æt‡N˝ÿ˘øy≠WÜ’/#Åd˙(Öûî7Ï[!Ò$÷‘¡Â‹fÙã¸))3ˆ_ù˘Îû=üJ'âdûoqö®¡Vπﬁ∑‡'(n¿yl“7ﬂT ÉÚï≠“BŒÕåg}ô∞¨¨vüŒç„Œj°È≤Í|ùQ‚˝¬ç¢z”™Åæ˙Ã ˚)fINxÒ†‘f”uŒuΩ ıKÌ¶Jÿ˝ŒßüÍ:$ZwlLÍ.”I*iØÚ:˛Ñ¨EÏh&:÷÷R≠A•–T˚ÿÊ$)‹¥⁄Lêß¨ﬂÎ6ıJPû‰≠¬/Ÿ˛ËÁ ,^ã5N^ÍÂ«fX—›v=^¨˛q*i01]©Ï‰U6Mó∑≈¡Ù$¶Ó	≤¶2≈eØR2\ΩÊK∏Ùô.uÁ§iv¢fÏAAY´≠È®f'BáNs(Oı\Ô¸f”ÒØëTKYpåm“©e≈EÎÚ#ÂLíŸ∑™˛b}ë∏JÄÙ„bæÊ)/átçˆë)KÒ¡ﬂ≈óAmCËÚRêíN‹È©6¨µU¶K…ã2>Cï4î9H8u,¥€f’¸Ûk.™h,“í>µ5rÍ™v¡û?&>KãUNX˘ÛQE¬4∫ñRÖÀÒ· ¨i)PEÅ©GÁPX‘˚¸Ú◊m>U∆Û_∫4?[”Kw0Ø¢c˛≈√À>¿◊®%®ß)©˝0i◊˙ÛË?
&3ó
§*´Òƒ \F≈¡ñuÏº∞ØãdVV¢â‘Ñ‰Ét _:©,»Õ≠yVzê“ V˘T´jëÆÓ ∫ïÁKZC/"ÈCíæË[∂#˙πWE!RURÈ‰6§˘}X>≥g@î´y	p«?ñ˝Á≥:¿(Ÿ≤÷'øΩπ‚’∆”QpÔyÜ‹iIPœ´∏Ò5b-3éπùÙã√Œr”uÈôƒä^§+q≤ ¿÷Î–s≈bg'§(Añè¥%\€\5©ÅT!ó7A5ÀX/´'≥sl¸ãÛ‘ôÅû$BpBæiò	W.9¿Wå˝ò1ÄjXIéfTò≈)åÇ(é»ùúHºÈx¢–eCôœp"Ö≈î
ﬁ◊¥ı/9RØlº\ö„â˜Ú™ cöœ6' ¢JƒB‚ŸºQs?©çÃ9«ws:ÍºT‚Á ‘˝ﬁ≤õåÕ∆ÂbÁ*D≈•˘D3aqR™Q’ﬁd±p%,[Û•”5lóîíôƒ∫ì“âÈy⁄z•Fr•fÑöª¶nπ– t\òó]kÑyadElU#"ûlDlº8ƒböö[7˜3á¯h€\:ÿÁV“P∏oà€»ùFy!ŸﬂxØ≥gBK$"/3Ô›K∫nY›DÈl{“‡çrfÎï‡\À«#ò€Ÿ˜"ˇj¬‚ﬂæqˆÄïq'˜Û5*)ZØvßSh˜Ñx™õ}«ò3h˙Ppg∂Nßk≈98‹o∞—c ƒêüŸ∆Â’[€˛;DzÃ‡1Ù# ˜˜ﬁêƒ‘øw|G/GãSE'jìå∑Ä l…ÌÆ°°Ä#—ÒP…`Í¸¯c´∏®"í….°0[‰‡zê‡#R◊QÃE8‰1'\åÒ#.∂¶µ≥è∆ ∞qˇ–.∆S—âÜÉèÉ‰ÑâQ-3Ön9„`8b√tá»pÅrnqæd∞ü5n∆ˆ,÷xJ… @Úﬁm;JSV9åÜ÷ou˘ÜÂÔéú˛”yx,ÁrƒqßSÜ∫ûŸq⁄<i∂æÃ˚äÓïHf	«^Vùo’g°•0 ¡√˛ÂËbΩŸêî√bÚÏOçˆ{@7“õU÷d†5∆Ö‡™{ßâ
!ÁëQês˜¬∆^÷;B¿Å?Éó[Ê∑ív´4 I35J7¢Zm¿äAVGè	˝åß¶^™¡Z±_ŒÖß∆‚ÿ·*4B†(h]W(…\ƒØ7„]i9j ¥®Æ÷∑l˚∑ùM võ≤Pô/}Í⁄]î>ã$À‘è®÷òÒz@¿Z¶Ñ`∞Îãàk¬›∏Ωäπ!ﬂ#Kø,}ªFD≠KΩê,zµˆõÙvé˚B™9œÏìW„˝?u˘B≠–Ø‹Q…∂1S@möüóÜ6Ü44¸,¯Ü=˛€¬·˛∂≥ îù‚π∆Z7íÆ˙kÕ9cœﬂeÆáïpíºömƒPíqÌ©>I}¯® 	$ê»Jùü¿(</¨◊}” y∞d’úõıCÀTûÏi,5ôô~!k#Òh_Ü_¥02¯ue¯E+ìÚ∞üg]zêò‰SoÏÜøFOù©ª°Ñ≥	àk∫õu0qZp∆#fÎA˙Ÿ1÷å{≤Ã∏.ıEmÊ@Øƒ€Íˆ˛®®çÈ"(R”s<€_LÏHæ.≤~ËH**ÆõBGtaËiGÑÍ≥gT}ÆÎÇ¡Û!ëäÿ5C¢DmÁC/¬˜ô£Ir≤‘°ÅÑ5,”Ω·l‡µ€—l,‘èKé–J÷±‰
…9¥ë‚‚ò¨ +≠à,–B´ KË≠ «:öGºóú’LyäfÒ˙WË|JËÃ’©ÜsÙ¬ıï¬x}´™`•Ó´,ﬂg¥Ëã_W∑¡’’Ã	_Ë‚6ƒ˜7±ÃVÀ sYŸÁí¿kzCáÓ;ÔÇ!0ëñ¢9ª∞`pòNB/Ú Õg;~à‘4v)#cºÒÔ`¨ò≈™ÛÍIW)6ó†ã/4¨ß˛õ/ôkñ©Ü¡†u¢∑¿$ËPΩΩ<´qÄ† ¸ÕMÓéq.´aq˜Üm¨EN|i˘e…Åü∫˝¢¸.[Q•°n“PóZY-jƒªÛ„˘áí˛∞≠!Pr¸åMÙ†	‰¶mgˇ9û≈Ö•∏J™àR~§ªÈﬂçúƒ	Ô⁄ΩâÆCºƒ[uøÓ|xŸªπ˛ÖIæÿ›wÎ˙>‚QaG„Gœ≈∂mufƒï≠èŸgÄ pÓíz¢¶@ué£´‘Â>ÁñeNÔ≤◊ñ„f@÷πÑëw¸Ic3≈BÌãÇ1-KÈ »id˘ÿZNä˘Ù„?◊ùç“˛IƒÛjOK≠Q1§◊ÈŒíÄË6tßÛgÛÃO©©!˛zf+£≈L≥û¶z$.∫Ã˛œ˝∑ì&ãÆóÉ¶\÷‰È¨CXπ£Ëæ‰ûÍ·ÛßÂï\á¡$Wj]Ø§4ÖÛê€€–…~ÄséÖ˝…,òaÕWwp1,<õL–ÂåUï,óàô-OiÔ≥reuK>fç≤@5Ü$/;∞ à4ÈsA¸è“m≈$^∆Í'KÏó5≥#ÎÙÔ=™\üo)>‹ﬂ´Hä∏Ùb)ifûïπ\EqU@OU·'ÈÄW˙°"/•˛$oW ≤’‡Q(U H\U¬s+ÙÄ¬˙@‚™ ù◊J⁄ï°∆˝Ñ0ØQ!èå∑ôEMÕhh¶1e∂{ÃÛΩ[ûç¨{≤¨ôı' OU0Ä*¨∏8Z ±Ÿ∫Å Ò»xàj|{]u›íNÅ÷6a√0πËÿ8Ä˛› T‡˛ÀÇR	'/Z\(|rıå»õÅÅës·N&ud—ªN?ëBÖÆ…—ØºH§]8Ω¬rÒ¯w?Ít	—%_{»m•_◊πD:á»ôË]œödFÕãœÎÀaòvUóù+»∞QñÕ	–L_‘≥ƒ=`¢SQÑ¿®P‰¯E≈ëˆIË›‰˚(S®*GÈÈì>%ÇZ"»éÆ‰…≥92Ò»yÒ∞Ò RúÔùU⁄]p∂˘O"˚’BÂ<‡ÃiJÈÌ©SW#Yï¥öbE9—ö≠ÑÕÁ‘¢MoZoR'“s_1E≥òÇyê∞‚»B±–><˙|∏¢UÑ*≤ô◊%‹Qq∂t¸#|>o≤—ÁãliÎÎ£ÅÛµLì´˜”Ø∏‡èéŒ¶lØ#ÁúÙéÌ„˜Áœ†I\êÃ˚èÖ≤’$ÊG(ÏEœ
§Z-"»D»U4Hdû>_YÇÈΩQŸ$äd≠ì(L}˛±–Hëù∂"˘P£é¸âPHâG
’1o(%à‘·∂√ì£ΩÓúoú}åF9EœZÒÃ‹⁄U7≥ëì≈ges5◊ÏkÚËâDØÄ‰Êu»µÀ—ÕÆ√äùËm±ø•ˆWúØÚ!&∫+\S€(/ít0›-6Dé(=Ÿ˛íZ*zä?kÇ?=¥íVº\Ó?˘™íPæL9á‰@-9°wπD˘€ùIP*A†|ÒdÅuVJ(_¶‘Åoı&´'î/{"¡M©„8,åÖ…‘‘@⁄¿û¸%1∞`J%k†\dï{W)ÀÔ[Õnlç‚5Îje≠&YêX(JHh∫$PHŒ99…2úZÓ®õç%Sb_‰P°j«©F¥∫fYCVπTı˙M•]mÀqˇxë[kJÜœ‡¥◊ßv˚n*X‹—ÜÛ”/g±úˇÙ‡ÕQï†≤N@◊º	ÉÒveÜº.±∫eÕx‚RIn"njcA4ÿ90†rRP^10uCV˛€Ä√e/1’:⁄86û„ LÜ_èQÊù_Ã!ÇlÚÒÊæ ÎÖho|ó#Á5ë«“«Ë°≠°?R63˝A‚g´qWu8+ç´™^®‘ÄâÅ´^D4éÛµ¢qÖ’Z™XÃT˙%‰'ªa⁄^ÕG.Õòû]™Pí˘‚¡»ØZ™;ßÕÌ|Üw@;ı`}lï•≤å ∑Rëˇ‘πÿ⁄UMôØôrx´;îWaÜK‡Õ≤®—,˘lD0Î¬ÿ.Öut¬m%ÕﬂΩb“∫≥Î‡R,ÊûDùò…‰&ä.qw7vbE*æ=NpôH@Å†z∏Çπ%å°˜ΩrÂË>¶÷'6¬@ÙÅ»cU´Ä,-®å"∆√ µ»,^¥ço¯:¨(¿ì®∑À§è*Ç˜‰¿Áú≤Ωøı£ÿπı„kÁ*à~Ù(N‰4 {"È Fò™√ª≠H∂.…Ùp9I©y›—£»‰ò∞^Øû!?˘~_>c˛VÍ”©Ÿ÷§q%mYãZ&≈>”ÍírŒö‘ªä»@©ƒ-Yıù(6Ëû‘=∑⁄-Æ	`ÔßdÚmpN4P:Ä]ne	d@HãXéΩ&„X∞ B5“z[ZÉ÷+ƒoÂR¡ˇŒ„WF}é3∫Ò8Ëí˘Ïü¡&ld7·,òÖ/â~{⁄â∞l çnáÊß˙Œ ´ŸÆúﬂ9ªcd*æ¿	p£ıÁ⁄π*¡|Áa+{p3ú˝`P}Â≥ºÒßãÀ≤®Î£óûHh‚º5(Ù+ócÆPí";Ö§äΩ8_…äZ≈Fı+ó˚Á´RªqºæwZG®yâx)
O™B·≤Œókî¬ïØÌl_Ï‹9pPcËÑ§æÖ~#f≤Âı$™âÚÚU/ﬂ%^üGL2]:;;é+G¿õ≠iï4]sÎ‘lWS∫∂¬ˆÁ“¡∂>ónŒvU‘ŸŸ.-Zï7-·*5∫“¬MQΩbàbÕ›’’s€Æ˘œ^L’«5fÛüÆ ˆds+sï®]&°jﬁ]˛VE“ZÆJè~ô*⁄ﬂQπû9pÀCËGáìA0ˆú'æ„È&œÔßQÿ≤PÔ W.Ö¢_Xe.x¢∫*0%©¨ \ÌŸ„zœÔò\
{R
≈e™˚"pÊÚ’‘˝ö1ÄïÄ©=Ä˘éobÜ.k5≥]Ÿ¸v}©(çV],QngŒj§OtnlÄk@Ërfg·hewaŒâ’B5 Ä`çÍê'[Ú&8/›≈¿ê(ı®ª¿“Áù[*«ì≈3T€…+%“¢€¿∞Ò¢Ì˜¢AËO±Ò˘9ê9)\“åŸ¯SX…¶^ÃçÌ¬’	ΩK†NìAEg„§öYõávì\9£ê”0¯PG¸–}Ù˝Ú•?∂€RéK™›ÖÙ÷$˝+‚éco¸˝2ÈpÿÏ_:mls±AπcnRm∫
ÅT3 2e÷f,≤ÄÀÏ∫lQìÃfÕò¡JMS7ıâ:öõ}Y	r¬¿@¯ 9∏áTÓÍë}å|ò#6·|Ô|r⁄/Ùü?a‰Àú$(3¸fNù∏öˆiÖÉ5&[ôXèãuÎ∞â´ÍØXû5›◊c¬ìfLÀpÊÂ⁄3©|n≥í∑ñ‡˙àv#ïñÄ;π∫˜¢≤√¬|á|}Ô, ‚s1¡r¢ß`ﬂ63Ÿ≥ÿÔ]ñk¨ˇmÍü$‡_≥#‡7psè`qé*@Úı†lXÀ|	YM ní[¡å1>Êë!îO&ä»z*ôåb7a'ß|Æü)r”∏:çl¿ò)íy£Ï{~º¬*y;$–8xún4çÒ>Ÿ∑î1dô-t^Ãœx&*ßÔùV6¡‚6ˇëG¡WÙe‘Ø ¡¡¶ÎAÒ∑4ƒNÎ1ÅEóvÔÀAaO^Iá{â¸∂ÁÆeõ’gÑæTC$õv¡¶∫K3Â±Ê*4nf†q„Y@£ ;y_.Ì∆1Ä•ª‹F≥q”P¶S-.K>ïæ–MßS«doúOÉ∆KºRE∂◊∞/o9äÉ)ºS˜äj¥42‚eQº7◊IC∂Fº2©;≤‡Íˆ∆TIí—|n&?ä‘¥}-5mø¿\`Kπ+El5∂<ƒÄ|i˜ÇÒt‰≈ûIï›LèÕi4æ;∏ü+ó^a˚çòNÒ™g`4éÈ+æëØ/ﬂ‰‰8¶ »=7‡Ë+Ç∞ QÂ}ü!Æ¯=øÍæ‚™qÊ
™˜fz®íÀ©†∫Øˆ∞πXˆ¡∆b^X!§7AP+Ωëú2=M4[™ ÛaQñWZ†úã§™Tô»ñ
d®—úÎŸ°W"aå!¥ü	ˇ¨R¥¿úÃë∞-K{1r,Æ®FÜ [- ˆw+iM7ÛSñ`O3ø=êr–√Ë≈ì˝7ü°∫›◊≤v_xYªıZeÌD5ª’ß´fWªé+`W\ø.7Û\~Ö∫gPòÆj=∫jIH∞>–9¥©ÚwŒs.BW∂\ÎUZâmﬂç]^LÙ‘ce[ùªÿöö'§ﬂåG“!Su8lˆEpÁ§‹sÜ¡`FìÄ0·èù8#˜>ò°Cèà™:Œï7Ò∂y˛U÷Ê‚àNd¢ÿætGQŸ,0Zj—yÍŒÙ-RÊSTõ)πEµ´ÃTb|
1˝©Áé|SvŒ®Ÿ[´{p^å´R ≠-=\…W∫æÍ0e¯=‡∂ÍxΩt2≈="æ4¨ÑâMzN	≠Få+d ÂåUtªf‰˝…j'≈J≤≤‡q∆ﬁ¡ßkU£[•:\≠Å®ÃÏjRo>+Dæõí»ÆÁ0”ãJn?’hΩqΩûÕı1.LÊe¢\p&`K|tÕ¬	a√—K;%hº˛êØıäÉÃí0ìcmøÿÀ(ä‚v∏–Û0AÕƒù|.îì4‡`I‘›Z˙‹ñ¶,4⁄jﬁ{FóL
uI∫≥± 5¶-Nsu¬N@Ö1€Œ√ƒª•pÇvZørÛÊ‚cœEj˛ƒ‚?‹N£Kﬂ¡îÆ°è˜8°=ò4ûﬁ˝ŸsCÌf’UØ¿ VLZv{SßÎ¸ı‰–yÁ¡¬"È‘Ewb˚ 2Â‘∆uøZ≤>dT(÷‘c:ﬂ√mÁ‡ŒÃà$à)Râ8⁄˝˙êü)é6*≈—YV‚˛PY9˘ ÈÖ7⁄vZ\Kaﬁ~œø°T)ª∆Ë˝ÑŸ˙ZK,E‡6– ,Ås∫‰``¬∂ÛÈÑUw@?°[¥mÚxÒ¿KcÏûÍÆãèüú«Í.êÜ¡û∏˜<ìé{·è@¯7èˆ$3Z`lê∏ÎC=i|®∫C&∆cégú«à‡ßXÏ¡A2ÿIXæhE4"2P±›ö∆îO;r‡)ˇ“˜ÜséyœO\„Ò8∫,Vú∆Ê ÅÄØ⁄êÒy1≤dß05±º…S¯cvâù:˚@{Ägœº¿o|[Nº8æg¨íÍX
˚G‡£¥ŸùÏ••,∏wíò§Ì~‚Õ≥{yÈc˘l‹l~oºA8Õ"ÚÏ9Ü-ÜÓÌƒAoôP·[7úP!ù›ΩÛ√üZ}—a±ôøN˝48≥FﬁDWæHQãZZ)M)Sî–©€Ø˜`I¬Z“ÀZ˚˙¨‰GÎ’¨Õ2¡A≠‚Û˘c-˙è≠æŒEjeà»ß
áF∞W”õ™˘	Iãm
|LãHa‡_\<µáRÉ≠Z4©‡Û.d]éP¬ıˇsÊël†¥ávç™û_¶¨krƒlÓÒH^Ä˙˝Ï‡ä’ 6—ƒA·2d_l®Ê	‚¡)Æõ$Ò‹G¿ÌIy0’KÌÌ7ŒƒPÕ+ıA2+~û⁄ú[qæµ„Íé`?Û°´x‡“ÇÚÅ€Ωq˝Kl'À§#⁄«%.Ù"/
‰√|ÓÍåˆô	Ω§∏îÔ*Q»,≠‚BÓ ¡C‚Q^¡ØQf÷~O·ú¢àûØ—H¬UcFÂÑÖ’3/
c
[Ã:(1/c]~$ÕÍc∆[T5[w~g_Ãõ¶z¨ìá@ö9∞ı
°ÊÄ∆·¢RΩmÂzôNLîE˝]1»ÁK0~é˘%í‹^}é˛LÙû≤[¶πeVπŸªXœª™rvº‰≈Lñ<{rºƒrSofâ8Æ"‚àâ\òπm2ß{©HàÉ"¢≥C…‡&À°Qº¨Ô˝ŸH¥=¢BŸyí:ä7ÊêI∆›+€·˙M‰Ü»F_¨*#ûﬁŸp‡N}`˝ﬂ 6Sö?–§``
"EŒïèaæR”üqÿ∂(L¥I…3Í&ú˝LJ
rNÛDP>iJ'œmR›f›*∆ôæx‡»&z÷7ÑûaÙò4ÛfzF≥œn© pÕ∏Bg*Œ⁄≥lï‰Ì»©….‚çïö7˘>IM	’#Ω¥œç≠πîE RÃΩ{ı≤Ò™Q'¯∞íÀµ|YYûLˆï≥Z?uÈwÒeƒFQßªjÛúÓıWÕ‰pkÆ45µ3˛¶òO±Ò aY-¥K¥÷˜Q»A—b–j°≈rR°åèçDıNø7âov:˚œÄæWõëF‰ã&x,®Ωï“[ÈºuBíúY!=·J¥˚LV…&ŒO üà®≤e∑ê§Å?liÏBÚ }€¸BïÓûé£¯ΩBª‡M§¢’_Æ»FîƒJ_®™Mo‡±“ıÌYp◊.”ZøvˇÑq^Õx5WÛ˙Ã1^w)ƒˇ?   ˇˇ  ı¥]xúÏ]˚o€8˛Ω,÷…nÂWÍ>ºIi‚ﬁhì\íÎﬁ°(∂≤D€‹H¢ …±ΩŸ¸Ô7$%ôzY§‚¥Ω√h„»≈«Ã7ﬂáBÖrÙ§x≠XNIËí0Dæ%xQ˚ÃAg<è"Í’◊~ nTjıNb›ﬁÌÓ°√#tßÙ+!é‚ñozq˙vwb:!ﬁ˚EπÇôÈŸ-}Dßf8S3∞YEäu‹ﬂ+›f9fûô.>‹Òó∆‰Øå~{Ä∆Sc@å›.ö—[”K/·RÑóë±òëãèÀM®c«¥n–‹˜q`ô!|¿Ô0∆Çÿ8@ù{6∂ç•√æÒBÍ¶„†pf⁄taÑ.ö8xâ†b74,ÏE‘‘Ùç4 ö!ü~Yºê:ˆNmO’DÓ‡î.<áö∂<*„9ö¡øuèwPG±æ–7Ω£¥Rò<tJ≠πΩ:ËÔ∂$’õ‹Vﬂr–q)ËvÂ]ÏeeË†sÏ◊å0Hvà==…|◊˘	ùP◊w0à≈5õ_”bÔEß82â¢‘6ÙS'Wm°÷|;ÓBÏ`+¬ˆıRTÖ~¸Ìñ˜:"OﬂÑ,±çà˙ht—ü∆ßﬁ†˚πD∆˛òáô¨í_}òq¯–ÅvØª›ŒÀ.É(€ıA»ÁÅ·⁄»£ÜÄ,Ól˙ı»oúA‚Å*òŒ·›¢æiëh5D›g(¥L√ßˆÎ¡3ózÉ:Ω6≈Xf*Í•ıx-›∫JíDo Z√Y]ˆ<0ŸgVEˇ¬ÄC‘b?ŒÁQ´Æ.iFaZ$`Ú	 +¿Óg¥0&sÄ◊\1∂&† åÿ6ˆåÈ√WÜô%∑XH˚œ∞®É∆4`0%~ƒ≥ﬂáŸ’≠∆òÕ™…tBà˝ﬂ±…ÍŒKæ‰ÿP›°oºLö5Œ∂Øp\-œc-0Ù=ÊA∑Û¢ªAb´⁄QÀ˚
5ï˜*ce±EY€údrŸd•Û*æçøÒ-q5TöÛÄ˘@¡7kæá≠õÌÀÌ‚ùw¶l¢Ö9uds /•P¥∂©ôŒ6ÅOYŸÑœÍ≠ÔÃˆ5˙Í∫öàb7ÀBÏf–ë`›hvMÓQÄ-–Œ]◊VP{ ¨±‹ÀÙId:‰Oº¶ÚXœŸ9JMœ±eÅHF˜™ñ{=V˛VeMı∂Ê$LÂUŒﬁÓz ¨{˙å“ËØ…„≠ Y ‡/Byûß‹S∫»¿!KÎÈ+âh“âC-ME≈¬ø5˘Ø¶Ä£≈ıjçN¬πﬁP{ı£“nac|àŸ’ôÒÈ≈‡vˆym[WÜ9èh∆æÏ´ÿ÷∆ãÄpı<vôj°pjõZﬁ\Œ÷≤¥ÄYéj{.ïzÎ©a‰4Ä!èG\»?ı∫˛ÚsÖ3ïUçúo5v®uÛ »ì†Åkö8òÎÓ›ﬁù~÷‘ÒNƒè~Pw∑Y…;	m|Ë)æ^˘¢ÒZËW‘‚Ô≈.Lásç∆¿~E˘Ω˜_ÓıFº‡ TµÚgﬁ,£uèéGß%èô|∫⁄}O3øä¿ôÓ2—ü€œ–ùNÖ;wﬂbÇO…îD·ıÔÅúùY÷!Kaó∆>>Ù2÷A&90πçÆ/hLa<C:,iF p+€\°—“«‡>™À+0Å H¶;ÿI»≠¯çEO≤∞$Æ˜uƒéï!Òl2•È;‚_ã/âøP~ãñ`•s=öj≤¶©∑~ºEÃÌÇ¶ÿfd¢ø§ô]ô≤ŸåúÑ@f∏Àìàec◊gøh¨6ÿ™›Ü–CÌKå≈cA≈O·ÚC1ßîgø ÏTÑ`Í0˙Î/‘:Î∑¥h∑qAâ©=Í†ƒ“C¨±»@#¸É±É—%6†dÍ±–zK0t`A¢Yrˇ6kTk©$fºçÂRë∏√ùA∑Z6ƒML6^gx©¡F	»[˙[OGhjΩ˛|`‰£ßÌ™5îÕu¸π	Ÿa•t™ıöÆ©¸ôÚÓæN{ª∂mπ0H*=¡Z¡L≤H8JFê	q´mbÉ1J•FIHˆ£êé∂"°∞íæ1œ^Le®¨{¸≠9AOÇÕ‰9nQ∆Û€o3ﬂè˝üVsRgËÊ‡Iƒaıç^ßèÓòÚW¸BÏ‚¯¥/4<Í©/?§ç#û?W'ˆIâ¿xIUs∞Ârk:s`u>ü16ˇòüRüü§PÔÑÛ„√ª]úD'.Ú’Ó‚vdSµ˘ã5¯mR|Ä<ƒ¡·N<ô¢ıÃ®—n∑ıá"#<>ùÆ˙.∂…‹ÕŸC„aè!ÑÔØêpA…0dP˚
√ U[ÛpHÁëŒ õ¯Û¿>Hø$&ß€Èoàró9‘TÚ¡¥ZÀúy‰ÅYÌÍŸ–ám‚YŒ‹∆·.åvΩñæ‹≤^º Ëı…?ØÆœ?¸>:ª]˛~v¸a‘“¨ÇÏÍ˘≥¨ê	 	7z ºìb”ˆ‘Œ
Ë”®–˚ºB©/['Âaå—6€‘j5iá÷äãÊI©”ÌúYóB¯±cÊºœuZ2ÊŒt€Zç§Hwn]Ú,î{ÆòﬁÑÌ„R≈tM◊c˙ÍQæ¢ª©Pü«ÆnÍéUsü¿ ˇÂH¸8Ëà€ÙæßiFj:Í`o
ã-t´óØ7ï§≥6	YÌv‹’ùù£3ä\3≤f0Òâ’ö0ijÿqΩ~'Õä[S@¶ù£ü—à€	∏‘ïô7XT˝6¡‰÷AÉ3Ó>m`¿˜,±<8h´=ÖﬂéÜ{±Vo7Hƒx4.ËN¬¬ê'gTÃç8Ù6@Ìòã’„ˆ˛pª	:≥¢AÃßHs!|kÒ.)¶ÒC_8¥"PÆÉﬁEÿ›N ¨R–ƒÎ≈E∑46∂n—cE∆˛˜¶ÒO¿<{ÜI¸HÁ÷ö}F€€ôKóz¥2ç n»8¿ÊÀv,õ“ i›≈Ñ~ªY<˜±«xŒ”1a¥'$˝ÇÖ§À◊›|ñ’KÁa¸˛Üpˇü„MsÃí4∂8«w_rp˚CqZ«‚U«FTèGW[)÷^ .ó*˘ıˇ•k∫wªÖ^— ⁄Áô3ôø∂Cò}á‡Ä”h ◊u∑œ®/à∏’˛Ïo∆v5‚*;íáq·Œ”VV"tV‰‰˘—õÕt2§œ)†Ç
Ë,GëiÕ¯äﬂUdFÛ‡»Û2x˘ãäR(¸å4é≠Ê®§*ΩT…Ó}H*nybo_k$WÁ›ñ˘'9F%ÄkÆáW$K$8€K<≠‰¬Àx”—Î'w§i§˙0|pa2≈sàüu˘f≠%›–∂÷›¸âR()¶≈‰ñö.ë÷MUBù/±Ö¡âı€|éŒhz˝Ñ˙´ıóö1•Ì-≤
ƒÕeÀ+/è5NI◊—Ñ8ŸÒ∆∞(0,$Di@ä/a∆≈í1LÔÊœBè®E†Ìq÷A4ÉÁEÜÛ#è´ı‘J_ÆØÚéÑ'‘õê (œÙÛúu Omˆ.]/ØÊñÖ√PùT§çr.7»'LÒ´˝‹NÑÏnë–Úœ]∞œıù0–›xüé11ml’”≤^løyΩ«¢†àKRòQÜ˜BOÄõﬁ]˝’hm¸„Omƒ@iõo‡Î¿+8pM”YÅûπîÌ
®+/C˛™ﬂá†∆ü´ ∂^J%”}Î!XGÌ•Häú º lÅ#6*
√¡R£¨ò7ƒkï—5∑˙÷YAπ€ùÿ≥ôﬁÛœ<	>U
Õ.iÏ’êãXÎG√ãª>ﬁ7ﬁµ¨∆O÷®∆OSƒ÷Ø'ª=yuO]∫í˝%˘‡[9≥ÆL4öî›ûºÖeSVÙïÑÖMQ›	üyÍ€
°ÿÓ.§NùÔEÚûKró⁄¿TÙRƒï∂≈WJ◊ÊÚ’ªﬂ+7ÃÁdì‹-Ú˝∫∆ÎWÈÄ„›º@u[h`√Yø"Nõ2*π•»Ã)#Ÿ…oÌvõsÁ„äŸ‚]ËÂßÔ“V†ÌÛd¿‹˙(ELEƒ ÏËp£HÔ'Næ»”‚åª˛™€-¡”Jñö2aŒÜöÖüOfÿ∫)£Æ“ŸR∑{çE∞l–#ûØ$[ıÜˆ%|SÛá÷|Û[Ãz H˛0_%ûÌ¬ ?“T+‘≤Òûı9o)em†cnA√!:Ω]èû°ì˜ÁW„Í¯„˝à>ú√èÀ—…˘ÂÈ3ÙÒ›Ë∑ªDÚæœDR¢&Á$rëH◊x}¨˜±ÅÈ+Ó*=+ı›§„Ë˙Ú¯ÏÍ¯‰˙›˘ôZVÉ
È”ürÇ¬BË$º2o◊	5a‘òK„säXÇi1“¢õLZ¡ﬁTœ*b•Q¬hπ”Z)´j#‹Ë<•Á“yJ	¨fYcØ‡†§@õuÊ•ç)‡~%é…¬¥IÊ˙Z¸¨G#V+]`ÖõXâ∑Ï«tNﬁ≥‚∆√,
!E ∂∂áˇ—,ãç-—HvW|-Ê∑úÔ∆_J:◊RO.XÛ\Ìı¨j√Ó:<¢h«%ºÓÖÅRﬂBßÈ±6ÛT∑{8+YàH±éM‰¢˚≈®FC›ﬂn\CùNÒs79ì≤T≤"IP(∏ç 5	≈—µ˛º_E¥d&Pb˘%»RÑß%…Âó€Q@‹]±ÃÖb†A¯zŸÄä∞R-‚≤ñ
π¥“[∞,_?§‚⁄yµxÎ∆Jl·ÿXÛ¥f$ÉêÏõdÙxƒ›å‚ÑËV∫±mU≠Ò¶õxQÂÚ&M\f6»Oƒ·√⁄À‡2^Ê‘Û∫ö"»˛PxBÄ £w◊ﬂ-^<›∞ˆ‹@„uùVò„∞°M∂£Åm˝(÷¡ﬂ«ŸXªﬁF0ı!—ÿ ñ;Ω$πØáR=g=û⁄S%RvTèà›Ï<Ë{¬ Üd†ÁÎ„¡$DNN≤Ñ∂jùÌ£	‰µ©3 ›H‚\ôLvHí"=+“@íå≈§î≠∂ÑÙ¨áÕ†∫˛Œ⁄P⁄wtÓ{v4„ò.QGŒ#dY> ˇnÈ1∏w∑kÏ+è‚÷ûm∫–‰l€W˙g€JÁ⁄¢ Ø?‘vﬁ÷údªÈQ˝”b˚çéãçOƒ{›Ωù}.7„§±Í»ΩW[;ÁuPóà†ñãSvVÈ“Iœ*ÌkV !0Mçc≤Ævò®˛!¢;GÈk÷Èt4;e·¢è£hÖ¿œ@Iqr⁄ß}µkèÌT¡#Åm’
íîbåAÊAä·Ö¬È∫èqÚf’™Ûf´0Ωeßf2[µò/j≠QΩ-©3’*ô?Ó≤d3©ﬁ°πFπƒcà±ﬂeY©5⁄)ÑvôA˛F¢Ÿnãj6pú‚ﬂ•\uﬂ,ä¸;ﬁ¢~AÄ∏”z9e%¨Cπe˜jèôNt∏√M[úº£ˆú4©S–Üaà£H« È)ˆÄrye'GJI©£öÛ≈˜Ê8∏††¶´√0é…•˙
j§vè≈{µ„Ø‹Lhúx*î;ñM1ê†√©6´n(?Sª◊mÖˇr ‚.ÖÆ∏cc_=@^ÇÛnı∆J®ª/=k˚Íá._∑K≥≈◊gSèÅ]œpL–·µc&◊ñÈÅ«¡$}Òá?ò·!¿Y©…2~◊Ÿz”í6ŒT”Vf êMÙí±eˇpÁw∞‡ﬁç¢b≤¥à)ì	bÂQu•Hä4¯ƒ„ª„´2.”’¥Êõ${v®d+#πıX€h	ÔÒLÁ=Òn∂„Ç•oD˜oç*:ÊV\±|e√”õ=¥í•◊HﬂÓ˝Ú‰˛ó'O˛  ˇˇ DÕS'