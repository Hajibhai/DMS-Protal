import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Eye, Edit, Trash2, Download, Shield, Briefcase, 
  Phone, ShieldAlert, Calendar, Camera, User, Mail, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SafetyRecord } from '../types';

interface SafetyViewProps {
    records: SafetyRecord[];
    onSave: (data: any) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    user: any;
}

export const SafetyView = ({ records, onSave, onDelete, user }: SafetyViewProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState<any>(null);
    const [viewMode, setViewMode] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const canManageEmployees = user?.permissions?.canManageEmployees || 
                               user?.role?.toLowerCase() === 'creator' || 
                               user?.role?.toLowerCase() === 'admin' || 
                               user?.email === 'abdulkaderp3010@gmail.com';

    const filtered = records.filter((r: SafetyRecord) => 
        r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.emiratesIdNumber?.includes(searchTerm) ||
        r.certificateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.safetyCertificateNumber?.includes(searchTerm) ||
        r.employeeCompanyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.safetyProviderName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const getDaysLeft = (date: string) => {
        if (!date) return null;
        const diff = new Date(date).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // Stats calculations
    const stats = React.useMemo(() => {
        let active = 0;
        let expired = 0;
        let expiring15 = 0;
        let expiring30 = 0;

        records.forEach(r => {
            const days = getDaysLeft(r.certificateExpireDate);
            if (days !== null) {
                if (days < 0) {
                    expired++;
                } else {
                    active++;
                    if (days <= 15) {
                        expiring15++;
                    } else if (days <= 30) {
                        expiring30++;
                    }
                }
            } else {
                active++; // general active if no date set yet
            }
        });

        return { active, expired, expiring15, expiring30 };
    }, [records]);

    const handleExport = () => {
        setIsExporting(true);
        const data = filtered.map((r: SafetyRecord, idx: number) => {
            const daysLeft = getDaysLeft(r.certificateExpireDate);
            return {
                'Sl. No.': idx + 1,
                'Employee Name': r.employeeName,
                'Emirates ID Number': r.emiratesIdNumber,
                'Employee Company Name': r.employeeCompanyName,
                'Certificate Name': r.certificateName,
                'Certificate Number': r.safetyCertificateNumber,
                'Training Provider Name': r.safetyProviderName,
                'Trainer Contact/Email': r.safetyProviderContact,
                'Issue Date': r.certificateIssueDate,
                'Expiry Date': r.certificateExpireDate,
                'Days Remaining': daysLeft !== null ? (daysLeft < 0 ? 'Expired' : `${daysLeft} Days`) : '-'
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Safety Certificates");
        XLSX.writeFile(wb, `Safety_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
        setIsExporting(false);
    };

    return (
        <div className="p-8 space-y-8 min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Safety Management</h1>
                    <p className="text-slate-500 font-medium">Manage and track employee safety training certifications.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" /> 
                        {isExporting ? 'Exporting...' : 'Sync to Google Sheet'}
                    </button>
                    <button 
                        onClick={() => {
                            setViewMode(false);
                            setShowModal({
                                id: '',
                                employeeImage: '',
                                employeeName: '',
                                emiratesIdNumber: '',
                                safetyProviderName: '',
                                safetyProviderContact: '',
                                certificateName: '',
                                safetyCertificateNumber: '',
                                certificateIssueDate: '',
                                certificateExpireDate: '',
                                employeeCompanyName: ''
                            });
                        }}
                        className="px-8 py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm shadow-xl shadow-emerald-200 hover:scale-105 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> New Safety Certificate
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label="Active Credentials" 
                    value={stats.active} 
                    icon={ShieldCheck} 
                    color="emerald" 
                    delay={0.1} 
                />
                <StatCard 
                    label="Expired Certs" 
                    value={stats.expired} 
                    icon={ShieldAlert} 
                    color="rose" 
                    delay={0.2} 
                />
                <StatCard 
                    label="Critical Expiry (≤15d)" 
                    value={stats.expiring15} 
                    icon={ShieldAlert} 
                    color="orange" 
                    delay={0.3} 
                />
                <StatCard 
                    label="Upcoming Expiry (≤30d)" 
                    value={stats.expiring30} 
                    icon={Calendar} 
                    color="violet" 
                    delay={0.4} 
                />
            </div>

            {/* Main Content Area */}
            <div className="glass-card rounded-3xl border border-white shadow-2xl shadow-slate-200/50 overflow-hidden bg-white">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search by Employee, ID, Provider, Company, Certificate..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Photo</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee & Company</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Emirates ID</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Certificate & No.</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Training Provider</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry Date</th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((r: SafetyRecord) => {
                                const daysLeft = getDaysLeft(r.certificateExpireDate);
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-100 flex items-center justify-center">
                                                {r.employeeImage ? (
                                                    <img src={r.employeeImage} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-5 h-5 text-slate-300" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-900">{r.employeeName || '-'}</div>
                                            <div className="text-xs font-semibold text-slate-500 mt-0.5">{r.employeeCompanyName || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-black text-slate-700">{r.emiratesIdNumber || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-900">{r.certificateName || '-'}</div>
                                            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Cert: {r.safetyCertificateNumber || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-slate-800">{r.safetyProviderName || '-'}</div>
                                            <div className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                                                <span>{r.safetyProviderContact || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {r.certificateExpireDate ? (
                                                <div className="space-y-1">
                                                    <div className="text-sm font-bold text-slate-700">{new Date(r.certificateExpireDate).toLocaleDateString('en-GB')}</div>
                                                    <div className={`text-[10px] font-black uppercase tracking-widest ${
                                                        daysLeft !== null && daysLeft < 0 ? "text-rose-500" :
                                                        daysLeft !== null && daysLeft < 15 ? "text-orange-500" :
                                                        "text-emerald-500"
                                                    }`}>
                                                        {daysLeft !== null ? (daysLeft < 0 ? 'Expired' : `${daysLeft} Days Left`) : '-'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-slate-300 font-medium italic text-sm">Not set</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => {
                                                        setViewMode(true);
                                                        setShowModal(r);
                                                    }}
                                                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {canManageEmployees && (
                                                    <>
                                                        <button 
                                                            onClick={() => {
                                                                 setViewMode(false);
                                                                 setShowModal(r);
                                                            }}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                            title="Edit Record"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                await onDelete(r.id);
                                                            }}
                                                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                            title="Delete Record"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center">
                                                <Shield className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-slate-900 font-black">No Records Found</p>
                                                <p className="text-slate-500 text-sm font-medium">Try adjusting your search or add a new certificate.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Add / Edit / View */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl border border-white overflow-hidden max-h-[90vh] flex flex-col relative z-10"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-slate-150 flex items-center justify-between bg-white relative">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {viewMode ? 'Certificate Details' : (showModal.id ? 'Edit Safety Credentials' : 'New Safety Certificate')}
                                    </h2>
                                    <p className="text-xs font-semibold text-slate-500">
                                        {viewMode ? 'Examine training certificate details.' : 'Compile certifications with valid attachments/dates.'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowModal(null)}
                                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all"
                                >
                                    <Trash2 className="w-4 h-4 rotate-45" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form 
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    await onSave(showModal);
                                    setShowModal(null);
                                }}
                                className="flex-1 overflow-y-auto p-8"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Column Left (Image Upload / Status) */}
                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee Photo</label>
                                            <div className="relative group">
                                                <div className="aspect-square bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
                                                    {showModal.employeeImage ? (
                                                        <img src={showModal.employeeImage} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Plus className="w-10 h-10 text-slate-200 transition-colors" />
                                                    )}
                                                </div>
                                                {!viewMode && (
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => setShowModal({ ...showModal, employeeImage: reader.result as string });
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column Middle & Right (Fields) */}
                                    <div className="md:col-span-2 space-y-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField 
                                                label="Employee Name" 
                                                value={showModal.employeeName} 
                                                onChange={(v) => setShowModal({ ...showModal, employeeName: v })} 
                                                placeholder="Full Name" 
                                                required 
                                                readOnly={viewMode} 
                                            />
                                            <FormField 
                                                label="Emirates ID" 
                                                value={showModal.emiratesIdNumber} 
                                                onChange={(v) => setShowModal({ ...showModal, emiratesIdNumber: v })} 
                                                placeholder="784-XXXX-XXXXXXX-X" 
                                                required 
                                                readOnly={viewMode} 
                                            />
                                            <FormField 
                                                label="Employee Company Name" 
                                                value={showModal.employeeCompanyName} 
                                                onChange={(v) => setShowModal({ ...showModal, employeeCompanyName: v })} 
                                                placeholder="e.g. Pioneer Contracting" 
                                                required 
                                                readOnly={viewMode} 
                                            />
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        {/* Certificate Block */}
                                        <div className="space-y-6">
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-emerald-600" /> Certificate Details
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField 
                                                    label="Certificate Name" 
                                                    value={showModal.certificateName} 
                                                    onChange={(v) => setShowModal({ ...showModal, certificateName: v })} 
                                                    placeholder="e.g., Working at Heights" 
                                                    required 
                                                    readOnly={viewMode} 
                                                />
                                                <FormField 
                                                    label="Safety Certificate Number" 
                                                    value={showModal.safetyCertificateNumber} 
                                                    onChange={(v) => setShowModal({ ...showModal, safetyCertificateNumber: v })} 
                                                    placeholder="Cert No." 
                                                    required 
                                                    readOnly={viewMode} 
                                                />
                                                <FormField 
                                                    label="Certificate Issue Date" 
                                                    value={showModal.certificateIssueDate} 
                                                    onChange={(v) => setShowModal({ ...showModal, certificateIssueDate: v })} 
                                                    type="date" 
                                                    required 
                                                    readOnly={viewMode} 
                                                />
                                                <FormField 
                                                    label="Certificate Expiry Date" 
                                                    value={showModal.certificateExpireDate} 
                                                    onChange={(v) => setShowModal({ ...showModal, certificateExpireDate: v })} 
                                                    type="date" 
                                                    required 
                                                    readOnly={viewMode} 
                                                />
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        {/* Provider Block */}
                                        <div className="space-y-6">
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                                <Briefcase className="w-4 h-4 text-emerald-600" /> Training Provider Information
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField 
                                                    label="Safety Training Provider Name" 
                                                    value={showModal.safetyProviderName} 
                                                    onChange={(v) => setShowModal({ ...showModal, safetyProviderName: v })} 
                                                    placeholder="Training Center name" 
                                                    required 
                                                    readOnly={viewMode} 
                                                />
                                                <FormField 
                                                    label="Provider Contact / Email" 
                                                    value={showModal.safetyProviderContact} 
                                                    onChange={(v) => setShowModal({ ...showModal, safetyProviderContact: v })} 
                                                    placeholder="Phone / email ID" 
                                                    required 
                                                    readOnly={viewMode} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions in footer */}
                                <div className="mt-12 flex justify-end gap-3 sticky bottom-0 bg-slate-50 p-6 -mx-10 border-t border-slate-200">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowModal(null)} 
                                        className="px-8 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                    >
                                        {viewMode ? 'Close' : 'Cancel'}
                                    </button>
                                    {!viewMode && (
                                        <button 
                                            type="submit" 
                                            className="px-10 py-4 bg-emerald-600 text-white rounded-3xl text-sm font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all"
                                        >
                                            {showModal.id ? 'Save Changes' : 'Submit Credential'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FormField = ({ label, value, onChange, placeholder, type = 'text', required = false, readOnly = false }: any) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            {label} {required && !readOnly && <span className="text-rose-500">*</span>}
        </label>
        {readOnly ? (
            <div className="w-full px-5 py-4 bg-white/50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700">
                {type === 'date' && value ? new Date(value).toLocaleDateString('en-GB') : (value || '-')}
            </div>
        ) : (
            <input 
                type={type}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm placeholder:text-slate-300 placeholder:font-medium transition-all"
            />
        )}
    </div>
);

const StatCard = ({ label, value, icon: Icon, color, delay }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="glass-card p-6 rounded-3xl border border-white shadow-xl shadow-slate-200/40 group bg-white hover:scale-[1.02] transition-all"
    >
        <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 ${
                color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                color === 'rose' ? 'bg-rose-50 text-rose-600' :
                color === 'orange' ? 'bg-orange-50 text-orange-600' :
                'bg-violet-50 text-violet-600'
            }`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
                <div className="text-xl font-black text-slate-900">{value}</div>
            </div>
        </div>
    </motion.div>
);
