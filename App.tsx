
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { cn } from './utils';

const DirhamIcon = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-center font-black text-[10px] leading-none tracking-tighter", className)}>
    AED
  </div>
);

import { 
  Users, Calendar, UserPlus, LogOut, ArrowRight,
  Building2, CheckCircle, XCircle, Trash2, 
  AlertCircle, Eye, Edit, CheckSquare, 
  Copy, FileText, CreditCard,
  BarChart3, UserMinus, Wallet, Plane, X, Save, Plus,
  ChevronLeft, ChevronRight,
  Settings, Search, Bell, LogOut as SignOut, UserCog,
  Briefcase, HardHat, ShieldCheck, Download, Printer,
  MoreVertical, Check, X as CloseIcon, Filter, Shield, Key, GripVertical,
  Activity, LayoutGrid, ListFilter, ChevronDown, Globe, HelpCircle,
  TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight, BarChart2, Phone,
  ShieldAlert, Truck, StickyNote, Camera, Scale, Landmark, RefreshCw, Calculator
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, loginWithGoogle, loginWithEmail, registerWithEmail, logout, resetPassword, adminCreateUser, adminDeleteUser } from './firebase';
import { Login } from './components/Login';
import { 
  Employee, AttendanceRecord, AttendanceStatus, StaffType, 
  LeaveRequest, LeaveStatus, OffboardingDetails, 
  SystemUser, DeductionRecord, UserRole, SalaryStructure, Company, Supplier, Project, 
  Vendor, AccountsPayable, AccountsReceivable, PettyCash,
  ProjectedExpense,
  EverydayExpense,
  AuditLog
} from './types';
import { 
  saveEmployee, deleteEmployee, offboardEmployee, rehireEmployee,
  logAttendance, deleteAttendanceRecord,
  saveLeaveRequest, updateLeaveRequestStatus, deleteLeaveRequest, updateLeaveRequest,
  saveDeduction, deleteDeduction,
  saveSystemUser, deleteSystemUser,
  addCompany, updateCompany, deleteCompany, reorderCompanies,
  addSupplier, updateSupplier, deleteSupplier, reorderSuppliers,
  addProject, updateProject, deleteProject, reorderProjects,
  addVendor, updateVendor, deleteVendor,
  saveAccountsPayable, deleteAccountsPayable,
  saveAccountsReceivable, deleteAccountsReceivable,
  savePettyCash, deletePettyCash,
  saveProjectedExpense, deleteProjectedExpense,
  saveEverydayExpense, deleteEverydayExpense,
  testConnection, logAudit, updateAuditLog, deleteAuditLog, clearAuditLogs, handleFirestoreError, OperationType
} from './services/storageService';
import { DEFAULT_ABOUT_DATA, CREATOR_USER } from './constants';
import SmartCommand from './components/SmartCommand';
import { Layout } from './components/Layout';
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { 
  VendorView, AccountsPayableView, AccountsReceivableView, PettyCashView, ProjectedExpenseView, EverydayExpenseView,
  VendorModal, AccountsPayableModal, AccountsReceivableModal, PettyCashModal, ProjectedExpenseModal, EverydayExpenseModal
} from './components/FinanceViews';

// --- Constants & Helpers ---
const LEGEND: any = {
    [AttendanceStatus.PRESENT]: { label: 'Present', color: 'bg-emerald-500 text-white', code: 'P' },
    [AttendanceStatus.ABSENT]: { label: 'Absent', color: 'bg-red-500 text-white', code: 'A' },
    [AttendanceStatus.WEEK_OFF]: { label: 'Week Off', color: 'bg-slate-500 text-white', code: 'W' },
    [AttendanceStatus.PUBLIC_HOLIDAY]: { label: 'Public Holiday', color: 'bg-violet-500 text-white', code: 'PH' },
    [AttendanceStatus.SICK_LEAVE]: { label: 'Sick Leave', color: 'bg-orange-500 text-white', code: 'SL' },
    [AttendanceStatus.ANNUAL_LEAVE]: { label: 'Annual Leave', color: 'bg-brand-500 text-white', code: 'AL' },
    [AttendanceStatus.UNPAID_LEAVE]: { label: 'Unpaid Leave', color: 'bg-rose-500 text-white', code: 'UL' },
    [AttendanceStatus.EMERGENCY_LEAVE]: { label: 'Emergency Leave', color: 'bg-pink-500 text-white', code: 'EL' },
};

const calculatePayroll = (employee: Employee, attendance: AttendanceRecord[], deductions: DeductionRecord[]) => {
    const isFixedSalary = employee.team === 'Office Staff' || employee.team === 'Internal Team';
    
    // Fixed Salary Logic (Office Staff / Internal Team)
    const { basic = 0, housing = 0, transport = 0, other = 0, airTicket = 0, leaveSalary = 0, hourlyRate = 0 } = employee.salary;
    const fixedGrossSalary = basic + housing + transport + other + airTicket + leaveSalary;
    
    let grossSalary = fixedGrossSalary;
    let lopDeduction = 0;
    let totalUnpaidDays = 0;

    if (isFixedSalary) {
        // Unpaid logic for fixed salary
        const absentDays = attendance.filter(r => r.status === AttendanceStatus.ABSENT).length;
        const unpaidLeaves = attendance.filter(r => [AttendanceStatus.UNPAID_LEAVE, AttendanceStatus.ANNUAL_LEAVE, AttendanceStatus.EMERGENCY_LEAVE].includes(r.status)).length;
        totalUnpaidDays = absentDays + unpaidLeaves;
        const perDayRate = fixedGrossSalary / 30;
        lopDeduction = totalUnpaidDays * perDayRate;
    } else {
        // Hourly Logic (Other Staff)
        const totalHoursWorked = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
        grossSalary = totalHoursWorked * hourlyRate;
        lopDeduction = 0; // No LOP for hourly staff
        totalUnpaidDays = 0;
    }

    const otherDeductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
    
    // OT
    const totalOtHours = attendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
    const otRatePerHour = isFixedSalary ? (fixedGrossSalary / 30 / 8) * 1.5 : hourlyRate * 1.5; 
    const otAmount = totalOtHours * otRatePerHour;

    return {
        grossSalary,
        totalUnpaidDays,
        lopDeduction,
        otAmount,
        totalDeductions: lopDeduction + otherDeductionsTotal,
        netSalary: grossSalary + otAmount - (lopDeduction + otherDeductionsTotal),
        breakdown: employee.salary
    };
};

// --- Modals ---

const CopyAttendanceModal = ({ isOpen, onClose, onCopy, currentMonth }: any) => {
    const [sourceDate, setSourceDate] = useState('');
    const [targetStartDate, setTargetStartDate] = useState('');
    const [targetEndDate, setTargetEndDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        if (!sourceDate || !targetStartDate || !targetEndDate) {
            alert("Please fill in all dates.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onCopy(sourceDate, targetStartDate, targetEndDate);
            onClose();
        } catch (error) {
            console.error("Copy error:", error);
        } finally {
            setIsSubmitting(false);
        }
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
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Copy Attendance</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Replicate attendance patterns across dates</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm hover:shadow-md"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Source Date (Copy From)</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="date" 
                                value={sourceDate}
                                onChange={(e) => setSourceDate(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={targetStartDate}
                                    onChange={(e) => setTargetStartDate(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Target End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={targetEndDate}
                                    onChange={(e) => setTargetEndDate(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                            This will overwrite any existing attendance records in the target date range. This action cannot be undone.
                        </p>
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={isSubmitting}
                        onClick={handleCopy} 
                        className="px-8 py-3 bg-brand-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-brand-600/20 hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Copying...
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Start Copying
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const KeyboardShortcutsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Alt + B', description: 'Onboard New Employee' },
    { key: 'Alt + E', description: 'Edit Selected Employee' },
    { key: 'Alt + O', description: 'Offboard Selected Employee' },
    { key: 'Alt + D', description: 'Delete Selected Employee' },
    { key: 'Alt + C', description: 'Confirm Action (in popup)' },
    { key: 'Alt + R', description: 'Return/Cancel (in popup)' },
    { key: 'Alt + P', description: 'Mark Attendance as Present' },
    { key: 'Alt + A', description: 'Mark Attendance as Absent' },
    { key: 'Alt + W', description: 'Mark Attendance as Week Off' },
    { key: 'Alt + S', description: 'Mark Attendance as Sick Leave' },
    { key: 'Alt + L', description: 'Mark Attendance as Annual Leave' },
    { key: 'Alt + U', description: 'Mark Attendance as Unpaid Leave' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Keyboard Shortcuts</h3>
            <p className="text-slate-500 text-sm font-medium">Boost your productivity with Pioneer DMS</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 gap-4">
            {shortcuts.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-sm font-bold text-slate-700">{s.description}</span>
                <kbd className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-black text-brand-600">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pioneer DMS v2.5 Productivity Tools</p>
        </div>
      </motion.div>
    </div>
  );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, type = 'danger' }: any) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Confirmation error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [onConfirm, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleConfirm();
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 border border-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-full ${type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 mb-8">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            disabled={isSubmitting}
            onClick={onClose} 
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={isSubmitting}
            onClick={handleConfirm} 
            className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'} disabled:opacity-50 transition-colors`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FinalSettlementDocument = ({ employee, details }: { employee: Employee, details: OffboardingDetails }) => {
    return (
        <div className="p-10 bg-white text-black font-serif max-w-[210mm] mx-auto">
            <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-widest">Final Settlement</h1>
                    <p className="text-sm mt-1 text-gray-600">Employee Exit Clearance & Financial Statement</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">{employee.company}</p>
                    <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="space-y-2">
                    <h2 className="font-bold border-b pb-1 mb-2 uppercase text-xs text-gray-500">Employee Information</h2>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Name:</span> {employee.name}</p>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Employee ID:</span> {employee.code}</p>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Designation:</span> {employee.designation}</p>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Department:</span> {employee.department}</p>
                </div>
                <div className="space-y-2">
                    <h2 className="font-bold border-b pb-1 mb-2 uppercase text-xs text-gray-500">Exit Details</h2>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Exit Type:</span> {details.type}</p>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Joining Date:</span> {employee.joiningDate}</p>
                    <p className="text-sm"><span className="font-semibold w-32 inline-block">Last Working Day:</span> {details.exitDate}</p>
                </div>
            </div>

            <div className="mb-10">
                <h2 className="font-bold border-b pb-1 mb-4 uppercase text-xs text-gray-500">Financial Statement</h2>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="border p-2 text-left text-sm">Description</th>
                            <th className="border p-2 text-right w-32 text-sm">Earnings (AED)</th>
                            <th className="border p-2 text-right w-32 text-sm">Deductions (AED)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border p-2 text-sm">Gratuity Settlement</td>
                            <td className="border p-2 text-right text-sm">{details.gratuity.toLocaleString()}</td>
                            <td className="border p-2 text-right text-sm">-</td>
                        </tr>
                        <tr>
                            <td className="border p-2 text-sm">Leave Encashment</td>
                            <td className="border p-2 text-right text-sm">{details.leaveEncashment.toLocaleString()}</td>
                            <td className="border p-2 text-right text-sm">-</td>
                        </tr>
                        <tr>
                            <td className="border p-2 text-sm">Pending Salary / Dues</td>
                            <td className="border p-2 text-right text-sm">{details.salaryDues.toLocaleString()}</td>
                            <td className="border p-2 text-right text-sm">-</td>
                        </tr>
                        {details.otherDues > 0 && (
                            <tr>
                                <td className="border p-2 text-sm">Other Earnings</td>
                                <td className="border p-2 text-right text-sm">{details.otherDues.toLocaleString()}</td>
                                <td className="border p-2 text-right text-sm">-</td>
                            </tr>
                        )}
                        <tr>
                            <td className="border p-2 text-sm">Total Deductions</td>
                            <td className="border p-2 text-right text-sm">-</td>
                            <td className="border p-2 text-right text-sm">{details.deductions.toLocaleString()}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-gray-100">
                            <td className="border p-2 text-right text-sm">Net Payable Amount</td>
                            <td colSpan={2} className="border p-2 text-right text-xl">AED {details.netSettlement.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mb-10">
                <h2 className="font-bold border-b pb-1 mb-2 uppercase text-xs text-gray-500">Clearance Confirmation</h2>
                <p className="text-sm italic">
                    {details.assetsReturned 
                        ? "All company assets (Laptop, SIM, Uniform, Tools) have been returned in good condition." 
                        : "Company assets return status: Pending/Not Applicable."}
                </p>
                {details.notes && (
                    <div className="mt-4 p-3 bg-gray-50 border rounded text-sm">
                        <p className="font-bold mb-1">Remarks:</p>
                        <p>{details.notes}</p>
                    </div>
                )}
            </div>

            <div className="mt-20 grid grid-cols-2 gap-20">
                <div className="text-center">
                    <div className="border-t border-black pt-2">
                        <p className="font-bold text-sm">{employee.name}</p>
                        <p className="text-[10px] text-gray-500">Employee Signature & Date</p>
                    </div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black pt-2">
                        <p className="font-bold text-sm">For {employee.company}</p>
                        <p className="text-[10px] text-gray-500">Authorized Signatory & Stamp</p>
                    </div>
                </div>
            </div>

            <div className="mt-12 text-[10px] text-gray-400 text-center">
                <p>This is a computer-generated document. No signature is required unless printed for physical records.</p>
            </div>
        </div>
    );
};

const OffboardingWizard = ({ employee, onComplete, onCancel }: { employee: Employee, onComplete: (data: OffboardingDetails) => void, onCancel: () => void }) => {
    const [step, setStep] = useState(1);
    const [details, setDetails] = useState<OffboardingDetails>({
        type: 'Resignation', exitDate: new Date().toISOString().split('T')[0], reason: '',
        gratuity: 0, leaveEncashment: 0, salaryDues: 0, otherDues: 0, deductions: 0,
        netSettlement: 0, assetsReturned: false, notes: '', settlementLink: ''
    });

    const calculateSettlement = () => {
         const net = (details.gratuity + details.leaveEncashment + details.salaryDues + details.otherDues) - details.deductions;
         setDetails(prev => ({ ...prev, netSettlement: net }));
    };

    useEffect(() => { calculateSettlement(); }, [details.gratuity, details.leaveEncashment, details.salaryDues, details.otherDues, details.deductions]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const content = document.getElementById('settlement-document-print');
        if (!content) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Final Settlement - ${employee.name}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            body { padding: 0; margin: 0; }
                            .no-print { display: none; }
                        }
                        body { font-family: 'Georgia', serif; }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-transparent">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Offboard: {employee.name}</h2>
                         <div className="flex gap-2 mt-2">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? 'bg-red-600' : 'bg-gray-200'}`} />
                            ))}
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1">
                    {step === 1 && (
                         <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                             <h3 className="text-lg font-semibold text-gray-800">Exit Details</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-gray-700">Exit Type</label>
                                     <select className="w-full p-3 border rounded-xl bg-white text-gray-900" value={details.type} onChange={e => setDetails({...details, type: e.target.value as any})}>
                                         <option>Resignation</option><option>Termination</option><option>End of Contract</option><option>Absconding</option>
                                     </select>
                                 </div>
                                 <div className="space-y-2">
                                     <label className="text-sm font-medium text-gray-700">Last Working Day</label>
                                     <input type="date" className="w-full p-3 border rounded-xl bg-white text-gray-900" value={details.exitDate} onChange={e => setDetails({...details, exitDate: e.target.value})} />
                                 </div>
                                 <div className="col-span-2 space-y-2">
                                     <label className="text-sm font-medium text-gray-700">Reason</label>
                                     <textarea className="w-full p-3 border rounded-xl bg-white text-gray-900" rows={3} value={details.reason} onChange={e => setDetails({...details, reason: e.target.value})} />
                                 </div>
                             </div>
                         </div>
                    )}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                             <h3 className="text-lg font-semibold text-gray-800">Financial Settlement</h3>
                             <div className="grid grid-cols-2 gap-5">
                                 <div className="space-y-2"><label className="text-sm">Gratuity</label><input type="number" className="w-full p-3 border rounded-xl bg-white text-gray-900" value={details.gratuity} onChange={e => setDetails({...details, gratuity: parseFloat(e.target.value) || 0})} /></div>
                                 <div className="space-y-2"><label className="text-sm">Leave Encashment</label><input type="number" className="w-full p-3 border rounded-xl bg-white text-gray-900" value={details.leaveEncashment} onChange={e => setDetails({...details, leaveEncashment: parseFloat(e.target.value) || 0})} /></div>
                                 <div className="space-y-2"><label className="text-sm">Pending Salary</label><input type="number" className="w-full p-3 border rounded-xl bg-white text-gray-900" value={details.salaryDues} onChange={e => setDetails({...details, salaryDues: parseFloat(e.target.value) || 0})} /></div>
                                 <div className="space-y-2"><label className="text-sm">Deductions</label><input type="number" className="w-full p-3 border rounded-xl bg-white text-red-600" value={details.deductions} onChange={e => setDetails({...details, deductions: parseFloat(e.target.value) || 0})} /></div>
                             </div>
                             <div className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                                 <span className="font-semibold text-gray-700">Net Payable Amount</span>
                                 <span className="text-2xl font-bold text-green-700">AED {details.netSettlement.toLocaleString()}</span>
                             </div>
                        </div>
                    )}
                    {step === 3 && (
                         <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                             <h3 className="text-lg font-semibold text-gray-800">Assets & Clearance</h3>
                             <div className="flex items-center gap-4 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setDetails({...details, assetsReturned: !details.assetsReturned})}>
                                 <div className={`w-6 h-6 rounded border flex items-center justify-center ${details.assetsReturned ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                     {details.assetsReturned && <Check className="w-4 h-4 text-white" />}
                                 </div>
                                 <span className="text-gray-900">All company assets returned (Laptop, Sim, Uniform, Tools)</span>
                             </div>
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-gray-700">Additional Notes</label>
                                 <textarea className="w-full p-3 border rounded-xl bg-white text-gray-900" rows={4} value={details.notes} onChange={e => setDetails({...details, notes: e.target.value})} placeholder="Clearance details..." />
                             </div>
                         </div>
                    )}
                    {step === 4 && (
                         <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                             <div className="flex justify-between items-center">
                                 <h3 className="text-lg font-semibold text-gray-800">Final Settlement Document</h3>
                                 <button 
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors text-sm font-medium"
                                 >
                                     <Printer className="w-4 h-4" />
                                     Print Document
                                 </button>
                             </div>
                             
                             <div className="p-6 border-2 border-dashed rounded-2xl bg-gray-50 text-center space-y-4">
                                 <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                                     <FileText className="w-8 h-8" />
                                 </div>
                                 <div>
                                     <p className="font-bold text-gray-900">Generate Settlement Paper</p>
                                     <p className="text-sm text-gray-500">Print the document for employee signature, then upload to Google Drive and paste the link below.</p>
                                 </div>
                             </div>
 
                             <div className="space-y-2">
                                 <label className="text-sm font-medium text-gray-700">Google Drive Link (Signed Document)</label>
                                 <div className="relative">
                                     <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                     <input 
                                        type="url" 
                                        className="w-full pl-10 pr-4 py-3 border rounded-xl bg-white text-gray-900" 
                                        placeholder="https://drive.google.com/..."
                                        value={details.settlementLink || ''}
                                        onChange={e => setDetails({...details, settlementLink: e.target.value})}
                                     />
                                 </div>
                                 <p className="text-[10px] text-gray-500 italic">Optional: You can add the link later if not ready.</p>
                             </div>
 
                             {/* Hidden template for printing */}
                             <div className="hidden">
                                 <div id="settlement-document-print">
                                     <FinalSettlementDocument employee={employee} details={details} />
                                 </div>
                             </div>
                         </div>
                    )}
                    {step === 5 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300 text-center py-8">
                             <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                 <LogOut className="w-10 h-10" />
                             </div>
                             <h3 className="text-2xl font-bold text-gray-900">Ready to Offboard?</h3>
                             <p className="text-gray-500 max-w-md mx-auto">
                                 You are about to mark <strong>{employee.name}</strong> as inactive. 
                                 Final settlement amount: <strong>AED {details.netSettlement.toLocaleString()}</strong>.
                             </p>
                        </div>
                    )}
                </div>
 
                <div className="p-6 border-t border-gray-100 flex justify-between bg-gray-50">
                    {step > 1 ? <button onClick={() => setStep(s => s - 1)} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">Back</button> : <div></div>}
                    {step < 5 ? (
                        <button onClick={() => setStep(s => s + 1)} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-lg shadow-red-200 transition-colors">Next Step</button>
                    ) : (
                        <button onClick={() => onComplete(details)} className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-lg shadow-red-200 flex items-center gap-2 transition-colors">
                            Confirm & Offboard
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const EditEmployeeModal = ({ employee, onSave, onCancel, companies, openConfirm }: { employee: Employee, onSave: (e: Employee) => void, onCancel: () => void, companies: Company[], openConfirm: any }) => {
    const [data, setData] = useState<Employee>(employee);
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-transparent">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">Edit Employee</h2>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Personal Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="col-span-2 flex items-center gap-4 mb-4">
                                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                                    {data.profileImage ? (
                                        <img src={data.profileImage} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <Users className="w-8 h-8 text-slate-300" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <input 
                                        type="file" 
                                        id="edit-profile-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setData({...data, profileImage: reader.result as string});
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    <label 
                                        htmlFor="edit-profile-upload"
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                                    >
                                        Change Photo
                                    </label>
                                    {data.profileImage && (
                                        <button 
                                            onClick={() => setData({...data, profileImage: undefined})}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 text-left px-1"
                                        >
                                            Remove Photo
                                        </button>
                                    )}
                                </div>
                             </div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Code</label><input disabled type="text" value={data.code || ''} className="w-full p-2 border rounded-lg mt-1 bg-gray-100 text-gray-500" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Name</label><input type="text" value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Mobile Number</label><input type="text" value={data.mobileNumber || ''} onChange={e => setData({...data, mobileNumber: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Staff Type</label>
                                 <input 
                                     list="staff-types-edit"
                                     value={data.type || ''} 
                                     onChange={e => setData({...data, type: e.target.value})} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900"
                                     placeholder="Select or type staff type"
                                 />
                                 <datalist id="staff-types-edit">
                                     {Object.values(StaffType).map(t => <option key={t} value={t} />)}
                                 </datalist>
                             </div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Designation</label><input type="text" value={data.designation || ''} onChange={e => setData({...data, designation: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Department</label><input type="text" value={data.department || ''} onChange={e => setData({...data, department: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Company</label>
                                 <select value={data.company || ''} onChange={e => setData({...data, company: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900">
                                     <option value="">Select Company</option>
                                     {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                 </select>
                             </div>
                        </div>
                    </div>
 
                    {/* Salary Info */}
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Salary Structure (AED)</h3>
                        <div className="grid grid-cols-3 gap-4">
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Basic</label><input type="number" value={data.salary.basic ?? 0} onChange={e => setData({...data, salary: {...data.salary, basic: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Housing</label><input type="number" value={data.salary.housing ?? 0} onChange={e => setData({...data, salary: {...data.salary, housing: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Transport</label><input type="number" value={data.salary.transport ?? 0} onChange={e => setData({...data, salary: {...data.salary, transport: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Other</label><input type="number" value={data.salary.other ?? 0} onChange={e => setData({...data, salary: {...data.salary, other: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Air Ticket</label><input type="number" value={data.salary.airTicket ?? 0} onChange={e => setData({...data, salary: {...data.salary, airTicket: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Leave Salary</label><input type="number" value={data.salary.leaveSalary ?? 0} onChange={e => setData({...data, salary: {...data.salary, leaveSalary: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Hourly Rate</label><input type="number" value={data.salary.hourlyRate ?? 0} onChange={e => setData({...data, salary: {...data.salary, hourlyRate: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                        </div>
                    </div>
 
                    {/* Banking */}
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Banking Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Bank Name</label><input type="text" value={data.bankName || ''} onChange={e => setData({...data, bankName: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">IBAN / Account</label><input type="text" value={data.iban || ''} onChange={e => setData({...data, iban: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                        </div>
                    </div>
 
                    {/* Documents */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Documents & Identification</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Emirates ID</label><input type="text" value={data.documents?.emiratesId || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), emiratesId: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">EID Expiry</label><input type="date" value={data.documents?.emiratesIdExpiry || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), emiratesIdExpiry: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Passport Number</label><input type="text" value={data.documents?.passportNumber || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), passportNumber: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Passport Expiry</label><input type="date" value={data.documents?.passportExpiry || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), passportExpiry: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900" /></div>
                        </div>
                    </div>
                    {/* Linked Documents */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Linked Documents</h3>
                        <GoogleDriveManager 
                            files={data.driveFiles || []}
                            onAddFile={(file) => setData({ ...data, driveFiles: [...(data.driveFiles || []), file] })}
                            onRemoveFile={(fileId) => setData({ ...data, driveFiles: (data.driveFiles || []).filter(f => f.id !== fileId) })}
                            openConfirm={openConfirm}
                        />
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors">Cancel</button>
                    <button onClick={() => onSave(data)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

const OnboardingWizard = ({ onComplete, onCancel, companies, openConfirm }: { onComplete: (data: Employee) => void, onCancel: () => void, companies: Company[], openConfirm: any }) => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<Partial<Employee>>({
        salary: { basic: 0, housing: 0, transport: 0, other: 0, airTicket: 0, leaveSalary: 0, hourlyRate: 0 },
        status: 'Active', 
        active: true, 
        leaveBalance: 30, 
        team: 'Internal Team', 
        type: StaffType.WORKER,
        documents: {
            emiratesId: '',
            emiratesIdExpiry: '',
            passportNumber: '',
            passportExpiry: ''
        }
    });

    const steps = [
        { id: 1, name: 'Personal' },
        { id: 2, name: 'Role & Work' },
        { id: 3, name: 'Financials' },
        { id: 4, name: 'Documents' }
    ];

    const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const isStepValid = () => {
        if (step === 1) return data.code && data.name && data.joiningDate;
        if (step === 2) return data.type;
        if (step === 3) return data.salary && data.salary.basic > 0;
        return true;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-white">
                    <h2 className="text-xl font-bold text-gray-900">Onboard New Employee</h2>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
 
                {/* Stepper */}
                <div className="px-8 py-6 bg-gray-50/50 border-b">
                    <div className="flex items-center justify-between max-w-2xl mx-auto relative">
                        {/* Connecting Lines */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 z-0"></div>
                        
                        {steps.map((s, idx) => (
                            <div key={s.id} className="relative z-10 flex items-center gap-3 bg-gray-50/50 px-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                                    step === s.id 
                                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' 
                                    : step > s.id 
                                    ? 'bg-indigo-100 text-indigo-600' 
                                    : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}>
                                    {step > s.id ? <CheckCircle className="w-5 h-5" /> : s.id}
                                </div>
                                <span className={`text-sm font-bold ${step === s.id ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {s.name}
                                </span>
                                {idx < steps.length - 1 && (
                                    <div className={`w-12 h-0.5 ${step > s.id ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
 
                {/* Content */}
                <div className="p-8 max-h-[60vh] overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Profile Image</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                                            {data.profileImage ? (
                                                <img src={data.profileImage} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                                <Users className="w-8 h-8 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <input 
                                                type="file" 
                                                id="profile-upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setData({ ...data, profileImage: reader.result as string });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                            <label 
                                                htmlFor="profile-upload"
                                                className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-100 transition-colors"
                                            >
                                                Upload Photo
                                            </label>
                                            <p className="text-[10px] text-slate-400">JPG, PNG or GIF. Max 1MB.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Code *</label>
                                    <input 
                                        placeholder="e.g. 1001" 
                                        value={data.code||''} 
                                        onChange={e=>setData({...data, code:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                                    <input 
                                        placeholder="John Doe" 
                                        value={data.name||''} 
                                        onChange={e=>setData({...data, name:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</label>
                                    <select 
                                        value={data.company||''} 
                                        onChange={e=>setData({...data, company:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900"
                                    >
                                        <option value="">Select Company</option>
                                        {companies.map(c=><option key={c.id} value={c.name}>{c.code} - {c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Joining Date *</label>
                                    <input 
                                        type="date" 
                                        value={data.joiningDate||''} 
                                        onChange={e=>setData({...data, joiningDate:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mobile Number</label>
                                    <input 
                                        placeholder="e.g. +971 ..." 
                                        value={data.mobileNumber||''} 
                                        onChange={e=>setData({...data, mobileNumber:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-900">Role & Work Details</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Designation</label>
                                    <input 
                                        placeholder="e.g. Driver" 
                                        value={data.designation||''} 
                                        onChange={e=>setData({...data, designation:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Department</label>
                                    <input 
                                        placeholder="e.g. Transport" 
                                        value={data.department||''} 
                                        onChange={e=>setData({...data, department:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Team</label>
                                    <select 
                                        value={data.team||''} 
                                        onChange={e=>setData({...data, team:e.target.value as any})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900"
                                    >
                                        <option value="Internal Team">Internal Team</option>
                                        <option value="External Team">External Team</option>
                                        <option value="Office Staff">Office Staff</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Type *</label>
                                    <input 
                                        list="staff-types-onboarding"
                                        value={data.type||''} 
                                        onChange={e=>setData({...data, type:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900"
                                        placeholder="Select or type staff type"
                                    />
                                    <datalist id="staff-types-onboarding">
                                        {Object.values(StaffType).map(t => <option key={t} value={t} />)}
                                    </datalist>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Work Location</label>
                                    <input 
                                        placeholder="e.g. Dubai" 
                                        value={data.workLocation||''} 
                                        onChange={e=>setData({...data, workLocation:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-900">Salary & Banking</h3>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Basic *</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.basic ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, basic:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Housing</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.housing ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, housing:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transport</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.transport ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, transport:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Air Ticket</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.airTicket ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, airTicket:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leave Salary</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.leaveSalary ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, leaveSalary:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Other</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.other ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, other:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hourly Rate</label>
                                    <input 
                                        type="number" 
                                        value={data.salary?.hourlyRate ?? 0} 
                                        onChange={e=>setData({...data, salary:{...data.salary!, hourlyRate:Number(e.target.value)}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 pt-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Name</label>
                                    <input 
                                        placeholder="e.g. Emirates NBD" 
                                        value={data.bankName||''} 
                                        onChange={e=>setData({...data, bankName:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">IBAN / Acct No.</label>
                                    <input 
                                        placeholder="AE00 0000 0000 0000 0000 000" 
                                        value={data.iban||''} 
                                        onChange={e=>setData({...data, iban:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-gray-900">Documents & Identification</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Emirates ID Number</label>
                                    <input 
                                        placeholder="784-..." 
                                        value={data.documents?.emiratesId||''} 
                                        onChange={e=>setData({...data, documents:{...data.documents!, emiratesId:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">EID Expiry</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.emiratesIdExpiry||''} 
                                        onChange={e=>setData({...data, documents:{...data.documents!, emiratesIdExpiry:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passport Number</label>
                                    <input 
                                        placeholder="e.g. N1234567" 
                                        value={data.documents?.passportNumber||''} 
                                        onChange={e=>setData({...data, documents:{...data.documents!, passportNumber:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passport Expiry</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.passportExpiry||''} 
                                        onChange={e=>setData({...data, documents:{...data.documents!, passportExpiry:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                            </div>
                            <div className="mt-8 pt-8 border-t">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Linked Documents</h3>
                                <GoogleDriveManager 
                                    files={data.driveFiles || []}
                                    onAddFile={(file) => setData({ ...data, driveFiles: [...(data.driveFiles || []), file] })}
                                    onRemoveFile={(fileId) => setData({ ...data, driveFiles: (data.driveFiles || []).filter(f => f.id !== fileId) })}
                                    openConfirm={openConfirm}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <button 
                        onClick={prevStep} 
                        disabled={step === 1}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        Back
                    </button>
                    
                    {step < 4 ? (
                        <button 
                            onClick={nextStep} 
                            disabled={!isStepValid()}
                            className="px-8 py-2.5 bg-[#1e293b] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                        >
                            Next Step <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button 
                            onClick={() => onComplete(data as Employee)} 
                            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                        >
                            Complete Onboarding <CheckCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const UserManagementModal = ({ onClose, users, openConfirm, currentUser, onLog }: { onClose: () => void, users: SystemUser[], openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void, currentUser: SystemUser, onLog: any }) => {
    const [localUsers, setLocalUsers] = useState<SystemUser[]>(users);
    const [showAdd, setShowAdd] = useState(false);
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
    const [newUser, setNewUser] = useState({ 
        username: '', 
        password: '', 
        role: '', 
        name: '',
        permissions: {
            canViewDashboard: true,
            canViewCompanyDashboard: true,
            canManageEmployees: false,
            canViewDirectory: false,
            canManageAttendance: false,
            canViewTimesheet: false,
            canManageLeaves: false,
            canViewPayroll: false,
            canManagePayroll: false,
            canViewReports: false,
            canManageUsers: false,
            canManageSettings: false,
            canManageSuppliers: false,
            canManageProjects: false
        }
    });

    useEffect(() => {
        setLocalUsers(users);
    }, [users]);

    const handleAdd = async () => {
        console.log("Attempting to add new user:", { ...newUser, password: '***' });
        if (!newUser.username || !newUser.password || !newUser.name || !newUser.role) {
            alert("Please fill in all fields (Name, Username, Password, and Role)");
            return;
        }

        const userEmail = newUser.username.includes('@') ? newUser.username : `${newUser.username}@system.local`;
        if (localUsers.some(u => u.email === userEmail)) {
            alert("A user with this email/username already exists in the system.");
            return;
        }

        try {
            console.log("Creating Auth user with email:", userEmail);
            
            // Create the user in Firebase Auth first
            const authUser = await adminCreateUser(userEmail, newUser.password);
            console.log("Auth user created successfully, UID:", authUser.uid);
            
            const userToSave: SystemUser = {
                uid: authUser.uid,
                email: userEmail,
                username: newUser.username,
                password: newUser.password,
                name: newUser.name,
                role: newUser.role as any,
                active: true,
                permissions: newUser.permissions
            };
            console.log("Saving user to Firestore...");
            await saveSystemUser(userToSave);
            onLog('User Created', `New system user ${userToSave.name} (${userToSave.email}) was created with role ${userToSave.role}.`, 'create');
            console.log("User saved to Firestore successfully.");
            setShowAdd(false);
            setNewUser({ 
                username: '', 
                password: '', 
                role: '', 
                name: '',
                permissions: {
                    canViewDashboard: true, // Default to true for new users
                    canViewCompanyDashboard: true,
                    canManageEmployees: false,
                    canViewDirectory: false,
                    canManageAttendance: false,
                    canViewTimesheet: false,
                    canManageLeaves: false,
                    canViewPayroll: false,
                    canManagePayroll: false,
                    canViewReports: false,
                    canManageUsers: false,
                    canManageSettings: false,
                    canManageSuppliers: false,
                    canManageProjects: false
                }
            });
        } catch (e: any) {
            console.error("Error in handleAdd:", e);
            if (e.code === 'auth/email-already-in-use') {
                alert("This email/username is already in use. Please use a different one or check if the user already exists.");
            } else {
                alert("Failed to save user: " + e.message);
            }
        }
    };

    const handleEdit = async () => {
        if (!editingUser) return;
        try {
            const username = editingUser.username || editingUser.email || '';
            const updatedUser = {
                ...editingUser,
                username,
                email: username.includes('@') ? username : `${username}@system.local`
            };
            await saveSystemUser(updatedUser);
            onLog('User Updated', `System user ${updatedUser.name} (${updatedUser.email}) details were updated.`, 'update');
            setEditingUser(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (userToDelete: SystemUser) => {
        if (!userToDelete.uid) {
            alert("Error: User ID is missing. Cannot delete.");
            return;
        }

        openConfirm(
            "Delete User",
            `Are you sure you want to delete ${userToDelete.name}? This will remove their access to the system.`,
            async () => {
                try {
                    // 1. Delete from Firebase Auth if password is available
                    if (userToDelete.email && userToDelete.password) {
                        try {
                            await adminDeleteUser(userToDelete.email, userToDelete.password);
                        } catch (authError: any) {
                            console.warn("Auth deletion failed, proceeding with Firestore deletion:", authError);
                        }
                    }
                    
                    // 2. Delete from Firestore
                    await deleteSystemUser(userToDelete.uid);
                    onLog('User Deleted', `System user ${userToDelete.name} (${userToDelete.email}) was removed from the system.`, 'delete');
                } catch (e: any) {
                    console.error("Delete error:", e);
                    alert("Error deleting user: " + (e.message || "Unknown error"));
                }
            }
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">System User Management</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-gray-700">Active System Users</h3>
                        {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CREATOR || currentUser.email === CREATOR_USER.email) && (
                            <button onClick={() => { setShowAdd(true); setEditingUser(null); }} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                                <Plus className="w-4 h-4" /> Add User
                            </button>
                        )}
                    </div>

                    {showAdd && (
                        <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Full Name</label>
                                    <input className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" placeholder="Full Name" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Username / Email</label>
                                    <input className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" placeholder="Username" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Password</label>
                                    <input className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" type="password" placeholder="Password" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Role</label>
                                    <input 
                                        className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" 
                                        placeholder="Enter Role Manually" 
                                        value={newUser.role} 
                                        onChange={e=>setNewUser({...newUser, role: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <label className="text-[10px] font-bold text-indigo-600 uppercase">Permissions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(newUser.permissions).map(perm => (
                                        <label key={perm} className="flex items-center gap-2 p-2 border rounded-lg bg-white cursor-pointer hover:bg-indigo-100/30">
                                            <input 
                                                type="checkbox" 
                                                checked={(newUser.permissions as any)[perm]} 
                                                onChange={e => setNewUser({
                                                    ...newUser,
                                                    permissions: { ...newUser.permissions, [perm]: e.target.checked }
                                                })}
                                                className="w-4 h-4 text-indigo-600 rounded"
                                            />
                                            <span className="text-[10px] font-medium text-gray-700 capitalize">{perm.replace('can', '').replace(/([A-Z])/g, ' $1')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-gray-600 text-sm font-medium">Cancel</button>
                                <button onClick={handleAdd} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">Save User</button>
                            </div>
                        </div>
                    )}

                    {editingUser && (
                        <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
                            <h4 className="text-sm font-bold text-orange-800">Editing: {editingUser.name}</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Full Name</label>
                                    <input className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" placeholder="Full Name" value={editingUser.name} onChange={e=>setEditingUser({...editingUser, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Username / Email</label>
                                    <input className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" placeholder="Username" value={editingUser.email || editingUser.username || ''} onChange={e=>setEditingUser({...editingUser, email: e.target.value, username: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Password</label>
                                    <input className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" type="password" placeholder="Password" value={editingUser.password || ''} onChange={e=>setEditingUser({...editingUser, password: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Role</label>
                                    <input 
                                        className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900" 
                                        placeholder="Enter Role Manually" 
                                        value={editingUser.role} 
                                        onChange={e=>setEditingUser({...editingUser, role: e.target.value as any})} 
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2 mt-4">
                                <label className="text-[10px] font-bold text-orange-600 uppercase">Permissions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(editingUser.permissions).map(perm => (
                                        <label key={perm} className="flex items-center gap-2 p-2 border rounded-lg bg-white cursor-pointer hover:bg-orange-100/30">
                                            <input 
                                                type="checkbox" 
                                                checked={(editingUser.permissions as any)[perm]} 
                                                onChange={e => setEditingUser({
                                                    ...editingUser,
                                                    permissions: { ...editingUser.permissions, [perm]: e.target.checked }
                                                })}
                                                className="w-4 h-4 text-orange-600 rounded"
                                            />
                                            <span className="text-[10px] font-medium text-gray-700 capitalize">{perm.replace('can', '').replace(/([A-Z])/g, ' $1')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-gray-600 text-sm font-medium">Cancel</button>
                                <button onClick={handleEdit} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-bold">Update User</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {localUsers
                            .filter(u => {
                                // Creator sees everyone
                                if (currentUser.role === UserRole.CREATOR || currentUser.email === CREATOR_USER.email) {
                                    return true;
                                }
                                // Others see everyone EXCEPT the Creator (by role or email)
                                return u.role !== UserRole.CREATOR && u.email !== CREATOR_USER.email;
                            })
                            .map(u => (
                            <div key={u.uid || u.username} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-xs">
                                        {u.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{u.name} <span className="text-gray-400 font-normal">({u.email || u.username})</span></p>
                                        <p className="text-xs text-indigo-600 font-semibold uppercase">{u.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingUser(u); setShowAdd(false); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    {u.email !== CREATOR_USER.username && (
                                        <button onClick={() => handleDelete(u)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="p-4 bg-gray-50 border-t text-center text-xs text-gray-500 font-medium">
                    Only Admin can Create New User.
                </div>
            </div>
        </div>
    );
};

const ReorderCompaniesModal = ({ companies, onClose, onReorder }: { companies: Company[], onClose: () => void, onReorder: (newOrder: Company[]) => void }) => {
    const [items, setItems] = useState(companies);

    const handleSave = () => {
        onReorder(items);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reorder Companies</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Drag to adjust display order</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1">
                    <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
                        {items.map((item) => (
                            <Reorder.Item 
                                key={item.id} 
                                value={item}
                                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 cursor-grab active:cursor-grabbing hover:bg-white hover:border-brand-200 transition-all group"
                            >
                                <div className="p-2 bg-white rounded-xl shadow-sm text-slate-300 group-hover:text-brand-500 transition-colors">
                                    <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="h-8 w-8 bg-white rounded-lg border border-slate-100 p-1 flex items-center justify-center flex-shrink-0">
                                        {item.logo ? (
                                            <img src={item.logo} alt="" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <Building2 className="w-4 h-4 text-slate-300" />
                                        )}
                                    </div>
                                    <div className="truncate">
                                        <div className="text-sm font-black text-slate-900 truncate">{item.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.code}</div>
                                    </div>
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 px-6 py-3 bg-brand-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition-all active:scale-95"
                    >
                        Save Order
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const ManageCompaniesModal = ({ onClose, companies, openConfirm, onLog, onAdd, onUpdate }: { onClose: () => void, companies: Company[], openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void, onLog: any, onAdd: (c: any) => Promise<void>, onUpdate: (c: Company) => Promise<void> }) => {
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        address: '',
        email: '',
        phone: '',
        logo: ''
    });
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReordering, setIsReordering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!formData.name.trim() || !formData.code.trim()) {
            setError("Company name and code are required.");
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            await onAdd(formData);
            setFormData({ code: '', name: '', address: '', email: '', phone: '', logo: '' });
            setIsAdding(false);
        } catch (err) {
            setError("Failed to save company. Please check your permissions.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async (company: Company) => {
        await onUpdate(company);
    };

    const handleDelete = async (id: string) => {
        const company = companies.find(c => c.id === id);
        openConfirm(
            "Delete Company",
            "Are you sure you want to delete this company? This action cannot be undone.",
            async () => {
                await deleteCompany(id);
                if (company) {
                    onLog('Company Deleted', `Company ${company.name} was removed from the system.`, 'delete');
                }
            }
        );
    };

    const handleLogoUpload = async (company: Company | null, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const base64 = evt.target?.result as string;
            if (company) {
                await updateCompany({ ...company, logo: base64 });
            } else {
                setFormData(prev => ({ ...prev, logo: base64 }));
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-100 rounded-lg text-brand-600">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Manage Companies</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                    {isReordering && (
                        <ReorderCompaniesModal 
                            companies={companies}
                            onClose={() => setIsReordering(false)}
                            onReorder={async (newOrder) => {
                                await reorderCompanies(newOrder);
                                onLog('Companies Reordered', 'The display order of companies was updated.', 'update');
                            }}
                        />
                    )}
                    {/* Add New Company Form */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Add New Company</h3>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsReordering(true)}
                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                                >
                                    <GripVertical className="w-3 h-3" /> Reorder
                                </button>
                                {!isAdding && (
                                    <button 
                                        onClick={() => setIsAdding(true)}
                                        className="text-xs font-bold text-brand-600 hover:text-brand-700"
                                    >
                                        + Create New
                                    </button>
                                )}
                            </div>
                        </div>

                        {isAdding && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Company Code</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" 
                                            placeholder="e.g. A1" 
                                            value={formData.code} 
                                            onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))} 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Company Name</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" 
                                            placeholder="e.g. Acme Corp" 
                                            value={formData.name} 
                                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Email Address</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" 
                                            placeholder="contact@company.com" 
                                            value={formData.email} 
                                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Contact Number</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" 
                                            placeholder="+971 50 123 4567" 
                                            value={formData.phone} 
                                            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Office Address</label>
                                    <input 
                                        className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" 
                                        placeholder="123 Business St, Suite 100" 
                                        value={formData.address} 
                                        onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} 
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={e => handleLogoUpload(null, e)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <button className="px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
                                                Upload Logo
                                            </button>
                                        </div>
                                        {formData.logo && (
                                            <img src={formData.logo} alt="Preview" className="h-8 w-8 object-contain rounded border bg-white" />
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setIsAdding(false)}
                                            className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleAdd}
                                            disabled={isSaving}
                                            className="px-4 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 shadow-sm disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Company'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Existing Companies List */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Registered Companies ({companies.length})</h3>
                        <div className="grid gap-4">
                            {companies.map(c => (
                                <div key={c.id} className="p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow space-y-4 relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            {c.logo ? (
                                                <img src={c.logo} alt={c.name} className="h-10 w-10 object-contain rounded-lg border p-1 bg-gray-50" />
                                            ) : (
                                                <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-lg">
                                                    {c.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-sm">{c.name}</h3>
                                                <p className="text-[10px] text-gray-400">ID: {c.id}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(c.id)} 
                                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Company"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Company Code</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900" 
                                                value={c.code || ''} 
                                                onChange={e => handleUpdate({...c, code: e.target.value})} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Address</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900" 
                                                value={c.address || ''} 
                                                onChange={e => handleUpdate({...c, address: e.target.value})} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Email</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900" 
                                                value={c.email || ''} 
                                                onChange={e => handleUpdate({...c, email: e.target.value})} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Phone</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900" 
                                                value={c.phone || ''} 
                                                onChange={e => handleUpdate({...c, phone: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={e => handleLogoUpload(c, e)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <button className="text-[10px] font-bold text-indigo-600 hover:underline">
                                                Change Logo
                                            </button>
                                        </div>
                                        <span className="text-[10px] text-gray-300 italic">Auto-saves on change</span>
                                    </div>
                                </div>
                            ))}
                            {companies.length === 0 && (
                                <div className="py-12 text-center border-2 border-dashed rounded-2xl">
                                    <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm font-medium">No companies registered yet</p>
                                    <p className="text-gray-400 text-xs mt-1">Add your first company to start managing employees</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BulkImportModal = ({ onClose, onImport }: { onClose: () => void, onImport: (data: any[]) => void }) => {
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            onImport(data);
            onClose();
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Download className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Bulk Import Employees</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-8 text-center space-y-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 hover:border-indigo-300 transition-colors cursor-pointer relative">
                        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                                <FileText className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-700">Click to upload or drag and drop</p>
                                <p className="text-sm text-gray-500">Excel or CSV files only</p>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">Make sure your file follows the standard template format.</p>
                </div>
            </div>
        </div>
    );
};

// --- Main App ---

const AboutView = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-indigo-600 to-blue-600"></div>
                <div className="px-8 pb-8">
                    <div className="relative flex justify-between items-end -mt-12 mb-6">
                        <div className="p-1 bg-white rounded-2xl shadow-lg">
                            <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-indigo-600">
                                <Users className="w-12 h-12" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{DEFAULT_ABOUT_DATA.name}</h2>
                            <p className="text-indigo-600 font-medium">{DEFAULT_ABOUT_DATA.title}</p>
                        </div>
                        
                        <p className="text-gray-600 leading-relaxed">
                            {DEFAULT_ABOUT_DATA.bio}
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-gray-400">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold">Email</p>
                                    <p className="text-sm font-medium text-gray-700">{DEFAULT_ABOUT_DATA.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-gray-400">
                                    <AlertCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold">Support</p>
                                    <p className="text-sm font-medium text-gray-700">{DEFAULT_ABOUT_DATA.contactInfo}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-8 text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-2">Pioneer DMS Portal Enterprise</h3>
                    <p className="text-indigo-100 mb-6 max-w-lg">
                        A robust workforce management ecosystem built for scale, efficiency, and real-time operational control.
                    </p>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                            <ShieldCheck className="w-4 h-4 text-green-400" /> Secure
                        </div>
                        <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-4 h-4 text-blue-400" /> Verified
                        </div>
                    </div>
                </div>
                <Building2 className="absolute -right-8 -bottom-8 w-64 h-64 text-slate-900/5 rotate-12" />
            </div>
        </div>
    );
};

const AuditLogModal = ({ isOpen, onClose, logs, currentUser, openConfirm }: { isOpen: boolean, onClose: () => void, logs: AuditLog[], currentUser: SystemUser | null, openConfirm: any }) => {
    const [filterType, setFilterType] = useState<'all' | 'onboarding' | 'offboarding' | 'login' | 'logout' | 'delete' | 'update' | 'rehire'>('all');
    const [timeFilter, setTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'yearly'>('all');
    const [userFilter, setUserFilter] = useState<string>('all');
    const [editingLog, setEditingLog] = useState<AuditLog | null>(null);
    const [editDetails, setEditDetails] = useState('');
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

    if (!isOpen) return null;

    const isAdmin = currentUser?.role === UserRole.CREATOR || currentUser?.role === UserRole.ADMIN || currentUser?.email === 'abdulkaderp3010@gmail.com';

    const users = Array.from(new Set(logs.map(l => l.userName)));

    const filteredLogs = logs.filter(log => {
        // Type filter
        if (filterType !== 'all') {
            const action = log.action.toLowerCase();
            if (filterType === 'onboarding' && !action.includes('onboard')) return false;
            if (filterType === 'offboarding' && !action.includes('offboard')) return false;
            if (filterType === 'login' && !action.includes('login')) return false;
            if (filterType === 'logout' && !action.includes('logout')) return false;
            if (filterType === 'delete' && !action.includes('delete')) return false;
            if (filterType === 'update' && !action.includes('update')) return false;
            if (filterType === 'rehire' && !action.includes('rehire') && !action.includes('rejoin')) return false;
        }

        // User filter
        if (userFilter !== 'all' && log.userName !== userFilter) return false;

        // Time filter
        if (timeFilter !== 'all') {
            const logDate = new Date(log.timestamp);
            const now = new Date();
            if (timeFilter === 'weekly') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (logDate < oneWeekAgo) return false;
            } else if (timeFilter === 'monthly') {
                const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                if (logDate < oneMonthAgo) return false;
            } else if (timeFilter === 'yearly') {
                const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                if (logDate < oneYearAgo) return false;
            }
        }

        return true;
    });

    const handleDelete = async (id: string) => {
        try {
            await deleteAuditLog(id);
            setDeletingLogId(null);
        } catch (error) {
            console.error("Failed to delete log:", error);
        }
    };

    const handleUpdate = async () => {
        if (!editingLog) return;
        try {
            await updateAuditLog({ ...editingLog, details: editDetails });
            setEditingLog(null);
        } catch (error) {
            console.error("Failed to update log:", error);
        }
    };

    const handleClearAll = async () => {
        openConfirm(
            "Clear All Audit Logs",
            "Are you sure you want to permanently delete all system audit logs? This action cannot be undone.",
            async () => {
                try {
                    await clearAuditLogs();
                } catch (error) {
                    console.error("Failed to clear logs:", error);
                }
            }
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-white/60 backdrop-blur-sm"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-8 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-50 rounded-2xl">
                                <Activity className="w-6 h-6 text-brand-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Audit Log</h2>
                                <p className="text-slate-400 text-sm font-bold">Real-time system activity and security trail</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {(currentUser?.role === UserRole.CREATOR || currentUser?.email === 'abdulkaderp3010@gmail.com') && (
                                <button 
                                    onClick={handleClearAll}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-2xl text-sm font-black hover:bg-red-100 transition-all active:scale-95"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear All
                                </button>
                            )}
                            <button 
                                onClick={onClose}
                                className="p-3 hover:bg-slate-50 rounded-2xl transition-all active:scale-95"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Action Type</label>
                            <div className="relative">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                                >
                                    <option value="all">All Activities</option>
                                    <option value="onboarding">Onboarding</option>
                                    <option value="offboarding">Offboarding</option>
                                    <option value="login">Login</option>
                                    <option value="logout">Logout</option>
                                    <option value="delete">Deletions</option>
                                    <option value="update">Updates</option>
                                    <option value="rehire">Rehire/Rejoin</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Time Period</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value as any)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                                >
                                    <option value="all">All Time</option>
                                    <option value="weekly">Last Week</option>
                                    <option value="monthly">Last Month</option>
                                    <option value="yearly">Last Year</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">User Wise</label>
                            <div className="relative">
                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    value={userFilter}
                                    onChange={(e) => setUserFilter(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                                >
                                    <option value="all">All Users</option>
                                    {users.map(user => (
                                        <option key={user} value={user}>{user}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="space-y-4">
                        {filteredLogs.length > 0 ? (
                            filteredLogs.map((log) => (
                                <div key={log.id} className="group p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-brand-200 hover:bg-white hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
                                    <div className="flex items-start gap-6">
                                        <div className={cn(
                                            "p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 duration-300",
                                            log.type === 'create' ? 'bg-emerald-100 text-emerald-600' :
                                            log.type === 'delete' ? 'bg-red-100 text-red-600' :
                                            log.type === 'update' ? 'bg-brand-100 text-brand-600' : 'bg-indigo-100 text-indigo-600'
                                        )}>
                                            {log.type === 'create' ? <UserPlus className="w-6 h-6" /> :
                                             log.type === 'delete' ? <UserMinus className="w-6 h-6" /> :
                                             log.type === 'update' ? <Edit className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-lg font-black text-slate-900 tracking-tight">{log.action}</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{new Date(log.timestamp).toLocaleString()}</span>
                                                    {isAdmin && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {deletingLogId === log.id ? (
                                                                <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-xl border border-red-100 animate-in fade-in zoom-in duration-200">
                                                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest px-2">Confirm?</span>
                                                                    <button 
                                                                        onClick={() => handleDelete(log.id)}
                                                                        className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setDeletingLogId(null)}
                                                                        className="p-1.5 bg-white text-slate-400 rounded-lg hover:text-slate-600 border border-slate-200 transition-all"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingLog(log);
                                                                            setEditDetails(log.details);
                                                                        }}
                                                                        className="p-2 hover:bg-brand-50 text-brand-600 rounded-xl transition-all"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setDeletingLogId(log.id)}
                                                                        className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-all"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {editingLog?.id === log.id ? (
                                                <div className="mb-4 space-y-3">
                                                    <textarea 
                                                        value={editDetails}
                                                        onChange={(e) => setEditDetails(e.target.value)}
                                                        className="w-full p-4 bg-white border border-brand-200 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-4 focus:ring-brand-500/10 min-h-[100px]"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setEditingLog(null)}
                                                            className="px-4 py-2 text-xs font-black text-slate-400 hover:text-slate-600"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={handleUpdate}
                                                            className="px-6 py-2 bg-brand-600 text-white rounded-xl text-xs font-black shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition-all"
                                                        >
                                                            Save Changes
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-slate-600 font-bold text-sm mb-4 leading-relaxed">{log.details}</p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-4">
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl">
                                                    <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">User: {log.userName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Role: {log.userRole}</span>
                                                </div>
                                                {log.isCreator && (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl">
                                                        <ShieldCheck className="w-3 h-3 text-amber-600" />
                                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Creator Log</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center">
                                <Activity className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">No audit records found</h3>
                                <p className="text-slate-400 font-bold mt-2">Try adjusting your filters to see more activity.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        {(currentUser?.role === UserRole.CREATOR || currentUser?.email === 'abdulkaderp3010@gmail.com') && (
                            <button 
                                onClick={handleClearAll}
                                className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl text-sm font-black hover:bg-red-100 transition-all active:scale-95 border border-red-100"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear All Logs
                            </button>
                        )}
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-black hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        Close Logs
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const RejoinModal = ({ employee, onComplete, onCancel }: { employee: Employee, onComplete: (reason: string) => void, onCancel: () => void }) => {
    const [reason, setReason] = useState('');

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-transparent">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900">Rejoin: {employee.name}</h2>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Rejoining Reason</label>
                        <textarea 
                            className="w-full p-3 border rounded-xl bg-white text-gray-900 outline-none focus:ring-2 focus:ring-brand-500" 
                            rows={4} 
                            placeholder="Enter reason for rejoining..."
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                        />
                    </div>
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                    <button 
                        onClick={() => onComplete(reason)} 
                        disabled={!reason.trim()}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirm Rejoin
                    </button>
                </div>
            </div>
        </div>
    );
};

const OffboardingDetailsModal = ({ employee, onCancel }: { employee: Employee, onCancel: () => void }) => {
    const details = employee.offboardingDetails;
    if (!details) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-transparent max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-xl">
                            <LogOut className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Offboarding Details</h2>
                            <p className="text-xs text-slate-500 font-medium">{employee.name} • {employee.code}</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-8">
                    {/* Exit Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exit Type</p>
                            <p className="text-sm font-bold text-slate-900">{details.type}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Working Day</p>
                            <p className="text-sm font-bold text-slate-900">{new Date(details.exitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason for Leaving</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{details.reason || 'No reason specified'}</p>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Financial Settlement</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gratuity</p>
                                <p className="text-sm font-bold text-slate-900">AED {details.gratuity.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Leave Encashment</p>
                                <p className="text-sm font-bold text-slate-900">AED {details.leaveEncashment.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Salary Dues</p>
                                <p className="text-sm font-bold text-slate-900">AED {details.salaryDues.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Other Dues</p>
                                <p className="text-sm font-bold text-slate-900">AED {details.otherDues.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Deductions</p>
                                <p className="text-sm font-bold text-red-600">AED {details.deductions.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Net Settlement</p>
                                <p className="text-sm font-bold text-emerald-600">AED {details.netSettlement.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Assets & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assets Status</p>
                            <div className="flex items-center gap-2">
                                {details.assetsReturned ? (
                                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                                        <CheckCircle className="w-4 h-4" /> All Assets Returned
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-600 text-sm font-bold">
                                        <XCircle className="w-4 h-4" /> Assets Pending
                                    </div>
                                )}
                            </div>
                        </div>
                        {details.notes && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Additional Notes</p>
                                <p className="text-sm text-slate-600 italic">{details.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Document Preview */}
                    {details.settlementLink && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Settlement Document</h3>
                            <div className="bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            <FileText className="w-5 h-5 text-brand-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Final_Settlement_{employee.code}.pdf</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Signed Document</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={details.settlementLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-brand-600 transition-all flex items-center gap-2"
                                    >
                                        <Download className="w-3 h-3" /> Download
                                    </a>
                                </div>
                                <div className="aspect-video bg-white rounded-xl border border-slate-200 overflow-hidden relative group">
                                    <iframe 
                                        src={details.settlementLink.includes('drive.google.com') ? details.settlementLink.replace('/view', '/preview') : details.settlementLink} 
                                        className="w-full h-full border-none"
                                        title="Document Preview"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button onClick={onCancel} className="px-8 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95">
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  useEffect(() => {
    (window as any).openShortcuts = () => setShowShortcuts(true);
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [deductions, setDeductions] = useState<DeductionRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<AccountsPayable[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountsReceivable[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCash[]>([]);
  const [projectedExpenses, setProjectedExpenses] = useState<ProjectedExpense[]>([]);
  const [everydayExpenses, setEverydayExpenses] = useState<EverydayExpense[]>([]);
  const hasLoggedLogin = useRef(false);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      openConfirm('Password Reset', `A password reset email has been sent to ${user.email}. Please check your inbox.`, () => {}, 'warning');
    } catch (error: any) {
      openConfirm('Error', `Failed to send reset email: ${error.message}`, () => {}, 'danger');
    }
  };
  
  // View States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showOffboarding, setShowOffboarding] = useState<Employee | null>(null);
  const [showOffboardingDetails, setShowOffboardingDetails] = useState<Employee | null>(null);
  const [showRejoining, setShowRejoining] = useState<Employee | null>(null);
  const [showEdit, setShowEdit] = useState<Employee | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showManageCompanies, setShowManageCompanies] = useState(false);
  const [showHolidayManagement, setShowHolidayManagement] = useState(false);
  const [showLeaveRequest, setShowLeaveRequest] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showPayslip, setShowPayslip] = useState<Employee | null>(null);
  
  // Finance Modals
  const [showVendorModal, setShowVendorModal] = useState<Vendor | boolean>(false);
  const [showAPModal, setShowAPModal] = useState<AccountsPayable | boolean>(false);
  const [showARModal, setShowARModal] = useState<AccountsReceivable | boolean>(false);
  const [showPettyCashModal, setShowPettyCashModal] = useState<PettyCash | boolean>(false);
  const [showProjectedExpenseModal, setShowProjectedExpenseModal] = useState<ProjectedExpense | boolean>(false);
  const [showEverydayExpenseModal, setShowEverydayExpenseModal] = useState<EverydayExpense | boolean>(false);
  
  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' as 'danger' | 'warning' });
  const openConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' = 'danger') => {
      setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create system user profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as SystemUser;
          // Ensure creator role is correctly set for the default admin
          if (firebaseUser.email === "abdulkaderp3010@gmail.com" && data.role !== UserRole.CREATOR) {
            data.role = UserRole.CREATOR;
            await saveSystemUser(data);
          }
          setSystemUser(data);
        } else {
          // Create default profile for new user
          const isDefaultAdmin = firebaseUser.email === "abdulkaderp3010@gmail.com";
          const newProfile: SystemUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            username: firebaseUser.email?.split('@')[0] || firebaseUser.uid,
            name: firebaseUser.displayName || 'New User',
            role: isDefaultAdmin ? UserRole.CREATOR : UserRole.HR,
            active: true,
            permissions: {
              canViewDashboard: true,
              canViewCompanyDashboard: true,
              canManageEmployees: true,
              canViewDirectory: true,
              canManageAttendance: true,
              canViewTimesheet: true,
              canManageLeaves: true,
              canViewPayroll: true,
              canManagePayroll: isDefaultAdmin,
              canViewReports: true,
              canManageUsers: isDefaultAdmin,
              canManageSettings: isDefaultAdmin,
              canManageSuppliers: isDefaultAdmin,
              canManageProjects: isDefaultAdmin
            }
          };
          await saveSystemUser(newProfile);
          setSystemUser(newProfile);
        }
      } else {
        setSystemUser(null);
      }
      setIsAuthReady(true);
    });
    testConnection();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !user || !systemUser) return;
    
    let q;
    const isCreator = systemUser?.role === UserRole.CREATOR || user?.email === "abdulkaderp3010@gmail.com";
    
    const canViewAudit = isCreator || systemUser.permissions.canManageSettings || systemUser.permissions.canManageUsers || systemUser.permissions.canManageEmployees;
    
    if (!canViewAudit) {
      setIsAuthReady(true);
      return;
    }

    q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    });
    return () => unsubscribe();
  }, [user, systemUser]);

  const handleLogAction = async (action: string, details: string, type: 'create' | 'update' | 'delete' | 'system') => {
    if (systemUser) {
      await logAudit(systemUser, action, details, type);
    }
  };

  const handleUpdateProfile = async (updated: SystemUser) => {
    await saveSystemUser(updated);
    setSystemUser(updated);
    await handleLogAction('Update Profile', `User updated their own profile: ${updated.name}`, 'update');
  };

  // 2. Data Listeners
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const isCreator = systemUser?.role === UserRole.CREATOR || user?.email === "abdulkaderp3010@gmail.com";

    const unsubEmployees = (systemUser?.permissions?.canViewDirectory || systemUser?.permissions?.canManageEmployees || isCreator) ? onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => d.data() as Employee));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
    }) : () => {};

    const unsubAttendance = (systemUser?.permissions?.canViewTimesheet || systemUser?.permissions?.canManageAttendance || isCreator) ? onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendance(snap.docs.map(d => d.data() as AttendanceRecord));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    }) : () => {};

    const unsubLeaves = (systemUser?.permissions?.canManageLeaves || isCreator) ? onSnapshot(collection(db, 'leaves'), (snap) => {
      setLeaveRequests(snap.docs.map(d => d.data() as LeaveRequest));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaves');
    }) : () => {};

    const unsubDeductions = (systemUser?.permissions?.canViewPayroll || systemUser?.permissions?.canManagePayroll || isCreator) ? onSnapshot(collection(db, 'deductions'), (snap) => {
      setDeductions(snap.docs.map(d => d.data() as DeductionRecord));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'deductions');
    }) : () => {};

    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map(d => d.data() as Company));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'companies');
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      setSuppliers(snap.docs.map(d => d.data() as Supplier));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => d.data() as Project));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const unsubVendors = onSnapshot(collection(db, 'vendors'), (snap) => {
      setVendors(snap.docs.map(d => d.data() as Vendor));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vendors');
    });

    const unsubAP = onSnapshot(collection(db, 'accounts_payable'), (snap) => {
      setAccountsPayable(snap.docs.map(d => d.data() as AccountsPayable));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts_payable');
    });

    const unsubAR = onSnapshot(collection(db, 'accounts_receivable'), (snap) => {
      setAccountsReceivable(snap.docs.map(d => d.data() as AccountsReceivable));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts_receivable');
    });

    const unsubPettyCash = onSnapshot(collection(db, 'petty_cash'), (snap) => {
      setPettyCash(snap.docs.map(d => d.data() as PettyCash));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'petty_cash');
    });

    const unsubProjectedExpenses = onSnapshot(collection(db, 'projected_expenses'), (snap) => {
      setProjectedExpenses(snap.docs.map(d => d.data() as ProjectedExpense));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projected_expenses');
    });

    const unsubEverydayExpenses = onSnapshot(collection(db, 'everyday_expenses'), (snap) => {
      setEverydayExpenses(snap.docs.map(d => d.data() as EverydayExpense));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'everyday_expenses');
    });

    const unsubUsers = (systemUser?.permissions?.canManageUsers || isCreator) ? onSnapshot(collection(db, 'users'), (snap) => {
      setSystemUsers(snap.docs.map(d => d.data() as SystemUser));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }) : () => {};

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
      unsubDeductions();
      unsubCompanies();
      unsubSuppliers();
      unsubProjects();
      unsubVendors();
      unsubAP();
      unsubAR();
      unsubPettyCash();
      unsubProjectedExpenses();
      unsubEverydayExpenses();
      unsubUsers();
    };
  }, [isAuthReady, user, systemUser]);

  // Finance Handlers
  const handleSaveVendor = async (data: any) => {
    if (typeof showVendorModal === 'object') {
      await updateVendor({ ...showVendorModal, ...data });
      handleLogAction('Vendor Updated', `Vendor ${data.name} was updated.`, 'update');
    } else {
      await addVendor(data, vendors.length);
      handleLogAction('Vendor Added', `New vendor ${data.name} was added.`, 'create');
    }
    setShowVendorModal(false);
  };

  const handleDeleteVendor = async (v: Vendor) => {
    openConfirm("Delete Vendor", `Are you sure you want to delete ${v.name}?`, async () => {
      await deleteVendor(v.id);
      handleLogAction('Vendor Deleted', `Vendor ${v.name} was deleted.`, 'delete');
    });
  };

  const handleSaveAP = async (data: AccountsPayable) => {
    await saveAccountsPayable(data);
    const isUpdate = accountsPayable.some(ap => ap.id === data.id);
    handleLogAction(isUpdate ? 'Payable Updated' : 'Payable Added', `Accounts payable entry ${data.invoiceNumber} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowAPModal(false);
  };

  const handleDeleteAP = async (ap: AccountsPayable) => {
    openConfirm("Delete Entry", `Are you sure you want to delete invoice ${ap.invoiceNumber}?`, async () => {
      await deleteAccountsPayable(ap.id);
      handleLogAction('Payable Deleted', `Accounts payable entry ${ap.invoiceNumber} was deleted.`, 'delete');
    });
  };

  const handleSaveAR = async (data: AccountsReceivable) => {
    await saveAccountsReceivable(data);
    const isUpdate = accountsReceivable.some(ar => ar.id === data.id);
    handleLogAction(isUpdate ? 'Receivable Updated' : 'Receivable Added', `Accounts receivable entry ${data.invoiceNumber} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowARModal(false);
  };

  const handleDeleteAR = async (ar: AccountsReceivable) => {
    openConfirm("Delete Entry", `Are you sure you want to delete invoice ${ar.invoiceNumber}?`, async () => {
      await deleteAccountsReceivable(ar.id);
      handleLogAction('Receivable Deleted', `Accounts receivable entry ${ar.invoiceNumber} was deleted.`, 'delete');
    });
  };

  const handleSavePettyCash = async (data: PettyCash) => {
    await savePettyCash(data);
    const isUpdate = pettyCash.some(pc => pc.id === data.id);
    handleLogAction(isUpdate ? 'Petty Cash Updated' : 'Petty Cash Added', `Petty cash entry ${data.description} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowPettyCashModal(false);
  };

  const handleDeletePettyCash = async (pc: PettyCash) => {
    openConfirm("Delete Entry", `Are you sure you want to delete petty cash entry: ${pc.description}?`, async () => {
      await deletePettyCash(pc.id);
      handleLogAction('Petty Cash Deleted', `Petty cash entry ${pc.description} was deleted.`, 'delete');
    });
  };

  const handleSaveProjectedExpense = async (data: ProjectedExpense) => {
    await saveProjectedExpense(data);
    const isUpdate = projectedExpenses.some(pe => pe.id === data.id);
    handleLogAction(isUpdate ? 'Projected Expense Updated' : 'Projected Expense Added', `Projected expense ${data.invoiceNumber} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowProjectedExpenseModal(false);
  };

  const handleDeleteProjectedExpense = async (pe: ProjectedExpense) => {
    openConfirm("Delete Entry", `Are you sure you want to delete projected expense: ${pe.invoiceNumber}?`, async () => {
      await deleteProjectedExpense(pe.id);
      handleLogAction('Projected Expense Deleted', `Projected expense ${pe.invoiceNumber} was deleted.`, 'delete');
    });
  };

  const handleSaveEverydayExpense = async (data: EverydayExpense) => {
    await saveEverydayExpense(data);
    const isUpdate = everydayExpenses.some(ee => ee.id === data.id);
    handleLogAction(isUpdate ? 'Everyday Expense Updated' : 'Everyday Expense Added', `Everyday expense ${data.invoiceNo} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowEverydayExpenseModal(false);
  };

  const handleDeleteEverydayExpense = async (ee: EverydayExpense) => {
    openConfirm("Delete Entry", `Are you sure you want to delete everyday expense: ${ee.invoiceNo}?`, async () => {
      await deleteEverydayExpense(ee.id);
      handleLogAction('Everyday Expense Deleted', `Everyday expense ${ee.invoiceNo} was deleted.`, 'delete');
    });
  };

  // Handlers
  const navItems = useMemo(() => {
    const baseItems = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3, permission: 'canViewDashboard' },
      { id: 'company', label: 'Company', icon: Building2, permission: 'canViewCompanyDashboard' },
      { 
        id: 'clients-group', 
        label: 'Works', 
        icon: Globe, 
        subItems: [
          { id: 'suppliers', label: 'Suppliers', icon: Truck, permission: 'canManageSuppliers' },
          { id: 'projects', label: 'Projects', icon: Briefcase, permission: 'canManageProjects' },
          { id: 'vendors', label: 'Clients', icon: Truck, permission: 'canManageProjects' },
        ]
      },
      { 
        id: 'employees', 
        label: 'Employees', 
        icon: Users, 
        subItems: [
          { id: 'staff', label: 'Staff Directory', icon: Users, permission: 'canManageEmployees' },
          { id: 'ex-employees', label: 'Ex-Employees', icon: UserMinus, permission: 'canManageEmployees' },
        ]
      },
      { 
        id: 'attendance-payroll', 
        label: 'Attendance & Payroll', 
        icon: CreditCard, 
        subItems: [
          { id: 'timesheet', label: 'Monthly Timesheet', icon: Calendar, permission: 'canViewTimesheet' },
          { id: 'deductions', label: 'Deductions', icon: Wallet, permission: 'canManagePayroll' },
          { id: 'leave', label: 'Leave Management', icon: FileText, permission: 'canManageLeaves' },
          { id: 'payroll', label: 'Payroll Register', icon: DirhamIcon, permission: 'canViewPayroll' },
        ]
      },
      { 
        id: 'finance', 
        label: 'Finance', 
        icon: Wallet, 
        subItems: [
          { id: 'accounts-payable', label: 'Accounts Payable', icon: TrendingDown, permission: 'canManagePayroll' },
          { id: 'accounts-receivable', label: 'Accounts Receivable', icon: TrendingUp, permission: 'canManagePayroll' },
          { id: 'petty-cash', label: 'Petty Cash', icon: Wallet, permission: 'canManagePayroll' },
          { id: 'everyday-expenses', label: 'Everyday Expenses', icon: Wallet, permission: 'canManagePayroll' },
          { id: 'projected-expenses', label: 'Projected Expenses', icon: TrendingDown, permission: 'canManagePayroll' },
        ]
      },
      { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'canViewReports' },
      { id: 'about', label: 'About', icon: AlertCircle, creatorOnly: true },
    ];
    
    if (!systemUser) return baseItems.filter(item => !item.permission && !item.creatorOnly);
    
    const isCreator = systemUser.role === UserRole.CREATOR || systemUser.email === 'abdulkaderp3010@gmail.com';
    
    const filterItem = (item: any) => {
        if (item.creatorOnly && !isCreator) return false;
        if (isCreator) return true;
        if (item.permission && !(systemUser.permissions as any)[item.permission]) return false;
        return true;
    };

    return baseItems.map(item => {
        if (item.subItems) {
            const filteredSubItems = item.subItems.filter(filterItem);
            if (filteredSubItems.length === 0) return null;
            return { ...item, subItems: filteredSubItems };
        }
        return filterItem(item) ? item : null;
    }).filter(Boolean) as any[];
  }, [systemUser]);

  useEffect(() => {
    if (systemUser) {
      const isCreator = systemUser.role === UserRole.CREATOR || systemUser.email === 'abdulkaderp3010@gmail.com';
      const currentTabItem = navItems.find(item => item.id === activeTab);
      if (currentTabItem && currentTabItem.permission && !isCreator && !(systemUser.permissions as any)[currentTabItem.permission]) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, systemUser, navItems]);

  const handleOffboard = async (data: OffboardingDetails) => {
      if (showOffboarding) {
          await offboardEmployee(showOffboarding.id, data);
          handleLogAction('Employee Offboarded', `Employee ${showOffboarding.name} (${showOffboarding.code}) was offboarded. Reason: ${data.reason}`, 'delete');
          setShowOffboarding(null);
      }
  };

  const handleDeleteEmployee = async (e: Employee) => {
      openConfirm(
          "Delete Employee",
          `Are you sure you want to permanently delete ${e.name}? This action cannot be undone.`,
          async () => {
              try {
                  await deleteEmployee(e.id);
                  handleLogAction('Employee Deleted', `Employee ${e.name} (${e.code}) was permanently removed from the system.`, 'delete');
              } catch (err: any) {
                  alert(err.message || "Error deleting employee");
              }
          }
      );
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      const key = e.key.toLowerCase();
      
      // Onboard - Alt + B
      if (key === 'b') {
        e.preventDefault();
        setShowOnboarding(true);
      }

      // Shortcuts for selected employee
      const selectedEmp = employees.find(emp => emp.id === selectedEmployeeId);
      
      if (selectedEmp) {
        // Edit - Alt + E
        if (key === 'e') {
          e.preventDefault();
          setShowEdit(selectedEmp);
        }
        // Offboard - Alt + O
        if (key === 'o') {
          e.preventDefault();
          setShowOffboarding(selectedEmp);
        }
        // Delete - Alt + D
        if (key === 'd') {
          e.preventDefault();
          handleDeleteEmployee(selectedEmp);
        }
      }

      // Attendance Shortcuts
      if (['p', 'a', 'w', 's', 'l', 'u'].includes(key)) {
        e.preventDefault();
        let status: AttendanceStatus | null = null;
        switch (key) {
          case 'p': status = AttendanceStatus.PRESENT; break;
          case 'a': status = AttendanceStatus.ABSENT; break;
          case 'w': status = AttendanceStatus.WEEK_OFF; break;
          case 's': status = AttendanceStatus.SICK_LEAVE; break;
          case 'l': status = AttendanceStatus.ANNUAL_LEAVE; break;
          case 'u': status = AttendanceStatus.UNPAID_LEAVE; break;
        }

        if (status && selectedEmp) {
          logAttendance(selectedEmp.id, status, undefined, 0, undefined, systemUser?.name || 'System', `Shortcut: ${status}`);
          handleLogAction('Attendance Logged', `Attendance for ${selectedEmp.name} marked as ${status} via shortcut.`, 'update');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [selectedEmployeeId, employees, systemUser, handleDeleteEmployee]);

  const handleRejoinEmployee = (e: Employee) => {
      setShowRejoining(e);
  };

  const handleLogout = async () => {
    if (systemUser) {
        await logAudit(systemUser, 'User Logout', `User ${systemUser.name} logged out of the system.`, 'system');
    }
    await logout();
    setSystemUser(null);
    hasLoggedLogin.current = false;
  };

  const handleCreateCompany = async (companyData: any) => {
    try {
        await addCompany(companyData, companies.length);
        if (systemUser) {
            await logAudit(systemUser, 'Company Created', `New company ${companyData.name} (${companyData.code}) was registered.`, 'create');
        }
    } catch (error) {
        console.error("Failed to create company:", error);
        throw error;
    }
  };

  const handleUpdateCompany = async (company: Company) => {
    try {
        await updateCompany(company);
        if (systemUser) {
            await logAudit(systemUser, 'Company Updated', `Company ${company.name} was updated.`, 'update');
        }
    } catch (error) {
        console.error("Failed to update company:", error);
    }
  };

  const handleCreateSupplier = async (supplierData: any) => {
    try {
        await addSupplier(supplierData, suppliers.length);
        if (systemUser) {
            await logAudit(systemUser, 'Supplier Created', `New supplier ${supplierData.name} (${supplierData.code}) was registered.`, 'create');
        }
    } catch (error) {
        console.error("Failed to create supplier:", error);
        throw error;
    }
  };

  const handleUpdateSupplier = async (supplier: Supplier) => {
    try {
        await updateSupplier(supplier);
        if (systemUser) {
            await logAudit(systemUser, 'Supplier Updated', `Supplier ${supplier.name} was updated.`, 'update');
        }
    } catch (error) {
        console.error("Failed to update supplier:", error);
    }
  };

  const handleCreateProject = async (projectData: any) => {
    try {
        await addProject(projectData, projects.length);
        if (systemUser) {
            await logAudit(systemUser, 'Project Created', `New project ${projectData.name} (${projectData.code}) was registered.`, 'create');
        }
    } catch (error) {
        console.error("Failed to create project:", error);
        throw error;
    }
  };

  const handleUpdateProject = async (project: Project) => {
    try {
        await updateProject(project);
        if (systemUser) {
            await logAudit(systemUser, 'Project Updated', `Project ${project.name} was updated.`, 'update');
        }
    } catch (error) {
        console.error("Failed to update project:", error);
    }
  };

  const expiringDocs = useMemo(() => {
    const now = new Date();
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    
    const results: any[] = [];
    
    // Check employee documents
    employees.forEach(emp => {
        if (!emp.active) return;
        
        const docs = [
            { name: 'Emirates ID', date: emp.documents?.emiratesIdExpiry },
            { name: 'Passport', date: emp.documents?.passportExpiry },
            { name: 'Labour Card', date: emp.documents?.labourCardExpiry },
            { name: 'Visa', date: emp.documents?.visaExpiry }
        ];
        
        docs.forEach(doc => {
            if (doc.date) {
                const expiry = new Date(doc.date);
                if (expiry <= now) {
                    results.push({ employeeName: emp.name, docName: doc.name, status: 'Expired', date: doc.date, type: 'employee' });
                } else if (expiry <= tenDaysFromNow) {
                    results.push({ employeeName: emp.name, docName: doc.name, status: 'Expiring Soon', date: doc.date, type: 'employee' });
                }
            }
        });
    });

    // Check company documents
    companies.forEach(company => {
        company.driveFiles?.forEach(file => {
            if (file.expiryDate) {
                const expiry = new Date(file.expiryDate);
                if (expiry <= now) {
                    results.push({ employeeName: company.name, docName: file.name, status: 'Expired', date: file.expiryDate, type: 'company' });
                } else if (expiry <= tenDaysFromNow) {
                    results.push({ employeeName: company.name, docName: file.name, status: 'Expiring Soon', date: file.expiryDate, type: 'company' });
                }
            }
        });
    });

    return results;
  }, [employees, companies]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!systemUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 font-medium">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      navItems={navItems}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={systemUser}
      onLogout={handleLogout}
      companies={companies}
      expiringDocs={expiringDocs}
      employees={employees}
      projects={projects}
      suppliers={suppliers}
      vendors={vendors}
      accountsPayable={accountsPayable}
      accountsReceivable={accountsReceivable}
      pettyCash={pettyCash}
    >
      {activeTab === 'dashboard' && (
        <DashboardView 
          employees={employees} 
          suppliers={suppliers}
          vendors={vendors}
          projects={projects}
          attendance={attendance} 
          user={systemUser}
          auditLogs={auditLogs}
          setShowAuditModal={setShowAuditModal}
          onOpenUserManagement={() => setShowUserManagement(true)}
          onOpenManageCompanies={() => setShowManageCompanies(true)}
          onOpenOnboarding={() => setShowOnboarding(true)}
          onUpdate={() => {}}
          setActiveTab={setActiveTab}
        />
      )}
      {activeTab === 'company' && (
        <CompanyView 
          companies={companies} 
          openConfirm={openConfirm}
          onUpdate={handleUpdateCompany}
          onAdd={handleCreateCompany}
          user={systemUser!}
        />
      )}
      {activeTab === 'suppliers' && (
        <SupplierView 
          suppliers={suppliers} 
          openConfirm={openConfirm}
          onUpdate={handleUpdateSupplier}
          onAdd={handleCreateSupplier}
          user={systemUser!}
        />
      )}
      {activeTab === 'projects' && (
        <ProjectView 
          projects={projects} 
          openConfirm={openConfirm}
          onUpdate={handleUpdateProject}
          onAdd={handleCreateProject}
          user={systemUser!}
        />
      )}
      {activeTab === 'staff' && (
        <StaffDirectoryView 
          employees={employees.filter(e => e.active)} 
          companies={companies}
          onAdd={() => setShowOnboarding(true)} 
          onEdit={(e: Employee) => setShowEdit(e)} 
          onOffboard={(e: Employee) => setShowOffboarding(e)}
          onDelete={handleDeleteEmployee}
          user={systemUser}
          selectedId={selectedEmployeeId}
          onSelect={setSelectedEmployeeId}
        />
      )}
      {activeTab === 'ex-employees' && (
        <StaffDirectoryView 
          employees={employees.filter(e => !e.active)} 
          companies={companies}
          onEdit={(e: Employee) => setShowEdit(e)}
          onDelete={handleDeleteEmployee}
          onRejoin={handleRejoinEmployee}
          onViewOffboarding={(e: Employee) => setShowOffboardingDetails(e)}
          readOnly={true}
          user={systemUser}
          selectedId={selectedEmployeeId}
          onSelect={setSelectedEmployeeId}
        />
      )}
      {activeTab === 'timesheet' && (
        <TimesheetView 
            employees={employees.filter(e => e.active)} 
            attendance={attendance} 
            selectedMonth={selectedMonth} 
            onMonthChange={setSelectedMonth} 
            user={systemUser}
            onLogAttendance={logAttendance}
            onDeleteAttendance={deleteAttendanceRecord}
            openConfirm={openConfirm}
            companies={companies}
            selectedId={selectedEmployeeId}
            onSelect={setSelectedEmployeeId}
        />
      )}
      {activeTab === 'deductions' && (
        <DeductionsView employees={employees} deductions={deductions} openConfirm={openConfirm} user={systemUser} companies={companies} />
      )}
      {activeTab === 'leave' && (
        <LeaveManagementView 
            employees={employees} 
            leaveRequests={leaveRequests} 
            user={systemUser} 
            companies={companies} 
            openConfirm={openConfirm}
        />
      )}
      {activeTab === 'payroll' && (
        <PayrollRegisterView employees={employees.filter(e => e.active)} attendance={attendance} deductions={deductions} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} user={systemUser} companies={companies} />
      )}
      {activeTab === 'vendors' && (
        <VendorView 
          vendors={vendors} 
          onAdd={() => setShowVendorModal(true)} 
          onEdit={(v: Vendor) => setShowVendorModal(v)} 
          onDelete={handleDeleteVendor}
          user={systemUser}
        />
      )}
      {activeTab === 'accounts-payable' && (
        <AccountsPayableView 
          data={accountsPayable}
          vendors={vendors}
          suppliers={suppliers}
          projects={projects}
          onAdd={() => setShowAPModal(true)}
          onEdit={(ap: AccountsPayable) => setShowAPModal(ap)}
          onDelete={handleDeleteAP}
          user={systemUser}
        />
      )}
      {activeTab === 'accounts-receivable' && (
        <AccountsReceivableView 
          data={accountsReceivable}
          projects={projects}
          suppliers={suppliers}
          vendors={vendors}
          onAdd={() => setShowARModal(true)}
          onEdit={(ar: AccountsReceivable) => setShowARModal(ar)}
          onDelete={handleDeleteAR}
          user={systemUser}
        />
      )}
      {activeTab === 'petty-cash' && (
        <PettyCashView 
          data={pettyCash}
          projects={projects}
          onAdd={() => setShowPettyCashModal(true)}
          onEdit={(pc: PettyCash) => setShowPettyCashModal(pc)}
          onDelete={handleDeletePettyCash}
          user={systemUser}
        />
      )}
      {activeTab === 'projected-expenses' && (
        <ProjectedExpenseView 
          data={projectedExpenses}
          projects={projects}
          onAdd={() => setShowProjectedExpenseModal(true)}
          onEdit={(pe: ProjectedExpense) => setShowProjectedExpenseModal(pe)}
          onDelete={handleDeleteProjectedExpense}
          user={systemUser}
        />
      )}
      {activeTab === 'everyday-expenses' && (
        <EverydayExpenseView 
          data={everydayExpenses}
          projects={projects}
          onAdd={() => setShowEverydayExpenseModal(true)}
          onEdit={(ee: EverydayExpense) => setShowEverydayExpenseModal(ee)}
          onDelete={handleDeleteEverydayExpense}
          user={systemUser}
        />
      )}
      {activeTab === 'reports' && (
        <ReportsView 
          employees={employees} 
          attendance={attendance} 
          leaveRequests={leaveRequests}
          deductions={deductions}
          projects={projects}
          accountsPayable={accountsPayable}
          accountsReceivable={accountsReceivable}
          pettyCash={pettyCash}
          everydayExpenses={everydayExpenses}
          projectedExpenses={projectedExpenses}
          suppliers={suppliers}
          vendors={vendors}
          user={systemUser}
        />
      )}
      {activeTab === 'about' && (
        <AboutView />
      )}
      {activeTab === 'profile' && systemUser && (
        <ProfileView user={systemUser} onUpdate={handleUpdateProfile} />
      )}
      {activeTab === 'settings' && (
        <SettingsView 
          user={systemUser} 
          onPasswordReset={handlePasswordReset}
        />
      )}
      {activeTab === 'help' && (
        <HelpCenterView />
      )}

      {/* Modals */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard companies={companies} openConfirm={openConfirm} onComplete={async (d) => { 
            const fullData = { ...d, id: Math.random().toString(36).substr(2, 9) } as Employee;
            await saveEmployee(fullData); 
            handleLogAction('Employee Onboarded', `New employee ${fullData.name} (${fullData.code}) was added to the system.`, 'create');
            setShowOnboarding(false); 
          }} onCancel={() => setShowOnboarding(false)} />
        )}
        {showOffboarding && (
          <OffboardingWizard employee={showOffboarding} onComplete={handleOffboard} onCancel={() => setShowOffboarding(null)} />
        )}
        {showRejoining && (
          <RejoinModal 
            employee={showRejoining}
            onCancel={() => setShowRejoining(null)}
            onComplete={async (reason) => {
              try {
                await rehireEmployee(showRejoining.id, new Date().toISOString().split('T')[0], reason);
                await handleLogAction('Employee Rehired', `Employee ${showRejoining.name} (${showRejoining.code}) has rejoined the company.`, 'create');
                setShowRejoining(null);
              } catch (err: any) {
                alert(err.message || "Error rejoining employee");
              }
            }}
          />
        )}
        {showOffboardingDetails && (
          <OffboardingDetailsModal 
            employee={showOffboardingDetails}
            onCancel={() => setShowOffboardingDetails(null)}
          />
        )}
        {showEdit && (
          <EditEmployeeModal companies={companies} employee={showEdit} openConfirm={openConfirm} onSave={async (d) => { 
            await saveEmployee(d); 
            handleLogAction('Employee Updated', `Details for employee ${d.name} (${d.code}) were updated.`, 'update');
            setShowEdit(null); 
          }} onCancel={() => setShowEdit(null)} />
        )}
        {showUserManagement && (
          <UserManagementModal onClose={() => setShowUserManagement(false)} users={systemUsers} openConfirm={openConfirm} currentUser={systemUser} onLog={handleLogAction} />
        )}
        {showManageCompanies && (
          <ManageCompaniesModal 
            onClose={() => setShowManageCompanies(false)} 
            companies={companies} 
            openConfirm={openConfirm} 
            onLog={handleLogAction} 
            onAdd={handleCreateCompany}
            onUpdate={handleUpdateCompany}
          />
        )}
        {showVendorModal && (
          <VendorModal 
            vendor={typeof showVendorModal === 'object' ? showVendorModal : null}
            onSave={handleSaveVendor}
            onCancel={() => setShowVendorModal(false)}
          />
        )}
        {showAPModal && (
          <AccountsPayableModal 
            ap={typeof showAPModal === 'object' ? showAPModal : null}
            vendors={vendors}
            suppliers={suppliers}
            projects={projects}
            onSave={handleSaveAP}
            onCancel={() => setShowAPModal(false)}
          />
        )}
        {showARModal && (
          <AccountsReceivableModal 
            ar={typeof showARModal === 'object' ? showARModal : null}
            projects={projects}
            suppliers={suppliers}
            vendors={vendors}
            onSave={handleSaveAR}
            onCancel={() => setShowARModal(false)}
          />
        )}
        {showPettyCashModal && (
          <PettyCashModal 
            pettyCash={typeof showPettyCashModal === 'object' ? showPettyCashModal : null}
            projects={projects}
            onSave={handleSavePettyCash}
            onCancel={() => setShowPettyCashModal(false)}
          />
        )}
        {showProjectedExpenseModal && (
          <ProjectedExpenseModal 
            expense={typeof showProjectedExpenseModal === 'object' ? showProjectedExpenseModal : null}
            projects={projects}
            onSave={handleSaveProjectedExpense}
            onCancel={() => setShowProjectedExpenseModal(false)}
          />
        )}
        {showEverydayExpenseModal && (
          <EverydayExpenseModal 
            expense={typeof showEverydayExpenseModal === 'object' ? showEverydayExpenseModal : null}
            projects={projects}
            onSave={handleSaveEverydayExpense}
            onCancel={() => setShowEverydayExpenseModal(false)}
          />
        )}
        {showAuditModal && (
          <AuditLogModal 
            isOpen={showAuditModal} 
            onClose={() => setShowAuditModal(false)} 
            logs={auditLogs} 
            currentUser={systemUser} 
            openConfirm={openConfirm}
          />
        )}
        {showBulkImport && (
          <BulkImportModal onClose={() => setShowBulkImport(false)} onImport={(data) => {
            data.forEach(async item => {
              const newEmp: Employee = {
                id: Math.random().toString(36).substr(2, 9),
                code: String(item.Code || item.code || ''),
                name: String(item.Name || item.name || ''),
                company: String(item.Company || item.company || (companies[0] || 'Default')),
                team: 'Internal Team',
                designation: String(item.Designation || item.designation || 'Helper'),
                department: String(item.Department || item.department || 'Operations'),
                type: StaffType.WORKER,
                status: 'Active',
                active: true,
                joiningDate: new Date().toISOString().split('T')[0],
                workLocation: 'Dubai',
                leaveBalance: 30,
                salary: { basic: 0, housing: 0, transport: 0, other: 0, airTicket: 0, leaveSalary: 0, hourlyRate: 0 }
              };
              await saveEmployee(newEmp);
            });
            setShowBulkImport(false);
          }} />
        )}
      </AnimatePresence>
      
      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({...confirmModal, isOpen: false})} {...confirmModal} />
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </Layout>
  );
}

// --- Dashboard View ---

const DashboardView = ({ employees, suppliers, vendors, projects, attendance, user, auditLogs, setShowAuditModal, onOpenUserManagement, onOpenManageCompanies, onOpenOnboarding, onUpdate, setActiveTab }: any) => {
    const [showQuickAdminMenu, setShowQuickAdminMenu] = useState(false);
    
    // Stats Calculation
    const activeStaff = employees.filter((e:any) => e.active);
    const exEmployees = employees.filter((e:any) => !e.active).length;
    const officeStaff = activeStaff.filter((e:any) => e.team === 'Office Staff' || e.type === StaffType.OFFICE).length;
    const otherEmployees = activeStaff.length - officeStaff;
    const activeProjects = projects.filter((p: any) => p.status === 'Active').length;

    const canManageUsers = user?.permissions?.canManageUsers;
    const canManageSettings = user?.permissions?.canManageSettings;
    const canManageEmployees = user?.permissions?.canManageEmployees;
    const canManageAttendance = user?.permissions?.canManageAttendance;
    const canManagePayroll = user?.permissions?.canManagePayroll;
    
    // Chart Data: Staff by Department
    const deptStats = useMemo(() => {
        const counts: Record<string, number> = {};
        activeStaff.forEach((e:any) => {
            counts[e.department] = (counts[e.department] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [activeStaff]);

    // Chart Data: Monthly Growth (Mocked for visual impact)
    const growthData = [
        { month: 'Oct', count: activeStaff.length - 15 },
        { month: 'Nov', count: activeStaff.length - 12 },
        { month: 'Dec', count: activeStaff.length - 8 },
        { month: 'Jan', count: activeStaff.length - 5 },
        { month: 'Feb', count: activeStaff.length - 2 },
        { month: 'Mar', count: activeStaff.length },
    ];

    const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'];

    const handleExport = () => {
        const data = employees.map((e: any) => ({
            'Code': e.code,
            'Name': e.name,
            'Company': e.company,
            'Department': e.department,
            'Designation': e.designation,
            'Status': e.status,
            'Joining Date': e.joiningDate
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        XLSX.writeFile(wb, "Pioneer_Personnel_Data.xlsx");
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                {user.role === UserRole.CREATOR && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-[0.2em]">
                            <Activity className="w-4 h-4" />
                            System Intelligence
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
                        <p className="text-slate-500 font-medium max-w-xl">
                            Welcome back, <span className="text-slate-900 font-bold">{user.name}</span>. 
                            The system is currently monitoring <span className="text-brand-600 font-bold">{activeStaff.length} active personnel</span> across {Object.keys(deptStats).length} departments.
                        </p>
                    </div>
                )}
                {user.role !== UserRole.CREATOR && <div className="flex-1"></div>}
                
                <div className="flex flex-wrap items-center gap-3">
                    {(user.role === UserRole.CREATOR || user.role === UserRole.ADMIN || user.role === UserRole.HR) && (
                        <button 
                            onClick={onOpenOnboarding}
                            className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                        >
                            <UserPlus className="w-4 h-4" /> Onboard Staff
                        </button>
                    )}
                    {(user.role === UserRole.CREATOR || user.role === UserRole.ADMIN || canManageSettings) && (
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                            <button onClick={onOpenManageCompanies} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-all" title="Manage Companies">
                                <Building2 className="w-5 h-5" />
                            </button>
                            <div className="w-px h-4 bg-slate-200"></div>
                            <button onClick={onOpenUserManagement} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-all" title="System Users">
                                <UserCog className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-10 gap-6">
                {/* Stat Cards */}
                <BentoStatCard 
                    title="Current Active Employees" 
                    value={activeStaff.length} 
                    trend="+12.5%" 
                    isUp={true}
                    icon={Users} 
                    color="brand"
                    className="lg:col-span-2"
                />
                <BentoStatCard 
                    title="Clients" 
                    value={vendors.length} 
                    trend="+1.2%" 
                    isUp={true}
                    icon={Globe} 
                    color="brand"
                    className="lg:col-span-2"
                />
                <BentoStatCard 
                    title="Suppliers" 
                    value={suppliers.length} 
                    trend="+4.2%" 
                    isUp={true}
                    icon={Truck} 
                    color="indigo"
                    className="lg:col-span-2"
                />
                <BentoStatCard 
                    title="Active Projects" 
                    value={activeProjects} 
                    trend="+2.5%" 
                    isUp={true}
                    icon={Briefcase} 
                    color="orange"
                    className="lg:col-span-2"
                />
                <BentoStatCard 
                    title="Ex Employees" 
                    value={exEmployees} 
                    trend="+8.0%" 
                    isUp={true}
                    icon={UserMinus} 
                    color="emerald"
                    className="lg:col-span-2"
                />

                {/* Recent Activity Log */}
                <div className="md:col-span-2 lg:col-span-5 bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-2xl">
                                <Activity className="w-5 h-5 text-brand-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">System Activity</h3>
                        </div>
                        <button 
                            onClick={() => setShowAuditModal(true)}
                            className="text-xs font-bold text-brand-600 hover:underline"
                        >
                            View Audit Log
                        </button>
                    </div>
                    
                    <div className="space-y-6 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                        {auditLogs.length > 0 ? (
                            auditLogs.slice(0, 5).map((log) => (
                                <ActivityItem 
                                    key={log.id}
                                    icon={log.type === 'create' ? UserPlus : log.type === 'delete' ? UserMinus : log.type === 'update' ? Edit : Activity} 
                                    title={log.action} 
                                    desc={log.details} 
                                    time={new Date(log.timestamp).toLocaleString()} 
                                    color={log.type === 'create' ? 'emerald' : log.type === 'delete' ? 'red' : log.type === 'update' ? 'brand' : 'indigo'}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                                <Activity className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm font-bold">No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions & Access */}
                <div className="md:col-span-2 lg:col-span-5 bg-white rounded-[2.5rem] p-8 text-slate-900 border border-slate-200 flex flex-col relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mb-20 transition-transform duration-700 group-hover:scale-110"></div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black tracking-tight">Quick Operations</h3>
                            <div className="relative">
                                <button 
                                    onClick={() => (user.role === UserRole.CREATOR || canManageUsers || canManageSettings) && setShowQuickAdminMenu(!showQuickAdminMenu)}
                                    className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                                {showQuickAdminMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowQuickAdminMenu(false)}></div>
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-20 text-slate-900">
                                            {(user.role === UserRole.CREATOR || canManageUsers) && (
                                                <button 
                                                    onClick={() => { onOpenUserManagement(); setShowQuickAdminMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-brand-600 transition-all"
                                                >
                                                    <UserCog className="w-4 h-4" /> System User Management
                                                </button>
                                            )}
                                            {(user.role === UserRole.CREATOR || canManageSettings) && (
                                                <button 
                                                    onClick={() => { onOpenManageCompanies(); setShowQuickAdminMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-brand-600 transition-all"
                                                >
                                                    <Building2 className="w-4 h-4" /> Manage Companies
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 flex-1">
                            <QuickActionButton icon={Download} label="Export Data" onClick={handleExport} />
                            <QuickActionButton icon={ListFilter} label="Smart Filter" onClick={() => setActiveTab('staff')} />
                            <QuickActionButton icon={Settings} label="Preferences" onClick={() => onOpenUserManagement()} />
                        </div>

                        <div className="mt-8 p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-600 font-bold">
                                    {user.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold">{user.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Session</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

// --- Profile View ---
const ProfileView = ({ user, onUpdate }: { user: SystemUser, onUpdate: (updated: SystemUser) => Promise<void> }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: user.name,
        username: user.username || '',
        photoURL: user.photoURL || ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate({
                ...user,
                name: formData.name,
                username: formData.username,
                photoURL: formData.photoURL
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const roleDisplay = user.email === 'abdulkaderp3010@gmail.com' ? 'CREATOR' : user.role.toUpperCase();

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-32 bg-brand-600"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center text-4xl font-black text-brand-600 shadow-xl border-4 border-white mb-4 overflow-hidden">
                            {formData.photoURL ? (
                                <img src={formData.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                user.name.charAt(0)
                            )}
                        </div>
                        {isEditing && (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Camera className="w-8 h-8 text-white" />
                            </button>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>

                    {isEditing ? (
                        <div className="w-full max-w-xs space-y-4 text-center">
                            <input 
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full text-2xl font-black text-slate-900 text-center bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500"
                                placeholder="Your Name"
                            />
                            <p className="text-brand-600 font-bold uppercase tracking-widest text-xs">{roleDisplay}</p>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-black text-slate-900">{user.name}</h2>
                            <p className="text-brand-600 font-bold uppercase tracking-widest text-xs mt-1">{roleDisplay}</p>
                        </>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-12">
                        <div className="p-6 bg-white rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</p>
                            <p className="text-sm font-bold text-slate-900">{user.email}</p>
                        </div>
                        <div className="p-6 bg-white rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Username</p>
                            {isEditing ? (
                                <input 
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full text-sm font-bold text-slate-900 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-brand-500"
                                    placeholder="Username"
                                />
                            ) : (
                                <p className="text-sm font-bold text-slate-900">{user.username || 'Not set'}</p>
                            )}
                        </div>
                        <div className="p-6 bg-white rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Account Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <p className="text-sm font-bold text-slate-900">{user.active ? 'Active' : 'Inactive'}</p>
                            </div>
                        </div>
                        <div className="p-6 bg-white rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">User ID</p>
                            <p className="text-xs font-mono text-slate-500">{user.uid}</p>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className="px-6 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2"
                                >
                                    {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                            >
                                <Edit className="w-4 h-4" /> Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-6">Your Permissions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(user.permissions).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                            {value ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                            <span className="text-xs font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Settings View ---
const SettingsView = ({ user, onPasswordReset }: { 
    user: SystemUser, 
    onPasswordReset: () => void 
}) => {
    const canManageSettings = user?.permissions?.canManageSettings;
    
    if (!canManageSettings && user.role !== UserRole.CREATOR) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                <p className="text-slate-500 max-w-md">
                    You do not have permission to access system settings. Please contact your administrator if you believe this is an error.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-brand-600 rounded-[1.5rem] shadow-lg shadow-brand-600/20">
                    <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h2>
                    <p className="text-slate-500 font-medium">Manage your system preferences and security</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-6">Security</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Change Password</p>
                                <p className="text-xs text-slate-500">Update your account password regularly</p>
                            </div>
                            <button 
                                onClick={onPasswordReset}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-brand-600 hover:bg-slate-50 transition-all"
                            >
                                Update
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Two-Factor Authentication</p>
                                <p className="text-xs text-slate-500">Add an extra layer of security to your account</p>
                            </div>
                            <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-6">System Preferences</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Email Notifications</p>
                                <p className="text-xs text-slate-500">Receive system alerts via email</p>
                            </div>
                            <div className="w-12 h-6 bg-brand-600 rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Help Center View ---
const HelpCenterView = () => {
    const instructions = [
        { title: 'Managing Employees', content: 'To add a new employee, go to the Dashboard and click "Onboard Staff". Fill in the personal, work, and financial details across the 4 steps.' },
        { title: 'Attendance Tracking', content: 'Use the Monthly Timesheet tab to log daily attendance. You can mark status (P, A, W, etc.) and add overtime hours.' },
        { title: 'Payroll Generation', content: 'The Payroll Register automatically calculates salaries based on basic pay and attendance records. You can export the register for processing.' },
        { title: 'Document Expiry', content: 'Check the notifications bell to see documents (Passport, Visa, EID) that are expiring soon. The system alerts you 30 days in advance.' },
        { title: 'System Audits', content: 'Every action is logged in the System Activity section. Creators can view full logs of all user actions.' }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-brand-50 rounded-2xl">
                    <HelpCircle className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Help Center</h2>
                    <p className="text-slate-500 font-medium">Instructions and guides for Pioneer DMS Portal</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {instructions.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm">
                        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center text-sm">{idx + 1}</span>
                            {item.title}
                        </h3>
                        <p className="text-slate-600 leading-relaxed font-medium pl-11">
                            {item.content}
                        </p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 text-slate-900 border border-slate-200 text-center">
                <h3 className="text-2xl font-black mb-4">Need more help?</h3>
                <p className="text-slate-600 font-medium mb-8">Our support team is available 24/7 for technical assistance.</p>
                <button className="px-8 py-4 bg-white text-brand-600 rounded-2xl font-black hover:bg-slate-50 transition-all shadow-xl shadow-brand-900/20">
                    Contact Support Team
                </button>
            </div>
        </div>
    );
};

const BentoStatCard = ({ title, value, trend, isUp, icon: Icon, color, className }: any) => {
    const colors: any = {
        brand: "bg-brand-50 text-brand-600 border-brand-100 shadow-brand-500/5",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/5",
        orange: "bg-orange-50 text-orange-600 border-orange-100 shadow-orange-500/5",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-500/5",
    };

    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className={cn(
                "bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col justify-between min-h-[200px] transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 group",
                className
            )}
        >
            <div className="flex justify-between items-start">
                <div className={cn("p-3.5 rounded-2xl transition-all duration-500 group-hover:rotate-6", colors[color])}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div>
                <span className="text-4xl font-black text-slate-900 tracking-tighter">{value}</span>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{title}</p>
            </div>
        </motion.div>
    );
};

const ActivityItem = ({ icon: Icon, title, desc, time, color }: any) => {
    const colors: any = {
        brand: "bg-brand-50 text-brand-600",
        emerald: "bg-emerald-50 text-emerald-600",
        orange: "bg-orange-50 text-orange-600",
        indigo: "bg-indigo-50 text-indigo-600",
    };

    return (
        <div className="flex items-start gap-4 group cursor-pointer">
            <div className={cn("p-3 rounded-2xl transition-all group-hover:scale-110", colors[color])}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{title}</h4>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap uppercase tracking-widest">{time}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors self-center" />
        </div>
    );
};

const QuickActionButton = ({ icon: Icon, label, onClick }: any) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-3 p-4 bg-white/10 hover:bg-white/20 rounded-3xl border border-white/10 transition-all duration-300 group"
    >
        <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
);

const DashboardStatCard = ({ title, value, icon: Icon, color, index }: any) => {
    const colors: any = {
        brand: "bg-brand-50 text-brand-600 border-brand-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        orange: "bg-orange-50 text-orange-600 border-orange-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        red: "bg-red-50 text-red-600 border-red-100"
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-6 rounded-3xl flex flex-col justify-between min-h-[160px] hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group"
        >
            <div className="flex justify-between items-start">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">{title}</span>
                <div className={cn("p-2.5 rounded-2xl transition-transform duration-300 group-hover:scale-110", colors[color])}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="mt-4">
                <span className="text-4xl font-bold text-slate-900 tracking-tight">{value}</span>
                <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">+12%</span>
                    <span className="text-[10px] text-slate-400 font-medium">from last month</span>
                </div>
            </div>
        </motion.div>
    );
};

// --- Sub Views ---

const StaffDirectoryView = ({ employees, companies: companyList, onAdd, onEdit, onOffboard, onDelete, onRejoin, onViewOffboarding, readOnly, user, selectedId, onSelect }: { 
    employees: Employee[], 
    companies: Company[],
    onAdd?: () => void, 
    onEdit: (e: Employee) => void, 
    onOffboard?: (e: Employee) => void, 
    onDelete?: (e: Employee) => void, 
    onRejoin?: (e: Employee) => void, 
    onViewOffboarding?: (e: Employee) => void,
    readOnly?: boolean, 
    user: SystemUser | null,
    selectedId?: string | null,
    onSelect?: (id: string | null) => void
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState('All');
    const [deptFilter, setDeptFilter] = useState('All');
    const [viewRejoinReason, setViewRejoinReason] = useState<Employee | null>(null);
    const canManageEmployees = user?.permissions?.canManageEmployees;

    const calculateExperience = (joiningDate: string, exitDate?: string) => {
        if (!joiningDate) return 'N/A';
        const start = new Date(joiningDate);
        const end = exitDate ? new Date(exitDate) : new Date();
        
        if (isNaN(start.getTime())) return 'N/A';
        
        let years = end.getFullYear() - start.getFullYear();
        let months = end.getMonth() - start.getMonth();
        
        if (months < 0 || (months === 0 && end.getDate() < start.getDate())) {
            years--;
            months += 12;
        }
        
        if (years <= 0 && months <= 0) return '0 Months';
        if (years === 0) return `${months} ${months === 1 ? 'Month' : 'Months'}`;
        return `${years} ${years === 1 ? 'Year' : 'Years'}${months > 0 ? ` ${months} ${months === 1 ? 'Month' : 'Months'}` : ''}`;
    };

    const companies = useMemo<string[]>(() => ['All', ...Array.from(new Set(employees.map(e => e.company).filter(c => c && c !== 'All')))], [employees]);
    const departments = useMemo<string[]>(() => ['All', ...Array.from(new Set(employees.map(e => e.department).filter(d => d && d !== 'All')))], [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter((e: Employee) => {
            const company = companyList.find(c => c.name === e.company);
            const matchesSearch = (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                                (e.code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                                (company?.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesCompany = companyFilter === 'All' || e.company === companyFilter;
            const matchesDept = deptFilter === 'All' || e.department === deptFilter;
            return matchesSearch && matchesCompany && matchesDept;
        });
    }, [employees, searchTerm, companyFilter, deptFilter, companyList]);

    return (
        <div className="space-y-6">
            {/* Advanced Filter Bar */}
            <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40 flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search personnel by name or ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-sm w-full outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium"
                    />
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <select 
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="flex-1 lg:flex-none px-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none cursor-pointer min-w-[140px]"
                    >
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select 
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="flex-1 lg:flex-none px-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none cursor-pointer min-w-[140px]"
                    >
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    {!readOnly && canManageEmployees && (
                        <button 
                            onClick={onAdd} 
                            className="flex-1 lg:flex-none bg-brand-600 text-white px-8 py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-brand-700 shadow-xl shadow-brand-500/20 transition-all active:scale-95"
                        >
                            <UserPlus className="w-4 h-4" /> Add Staff
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden border border-white shadow-2xl shadow-slate-200/60">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Personnel Details</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Department & Role</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Organization</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Experience</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence mode="popLayout">
                                {filteredEmployees.map((e: Employee, index: number) => (
                                    <motion.tr 
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        key={e.id || `staff-${index}`} 
                                        onClick={() => onSelect?.(selectedId === e.id ? null : e.id)}
                                        className={cn(
                                            "hover:bg-brand-50/20 transition-colors group cursor-pointer",
                                            selectedId === e.id ? "bg-brand-50/50 border-l-4 border-brand-600" : ""
                                        )}
                                    >
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-black border border-slate-200 group-hover:bg-white group-hover:border-brand-200 group-hover:text-brand-600 transition-all duration-300 overflow-hidden">
                                                    {e.profileImage ? (
                                                        <img src={e.profileImage} alt={e.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        e.name.charAt(0)
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 text-base">{e.name}</div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.code}</div>
                                                        {e.mobileNumber && (
                                                            <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1">
                                                                <Phone className="w-2.5 h-2.5" /> {e.mobileNumber}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="text-sm font-black text-slate-700">{e.designation}</div>
                                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{e.team}</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/60 w-fit">
                                                    {e.company}
                                                </span>
                                                {companyList.find(c => c.name === e.company)?.code && (
                                                    <span className="text-[9px] font-black text-brand-600 mt-1 ml-1 uppercase tracking-wider">
                                                        Code: {companyList.find(c => c.name === e.company)?.code}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full animate-pulse",
                                                    e.active ? "bg-emerald-500" : "bg-red-500"
                                                )}></div>
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest",
                                                    e.active ? 'text-emerald-600' : 'text-red-600'
                                                )}>
                                                    {e.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="text-xs font-black text-slate-600">
                                                {calculateExperience(e.joiningDate, e.offboardingDetails?.exitDate)}
                                            </div>
                                            {!e.active && e.offboardingDetails?.exitDate && (
                                                <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                                                    Until: {e.offboardingDetails.exitDate}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex justify-end gap-2">
                                                {e.active && e.rejoiningReason && (
                                                    <button 
                                                        onClick={() => setViewRejoinReason(e)} 
                                                        className="p-2.5 hover:bg-white hover:shadow-lg text-brand-600 rounded-xl transition-all border border-transparent hover:border-brand-100 active:scale-90"
                                                        title="View Rejoin Reason"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canManageEmployees && (
                                                    <button 
                                                        onClick={() => onEdit(e)} 
                                                        className="p-2.5 hover:bg-white hover:shadow-lg text-brand-600 rounded-xl transition-all border border-transparent hover:border-brand-100 active:scale-90"
                                                        title="Edit Record"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {e.active ? (
                                                    !readOnly && canManageEmployees && (
                                                        <button 
                                                            onClick={() => onOffboard(e)} 
                                                            className="p-2.5 hover:bg-white hover:shadow-lg text-red-600 rounded-xl transition-all border border-transparent hover:border-red-100 active:scale-90"
                                                            title="Offboard"
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                        </button>
                                                    )
                                                ) : (
                                                    <div className="flex gap-2">
                                                        {e.offboardingDetails && (
                                                            <button 
                                                                onClick={() => onViewOffboarding?.(e)} 
                                                                className="p-2.5 hover:bg-white hover:shadow-lg text-brand-600 rounded-xl transition-all border border-transparent hover:border-brand-100 active:scale-90"
                                                                title="View Offboarding Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canManageEmployees && (
                                                            <button 
                                                                onClick={() => onRejoin?.(e)} 
                                                                className="p-2.5 hover:bg-white hover:shadow-lg text-emerald-600 rounded-xl transition-all border border-transparent hover:border-emerald-100 active:scale-90"
                                                                title="Rejoin"
                                                            >
                                                                <UserPlus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                {canManageEmployees && (
                                                    <button 
                                                        onClick={() => onDelete?.(e)} 
                                                        className="p-2.5 hover:bg-white hover:shadow-lg text-slate-400 hover:text-red-600 rounded-xl transition-all border border-transparent hover:border-slate-100 active:scale-90"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
                {filteredEmployees.length === 0 && (
                    <div className="p-32 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
                            <Users className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">No personnel found</h3>
                        <p className="text-slate-400 font-medium max-w-xs mx-auto mt-2">We couldn't find any records matching your current search or filter criteria.</p>
                        <button 
                            onClick={() => { setSearchTerm(''); setCompanyFilter('All'); setDeptFilter('All'); }}
                            className="mt-6 text-sm font-black text-brand-600 hover:underline"
                        >
                            Reset all filters
                        </button>
                    </div>
                )}
            </div>

            {/* Rejoin Reason Modal */}
            <AnimatePresence>
                {viewRejoinReason && (
                    <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setViewRejoinReason(null)}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-white flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600">
                                        <Eye className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Rejoin Details</h2>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Employee: {viewRejoinReason.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewRejoinReason(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Rejoining Date</label>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-black text-slate-900">
                                        {viewRejoinReason.rejoiningDate || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Reason for Rejoining</label>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-medium text-slate-600 leading-relaxed italic">
                                        "{viewRejoinReason.rejoiningReason}"
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                                <button 
                                    onClick={() => setViewRejoinReason(null)}
                                    className="w-full py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black hover:opacity-90 transition-all shadow-xl"
                                >
                                    Close Details
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SupplierDocumentsModal = ({ supplier, onClose, onUpdate, openConfirm }: { supplier: Supplier, onClose: () => void, onUpdate: (s: Supplier) => void, openConfirm: any }) => {
    return (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                            {supplier.logo ? (
                                <img src={supplier.logo} alt={supplier.name} className="max-h-full max-w-full object-contain" />
                            ) : (
                                <Truck className="w-8 h-8 text-slate-300" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">{supplier.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-brand-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">{supplier.code}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Linked Documents</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all active:scale-90 shadow-sm">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto">
                    <GoogleDriveManager 
                        files={supplier.driveFiles || []}
                        onAddFile={(file) => {
                            const updated = { ...supplier, driveFiles: [...(supplier.driveFiles || []), file] };
                            onUpdate(updated);
                        }}
                        onRemoveFile={(fileId) => {
                            const updated = { ...supplier, driveFiles: (supplier.driveFiles || []).filter(f => f.id !== fileId) };
                            onUpdate(updated);
                        }}
                        onUpdateFile={(updatedFile) => {
                            const updated = { 
                                ...supplier, 
                                driveFiles: (supplier.driveFiles || []).map(f => f.id === updatedFile.id ? updatedFile : f) 
                            };
                            onUpdate(updated);
                        }}
                        openConfirm={openConfirm}
                        title={`${supplier.name} Documents`}
                    />
                </div>
            </motion.div>
        </div>
    );
};

const SupplierView = ({ suppliers, openConfirm, onUpdate, onAdd, user }: { suppliers: Supplier[], openConfirm: any, onUpdate: (s: Supplier) => void, onAdd: (s: any) => Promise<void>, user: SystemUser }) => {
    const [formData, setFormData] = useState({ code: '', name: '', contactPerson: '', address: '', email: '', phone: '', category: '', notes: '', logo: '' });
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReordering, setIsReordering] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewingDocsSupplier, setViewingDocsSupplier] = useState<Supplier | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const canManageSuppliers = user?.permissions?.canManageSuppliers || user?.role === UserRole.CREATOR || user?.email === 'abdulkaderp3010@gmail.com';

    const sortedSuppliers = useMemo(() => {
        return [...suppliers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [suppliers]);

    const filteredSuppliers = useMemo(() => {
        if (!searchTerm.trim()) return sortedSuppliers;
        const query = searchTerm.toLowerCase();
        return sortedSuppliers.filter(supplier => {
            const matchesName = (supplier.name?.toLowerCase() || '').includes(query);
            const matchesCode = (supplier.code?.toLowerCase() || '').includes(query);
            const matchesContact = (supplier.contactPerson?.toLowerCase() || '').includes(query);
            const matchesDocuments = supplier.driveFiles?.some(file => 
                (file.name?.toLowerCase() || '').includes(query)
            );
            return matchesName || matchesCode || matchesContact || matchesDocuments;
        });
    }, [sortedSuppliers, searchTerm]);

    const getExpiryStatus = (supplier: Supplier) => {
        const files = supplier.driveFiles || [];
        const today = new Date();
        let expired = 0;
        let warning = 0;

        files.forEach(file => {
            if (file.expiryDate) {
                const expiry = new Date(file.expiryDate);
                const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) expired++;
                else if (diffDays <= 10) warning++;
            }
        });

        if (expired > 0) return { label: `${expired} Expired`, color: 'bg-red-100 text-red-600 border-red-200' };
        if (warning > 0) return { label: `${warning} Expiring Soon`, color: 'bg-orange-100 text-orange-600 border-orange-200' };
        return null;
    };

    const handleAdd = async () => {
        if (!formData.name.trim() || !formData.code.trim()) {
            setError("Supplier name and code are required.");
            return;
        }
        
        setIsSaving(true);
        setError(null);
        try {
            await onAdd(formData);
            setFormData({ code: '', name: '', contactPerson: '', address: '', email: '', phone: '', category: '', notes: '', logo: '' });
            setIsAdding(false);
        } catch (err: any) {
            setError("Failed to save supplier. Please check your connection and permissions.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReorder = async (newOrder: Supplier[]) => {
        await reorderSuppliers(newOrder);
    };

    const handleUpdate = async (supplier: Supplier) => {
        await updateSupplier(supplier);
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        openConfirm(
            "Delete Supplier",
            "Are you sure you want to delete this supplier? This action cannot be undone.",
            async () => {
                await deleteSupplier(id);
            }
        );
    };

    const handleLogoUpload = async (supplier: Supplier | null, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const base64 = evt.target?.result as string;
            if (supplier) {
                await updateSupplier({ ...supplier, logo: base64 });
            } else {
                setFormData(prev => ({ ...prev, logo: base64 }));
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-[0.2em]">
                        <Truck className="w-4 h-4" />
                        Supply Chain Management
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Supplier Directory</h1>
                    <p className="text-slate-500 font-medium max-w-xl">
                        Manage your vendors, service providers, and material suppliers.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search suppliers or documents..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {canManageSuppliers && (
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setIsReordering(true)}
                                className="flex-1 sm:flex-none bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                                <GripVertical className="w-4 h-4" /> Reorder
                            </button>
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                            >
                                <Plus className="w-4 h-4" /> Add Supplier
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isAdding && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] p-8 border border-brand-100 shadow-2xl shadow-brand-600/5"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-brand-50 rounded-2xl">
                            <Truck className="w-6 h-6 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Register New Supplier</h2>
                            <p className="text-slate-400 text-sm font-bold">Enter the details of your new business partner</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier Code</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="e.g. SUP-001"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier Name</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="Company Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="Name of Contact"
                                value={formData.contactPerson}
                                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="vendor@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="+971 ..."
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="e.g. Materials, Logistics"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="Full business address"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes / Remarks</label>
                            <textarea 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[100px]"
                                placeholder="Additional notes or remarks about this supplier..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => handleLogoUpload(null, e)}
                                />
                                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 group-hover:bg-slate-50 transition-all">
                                    <Globe className="w-4 h-4" /> Upload Logo
                                </div>
                            </div>
                            {formData.logo && (
                                <div className="h-10 w-10 rounded-xl border border-slate-100 p-1 bg-white shadow-sm">
                                    <img src={formData.logo} alt="Preview" className="h-full w-full object-contain" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsAdding(false)} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:text-slate-700">Cancel</button>
                            <button onClick={handleAdd} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-black text-sm shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition-all active:scale-95">Create Supplier</button>
                        </div>
                    </div>
                </motion.div>
            )}

            <Reorder.Group 
                axis="y" 
                values={sortedSuppliers} 
                onReorder={handleReorder}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {filteredSuppliers.map((supplier) => (
                    <Reorder.Item 
                        value={supplier}
                        key={supplier.id}
                        dragListener={!searchTerm && canManageSuppliers}
                        className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/20 transition-all group relative overflow-hidden cursor-default"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-brand-50/50"></div>
                        
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    {!searchTerm && canManageSuppliers && (
                                        <div className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-slate-500 transition-colors">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="h-16 w-16 bg-slate-50 rounded-2xl p-2 border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden">
                                        {supplier.logo ? (
                                            <img src={supplier.logo} alt={supplier.name} className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <Truck className="w-8 h-8 text-slate-300" />
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    {canManageSuppliers && (
                                        <>
                                            <button 
                                                onClick={() => setEditingId(supplier.id)}
                                                className="p-2 hover:bg-brand-50 text-brand-600 rounded-xl transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(supplier.id)}
                                                className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {editingId === supplier.id ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Supplier Code"
                                        value={supplier.code || ''}
                                        onChange={e => updateSupplier({ ...supplier, code: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        value={supplier.name || ''}
                                        onChange={e => updateSupplier({ ...supplier, name: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Contact Person"
                                        value={supplier.contactPerson || ''}
                                        onChange={e => updateSupplier({ ...supplier, contactPerson: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        value={supplier.email || ''}
                                        onChange={e => updateSupplier({ ...supplier, email: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Contact Number"
                                        value={supplier.phone || ''}
                                        onChange={e => updateSupplier({ ...supplier, phone: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Category"
                                        value={supplier.category || ''}
                                        onChange={e => updateSupplier({ ...supplier, category: e.target.value })}
                                    />
                                    <textarea 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
                                        placeholder="Notes / Remarks"
                                        value={supplier.notes || ''}
                                        onChange={e => updateSupplier({ ...supplier, notes: e.target.value })}
                                    />
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                                        <button onClick={() => handleUpdate(supplier)} className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold shadow-md shadow-brand-600/20">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black bg-brand-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">{supplier.code}</span>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{supplier.name}</h3>
                                        {getExpiryStatus(supplier) && (
                                            <span className={cn("ml-auto text-[8px] font-black uppercase px-2 py-0.5 rounded-full border", getExpiryStatus(supplier)?.color)}>
                                                {getExpiryStatus(supplier)?.label}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3 mt-auto">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <UserPlus className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{supplier.contactPerson || 'No contact person'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <FileText className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{supplier.email || 'No email provided'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{supplier.phone || 'No contact provided'}</span>
                                        </div>
                                        {supplier.notes && (
                                            <div className="flex items-start gap-3 text-slate-500">
                                                <div className="p-1.5 bg-slate-50 rounded-lg mt-0.5">
                                                    <StickyNote className="w-3.5 h-3.5" />
                                                </div>
                                                <p className="text-[11px] font-medium line-clamp-2 italic text-slate-400 leading-relaxed">
                                                    {supplier.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-2">
                                                {(supplier.driveFiles || []).slice(0, 3).map(file => (
                                                    <div key={file.id} className="w-8 h-8 rounded-lg border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                        {file.iconLink ? (
                                                            <img src={file.iconLink} alt="" className="w-4 h-4" />
                                                        ) : (
                                                            <FileText className="w-4 h-4 text-slate-400" />
                                                        )}
                                                    </div>
                                                ))}
                                                {(supplier.driveFiles || []).length > 3 && (
                                                    <div className="w-8 h-8 rounded-lg border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm">
                                                        <span className="text-[10px] font-bold text-slate-500">+{(supplier.driveFiles || []).length - 3}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                                {(supplier.driveFiles || []).length} Documents
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => setViewingDocsSupplier(supplier)}
                                            className="px-4 py-2 bg-slate-50 hover:bg-brand-50 text-slate-600 hover:text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-100 flex items-center gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            View All
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </Reorder.Item>
                ))}
                {filteredSuppliers.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                        <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            {searchTerm ? 'No matching suppliers found' : 'No suppliers registered'}
                        </h3>
                        <p className="text-slate-400 font-medium mt-1">
                            {searchTerm ? 'Try adjusting your search terms.' : (
                                <>
                                    Start by {canManageSuppliers ? (
                                        <button onClick={() => setIsAdding(true)} className="text-brand-600 font-bold hover:underline">adding</button>
                                    ) : 'adding'} your first business partner.
                                </>
                            )}
                        </p>
                        {canManageSuppliers && !searchTerm && (
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="mt-8 bg-brand-600 text-white px-10 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-brand-700 shadow-xl shadow-brand-500/20 transition-all active:scale-95 mx-auto"
                            >
                                <Plus className="w-5 h-5" /> Add Supplier
                            </button>
                        )}
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="mt-4 text-sm font-black text-brand-600 hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </Reorder.Group>

            {viewingDocsSupplier && (
                <SupplierDocumentsModal 
                    supplier={viewingDocsSupplier}
                    onClose={() => setViewingDocsSupplier(null)}
                    onUpdate={onUpdate}
                    openConfirm={openConfirm}
                />
            )}
        </div>
    );
};

const ProjectDocumentsModal = ({ project, onClose, onUpdate, openConfirm }: { project: Project, onClose: () => void, onUpdate: (p: Project) => void, openConfirm: any }) => {
    return (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                            <Briefcase className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">{project.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-brand-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">{project.code}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project Documents</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 hover:bg-white rounded-2xl transition-all shadow-sm">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8">
                    <GoogleDriveManager 
                        files={project.driveFiles || []}
                        onAddFile={(file) => {
                            const updated = { ...project, driveFiles: [...(project.driveFiles || []), file] };
                            onUpdate(updated);
                        }}
                        onRemoveFile={(fileId) => {
                            const updated = { ...project, driveFiles: (project.driveFiles || []).filter(f => f.id !== fileId) };
                            onUpdate(updated);
                        }}
                        onUpdateFile={(updatedFile) => {
                            const updated = { 
                                ...project, 
                                driveFiles: (project.driveFiles || []).map(f => f.id === updatedFile.id ? updatedFile : f) 
                            };
                            onUpdate(updated);
                        }}
                        openConfirm={openConfirm}
                        title={`${project.name} Documents`}
                    />
                </div>
            </motion.div>
        </div>
    );
};

const ProjectView = ({ projects, openConfirm, onUpdate, onAdd, user }: { projects: Project[], openConfirm: any, onUpdate: (p: Project) => void, onAdd: (p: any) => Promise<void>, user: SystemUser }) => {
    const [formData, setFormData] = useState({ 
        code: '', 
        name: '', 
        clientName: '', 
        location: '', 
        startDate: '', 
        endDate: '', 
        status: 'Active' as any, 
        description: '',
        estimationValue: 0,
        income: 0,
        overallExpenses: 0,
        assignedStaffCount: 0
    });
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReordering, setIsReordering] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewingDocsProject, setViewingDocsProject] = useState<Project | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const canManageProjects = user?.permissions?.canManageProjects || user?.role === UserRole.CREATOR || user?.email === 'abdulkaderp3010@gmail.com';

    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [projects]);

    const filteredProjects = useMemo(() => {
        if (!searchTerm.trim()) return sortedProjects;
        const query = searchTerm.toLowerCase();
        return sortedProjects.filter(project => {
            const matchesName = (project.name?.toLowerCase() || '').includes(query);
            const matchesCode = (project.code?.toLowerCase() || '').includes(query);
            const matchesClient = (project.clientName?.toLowerCase() || '').includes(query);
            const matchesLocation = (project.location?.toLowerCase() || '').includes(query);
            return matchesName || matchesCode || matchesClient || matchesLocation;
        });
    }, [sortedProjects, searchTerm]);

    const handleAdd = async () => {
        if (!formData.name.trim() || !formData.code.trim()) {
            setError("Project name and code are required.");
            return;
        }
        
        setIsSaving(true);
        setError(null);
        try {
            await onAdd(formData);
            setFormData({ 
                code: '', 
                name: '', 
                clientName: '', 
                location: '', 
                startDate: '', 
                endDate: '', 
                status: 'Active', 
                description: '',
                estimationValue: 0,
                income: 0,
                overallExpenses: 0,
                assignedStaffCount: 0
            });
            setIsAdding(false);
        } catch (err: any) {
            setError("Failed to save project. Please check your connection and permissions.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReorder = async (newOrder: Project[]) => {
        await reorderProjects(newOrder);
    };

    const handleUpdate = async (project: Project) => {
        await updateProject(project);
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        openConfirm(
            "Delete Project",
            "Are you sure you want to delete this project? This action cannot be undone.",
            async () => {
                await deleteProject(id);
            }
        );
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-[0.2em]">
                        <Briefcase className="w-4 h-4" />
                        Project Management
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Projects</h1>
                    <p className="text-slate-500 font-medium max-w-xl">
                        Track and manage your active and completed projects.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    {canManageProjects && (
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setIsReordering(true)}
                                className="flex-1 sm:flex-none bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                                <GripVertical className="w-4 h-4" /> Reorder
                            </button>
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                            >
                                <Plus className="w-4 h-4" /> Add Project
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isAdding && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] p-8 border border-brand-100 shadow-2xl shadow-brand-600/5"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-brand-50 rounded-2xl">
                            <Briefcase className="w-6 h-6 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Project Registration</h2>
                            <p className="text-slate-400 text-sm font-bold">Define the scope and details of your new project</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Code</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="e.g. PRJ-2024-001"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="Project Title"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Client Name</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="Client / Owner"
                                value={formData.clientName}
                                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                            <input 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="Project Site"
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                            <input 
                                type="date"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date (Optional)</label>
                            <input 
                                type="date"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                            <select 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                            >
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="On Hold">On Hold</option>
                            </select>
                        </div>
                        <div className="space-y-2 lg:col-span-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                            <textarea 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[100px]"
                                placeholder="Brief project description..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estimation Value (Optional)</label>
                            <div className="relative">
                                <DirhamIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="number"
                                    className="w-full px-5 pl-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                    placeholder="0.00"
                                    value={formData.estimationValue || ''}
                                    onChange={e => setFormData({ ...formData, estimationValue: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Income</label>
                            <div className="relative">
                                <DirhamIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="number"
                                    className="w-full px-5 pl-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                    placeholder="0.00"
                                    value={formData.income || ''}
                                    onChange={e => setFormData({ ...formData, income: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Overall Expenses</label>
                            <div className="relative">
                                <DirhamIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="number"
                                    className="w-full px-5 pl-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                    placeholder="0.00"
                                    value={formData.overallExpenses || ''}
                                    onChange={e => setFormData({ ...formData, overallExpenses: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Staff Count</label>
                            <input 
                                type="number"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                placeholder="0"
                                value={formData.assignedStaffCount || ''}
                                onChange={e => setFormData({ ...formData, assignedStaffCount: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-6 border-t border-slate-100 gap-3">
                        <button onClick={() => setIsAdding(false)} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:text-slate-700">Cancel</button>
                        <button onClick={handleAdd} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-black text-sm shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition-all active:scale-95">Create Project</button>
                    </div>
                </motion.div>
            )}

            <Reorder.Group 
                axis="y" 
                values={sortedProjects} 
                onReorder={handleReorder}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {filteredProjects.map((project) => (
                    <Reorder.Item 
                        value={project}
                        key={project.id}
                        dragListener={!searchTerm && canManageProjects}
                        className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/20 transition-all group relative overflow-hidden cursor-default"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-brand-50/50"></div>
                        
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    {!searchTerm && canManageProjects && (
                                        <div className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-slate-500 transition-colors">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="h-16 w-16 bg-slate-50 rounded-2xl p-2 border border-slate-100 shadow-inner flex items-center justify-center">
                                        <Briefcase className="w-8 h-8 text-slate-300" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    {canManageProjects && (
                                        <>
                                            <button 
                                                onClick={() => setEditingId(project.id)}
                                                className="p-2 hover:bg-brand-50 text-brand-600 rounded-xl transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(project.id)}
                                                className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {editingId === project.id ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Project Code"
                                        value={project.code || ''}
                                        onChange={e => updateProject({ ...project, code: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        value={project.name || ''}
                                        onChange={e => updateProject({ ...project, name: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Client Name"
                                        value={project.clientName || ''}
                                        onChange={e => updateProject({ ...project, clientName: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Location"
                                        value={project.location || ''}
                                        onChange={e => updateProject({ ...project, location: e.target.value })}
                                    />
                                    <select 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        value={project.status}
                                        onChange={e => updateProject({ ...project, status: e.target.value as any })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Completed">Completed</option>
                                        <option value="On Hold">On Hold</option>
                                    </select>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                            <input 
                                                type="date"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                                value={project.startDate || ''}
                                                onChange={e => updateProject({ ...project, startDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                            <input 
                                                type="date"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                                value={project.endDate || ''}
                                                onChange={e => updateProject({ ...project, endDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <textarea 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
                                        placeholder="Project Description"
                                        value={project.description || ''}
                                        onChange={e => updateProject({ ...project, description: e.target.value })}
                                    />
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Estimation Value</label>
                                            <div className="relative">
                                                <DirhamIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 scale-75" />
                                                <input 
                                                    type="number"
                                                    className="w-full px-3 pl-10 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                                    value={project.estimationValue || ''}
                                                    onChange={e => updateProject({ ...project, estimationValue: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Income</label>
                                                <div className="relative">
                                                    <DirhamIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 scale-75" />
                                                    <input 
                                                        type="number"
                                                        className="w-full px-3 pl-10 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                                        value={project.income || ''}
                                                        onChange={e => updateProject({ ...project, income: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Expenses</label>
                                                <div className="relative">
                                                    <DirhamIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 scale-75" />
                                                    <input 
                                                        type="number"
                                                        className="w-full px-3 pl-10 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                                        value={project.overallExpenses || ''}
                                                        onChange={e => updateProject({ ...project, overallExpenses: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Count</label>
                                                <input 
                                                    type="number"
                                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                                    value={project.assignedStaffCount || ''}
                                                    onChange={e => updateProject({ ...project, assignedStaffCount: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                                        <button onClick={() => handleUpdate(project)} className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold shadow-md shadow-brand-600/20">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black bg-brand-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">{project.code}</span>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{project.name}</h3>
                                        <span className={cn("ml-auto text-[8px] font-black uppercase px-2 py-0.5 rounded-full border", 
                                            project.status === 'Active' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 
                                            project.status === 'Completed' ? 'bg-blue-100 text-blue-600 border-blue-200' : 
                                            'bg-orange-100 text-orange-600 border-orange-200'
                                        )}>
                                            {project.status}
                                        </span>
                                    </div>
                                    <div className="space-y-3 mt-auto">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <Users className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{project.clientName || 'No client specified'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <Globe className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{project.location || 'No location specified'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <Calendar className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">
                                                {project.startDate ? (
                                                    <>
                                                        {project.startDate} {project.endDate ? `to ${project.endDate}` : '(Ongoing)'}
                                                    </>
                                                ) : (
                                                    <span className="text-slate-300 italic">No dates specified</span>
                                                )}
                                            </span>
                                        </div>
                                        {project.description && (
                                            <div className="flex items-start gap-3 text-slate-500">
                                                <div className="p-1.5 bg-slate-50 rounded-lg mt-0.5">
                                                    <StickyNote className="w-3.5 h-3.5" />
                                                </div>
                                                <p className="text-[11px] font-medium line-clamp-2 italic text-slate-400 leading-relaxed">
                                                    {project.description}
                                                </p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100/50">
                                            {project.estimationValue !== undefined && project.estimationValue > 0 && (
                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase tracking-wider">Estimation</span>
                                                    <span className="text-slate-700 flex items-center gap-1">
                                                        <DirhamIcon className="scale-75 opacity-60" />
                                                        {project.estimationValue.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                <span className="text-slate-400 uppercase tracking-wider">Income</span>
                                                <span className="text-emerald-600 flex items-center gap-1">
                                                    <DirhamIcon className="scale-75 opacity-60" />
                                                    {project.income?.toLocaleString() || '0'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                <span className="text-slate-400 uppercase tracking-wider">Expenses</span>
                                                <span className="text-rose-600 flex items-center gap-1">
                                                    <DirhamIcon className="scale-75 opacity-60" />
                                                    {project.overallExpenses?.toLocaleString() || '0'}
                                                </span>
                                            </div>
                                            {project.assignedStaffCount !== undefined && project.assignedStaffCount > 0 && (
                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase tracking-wider">Assigned Staff</span>
                                                    <span className="text-brand-600 flex items-center gap-1">
                                                        <Users className="w-3 h-3 opacity-60" />
                                                        {project.assignedStaffCount}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[10px] font-black pt-1 border-t border-slate-100/30">
                                                <span className="text-slate-400 uppercase tracking-wider">Net P/L</span>
                                                <span className={cn("flex items-center gap-1", ((project.income || 0) - (project.overallExpenses || 0)) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                    <DirhamIcon className="scale-75 opacity-60" />
                                                    {((project.income || 0) - (project.overallExpenses || 0)).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                {(project.driveFiles || []).length} Documents
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => setViewingDocsProject(project)}
                                            className="px-4 py-2 bg-slate-50 hover:bg-brand-50 text-slate-600 hover:text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-100 flex items-center gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            Documents
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </Reorder.Item>
                ))}
                {filteredProjects.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                        <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            {searchTerm ? 'No matching projects found' : 'No projects registered'}
                        </h3>
                        <p className="text-slate-400 font-medium mt-1">
                            {searchTerm ? 'Try adjusting your search terms.' : (
                                <>
                                    Start by {canManageProjects ? (
                                        <button onClick={() => setIsAdding(true)} className="text-brand-600 font-bold hover:underline">adding</button>
                                    ) : 'adding'} your first project.
                                </>
                            )}
                        </p>
                    </div>
                )}
            </Reorder.Group>

            {viewingDocsProject && (
                <ProjectDocumentsModal 
                    project={viewingDocsProject}
                    onClose={() => setViewingDocsProject(null)}
                    onUpdate={onUpdate}
                    openConfirm={openConfirm}
                />
            )}
        </div>
    );
};

const CompanyDocumentsModal = ({ company, onClose, onUpdate, openConfirm }: { company: Company, onClose: () => void, onUpdate: (c: Company) => void, openConfirm: any }) => {
    return (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                            {company.logo ? (
                                <img src={company.logo} alt={company.name} className="max-h-full max-w-full object-contain" />
                            ) : (
                                <Building2 className="w-8 h-8 text-slate-300" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">{company.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-brand-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">{company.code}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Linked Documents</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all active:scale-90 shadow-sm">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto">
                    <GoogleDriveManager 
                        files={company.driveFiles || []}
                        onAddFile={(file) => {
                            const updated = { ...company, driveFiles: [...(company.driveFiles || []), file] };
                            onUpdate(updated);
                        }}
                        onRemoveFile={(fileId) => {
                            const updated = { ...company, driveFiles: (company.driveFiles || []).filter(f => f.id !== fileId) };
                            onUpdate(updated);
                        }}
                        onUpdateFile={(updatedFile) => {
                            const updated = { 
                                ...company, 
                                driveFiles: (company.driveFiles || []).map(f => f.id === updatedFile.id ? updatedFile : f) 
                            };
                            onUpdate(updated);
                        }}
                        openConfirm={openConfirm}
                    />
                </div>
            </motion.div>
        </div>
    );
};

const CompanyView = ({ companies, openConfirm, onUpdate, onAdd, user }: { companies: Company[], openConfirm: any, onUpdate: (c: Company) => void, onAdd: (c: any) => Promise<void>, user: SystemUser }) => {
    const [formData, setFormData] = useState({ code: '', name: '', address: '', email: '', phone: '', logo: '' });
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReordering, setIsReordering] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewingDocsCompany, setViewingDocsCompany] = useState<Company | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const canManageSettings = user?.permissions?.canManageSettings || user?.role === UserRole.CREATOR;

    const sortedCompanies = useMemo(() => {
        return [...companies].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [companies]);

    const filteredCompanies = useMemo(() => {
        if (!searchTerm.trim()) return sortedCompanies;
        const query = searchTerm.toLowerCase();
        return sortedCompanies.filter(company => {
            const matchesName = company.name.toLowerCase().includes(query);
            const matchesCode = company.code?.toLowerCase().includes(query);
            const matchesDocuments = company.driveFiles?.some(file => 
                file.name.toLowerCase().includes(query)
            );
            return matchesName || matchesCode || matchesDocuments;
        });
    }, [sortedCompanies, searchTerm]);

    const getExpiryStatus = (company: Company) => {
        const files = company.driveFiles || [];
        const today = new Date();
        let expired = 0;
        let warning = 0;

        files.forEach(file => {
            if (file.expiryDate) {
                const expiry = new Date(file.expiryDate);
                const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) expired++;
                else if (diffDays <= 10) warning++;
            }
        });

        if (expired > 0) return { label: `${expired} Expired`, color: 'bg-red-100 text-red-600 border-red-200' };
        if (warning > 0) return { label: `${warning} Expiring Soon`, color: 'bg-orange-100 text-orange-600 border-orange-200' };
        return null;
    };

    const handleAdd = async () => {
        if (!formData.name.trim() || !formData.code.trim()) {
            setError("Company name and code are required.");
            return;
        }
        
        setIsSaving(true);
        setError(null);
        try {
            await onAdd(formData);
            setFormData({ code: '', name: '', address: '', email: '', phone: '', logo: '' });
            setIsAdding(false);
        } catch (err: any) {
            setError("Failed to save company. Please check your connection and permissions.");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReorder = async (newOrder: Company[]) => {
        await reorderCompanies(newOrder);
    };

    const handleUpdate = async (company: Company) => {
        await updateCompany(company);
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        openConfirm(
            "Delete Company",
            "Are you sure you want to delete this company? This action cannot be undone.",
            async () => {
                await deleteCompany(id);
            }
        );
    };

    const handleLogoUpload = async (company: Company | null, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const base64 = evt.target?.result as string;
            if (company) {
                await updateCompany({ ...company, logo: base64 });
            } else {
                setFormData(prev => ({ ...prev, logo: base64 }));
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-[0.2em]">
                        <Building2 className="w-4 h-4" />
                        Organization Management
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Company Directory</h1>
                    <p className="text-slate-500 font-medium max-w-xl">
                        Manage your business entities, office locations, and corporate identities.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search companies or documents..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {canManageSettings && (
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setIsReordering(true)}
                                className="flex-1 sm:flex-none bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                                <GripVertical className="w-4 h-4" /> Reorder
                            </button>
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                            >
                                <Plus className="w-4 h-4" /> Add Company
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isAdding && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] p-8 border border-brand-100 shadow-xl shadow-brand-900/5 space-y-6"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Register New Company</h3>
                        <button onClick={() => { setIsAdding(false); setError(null); }} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Company Code</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                placeholder="e.g. A1" 
                                value={formData.code} 
                                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Company Name</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                placeholder="Legal Entity Name" 
                                value={formData.name} 
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Official Email</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                placeholder="contact@company.com" 
                                value={formData.email} 
                                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Contact Number</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                placeholder="+971 50 123 4567" 
                                value={formData.phone} 
                                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Office Address</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                placeholder="Full Physical Address" 
                                value={formData.address} 
                                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} 
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={e => handleLogoUpload(null, e)}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 group-hover:bg-slate-50 transition-all">
                                    <Globe className="w-4 h-4" /> Upload Logo
                                </div>
                            </div>
                            {formData.logo && (
                                <div className="h-10 w-10 rounded-xl border border-slate-100 p-1 bg-white shadow-sm">
                                    <img src={formData.logo} alt="Preview" className="h-full w-full object-contain" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsAdding(false)} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:text-slate-700">Cancel</button>
                            <button onClick={handleAdd} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-black text-sm shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition-all active:scale-95">Create Company</button>
                        </div>
                    </div>
                </motion.div>
            )}

            <Reorder.Group 
                axis="y" 
                values={sortedCompanies} 
                onReorder={handleReorder}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {filteredCompanies.map((company) => (
                    <Reorder.Item 
                        value={company}
                        key={company.id}
                        dragListener={!searchTerm && canManageSettings}
                        className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/20 transition-all group relative overflow-hidden cursor-default"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-brand-50/50"></div>
                        
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    {!searchTerm && canManageSettings && (
                                        <div className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-slate-500 transition-colors">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="h-16 w-16 bg-slate-50 rounded-2xl p-2 border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden">
                                        {company.logo ? (
                                            <img src={company.logo} alt={company.name} className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <Building2 className="w-8 h-8 text-slate-300" />
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    {canManageSettings && (
                                        <>
                                            <button 
                                                onClick={() => setEditingId(company.id)}
                                                className="p-2 hover:bg-brand-50 text-brand-600 rounded-xl transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(company.id)}
                                                className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {editingId === company.id ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Company Code"
                                        value={company.code || ''}
                                        onChange={e => updateCompany({ ...company, code: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        value={company.name || ''}
                                        onChange={e => updateCompany({ ...company, name: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        value={company.email || ''}
                                        onChange={e => updateCompany({ ...company, email: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Contact Number"
                                        value={company.phone || ''}
                                        onChange={e => updateCompany({ ...company, phone: e.target.value })}
                                    />
                                    <input 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                                        placeholder="Office Address"
                                        value={company.address || ''}
                                        onChange={e => updateCompany({ ...company, address: e.target.value })}
                                    />
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                                        <button onClick={() => handleUpdate(company)} className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold shadow-md shadow-brand-600/20">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black bg-brand-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">{company.code}</span>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{company.name}</h3>
                                        {getExpiryStatus(company) && (
                                            <span className={cn("ml-auto text-[8px] font-black uppercase px-2 py-0.5 rounded-full border", getExpiryStatus(company)?.color)}>
                                                {getExpiryStatus(company)?.label}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3 mt-auto">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <FileText className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{company.email || 'No email provided'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold truncate">{company.phone || 'No contact provided'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <Building2 className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-bold line-clamp-1">{company.address || 'No address provided'}</span>
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-2">
                                                {(company.driveFiles || []).slice(0, 3).map(file => (
                                                    <div key={file.id} className="w-8 h-8 rounded-lg border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                        {file.iconLink ? (
                                                            <img src={file.iconLink} alt="" className="w-4 h-4" />
                                                        ) : (
                                                            <FileText className="w-4 h-4 text-slate-400" />
                                                        )}
                                                    </div>
                                                ))}
                                                {(company.driveFiles || []).length > 3 && (
                                                    <div className="w-8 h-8 rounded-lg border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm">
                                                        <span className="text-[10px] font-bold text-slate-500">+{(company.driveFiles || []).length - 3}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                                {(company.driveFiles || []).length} Documents
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => setViewingDocsCompany(company)}
                                            className="px-4 py-2 bg-slate-50 hover:bg-brand-50 text-slate-600 hover:text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-100 flex items-center gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            View All
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </Reorder.Item>
                ))}
                {filteredCompanies.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            {searchTerm ? 'No matching companies found' : 'No companies registered'}
                        </h3>
                        <p className="text-slate-400 font-medium mt-1">
                            {searchTerm ? 'Try adjusting your search terms.' : 'Start by adding your first business entity.'}
                        </p>
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="mt-4 text-sm font-black text-brand-600 hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </Reorder.Group>

            {viewingDocsCompany && (
                <CompanyDocumentsModal 
                    company={viewingDocsCompany}
                    onClose={() => setViewingDocsCompany(null)}
                    onUpdate={onUpdate}
                    openConfirm={openConfirm}
                />
            )}

            {isReordering && (
                <ReorderCompaniesModal 
                    companies={sortedCompanies}
                    onClose={() => setIsReordering(false)}
                    onReorder={handleReorder}
                />
            )}
        </div>
    );
};

const AttendanceEditModal = ({ employee, date, currentRecord, onUpdate, onClose, openConfirm }: any) => {
    const isFixedSalary = employee.team === 'Office Staff' || employee.team === 'Internal Team';
    const [status, setStatus] = useState<AttendanceStatus | null>(currentRecord?.status || (isFixedSalary ? null : AttendanceStatus.PRESENT));
    const [hoursWorked, setHoursWorked] = useState<number>(currentRecord?.hoursWorked || (isFixedSalary ? 8 : 0));
    const [otHours, setOtHours] = useState<number>(currentRecord?.overtimeHours || 0);
    const [note, setNote] = useState<string>(currentRecord?.note || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        if (!status) return;
        setIsSubmitting(true);
        try {
            await onUpdate(employee.id, date, status, otHours, note, hoursWorked);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async () => {
        openConfirm(
            "Clear Attendance",
            `Are you sure you want to clear the attendance record for ${employee.name} on ${new Date(date).toLocaleDateString()}?`,
            async () => {
                setIsSubmitting(true);
                try {
                    await onUpdate(employee.id, date, null);
                    onClose();
                } catch (error) {
                    console.error("Error removing attendance:", error);
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    return (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center justify-center text-2xl font-black text-brand-600 overflow-hidden">
                            {employee.profileImage ? (
                                <img src={employee.profileImage} alt={employee.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                employee.name.charAt(0)
                            )}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">{employee.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-lg text-[10px] font-black uppercase tracking-wider">{employee.code}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all active:scale-90 shadow-sm">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto space-y-8">
                    <section>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">
                            {isFixedSalary ? 'Select Status' : 'Attendance Status'}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.entries(LEGEND).map(([s, m]: any) => {
                                // For non-fixed salary, we might want to restrict or emphasize hours
                                if (!isFixedSalary && s !== AttendanceStatus.PRESENT && s !== AttendanceStatus.ABSENT && s !== AttendanceStatus.WEEK_OFF) {
                                    // Still allow all statuses but maybe emphasize Present/Absent
                                }
                                return (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            setStatus(s as AttendanceStatus);
                                            if (s !== AttendanceStatus.PRESENT) setHoursWorked(0);
                                            else if (hoursWorked === 0) setHoursWorked(8);
                                        }}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] border-2 transition-all active:scale-95",
                                            status === s 
                                                ? "border-brand-500 bg-brand-50/50 ring-4 ring-brand-500/10" 
                                                : "border-slate-100 hover:border-brand-200 bg-white"
                                        )}
                                    >
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm", m.color)}>
                                            {m.code}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {!isFixedSalary && (
                        <section className="bg-brand-50/50 p-6 rounded-[2rem] border border-brand-100">
                            <label className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-3 block">Daily Working Hours</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
                                <input 
                                    type="number" 
                                    value={hoursWorked}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setHoursWorked(val);
                                        if (val > 0 && status !== AttendanceStatus.PRESENT) {
                                            setStatus(AttendanceStatus.PRESENT);
                                        }
                                    }}
                                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-brand-200 focus:border-brand-500 rounded-2xl outline-none transition-all font-black text-2xl text-brand-600"
                                    placeholder="0"
                                    min="0"
                                    max="24"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-400 font-bold uppercase text-xs">Hours</span>
                            </div>
                            <p className="text-[10px] text-brand-400 font-bold mt-2 uppercase tracking-wider">Manual entry for daily hourly calculation</p>
                        </section>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <section>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Overtime Hours</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="number" 
                                    value={otHours}
                                    onChange={(e) => setOtHours(Number(e.target.value))}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none transition-all font-bold text-slate-900"
                                    placeholder="0"
                                    min="0"
                                    max="24"
                                />
                            </div>
                        </section>

                        <section>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Note / Remarks</label>
                            <input 
                                type="text" 
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none transition-all font-bold text-slate-900"
                                placeholder="Optional note..."
                            />
                        </section>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex gap-4">
                    <button 
                        onClick={handleRemove}
                        disabled={isSubmitting || !currentRecord}
                        className="px-6 py-4 bg-white text-red-500 border border-slate-200 rounded-2xl text-sm font-black hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Clear</span>
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSubmitting || !status}
                        className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 transition-all active:scale-95 shadow-xl shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Save Attendance Details
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const TimesheetView = ({ employees, attendance, selectedMonth, onMonthChange, user, onLogAttendance, onDeleteAttendance, companies, openConfirm, selectedId, onSelect }: any) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCell, setEditingCell] = useState<{empId: string, date: string} | null>(null);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const canManageAttendance = user?.permissions?.canManageAttendance;

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const fullYear = year.toString();

    const handlePrevMonth = () => {
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }
        onMonthChange(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        let nextYear = year;
        let nextMonth = month + 1;
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
        }
        onMonthChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
    };

    const handleStatusUpdate = async (employeeId: string, date: string, status: AttendanceStatus | null, otHours: number = 0, note: string = '', hoursWorked?: number) => {
        try {
            if (status === null) {
                await onDeleteAttendance(employeeId, date);
            } else {
                await onLogAttendance(
                    employeeId,
                    status,
                    date,
                    otHours,
                    undefined,
                    user?.username || 'System',
                    note || 'Manual Update',
                    hoursWorked
                );
            }
        } catch (error) {
            console.error("Attendance update failed:", error);
        } finally {
            setEditingCell(null);
        }
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter((e: Employee) => {
            const company = companies.find((c: Company) => c.name === e.company);
            return (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                   (e.code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                   (company?.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        });
    }, [employees, searchTerm, companies]);

    const editingEmployee = useMemo(() => {
        if (!editingCell) return null;
        return employees.find((e: Employee) => e.id === editingCell.empId);
    }, [editingCell, employees]);

    const editingRecord = useMemo(() => {
        if (!editingCell) return null;
        return attendance.find((r: AttendanceRecord) => r.employeeId === editingCell.empId && r.date === editingCell.date);
    }, [editingCell, attendance]);

    const handleCopyAttendance = async (sourceDate: string, targetStartDate: string, targetEndDate: string) => {
        const start = new Date(targetStartDate);
        const end = new Date(targetEndDate);
        
        // Get all attendance records for the source date
        const sourceRecords = attendance.filter((r: AttendanceRecord) => r.date === sourceDate);
        
        if (sourceRecords.length === 0) {
            alert("No attendance records found for the source date.");
            return;
        }

        const datesToCopy: string[] = [];
        let current = new Date(start);
        while (current <= end) {
            datesToCopy.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        for (const targetDate of datesToCopy) {
            for (const record of sourceRecords) {
                await logAttendance(
                    record.employeeId,
                    record.status,
                    targetDate,
                    record.overtimeHours || 0,
                    undefined,
                    user?.username || 'System',
                    `Copied from ${sourceDate}`
                );
            }
        }
        setIsCopyModalOpen(false);
    };

    const handleExport = () => {
        const headers = ['Code', 'Name', 'Company', 'Department', ...days.map(d => d.toString()), 'Present', 'OT Hours'];
        const data = filteredEmployees.map((e: Employee) => {
            const row: any = {
                'Code': e.code,
                'Name': e.name,
                'Company': e.company,
                'Department': e.department,
            };

            days.forEach(d => {
                const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                const record = attendance.find((r: AttendanceRecord) => r.employeeId === e.id && r.date === dateStr);
                row[d.toString()] = record ? record.status : '-';
            });

            const empAtt = attendance.filter(r => r.employeeId === e.id && r.date.startsWith(selectedMonth));
            row['Present'] = empAtt.filter(r => r.status === AttendanceStatus.PRESENT).length;
            row['OT Hours'] = empAtt.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Timesheet");
        XLSX.writeFile(wb, `Timesheet_${selectedMonth}.xlsx`);
    };

    const handleClearAll = () => {
        if (!canManageAttendance) return;
        
        openConfirm(
            "Clear Monthly Timesheet",
            `Are you sure you want to clear ALL attendance records for ${monthName} ${fullYear}? This action cannot be undone and will remove all logs for this month.`,
            async () => {
                const recordsToDelete = attendance.filter((r: AttendanceRecord) => r.date.startsWith(selectedMonth));
                if (recordsToDelete.length === 0) return;
                
                for (const record of recordsToDelete) {
                    await onDeleteAttendance(record.employeeId, record.date);
                }
            },
            'danger'
        );
    };

    return (
        <div className="space-y-6">
            <CopyAttendanceModal 
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                onCopy={handleCopyAttendance}
                currentMonth={selectedMonth}
            />
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button 
                            onClick={handlePrevMonth} 
                            className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all active:scale-95"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="px-4 text-center min-w-[140px] flex flex-col items-center">
                            <div className="text-sm font-bold text-slate-900">{monthName}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                {fullYear}
                                <img src="https://flagcdn.com/w20/ae.png" alt="UAE" className="w-3 h-2 rounded-sm" referrerPolicy="no-referrer" />
                            </div>
                        </div>
                        <button 
                            onClick={handleNextMonth} 
                            className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all active:scale-95"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="hidden xl:flex flex-wrap gap-2">
                        {Object.entries(LEGEND).map(([status, meta]: any) => (
                            <div key={status} className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 cursor-default",
                                meta.color.replace('text-', 'text-').replace('bg-', 'bg-'),
                                "border-slate-100"
                            )}>
                                {meta.code}: {meta.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search staff..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-slate-100/50 border-none rounded-2xl text-sm w-full sm:w-64 outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                    </div>
                    {canManageAttendance && (
                        <>
                            <button 
                                onClick={handleClearAll}
                                className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-sm font-black hover:bg-rose-100 transition-all active:scale-95"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Clear All</span>
                            </button>
                            <button 
                                onClick={() => setIsCopyModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 transition-all active:scale-95 shadow-lg shadow-brand-600/20"
                            >
                                <Copy className="w-4 h-4" />
                                <span className="hidden sm:inline">Copy Attendance</span>
                            </button>
                        </>
                    )}
                    <button 
                        onClick={handleExport}
                        className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-[11px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-4 text-left bg-slate-50/80 backdrop-blur-sm sticky left-0 z-20 border-r border-slate-100 min-w-[180px]">
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Employee Name</span>
                                </th>
                                <th className="p-4 font-bold text-slate-500 border-r border-slate-100 uppercase tracking-widest text-[10px]">Leave</th>
                                <th className="p-4 font-bold text-brand-600 border-r border-slate-100 uppercase tracking-widest text-[10px]">OT</th>
                                {days.map(d => {
                                    const date = new Date(year, month - 1, d);
                                    const dayName = date.toLocaleString('default', { weekday: 'narrow' });
                                    const isSunday = date.getDay() === 0;
                                    return (
                                        <th key={d} className={cn(
                                            "p-2 w-10 border-r border-slate-50 min-w-[36px]",
                                            isSunday ? 'bg-red-50/30 text-red-500' : 'text-slate-600'
                                        )}>
                                            <div className="font-bold text-sm">{d}</div>
                                            <div className="text-[9px] font-bold uppercase opacity-60">{dayName}</div>
                                        </th>
                                    );
                                })}
                                <th className="p-4 font-bold text-slate-900 bg-slate-50/80 backdrop-blur-sm sticky right-0 z-20 border-l border-slate-100 uppercase tracking-widest text-[10px]">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredEmployees.map((e: Employee, idx: number) => (
                                <tr 
                                    key={e.id} 
                                    onClick={() => onSelect?.(selectedId === e.id ? null : e.id)}
                                    className={cn(
                                        "hover:bg-brand-50/20 transition-colors group cursor-pointer",
                                        selectedId === e.id ? "bg-brand-50/50 border-l-4 border-brand-600" : ""
                                    )}
                                >
                                    <td className="p-4 text-left border-r border-slate-100 sticky left-0 bg-white/90 backdrop-blur-sm z-10 group-hover:bg-brand-50/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 overflow-hidden">
                                                {e.profileImage ? (
                                                    <img src={e.profileImage} alt={e.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    e.name.charAt(0)
                                                )}
                                            </div>
                                            <span className="font-bold text-slate-900 truncate max-w-[120px]">{e.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 border-r border-slate-50 font-bold text-slate-500">{e.leaveBalance}</td>
                                    <td className="p-4 border-r border-slate-50 font-bold text-brand-600">
                                        {attendance.filter(r => r.employeeId === e.id && r.date.startsWith(selectedMonth)).reduce((sum, r) => sum + (r.overtimeHours || 0), 0)}
                                    </td>
                                    {days.map(d => {
                                        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                                        const record = attendance.find((r: AttendanceRecord) => r.employeeId === e.id && r.date === dateStr);
                                        const meta = LEGEND[record?.status] || {};
                                        const isSunday = new Date(year, month - 1, d).getDay() === 0;
                                        return (
                                            <td key={d} className={cn(
                                                "border-r border-slate-50 p-2 font-bold transition-all relative",
                                                meta.code ? meta.color : isSunday ? 'bg-red-50/20 text-red-200' : 'text-slate-200 group-hover:text-slate-300'
                                            )}>
                                                <button 
                                                    onClick={() => setEditingCell({ empId: e.id, date: dateStr })}
                                                    className={cn(
                                                        "w-7 h-7 flex items-center justify-center rounded-lg mx-auto transition-transform hover:scale-110 active:scale-90",
                                                        meta.code && "bg-white shadow-sm border border-slate-100"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "text-[12px] font-black",
                                                        meta.code ? "text-slate-900" : (isSunday ? "text-red-400" : "text-slate-300")
                                                    )}>
                                                        {meta.code || (isSunday ? 'S' : '-')}
                                                    </span>
                                                </button>
                                                {record?.hoursWorked > 0 && record?.hoursWorked !== 8 && (
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white text-[8px] px-1 rounded border border-slate-100 shadow-sm text-brand-600 font-black">
                                                        {record.hoursWorked}h
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="p-4 font-bold text-slate-900 bg-white/90 backdrop-blur-sm sticky right-0 z-10 border-l border-slate-100 group-hover:bg-brand-50/50 transition-colors">
                                        <div className="flex flex-col items-center">
                                            <span className="text-brand-600">{attendance.filter(r => r.employeeId === e.id && r.date.startsWith(selectedMonth) && r.status === AttendanceStatus.PRESENT).length}P</span>
                                            <span className="text-[9px] text-slate-400 font-bold">DAYS</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredEmployees.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Calendar className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No records found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1">Try searching for a different staff member or changing the month.</p>
                    </div>
                )}
            </div>

            {editingCell && editingEmployee && (
                <AttendanceEditModal 
                    employee={editingEmployee}
                    date={editingCell.date}
                    currentRecord={editingRecord}
                    onUpdate={handleStatusUpdate}
                    onClose={() => setEditingCell(null)}
                    openConfirm={openConfirm}
                />
            )}
        </div>
    );
};

const DeductionsView = ({ employees, deductions, openConfirm, user, companies }: any) => {
    const [newItem, setNewItem] = useState<Partial<DeductionRecord>>({ type: 'Salary Advance', date: new Date().toISOString().split('T')[0] });
    const [searchTerm, setSearchTerm] = useState('');
    const canManagePayroll = user?.permissions?.canManagePayroll;

    const handleAdd = async () => {
        if(newItem.employeeId && newItem.amount && newItem.date) {
            await saveDeduction(newItem as any);
            setNewItem({ type: 'Salary Advance', date: new Date().toISOString().split('T')[0] });
        }
    }

    const filteredDeductions = useMemo(() => {
        return deductions.filter((d: DeductionRecord) => {
            const emp = employees.find((e: Employee) => e.id === d.employeeId);
            const company = companies.find((c: Company) => c.name === emp?.company);
            const search = searchTerm.toLowerCase();
            return (
                (emp?.name?.toLowerCase() || '').includes(search) ||
                (emp?.code?.toLowerCase() || '').includes(search) ||
                (company?.code?.toLowerCase() || '').includes(search) ||
                (d.type?.toLowerCase() || '').includes(search) ||
                (d.note && (d.note?.toLowerCase() || '').includes(search))
            );
        });
    }, [deductions, employees, searchTerm, companies]);
    
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Deductions & Penalties</h2>
                    <p className="text-slate-500 text-sm mt-1">Manage employee advances, fines, and asset damages.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search deductions..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-11 pr-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all w-64 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-2xl border border-brand-100">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Financial Records</span>
                    </div>
                </div>
            </div>

            <div className="glass-card p-8 rounded-3xl border border-white shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center text-brand-600">
                        <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Record New Transaction</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Staff Member</label>
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                            value={newItem.employeeId || ''} 
                            onChange={e => setNewItem({...newItem, employeeId: e.target.value})}
                        >
                            <option value="">Select Employee</option>
                            {employees.map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
                        <input 
                            type="date" 
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                            value={newItem.date || ''} 
                            onChange={e => setNewItem({...newItem, date: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Category</label>
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                            value={newItem.type} 
                            onChange={e => setNewItem({...newItem, type: e.target.value as any})}
                        >
                            <option>Salary Advance</option>
                            <option>Fine Amount</option>
                            <option>Damage Material/Asset</option>
                            <option>Loan Amount</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount (AED)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">AED</span>
                            <input 
                                type="number" 
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all font-bold text-slate-900" 
                                placeholder="0.00" 
                                value={newItem.amount || ''} 
                                onChange={e => setNewItem({...newItem, amount: Number(e.target.value)})} 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all placeholder:text-slate-400" 
                                placeholder="Reason..." 
                                value={newItem.note || ''} 
                                onChange={e => setNewItem({...newItem, note: e.target.value})} 
                            />
                            <button 
                                onClick={handleAdd}
                                disabled={!newItem.employeeId || !newItem.amount}
                                className="p-3 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-all active:scale-95 shadow-lg shadow-brand-200 disabled:opacity-50 disabled:scale-100"
                            >
                                <Check className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden border border-white shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Note</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence mode="popLayout">
                                {filteredDeductions.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((d: DeductionRecord) => {
                                    const emp = employees.find((e:any) => e.id === d.employeeId);
                                    return (
                                        <motion.tr 
                                            key={d.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="hover:bg-slate-50/50 transition-colors group"
                                        >
                                            <td className="p-5">
                                                <div className="text-sm font-bold text-slate-900">{new Date(d.date).toLocaleDateString()}</div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-[10px] font-bold text-brand-600 border border-brand-100 overflow-hidden">
                                                {emp?.profileImage ? (
                                                    <img src={emp.profileImage} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    emp?.name?.charAt(0) || '?'
                                                )}
                                            </div>
                                                    <div className="text-sm font-bold text-slate-700">{emp?.name || 'Unknown'}</div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                    d.type === 'Fine Amount' ? 'bg-red-50 text-red-600 border-red-100' :
                                                    d.type === 'Salary Advance' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    d.type === 'Loan Amount' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-100'
                                                )}>
                                                    {d.type}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="text-sm font-bold text-red-600">AED {d.amount.toFixed(2)}</div>
                                            </td>
                                            <td className="p-5">
                                                <div className="text-sm text-slate-500 italic max-w-xs truncate">{d.note || '-'}</div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex justify-end">
                                                    <button 
                                                        onClick={() => openConfirm("Delete Deduction", "Are you sure you want to remove this record?", async () => {
                                                            await deleteDeduction(d.id!);
                                                        })}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
                {deductions.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <CreditCard className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No transactions yet</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1">Add deductions or penalties to see them listed here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const LeaveManagementView = ({ employees, leaveRequests, user, companies, openConfirm }: any) => {
    const [showNew, setShowNew] = useState(false);
    const [editingReq, setEditingReq] = useState<LeaveRequest | null>(null);
    const [newReq, setNewReq] = useState({ employeeId: '', type: AttendanceStatus.ANNUAL_LEAVE, startDate: '', endDate: '', reason: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const canManageLeaves = user?.permissions?.canManageLeaves || user?.role === 'Creator';

    const handleSave = async () => {
        if(newReq.employeeId && newReq.startDate && newReq.endDate) {
            await saveLeaveRequest(newReq as any, user.name);
            setShowNew(false);
            setNewReq({ employeeId: '', type: AttendanceStatus.ANNUAL_LEAVE, startDate: '', endDate: '', reason: '' });
        }
    };

    const handleUpdate = async () => {
        if (editingReq && editingReq.employeeId && editingReq.startDate && editingReq.endDate) {
            await updateLeaveRequest(editingReq);
            setEditingReq(null);
        }
    };

    const handleDelete = async (id: string) => {
        openConfirm(
            "Delete Leave Request",
            "Are you sure you want to delete this leave request? This action cannot be undone.",
            async () => {
                await deleteLeaveRequest(id);
            },
            'danger'
        );
    };

    const handleStatus = async (id: string, status: LeaveStatus) => {
        await updateLeaveRequestStatus(id, status, user.name);
    };

    const filteredRequests = useMemo(() => {
        return leaveRequests.filter((r: LeaveRequest) => {
            const emp = employees.find((e: Employee) => e.id === r.employeeId);
            const company = companies.find((c: Company) => c.name === emp?.company);
            const search = searchTerm.toLowerCase();
            return (
                (emp?.name?.toLowerCase() || '').includes(search) ||
                (emp?.code?.toLowerCase() || '').includes(search) ||
                (company?.code?.toLowerCase() || '').includes(search) ||
                (r.type?.toLowerCase() || '').includes(search) ||
                (r.reason?.toLowerCase() || '').includes(search)
            );
        });
    }, [leaveRequests, employees, searchTerm, companies]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Management</h2>
                    <p className="text-slate-500 text-sm mt-1">Review and approve employee time-off requests.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search requests..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-11 pr-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all w-64 shadow-sm"
                        />
                    </div>
                    {canManageLeaves && (
                        <button 
                            onClick={() => setShowNew(true)} 
                            className="neo-button bg-brand-600 text-white px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-200"
                        >
                            <Plus className="w-5 h-5" /> New Request
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showNew && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass-card p-8 rounded-3xl border-2 border-brand-100 shadow-xl mb-8">
                            <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-brand-600" />
                                Create New Leave Request
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employee</label>
                                    <select 
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                        value={newReq.employeeId} 
                                        onChange={e=>setNewReq({...newReq, employeeId:e.target.value})}
                                    >
                                        <option value="">Select Staff Member</option>
                                        {employees.map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Leave Type</label>
                                    <select 
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                        value={newReq.type} 
                                        onChange={e=>setNewReq({...newReq, type:e.target.value as any})}
                                    >
                                        <option value={AttendanceStatus.ANNUAL_LEAVE}>Annual Leave</option>
                                        <option value={AttendanceStatus.SICK_LEAVE}>Sick Leave</option>
                                        <option value={AttendanceStatus.EMERGENCY_LEAVE}>Emergency Leave</option>
                                        <option value={AttendanceStatus.UNPAID_LEAVE}>Unpaid Leave</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                        value={newReq.startDate} 
                                        onChange={e=>setNewReq({...newReq, startDate:e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                        value={newReq.endDate} 
                                        onChange={e=>setNewReq({...newReq, endDate:e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2 lg:col-span-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason / Description</label>
                                    <textarea 
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all min-h-[100px]" 
                                        placeholder="Briefly explain the reason for leave..." 
                                        value={newReq.reason} 
                                        onChange={e=>setNewReq({...newReq, reason:e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setShowNew(false)} 
                                    className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave} 
                                    className="neo-button bg-brand-600 text-white px-8 py-2.5 rounded-2xl font-bold shadow-lg shadow-brand-200"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editingReq && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
                        >
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                        <div className="p-2 bg-brand-50 rounded-xl">
                                            <Edit className="w-5 h-5 text-brand-600" />
                                        </div>
                                        Edit Leave Request
                                    </h3>
                                    <button onClick={() => setEditingReq(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employee</label>
                                        <select 
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                            value={editingReq.employeeId} 
                                            onChange={e=>setEditingReq({...editingReq, employeeId:e.target.value})}
                                        >
                                            {employees.map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Leave Type</label>
                                        <select 
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                            value={editingReq.type} 
                                            onChange={e=>setEditingReq({...editingReq, type:e.target.value as any})}
                                        >
                                            <option value={AttendanceStatus.ANNUAL_LEAVE}>Annual Leave</option>
                                            <option value={AttendanceStatus.SICK_LEAVE}>Sick Leave</option>
                                            <option value={AttendanceStatus.EMERGENCY_LEAVE}>Emergency Leave</option>
                                            <option value={AttendanceStatus.UNPAID_LEAVE}>Unpaid Leave</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                        <input 
                                            type="date" 
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                            value={editingReq.startDate} 
                                            onChange={e=>setEditingReq({...editingReq, startDate:e.target.value})} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                        <input 
                                            type="date" 
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all" 
                                            value={editingReq.endDate} 
                                            onChange={e=>setEditingReq({...editingReq, endDate:e.target.value})} 
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason / Description</label>
                                        <textarea 
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all min-h-[100px]" 
                                            value={editingReq.reason} 
                                            onChange={e=>setEditingReq({...editingReq, reason:e.target.value})} 
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={() => setEditingReq(null)} 
                                        className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleUpdate} 
                                        className="neo-button bg-brand-600 text-white px-8 py-2.5 rounded-2xl font-bold shadow-lg shadow-brand-200"
                                    >
                                        Update Request
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="glass-card rounded-3xl overflow-hidden border border-white shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Period</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence mode="popLayout">
                                {filteredRequests.sort((a:any, b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((req: LeaveRequest) => {
                                    const emp = employees.find((e:any) => e.id === req.employeeId);
                                    return (
                                        <motion.tr 
                                            key={req.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="hover:bg-slate-50/50 transition-colors group"
                                        >
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[12px] font-bold text-slate-500 border border-slate-200 overflow-hidden">
                                                        {emp?.profileImage ? (
                                                            <img src={emp.profileImage} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            emp?.name?.charAt(0) || '?'
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900">{emp?.name || 'Unknown'}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{emp?.role || '-'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="text-sm font-bold text-slate-700">{req.type}</div>
                                                <div className="text-[10px] text-slate-400 italic truncate max-w-[150px]">{req.reason || 'No reason provided'}</div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                    <span>{new Date(req.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                    <ArrowRight className="w-3 h-3 text-slate-300" />
                                                    <span>{new Date(req.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold">
                                                    {Math.ceil((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} Days
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                    req.status === LeaveStatus.APPROVED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    req.status === LeaveStatus.REJECTED ? 'bg-red-50 text-red-600 border-red-100' :
                                                    'bg-orange-50 text-orange-600 border-orange-100'
                                                )}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex justify-end gap-2">
                                                    {req.status === LeaveStatus.PENDING && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleStatus(req.id!, LeaveStatus.APPROVED)}
                                                                className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                                                title="Approve"
                                                            >
                                                                <Check className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleStatus(req.id!, LeaveStatus.REJECTED)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                                title="Reject"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {canManageLeaves && (
                                                        <>
                                                            <button 
                                                                onClick={() => setEditingReq(req)}
                                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                                title="Edit Request"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(req.id!)}
                                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                                title="Delete Request"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
                {leaveRequests.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Calendar className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No leave requests</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1">All caught up! No pending leave requests to review.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const PayrollRegisterView = ({ employees, attendance, deductions, selectedMonth, onMonthChange, user, companies }: any) => {
     const [searchTerm, setSearchTerm] = useState('');
     const canManagePayroll = user?.permissions?.canManagePayroll;

     const filteredEmployees = useMemo(() => {
        return employees.filter((e: Employee) => {
            const company = companies.find((c: Company) => c.name === e.company);
            return (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                   (e.code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                   (company?.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        });
    }, [employees, searchTerm, companies]);

     // Real export functionality
     const handleExport = () => {
        const data = filteredEmployees.map((e: Employee) => {
            const monthRecs = attendance.filter((r: any) => r.employeeId === e.id && r.date.startsWith(selectedMonth));
            const monthDeds = deductions.filter((d: any) => d.employeeId === e.id && d.date.startsWith(selectedMonth));
            const p = calculatePayroll(e, monthRecs, monthDeds);
            
             const isFixedSalary = e.team === 'Office Staff' || e.team === 'Internal Team';
             const totalHours = monthRecs.reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0);

             return {
                 'Employee Code': e.code,
                 'Employee Name': e.name,
                 'Month': selectedMonth,
                 'Team': e.team,
                 'Type': isFixedSalary ? 'Fixed' : 'Hourly',
                 'Basic Salary': isFixedSalary ? p.breakdown.basic : 0,
                 'Hourly Rate': isFixedSalary ? 0 : (p.breakdown.hourlyRate || 0),
                 'Hours Worked': isFixedSalary ? 0 : totalHours,
                 'Housing': isFixedSalary ? p.breakdown.housing : 0,
                 'Transport': isFixedSalary ? p.breakdown.transport : 0,
                 'Other Allowance': isFixedSalary ? p.breakdown.other : 0,
                 'Gross Salary': p.grossSalary,
                 'Unpaid Days': p.totalUnpaidDays,
                 'Deductions': p.totalDeductions,
                 'OT Amount': p.otAmount,
                 'Net Salary': p.netSalary
             };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payroll Register");
        XLSX.writeFile(wb, `Payroll_Register_${selectedMonth}.xlsx`);
     };

     return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll Register</h2>
                    <p className="text-slate-500 text-sm mt-1">Monthly salary breakdown and net pay calculations.</p>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search staff..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-11 pr-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all w-64 shadow-sm"
                        />
                    </div>
                     <div className="relative group">
                         <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                         <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e=>onMonthChange(e.target.value)} 
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-sm" 
                         />
                     </div>
                     <button 
                        onClick={handleExport} 
                        className="neo-button bg-white text-slate-700 px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
                     >
                         <Download className="w-4 h-4" /> Export
                     </button>
                 </div>
             </div>
             
             <div className="glass-card rounded-3xl border border-white shadow-xl shadow-slate-200/50 overflow-hidden">
                 <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                         <thead>
                             <tr className="bg-slate-50/50 border-b border-slate-100">
                                 <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-white/80 backdrop-blur-md z-10">Employee</th>
                                 <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Rate/Basic</th>
                                 <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Hours/Days</th>
                                 <th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Gross</th>
                                 <th className="p-5 text-[10px] font-bold text-red-400 uppercase tracking-widest text-right">Unpaid</th>
                                 <th className="p-5 text-[10px] font-bold text-red-400 uppercase tracking-widest text-right">Deductions</th>
                                 <th className="p-5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-right">OT Pay</th>
                                 <th className="p-5 text-[10px] font-bold text-slate-900 uppercase tracking-widest text-right">Net Salary</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                             {filteredEmployees.map((e:Employee) => {
                                 const monthRecs = attendance.filter((r:any) => r.employeeId === e.id && r.date.startsWith(selectedMonth));
                                 const monthDeds = deductions.filter((d:any) => d.employeeId === e.id && d.date.startsWith(selectedMonth));
                                 const p = calculatePayroll(e, monthRecs, monthDeds);
                                 
                                 const isFixedSalary = e.team === 'Office Staff' || e.team === 'Internal Team';
                                 const totalHours = monthRecs.reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0);
                                 
                                 return (
                                     <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                                         <td className="p-5 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors z-10 border-r border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-[10px] font-bold text-brand-600 overflow-hidden">
                                                    {e.profileImage ? (
                                                        <img src={e.profileImage} alt={e.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        e.name.charAt(0)
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900">{e.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{isFixedSalary ? 'Fixed Salary' : 'Hourly Rate'}</div>
                                                </div>
                                            </div>
                                         </td>
                                         <td className="p-5 text-right text-sm font-bold text-slate-700">
                                             {isFixedSalary ? p.breakdown.basic.toLocaleString() : (p.breakdown.hourlyRate || 0).toLocaleString()}
                                         </td>
                                         <td className="p-5 text-right text-sm text-slate-500">
                                             {isFixedSalary ? '30 Days' : `${totalHours} Hours`}
                                         </td>
                                         <td className="p-5 text-right text-sm font-bold text-slate-900">{p.grossSalary.toLocaleString()}</td>
                                         <td className="p-5 text-right text-sm font-bold text-red-500">{p.totalUnpaidDays}</td>
                                         <td className="p-5 text-right text-sm font-bold text-red-600">-{p.totalDeductions.toFixed(0)}</td>
                                         <td className="p-5 text-right text-sm font-bold text-emerald-600">+{p.otAmount.toFixed(0)}</td>
                                         <td className="p-5 text-right">
                                            <div className="inline-block px-4 py-1.5 bg-brand-50 text-brand-700 rounded-xl text-sm font-black border border-brand-100">
                                                {p.netSalary.toFixed(0)}
                                            </div>
                                         </td>
                                     </tr>
                                 )
                             })}
                         </tbody>
                     </table>
                 </div>
             </div>
        </div>
     );
};

const ReportsView = ({ 
    employees, attendance, leaveRequests, deductions, 
    projects, accountsPayable, accountsReceivable, pettyCash,
    everydayExpenses, projectedExpenses,
    suppliers, vendors, user 
}: any) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [reportType, setReportType] = useState('staff');

    const [year, month] = selectedMonth.split('-').map(Number);
    const currentMonth = month - 1;
    const currentYear = year;
    const monthName = new Date(year, currentMonth).toLocaleString('default', { month: 'long' });

    const activeStaff = useMemo(() => employees.filter((e: any) => e.active), [employees]);
    
    // Filtered data based on selected month
    const monthlyAttendance = useMemo(() => attendance.filter((r: any) => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [attendance, currentMonth, currentYear]);

    const monthlyDeductions = useMemo(() => deductions.filter((d: any) => {
        const date = new Date(d.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }), [deductions, currentMonth, currentYear]);

    const monthlyAP = useMemo(() => accountsPayable.filter((ap: any) => {
        const d = new Date(ap.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [accountsPayable, currentMonth, currentYear]);

    const monthlyAR = useMemo(() => accountsReceivable.filter((ar: any) => {
        const d = new Date(ar.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [accountsReceivable, currentMonth, currentYear]);

    const monthlyPettyCash = useMemo(() => pettyCash.filter((pc: any) => {
        const d = new Date(pc.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [pettyCash, currentMonth, currentYear]);

    const monthlyEveryday = useMemo(() => (everydayExpenses || []).filter((ee: any) => {
        const d = new Date(ee.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [everydayExpenses, currentMonth, currentYear]);

    const monthlyProjected = useMemo(() => (projectedExpenses || []).filter((pe: any) => {
        const d = new Date(pe.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [projectedExpenses, currentMonth, currentYear]);

    const payrollData = useMemo(() => {
        return activeStaff.map((e: any) => {
            const empAttendance = monthlyAttendance.filter((r: any) => r.employeeId === e.id);
            const empDeductions = monthlyDeductions.filter((d: any) => d.employeeId === e.id);
            return {
                employee: e,
                payroll: calculatePayroll(e, empAttendance, empDeductions)
            };
        });
    }, [activeStaff, monthlyAttendance, monthlyDeductions]);

    const stats = useMemo(() => {
        const totalGross = payrollData.reduce((acc, p) => acc + p.payroll.grossSalary + p.payroll.otAmount, 0);
        const totalNet = payrollData.reduce((acc, p) => acc + p.payroll.netSalary, 0);
        const totalDeductions = payrollData.reduce((acc, p) => acc + p.payroll.totalDeductions, 0);
        
        const totalPayable = monthlyAP.reduce((acc, ap) => acc + ap.amount, 0);
        const totalReceivable = monthlyAR.reduce((acc, ar) => acc + ar.amount, 0);
        
        const totalVatReceivable = monthlyAR.reduce((acc, ar) => acc + (ar.vatAmount || 0), 0);
        const totalVatPayable = monthlyAP.reduce((acc, ap) => acc + (ap.vatAmount || 0), 0);
        const totalVatEveryday = monthlyEveryday.reduce((acc, ee) => acc + (ee.vatAmount || 0), 0);
        const totalVatProjected = monthlyProjected.reduce((acc, pe) => acc + (pe.vatAmount || 0), 0);

        const vatPayableAmount = totalVatReceivable - totalVatPayable - totalVatEveryday;

        const pettyCashIn = monthlyPettyCash.filter(pc => pc.type === 'Income').reduce((acc, pc) => acc + pc.amount, 0);
        const pettyCashOut = monthlyPettyCash.filter(pc => pc.type === 'Expense').reduce((acc, pc) => acc + pc.amount, 0);

        const totalEveryday = monthlyEveryday.reduce((acc, ee) => acc + ee.totalAmount, 0);
        const totalProjected = monthlyProjected.reduce((acc, pe) => acc + pe.totalAmount, 0);

        return { 
            totalGross, totalNet, totalDeductions, 
            totalPayable, totalReceivable, 
            totalVatReceivable, totalVatPayable, totalVatEveryday, totalVatProjected,
            vatPayableAmount,
            pettyCashIn, pettyCashOut,
            totalEveryday, totalProjected
        };
    }, [payrollData, monthlyAP, monthlyAR, monthlyPettyCash, monthlyEveryday, monthlyProjected]);

    const handleExport = () => {
        let data: any[] = [];
        let fileName = `Pioneer_${reportType}_Report_${monthName}_${currentYear}`;

        switch (reportType) {
            case 'staff':
                data = activeStaff.map((e: any) => ({
                    'Code': e.code,
                    'Name': e.name,
                    'Company': e.company,
                    'Department': e.department,
                    'Team': e.team,
                    'Designation': e.designation,
                    'Gross Salary': e.salary.basic + e.salary.housing + e.salary.transport + e.salary.other,
                    'Joining Date': e.joiningDate
                }));
                break;
            case 'attendance':
                data = activeStaff.map((e: any) => {
                    const empAtt = monthlyAttendance.filter(r => r.employeeId === e.id);
                    const present = empAtt.filter(r => r.status === AttendanceStatus.PRESENT).length;
                    const absent = empAtt.filter(r => r.status === AttendanceStatus.ABSENT).length;
                    const otHours = empAtt.reduce((acc, r) => acc + (r.overtimeHours || 0), 0);
                    return {
                        'Code': e.code,
                        'Name': e.name,
                        'Present Days': present,
                        'Absent Days': absent,
                        'OT Hours': otHours,
                        'Total Days Logged': empAtt.length
                    };
                });
                break;
            case 'payroll':
                data = payrollData.map(p => ({
                    'Code': p.employee.code,
                    'Name': p.employee.name,
                    'Gross Salary': p.payroll.grossSalary,
                    'OT Amount': p.payroll.otAmount,
                    'Deductions': p.payroll.totalDeductions,
                    'Net Salary': p.payroll.netSalary
                }));
                break;
            case 'projects':
                data = projects.map((p: any) => {
                    const projectStaff = activeStaff.filter((e: any) => e.team === p.name);
                    const projectAR = monthlyAR.filter(ar => (ar.entityId || ar.projectId) === p.id && (ar.entityType || 'Project') === 'Project').reduce((acc, ar) => acc + ar.amount, 0);
                    const projectAP = monthlyAP.filter(ap => ap.projectId === p.id).reduce((acc, ap) => acc + ap.amount, 0);
                    return {
                        'Project Name': p.name,
                        'Client': p.clientName,
                        'Status': p.status,
                        'Staff Count': projectStaff.length,
                        'Monthly Revenue': projectAR,
                        'Monthly Expense': projectAP,
                        'Net Profit/Loss': projectAR - projectAP
                    };
                });
                break;
            case 'finance':
                data = [
                    ...monthlyAP.map(ap => ({ 
                        Type: 'Payable', 
                        Date: ap.date, 
                        Ref: ap.invoiceNumber, 
                        Entity: ap.vendorType === 'Supplier' 
                            ? (suppliers.find((s: any) => s.id === ap.vendorId)?.name || 'Unknown Supplier')
                            : (vendors.find((v: any) => v.id === ap.vendorId)?.name || 'Unknown Client'), 
                        Amount: ap.amount, 
                        Status: ap.status 
                    })),
                    ...monthlyAR.map(ar => {
                        const type = ar.entityType || 'Project';
                        const id = ar.entityId || ar.projectId;
                        let entityName = 'Unknown';
                        if (type === 'Project') entityName = projects.find((p: any) => p.id === id)?.clientName || 'Unknown Client';
                        else if (type === 'Supplier') entityName = suppliers.find((s: any) => s.id === id)?.name || 'Unknown Supplier';
                        else if (type === 'Vendor') entityName = vendors.find((v: any) => v.id === id)?.name || 'Unknown Client';

                        return { 
                            Type: 'Receivable', 
                            Date: ar.date, 
                            Ref: ar.invoiceNumber, 
                            Entity: entityName, 
                            Amount: ar.amount, 
                            Status: ar.status 
                        };
                    }),
                    ...monthlyPettyCash.map(pc => ({ 
                        Type: `Petty Cash (${pc.type === 'Income' ? 'In' : 'Out'})`, 
                        Date: pc.date, 
                        Ref: pc.description, 
                        Entity: pc.requestedBy || pc.receivedFrom, 
                        Amount: pc.amount, 
                        Status: 'Completed' 
                    })),
                    ...monthlyEveryday.map(ee => ({
                        Type: 'Everyday Expense',
                        Date: ee.date,
                        Ref: ee.invoiceNo,
                        Entity: ee.shopName || ee.supplierName,
                        Amount: ee.totalAmount,
                        Status: 'Completed'
                    })),
                    ...monthlyProjected.map(pe => ({
                        Type: 'Projected Expense',
                        Date: pe.date,
                        Ref: pe.invoiceNumber,
                        Entity: pe.clientName,
                        Amount: pe.totalAmount,
                        Status: 'Projected'
                    }))
                ];
                break;
            case 'everyday':
                data = monthlyEveryday.map(ee => ({
                    'Date': ee.date,
                    'Invoice No': ee.invoiceNo,
                    'TRN No': ee.trnNo,
                    'Shop/Supplier': ee.shopName || ee.supplierName,
                    'Client': ee.clientName,
                    'Bill Amount': ee.billAmount,
                    'VAT Amount': ee.vatAmount,
                    'Total Amount': ee.totalAmount,
                    'Description': ee.description
                }));
                break;
            case 'projected':
                data = monthlyProjected.map(pe => ({
                    'Date': pe.date,
                    'Invoice No': pe.invoiceNumber,
                    'Client': pe.clientName,
                    'Location': pe.siteLocation,
                    'Work Description': pe.workDescription,
                    'Actual Amount': pe.actualAmount,
                    'VAT Amount': pe.vatAmount,
                    'Total Amount': pe.totalAmount
                }));
                break;
            case 'summary':
                data = [
                    { 'Category': 'TOTAL INCOME', 'Amount': stats.totalReceivable + stats.pettyCashIn, 'Description': 'Accounts Receivable + Petty Cash In' },
                    { 'Category': 'TOTAL EXPENSES', 'Amount': stats.totalPayable + stats.pettyCashOut + stats.totalEveryday + stats.totalNet, 'Description': 'AP + Petty Cash Out + Everyday + Payroll' },
                    { 'Category': '', 'Amount': null, 'Description': '' },
                    { 'Category': 'VAT SUMMARY (UAE VAT FILING)', 'Amount': null, 'Description': '' },
                    { 'Category': 'Output VAT (Receivables)', 'Amount': stats.totalVatReceivable, 'Description': 'VAT from Accounts Receivable' },
                    { 'Category': 'Input VAT (Payables)', 'Amount': stats.totalVatPayable, 'Description': 'VAT from Accounts Payable' },
                    { 'Category': 'Input VAT (Everyday Expenses)', 'Amount': stats.totalVatEveryday, 'Description': 'VAT from Everyday Expenses' },
                    { 'Category': 'TOTAL VAT PAYABLE', 'Amount': stats.vatPayableAmount, 'Description': 'Output VAT - Input VAT (AP) - Input VAT (Everyday)' }
                ];
                break;
            case 'pl':
                data = [
                    { 'Category': 'REVENUE', 'Amount': null },
                    { 'Category': 'Accounts Receivable', 'Amount': stats.totalReceivable },
                    { 'Category': 'Petty Cash Income', 'Amount': stats.pettyCashIn },
                    { 'Category': 'TOTAL REVENUE', 'Amount': stats.totalReceivable + stats.pettyCashIn },
                    { 'Category': '', 'Amount': null },
                    { 'Category': 'DIRECT COSTS', 'Amount': null },
                    { 'Category': 'Accounts Payable', 'Amount': stats.totalPayable },
                    { 'Category': 'Everyday Expenses', 'Amount': stats.totalEveryday },
                    { 'Category': 'Projected Expenses', 'Amount': stats.totalProjected },
                    { 'Category': 'TOTAL DIRECT COSTS', 'Amount': stats.totalPayable + stats.totalEveryday + stats.totalProjected },
                    { 'Category': '', 'Amount': null },
                    { 'Category': 'OPERATING EXPENSES', 'Amount': null },
                    { 'Category': 'Payroll (Net Salary)', 'Amount': stats.totalNet },
                    { 'Category': 'Petty Cash Expenses', 'Amount': stats.pettyCashOut },
                    { 'Category': 'TOTAL OPERATING EXPENSES', 'Amount': stats.totalNet + stats.pettyCashOut },
                    { 'Category': '', 'Amount': null },
                    { 'Category': 'NET PROFIT', 'Amount': (stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut) }
                ];
                break;
            case 'corporate_tax':
                const netProfit = (stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut);
                const taxThreshold = 375000;
                const taxableAmount = Math.max(0, netProfit - taxThreshold);
                const taxDue = taxableAmount * 0.09;
                data = [
                    { 'Tax Metric': 'Statement of Taxable Income', 'Value': null },
                    { 'Tax Metric': 'Gross Revenue', 'Value': stats.totalReceivable + stats.pettyCashIn },
                    { 'Tax Metric': 'Total Deductible Expenses', 'Value': stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut },
                    { 'Tax Metric': 'Net Accounting Profit', 'Value': netProfit },
                    { 'Tax Metric': '', 'Value': null },
                    { 'Tax Metric': 'CORPORATE TAX CALCULATION (UAE)', 'Value': null },
                    { 'Tax Metric': 'Statutory Tax Threshold', 'Value': taxThreshold },
                    { 'Tax Metric': 'Taxable Income (Above Threshold)', 'Value': taxableAmount },
                    { 'Tax Metric': 'Corporate Tax Rate', 'Value': '9%' },
                    { 'Tax Metric': 'ESTIMATED CORPORATE TAX DUE', 'Value': taxDue },
                    { 'Tax Metric': '', 'Value': null },
                    { 'Tax Metric': 'Net Profit After Tax', 'Value': netProfit - taxDue }
                ];
                break;
            case 'trial_balance':
                data = [
                    { 'Account Name': 'Accounts Receivable', 'Debit': stats.totalReceivable, 'Credit': 0 },
                    { 'Account Name': 'Petty Cash', 'Debit': stats.pettyCashIn, 'Credit': stats.pettyCashOut },
                    { 'Account Name': 'Accounts Payable', 'Debit': 0, 'Credit': stats.totalPayable },
                    { 'Account Name': 'Everyday Expenses', 'Debit': stats.totalEveryday, 'Credit': 0 },
                    { 'Account Name': 'Projected Expenses', 'Debit': stats.totalProjected, 'Credit': 0 },
                    { 'Account Name': 'Payroll Liability', 'Debit': 0, 'Credit': stats.totalNet },
                    { 'Account Name': 'TOTAL', 'Debit': stats.totalReceivable + stats.pettyCashIn + stats.totalEveryday + stats.totalProjected, 'Credit': stats.totalPayable + stats.totalNet + stats.pettyCashOut }
                ];
                break;
            case 'balance_sheet':
                const arPending = monthlyAR.filter(ar => ar.status === 'Pending').reduce((acc, ar) => acc + ar.totalAmount, 0);
                const apPending = monthlyAP.filter(ap => ap.status === 'Pending').reduce((acc, ap) => acc + ap.totalAmount, 0);
                const cashBalance = stats.pettyCashIn - stats.pettyCashOut;
                data = [
                    { 'Category': 'ASSETS', 'Amount': null },
                    { 'Category': 'Cash on Hand (Petty Cash)', 'Amount': cashBalance },
                    { 'Category': 'Accounts Receivable (Pending)', 'Amount': arPending },
                    { 'Category': 'TOTAL ASSETS', 'Amount': cashBalance + arPending },
                    { 'Category': '', 'Amount': null },
                    { 'Category': 'LIABILITIES', 'Amount': null },
                    { 'Category': 'Accounts Payable (Pending)', 'Amount': apPending },
                    { 'Category': 'Accrued Payroll', 'Amount': stats.totalNet },
                    { 'Category': 'TOTAL LIABILITIES', 'Amount': apPending + stats.totalNet },
                    { 'Category': '', 'Amount': null },
                    { 'Category': 'EQUITY', 'Amount': null },
                    { 'Category': 'Retained Earnings', 'Amount': (cashBalance + arPending) - (apPending + stats.totalNet) },
                    { 'Category': 'TOTAL EQUITY', 'Amount': (cashBalance + arPending) - (apPending + stats.totalNet) }
                ];
                break;
            case 'cash_flow':
                const arReceived = monthlyAR.filter(ar => ar.status === 'Received').reduce((acc, ar) => acc + ar.totalAmount, 0);
                const apPaid = monthlyAP.filter(ap => ap.status === 'Paid').reduce((acc, ap) => acc + ap.totalAmount, 0);
                data = [
                    { 'Activity': 'CASH FLOW FROM OPERATING ACTIVITIES', 'Amount': null },
                    { 'Activity': 'Cash Received from Customers', 'Amount': arReceived + stats.pettyCashIn },
                    { 'Activity': 'Cash Paid to Suppliers', 'Amount': -(apPaid + stats.totalEveryday) },
                    { 'Activity': 'Cash Paid for Payroll', 'Amount': -stats.totalNet },
                    { 'Activity': 'Cash Paid for Petty Expenses', 'Amount': -stats.pettyCashOut },
                    { 'Activity': 'NET CASH FROM OPERATING ACTIVITIES', 'Amount': (arReceived + stats.pettyCashIn) - (apPaid + stats.totalEveryday + stats.totalNet + stats.pettyCashOut) }
                ];
                break;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const reportOptions = [
        { id: 'summary', label: 'Summary', icon: BarChart2 },
        { id: 'pl', label: 'P & L / Income Statement', icon: Activity },
        { id: 'trial_balance', label: 'Trial Balance', icon: Scale },
        { id: 'balance_sheet', label: 'Balance Sheet', icon: Landmark },
        { id: 'cash_flow', label: 'Cash Flow', icon: RefreshCw },
        { id: 'corporate_tax', label: 'Financial Statement (Corporate Tax)', icon: FileText },
        { id: 'staff', label: 'Workforce', icon: Users },
        { id: 'attendance', label: 'Attendance', icon: Calendar },
        { id: 'payroll', label: 'Payroll', icon: Wallet },
        { id: 'projects', label: 'Projects', icon: Briefcase },
        { id: 'finance', label: 'Finance', icon: TrendingUp },
        { id: 'everyday', label: 'Everyday', icon: CreditCard },
        { id: 'projected', label: 'Projected', icon: BarChart3 },
    ];

    return (
        <div className="space-y-8 pb-12">
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print"
            >
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Hub</h2>
                    <p className="text-slate-500 font-medium">Comprehensive analytics for <span className="text-brand-600 font-bold">{monthName} {currentYear}</span>.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                        {reportOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setReportType(opt.id)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                    reportType === opt.id 
                                        ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" 
                                        : "text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                <opt.icon className="w-3.5 h-3.5" />
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExport}
                            className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            title="Export to Excel"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="p-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20"
                            title="Print Report"
                        >
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Print Header (Only visible in print) */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900">PIONEER DMS</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Official Business Report</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold text-slate-900">{reportOptions.find(o => o.id === reportType)?.label} Report</h2>
                        <p className="text-slate-500 font-medium">{monthName} {currentYear}</p>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {reportType === 'summary' && [
                    { label: 'Total Income', value: `AED ${(stats.totalReceivable + stats.pettyCashIn).toLocaleString()}`, icon: TrendingUp, color: 'emerald' },
                    { label: 'Total Expenses', value: `AED ${(stats.totalPayable + stats.pettyCashOut + stats.totalEveryday + stats.totalNet).toLocaleString()}`, icon: TrendingDown, color: 'rose' },
                    { label: 'VAT Payable', value: `AED ${stats.vatPayableAmount.toLocaleString()}`, icon: ShieldCheck, color: 'brand' },
                    { label: 'Net Profit', value: `AED ${(stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.pettyCashOut + stats.totalEveryday + stats.totalNet)).toLocaleString()}`, icon: Activity, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'pl' && [
                    { label: 'Total Revenue', value: `AED ${(stats.totalReceivable + stats.pettyCashIn).toLocaleString()}`, icon: TrendingUp, color: 'emerald' },
                    { label: 'Direct Costs', value: `AED ${(stats.totalPayable + stats.totalEveryday + stats.totalProjected).toLocaleString()}`, icon: TrendingDown, color: 'rose' },
                    { label: 'Operating Exp', value: `AED ${(stats.totalNet + stats.pettyCashOut).toLocaleString()}`, icon: CreditCard, color: 'orange' },
                    { label: 'Net Profit', value: `AED ${(stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)).toLocaleString()}`, icon: Activity, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'corporate_tax' && [
                    { label: 'Accounting Profit', value: `AED ${((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)).toLocaleString()}`, icon: Activity, color: 'brand' },
                    { label: 'Taxable Income', value: `AED ${Math.max(0, ((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - 375000).toLocaleString()}`, icon: Calculator, color: 'orange' },
                    { label: 'Estimated Tax', value: `AED ${(Math.max(0, ((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - 375000) * 0.09).toLocaleString()}`, icon: ShieldAlert, color: 'rose' },
                    { label: 'Profit After Tax', value: `AED ${(((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - (Math.max(0, ((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - 375000) * 0.09)).toLocaleString()}`, icon: CheckCircle, color: 'emerald' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'trial_balance' && [
                    { label: 'Total Debits', value: `AED ${(stats.totalReceivable + stats.pettyCashIn + stats.totalEveryday + stats.totalProjected).toLocaleString()}`, icon: Scale, color: 'brand' },
                    { label: 'Total Credits', value: `AED ${(stats.totalPayable + stats.totalNet + stats.pettyCashOut).toLocaleString()}`, icon: Scale, color: 'rose' },
                    { label: 'Petty Cash Bal', value: `AED ${(stats.pettyCashIn - stats.pettyCashOut).toLocaleString()}`, icon: Wallet, color: 'emerald' },
                    { label: 'Net Position', value: `AED ${(stats.totalReceivable + stats.pettyCashIn + stats.totalEveryday + stats.totalProjected - (stats.totalPayable + stats.totalNet + stats.pettyCashOut)).toLocaleString()}`, icon: Activity, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'balance_sheet' && [
                    { label: 'Total Assets', value: `AED ${(stats.pettyCashIn - stats.pettyCashOut + monthlyAR.filter(ar => ar.status === 'Pending').reduce((acc, ar) => acc + ar.totalAmount, 0)).toLocaleString()}`, icon: Landmark, color: 'emerald' },
                    { label: 'Total Liabilities', value: `AED ${(monthlyAP.filter(ap => ap.status === 'Pending').reduce((acc, ap) => acc + ap.totalAmount, 0) + stats.totalNet).toLocaleString()}`, icon: TrendingDown, color: 'rose' },
                    { label: 'Retained Earnings', value: `AED ${(stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)).toLocaleString()}`, icon: Activity, color: 'brand' },
                    { label: 'Net Equity', value: `AED ${(stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)).toLocaleString()}`, icon: ShieldCheck, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'cash_flow' && [
                    { label: 'Cash Inflow', value: `AED ${(monthlyAR.filter(ar => ar.status === 'Received').reduce((acc, ar) => acc + ar.totalAmount, 0) + stats.pettyCashIn).toLocaleString()}`, icon: ArrowUpRight, color: 'emerald' },
                    { label: 'Cash Outflow', value: `AED ${(monthlyAP.filter(ap => ap.status === 'Paid').reduce((acc, ap) => acc + ap.totalAmount, 0) + stats.totalEveryday + stats.totalNet + stats.pettyCashOut).toLocaleString()}`, icon: ArrowDownRight, color: 'rose' },
                    { label: 'Net Cash Flow', value: `AED ${(monthlyAR.filter(ar => ar.status === 'Received').reduce((acc, ar) => acc + ar.totalAmount, 0) + stats.pettyCashIn - (monthlyAP.filter(ap => ap.status === 'Paid').reduce((acc, ap) => acc + ap.totalAmount, 0) + stats.totalEveryday + stats.totalNet + stats.pettyCashOut)).toLocaleString()}`, icon: RefreshCw, color: 'brand' },
                    { label: 'Cash Position', value: `AED ${(stats.pettyCashIn - stats.pettyCashOut).toLocaleString()}`, icon: Wallet, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'staff' && [
                    { label: 'Total Staff', value: activeStaff.length, icon: Users, color: 'brand' },
                    { label: 'Departments', value: new Set(activeStaff.map((e: any) => e.department)).size, icon: LayoutGrid, color: 'emerald' },
                    { label: 'Teams', value: new Set(activeStaff.map((e: any) => e.team)).size, icon: Briefcase, color: 'orange' },
                    { label: 'Avg Salary', value: `AED ${Math.round(stats.totalGross / (activeStaff.length || 1)).toLocaleString()}`, icon: Wallet, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'attendance' && [
                    { label: 'Total Logs', value: monthlyAttendance.length, icon: Calendar, color: 'brand' },
                    { label: 'Present Days', value: monthlyAttendance.filter(r => r.status === AttendanceStatus.PRESENT).length, icon: CheckCircle, color: 'emerald' },
                    { label: 'Absent Days', value: monthlyAttendance.filter(r => r.status === AttendanceStatus.ABSENT).length, icon: XCircle, color: 'orange' },
                    { label: 'OT Hours', value: monthlyAttendance.reduce((acc, r) => acc + (r.overtimeHours || 0), 0), icon: Clock, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'payroll' && [
                    { label: 'Gross Salary', value: `AED ${stats.totalGross.toLocaleString()}`, icon: Wallet, color: 'brand' },
                    { label: 'Net Payout', value: `AED ${stats.totalNet.toLocaleString()}`, icon: CreditCard, color: 'emerald' },
                    { label: 'Deductions', value: `AED ${stats.totalDeductions.toLocaleString()}`, icon: TrendingDown, color: 'orange' },
                    { label: 'Avg Payout', value: `AED ${Math.round(stats.totalNet / (activeStaff.length || 1)).toLocaleString()}`, icon: TrendingUp, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'projects' && [
                    { label: 'Active Projects', value: projects.filter((p: any) => p.status === 'Active').length, icon: Briefcase, color: 'brand' },
                    { label: 'Total Revenue', value: `AED ${stats.totalReceivable.toLocaleString()}`, icon: TrendingUp, color: 'emerald' },
                    { label: 'Total Expense', value: `AED ${stats.totalPayable.toLocaleString()}`, icon: TrendingDown, color: 'orange' },
                    { label: 'Net Margin', value: `AED ${(stats.totalReceivable - stats.totalPayable).toLocaleString()}`, icon: Activity, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'finance' && [
                    { label: 'Receivables', value: `AED ${stats.totalReceivable.toLocaleString()}`, icon: TrendingUp, color: 'emerald' },
                    { label: 'Payables', value: `AED ${stats.totalPayable.toLocaleString()}`, icon: TrendingDown, color: 'orange' },
                    { label: 'Petty Cash In', value: `AED ${stats.pettyCashIn.toLocaleString()}`, icon: ArrowUpRight, color: 'brand' },
                    { label: 'Petty Cash Out', value: `AED ${stats.pettyCashOut.toLocaleString()}`, icon: ArrowDownRight, color: 'rose' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'everyday' && [
                    { label: 'Total Expenses', value: `AED ${stats.totalEveryday.toLocaleString()}`, icon: CreditCard, color: 'brand' },
                    { label: 'Total Bills', value: monthlyEveryday.length, icon: FileText, color: 'emerald' },
                    { label: 'Avg Bill', value: `AED ${Math.round(stats.totalEveryday / (monthlyEveryday.length || 1)).toLocaleString()}`, icon: Activity, color: 'orange' },
                    { label: 'VAT Total', value: `AED ${monthlyEveryday.reduce((acc, ee) => acc + ee.vatAmount, 0).toLocaleString()}`, icon: TrendingUp, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}

                {reportType === 'projected' && [
                    { label: 'Projected Total', value: `AED ${stats.totalProjected.toLocaleString()}`, icon: BarChart3, color: 'brand' },
                    { label: 'Total Items', value: monthlyProjected.length, icon: ListFilter, color: 'emerald' },
                    { label: 'Actual Amt', value: `AED ${monthlyProjected.reduce((acc, pe) => acc + pe.actualAmount, 0).toLocaleString()}`, icon: Wallet, color: 'orange' },
                    { label: 'VAT Total', value: `AED ${monthlyProjected.reduce((acc, pe) => acc + pe.vatAmount, 0).toLocaleString()}`, icon: TrendingUp, color: 'violet' },
                ].map((stat, i) => <StatCard key={i} {...stat} delay={i * 0.1} />)}
            </div>

            {/* Main Content Table */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card rounded-[2.5rem] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                {reportType === 'staff' && ['Code', 'Name', 'Company', 'Department', 'Designation', 'Gross Salary'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'attendance' && ['Code', 'Name', 'Present', 'Absent', 'OT Hours', 'Status'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'payroll' && ['Code', 'Name', 'Gross', 'OT Amt', 'Deductions', 'Net Salary'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'projects' && ['Project', 'Client', 'Staff', 'Revenue', 'Expense', 'Margin'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'finance' && ['Type', 'Date', 'Reference', 'Entity', 'Amount', 'Status'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'everyday' && ['Date', 'Invoice', 'Shop/Supplier', 'Client', 'Amount', 'VAT'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'projected' && ['Date', 'Invoice', 'Client', 'Location', 'Amount', 'VAT'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'pl' && ['Category', 'Amount', 'Percentage'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'corporate_tax' && ['Tax Component', 'Value (AED)', 'Compliance Note'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'trial_balance' && ['Account Name', 'Debit (AED)', 'Credit (AED)'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'balance_sheet' && ['Category', 'Amount (AED)', 'Notes'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'cash_flow' && ['Activity Description', 'Cash Inflow', 'Cash Outflow', 'Net Cash'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                                {reportType === 'summary' && ['Category', 'Amount', 'Description'].map(h => <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {reportType === 'summary' && (
                                <>
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">General Summary</td></tr>
                                    {[
                                        { c: 'TOTAL INCOME', a: stats.totalReceivable + stats.pettyCashIn, d: 'Accounts Receivable + Petty Cash In' },
                                        { c: 'TOTAL EXPENSES', a: stats.totalPayable + stats.pettyCashOut + stats.totalEveryday + stats.totalNet, d: 'AP + Petty Cash Out + Everyday + Payroll' },
                                        { c: 'NET PROFIT/LOSS', a: (stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.pettyCashOut + stats.totalEveryday + stats.totalNet), d: 'Overall Performance' }
                                    ].map((r, i) => (
                                        <tr key={i} className={cn("border-b border-slate-50 hover:bg-slate-50/50 transition-colors", r.c === 'NET PROFIT/LOSS' && "bg-slate-900 text-white")}>
                                            <td className="px-6 py-4 text-sm font-bold">{r.c}</td>
                                            <td className={cn("px-6 py-4 text-sm font-black", r.c === 'NET PROFIT/LOSS' ? "text-brand-400" : "text-brand-600")}>AED {r.a?.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-500">{r.d}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">UAE VAT Filing Summary (5%)</td></tr>
                                    {[
                                        { c: 'Output VAT', a: stats.totalVatReceivable, d: 'VAT from Receivables' },
                                        { c: 'Input VAT', a: stats.totalVatPayable + stats.totalVatEveryday, d: 'VAT from Payables & Expenses' },
                                        { c: 'TOTAL VAT PAYABLE', a: stats.vatPayableAmount, d: 'Output - Input' }
                                    ].map((r, i) => (
                                        <tr key={i} className={cn("border-b border-slate-50 hover:bg-slate-50/50 transition-colors", r.c === 'TOTAL VAT PAYABLE' && "bg-brand-600 text-white")}>
                                            <td className="px-6 py-4 text-sm font-bold">{r.c}</td>
                                            <td className={cn("px-6 py-4 text-sm font-black", r.c === 'TOTAL VAT PAYABLE' ? "text-white" : "text-slate-900")}>AED {r.a?.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-500">{r.d}</td>
                                        </tr>
                                    ))}
                                </>
                            )}

                            {reportType === 'pl' && (
                                <>
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</td></tr>
                                    {[
                                        { l: 'Accounts Receivable', v: stats.totalReceivable },
                                        { l: 'Petty Cash Income', v: stats.pettyCashIn }
                                    ].map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.l}</td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600">AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{((r.v / (stats.totalReceivable + stats.pettyCashIn || 1)) * 100).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Costs</td></tr>
                                    {[
                                        { l: 'Accounts Payable', v: stats.totalPayable },
                                        { l: 'Everyday Expenses', v: stats.totalEveryday },
                                        { l: 'Projected Expenses', v: stats.totalProjected }
                                    ].map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.l}</td>
                                            <td className="px-6 py-4 text-sm font-black text-rose-600">AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{((r.v / (stats.totalReceivable + stats.pettyCashIn || 1)) * 100).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operating Expenses</td></tr>
                                    {[
                                        { l: 'Payroll (Net Salary)', v: stats.totalNet },
                                        { l: 'Petty Cash Expenses', v: stats.pettyCashOut }
                                    ].map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.l}</td>
                                            <td className="px-6 py-4 text-sm font-black text-orange-600">AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{((r.v / (stats.totalReceivable + stats.pettyCashIn || 1)) * 100).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-brand-600 text-white">
                                        <td className="px-6 py-5 text-sm font-black uppercase">Net Profit</td>
                                        <td className="px-6 py-5 text-lg font-black">AED {(stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-xs font-black text-brand-200">{(((stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) / (stats.totalReceivable + stats.pettyCashIn || 1)) * 100).toFixed(1)}% Margin</td>
                                    </tr>
                                </>
                            )}

                            {reportType === 'corporate_tax' && (
                                <>
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Summary</td></tr>
                                    {[
                                        { l: 'Total Gross Revenue', v: stats.totalReceivable + stats.pettyCashIn, n: 'Total income generated from all sources' },
                                        { l: 'Total Deductible Expenses', v: stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut, n: 'Business related operational costs' },
                                        { l: 'NET ACCOUNTING PROFIT', v: (stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut), n: 'Profit before any tax adjustments' }
                                    ].map((r, i) => (
                                        <tr key={i} className={cn("border-b border-slate-50", r.l === 'NET ACCOUNTING PROFIT' && "bg-slate-50/50")}>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700 font-mono tracking-tight">{r.l}</td>
                                            <td className={cn("px-6 py-4 text-sm font-black", r.l === 'NET ACCOUNTING PROFIT' ? "text-brand-600" : "text-slate-900")}>AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400 italic">{r.n}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxable Income Calculation (Federal Tax Authority)</td></tr>
                                    {[
                                        { l: 'Taxable Income Threshold', v: 375000, n: 'Standard UAE CT Exemption (0%)' },
                                        { l: 'Total Taxable Amount', v: Math.max(0, ((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - 375000), n: 'Balance subject to 9% statutory rate' },
                                        { l: 'ESTIMATED CORPORATE TAX DUE', v: Math.max(0, ((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - 375000) * 0.09, n: 'Computed tax liability for the period' }
                                    ].map((r, i) => (
                                        <tr key={i} className={cn("border-b border-slate-50", r.l.includes('DUE') && "bg-rose-50/50")}>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700 font-mono tracking-tight">{r.l}</td>
                                            <td className={cn("px-6 py-4 text-sm font-black", r.l.includes('DUE') ? "text-rose-600" : "text-slate-900")}>AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400 italic">{r.n}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-brand-900 text-white shadow-inner">
                                        <td className="px-6 py-6 text-sm font-black uppercase tracking-widest">Adjusted Net Profit (Post-Tax)</td>
                                        <td className="px-6 py-6 text-xl font-black text-brand-400">AED {((stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - (Math.max(0, ((stats.totalReceivable + stats.pettyCashIn) - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)) - 375000) * 0.09)).toLocaleString()}</td>
                                        <td className="px-6 py-6 text-xs font-black text-brand-300 opacity-80 uppercase tracking-tighter">Final Retained Earnings</td>
                                    </tr>
                                </>
                            )}

                            {reportType === 'trial_balance' && [
                                { n: 'Accounts Receivable', d: stats.totalReceivable, c: 0 },
                                { n: 'Petty Cash', d: stats.pettyCashIn, c: stats.pettyCashOut },
                                { n: 'Accounts Payable', d: 0, c: stats.totalPayable },
                                { n: 'Everyday Expenses', d: stats.totalEveryday, c: 0 },
                                { n: 'Projected Expenses', d: stats.totalProjected, c: 0 },
                                { n: 'Payroll Liability', d: 0, c: stats.totalNet },
                                { n: 'TOTAL', d: stats.totalReceivable + stats.pettyCashIn + stats.totalEveryday + stats.totalProjected, c: stats.totalPayable + stats.totalNet + stats.pettyCashOut }
                            ].map((r, i) => (
                                <tr key={i} className={cn("border-b border-slate-50", r.n === 'TOTAL' && "bg-slate-900 text-white")}>
                                    <td className="px-6 py-4 text-sm font-bold">{r.n}</td>
                                    <td className="px-6 py-4 text-sm font-black text-emerald-600">{r.d > 0 ? `AED ${r.d.toLocaleString()}` : '-'}</td>
                                    <td className="px-6 py-4 text-sm font-black text-rose-600">{r.c > 0 ? `AED ${r.c.toLocaleString()}` : '-'}</td>
                                </tr>
                            ))}

                            {reportType === 'balance_sheet' && (
                                <>
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assets</td></tr>
                                    {[
                                        { l: 'Cash on Hand (Petty Cash)', v: stats.pettyCashIn - stats.pettyCashOut, n: 'Current Asset' },
                                        { l: 'Accounts Receivable (Pending)', v: monthlyAR.filter(ar => ar.status === 'Pending').reduce((acc, ar) => acc + ar.totalAmount, 0), n: 'Current Asset' }
                                    ].map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.l}</td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600">AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{r.n}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/30"><td colSpan={3} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Liabilities</td></tr>
                                    {[
                                        { l: 'Accounts Payable (Pending)', v: monthlyAP.filter(ap => ap.status === 'Pending').reduce((acc, ap) => acc + ap.totalAmount, 0), n: 'Current Liability' },
                                        { l: 'Accrued Payroll', v: stats.totalNet, n: 'Current Liability' }
                                    ].map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.l}</td>
                                            <td className="px-6 py-4 text-sm font-black text-rose-600">AED {r.v.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{r.n}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-900">
                                        <td className="px-6 py-5 text-sm font-black text-white uppercase">Net Equity</td>
                                        <td className="px-6 py-5 text-lg font-black text-brand-400">AED {(stats.totalReceivable + stats.pettyCashIn - (stats.totalPayable + stats.totalEveryday + stats.totalProjected + stats.totalNet + stats.pettyCashOut)).toLocaleString()}</td>
                                        <td className="px-6 py-5 text-xs font-black text-slate-400">Balanced</td>
                                    </tr>
                                </>
                            )}

                            {reportType === 'cash_flow' && [
                                { d: 'Cash Received from Customers', i: monthlyAR.filter(ar => ar.status === 'Received').reduce((acc, ar) => acc + ar.totalAmount, 0) + stats.pettyCashIn, o: 0 },
                                { d: 'Cash Paid to Suppliers', i: 0, o: monthlyAP.filter(ap => ap.status === 'Paid').reduce((acc, ap) => acc + ap.totalAmount, 0) + stats.totalEveryday },
                                { d: 'Cash Paid for Payroll', i: 0, o: stats.totalNet },
                                { d: 'Cash Paid for Petty Expenses', i: 0, o: stats.pettyCashOut },
                                { d: 'NET CASH FLOW', i: 0, o: 0, n: (monthlyAR.filter(ar => ar.status === 'Received').reduce((acc, ar) => acc + ar.totalAmount, 0) + stats.pettyCashIn) - (monthlyAP.filter(ap => ap.status === 'Paid').reduce((acc, ap) => acc + ap.totalAmount, 0) + stats.totalEveryday + stats.totalNet + stats.pettyCashOut) }
                            ].map((r, i) => (
                                <tr key={i} className={cn("border-b border-slate-50", r.d === 'NET CASH FLOW' && "bg-brand-600 text-white")}>
                                    <td className="px-6 py-4 text-sm font-bold">{r.d}</td>
                                    <td className="px-6 py-4 text-sm font-black text-emerald-600">{r.i > 0 ? `AED ${r.i.toLocaleString()}` : '-'}</td>
                                    <td className="px-6 py-4 text-sm font-black text-rose-600">{r.o > 0 ? `AED ${r.o.toLocaleString()}` : '-'}</td>
                                    <td className="px-6 py-4 text-sm font-black">{r.n !== undefined ? `AED ${r.n.toLocaleString()}` : '-'}</td>
                                </tr>
                            ))}
                            {reportType === 'staff' && activeStaff.map((e: any) => (
                                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-black text-slate-900">{e.code}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{e.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{e.company}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{e.department}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{e.designation}</td>
                                    <td className="px-6 py-4 text-sm font-black text-slate-900">AED {(e.salary.basic + e.salary.housing + e.salary.transport + e.salary.other).toLocaleString()}</td>
                                </tr>
                            ))}
                            {reportType === 'attendance' && activeStaff.map((e: any) => {
                                const empAtt = monthlyAttendance.filter(r => r.employeeId === e.id);
                                const present = empAtt.filter(r => r.status === AttendanceStatus.PRESENT).length;
                                const absent = empAtt.filter(r => r.status === AttendanceStatus.ABSENT).length;
                                const otHours = empAtt.reduce((acc, r) => acc + (r.overtimeHours || 0), 0);
                                return (
                                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">{e.code}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-700">{e.name}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">{present} Days</td>
                                        <td className="px-6 py-4 text-sm font-bold text-rose-600">{absent} Days</td>
                                        <td className="px-6 py-4 text-sm font-bold text-violet-600">{otHours} Hrs</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                empAtt.length > 20 ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                                            )}>
                                                {empAtt.length > 20 ? 'Complete' : 'Partial'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {reportType === 'payroll' && payrollData.map((p: any) => (
                                <tr key={p.employee.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-black text-slate-900">{p.employee.code}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{p.employee.name}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900">AED {p.payroll.grossSalary.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-violet-600">AED {p.payroll.otAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-rose-600">AED {p.payroll.totalDeductions.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-black text-emerald-600 bg-emerald-50/30">AED {p.payroll.netSalary.toLocaleString()}</td>
                                </tr>
                            ))}
                            {reportType === 'projects' && projects.map((p: any) => {
                                const projectStaff = activeStaff.filter((e: any) => e.team === p.name);
                                const projectAR = monthlyAR.filter(ar => (ar.entityId || ar.projectId) === p.id && (ar.entityType || 'Project') === 'Project').reduce((acc, ar) => acc + ar.amount, 0);
                                const projectAP = monthlyAP.filter(ap => ap.projectId === p.id).reduce((acc, ap) => acc + ap.amount, 0);
                                const margin = projectAR - projectAP;
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">{p.name}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-700">{p.clientName}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{projectStaff.length} Staff</td>
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">AED {projectAR.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-rose-600">AED {projectAP.toLocaleString()}</td>
                                        <td className={cn(
                                            "px-6 py-4 text-sm font-black",
                                            margin >= 0 ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            AED {margin.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                            {reportType === 'finance' && [
                                ...monthlyAP.map(ap => ({ 
                                    type: 'Payable', 
                                    date: ap.date, 
                                    ref: ap.invoiceNumber, 
                                    entity: ap.vendorType === 'Supplier' 
                                        ? (suppliers.find((s: any) => s.id === ap.vendorId)?.name || 'Unknown Supplier')
                                        : (vendors.find((v: any) => v.id === ap.vendorId)?.name || 'Unknown Client'), 
                                    amount: ap.amount, 
                                    status: ap.status, 
                                    color: 'rose' 
                                })),
                                ...monthlyAR.map(ar => {
                                    const type = ar.entityType || 'Project';
                                    const id = ar.entityId || ar.projectId;
                                    let entityName = 'Unknown';
                                    if (type === 'Project') entityName = projects.find((p: any) => p.id === id)?.clientName || 'Unknown Client';
                                    else if (type === 'Supplier') entityName = suppliers.find((s: any) => s.id === id)?.name || 'Unknown Supplier';
                                    else if (type === 'Vendor') entityName = vendors.find((v: any) => v.id === id)?.name || 'Unknown Client';

                                    return { 
                                        type: 'Receivable', 
                                        date: ar.date, 
                                        ref: ar.invoiceNumber, 
                                        entity: entityName, 
                                        amount: ar.amount, 
                                        status: ar.status, 
                                        color: 'emerald' 
                                    };
                                }),
                                ...monthlyPettyCash.map(pc => ({ 
                                    type: `Petty Cash (${pc.type === 'Income' ? 'In' : 'Out'})`, 
                                    date: pc.date, 
                                    ref: pc.description, 
                                    entity: pc.requestedBy || pc.receivedFrom, 
                                    amount: pc.amount, 
                                    status: 'Completed', 
                                    color: pc.type === 'Income' ? 'brand' : 'orange' 
                                }))
                            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            item.color === 'rose' ? "bg-rose-100 text-rose-700" :
                                            item.color === 'emerald' ? "bg-emerald-100 text-emerald-700" :
                                            item.color === 'brand' ? "bg-brand-100 text-brand-700" :
                                            "bg-orange-100 text-orange-700"
                                        )}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(item.date).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{item.ref}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.entity}</td>
                                    <td className={cn(
                                        "px-6 py-4 text-sm font-black",
                                        item.type.includes('Receivable') || item.type.includes('Income') ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        AED {item.amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{item.status}</td>
                                </tr>
                            ))}
                            {reportType === 'everyday' && monthlyEveryday.map((ee: any) => (
                                <tr key={ee.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(ee.date).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{ee.invoiceNo}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{ee.shopName || ee.supplierName}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{ee.clientName}</td>
                                    <td className="px-6 py-4 text-sm font-black text-rose-600">AED {ee.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-500">AED {ee.vatAmount.toLocaleString()}</td>
                                </tr>
                            ))}
                            {reportType === 'projected' && monthlyProjected.map((pe: any) => (
                                <tr key={pe.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(pe.date).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{pe.invoiceNumber}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{pe.clientName}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{pe.siteLocation}</td>
                                    <td className="px-6 py-4 text-sm font-black text-brand-600">AED {pe.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-500">AED {pe.vatAmount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon, color, delay }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="glass-card p-6 rounded-3xl border border-white shadow-xl shadow-slate-200/40 group hover:scale-[1.02] transition-all"
    >
        <div className="flex items-center gap-4">
            <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12",
                color === 'brand' ? 'bg-brand-50 text-brand-600' :
                color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                color === 'orange' ? 'bg-orange-50 text-orange-600' :
                color === 'rose' ? 'bg-rose-50 text-rose-600' :
                'bg-violet-50 text-violet-600'
            )}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
                <div className="text-xl font-black text-slate-900">{value}</div>
            </div>
        </div>
    </motion.div>
);
