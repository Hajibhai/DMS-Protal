import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Company, CompanyRecord } from '../types';
import { 
    Key, 
    Plus, 
    Trash2, 
    Edit2, 
    ExternalLink, 
    Copy, 
    Check, 
    X, 
    Eye, 
    EyeOff, 
    ChevronDown, 
    ChevronUp,
    Globe,
    User,
    Lock,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyRecordsManagerProps {
    company: Company;
    onUpdate: (updatedCompany: Company) => void | Promise<void>;
}

export const CompanyRecordsManager = ({ company, onUpdate }: CompanyRecordsManagerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    
    // Copy state
    const [copiedId, setCopiedId] = useState<{ id: string; field: 'name' | 'text' } | null>(null);
    
    // Form fields
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [name, setName] = useState('');
    const [text, setText] = useState('');

    // Toggle password visibility per record
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

    // Search query state
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    const records = company.records || [];

    const filteredRecords = records.filter(rec => {
        const query = searchQuery.toLowerCase();
        return (
            rec.title.toLowerCase().includes(query) ||
            (rec.name && rec.name.toLowerCase().includes(query)) ||
            (rec.text && rec.text.toLowerCase().includes(query)) ||
            (rec.link && rec.link.toLowerCase().includes(query))
        );
    });

    const handleCopy = (id: string, value: string, field: 'name' | 'text') => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        setCopiedId({ id, field });
        setTimeout(() => {
            setCopiedId(null);
        }, 2000);
    };

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const startAdd = () => {
        setTitle('');
        setLink('');
        setName('');
        setText('');
        setIsAdding(true);
        setEditingRecordId(null);
    };

    const startEdit = (record: CompanyRecord) => {
        setTitle(record.title || '');
        setLink(record.link || '');
        setName(record.name || '');
        setText(record.text || '');
        setEditingRecordId(record.id);
        setIsAdding(false);
    };

    const cancelForm = () => {
        setIsAdding(false);
        setEditingRecordId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        let updatedRecords = [...records];

        if (isAdding) {
            const newRecord: CompanyRecord = {
                id: Math.random().toString(36).substring(2, 9),
                title: title.trim(),
                link: link.trim() ? (link.startsWith('http') ? link.trim() : `https://${link.trim()}`) : '',
                name: name.trim(),
                text: text.trim()
            };
            updatedRecords.push(newRecord);
        } else if (editingRecordId) {
            updatedRecords = updatedRecords.map(rec => {
                if (rec.id === editingRecordId) {
                    return {
                        ...rec,
                        title: title.trim(),
                        link: link.trim() ? (link.startsWith('http') ? link.trim() : `https://${link.trim()}`) : '',
                        name: name.trim(),
                        text: text.trim()
                    };
                }
                return rec;
            });
        }

        const updatedCompany: Company = {
            ...company,
            records: updatedRecords
        };

        await onUpdate(updatedCompany);
        setIsAdding(false);
        setEditingRecordId(null);
    };

    const handleDelete = async (recordId: string) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        
        const updatedRecords = records.filter(rec => rec.id !== recordId);
        const updatedCompany: Company = {
            ...company,
            records: updatedRecords
        };

        await onUpdate(updatedCompany);
    };

    return (
        <div className="mt-3">
            {/* Trigger Button - Designed as a beautiful card-link */}
            <button 
                onClick={() => setIsOpen(true)}
                className="w-full px-4 py-3.5 bg-slate-50/50 hover:bg-brand-50/30 border border-slate-100 hover:border-brand-100 rounded-2xl flex items-center justify-between transition-all duration-200 outline-none group"
            >
                <div className="flex items-center gap-2.5 text-slate-700">
                    <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
                        <Key className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 group-hover:text-brand-600 transition-colors">Portal Credentials</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-1">
                            {records.length === 0 ? 'No records configured' : `${records.length} portal record${records.length > 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider group-hover:bg-brand-100 transition-colors">
                        Manage
                    </span>
                </div>
            </button>

            {/* Portal Credentials Modal Popup */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    if (!isAdding && !editingRecordId) {
                                        setIsOpen(false);
                                    }
                                }}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />

                            {/* Modal Panel */}
                            <motion.div 
                                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden w-full max-w-lg flex flex-col relative max-h-[85vh] z-10"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl">
                                            <Key className="w-5 h-5" />
                                        </div>
                                        <div className="leading-tight">
                                            <h3 className="text-base font-black text-slate-800 tracking-tight">Portal Credentials</h3>
                                            <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate max-w-[280px]">
                                                {company.name}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors outline-none"
                                        title="Close dialog"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Body / Scrollable Content */}
                                <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                                    
                                    {/* Add/Edit Form */}
                                    {(isAdding || editingRecordId) ? (
                                        <form onSubmit={handleSave} className="p-4 bg-brand-50/10 border border-brand-100/60 rounded-3xl space-y-4 shadow-sm">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                <span className="text-xs font-black text-brand-700 uppercase tracking-wider">
                                                    {isAdding ? '⚡ New Portal Record' : '✍️ Edit Portal Record'}
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={cancelForm}
                                                    className="p-1 hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 rounded-full"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="space-y-3.5">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portal Title *</label>
                                                    <input 
                                                        type="text"
                                                        required
                                                        placeholder="e.g. ICP, Daman, FTA, MOHRE"
                                                        value={title}
                                                        onChange={e => setTitle(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800 shadow-inner"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portal URL / Link</label>
                                                    <div className="relative">
                                                        <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                                        <input 
                                                            type="text"
                                                            placeholder="e.g. icp.gov.ae"
                                                            value={link}
                                                            onChange={e => setLink(e.target.value)}
                                                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800 shadow-inner"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username / Email</label>
                                                        <div className="relative">
                                                            <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                                            <input 
                                                                type="text"
                                                                placeholder="Username or email"
                                                                value={name}
                                                                onChange={e => setName(e.target.value)}
                                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800 shadow-inner"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password / Notes</label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                                            <input 
                                                                type="text"
                                                                placeholder="Password or details"
                                                                value={text}
                                                                onChange={e => setText(e.target.value)}
                                                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-mono font-semibold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800 shadow-inner"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <button 
                                                    type="button"
                                                    onClick={cancelForm}
                                                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    type="submit"
                                                    className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-md shadow-brand-600/10 transition-colors"
                                                >
                                                    Save Record
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        /* Normal list of records */
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                    Records ({records.length})
                                                </span>
                                                <button 
                                                    onClick={startAdd}
                                                    className="py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-600 hover:text-brand-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Add Record
                                                </button>
                                            </div>

                                            {records.length > 0 && (
                                                <div className="relative">
                                                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search records by title, user, link..."
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-800 shadow-inner"
                                                    />
                                                    {searchQuery && (
                                                        <button
                                                            onClick={() => setSearchQuery('')}
                                                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {records.length === 0 ? (
                                                <div className="py-10 px-4 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/20">
                                                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                                        <Key className="w-6 h-6" />
                                                    </div>
                                                    <h4 className="text-sm font-extrabold text-slate-700">No Credentials Configured</h4>
                                                    <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                                                        Store secure logins, links, and notes for this company's portals (ICP, Daman, FTA, etc.).
                                                    </p>
                                                </div>
                                            ) : filteredRecords.length === 0 ? (
                                                <div className="py-10 px-4 text-center border border-dashed border-slate-100 rounded-3xl bg-slate-50/10">
                                                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                                        <Search className="w-5 h-5" />
                                                    </div>
                                                    <h4 className="text-sm font-extrabold text-slate-700">No matching records</h4>
                                                    <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                                                        We couldn't find any records matching "{searchQuery}". Try a different keyword.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {filteredRecords.map(rec => (
                                                        <div key={rec.id} className="p-4 bg-slate-50/30 hover:bg-slate-50/60 border border-slate-100 rounded-2xl hover:border-slate-200 transition-all duration-200 shadow-sm relative group/item">
                                                            <div className="flex items-start justify-between gap-2 mb-2.5">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="font-extrabold text-sm text-slate-800 truncate">{rec.title}</span>
                                                                    {rec.link && (
                                                                        <a 
                                                                            href={rec.link} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="text-brand-500 hover:text-brand-600 transition-colors p-1 rounded hover:bg-white"
                                                                            title="Visit portal link"
                                                                        >
                                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                    <button 
                                                                        onClick={() => startEdit(rec)}
                                                                        className="p-1.5 hover:bg-white text-slate-400 hover:text-brand-600 rounded-lg transition-colors border border-transparent hover:border-slate-100"
                                                                        title="Edit record"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDelete(rec.id)}
                                                                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                        title="Delete record"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Details Grid */}
                                                            <div className="space-y-2 text-xs text-slate-600">
                                                                {rec.name && (
                                                                    <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100/50">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                            <span className="font-semibold truncate text-slate-700">{rec.name}</span>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => handleCopy(rec.id, rec.name || '', 'name')}
                                                                            className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-all shrink-0 border border-transparent hover:border-slate-100"
                                                                            title="Copy username"
                                                                        >
                                                                            {copiedId?.id === rec.id && copiedId?.field === 'name' ? (
                                                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                                            ) : (
                                                                                <Copy className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {rec.text && (
                                                                    <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100/50">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                            <span className="font-mono font-semibold truncate text-slate-700">
                                                                                {visiblePasswords[rec.id] ? rec.text : '••••••••••••'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <button 
                                                                                onClick={() => togglePasswordVisibility(rec.id)}
                                                                                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-all border border-transparent hover:border-slate-100"
                                                                                title={visiblePasswords[rec.id] ? "Hide password" : "Show password"}
                                                                            >
                                                                                {visiblePasswords[rec.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleCopy(rec.id, rec.text || '', 'text')}
                                                                                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-all border border-transparent hover:border-slate-100"
                                                                                title="Copy password/notes"
                                                                            >
                                                                                {copiedId?.id === rec.id && copiedId?.field === 'text' ? (
                                                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                                                ) : (
                                                                                    <Copy className="w-3.5 h-3.5" />
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-4 border-t border-slate-50 bg-slate-50/10 flex justify-end">
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors outline-none"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
