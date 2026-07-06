import React, { useState } from 'react';
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
    Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyRecordsManagerProps {
    company: Company;
    onUpdate: (updatedCompany: Company) => void | Promise<void>;
}

export const CompanyRecordsManager = ({ company, onUpdate }: CompanyRecordsManagerProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
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

    const records = company.records || [];

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
        <div className="mt-3 border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all duration-300">
            {/* Header / Accordion trigger */}
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3.5 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between transition-colors outline-none"
            >
                <div className="flex items-center gap-2.5 text-slate-700">
                    <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
                        <Key className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Portal Credentials</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-1">
                            {records.length === 0 ? 'No records configured' : `${records.length} portal record${records.length > 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </button>

            {/* Expanded Body */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 border-t border-slate-50 bg-slate-50/10 space-y-4">
                            
                            {/* Records List */}
                            {records.length > 0 && !isAdding && !editingRecordId && (
                                <div className="space-y-3">
                                    {records.map(rec => (
                                        <div key={rec.id} className="p-3 bg-white border border-slate-100/80 rounded-xl hover:border-slate-200 transition-all shadow-sm">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="font-extrabold text-sm text-slate-800 truncate">{rec.title}</span>
                                                    {rec.link && (
                                                        <a 
                                                            href={rec.link} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-brand-500 hover:text-brand-600 transition-colors p-1 rounded hover:bg-slate-50"
                                                            title="Visit portal link"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button 
                                                        onClick={() => startEdit(rec)}
                                                        className="p-1 hover:bg-slate-50 text-slate-400 hover:text-brand-600 rounded transition-colors"
                                                        title="Edit record"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(rec.id)}
                                                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                        title="Delete record"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="space-y-1.5 text-xs text-slate-600">
                                                {rec.name && (
                                                    <div className="flex items-center justify-between gap-2 bg-slate-50/50 px-2 py-1.5 rounded-lg border border-slate-100/50">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="font-semibold truncate text-slate-700">{rec.name}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleCopy(rec.id, rec.name || '', 'name')}
                                                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all shrink-0"
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
                                                    <div className="flex items-center justify-between gap-2 bg-slate-50/50 px-2 py-1.5 rounded-lg border border-slate-100/50">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="font-mono font-semibold truncate text-slate-700">
                                                                {visiblePasswords[rec.id] ? rec.text : '••••••••••••'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                            <button 
                                                                onClick={() => togglePasswordVisibility(rec.id)}
                                                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
                                                                title={visiblePasswords[rec.id] ? "Hide password" : "Show password"}
                                                            >
                                                                {visiblePasswords[rec.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button 
                                                                onClick={() => handleCopy(rec.id, rec.text || '', 'text')}
                                                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
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

                            {/* Add/Edit Form */}
                            {(isAdding || editingRecordId) ? (
                                <form onSubmit={handleSave} className="p-3.5 bg-white border border-brand-100 rounded-xl space-y-3.5 shadow-md shadow-brand-500/5">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                            {isAdding ? 'New Portal Record' : 'Edit Portal Record'}
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={cancelForm}
                                            className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Portal Title *</label>
                                            <input 
                                                type="text"
                                                required
                                                placeholder="e.g. ICP, Daman, FTA, MOHRE"
                                                value={title}
                                                onChange={e => setTitle(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-brand-500 transition-all text-slate-800"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Portal URL / Link</label>
                                            <div className="relative">
                                                <Globe className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                                <input 
                                                    type="text"
                                                    placeholder="e.g. icp.gov.ae"
                                                    value={link}
                                                    onChange={e => setLink(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-brand-500 transition-all text-slate-800"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Username / Email</label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                                    <input 
                                                        type="text"
                                                        placeholder="Username or email"
                                                        value={name}
                                                        onChange={e => setName(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-brand-500 transition-all text-slate-800"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password / Notes</label>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                                    <input 
                                                        type="text"
                                                        placeholder="Password or details"
                                                        value={text}
                                                        onChange={e => setText(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono font-semibold outline-none focus:ring-1 focus:ring-brand-500 transition-all text-slate-800"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                                        <button 
                                            type="button"
                                            onClick={cancelForm}
                                            className="flex-1 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            className="flex-1 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm shadow-brand-600/10 transition-colors"
                                        >
                                            Save Record
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button 
                                    onClick={startAdd}
                                    className="w-full py-2 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 text-slate-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-dashed border-slate-200 hover:border-brand-200 flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add New Record
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
