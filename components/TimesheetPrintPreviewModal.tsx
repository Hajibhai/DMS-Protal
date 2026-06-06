import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Printer, X, Layout, Check, Palette, Minimize2, Sliders, CheckSquare, 
    Square, Scale, Eye, FileText, Download, Calendar, RefreshCw, Layers, Award
} from 'lucide-react';
import { AttendanceRecord, Employee, Company, AttendanceStatus } from '../types';

// Constants replicating internal LEGEND matching App.tsx
const PRINT_LEGEND: any = {
    [AttendanceStatus.PRESENT]: { label: 'Present', code: 'P', color: 'bg-emerald-500 text-white border-transparent', printBg: '!bg-emerald-500 !text-white' },
    [AttendanceStatus.ABSENT]: { label: 'Absent', code: 'A', color: 'bg-red-500 text-white border-transparent', printBg: '!bg-red-500 !text-white' },
    [AttendanceStatus.WEEK_OFF]: { label: 'Week Off', code: 'W', color: 'bg-slate-500 text-white border-transparent', printBg: '!bg-slate-500 !text-white' },
    [AttendanceStatus.PUBLIC_HOLIDAY]: { label: 'Public Holiday', code: 'PH', color: 'bg-violet-500 text-white border-transparent', printBg: '!bg-violet-500 !text-white' },
    [AttendanceStatus.SICK_LEAVE]: { label: 'Sick Leave', code: 'SL', color: 'bg-orange-500 text-white border-transparent', printBg: '!bg-orange-500 !text-white' },
    [AttendanceStatus.ANNUAL_LEAVE]: { label: 'Annual Leave', code: 'AL', color: 'bg-brand-500 text-white border-transparent', printBg: '!bg-brand-500 !text-white' },
    [AttendanceStatus.UNPAID_LEAVE]: { label: 'Unpaid Leave', code: 'UL', color: 'bg-rose-500 text-white border-transparent', printBg: '!bg-rose-500 !text-white' },
    [AttendanceStatus.EMERGENCY_LEAVE]: { label: 'Emergency Leave', code: 'EL', color: 'bg-pink-500 text-white border-transparent', printBg: '!bg-pink-500 !text-white' },
};

interface TimesheetPrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    attendance: AttendanceRecord[];
    selectedMonth: string; // "YYYY-MM"
    companies: Company[];
    currentUser?: any;
}

export const TimesheetPrintPreviewModal: React.FC<TimesheetPrintPreviewModalProps> = ({
    isOpen,
    onClose,
    employees,
    attendance,
    selectedMonth,
    companies,
    currentUser
}) => {
    // ------------------------------------------
    // State Controls for Print Preview Formatting
    // ------------------------------------------
    const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
    const [colorMode, setColorMode] = useState<'color' | 'mono'>('color');
    const [cellDensity, setCellDensity] = useState<'compact' | 'standard' | 'relaxed'>('compact');
    const [simulatedPageScale, setSimulatedPageScale] = useState<number>(75); // Scaler for browser visual workspace

    // Visibility Toggles
    const [showAvatars, setShowAvatars] = useState<boolean>(true);
    const [showCompanyCol, setShowCompanyCol] = useState<boolean>(true);
    const [showTotalHrsCol, setShowTotalHrsCol] = useState<boolean>(true);
    const [showLegendKey, setShowLegendKey] = useState<boolean>(true);
    const [showVerificationFooter, setShowVerificationFooter] = useState<boolean>(true);
    const [showCustomNotes, setShowCustomNotes] = useState<boolean>(false);
    const [customNotesText, setCustomNotesText] = useState<string>("Note: Sundays are designated rest days. Public Holidays represent official UAE legislative closures.");

    // Date calculations
    const [year, month] = useMemo(() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        return [y || new Date().getFullYear(), m || (new Date().getMonth() + 1)];
    }, [selectedMonth]);

    const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
    const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
    
    const monthName = useMemo(() => {
        return new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    }, [year, month]);

    const fullYear = year.toString();

    // Replicate same employee filter list if desired
    const [printSearchTerm, setPrintSearchTerm] = useState<string>('');
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');

    const filteredEmployeesToPrint = useMemo(() => {
        return employees.filter((e: Employee) => {
            const matchesSearch = (e.name?.toLowerCase() || '').includes(printSearchTerm.toLowerCase()) || 
                                 (e.code?.toLowerCase() || '').includes(printSearchTerm.toLowerCase()) ||
                                 (e.department?.toLowerCase() || '').includes(printSearchTerm.toLowerCase());
            const matchesCompany = selectedCompanyFilter === 'all' || e.company === selectedCompanyFilter;
            return matchesSearch && matchesCompany;
        });
    }, [employees, printSearchTerm, selectedCompanyFilter]);

    // Handle standard print trigger on client
    const handleTriggerNativePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900 overflow-hidden no-print print:relative print:bg-white">
                
                {/* Print Style Injections Dynamic Override */}
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body {
                            background-color: white !important;
                            color: black !important;
                            font-size: 8pt !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        
                        /* Hide everything outer */
                        .no-print, .modal-controller-panel, .top-header-panel {
                            display: none !important;
                        }

                        /* Fully maximize print container */
                        .print-canvas-area {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            transform: none !important;
                            background: white !important;
                            overflow: visible !important;
                            box-shadow: none !important;
                        }

                        .paper-sheet-styled {
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0.3cm !important;
                            border: none !important;
                            border-radius: 0 !important;
                            box-shadow: none !important;
                            background: white !important;
                            page-break-after: always;
                            transform: none !important;
                        }

                        table {
                            width: 100% !important;
                            table-layout: fixed !important;
                            border-collapse: collapse !important;
                        }

                        @page {
                            size: A4 ${orientation};
                            margin: 0.4cm;
                        }
                    }
                `}} />

                {/* 1. Header Control Band */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 text-white shrink-0 no-print">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-500 text-white rounded-xl">
                            <Printer className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                                HD Monthly Timesheet Print Core
                                <span className="bg-slate-800 text-brand-400 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase">WYSWYG Preview</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Adjust margins, density, page layout bounds & signatures dynamically below</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleTriggerNativePrint}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                        >
                            <Printer className="w-4 h-4" />
                            Send to Device / Save PDF
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                            title="Close Print Preview"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. Main Workspace Grid */}
                <div className="flex flex-1 overflow-hidden no-print">
                    
                    {/* Sidebar Controls Panel */}
                    <div className="w-80 bg-slate-950 border-r border-slate-800 p-6 flex flex-col justify-between overflow-y-auto shrink-0 select-none custom-scrollbar text-slate-300">
                        <div className="space-y-6">
                            
                            {/* Layout Setup */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                                    <Layout className="w-3.5 h-3.5" />
                                    Paper Layout Options
                                </h3>
                                
                                {/* Orientation select */}
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('landscape')}
                                        className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all ${
                                            orientation === 'landscape' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Landscape
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('portrait')}
                                        className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all ${
                                            orientation === 'portrait' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Portrait
                                    </button>
                                </div>

                                {/* Ink Mode selections */}
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setColorMode('color')}
                                        className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                                            colorMode === 'color' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        <Palette className="w-3.5 h-3.5" />
                                        Full Color
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setColorMode('mono')}
                                        className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                                            colorMode === 'mono' ? 'bg-slate-800 text-slate-300' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        <Layers className="w-3.5 h-3.5" />
                                        Ink-Saver Grayscale
                                    </button>
                                </div>
                            </div>

                            {/* Spacing & Scaling Options */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                                    <Sliders className="w-3.5 h-3.5" />
                                    Grid Customisation
                                </h3>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cell Spacing Density</label>
                                    <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-900 rounded-xl border border-slate-800">
                                        {(['compact', 'standard', 'relaxed'] as const).map(den => (
                                            <button
                                                key={den}
                                                type="button"
                                                onClick={() => setCellDensity(den)}
                                                className={`py-1.5 rounded-lg text-[10px] uppercase font-black text-center transition-all ${
                                                    cellDensity === den ? 'bg-slate-850 text-brand-400 border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {den}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Slider for scale inside browser (does not affect print sizing) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>Workspace Zoom</span>
                                        <span>{simulatedPageScale}%</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="40"
                                        max="110"
                                        step="5"
                                        value={simulatedPageScale}
                                        onChange={(e) => setSimulatedPageScale(Number(e.target.value))}
                                        className="w-full accent-brand-500 cursor-pointer h-1.5 bg-slate-850 rounded-lg outline-none"
                                    />
                                    <span className="text-[9px] text-slate-500 font-semibold block leading-none">Scales the paper preview display. Does not affect physical print layout.</span>
                                </div>
                            </div>

                            {/* Section Visibility Toggles */}
                            <div className="space-y-2 border-t border-slate-800 pt-4">
                                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Include Elements</h3>
                                
                                {/* Show Avatars */}
                                <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer select-none">
                                    <span className="text-xs font-bold text-slate-300">Staff Profile Avatar</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowAvatars(!showAvatars)}
                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${showAvatars ? 'bg-brand-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showAvatars ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </label>

                                {/* Show Company Column */}
                                <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer select-none">
                                    <span className="text-xs font-bold text-slate-300">Include Company ID</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowCompanyCol(!showCompanyCol)}
                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${showCompanyCol ? 'bg-brand-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showCompanyCol ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </label>

                                {/* Show Total Hours */}
                                <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer select-none">
                                    <span className="text-xs font-bold text-slate-300">Total Hours Header</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowTotalHrsCol(!showTotalHrsCol)}
                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${showTotalHrsCol ? 'bg-brand-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showTotalHrsCol ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </label>

                                {/* Show Legend Key */}
                                <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer select-none">
                                    <span className="text-xs font-bold text-slate-300">Status Legend Translation</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowLegendKey(!showLegendKey)}
                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${showLegendKey ? 'bg-brand-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showLegendKey ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </label>

                                {/* Show Signature block */}
                                <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer select-none">
                                    <span className="text-xs font-bold text-slate-300">Official Sign-off Signatures</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowVerificationFooter(!showVerificationFooter)}
                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${showVerificationFooter ? 'bg-brand-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showVerificationFooter ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </label>
                            </div>

                            {/* Live Text notes injection */}
                            <div className="space-y-2 border-t border-slate-800 pt-4">
                                <label className="flex items-center justify-between cursor-pointer select-none mb-1">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Custom Document Notes</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomNotes(!showCustomNotes)}
                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${showCustomNotes ? 'bg-brand-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showCustomNotes ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </label>
                                {showCustomNotes && (
                                    <textarea
                                        value={customNotesText}
                                        onChange={(e) => setCustomNotesText(e.target.value)}
                                        rows={3}
                                        className="w-full text-xs p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none text-white focus:border-brand-500 placeholder:text-slate-600"
                                        placeholder="Add notes to display on bottom of printed page..."
                                    />
                                )}
                            </div>

                        </div>

                        {/* Footer details */}
                        <div className="mt-8 pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 font-medium">
                            <p>Developed with UAE Ministry guidelines for physical auditing formatting standards.</p>
                        </div>
                    </div>

                    {/* Simulation Workspace Panel */}
                    <div className="flex-1 bg-slate-900 p-8 overflow-auto flex justify-center items-start custom-scrollbar">
                        <div 
                            style={{ 
                                transform: `scale(${simulatedPageScale / 100})`, 
                                transformOrigin: 'top center',
                                width: orientation === 'landscape' ? '1120px' : '790px',
                                transition: 'transform 0.15s ease-out'
                            }}
                            className="bg-white text-slate-800 shadow-2xl rounded-sm border border-slate-200 shrink-0 select-text overflow-visible mb-20 relative paper-sheet-styled"
                            id="print-preview-root-canvas"
                        >
                            <div className="p-8 space-y-6">
                                
                                {/* A. Sheet Header (Professional Corporate Style) */}
                                <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center font-black text-sm text-white">P</div>
                                            <div>
                                                <h1 className="font-extrabold text-slate-900 text-lg uppercase tracking-wider">PIONEER DMS PORTAL</h1>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">UAE Workforce General Services Group</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 space-y-0.5 text-[10px] font-semibold text-slate-500">
                                            <p className="flex items-center gap-1.5">
                                                <span>Licence No: 708304</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                                                <span>Jurisdiction: Dubai, United Arab Emirates</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Logo stamp details and UAE flag */}
                                    <div className="text-right flex flex-col items-end">
                                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg">
                                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Timesheet ledger</span>
                                            <img src="https://flagcdn.com/w20/ae.png" alt="UAE" className="w-4 h-2.5 rounded-xs" referrerPolicy="no-referrer" />
                                        </div>
                                        <div className="mt-3 text-right text-[10px] font-medium text-slate-500">
                                            <p className="font-bold text-slate-800 uppercase">جدول الحضور والانصراف الشهري</p>
                                            <p className="mt-0.5">Period: <span className="font-bold text-slate-900">{monthName} {fullYear}</span></p>
                                            <p className="text-[9px]">Printed at: {new Date().toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* B. Top Summary Stats */}
                                <div className="grid grid-cols-4 gap-4 bg-slate-50/70 border border-slate-100 p-3 rounded-xl">
                                    <div className="text-center py-1">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Employees</span>
                                        <span className="text-base font-bold text-slate-900 mt-1 block">{filteredEmployeesToPrint.length} STAFF</span>
                                    </div>
                                    <div className="text-center py-1 border-l border-slate-200">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Month Days Range</span>
                                        <span className="text-base font-bold text-slate-900 mt-1 block">1 to {daysInMonth} DAYS</span>
                                    </div>
                                    <div className="text-center py-1 border-l border-slate-200">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Logged Attendance</span>
                                        <span className="text-base font-bold text-slate-900 mt-1 block">
                                            {attendance.filter((r) => r.date.startsWith(selectedMonth)).length} ENTRIES
                                        </span>
                                    </div>
                                    <div className="text-center py-1 border-l border-slate-200">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">UAE National Flag</span>
                                        <span className="text-xs font-bold text-emerald-600 mt-1 block uppercase">COMPLIANT</span>
                                    </div>
                                </div>

                                {/* Quick Filters on Print Preview */}
                                <div className="flex flex-wrap items-center justify-between gap-4 no-print border-b border-dashed border-slate-200 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs font-black uppercase text-slate-400 tracking-wider">Search Workspace:</div>
                                        <input 
                                            type="text" 
                                            placeholder="Exclude staff on search..." 
                                            value={printSearchTerm}
                                            onChange={(e) => setPrintSearchTerm(e.target.value)}
                                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500 w-44"
                                        />
                                        <select
                                            value={selectedCompanyFilter}
                                            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none cursor-pointer focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value="all">All Companies</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="text-xs text-slate-400 font-semibold">{filteredEmployeesToPrint.length} of {employees.length} employees included in actual page print.</div>
                                </div>

                                {/* C. Timesheet Main Live Preview Grid */}
                                <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
                                    <table className="w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-slate-700">
                                                <th className="p-1 px-2 text-left sticky left-0 bg-slate-105 border-r border-slate-300 font-extrabold uppercase text-slate-650" style={{ width: showCompanyCol ? '135px' : '100px' }}>
                                                    Employee
                                                </th>
                                                {showCompanyCol && (
                                                    <th className="p-1 border-r border-slate-300 font-extrabold uppercase text-[8px] text-center" style={{ width: '45px' }}>
                                                        Comp
                                                    </th>
                                                )}
                                                <th className="p-1 border-r border-slate-300 font-bold uppercase text-[8px] text-center" style={{ width: '25px' }}>
                                                    LV
                                                </th>
                                                <th className="p-1 border-r border-slate-300 font-bold uppercase text-[8px] text-center" style={{ width: '25px' }}>
                                                    OT
                                                </th>
                                                
                                                {/* Daily days numbers */}
                                                {days.map(d => {
                                                    const date = new Date(year, month - 1, d);
                                                    const isSunday = date.getDay() === 0;
                                                    return (
                                                        <th 
                                                            key={d} 
                                                            className={`p-1 border-r border-slate-300 text-[8px] font-bold min-w-[14px] ${isSunday ? 'bg-red-50 text-red-600 font-black' : ''}`}
                                                        >
                                                            {d}
                                                        </th>
                                                    );
                                                })}
                                                
                                                <th className="p-1 font-bold text-slate-900 border-l border-slate-300 text-[8px]" style={{ width: '40px' }}>
                                                    Totals
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEmployeesToPrint.map((e: Employee, idx: number) => {
                                                const empMonthRecs = attendance.filter(r => r.employeeId === e.id && r.date.startsWith(selectedMonth));
                                                return (
                                                    <tr key={e.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                                                        
                                                        {/* Name Cell */}
                                                        <td className="p-1 px-2 text-left border-r border-slate-300 font-bold text-slate-900 sticky left-0 bg-white" style={{ width: showCompanyCol ? '135px' : '100px' }}>
                                                            <div className="flex items-center gap-1">
                                                                {showAvatars && (
                                                                    <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] font-bold border border-slate-200 shrink-0 overflow-hidden">
                                                                        {e.profileImage ? (
                                                                            <img src={e.profileImage} alt={e.name} className="w-full h-full object-cover animate-none" referrerPolicy="no-referrer" />
                                                                        ) : (
                                                                            e.name.charAt(0)
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <span className="text-[9px] truncate max-w-[95px]" title={e.name}>{e.name}</span>
                                                            </div>
                                                        </td>

                                                        {/* Company */}
                                                        {showCompanyCol && (
                                                            <td className="p-1 border-r border-slate-300 text-[8px] text-center text-slate-500 font-bold uppercase truncate" style={{ width: '45px' }}>
                                                                {companies.find(c => c.name === e.company)?.code || e.company?.substring(0, 5)}
                                                            </td>
                                                        )}

                                                        {/* Leaves */}
                                                        <td className="p-1 border-r border-slate-300 font-extrabold text-[8px] text-center text-slate-500">
                                                            {e.leaveBalance || 0}
                                                        </td>

                                                        {/* Overtime count */}
                                                        <td className="p-1 border-r border-slate-200 font-bold text-[8px] text-center text-brand-600">
                                                            {empMonthRecs.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)}h
                                                        </td>

                                                        {/* Daily list */}
                                                        {days.map(d => {
                                                            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                                                            const record = attendance.find((r: AttendanceRecord) => r.employeeId === e.id && r.date === dateStr);
                                                            const hasOT = record && record.hoursWorked > 0 && record.hoursWorked !== 8;
                                                            
                                                            const targetStatus = record?.status;
                                                            const statusMeta = targetStatus ? (PRINT_LEGEND[targetStatus] || { code: 'P', color: 'bg-emerald-500 text-white', label: 'Present' }) : null;
                                                            const isSunday = new Date(year, month - 1, d).getDay() === 0;

                                                            // Handle custom coloring vs grayscale ink saver mode
                                                            let cellColorClass = "text-slate-200";
                                                            let badgeStyle = "text-[8px] font-black leading-none";

                                                            if (statusMeta) {
                                                                if (colorMode === 'color') {
                                                                    cellColorClass = statusMeta.printBg || "!bg-slate-300";
                                                                } else {
                                                                    cellColorClass = "!bg-slate-100 !text-slate-900 border border-slate-300";
                                                                }
                                                            } else if (isSunday) {
                                                                cellColorClass = "text-red-400 bg-red-50/10";
                                                            } else {
                                                                cellColorClass = "text-slate-300 bg-transparent";
                                                            }

                                                            return (
                                                                <td 
                                                                    key={d} 
                                                                    className={`p-0.5 border-r border-slate-200/60 transition-all font-semibold relative text-center align-middle hover:bg-slate-50`}
                                                                    style={{ minWidth: '14px', padding: cellDensity === 'compact' ? '1px' : cellDensity === 'standard' ? '3px' : '5px' }}
                                                                >
                                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                                        <span className={`w-4.5 h-4.5 rounded-xs flex items-center justify-center ${cellColorClass} text-[7.5px] font-black`}>
                                                                            {statusMeta ? statusMeta.code : (isSunday ? 'W' : '-')}
                                                                        </span>
                                                                        {hasOT && showTotalHrsCol && (
                                                                            <span className="text-[6.5px] block leading-none font-bold bg-slate-900 text-white px-0.5 rounded-xs mt-0.5 transform scale-90">{record.hoursWorked}h</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}

                                                        {/* Row Totals */}
                                                        <td className="p-1 border-l border-slate-300 font-extrabold text-[8px] text-center text-slate-800">
                                                            {(() => {
                                                                const present = empMonthRecs.filter(r => r.status === AttendanceStatus.PRESENT).length;
                                                                const absent = empMonthRecs.filter(r => r.status === AttendanceStatus.ABSENT).length;
                                                                return `${present}P / ${absent}A`;
                                                            })()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Custom notes text if toggled */}
                                {showCustomNotes && (
                                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-[10px] font-semibold italic">
                                        {customNotesText}
                                    </div>
                                )}

                                {/* D. Print Translated Legend Keys */}
                                {showLegendKey && (
                                    <div className="border border-slate-100 p-3 bg-slate-50/60 rounded-xl space-y-1.5 break-inside-avoid">
                                        <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Attendance Codes Translation Guide (دليل الرموز)</h4>
                                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                            {Object.entries(PRINT_LEGEND).map(([status, meta]: any) => (
                                                <div key={status} className="flex items-center gap-1.5 p-1 bg-white border border-slate-100 rounded-lg">
                                                    <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-black border ${
                                                        colorMode === 'color' ? meta.color : "bg-slate-100 text-slate-900 border-slate-300"
                                                    }`}>
                                                        {meta.code}
                                                    </span>
                                                    <span className="text-[8.5px] font-extrabold text-slate-600 uppercase tracking-tight">{status.replace(' Leave', '')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* E. Signatures sign-off Verification Footer (UAE Legislative Standard) */}
                                {showVerificationFooter && (
                                    <div className="grid grid-cols-4 gap-4 border-t border-slate-300 pt-8 mt-12 break-inside-avoid select-none text-slate-850">
                                        <div className="text-center space-y-8">
                                            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block">Prepared by (Accountant)</span>
                                            <div className="h-6 border-b border-dashed border-slate-300 mx-auto w-32" />
                                            <p className="text-[9px] font-bold text-slate-600 uppercase">إعداد المحاسب</p>
                                        </div>
                                        <div className="text-center space-y-8">
                                            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block">Audited by (Supervisor)</span>
                                            <div className="h-6 border-b border-dashed border-slate-300 mx-auto w-32" />
                                            <p className="text-[9px] font-bold text-slate-600 uppercase">تدقيق المشرف</p>
                                        </div>
                                        <div className="text-center space-y-8">
                                            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block">Authorized by (Manager)</span>
                                            <div className="h-6 border-b border-dashed border-slate-300 mx-auto w-32" />
                                            <p className="text-[9px] font-bold text-slate-600 uppercase">اعتماد المدير</p>
                                        </div>
                                        <div className="text-center space-y-8">
                                            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block">Corporate Stamp & Sign</span>
                                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-brand-250/20 flex items-center justify-center text-[7px] font-black text-slate-300 mx-auto uppercase tracking-tighter">PLACE STAMP HERE</div>
                                            <p className="text-[9px] font-bold text-slate-600 uppercase">ختم الشركة</p>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </AnimatePresence>
    );
};
