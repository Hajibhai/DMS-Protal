
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
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

import { cn, getPioneerPDFAssets } from './utils';
import { PrintModal, PrintOptions } from './components/PrintModal';
import { TimesheetPrintPreviewModal } from './components/TimesheetPrintPreviewModal';
import { BackupRestoreView } from './components/BackupRestoreView';

const DirhamIcon = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-center font-black text-[10px] leading-none tracking-tighter", className)}>
    AED
  </div>
);

import { 
  Users, Calendar, UserPlus, LogOut, ArrowRight,
  Building2, CheckCircle, XCircle, Trash2, 
  AlertCircle, Eye, EyeOff, Edit, CheckSquare, 
  Copy, FileText, CreditCard, FileSignature,
  BarChart3, UserMinus, Wallet, Plane, X, Save, Plus,
  ChevronLeft, ChevronRight,
  Settings, Search, Bell, LogOut as SignOut, UserCog,
  Briefcase, HardHat, ShieldCheck, Download, Printer,
  MoreVertical, Check, X as CloseIcon, Filter, Shield, Key, GripVertical,
  Activity, LayoutGrid, ListFilter, ChevronDown, Globe, HelpCircle, LayoutDashboard,
  TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight, BarChart2, Phone,
  ShieldAlert, Truck, StickyNote, Camera, Scale, Landmark, RefreshCw, Calculator, Car,
  Paperclip, Upload, FileDown, ExternalLink, FileSpreadsheet, Home, Mail,
  Database, HardDrive, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
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
  startAfter,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, loginWithGoogle, loginWithEmail, registerWithEmail, logout, resetPassword, adminCreateUser, adminDeleteUser, adminUpdateUser } from './firebase';
import { Login } from './components/Login';
import { SchedulesManager } from './components/SchedulesManager';
import { 
  Employee, AttendanceRecord, AttendanceStatus, StaffType, 
  LeaveRequest, LeaveStatus, OffboardingDetails, 
  SystemUser, DeductionRecord, UserRole, SalaryStructure, Company, Supplier, Project, JobOffer, 
  Vendor, AccountsPayable, AccountsReceivable, PettyCash,
  ProjectedExpense,
  EverydayExpense,
  AuditLog,
  CICPARecord,
  SafetyRecord,
  UserPermissions,
  PublicHoliday,
  EngineerDocument,
  CorporateBankAccount,
  CampExpense,
  Task,
  Note,
  Voucher,
  Vehicle,
  VehicleDocument,
  VisaFees,
  CreditNote
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
  testConnection, logAudit, updateAuditLog, deleteAuditLog, clearAuditLogs, handleFirestoreError, OperationType,
  saveHoliday, deleteHoliday, saveEngineerDocument, deleteEngineerDocument,
  saveCamp, deleteCamp, saveVoucher, deleteVoucher,
  saveVehicle, deleteVehicle,
  saveCreditNote, deleteCreditNote
} from './services/storageService';
import { DEFAULT_ABOUT_DATA, CREATOR_USER } from './constants';
import SmartCommand from './components/SmartCommand';
import { Layout } from './components/Layout';
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { 
  VendorView, AccountsPayableView, AccountsReceivableView, PettyCashView, ProjectedExpenseView, EverydayExpenseView,
  VendorModal, AccountsPayableModal, AccountsReceivableModal, PettyCashModal, ProjectedExpenseModal, EverydayExpenseModal,
  FinancialDashboardView, TaxCreditNoteModal
} from './components/FinanceViews';
import { CampView, CampModal } from './components/CampView';
import { HolidayManagementModal } from './components/HolidayManagementModal';
import { SafetyView } from './components/SafetyView';
import { VehiclesView } from './components/VehiclesView';
import { JobOfferView } from './components/JobOfferView';
import { EngineerView } from './components/EngineerView';
import TasksNotesView from './components/TasksNotesView';
import { ExperienceLetterView, downloadExperienceLetterPDF } from './components/ExperienceLetterView';
import { NocView } from './components/NocView';
import { PassportAcknowledgementView } from './components/PassportAcknowledgementView';
import { EmiratesIdAcknowledgementView } from './components/EmiratesIdAcknowledgementView';
import { VouchersView } from './components/VouchersView';
import { VisaFeesView } from './components/VisaFeesView';
import { CompanyRecordsManager } from './components/CompanyRecordsManager';
import { CompanyDetailsModal } from './components/CompanyDetailsModal';

// --- Image Compression Helper ---
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

// --- Constants & Helpers ---
const INITIAL_PERMISSIONS: UserPermissions = {
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
    canManageProjects: false,
    canManageFinance: false
};

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

    const presentCount = attendance.filter(r => r.status === AttendanceStatus.PRESENT).length;
    const weekOffCount = attendance.filter(r => r.status === AttendanceStatus.WEEK_OFF).length;
    const publicHolidayCount = attendance.filter(r => r.status === AttendanceStatus.PUBLIC_HOLIDAY).length;

    const totalPresentDays = isFixedSalary 
        ? (presentCount + weekOffCount + publicHolidayCount) 
        : presentCount;

    return {
        grossSalary,
        totalUnpaidDays,
        totalPresentDays,
        presentCount,
        weekOffCount,
        publicHolidayCount,
        lopDeduction,
        totalOtHours,
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

const ImportAttendanceModal = ({ isOpen, onClose, employees, user, onLogAttendance }: any) => {
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; fail: number; errors: string[] } | null>(null);

    if (!isOpen) return null;

    const downloadSampleFormat = () => {
        const sampleData = employees.length > 0 
            ? employees.map((emp: any) => ({
                'Employee Code': emp.code || '',
                'Employee Name': emp.name || '',
                'Date': new Date().toISOString().split('T')[0],
                'Status (P/A/W/PH/SL/AL/UL/EL)': 'P',
                'Hours Worked': 8,
                'Overtime Hours': 0,
                'Note': 'Regular Attendance'
              }))
            : [
                {
                    'Employee Code': '10001',
                    'Employee Name': 'TORA GURMU REGASA',
                    'Date': '2026-06-01',
                    'Status (P/A/W/PH/SL/AL/UL/EL)': 'P',
                    'Hours Worked': 8,
                    'Overtime Hours': 2,
                    'Note': 'Regular Overtime Completed'
                },
                {
                    'Employee Code': '10002',
                    'Employee Name': 'SHASHI KUMAR PASWAN',
                    'Date': '2026-06-01',
                    'Status (P/A/W/PH/SL/AL/UL/EL)': 'A',
                    'Hours Worked': 0,
                    'Overtime Hours': 0,
                    'Note': 'Absent'
                }
              ];

        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [
            { wch: 15 },
            { wch: 30 },
            { wch: 12 },
            { wch: 32 },
            { wch: 15 },
            { wch: 15 },
            { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TimesheetTemplate");
        XLSX.writeFile(wb, "Attendance_Import_Template.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleImportSubmit = () => {
        if (!file) {
            alert("Please select a file to import.");
            return;
        }

        setIsSubmitting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rows = XLSX.utils.sheet_to_json(ws);

                if (!rows || rows.length === 0) {
                    alert("No data rows found in the uploaded file.");
                    setIsSubmitting(false);
                    return;
                }

                let successCount = 0;
                let failCount = 0;
                const errors: string[] = [];

                for (let i = 0; i < rows.length; i++) {
                    const row: any = rows[i];
                    const code = String(row['Employee Code'] || '').trim();
                    const name = String(row['Employee Name'] || '').trim();
                    let dateVal = row['Date'];

                    if (typeof dateVal === 'number') {
                        const utc_days = Math.floor(dateVal - 25569);
                        const utc_value = utc_days * 86400;
                        const date_info = new Date(utc_value * 1000);
                        dateVal = date_info.toISOString().split('T')[0];
                    } else if (dateVal) {
                        dateVal = String(dateVal).trim();
                        if (dateVal.includes('/') && dateVal.split('/')[2]?.length === 4) {
                            const parts = dateVal.split('/');
                            dateVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        } else if (dateVal.includes('.') && dateVal.split('.')[2]?.length === 4) {
                            const parts = dateVal.split('.');
                            dateVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    }

                    if (!dateVal) {
                        failCount++;
                        errors.push(`Row ${i + 2} (${name || 'Unknown'}): Missing or invalid date format.`);
                        continue;
                    }

                    let targetEmp = null;
                    if (code) {
                        targetEmp = employees.find((e: any) => String(e.code || '').toLowerCase().trim() === code.toLowerCase());
                    }
                    if (!targetEmp && name) {
                        targetEmp = employees.find((e: any) => String(e.name || '').toLowerCase().trim() === name.toLowerCase());
                    }

                    if (!targetEmp) {
                        failCount++;
                        errors.push(`Row ${i + 2}: Employee with Code "${code}" or Name "${name}" not found.`);
                        continue;
                    }

                    const statusRaw = String(row['Status (P/A/W/PH/SL/AL/UL/EL)'] || row['Status'] || '').trim().toUpperCase();
                    let mappedStatus = AttendanceStatus.PRESENT;

                    if (statusRaw === 'P' || statusRaw === 'PRESENT') {
                        mappedStatus = AttendanceStatus.PRESENT;
                    } else if (statusRaw === 'A' || statusRaw === 'ABSENT') {
                        mappedStatus = AttendanceStatus.ABSENT;
                    } else if (statusRaw === 'W' || statusRaw === 'WO' || statusRaw === 'WEEK OFF' || statusRaw === 'WEEKOFF' || statusRaw === 'WEEK_OFF') {
                        mappedStatus = AttendanceStatus.WEEK_OFF;
                    } else if (statusRaw === 'PH' || statusRaw === 'PUBLIC' || statusRaw === 'PUBLIC HOLIDAY' || statusRaw === 'PUBLIC_HOLIDAY') {
                        mappedStatus = AttendanceStatus.PUBLIC_HOLIDAY;
                    } else if (statusRaw === 'SL' || statusRaw === 'SICK' || statusRaw === 'SICK LEAVE' || statusRaw === 'SICK_LEAVE') {
                        mappedStatus = AttendanceStatus.SICK_LEAVE;
                    } else if (statusRaw === 'AL' || statusRaw === 'ANNUAL' || statusRaw === 'ANNUAL LEAVE' || statusRaw === 'ANNUAL_LEAVE') {
                        mappedStatus = AttendanceStatus.ANNUAL_LEAVE;
                    } else if (statusRaw === 'UL' || statusRaw === 'UNPAID' || statusRaw === 'UNPAID LEAVE' || statusRaw === 'UNPAID_LEAVE') {
                        mappedStatus = AttendanceStatus.UNPAID_LEAVE;
                    } else if (statusRaw === 'EL' || statusRaw === 'EMERGENCY' || statusRaw === 'EMERGENCY LEAVE' || statusRaw === 'EMERGENCY_LEAVE') {
                        mappedStatus = AttendanceStatus.EMERGENCY_LEAVE;
                    }

                    const hrsWorked = row['Hours Worked'] !== undefined ? Number(row['Hours Worked']) : (mappedStatus === AttendanceStatus.PRESENT ? 8 : 0);
                    const otHrs = row['Overtime Hours'] !== undefined ? Number(row['Overtime Hours']) : 0;
                    const note = row['Note'] ? String(row['Note']) : 'Excel Bulk Upload';

                    try {
                        await onLogAttendance(
                            targetEmp.id,
                            mappedStatus,
                            dateVal,
                            otHrs,
                            undefined,
                            user?.name || 'System',
                            note,
                            hrsWorked
                        );
                        successCount++;
                    } catch (err: any) {
                        console.error("Row import error:", err);
                        failCount++;
                        errors.push(`Row ${i + 2}: Error saving into timesheet (${err.message || err}).`);
                    }
                }

                setImportResult({ success: successCount, fail: failCount, errors });
            } catch (err: any) {
                console.error(err);
                alert(`Failed to parse file: ${err.message || err}`);
            } finally {
                setIsSubmitting(false);
            }
        };
        reader.readAsBinaryString(file);
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
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Import Attendance</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Upload an Excel sheet to bulk log attendance records</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm hover:shadow-md"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                    <div className="bg-brand-50/40 border border-brand-100 p-6 rounded-2xl space-y-4">
                        <div className="flex items-start gap-3">
                            <FileSpreadsheet className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="font-extrabold text-sm text-slate-900">Pre-populated Template</h4>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                    Our system dynamically generates an Excel template pre-filled with your current list of employees and codes! It lists status shorthand guides to make data-entry quick and flawless.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={downloadSampleFormat}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-xl font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                        >
                            <Download className="w-4 h-4 text-brand-600" />
                            Download Pre-populated Excel Template
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supported Status Shortcodes</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-700">P / Present</span>
                                <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded">Present</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-700">A / Absent</span>
                                <span className="text-red-700 font-extrabold bg-red-50 px-1.5 py-0.5 rounded">Absent</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-700">W / Week Off</span>
                                <span className="text-slate-700 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded">Week Off</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-700">PH / Public Holiday</span>
                                <span className="text-violet-700 font-extrabold bg-violet-50 px-1.5 py-0.5 rounded">Holiday</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-700">SL / Sick Leave</span>
                                <span className="text-orange-700 font-extrabold bg-orange-50 px-1.5 py-0.5 rounded">Sick</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                                <span className="font-bold text-slate-700">AL / Annual Leave</span>
                                <span className="text-brand-700 font-extrabold bg-brand-50 px-1.5 py-0.5 rounded">Annual</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-700">UL / Unpaid Leave</span>
                                <span className="text-rose-700 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded">Unpaid</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-slate-700">EL / Emergency</span>
                                <span className="text-pink-700 font-extrabold bg-pink-50 px-1.5 py-0.5 rounded">Emergency</span>
                            </div>
                        </div>
                    </div>

                    {importResult ? (
                        <div className="space-y-4 border border-slate-100 rounded-3xl p-6 bg-slate-50/30">
                            <h4 className="font-extrabold text-sm text-slate-900">Import Summary Results</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-emerald-700">{importResult.success}</div>
                                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Successfully Logged</div>
                                </div>
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-rose-700">{importResult.fail}</div>
                                    <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">Errors/Failed Rows</div>
                                </div>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="space-y-1.5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Issues Encountered</div>
                                    <div className="max-h-36 overflow-y-auto bg-rose-50 text-rose-800 text-xs p-3.5 rounded-xl space-y-1 font-semibold border border-rose-100">
                                        {importResult.errors.map((err, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span>â€¢</span><span>{err}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    setImportResult(null);
                                    setFile(null);
                                }}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                            >
                                Import Another File
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-200 hover:border-brand-300 rounded-3xl p-8 transition-all hover:bg-brand-50/5 relative flex flex-col items-center justify-center text-center">
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls, .csv" 
                                    onChange={handleFileUpload} 
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                                />
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-500 mb-3">
                                    <Upload className="w-6 h-6 text-slate-400" />
                                </div>
                                {file ? (
                                    <div>
                                        <p className="font-extrabold text-slate-900 text-sm truncate max-w-xs">{file.name}</p>
                                        <p className="text-xs text-brand-600 font-extrabold mt-1">Ready to upload â€¢ click or drag different file to replace</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">Click to upload spreadsheet or drag & drop</p>
                                        <p className="text-xs text-slate-400 mt-1 font-medium">Accepts Microsoft Excel (.xlsx, .xls) and CSV format</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors cursor-pointer"
                    >
                        {importResult ? "Close" : "Cancel"}
                    </button>
                    {!importResult && (
                        <button 
                            disabled={isSubmitting || !file}
                            onClick={handleImportSubmit} 
                            className="px-8 py-3 bg-brand-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-brand-600/20 hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing logs...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Import Selected File
                                </>
                            )}
                        </button>
                    )}
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pioneer DMS v5.0 Productivity Tools</p>
        </div>
      </motion.div>
    </div>
  );
};

interface DownloadPopupModalProps {
  isOpen: boolean;
  filename: string;
  blobUrl: string;
  triggerDownload?: () => void;
  onClose: () => void;
}

const DownloadPopupModal = ({ isOpen, filename, blobUrl, triggerDownload, onClose }: DownloadPopupModalProps) => {
  const [copied, setCopied] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setDownloadStarted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(blobUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleDownload = () => {
    setDownloadStarted(true);
    if (triggerDownload) {
      triggerDownload();
    } else {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setTimeout(() => setDownloadStarted(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl p-6 relative flex flex-col space-y-4 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-150 animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Download className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Document Download Ready</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Complete Site Download System</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Name section */}
        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">File Name</span>
          <span className="text-xs font-black text-slate-800 break-all select-all flex items-center gap-1.5">
            <span>{filename}</span>
          </span>
        </div>

        {/* Copy Link input box */}
        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Direct Download Link</label>
          <div className="flex items-center gap-1.5">
            <input 
              type="text" 
              readOnly 
              value={blobUrl} 
              onClick={e => (e.target as HTMLInputElement).select()}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono text-slate-600 outline-none cursor-pointer"
              title="Click to select all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-2 text-xs font-extrabold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${copied ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Primary Download / Copy buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-2xl text-slate-600 hover:text-slate-800 text-xs font-black transition-all cursor-pointer text-center"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className={`flex-[2] py-3 text-white text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${downloadStarted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {downloadStarted ? (
              <>
                <Check className="w-4 h-4 animate-bounce" /> Downloading...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" /> Start Download
              </>
            )}
          </button>
        </div>
        
        {/* Secure Environment notice */}
        <p className="text-[9px] text-center text-slate-400 font-medium leading-relaxed">
          If your browser blocks the dynamic download, simply copy the URL above and paste it directly in your browser's address bar.
        </p>
      </div>
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[25000]">
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

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const handlePrintClick = () => {
        setIsPrintModalOpen(true);
    };

    const handlePrintWithConfig = (options: PrintOptions) => {
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
                        @page { 
                            size: ${options.orientation}; 
                            margin: ${options.margins === 'none' ? '0' : options.margins === 'minimum' ? '5mm' : '15mm'}; 
                        }
                        body { 
                            font-family: 'Georgia', serif; 
                            background-color: #ffffff;
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
                        @media print {
                            .no-print { display: none !important; }
                        }
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
                                    onClick={handlePrintClick}
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

            <PrintModal 
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                onPrint={handlePrintWithConfig}
                title="Print Final Settlement"
            />
        </div>
    );
};

const EditEmployeeModal = ({ employee, onSave, onCancel, companies, openConfirm, readOnly }: { employee: Employee, onSave: (e: Employee) => void, onCancel: () => void, companies: Company[], openConfirm: any, readOnly?: boolean }) => {
    const [data, setData] = useState<Employee>(employee);

    const handleVisaFeeChange = (field: keyof VisaFees, val: any) => {
        const currentVisaFees = data.visaFees || {};
        const updatedVisaFees = {
            ...currentVisaFees,
            [field]: field === 'othersRemarks' ? val : (val === '' ? undefined : Number(val))
        };

        // Calculate total automatically
        const initialApplicationFee = Number(updatedVisaFees.initialApplicationFee) || 0;
        const approvalFee = Number(updatedVisaFees.approvalFee) || 0;
        const dicFee = Number(updatedVisaFees.dicFee) || 0;
        const iloeFee = Number(updatedVisaFees.iloeFee) || 0;
        const lcFee = Number(updatedVisaFees.lcFee) || 0;
        const entryPermitFee = Number(updatedVisaFees.entryPermitFee) || 0;
        const changeStatusFee = Number(updatedVisaFees.changeStatusFee) || 0;
        const medicalFee = Number(updatedVisaFees.medicalFee) || 0;
        const insuranceFee = Number(updatedVisaFees.insuranceFee) || 0;
        const biometricFee = Number(updatedVisaFees.biometricFee) || 0;
        const visaEidFee = Number(updatedVisaFees.visaEidFee) || 0;
        const othersFee = Number(updatedVisaFees.othersFee) || 0;

        const total = initialApplicationFee + approvalFee + dicFee + iloeFee + lcFee + entryPermitFee + changeStatusFee + medicalFee + insuranceFee + biometricFee + visaEidFee + othersFee;
        updatedVisaFees.totalFee = Number(total.toFixed(2));

        setData({
            ...data,
            visaFees: updatedVisaFees
        });
    };

    const downloadIndividualVisaFeePDF = (emp: Employee) => {
        const doc = new jsPDF();
        const fees = emp.visaFees || {};
        
        // Brand header
        doc.setFillColor(79, 70, 229); // Brand color (indigo-600)
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("PIONEER CONTRACTING", 15, 18);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("INDIVIDUAL VISA & ONBOARDING FEES REPORT", 15, 26);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 32);
        
        // Employee details card
        doc.setFillColor(248, 250, 252);
        doc.rect(10, 48, 190, 42, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(10, 48, 190, 42, 'D');
        
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("EMPLOYEE INFORMATION", 15, 55);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Name: ${emp.name}`, 15, 62);
        doc.text(`Code: ${emp.code}`, 15, 68);
        doc.text(`Designation: ${emp.designation || 'N/A'}`, 15, 74);
        doc.text(`Department: ${emp.department || 'N/A'}`, 15, 80);
        doc.text(`Company: ${emp.company || 'N/A'}`, 110, 62);
        doc.text(`Nationality: ${emp.nationality || 'N/A'}`, 110, 68);
        doc.text(`Joining Date: ${emp.joiningDate || 'N/A'}`, 110, 74);
        doc.text(`Status: ${emp.status || 'Active'}`, 110, 80);
        
        // Fee Breakdown Table
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("FEE DESCRIPTION & BREAKDOWN", 15, 102);
        
        const tableData = [
            ["1. Initial Application Fee", `AED ${(fees.initialApplicationFee || 0).toFixed(2)}`],
            ["2. Approval Fee", `AED ${(fees.approvalFee || 0).toFixed(2)}`],
            ["3. DIC Fee", `AED ${(fees.dicFee || 0).toFixed(2)}`],
            ["4. ILOE Fee", `AED ${(fees.iloeFee || 0).toFixed(2)}`],
            ["5. LC Fee", `AED ${(fees.lcFee || 0).toFixed(2)}`],
            ["6. Entry Permit Fee", `AED ${(fees.entryPermitFee || 0).toFixed(2)}`],
            ["7. Change Status Fee", `AED ${(fees.changeStatusFee || 0).toFixed(2)}`],
            ["8. Medical Fee", `AED ${(fees.medicalFee || 0).toFixed(2)}`],
            ["9. Insurance Fee", `AED ${(fees.insuranceFee || 0).toFixed(2)}`],
            ["10. Biometric Fee - New Employee (If Applicable)", `AED ${(fees.biometricFee || 0).toFixed(2)}`],
            ["11. Visa & EID Fee", `AED ${(fees.visaEidFee || 0).toFixed(2)}`],
            [`12. Others Fee (${fees.othersRemarks || 'No Remarks'})`, `AED ${(fees.othersFee || 0).toFixed(2)}`],
        ];
        
        let currentY = 108;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        tableData.forEach(([label, value]) => {
            doc.setDrawColor(241, 245, 249);
            doc.line(15, currentY + 1, 195, currentY + 1);
            doc.setTextColor(71, 85, 105);
            doc.text(label, 15, currentY);
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(value, 160, currentY);
            doc.setFont("helvetica", "normal");
            currentY += 8;
        });
        
        // Grand Total
        currentY += 4;
        doc.setFillColor(240, 249, 255);
        doc.rect(10, currentY - 6, 190, 14, 'F');
        doc.setDrawColor(186, 230, 253);
        doc.rect(10, currentY - 6, 190, 14, 'D');
        
        doc.setTextColor(79, 70, 229);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("TOTAL ESTIMATED VISA & ONBOARDING FEES:", 15, currentY + 2);
        doc.setFontSize(13);
        doc.text(`AED ${(fees.totalFee || 0).toFixed(2)}`, 155, currentY + 2);
        
        doc.save(`Visa_Fees_Report_${emp.code}_${emp.name.replace(/\s+/g, '_')}.pdf`);
    };

    const downloadIndividualVisaFeeExcel = (emp: Employee) => {
        const fees = emp.visaFees || {};
        const dataRows = [
            { "Detail": "Employee Name", "Value": emp.name },
            { "Detail": "Employee Code", "Value": emp.code },
            { "Detail": "Designation", "Value": emp.designation },
            { "Detail": "Department", "Value": emp.department },
            { "Detail": "Company", "Value": emp.company },
            { "Detail": "Nationality", "Value": emp.nationality || '' },
            { "Detail": "Joining Date", "Value": emp.joiningDate || '' },
            { "Detail": "", "Value": "" },
            { "Detail": "FEE ITEM", "Value": "AMOUNT (AED)" },
            { "Detail": "Initial Application Fee", "Value": fees.initialApplicationFee || 0 },
            { "Detail": "Approval Fee", "Value": fees.approvalFee || 0 },
            { "Detail": "DIC Fee", "Value": fees.dicFee || 0 },
            { "Detail": "ILOE Fee", "Value": fees.iloeFee || 0 },
            { "Detail": "LC Fee", "Value": fees.lcFee || 0 },
            { "Detail": "Entry Permit Fee", "Value": fees.entryPermitFee || 0 },
            { "Detail": "Change Status Fee", "Value": fees.changeStatusFee || 0 },
            { "Detail": "Medical Fee", "Value": fees.medicalFee || 0 },
            { "Detail": "Insurance Fee", "Value": fees.insuranceFee || 0 },
            { "Detail": "Biometric Fee - New Employee", "Value": fees.biometricFee || 0 },
            { "Detail": "Visa & EID Fee", "Value": fees.visaEidFee || 0 },
            { "Detail": `Others Fee (${fees.othersRemarks || 'None'})`, "Value": fees.othersFee || 0 },
            { "Detail": "TOTAL FEE", "Value": fees.totalFee || 0 }
        ];
        
        const ws = XLSX.utils.json_to_sheet(dataRows, { header: ["Detail", "Value"] });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Visa Fees");
        XLSX.writeFile(wb, `Visa_Fees_${emp.code}.xlsx`);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-transparent">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">{readOnly ? 'View Employee Details' : 'Edit Employee'}</h2>
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
                                {!readOnly && (
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
                                                    reader.onloadend = async () => {
                                                        const compressed = await compressImage(reader.result as string);
                                                        setData({...data, profileImage: compressed});
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
                                )}
                             </div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Code</label><input disabled={readOnly} type="text" value={data.code || ''} onChange={e => setData({...data, code: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-100 disabled:text-gray-500" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Name</label><input disabled={readOnly} type="text" value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Nationality</label><input disabled={readOnly} type="text" value={data.nationality || ''} onChange={e => setData({...data, nationality: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" placeholder="e.g. UAE" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Team Nick Name</label>
                                 <select disabled={readOnly} value={data.team || ''} onChange={e => setData({...data, team: e.target.value as any})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50">
                                     <option value="Internal Team">Internal Team</option>
                                     <option value="External Team">External Team</option>
                                     <option value="Office Staff">Office Staff</option>
                                 </select>
                             </div>

                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Mobile Number</label><input disabled={readOnly} type="text" value={data.mobileNumber || ''} onChange={e => setData({...data, mobileNumber: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                            <div><label className="text-xs font-semibold text-gray-500 uppercase">Email ID (Optional)</label><input disabled={readOnly} type="email" value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" placeholder="e.g. employee@company.com" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Nick Name</label><input disabled={readOnly} type="text" value={data.nickName || ''} onChange={e => setData({...data, nickName: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" placeholder="e.g. Nick" /></div>

                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Staff Type</label>
                                 <input 
                                     disabled={readOnly}
                                     list="staff-types-edit"
                                     value={data.type || ''} 
                                     onChange={e => setData({...data, type: e.target.value})} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50"
                                     placeholder="Select or type staff type"
                                 />
                                 <datalist id="staff-types-edit">
                                     {Object.values(StaffType).map(t => <option key={t} value={t} />)}
                                 </datalist>
                             </div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Employee Nick Name</label><input disabled={readOnly} type="text" value={data.employeeNickName || ''} onChange={e => setData({...data, employeeNickName: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" placeholder="e.g. Shashi" /></div>

                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Designation</label><input disabled={readOnly} type="text" value={data.designation || ''} onChange={e => setData({...data, designation: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Department</label><input disabled={readOnly} type="text" value={data.department || ''} onChange={e => setData({...data, department: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Current Project</label><input disabled={readOnly} type="text" value={data.projectName || ''} onChange={e => setData({...data, projectName: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" placeholder="e.g. Burj Khalifa Site" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Company</label>
                                 <select disabled={readOnly} value={data.company || ''} onChange={e => setData({...data, company: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50">
                                     <option value="">Select Company</option>
                                     {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                 </select>
                             </div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Joining Date</label><input disabled={readOnly} type="date" value={data.joiningDate || ''} onChange={e => setData({...data, joiningDate: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                        </div>
                    </div>
 
                    {/* Salary Info */}
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Salary Structure (AED)</h3>
                        <div className="grid grid-cols-3 gap-4">
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Basic</label><input disabled={readOnly} type="number" value={data.salary.basic ?? 0} onChange={e => setData({...data, salary: {...data.salary, basic: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Housing</label><input disabled={readOnly} type="number" value={data.salary.housing ?? 0} onChange={e => setData({...data, salary: {...data.salary, housing: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Transport</label><input disabled={readOnly} type="number" value={data.salary.transport ?? 0} onChange={e => setData({...data, salary: {...data.salary, transport: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Other</label><input disabled={readOnly} type="number" value={data.salary.other ?? 0} onChange={e => setData({...data, salary: {...data.salary, other: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Air Ticket</label><input disabled={readOnly} type="number" value={data.salary.airTicket ?? 0} onChange={e => setData({...data, salary: {...data.salary, airTicket: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Leave Salary</label><input disabled={readOnly} type="number" value={data.salary.leaveSalary ?? 0} onChange={e => setData({...data, salary: {...data.salary, leaveSalary: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Hourly Rate</label><input disabled={readOnly} type="number" value={data.salary.hourlyRate ?? 0} onChange={e => setData({...data, salary: {...data.salary, hourlyRate: Number(e.target.value)}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                        </div>
                    </div>
 
                    {/* Banking */}
                     <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Banking Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Bank Name</label><input disabled={readOnly} type="text" value={data.bankName || ''} onChange={e => setData({...data, bankName: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">IBAN / Account</label><input disabled={readOnly} type="text" value={data.iban || ''} onChange={e => setData({...data, iban: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                        </div>
                    </div>
 
                    {/* Documents */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Documents & Identification</h3>
                        <div className="grid grid-cols-3 gap-4">
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Emirates ID</label><input disabled={readOnly} type="text" value={data.documents?.emiratesId || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), emiratesId: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">EID Issue Date</label><input disabled={readOnly} type="date" value={data.documents?.emiratesIdIssue || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), emiratesIdIssue: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">EID Expiry</label><input disabled={readOnly} type="date" value={data.documents?.emiratesIdExpiry || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), emiratesIdExpiry: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Passport Number</label><input disabled={readOnly} type="text" value={data.documents?.passportNumber || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), passportNumber: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Passport Issue Date</label><input disabled={readOnly} type="date" value={data.documents?.passportIssue || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), passportIssue: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Passport Expiry</label><input disabled={readOnly} type="date" value={data.documents?.passportExpiry || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), passportExpiry: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Labour Card Number</label><input disabled={readOnly} type="text" value={data.documents?.labourCardNumber || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), labourCardNumber: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Labour Card Issue</label><input disabled={readOnly} type="date" value={data.documents?.labourCardIssue || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), labourCardIssue: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Labour Card Expiry</label><input disabled={readOnly} type="date" value={data.documents?.labourCardExpiry || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), labourCardExpiry: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Temporary Company Name</label><input disabled={readOnly} type="text" value={data.documents?.temporaryCompanyName || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), temporaryCompanyName: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" placeholder="e.g. Temp Corp LLC" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Temporary Labour Card Number</label><input disabled={readOnly} type="text" value={data.documents?.temporaryLabourCardNumber || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), temporaryLabourCardNumber: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Temp Labour Card Issue</label><input disabled={readOnly} type="date" value={data.documents?.temporaryLabourCardIssue || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), temporaryLabourCardIssue: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                             <div><label className="text-xs font-semibold text-gray-500 uppercase">Temp Labour Card Expiry</label><input disabled={readOnly} type="date" value={data.documents?.temporaryLabourCardExpiry || ''} onChange={e => setData({...data, documents: {...(data.documents || {}), temporaryLabourCardExpiry: e.target.value}})} className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50" /></div>
                        </div>
                    </div>
                    {/* Visa & Onboarding Fees */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-indigo-600" />
                            Visa & Onboarding Fees (AED)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Initial Application Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.initialApplicationFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('initialApplicationFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Approval Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.approvalFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('approvalFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">DIC Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.dicFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('dicFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">ILOE Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.iloeFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('iloeFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">LC Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.lcFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('lcFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Entry Permit Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.entryPermitFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('entryPermitFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Change Status Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.changeStatusFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('changeStatusFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Medical Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.medicalFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('medicalFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Insurance Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.insuranceFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('insuranceFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase text-ellipsis overflow-hidden whitespace-nowrap" title="Biometric Fee - New Employee (If Applicable)">Biometric Fee - New Employee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.biometricFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('biometricFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Visa & EID Fee</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.visaEidFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('visaEidFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Others Fee (+ or -)</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="number" 
                                     value={data.visaFees?.othersFee ?? ''} 
                                     onChange={e => handleVisaFeeChange('othersFee', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="0.00"
                                 />
                             </div>
                             <div className="col-span-1 sm:col-span-2">
                                 <label className="text-xs font-semibold text-gray-500 uppercase">Others Details / Remarks</label>
                                 <input 
                                     disabled={readOnly} 
                                     type="text" 
                                     value={data.visaFees?.othersRemarks || ''} 
                                     onChange={e => handleVisaFeeChange('othersRemarks', e.target.value)} 
                                     className="w-full p-2 border rounded-lg mt-1 bg-white text-gray-900 font-bold disabled:bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                     placeholder="e.g. Additional courier charges"
                                 />
                             </div>
                             <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col justify-center items-center">
                                 <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Total Fees</span>
                                 <span className="text-lg font-black text-indigo-900 mt-1">
                                     AED {(data.visaFees?.totalFee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </span>
                             </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => downloadIndividualVisaFeePDF(data)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                Download PDF Details
                            </button>
                            <button
                                type="button"
                                onClick={() => downloadIndividualVisaFeeExcel(data)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Download Excel
                            </button>
                        </div>
                    </div>
                    {/* Linked Documents */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-3">Linked Documents</h3>
                        <GoogleDriveManager 
                            files={data.driveFiles || []}
                            onAddFile={readOnly ? () => {} : (file) => setData({ ...data, driveFiles: [...(data.driveFiles || []), file] })}
                            onRemoveFile={readOnly ? () => {} : (fileId) => setData({ ...data, driveFiles: (data.driveFiles || []).filter(f => f.id !== fileId) })}
                            openConfirm={openConfirm}
                        />
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors">{readOnly ? 'Close' : 'Cancel'}</button>
                    {!readOnly && <button onClick={() => onSave(data)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">Save Changes</button>}
                </div>
            </div>
        </div>
    );
};

const OnboardingWizard = ({ onComplete, onCancel, companies, openConfirm }: { onComplete: (data: Employee) => void, onCancel: () => void, companies: Company[], openConfirm: any }) => {
    const [step, setStep] = useState(1);
    const [offers, setOffers] = useState<JobOffer[]>([]);
    const [selectedOfferId, setSelectedOfferId] = useState<string>('');
    const [onboardingSearch, setOnboardingSearch] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'job_offers'), (snap) => {
            const list: JobOffer[] = [];
            snap.forEach((doc) => {
                const offer = doc.data() as JobOffer;
                list.push(offer);
            });
            setOffers(list);
        });
        return () => unsub();
    }, []);

    const [data, setData] = useState<Partial<Employee>>({
        salary: { basic: 0, housing: 0, transport: 0, other: 0, airTicket: 0, leaveSalary: 0, hourlyRate: 0 },
        status: 'Active', 
        active: true, 
        leaveBalance: 30, 
        team: 'Internal Team', 
        type: StaffType.WORKER,
        email: '',
        documents: {
            emiratesId: '',
            emiratesIdIssue: '',
            emiratesIdExpiry: '',
            passportNumber: '',
            passportIssue: '',
            passportExpiry: '',
            labourCardNumber: '',
            labourCardIssue: '',
            labourCardExpiry: '',
            temporaryCompanyName: '',
            temporaryLabourCardNumber: '',
            temporaryLabourCardIssue: '',
            temporaryLabourCardExpiry: ''
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
                                {/* Candidate Auto-Fetch Option */}
                                {offers.length > 0 && (
                                    <div className="col-span-2 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">Auto-Fetch Candidate Offer Data</h4>
                                                <p className="text-[10px] text-indigo-600 font-medium font-bold">Select an accepted or offered candidate to populate their details instantly.</p>
                                            </div>
                                            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="text"
                                                placeholder="ðŸ”Ž Search candidates by name, position, company..."
                                                value={onboardingSearch}
                                                onChange={e => setOnboardingSearch(e.target.value)}
                                                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                                            />
                                            <div className="flex gap-2">
                                                <select
                                                    id="candidate-offer-autofetch-select"
                                                    value={selectedOfferId}
                                                    onChange={(e) => {
                                                        const offerId = e.target.value;
                                                        setSelectedOfferId(offerId);
                                                        if (offerId) {
                                                            const selected = offers.find(o => o.id === offerId);
                                                            if (selected) {
                                                                setData(prev => {
                                                                    const newData = { ...prev };
                                                                    newData.name = selected.employeeName || '';
                                                                    newData.mobileNumber = selected.mobileNumber || '';
                                                                    newData.joiningDate = selected.joiningDate || '';
                                                                    newData.company = selected.company || '';
                                                                    newData.designation = selected.position || '';
                                                                    newData.email = selected.email || '';
                                                                    newData.documents = {
                                                                        ...(prev.documents || {}),
                                                                        passportNumber: selected.passportNumber || '',
                                                                        emiratesId: selected.emiratesIdNumber || ''
                                                                    };
                                                                    newData.salary = {
                                                                        basic: selected.salary || 0,
                                                                        housing: selected.housingAllowance || 0,
                                                                        transport: selected.transportAllowance || 0,
                                                                        other: selected.otherAllowance || 0,
                                                                        airTicket: 0,
                                                                        leaveSalary: 0,
                                                                        hourlyRate: 0
                                                                    };
                                                                    return newData;
                                                                });
                                                            }
                                                        }
                                                    }}
                                                    className="flex-1 p-2.5 bg-white border border-indigo-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-bold"
                                                >
                                                    <option value="">-- Choose Offered / Hired Candidate --</option>
                                                    {offers
                                                        .filter(o => !onboardingSearch || 
                                                            o.employeeName?.toLowerCase().includes(onboardingSearch.toLowerCase()) || 
                                                            o.position?.toLowerCase().includes(onboardingSearch.toLowerCase()) ||
                                                            o.company?.toLowerCase().includes(onboardingSearch.toLowerCase())
                                                        )
                                                        .map(o => (
                                                            <option key={o.id} value={o.id}>
                                                                {o.employeeName} ({o.position}) - {o.status} {o.company ? `[${o.company}]` : ''}
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            {selectedOfferId && (
                                                <button
                                                    id="btn-clear-autofetch"
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedOfferId('');
                                                        setData(prev => ({
                                                            ...prev,
                                                            name: '',
                                                            mobileNumber: '',
                                                            joiningDate: '',
                                                            company: '',
                                                            designation: '',
                                                            email: '',
                                                            documents: {
                                                                ...(prev.documents || {}),
                                                                passportNumber: '',
                                                                emiratesId: ''
                                                            },
                                                            salary: { basic: 0, housing: 0, transport: 0, other: 0, airTicket: 0, leaveSalary: 0, hourlyRate: 0 }
                                                        }));
                                                    }}
                                                    className="px-3 py-2 bg-indigo-150 text-indigo-750 hover:bg-indigo-200 font-bold text-xs rounded-xl border border-indigo-200"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                                        reader.onloadend = async () => {
                                                            const compressed = await compressImage(reader.result as string);
                                                            setData({ ...data, profileImage: compressed });
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
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email ID (Optional)</label>
                                    <input 
                                        type="email"
                                        placeholder="employee@company.com" 
                                        value={data.email||''} 
                                        onChange={e=>setData({...data, email:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project Assigned</label>
                                    <input 
                                        placeholder="e.g. Burj Khalifa Site" 
                                        value={data.projectName||''} 
                                        onChange={e=>setData({...data, projectName:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900 font-bold" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nationality</label>
                                    <input 
                                        placeholder="e.g. UAE, India, UK" 
                                        value={data.nationality||''} 
                                        onChange={e=>setData({...data, nationality:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nick Name</label>
                                    <input 
                                        placeholder="e.g. Nick" 
                                        value={data.nickName||''} 
                                        onChange={e=>setData({...data, nickName:e.target.value})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Nick Name</label>
                                    <input 
                                        placeholder="e.g. Shashi" 
                                        value={data.employeeNickName||''} 
                                        onChange={e=>setData({...data, employeeNickName:e.target.value})} 
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
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Team Nick Name</label>
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
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Emirates ID Number</label>
                                    <input 
                                        placeholder="784-..." 
                                        value={data.documents?.emiratesId||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), emiratesId:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">EID Issue Date</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.emiratesIdIssue||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), emiratesIdIssue:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">EID Expiry</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.emiratesIdExpiry||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), emiratesIdExpiry:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passport Number</label>
                                    <input 
                                        placeholder="e.g. N1234567" 
                                        value={data.documents?.passportNumber||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), passportNumber:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passport Issue Date</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.passportIssue||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), passportIssue:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passport Expiry</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.passportExpiry||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), passportExpiry:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Labour Card Number</label>
                                    <input 
                                        placeholder="e.g. L123456" 
                                        value={data.documents?.labourCardNumber||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), labourCardNumber:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Labour Card Issue</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.labourCardIssue||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), labourCardIssue:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Labour Card Expiry</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.labourCardExpiry||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), labourCardExpiry:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Temporary Company Name</label>
                                    <input 
                                        placeholder="e.g. Temp Corp LLC" 
                                        value={data.documents?.temporaryCompanyName||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), temporaryCompanyName:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Temporary Labour Card Number</label>
                                    <input 
                                        placeholder="e.g. TL12345" 
                                        value={data.documents?.temporaryLabourCardNumber||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), temporaryLabourCardNumber:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Temp Labour Card Issue</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.temporaryLabourCardIssue||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), temporaryLabourCardIssue:e.target.value}})} 
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-gray-900" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Temp Labour Card Expiry</label>
                                    <input 
                                        type="date" 
                                        value={data.documents?.temporaryLabourCardExpiry||''} 
                                        onChange={e=>setData({...data, documents:{...(data.documents || {}), temporaryLabourCardExpiry:e.target.value}})} 
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
    const [searchTerm, setSearchTerm] = useState('');
    const isAuthorizedToManage = 
        currentUser?.permissions?.canManageUsers || 
        currentUser?.role === UserRole.ADMIN || 
        currentUser?.role === UserRole.CREATOR || 
        currentUser?.role?.toLowerCase() === 'admin' || 
        currentUser?.role?.toLowerCase() === 'creator' || 
        currentUser?.email?.toLowerCase() === 'abdulkaderp3010@gmail.com' ||
        currentUser?.email?.toLowerCase() === CREATOR_USER.username.toLowerCase();
    const [showAdd, setShowAdd] = useState(false);
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showEditingPassword, setShowEditingPassword] = useState(false);
    
    const fileInputNewRef = useRef<HTMLInputElement>(null);
    const fileInputEditRef = useRef<HTMLInputElement>(null);

    const [newUser, setNewUser] = useState({ 
        username: '', 
        password: '', 
        role: '', 
        name: '',
        photoURL: '',
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
            canManageProjects: false,
            canManageFinance: false
        }
    });

    useEffect(() => {
        setLocalUsers(users);
    }, [users]);

    const ROLE_DEFAULT_PERMISSIONS: Record<string, Partial<UserPermissions>> = {
        [UserRole.CREATOR]: {
            canViewDashboard: true, canViewCompanyDashboard: true, canManageEmployees: true, canViewDirectory: true,
            canManageAttendance: true, canViewTimesheet: true, canManageLeaves: true, canViewPayroll: true,
            canManagePayroll: true, canViewReports: true, canManageUsers: true, canManageSettings: true,
            canManageSuppliers: true, canManageProjects: true, canManageFinance: true
        },
        [UserRole.ADMIN]: {
            canViewDashboard: true, canViewCompanyDashboard: true, canManageEmployees: true, canViewDirectory: true,
            canManageAttendance: true, canViewTimesheet: true, canManageLeaves: true, canViewPayroll: true,
            canManagePayroll: true, canViewReports: true, canManageUsers: true, canManageSettings: true,
            canManageSuppliers: true, canManageProjects: true, canManageFinance: true
        },
        [UserRole.HR]: {
            canViewDashboard: true, canViewCompanyDashboard: true, canManageEmployees: true, canViewDirectory: true,
            canManageAttendance: true, canViewTimesheet: true, canManageLeaves: true, canViewPayroll: true,
            canManagePayroll: true, canViewReports: true, canManageUsers: false, canManageSettings: false,
            canManageSuppliers: true, canManageProjects: false, canManageFinance: false
        },
        [UserRole.SUPERVISOR]: {
            canViewDashboard: true, canViewCompanyDashboard: false, canManageEmployees: false, canViewDirectory: true,
            canManageAttendance: false, canViewTimesheet: true, canManageLeaves: false, canViewPayroll: false,
            canManagePayroll: false, canViewReports: true, canManageUsers: false, canManageSettings: false,
            canManageSuppliers: false, canManageProjects: false, canManageFinance: false
        },
        [UserRole.ENGINEER]: {
            canViewDashboard: true, canViewCompanyDashboard: false, canManageEmployees: false, canViewDirectory: true,
            canManageAttendance: false, canViewTimesheet: true, canManageLeaves: false, canViewPayroll: false,
            canManagePayroll: false, canViewReports: true, canManageUsers: false, canManageSettings: false,
            canManageSuppliers: false, canManageProjects: true, canManageFinance: false
        },
        [UserRole.ACCOUNTANT]: {
            canViewDashboard: true, canViewCompanyDashboard: true, canManageEmployees: false, canViewDirectory: true,
            canManageAttendance: false, canViewTimesheet: false, canManageLeaves: false, canViewPayroll: true,
            canManagePayroll: true, canViewReports: true, canManageUsers: false, canManageSettings: false,
            canManageSuppliers: true, canManageProjects: true, canManageFinance: true
        },
        [UserRole.EMPLOYEE]: {
            canViewDashboard: false, canViewCompanyDashboard: false, canManageEmployees: false, canViewDirectory: false,
            canManageAttendance: false, canViewTimesheet: false, canManageLeaves: false, canViewPayroll: false,
            canManagePayroll: false, canViewReports: false, canManageUsers: false, canManageSettings: false,
            canManageSuppliers: false, canManageProjects: false, canManageFinance: false
        }
    };

    const applySuggestedRole = (role: string) => {
        const matchedKey = Object.keys(ROLE_DEFAULT_PERMISSIONS).find(
            k => k.toLowerCase() === role.toLowerCase()
        ) || '';
        const defaultPerms = ROLE_DEFAULT_PERMISSIONS[matchedKey] || {};
        const mergedPerms = { ...INITIAL_PERMISSIONS, ...defaultPerms };
        setNewUser({
            ...newUser,
            role,
            permissions: mergedPerms
        });
    };

    const applySuggestedRoleToEditing = (role: string) => {
        if (!editingUser) return;
        const matchedKey = Object.keys(ROLE_DEFAULT_PERMISSIONS).find(
            k => k.toLowerCase() === role.toLowerCase()
        ) || '';
        const defaultPerms = ROLE_DEFAULT_PERMISSIONS[matchedKey] || {};
        const mergedPerms = { ...INITIAL_PERMISSIONS, ...defaultPerms };
        setEditingUser({
            ...editingUser,
            role: role as any,
            permissions: mergedPerms as any
        });
    };

    const handleAdd = async () => {
        console.log("Attempting to add new user:", { ...newUser, password: '***' });
        if (!newUser.username || !newUser.password || !newUser.name || !newUser.role) {
            alert("Please fill in all fields (Name, Username, Password, and Role)");
            return;
        }

        const userEmail = (newUser.username.includes('@') ? newUser.username : `${newUser.username}@system.local`).toLowerCase();
        if (localUsers.some(u => u.email?.toLowerCase() === userEmail)) {
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
                photoURL: newUser.photoURL || '',
                permissions: newUser.permissions
            };
            console.log("Saving user to Firestore...");
            try {
                await saveSystemUser(userToSave);
            } catch (firestoreErr: any) {
                console.error("Firestore save failed after creating Auth user, cleaning up Auth. Error:", firestoreErr);
                try {
                    await adminDeleteUser(userEmail, newUser.password);
                    console.log("Successfully cleaned up Auth user after Firestore failure");
                } catch (deleteErr) {
                    console.error("Failed to clean up Auth user:", deleteErr);
                }
                throw firestoreErr;
            }
            onLog('User Created', `New system user ${userToSave.name} (${userToSave.email}) was created with role ${userToSave.role}.`, 'create');
            console.log("User saved to Firestore successfully.");
            setShowAdd(false);
            setNewUser({ 
                username: '', 
                password: '', 
                role: '', 
                name: '',
                photoURL: '',
                permissions: { ...INITIAL_PERMISSIONS }
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
            const originalUser = localUsers.find(u => u.uid === editingUser.uid);
            const oldEmail = originalUser?.email || '';
            const oldPassword = originalUser?.password || '';

            const username = editingUser.username || editingUser.email || '';
            const newEmail = (username.includes('@') ? username : `${username}@system.local`).toLowerCase();
            const newPassword = editingUser.password || '';

            if (oldEmail && oldPassword && (oldEmail !== newEmail || oldPassword !== newPassword)) {
                console.log(`Syncing credentials update to Firebase Auth: ${oldEmail} -> ${newEmail}`);
                await adminUpdateUser(oldEmail, oldPassword, newEmail, newPassword);
            }

            const updatedUser = {
                ...editingUser,
                username,
                email: newEmail,
                password: newPassword
            };
            await saveSystemUser(updatedUser);
            onLog('User Updated', `System user ${updatedUser.name} (${updatedUser.email}) details were updated.`, 'update');
            setEditingUser(null);
        } catch (e: any) {
            alert("Error updating user: " + e.message);
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
                        {isAuthorizedToManage && (
                            <button onClick={() => { setShowAdd(true); setEditingUser(null); }} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                                <Plus className="w-4 h-4" /> Add User
                            </button>
                        )}
                    </div>

                    <div className="mb-4 relative">
                        <input
                            type="text"
                            placeholder="Search by name, email, or role..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 border rounded-xl bg-white text-gray-900 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 font-bold text-xs"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {showAdd && (
                        <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-indigo-150/40">
                                <div className="relative group shrink-0">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-indigo-600/60 border border-gray-250 overflow-hidden shrink-0 shadow-sm relative">
                                        {newUser.photoURL ? (
                                            <img src={newUser.photoURL} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-6 h-6 text-indigo-400" />
                                        )}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => fileInputNewRef.current?.click()}
                                        className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer animate-duration-200"
                                    >
                                        <Camera className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-750">Profile Picture</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Click to upload user avatar. PNG/JPG, Max 2MB.</p>
                                    <div className="flex gap-2.5">
                                        <button 
                                            type="button"
                                            onClick={() => fileInputNewRef.current?.click()}
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                        >
                                            Upload Image
                                        </button>
                                        {newUser.photoURL && (
                                            <button 
                                                type="button"
                                                onClick={() => setNewUser(prev => ({ ...prev, photoURL: '' }))}
                                                className="text-[11px] font-bold text-red-650 hover:text-red-750 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputNewRef}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = async () => {
                                                    const compressed = await compressImage(reader.result as string);
                                                    setNewUser(prev => ({ ...prev, photoURL: compressed }));
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                </div>
                            </div>

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
                                    <div className="relative">
                                        <input 
                                            className="w-full p-2 pr-10 border rounded-lg text-sm bg-white text-gray-900" 
                                            type={showNewPassword ? "text" : "password"} 
                                            placeholder="Password" 
                                            value={newUser.password} 
                                            onChange={e=>setNewUser({...newUser, password: e.target.value})} 
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase">Role Selection (Custom Select)</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-indigo-500 mb-2"
                                        value={Object.values(UserRole).includes(newUser.role as any) ? newUser.role : (newUser.role ? "Custom" : "")}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === "Custom") {
                                                setNewUser({ ...newUser, role: "" });
                                            } else {
                                                applySuggestedRole(val);
                                            }
                                        }}
                                    >
                                        <option value="" disabled>-- Select a Preset User Role --</option>
                                        {Object.values(UserRole).filter((srv: string) => srv !== UserRole.CREATOR).map((srv: string) => (
                                            <option key={srv} value={srv}>{srv}</option>
                                        ))}
                                        <option value="Custom">Custom Role (Type Customized Value)...</option>
                                    </select>

                                    {(!Object.values(UserRole).includes(newUser.role as any) || newUser.role === "Custom") && (
                                        <div className="mb-2">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase">Type Customized Role Name</label>
                                            <input 
                                                className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-indigo-500" 
                                                placeholder="Type customized role name here..." 
                                                value={newUser.role === "Custom" ? "" : newUser.role} 
                                                onChange={e=>setNewUser({...newUser, role: e.target.value})} 
                                            />
                                        </div>
                                    )}

                                    <label className="text-[10px] font-bold text-indigo-600 uppercase block pt-1">Role Suggestions (Click to Apply Defaults)</label>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {Object.values(UserRole).filter((srv: string) => srv !== UserRole.CREATOR).map((srv: string) => (
                                            <button
                                                key={srv}
                                                type="button"
                                                onClick={() => applySuggestedRole(srv)}
                                                className={cn(
                                                    "px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all border shadow-xs flex items-center gap-1",
                                                    newUser.role?.toLowerCase() === srv.toLowerCase()
                                                        ? "bg-indigo-600 text-white border-transparent" 
                                                        : "bg-white text-indigo-600 border-indigo-200/60 hover:bg-indigo-55/40"
                                                )}
                                            >
                                                {srv}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <label className="text-[10px] font-bold text-indigo-600 uppercase">Permissions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(INITIAL_PERMISSIONS).map(perm => (
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
                        <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <h4 className="text-sm font-bold text-orange-850">Editing: {editingUser.name}</h4>
                            
                            <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-orange-150/40">
                                <div className="relative group shrink-0">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-orange-600/60 border border-gray-250 overflow-hidden shrink-0 shadow-sm relative">
                                        {editingUser.photoURL ? (
                                            <img src={editingUser.photoURL} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-6 h-6 text-orange-400" />
                                        )}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => fileInputEditRef.current?.click()}
                                        className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer animate-duration-200"
                                    >
                                        <Camera className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-750">Profile Picture</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Click to upload user avatar. PNG/JPG, Max 2MB.</p>
                                    <div className="flex gap-2.5">
                                        <button 
                                            type="button"
                                            onClick={() => fileInputEditRef.current?.click()}
                                            className="text-[11px] font-bold text-orange-650 hover:text-orange-750 hover:underline"
                                        >
                                            Upload Image
                                        </button>
                                        {editingUser.photoURL && (
                                            <button 
                                                type="button"
                                                onClick={() => setEditingUser(prev => prev ? ({ ...prev, photoURL: '' }) : null)}
                                                className="text-[11px] font-bold text-red-650 hover:text-red-750 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputEditRef}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = async () => {
                                                    const compressed = await compressImage(reader.result as string);
                                                    setEditingUser(prev => prev ? ({ ...prev, photoURL: compressed }) : null);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                </div>
                            </div>

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
                                    <div className="relative">
                                        <input 
                                            className="w-full p-2 pr-10 border rounded-lg text-sm bg-white text-gray-900" 
                                            type={showEditingPassword ? "text" : "password"} 
                                            placeholder="Password" 
                                            value={editingUser.password || ''} 
                                            onChange={e=>setEditingUser({...editingUser, password: e.target.value})} 
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowEditingPassword(!showEditingPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-600 transition-colors"
                                        >
                                            {showEditingPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Role Selection (Custom Select)</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-orange-500 mb-2"
                                        value={Object.values(UserRole).includes(editingUser.role as any) ? editingUser.role : (editingUser.role ? "Custom" : "")}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === "Custom") {
                                                setEditingUser({ ...editingUser, role: "" as any });
                                            } else {
                                                applySuggestedRoleToEditing(val);
                                            }
                                        }}
                                    >
                                        <option value="" disabled>-- Select a Preset User Role --</option>
                                        {Object.values(UserRole).filter((srv: string) => srv !== UserRole.CREATOR).map((srv: string) => (
                                            <option key={srv} value={srv}>{srv}</option>
                                        ))}
                                        <option value="Custom">Custom Role (Type Customized Value)...</option>
                                    </select>

                                    {(!Object.values(UserRole).includes(editingUser.role as any) || (editingUser.role as any) === "Custom") && (
                                        <div className="mb-2">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase">Type Customized Role Name</label>
                                            <input 
                                                className="w-full p-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-orange-500" 
                                                placeholder="Type customized role name here..." 
                                                value={(editingUser.role as any) === "Custom" ? "" : editingUser.role} 
                                                onChange={e=>setEditingUser({...editingUser, role: e.target.value as any})} 
                                            />
                                        </div>
                                    )}

                                    <label className="text-[10px] font-bold text-orange-600 uppercase block pt-1">Role Suggestions (Click to Apply Defaults)</label>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {Object.values(UserRole).filter((srv: string) => srv !== UserRole.CREATOR).map((srv: string) => (
                                            <button
                                                key={srv}
                                                type="button"
                                                onClick={() => applySuggestedRoleToEditing(srv)}
                                                className={cn(
                                                    "px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all border shadow-xs flex items-center gap-1",
                                                    editingUser.role?.toLowerCase() === srv.toLowerCase()
                                                        ? "bg-orange-600 text-white border-transparent" 
                                                        : "bg-white text-orange-600 border-orange-200/60 hover:bg-orange-55/40"
                                                )}
                                            >
                                                {srv}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-2 mt-4">
                                <label className="text-[10px] font-bold text-orange-600 uppercase">Permissions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(INITIAL_PERMISSIONS).map(perm => (
                                        <label key={perm} className="flex items-center gap-2 p-2 border rounded-lg bg-white cursor-pointer hover:bg-orange-100/30">
                                            <input 
                                                type="checkbox" 
                                                checked={(editingUser.permissions as any)[perm]} 
                                                onChange={e => setEditingUser({
                                                    ...editingUser,
                                                    permissions: { 
                                                        ...INITIAL_PERMISSIONS, 
                                                        ...(editingUser.permissions || {}), 
                                                        [perm]: e.target.checked 
                                                    }
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
                        {(() => {
                            const filtered = localUsers.filter(u => {
                                // Creator details don't show anywhere
                                if (u.role === UserRole.CREATOR || u.email === CREATOR_USER.email) {
                                    return false;
                                }
                                if (!searchTerm) return true;
                                const term = searchTerm.toLowerCase();
                                return (
                                    (u.name || '').toLowerCase().includes(term) ||
                                    (u.email || '').toLowerCase().includes(term) ||
                                    (u.username || '').toLowerCase().includes(term) ||
                                    (u.role || '').toLowerCase().includes(term)
                                );
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="py-8 text-center text-gray-400 text-sm">
                                        No active system users matching "{searchTerm}"
                                    </div>
                                );
                            }

                            return filtered.map(u => (
                                <div key={u.uid || u.username} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-sm overflow-hidden shrink-0 border border-slate-100 shadow-xs">
                                            {u.photoURL ? (
                                                <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                                u.name ? u.name.charAt(0).toUpperCase() : '?'
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">{u.name} <span className="text-gray-400 font-normal">({u.email || u.username})</span></p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md uppercase">{u.role}</span>
                                                {u.password && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <span className="text-slate-300">|</span>
                                                        <span className="font-medium">Password: </span>
                                                        <span className="font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200/50 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                                            <Key className="w-3 h-3 text-amber-600" />
                                                            {u.password}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
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
                            ));
                        })()}
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
        logo: '',
        trn: '',
        establishmentId: '',
        bankRoutingCode: '',
        credentials: ''
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
            setFormData({ code: '', name: '', address: '', email: '', phone: '', logo: '', trn: '', establishmentId: '', bankRoutingCode: '', credentials: '' });
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
            const compressed = await compressImage(base64);
            if (company) {
                await updateCompany({ ...company, logo: compressed });
            } else {
                setFormData(prev => ({ ...prev, logo: compressed }));
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Office Address</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" 
                                            placeholder="123 Business St, Suite 100" 
                                            value={formData.address} 
                                            onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">TRN (VAT Number)</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 font-mono" 
                                            placeholder="e.g. 100xxxxxxxxxxxx" 
                                            value={formData.trn} 
                                            onChange={e => setFormData(prev => ({ ...prev, trn: e.target.value }))} 
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">MOHRE Establishment ID (WPS)</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 font-mono" 
                                            placeholder="13 digits (e.g. 7012345678901)" 
                                            value={formData.establishmentId} 
                                            maxLength={13}
                                            onChange={e => setFormData(prev => ({ ...prev, establishmentId: e.target.value.replace(/\D/g, '') }))} 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Bank Routing Code (WPS)</label>
                                        <input 
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 font-mono" 
                                            placeholder="9 digits (e.g. 020101234)" 
                                            value={formData.bankRoutingCode} 
                                            maxLength={9}
                                            onChange={e => setFormData(prev => ({ ...prev, bankRoutingCode: e.target.value.replace(/\D/g, '') }))} 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Portal Credentials / Notes (ICP, Daman, FTA, etc.)</label>
                                    <textarea 
                                        className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 font-mono min-h-[80px]" 
                                        placeholder="ICP, Daman, FTA logins..." 
                                        value={formData.credentials} 
                                        onChange={e => setFormData(prev => ({ ...prev, credentials: e.target.value }))} 
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
                                        <div className="space-y-1 col-span-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">TRN (VAT Registration Number)</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900 font-mono" 
                                                value={c.trn || ''} 
                                                onChange={e => handleUpdate({...c, trn: e.target.value})} 
                                                placeholder="e.g. 100xxxxxxxxxxxx"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">MOHRE Establishment ID (WPS)</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900 font-mono" 
                                                value={c.establishmentId || ''} 
                                                maxLength={13}
                                                onChange={e => handleUpdate({...c, establishmentId: e.target.value.replace(/\D/g, '')})} 
                                                placeholder="13 digits"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Bank Routing Code (WPS)</label>
                                            <input 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900 font-mono" 
                                                value={c.bankRoutingCode || ''} 
                                                maxLength={9}
                                                onChange={e => handleUpdate({...c, bankRoutingCode: e.target.value.replace(/\D/g, '')})} 
                                                placeholder="9 digits"
                                            />
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Portal Credentials / Notes (ICP, Daman, FTA, etc.)</label>
                                            <textarea 
                                                className="w-full p-2 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50/30 text-gray-900 font-mono min-h-[80px]" 
                                                value={c.credentials || ''} 
                                                onChange={e => handleUpdate({...c, credentials: e.target.value})} 
                                                placeholder="ICP, Daman, FTA logins..."
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <CompanyRecordsManager company={c} onUpdate={handleUpdate} />
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
    const [searchQuery, setSearchQuery] = useState('');
    const [editingLog, setEditingLog] = useState<AuditLog | null>(null);
    const [editDetails, setEditDetails] = useState('');
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

    if (!isOpen) return null;

    const isRoleAdminOrCreator = currentUser?.role?.toLowerCase() === 'creator' || currentUser?.role?.toLowerCase() === 'admin';
    const isAdmin = isRoleAdminOrCreator || currentUser?.email === 'abdulkaderp3010@gmail.com' || currentUser?.email === CREATOR_USER.username;

    const users = Array.from(new Set(logs.map(l => l.userName)));

    const filteredLogs = logs.filter(log => {
        // Search query filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchesAction = log.action.toLowerCase().includes(query);
            const matchesDetails = log.details.toLowerCase().includes(query);
            const matchesUser = log.userName.toLowerCase().includes(query);
            if (!matchesAction && !matchesDetails && !matchesUser) {
                return false;
            }
        }

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
                            {(currentUser?.role?.toLowerCase() === 'creator' || currentUser?.email === 'abdulkaderp3010@gmail.com' || currentUser?.email === CREATOR_USER.username) && (
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

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Audit Logs</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, action or details..."
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                />
                            </div>
                        </div>

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
                        {(currentUser?.role?.toLowerCase() === 'creator' || currentUser?.email === 'abdulkaderp3010@gmail.com' || currentUser?.email === CREATOR_USER.username) && (
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
                            <p className="text-xs text-slate-500 font-medium">{employee.name} â€¢ {employee.code}</p>
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

  // Dynamic UI Theme & Personalization Redesign states
  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shiftsync_theme') || 'indigo';
    }
    return 'indigo';
  });
  const [typographyScale, setTypographyScale] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shiftsync_typography') || 'classic';
    }
    return 'classic';
  });
  const [ambianceMode, setAmbianceMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shiftsync_ambiance') || 'flat';
    }
    return 'flat';
  });
  const [animationIntensity, setAnimationIntensity] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shiftsync_animations') || 'smooth';
    }
    return 'smooth';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('shiftsync_theme', activeTheme);
    localStorage.setItem('shiftsync_typography', typographyScale);
    localStorage.setItem('shiftsync_ambiance', ambianceMode);
    localStorage.setItem('shiftsync_animations', animationIntensity);

    const root = document.documentElement;

    const palettes: Record<string, Record<string, string>> = {
      indigo: {
        '--color-brand-50': '#f0f9ff',
        '--color-brand-100': '#e0f2fe',
        '--color-brand-200': '#bae6fd',
        '--color-brand-300': '#7dd3fc',
        '--color-brand-400': '#38bdf8',
        '--color-brand-500': '#0ea5e9',
        '--color-brand-600': '#0284c7',
        '--color-brand-700': '#0369a1',
        '--color-brand-800': '#075985',
        '--color-brand-900': '#0c4a6e',
        '--color-brand-950': '#082f49',
      },
      emerald: {
        '--color-brand-50': '#f0fdf4',
        '--color-brand-100': '#dcfce7',
        '--color-brand-200': '#bbf7d0',
        '--color-brand-300': '#86efac',
        '--color-brand-400': '#4ade80',
        '--color-brand-500': '#22c55e',
        '--color-brand-600': '#16a34a',
        '--color-brand-700': '#15803d',
        '--color-brand-800': '#166534',
        '--color-brand-900': '#14532d',
        '--color-brand-950': '#052e16',
      },
      crimson: {
        '--color-brand-50': '#fff1f2',
        '--color-brand-100': '#ffe4e6',
        '--color-brand-200': '#fecdd3',
        '--color-brand-300': '#fda4af',
        '--color-brand-400': '#fb7185',
        '--color-brand-500': '#f43f5e',
        '--color-brand-600': '#e11d48',
        '--color-brand-700': '#be123c',
        '--color-brand-800': '#9f1239',
        '--color-brand-900': '#881337',
        '--color-brand-950': '#4c0519',
      },
      violet: {
        '--color-brand-50': '#faf5ff',
        '--color-brand-100': '#f3e8ff',
        '--color-brand-200': '#e9d5ff',
        '--color-brand-300': '#d8b4fe',
        '--color-brand-400': '#c084fc',
        '--color-brand-500': '#a855f7',
        '--color-brand-600': '#9333ea',
        '--color-brand-700': '#7e22ce',
        '--color-brand-800': '#6b21a8',
        '--color-brand-900': '#581c87',
        '--color-brand-950': '#3b0764',
      },
      amber: {
        '--color-brand-50': '#fffbeb',
        '--color-brand-100': '#fef3c7',
        '--color-brand-200': '#fde68a',
        '--color-brand-300': '#fcd34d',
        '--color-brand-400': '#fbbf24',
        '--color-brand-500': '#f59e0b',
        '--color-brand-600': '#d97706',
        '--color-brand-700': '#b45309',
        '--color-brand-800': '#92400e',
        '--color-brand-900': '#78350f',
        '--color-brand-950': '#451a03',
      },
      cyberpunk: {
        '--color-brand-50': '#f5f3ff',
        '--color-brand-100': '#ede9fe',
        '--color-brand-200': '#ddd6fe',
        '--color-brand-300': '#c4b5fd',
        '--color-brand-400': '#a78bfa',
        '--color-brand-500': '#8b5cf6',
        '--color-brand-600': '#7c3aed',
        '--color-brand-700': '#6d28d9',
        '--color-brand-800': '#5b21b6',
        '--color-brand-900': '#4c1d95',
        '--color-brand-950': '#2e1065',
      }
    };

    const selected = palettes[activeTheme] || palettes.indigo;
    Object.entries(selected).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    const fonts: Record<string, string> = {
      classic: '"Inter", system-ui, sans-serif',
      modern: '"Outfit", "Space Grotesk", sans-serif',
      mono: '"JetBrains Mono", monospace'
    };
    root.style.setProperty('--font-sans', fonts[typographyScale] || fonts.classic);

    if (typographyScale === 'modern' && !document.getElementById('outfit-font-import')) {
      const link = document.createElement('link');
      link.id = 'outfit-font-import';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@350;400;500;600;700;800;900&family=Space+Grotesk:wght@355;400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, [activeTheme, typographyScale, ambianceMode, animationIntensity]);
  
  // Custom global download popup state and listener
  const [downloadPopup, setDownloadPopup] = useState<{
    isOpen: boolean;
    filename: string;
    blobUrl: string;
    triggerDownload?: () => void;
  }>({
    isOpen: false,
    filename: '',
    blobUrl: ''
  });

  useEffect(() => {
    (window as any)._shiftsyncShowDownload = (filename: string, blobUrl: string, triggerDownload: () => void) => {
      setDownloadPopup({
        isOpen: true,
        filename: filename || 'document.pdf',
        blobUrl: blobUrl || '',
        triggerDownload
      });
    };
    return () => {
      delete (window as any)._shiftsyncShowDownload;
    };
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  useEffect(() => {
    (window as any).openShortcuts = () => {
      if (systemUser?.role?.toLowerCase() === 'employee') return;
      setShowShortcuts(true);
    };
  }, [systemUser]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [deductions, setDeductions] = useState<DeductionRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CorporateBankAccount[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<AccountsPayable[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountsReceivable[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [showTaxCreditNoteModal, setShowTaxCreditNoteModal] = useState<CreditNote | boolean>(false);
  const [pettyCash, setPettyCash] = useState<PettyCash[]>([]);
  const [projectedExpenses, setProjectedExpenses] = useState<ProjectedExpense[]>([]);
  const [everydayExpenses, setEverydayExpenses] = useState<EverydayExpense[]>([]);
  const [camps, setCamps] = useState<CampExpense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [showCampModal, setShowCampModal] = useState<CampExpense | boolean>(false);
  const [engineerDocuments, setEngineerDocuments] = useState<EngineerDocument[]>([]);
  const [cicpaRecords, setCicpaRecords] = useState<CICPARecord[]>([]);
  const [showCICPAModal, setShowCICPAModal] = useState<CICPARecord | boolean>(false);
  const [safetyRecords, setSafetyRecords] = useState<SafetyRecord[]>([]);
  const [showSafetyModal, setShowSafetyModal] = useState<SafetyRecord | boolean>(false);
  const hasLoggedLogin = useRef(false);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [portalBranding, setPortalBranding] = useState<{ logoUrl?: string; logoText?: string; logoSubtext?: string }>({
    logoUrl: '',
    logoText: 'PIONEER',
    logoSubtext: 'DMS PORTAL'
  });

  const handleUpdatePortalBranding = async (branding: { logoUrl?: string; logoText?: string; logoSubtext?: string }) => {
    try {
      await setDoc(doc(db, 'settings', 'branding'), branding, { merge: true });
      await handleLogAction('Update Branding', `Updated system branding with custom logo: ${branding.logoText}`, 'update');
    } catch (error: any) {
      console.error("Error updating portal branding settings:", error);
      throw error;
    }
  };
  
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

  const handleSetDefaultBankAccount = async (id: string, log = true) => {
    try {
      // Find current default and unset it, set targeted one to default
      const batchWrites = bankAccounts.map(async (acc) => {
        const isTarget = acc.id === id;
        if (acc.isDefault !== isTarget) {
          await updateDoc(doc(db, 'bank_accounts', acc.id), { isDefault: isTarget });
        }
      });
      await Promise.all(batchWrites);
      if (log) {
        const targetAcc = bankAccounts.find(a => a.id === id);
        handleLogAction('Bank Account Default Changed', `Set ${targetAcc?.bankName || 'bank account'} as default for invoices & quotations.`, 'update');
      }
    } catch (error: any) {
      openConfirm('Error', `Failed to set default bank account: ${error.message}`, () => {}, 'danger');
    }
  };

  const handleAddBankAccount = async (acc: Omit<CorporateBankAccount, 'id'>) => {
    try {
      const newId = doc(collection(db, 'bank_accounts')).id;
      const finalAcc = { ...acc, id: newId };
      // If setting this to default, make sure others are set to false first
      if (finalAcc.isDefault) {
        await handleSetDefaultBankAccount(newId, false);
      }
      await setDoc(doc(db, 'bank_accounts', newId), finalAcc);
      handleLogAction('Bank Account Created', `Created corporate bank account ${acc.bankName} (${acc.accountNumber}).`, 'create');
    } catch (error: any) {
      openConfirm('Error', `Failed to add bank account: ${error.message}`, () => {}, 'danger');
    }
  };

  const handleUpdateBankAccount = async (acc: CorporateBankAccount) => {
    try {
      if (acc.isDefault) {
        await handleSetDefaultBankAccount(acc.id, false);
      }
      await setDoc(doc(db, 'bank_accounts', acc.id), acc);
      handleLogAction('Bank Account Updated', `Updated corporate bank account ${acc.bankName} (${acc.accountNumber}).`, 'update');
    } catch (error: any) {
      openConfirm('Error', `Failed to update bank account: ${error.message}`, () => {}, 'danger');
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bank_accounts', id));
      handleLogAction('Bank Account Deleted', `Deleted corporate bank account.`, 'delete');
    } catch (error: any) {
      openConfirm('Error', `Failed to delete bank account: ${error.message}`, () => {}, 'danger');
    }
  };
  
  // View States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showOffboarding, setShowOffboarding] = useState<Employee | null>(null);
  const [showOffboardingDetails, setShowOffboardingDetails] = useState<Employee | null>(null);
  const [showRejoining, setShowRejoining] = useState<Employee | null>(null);
  const [showEdit, setShowEdit] = useState<(Employee & { readOnly?: boolean }) | null>(null);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [cicpaSearchTerm, setCicpaSearchTerm] = useState('');
  const [safetySearchTerm, setSafetySearchTerm] = useState('');

  const handleNotificationClick = (docItem: any) => {
    if (docItem.type === 'employee') {
      const foundEmp = employees.find(e => e.name === docItem.employeeName && e.active);
      if (foundEmp) {
        setSelectedEmployeeId(foundEmp.id);
        setShowEdit(foundEmp);
        setActiveTab('staff');
      }
    } else if (docItem.type === 'company') {
      setCompanySearchTerm(docItem.employeeName);
      setActiveTab('company');
    } else if (docItem.type === 'cicpa') {
      setCicpaSearchTerm(docItem.employeeName);
      setActiveTab('cicpa');
    } else if (docItem.type === 'safety') {
      setSafetySearchTerm(docItem.employeeName);
      setActiveTab('safety');
    }
  };
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
          const rawData = snap.data();
          const data = {
            ...rawData,
            permissions: {
              ...INITIAL_PERMISSIONS,
              ...(rawData.permissions || {})
            }
          } as SystemUser;
          // Ensure creator role is correctly set for the default admin
          if (firebaseUser.email?.toLowerCase() === "abdulkaderp3010@gmail.com" && data.role !== UserRole.CREATOR) {
            data.role = UserRole.CREATOR;
            await saveSystemUser(data);
          }
          setSystemUser(data);
        } else {
          // Check if there's any user in Firestore matching this email (created by Admin)
          let foundByEmail = false;
          if (firebaseUser.email) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email.toLowerCase()));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                const matchedDoc = querySnap.docs[0];
                const matchedData = matchedDoc.data() as SystemUser;
                
                // We found the Admin-created profile! Let's save it under the correct auth UID
                const linkedProfile: SystemUser = {
                  ...matchedData,
                  uid: firebaseUser.uid, // ensure correct UID is set
                };
                await saveSystemUser(linkedProfile);
                setSystemUser(linkedProfile);
                foundByEmail = true;
                console.log("Found existing admin-created profile by email:", linkedProfile.name);
              }
            } catch (queryErr) {
              console.error("Error querying user by email in onAuthStateChanged:", queryErr);
            }
          }

          if (!foundByEmail) {
            // Create default profile for new user
            const isDefaultAdmin = firebaseUser.email?.toLowerCase() === "abdulkaderp3010@gmail.com";
            const newProfile: SystemUser = {
              uid: firebaseUser.uid,
              email: (firebaseUser.email || '').toLowerCase(),
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
                canManageProjects: isDefaultAdmin,
                canManageFinance: isDefaultAdmin
              }
            };
            await saveSystemUser(newProfile);
            setSystemUser(newProfile);
          }
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
    const isCreator = systemUser?.role?.toLowerCase() === 'creator' || user?.email === "abdulkaderp3010@gmail.com" || user?.email === CREATOR_USER.username;
    
    const canViewAudit = isCreator || systemUser.permissions.canManageSettings || systemUser.permissions.canManageUsers || systemUser.permissions.canManageEmployees;
    
    if (!canViewAudit) {
      setIsAuthReady(true);
      return;
    }

    q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    });
    return () => unsubscribe();
  }, [
    user?.uid, 
    systemUser?.uid, 
    systemUser?.role, 
    systemUser?.permissions?.canManageSettings, 
    systemUser?.permissions?.canManageUsers, 
    systemUser?.permissions?.canManageEmployees
  ]);

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
    const isCreator = systemUser?.role?.toLowerCase() === 'creator' || user?.email === "abdulkaderp3010@gmail.com" || user?.email === CREATOR_USER.username;

    let unsubEmployees = () => {};
    if (systemUser?.permissions?.canViewDirectory || systemUser?.permissions?.canManageEmployees || isCreator) {
      unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
        setEmployees(snap.docs.map(d => d.data() as Employee));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'employees');
      });
    } else if (systemUser) {
      // Standard employee context. Listen to their own employee record matching userId.
      const q = query(collection(db, 'employees'), where('userId', '==', systemUser.uid));
      unsubEmployees = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setEmployees(snap.docs.map(d => d.data() as Employee));
        } else {
          // Fallback: search by id == systemUser.uid or name match
          const docRef = doc(db, 'employees', systemUser.uid);
          getDoc(docRef).then((dSnap) => {
            if (dSnap.exists()) {
              setEmployees([dSnap.data() as Employee]);
            } else if (systemUser.name) {
              const qName = query(collection(db, 'employees'), where('name', '==', systemUser.name));
              getDocs(qName).then((nameSnap) => {
                if (!nameSnap.empty) {
                  setEmployees(nameSnap.docs.map(d => d.data() as Employee));
                }
              });
            }
          }).catch(err => {
            console.error("Employee self load error:", err);
          });
        }
      }, (error) => {
        console.error("Employee query error:", error);
      });
    }

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
      setCompanies(snap.docs.map(d => ({ ...d.data(), id: d.id } as Company)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'companies');
    });

    const unsubBankAccounts = onSnapshot(collection(db, 'bank_accounts'), (snap) => {
      setBankAccounts(snap.docs.map(d => ({ ...d.data(), id: d.id } as CorporateBankAccount)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bank_accounts');
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      setSuppliers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Supplier)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ ...d.data(), id: d.id } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const unsubVendors = onSnapshot(collection(db, 'vendors'), (snap) => {
      setVendors(snap.docs.map(d => ({ ...d.data(), id: d.id } as Vendor)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vendors');
    });

    const unsubAP = onSnapshot(collection(db, 'accounts_payable'), (snap) => {
      setAccountsPayable(snap.docs.map(d => {
        const item = d.data() as AccountsPayable;
        let dueDate = item.dueDate;
        if (item.date) {
          try {
            const dVal = new Date(item.date);
            if (!isNaN(dVal.getTime())) {
              dVal.setDate(dVal.getDate() + 30);
              dueDate = dVal.toISOString().split('T')[0];
            }
          } catch (e) {}
        }
        return { ...item, dueDate };
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts_payable');
    });

    const unsubAR = onSnapshot(collection(db, 'accounts_receivable'), (snap) => {
      setAccountsReceivable(snap.docs.map(d => d.data() as AccountsReceivable));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts_receivable');
    });

    const unsubCreditNotes = onSnapshot(collection(db, 'credit_notes'), (snap) => {
      setCreditNotes(snap.docs.map(d => ({ ...d.data(), id: d.id } as CreditNote)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'credit_notes');
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

    const unsubEverydayExpenses = onSnapshot(
      collection(db, 'everyday_expenses'),
      (snap) => {
        const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }) as EverydayExpense);
        docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setEverydayExpenses(docs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'everyday_expenses');
      }
    );

    const unsubCamps = onSnapshot(collection(db, 'camps'), (snap) => {
      setCamps(snap.docs.map(d => ({ ...d.data(), id: d.id }) as CampExpense));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'camps');
    });

    const unsubVouchers = onSnapshot(collection(db, 'vouchers'), (snap) => {
      setVouchers(snap.docs.map(d => d.data() as Voucher));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vouchers');
    });

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Vehicle));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vehicles');
    });

    const unsubEngineerDocs = onSnapshot(collection(db, 'engineer_documents'), (snap) => {
      setEngineerDocuments(snap.docs.map(d => ({ ...d.data(), id: d.id }) as EngineerDocument));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'engineer_documents');
    });

    const unsubCICPA = onSnapshot(collection(db, 'cicpa_records'), (snap) => {
      setCicpaRecords(snap.docs.map(d => ({ ...d.data(), id: d.id }) as CICPARecord));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cicpa_records');
    });

    const unsubSafety = onSnapshot(collection(db, 'safety_records'), (snap) => {
      setSafetyRecords(snap.docs.map(d => ({ ...d.data(), id: d.id }) as SafetyRecord));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'safety_records');
    });

    const unsubHolidays = onSnapshot(collection(db, 'holidays'), (snap) => {
      setHolidays(snap.docs.map(d => d.data() as PublicHoliday));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'holidays');
    });

    const unsubUsers = (systemUser?.permissions?.canManageUsers || isCreator) ? onSnapshot(collection(db, 'users'), (snap) => {
      const uList = snap.docs.map(d => d.data() as SystemUser);
      const filtered = uList.filter(u => {
        const roleLower = (u.role || '').toLowerCase();
        const emailLower = (u.email || '').toLowerCase();
        const nameLower = (u.name || '').toLowerCase();
        return (
          roleLower !== 'creator' &&
          emailLower !== 'abdulkaderp3010@gmail.com' &&
          nameLower !== 'mohamed abdul kader'
        );
      });
      setSystemUsers(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }) : () => {};

    const unsubBranding = onSnapshot(doc(db, 'settings', 'branding'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPortalBranding({
          logoUrl: data.logoUrl || '',
          logoText: data.logoText || 'PIONEER',
          logoSubtext: data.logoSubtext || 'DMS PORTAL'
        });
      } else {
        setPortalBranding({
          logoUrl: '',
          logoText: 'PIONEER',
          logoSubtext: 'DMS PORTAL'
        });
      }
    }, (error) => {
      console.warn("Error subscribing to branding document, fallback values will be used:", error);
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
      unsubDeductions();
      unsubCompanies();
      unsubBankAccounts();
      unsubSuppliers();
      unsubProjects();
      unsubVendors();
      unsubAP();
      unsubAR();
      unsubCreditNotes();
      unsubPettyCash();
      unsubProjectedExpenses();
      unsubEverydayExpenses();
      unsubCamps();
      unsubVouchers();
      unsubVehicles();
      unsubEngineerDocs();
      unsubCICPA();
      unsubSafety();
      unsubHolidays();
      unsubUsers();
      unsubBranding();
    };
  }, [
    isAuthReady, 
    user?.uid, 
    systemUser?.uid, 
    systemUser?.role,
    systemUser?.permissions?.canViewDirectory,
    systemUser?.permissions?.canManageEmployees,
    systemUser?.permissions?.canViewTimesheet,
    systemUser?.permissions?.canManageAttendance,
    systemUser?.permissions?.canManageLeaves,
    systemUser?.permissions?.canViewPayroll,
    systemUser?.permissions?.canManagePayroll,
    systemUser?.permissions?.canManageUsers
  ]);

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
    const isDuplicate = accountsPayable.some(
      ap => ap.id !== data.id && 
            ap.invoiceNumber?.trim().toLowerCase() === data.invoiceNumber?.trim().toLowerCase()
    );
    if (isDuplicate) {
      alert(`Error: A bill/invoice with number "${data.invoiceNumber}" already exists in Accounts Payable. Duplicate bill/invoice numbers are not accepted.`);
      return;
    }
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

  const handleDeleteAPMultiple = async (items: AccountsPayable[]) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk deletions.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    openConfirm(
      "Bulk Delete Entries", 
      `Are you sure you want to permanently delete these ${items.length} selected ledger entries? This action is irreversible.`, 
      async () => {
        try {
          for (const item of items) {
            await deleteAccountsPayable(item.id);
          }
          handleLogAction('Payables Bulk Deleted', `Permanently deleted ${items.length} chosen ledger entries.`, 'delete');
          alert(`Successfully deleted the selected ${items.length} entries.`);
        } catch (err) {
          console.error("Failed to delete selected items: ", err);
          alert("An error occurred during bulk deletion.");
        }
      }
    );
  };

  const handleUpdateAPMultipleDate = async (items: AccountsPayable[], newDate: string) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk updates.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    openConfirm(
      "Bulk Update Dates", 
      `Are you sure you want to change the Invoice Date of these ${items.length} selected accounts payable entries to ${newDate}?`, 
      async () => {
        try {
          for (const item of items) {
            const updatedItem = {
              ...item,
              date: newDate,
              dueDate: (() => {
                try {
                  const d = new Date(newDate);
                  if (!isNaN(d.getTime())) {
                    d.setDate(d.getDate() + 30);
                    return d.toISOString().split('T')[0];
                  }
                } catch (e) {}
                return item.dueDate; // fallback
              })()
            };
            await saveAccountsPayable(updatedItem);
          }
          handleLogAction('Payables Bulk Updated', `Updated date of ${items.length} chosen ledger entries to ${newDate}.`, 'update');
          alert(`Successfully updated dates for the selected ${items.length} entries.`);
        } catch (err) {
          console.error("Failed to bulk update selected items: ", err);
          alert("An error occurred during bulk update.");
        }
      }
    );
  };

  const handleUpdateAPMultipleNotes = async (items: AccountsPayable[], newNotes: string) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk updates.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    const isDelete = newNotes === '';
    const operationTitle = isDelete ? "Bulk Delete Notes/Remarks" : "Bulk Edit Notes/Remarks";
    const operationMessage = isDelete 
      ? `Are you sure you want to completely clear the notes / remarks for these ${items.length} selected accounts payable entries?`
      : `Are you sure you want to update the Notes / Remarks of these ${items.length} selected accounts payable entries to: "${newNotes}"?`;

    openConfirm(
      operationTitle, 
      operationMessage, 
      async () => {
        try {
          for (const item of items) {
            const updatedItem = {
              ...item,
              description: newNotes
            };
            await saveAccountsPayable(updatedItem);
          }
          const logMsg = isDelete 
            ? `Cleared notes / remarks for ${items.length} chosen accounts payable ledger entries.`
            : `Updated notes / remarks of ${items.length} chosen accounts payable entries to: "${newNotes}".`;
          handleLogAction(isDelete ? 'Payables Notes Cleared' : 'Payables Notes Bulk Updated', logMsg, 'update');
          alert(isDelete ? `Successfully cleared notes for the selected ${items.length} entries.` : `Successfully updated notes for the selected ${items.length} entries.`);
        } catch (err) {
          console.error("Failed to bulk update notes: ", err);
          alert("An error occurred during bulk notes update.");
        }
      }
    );
  };

  const handleUpdateAPMultipleCompanyId = async (items: AccountsPayable[], companyId: string) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk updates.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    const companyName = (companies || []).find((c: any) => c.id === companyId)?.name || 'Chosen Corporate Company';

    openConfirm(
      "Bulk Update Buying Corporate Identity", 
      `Are you sure you want to change the Buying Corporate Identity of these ${items.length} selected accounts payable entries to "${companyName}"?`, 
      async () => {
        try {
          for (const item of items) {
            const updatedItem = {
              ...item,
              companyId
            };
            await saveAccountsPayable(updatedItem);
          }
          handleLogAction('Payables Bulk Updated', `Updated buying corporate identity of ${items.length} chosen ledger entries to ${companyName}.`, 'update');
          alert(`Successfully updated corporate identity for the selected ${items.length} entries.`);
        } catch (err) {
          console.error("Failed to bulk update corporate identity: ", err);
          alert("An error occurred during bulk update.");
        }
      }
    );
  };

  const handleUpdateAPMultiplePaid = async (items: AccountsPayable[], paymentDate: string) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk updates.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    openConfirm(
      "Bulk Mark as Fully Paid", 
      `Are you sure you want to mark these ${items.length} selected accounts payable entries as fully PAID with payment date ${paymentDate}? This will set the paid amount to match the total invoice amount.`, 
      async () => {
        try {
          for (const item of items) {
            // Calculate total amount exactly like individual modal:
            const actual = item.actualAmount !== undefined ? item.actualAmount : ((item.amount || 0) - (item.deduction || 0));
            const vat = item.vatAmount !== undefined ? item.vatAmount : Number((actual * 0.05).toFixed(2));
            const total = item.totalAmount !== undefined ? item.totalAmount : Number((actual + vat).toFixed(2));
            
            // Paid should cover everything except what was already covered by advance
            const nextPaid = Number((total - (item.advance || 0)).toFixed(2));

            const updatedItem = {
              ...item,
              paid: nextPaid,
              payableAmount: 0,
              status: 'Paid' as const,
              paymentDate: paymentDate
            };
            await saveAccountsPayable(updatedItem);
          }
          handleLogAction('Payables Bulk Paid', `Marked ${items.length} chosen ledger entries as fully paid with date ${paymentDate}.`, 'update');
          alert(`Successfully marked the selected ${items.length} entries as fully PAID.`);
        } catch (err) {
          console.error("Failed to bulk update selected items: ", err);
          alert("An error occurred during bulk paid status update.");
        }
      }
    );
  };

  const handleDeleteARMultiple = async (items: AccountsReceivable[]) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk deletions.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    openConfirm(
      "Bulk Delete Entries", 
      `Are you sure you want to permanently delete these ${items.length} selected accounts receivable entries? This action is irreversible.`, 
      async () => {
        try {
          for (const item of items) {
            await deleteAccountsReceivable(item.id);
          }
          handleLogAction('Receivables Bulk Deleted', `Permanently deleted ${items.length} chosen ledger entries.`, 'delete');
          alert(`Successfully deleted the selected ${items.length} entries.`);
        } catch (err) {
          console.error("Failed to delete selected items: ", err);
          alert("An error occurred during bulk deletion.");
        }
      }
    );
  };

  const handleUpdateARMultipleDate = async (items: AccountsReceivable[], newDate: string) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can perform bulk updates.");
      return;
    }

    if (items.length === 0) {
      alert("No data records selected.");
      return;
    }

    openConfirm(
      "Bulk Update Dates", 
      `Are you sure you want to change the Date of these ${items.length} selected accounts receivable entries to ${newDate}?`, 
      async () => {
        try {
          for (const item of items) {
            const updatedItem = {
              ...item,
              date: newDate
            };
            await saveAccountsReceivable(updatedItem);
          }
          handleLogAction('Receivables Bulk Updated', `Updated date of ${items.length} chosen ledger entries to ${newDate}.`, 'update');
          alert(`Successfully updated dates for the selected ${items.length} entries.`);
        } catch (err) {
          console.error("Failed to bulk update selected items: ", err);
          alert("An error occurred during bulk update.");
        }
      }
    );
  };

  const handleDeleteAPBatch = async (batchId: string) => {
    const userRoleLower = (systemUser?.role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || systemUser?.email === 'abdulkaderp3010@gmail.com';
    
    if (!isAdmin) {
      alert("Access Denied: Only portal Admins can delete Excel import batches.");
      return;
    }

    const toDelete = accountsPayable.filter((ap: AccountsPayable) => ap.excelBatchId === batchId || ap.excelFileName === batchId);
    if (toDelete.length === 0) {
      alert("No data records found in this batch.");
      return;
    }

    const firstItem = toDelete[0];
    const displayFilename = firstItem.excelFileName || batchId;

    openConfirm(
      "Delete Excel Data", 
      `Are you sure you want to delete the imported excel file "${displayFilename}" and completely erase all its ${toDelete.length} associated data records? This option is irreversible and only available for super-admins.`, 
      async () => {
        try {
          for (const item of toDelete) {
            await deleteAccountsPayable(item.id);
          }
          handleLogAction('Payables Batch Deleted', `Permanently deleted import file ${displayFilename} and ${toDelete.length} ledger rows.`, 'delete');
          alert(`Successfully deleted the imported Excel file "${displayFilename}" and erased all associated ${toDelete.length} entries.`);
        } catch (err) {
          console.error("Failed to delete imported batch: ", err);
          alert("An error occurred while deleting the imported batch.");
        }
      }
    );
  };

  const handleUploadExcelPayable = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rawData || rawData.length < 2) {
          alert("No data found or columns missing in Excel sheet.");
          return;
        }

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawData.length, 5); i++) {
          const row = rawData[i];
          if (row && row.some((cell: any) => String(cell).toLowerCase().trim() === 'name of supplier' || String(cell).toLowerCase().trim() === 'supplier')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = rawData[headerRowIndex].map((h: any) => String(h || '').trim());
        
        const idxNameOfSupplier = headers.findIndex((h: string) => h.toLowerCase().includes('name of supplier') || h.toLowerCase() === 'supplier name');
        const idxSupplierCode = headers.findIndex((h: string) => h.toLowerCase().trim() === 'supplier' || h.toLowerCase() === 'supplier code');
        const idxInvoiceNumber = headers.findIndex((h: string) => h.toLowerCase().includes('invoice number') || h.toLowerCase().includes('invoice #') || h.toLowerCase() === 'invoice');
        const idxHours = headers.findIndex((h: string) => h.toLowerCase() === 'hours' || h.toLowerCase().includes('hours'));
        const idxBillAmount = headers.findIndex((h: string) => h.toLowerCase().includes('bill amount'));
        const idxActualAmount = headers.findIndex((h: string) => h.toLowerCase().includes('actual amount') || h.toLowerCase() === 'actual amount');
        const idxVat = headers.findIndex((h: string) => h.toLowerCase() === 'vat' || h.toLowerCase().includes('vat'));
        const idxTotal = headers.findIndex((h: string) => h.toLowerCase() === 'total' || h.toLowerCase().includes('total amount'));
        const idxAdvance = headers.findIndex((h: string) => h.toLowerCase().includes('advance'));
        const idxDeduction = headers.findIndex((h: string) => h.toLowerCase().includes('deduction'));
        const idxPaid = headers.findIndex((h: string) => h.toLowerCase() === 'paid');
        const idxPayableAmount = headers.findIndex((h: string) => h.toLowerCase().includes('payable amount'));
        const idxClearDate = headers.findIndex((h: string) => h.toLowerCase().includes('clear date') || h.toLowerCase().includes('payment clear date') || h.toLowerCase().includes('payment date'));
        const idxNotes = headers.findIndex((h: string) => h.toLowerCase().includes('notes') || h.toLowerCase().includes('remarks') || h.toLowerCase().includes('notes / remarks'));
        const idxDate = headers.findIndex((h: string) => h.toLowerCase().trim() === 'date' || h.toLowerCase().trim() === 'invoice date' || h.toLowerCase().trim() === 'posting date' || h.toLowerCase().includes('date'));
        const idxCompany = headers.findIndex((h: string) => h.toLowerCase().includes('company') || h.toLowerCase().includes('buying') || h.toLowerCase().includes('corporate') || h.toLowerCase().includes('filing entity') || h.toLowerCase().includes('buyer'));

        if (idxNameOfSupplier === -1 && idxSupplierCode === -1) {
          alert("Could not identify 'Name of Supplier' or 'Supplier' column of the excel sheet. Please check column headers.");
          return;
        }

        const importedList: AccountsPayable[] = [];
        const batchId = `${file.name}_${Date.now()}`;
        const fileNameToUse = file.name;

        for (let r = headerRowIndex + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || row.length === 0) continue;

          const rawName = idxNameOfSupplier !== -1 && row[idxNameOfSupplier] !== undefined ? String(row[idxNameOfSupplier]).trim() : '';
          const rawCode = idxSupplierCode !== -1 && row[idxSupplierCode] !== undefined ? String(row[idxSupplierCode]).trim() : '';
          
          let nameToUse = rawName;
          let codeToUse = rawCode;
          if (!nameToUse && !codeToUse) continue;
          if (!nameToUse) nameToUse = codeToUse;
          if (!codeToUse) codeToUse = nameToUse.substring(0, 3).toUpperCase();

          const cleanRawName = nameToUse.toLowerCase().trim();
          const cleanRawCode = codeToUse.toLowerCase().trim();
          const matchedSup = (suppliers || []).find((s: any) => 
            s.name?.toLowerCase().trim() === cleanRawName || 
            s.code?.toLowerCase().trim() === cleanRawCode
          );

          let finalVendorId = '';

          if (matchedSup) {
            finalVendorId = matchedSup.id;
          } else {
            const newSup = {
              id: 'sup_' + Math.random().toString(36).substr(2, 9),
              name: nameToUse,
              code: codeToUse,
              createdAt: new Date().toISOString()
            };
            finalVendorId = newSup.id;
            await addSupplier(newSup as any); 
          }

          const rawInvoice = idxInvoiceNumber !== -1 && row[idxInvoiceNumber] !== undefined ? String(row[idxInvoiceNumber]).trim() : '';
          const invoiceNumber = rawInvoice || 'INV-' + Math.random().toString(36).substr(2, 5).toUpperCase();

          const hoursVal = idxHours !== -1 && row[idxHours] !== undefined ? Number(String(row[idxHours]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const billAmountVal = idxBillAmount !== -1 && row[idxBillAmount] !== undefined ? Number(String(row[idxBillAmount]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const deductionVal = idxDeduction !== -1 && row[idxDeduction] !== undefined ? Number(String(row[idxDeduction]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          
          let actualAmountVal = idxActualAmount !== -1 && row[idxActualAmount] !== undefined ? Number(String(row[idxActualAmount]).replace(/[^0-9.-]/g, '')) : (deductionVal > 0 ? (billAmountVal - deductionVal) : billAmountVal);
          if (deductionVal > 0 && idxActualAmount === -1) {
            actualAmountVal = billAmountVal - deductionVal;
          }
          
          const vatVal = idxVat !== -1 && row[idxVat] !== undefined ? Number(String(row[idxVat]).replace(/[^0-9.-]/g, '')) || Number((actualAmountVal * 0.05).toFixed(2)) : Number((actualAmountVal * 0.05).toFixed(2));
          const totalVal = idxTotal !== -1 && row[idxTotal] !== undefined ? Number(String(row[idxTotal]).replace(/[^0-9.-]/g, '')) || Number((actualAmountVal + vatVal).toFixed(2)) : Number((actualAmountVal + vatVal).toFixed(2));
          const advanceVal = idxAdvance !== -1 && row[idxAdvance] !== undefined ? Number(String(row[idxAdvance]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const paidVal = idxPaid !== -1 && row[idxPaid] !== undefined ? Number(String(row[idxPaid]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const payableAmountVal = idxPayableAmount !== -1 && row[idxPayableAmount] !== undefined ? Number(String(row[idxPayableAmount]).replace(/[^0-9.-]/g, '')) || Number((totalVal - paidVal - advanceVal).toFixed(2)) : Number((totalVal - paidVal - advanceVal).toFixed(2));

          let status: 'Pending' | 'Paid' | 'Partially Paid' = 'Pending';
          if (paidVal >= totalVal && totalVal > 0) {
            status = 'Paid';
          } else if (paidVal > 0) {
            status = 'Partially Paid';
          }

          const notes = idxNotes !== -1 && row[idxNotes] !== undefined ? String(row[idxNotes]).trim() : '';

          let apDate = new Date().toISOString().split('T')[0];
          if (idxDate !== -1 && row[idxDate]) {
            try {
              let rawDate = String(row[idxDate]).trim();
              if (rawDate && rawDate !== 'undefined') {
                if (!isNaN(Number(rawDate))) {
                  const serial = Number(rawDate);
                  const dateObj = new Date((serial - 25569) * 86400 * 1000);
                  apDate = dateObj.toISOString().split('T')[0];
                } else {
                  apDate = new Date(rawDate).toISOString().split('T')[0];
                }
              }
            } catch (e) {
              // fallback remains today
            }
          }

          let extractedCompanyId = '';
          if (idxCompany !== -1 && row[idxCompany]) {
            const rowCompanyVal = String(row[idxCompany]).trim().toLowerCase();
            const foundComp = (companies || []).find((c: any) => 
              c.name.toLowerCase().includes(rowCompanyVal) || 
              rowCompanyVal.includes(c.name.toLowerCase())
            );
            if (foundComp) {
              extractedCompanyId = foundComp.id;
            }
          }

          const newAp: AccountsPayable = {
            id: 'ap_' + Math.random().toString(36).substr(2, 9),
            companyId: extractedCompanyId || undefined,
            date: apDate,
            vendorId: finalVendorId,
            vendorType: 'Supplier',
            invoiceNumber,
            amount: billAmountVal,
            vatAmount: vatVal,
            totalAmount: totalVal,
            status,
            description: notes || `Imported via Ledger Excel list`,
            dueDate: (() => {
              try {
                const d = new Date(apDate);
                if (!isNaN(d.getTime())) {
                  d.setDate(d.getDate() + 30);
                  return d.toISOString().split('T')[0];
                }
              } catch (e) {}
              return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            })(),
            hours: hoursVal,
            actualAmount: actualAmountVal,
            advance: advanceVal,
            deduction: deductionVal,
            paid: paidVal,
            payableAmount: payableAmountVal,
            supplierName: nameToUse,
            supplierCode: codeToUse,
            excelBatchId: batchId,
            excelFileName: fileNameToUse
          };

          if (idxClearDate !== -1 && row[idxClearDate]) {
            try {
              let rawDate = String(row[idxClearDate]).trim();
              if (rawDate && rawDate !== 'undefined') {
                if (!isNaN(Number(rawDate))) {
                  const serial = Number(rawDate);
                  const dateObj = new Date((serial - 25569) * 86400 * 1000);
                  newAp.paymentDate = dateObj.toISOString().split('T')[0];
                } else {
                  newAp.paymentDate = new Date(rawDate).toISOString().split('T')[0];
                }
              }
            } catch (e) {
              // ignore
            }
          }

          importedList.push(newAp);
        }

        if (importedList.length === 0) {
          alert("No valid rows imported from the selected Excel sheet.");
          return;
        }

        for (const apItem of importedList) {
          await saveAccountsPayable(apItem);
        }

        handleLogAction('Payables Imported', `Imported ${importedList.length} Accounts Payable entries via Excel sheet.`, 'create');
        alert(`Successfully parsed & imported ${importedList.length} Accounts Payable entries into your Ledger!`);
      } catch (err: any) {
        console.error("Error parsing the excel file: ", err);
        alert("Could not process the Excel sheet. Ensure headers match columns exactly.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUploadExcelEveryday = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const roleLower = systemUser?.role?.toLowerCase() || '';
    const isCreatorUser = roleLower.includes('creator') || systemUser?.email === 'abdulkaderp3010@gmail.com' || systemUser?.email === CREATOR_USER.username;
    const isAppAdmin = roleLower.includes('admin') || roleLower.includes('creator') || roleLower.includes('super') || roleLower.includes('accountant') || roleLower.includes('finance') || isCreatorUser || !!systemUser?.permissions?.canManageFinance;
    
    if (!isAppAdmin) {
      alert("Error: Only full site access users (like super admin or development team) can upload excel data.");
      return;
    }
    
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rawData || rawData.length < 2) {
          alert("No data found or columns missing in Excel sheet.");
          return;
        }

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
          const row = rawData[i];
          if (row && row.some((cell: any) => {
            const val = String(cell).toLowerCase().trim();
            return val.includes('bill amount') || val.includes('shop name') || val.includes('invoice no') || val.includes('trn');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = rawData[headerRowIndex].map((h: any) => String(h || '').trim().toLowerCase());
        
        const idxDate = headers.findIndex((h: string) => h.includes('date') || h === 'day');
        const idxInvoiceNo = headers.findIndex((h: string) => h.includes('invoice no') || h.includes('invoice #') || h.includes('invoice number') || h.includes('bill no') || h.includes('bill number') || h === 'ref');
        const idxTrnNo = headers.findIndex((h: string) => h.includes('trn') || h.includes('trn no') || h.includes('trn number'));
        const idxClientName = headers.findIndex((h: string) => h.includes('client') || h.includes('client name'));
        const idxSupplierName = headers.findIndex((h: string) => h.includes('supplier') || h.includes('supplier name') || h.includes('vendor'));
        const idxShopName = headers.findIndex((h: string) => h.includes('shop') || h.includes('shop name') || h.includes('store'));
        const idxBillAmount = headers.findIndex((h: string) => h === 'amount' || h.includes('bill amount') || h.includes('base amount') || h.includes('subtotal'));
        const idxVatAmount = headers.findIndex((h: string) => h === 'vat' || h.includes('vat amount') || h.includes('tax'));
        const idxTotalAmount = headers.findIndex((h: string) => h.includes('total') || h.includes('total amount') || h.includes('net amount'));
        const idxDescription = headers.findIndex((h: string) => h.includes('description') || h.includes('details') || h.includes('purpose') || h.includes('remarks'));
        const idxCategory = headers.findIndex((h: string) => h.includes('category') || h.includes('exp type') || h.includes('type'));
        const idxProject = headers.findIndex((h: string) => h.includes('project') || h.includes('job'));
        const idxVehicle = headers.findIndex((h: string) => h.includes('vehicle') || h.includes('plate no') || h.includes('plate number') || h.includes('car'));
        const idxDriver = headers.findIndex((h: string) => h.includes('driver') || h.includes('vehicle driver'));
        const idxVehicleRemarks = headers.findIndex((h: string) => h.includes('vehicle remarks') || h.includes('remarks'));

        const importedList: EverydayExpense[] = [];
        const uploaderName = systemUser?.name || '';
        const uploaderUid = systemUser?.uid || '';
        
        const userExpenses = everydayExpenses.filter(ee => 
          (ee.uploadedByUid && uploaderUid && ee.uploadedByUid === uploaderUid) || 
          (ee.uploadedBy && uploaderName && ee.uploadedBy.toLowerCase() === uploaderName.toLowerCase())
        );
        let siNoCounter = userExpenses.length + 1;

        for (let r = headerRowIndex + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || row.length === 0) continue;

          const hasContent = row.some((c: any) => c !== undefined && c !== null && String(c).trim() !== '');
          if (!hasContent) continue;

          let expenseDate = new Date().toISOString().split('T')[0];
          if (idxDate !== -1 && row[idxDate] !== undefined) {
            try {
              let rawDate = String(row[idxDate]).trim();
              if (rawDate && rawDate !== 'undefined') {
                if (!isNaN(Number(rawDate))) {
                  const serial = Number(rawDate);
                  const dateObj = new Date((serial - 25569) * 86400 * 1000);
                  expenseDate = dateObj.toISOString().split('T')[0];
                } else {
                  expenseDate = new Date(rawDate).toISOString().split('T')[0];
                }
              }
            } catch (e) {
              // fallback remains today
            }
          }

          const invoiceNo = idxInvoiceNo !== -1 && row[idxInvoiceNo] !== undefined ? String(row[idxInvoiceNo]).trim() : '';
          const trnNo = idxTrnNo !== -1 && row[idxTrnNo] !== undefined ? String(row[idxTrnNo]).trim() : '';
          const clientName = idxClientName !== -1 && row[idxClientName] !== undefined ? String(row[idxClientName]).trim() : '-';
          const supplierName = idxSupplierName !== -1 && row[idxSupplierName] !== undefined ? String(row[idxSupplierName]).trim() : '';
          const shopName = idxShopName !== -1 && row[idxShopName] !== undefined ? String(row[idxShopName]).trim() : '';
          
          const rawBillAmt = idxBillAmount !== -1 && row[idxBillAmount] !== undefined ? Number(String(row[idxBillAmount]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const rawVatAmt = idxVatAmount !== -1 && row[idxVatAmount] !== undefined ? Number(String(row[idxVatAmount]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const rawTotalAmt = idxTotalAmount !== -1 && row[idxTotalAmount] !== undefined ? Number(String(row[idxTotalAmount]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          
          let billAmount = rawBillAmt;
          let vatAmount = rawVatAmt;
          let totalAmount = rawTotalAmt;

          if (totalAmount > 0 && billAmount === 0) {
            vatAmount = Number((totalAmount * 0.05 / 1.05).toFixed(2));
            billAmount = Number((totalAmount - vatAmount).toFixed(2));
          } else if (billAmount > 0 && totalAmount === 0) {
            if (vatAmount === 0) {
              vatAmount = Number((billAmount * 0.05).toFixed(2));
            }
            totalAmount = Number((billAmount + vatAmount).toFixed(2));
          } else if (billAmount > 0 && vatAmount > 0 && totalAmount === 0) {
            totalAmount = Number((billAmount + vatAmount).toFixed(2));
          }

          const description = idxDescription !== -1 && row[idxDescription] !== undefined ? String(row[idxDescription]).trim() : 'Imported via Excel';
          let category = idxCategory !== -1 && row[idxCategory] !== undefined ? String(row[idxCategory]).trim() : '';
          if (!category) {
            const descLower = description.toLowerCase();
            if (descLower.includes('fuel') || descLower.includes('petrol') || descLower.includes('diesel') || descLower.includes('refuel') || descLower.includes('adnoc')) {
              category = 'Fuel';
            } else if (descLower.includes('repair') || descLower.includes('maintenance') || descLower.includes('service') || descLower.includes('parts')) {
              category = 'Repair';
            } else if (descLower.includes('stationery') || descLower.includes('office') || descLower.includes('cleaning') || descLower.includes('pantry') || descLower.includes('water')) {
              category = 'Supplies';
            } else {
              category = 'General';
            }
          }

          let projectId = '';
          if (idxProject !== -1 && row[idxProject] !== undefined) {
            const projVal = String(row[idxProject]).trim().toLowerCase();
            const matchedProj = (projects || []).find((p: any) => 
              p.name?.toLowerCase().includes(projVal) || 
              projVal.includes(p.name?.toLowerCase())
            );
            if (matchedProj) {
              projectId = matchedProj.id;
            }
          }

          const vehicleNumber = idxVehicle !== -1 && row[idxVehicle] !== undefined ? String(row[idxVehicle]).trim() : '';
          const vehicleDriver = idxDriver !== -1 && row[idxDriver] !== undefined ? String(row[idxDriver]).trim() : '';
          const vehicleRemarks = idxVehicleRemarks !== -1 && row[idxVehicleRemarks] !== undefined ? String(row[idxVehicleRemarks]).trim() : '';
          const isVehicleFuel = category.toLowerCase() === 'fuel';

          const newEe: EverydayExpense = {
            id: 'ee_' + Math.random().toString(36).substr(2, 9),
            siNo: String(siNoCounter++),
            date: expenseDate,
            invoiceNo: invoiceNo || `INV-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            trnNo,
            clientName,
            supplierName,
            shopName,
            billAmount,
            vatAmount,
            totalAmount,
            description,
            category,
            projectId: projectId || undefined,
            uploadedBy: uploaderName,
            uploadedByUid: uploaderUid,
            uploadedDate: new Date().toISOString().split('T')[0],
            updatedBy: uploaderName,
            updatedByUid: uploaderUid,
            isVehicleFuel,
            vehicleNumber: vehicleNumber || undefined,
            vehicleDriver: vehicleDriver || undefined,
            vehicleRemarks: vehicleRemarks || undefined
          };

          importedList.push(newEe);
        }

        if (importedList.length === 0) {
          alert("No valid rows imported from the selected Excel sheet.");
          return;
        }

        for (const eeItem of importedList) {
          await saveEverydayExpense(eeItem);
        }

        handleLogAction('Everyday Expenses Imported', `Imported ${importedList.length} Everyday Expense entries via Excel.`, 'create');
        alert(`Successfully imported ${importedList.length} Everyday Expense entries via Excel!`);
      } catch (err: any) {
        console.error("Error importing everyday expenses excel: ", err);
        alert("Failed to parse the Excel file. Please check that column names match typical expense fields.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveAR = async (data: AccountsReceivable) => {
    const isDuplicate = accountsReceivable.some(
      ar => ar.id !== data.id && 
            ar.invoiceNumber?.trim().toLowerCase() === data.invoiceNumber?.trim().toLowerCase()
    );
    if (isDuplicate) {
      alert(`Error: A Tax Invoice with Invoice Number "${data.invoiceNumber}" already exists in the system. Duplicate invoice numbers are not accepted.`);
      return;
    }
    await saveAccountsReceivable(data);
    const isUpdate = accountsReceivable.some(ar => ar.id === data.id);
    handleLogAction(isUpdate ? 'Receivable Updated' : 'Receivable Added', `Accounts receivable entry ${data.invoiceNumber} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowARModal(false);
  };

  const handleSaveCreditNote = async (data: CreditNote) => {
    // 1. Optimistically update local state immediately so AR ledger, Credit Notes list & SOA are updated instantly
    setCreditNotes(prev => {
      const idx = prev.findIndex(cn => cn.id === data.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = data;
        return copy;
      }
      return [data, ...prev];
    });
    setShowTaxCreditNoteModal(false);

    // 2. Persist to Firestore
    try {
      const saved = await saveCreditNote(data);
      const isUpdate = creditNotes.some(cn => cn.id === (saved?.id || data.id));
      handleLogAction(
        isUpdate ? 'Tax Credit Note Updated' : 'Tax Credit Note Issued',
        `Tax Credit Note ${data.creditNoteNumber || data.id} for Invoice #${data.originalInvoiceNumber} was ${isUpdate ? 'updated' : 'issued'}.`,
        isUpdate ? 'update' : 'create'
      );
    } catch (err: any) {
      console.error("Failed to save Credit Note to cloud database:", err);
    }
  };

  const handleDeleteCreditNote = async (id: string) => {
    openConfirm("Delete Tax Credit Note", "Are you sure you want to permanently delete this Tax Credit Note? This action cannot be undone.", async () => {
      try {
        await deleteCreditNote(id);
        setCreditNotes(prev => prev.filter(x => x.id !== id));
        handleLogAction('Tax Credit Note Deleted', `Tax Credit Note ${id} was deleted.`, 'delete');
      } catch (err: any) {
        console.error("Failed to delete Tax Credit Note:", err);
        alert(`Failed to delete Tax Credit Note: ${err.message || err}`);
      }
    });
  };

  const handleDeleteAR = async (ar: AccountsReceivable) => {
    openConfirm("Delete Entry", `Are you sure you want to delete invoice ${ar.invoiceNumber || ar.id}?`, async () => {
      try {
        await deleteAccountsReceivable(ar.id);
        setAccountsReceivable(prev => prev.filter(x => x.id !== ar.id));
        handleLogAction('Receivable Deleted', `Accounts receivable entry ${ar.invoiceNumber || ar.id} was deleted.`, 'delete');
      } catch (err: any) {
        console.error("Failed to delete AR:", err);
        alert(`Failed to delete record: ${err.message || err}`);
      }
    });
  };

  const handleSavePettyCash = async (data: PettyCash) => {
    await savePettyCash(data);
    setPettyCash(prev => {
      const idx = prev.findIndex(x => x.id === data.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = data; return c; }
      return [data, ...prev];
    });
    const isUpdate = pettyCash.some(pc => pc.id === data.id);
    handleLogAction(isUpdate ? 'Petty Cash Updated' : 'Petty Cash Added', `Petty cash entry ${data.description} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowPettyCashModal(false);
  };

  const handleDeletePettyCash = async (pc: PettyCash) => {
    openConfirm("Delete Entry", `Are you sure you want to delete petty cash entry: ${pc.description || pc.id}?`, async () => {
      try {
        await deletePettyCash(pc.id);
        setPettyCash(prev => prev.filter(x => x.id !== pc.id));
        handleLogAction('Petty Cash Deleted', `Petty cash entry ${pc.description || pc.id} was deleted.`, 'delete');
      } catch (err: any) {
        console.error("Failed to delete Petty Cash:", err);
        alert(`Failed to delete record: ${err.message || err}`);
      }
    });
  };

  const handleSaveProjectedExpense = async (data: ProjectedExpense) => {
    await saveProjectedExpense(data);
    setProjectedExpenses(prev => {
      const idx = prev.findIndex(x => x.id === data.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = data; return c; }
      return [data, ...prev];
    });
    const isUpdate = projectedExpenses.some(pe => pe.id === data.id);
    handleLogAction(isUpdate ? 'Projected Expense Updated' : 'Projected Expense Added', `Projected expense ${data.invoiceNumber} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowProjectedExpenseModal(false);
  };

  const handleDeleteProjectedExpense = async (pe: ProjectedExpense) => {
    openConfirm("Delete Entry", `Are you sure you want to delete projected expense: ${pe.invoiceNumber || pe.id}?`, async () => {
      try {
        await deleteProjectedExpense(pe.id);
        setProjectedExpenses(prev => prev.filter(x => x.id !== pe.id));
        handleLogAction('Projected Expense Deleted', `Projected expense ${pe.invoiceNumber || pe.id} was deleted.`, 'delete');
      } catch (err: any) {
        console.error("Failed to delete projected expense:", err);
        alert(`Failed to delete record: ${err.message || err}`);
      }
    });
  };

  const handleSaveCamp = async (data: CampExpense) => {
    await saveCamp(data);
    setCamps(prev => {
      const idx = prev.findIndex(x => x.id === data.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = data; return c; }
      return [data, ...prev];
    });
    const isUpdate = camps.some(c => c.id === data.id);
    handleLogAction(isUpdate ? 'Camp Updated' : 'Camp Added', `Camp expense ${data.campName} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    setShowCampModal(false);
  };

  const handleDeleteCamp = async (c: CampExpense) => {
    openConfirm("Delete Entry", `Are you sure you want to delete camp expense: ${c.campName || c.id}?`, async () => {
      try {
        await deleteCamp(c.id);
        setCamps(prev => prev.filter(x => x.id !== c.id));
        handleLogAction('Camp Deleted', `Camp expense ${c.campName || c.id} was deleted.`, 'delete');
      } catch (err: any) {
        console.error("Failed to delete camp:", err);
        alert(`Failed to delete record: ${err.message || err}`);
      }
    });
  };

  const handleSaveEverydayExpense = async (data: EverydayExpense) => {
    // If employeeId is provided, resolve employee name if missing
    let resolvedEmployeeName = (data as any).employeeName || '';
    if (data.employeeId && !resolvedEmployeeName) {
      const emp = employees.find(e => e.id === data.employeeId);
      if (emp?.name) resolvedEmployeeName = emp.name;
    }

    const enrichedData = {
      ...data,
      uploadedBy: data.uploadedBy || resolvedEmployeeName || systemUser?.name || '',
      uploadedByUid: data.uploadedByUid || systemUser?.uid || '',
      employeeName: resolvedEmployeeName || (data as any).employeeName || '',
      uploadedDate: data.uploadedDate || new Date().toISOString().split('T')[0],
      updatedBy: systemUser?.name || '',
      updatedByUid: systemUser?.uid || ''
    };

    // Instant optimistic UI update and modal close
    setEverydayExpenses(prev => {
      const idx = prev.findIndex(x => x.id === enrichedData.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = enrichedData; return c; }
      return [enrichedData, ...prev];
    });
    setShowEverydayExpenseModal(false);

    try {
      await saveEverydayExpense(enrichedData);
      const isUpdate = everydayExpenses.some(ee => ee.id === enrichedData.id);
      handleLogAction(isUpdate ? 'Everyday Expense Updated' : 'Everyday Expense Added', `Everyday expense ${enrichedData.invoiceNo || enrichedData.id} was ${isUpdate ? 'updated' : 'added'}.`, isUpdate ? 'update' : 'create');
    } catch (err: any) {
      console.error("Failed to persist everyday expense to database:", err);
    }
  };

  const handleDeleteEverydayExpense = async (ee: EverydayExpense) => {
    const roleLower = systemUser?.role?.toLowerCase() || '';
    const isEmployeeOnly = roleLower === 'employee' && !systemUser?.permissions?.canManageFinance && !systemUser?.permissions?.canManagePayroll;
    if (isEmployeeOnly && ee.uploadedByUid && ee.uploadedByUid !== systemUser?.uid) {
      alert("Error: Employees are only authorized to delete their own uploaded expense records.");
      return;
    }
    openConfirm("Delete Entry", `Are you sure you want to delete everyday expense: ${ee.invoiceNo || ee.id}?`, async () => {
      try {
        await deleteEverydayExpense(ee.id, ee.attachment || ee.receiptUrl);
        setEverydayExpenses(prev => prev.filter(x => x.id !== ee.id));
        handleLogAction('Everyday Expense Deleted', `Everyday expense ${ee.invoiceNo || ee.id} was deleted.`, 'delete');
      } catch (err: any) {
        console.error("Failed to delete everyday expense:", err);
        alert(`Failed to delete everyday expense: ${err.message || err}`);
      }
    });
  };

  const handleSaveVoucher = async (data: Voucher) => {
    await saveVoucher(data);
    setVouchers(prev => {
      const idx = prev.findIndex(x => x.id === data.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = data; return c; }
      return [data, ...prev];
    });
    const isUpdate = vouchers.some(v => v.id === data.id);
    handleLogAction(
      isUpdate ? 'Voucher Updated' : 'Voucher Added',
      `${data.voucherType === 'payment' ? 'Payment' : 'Receipt'} voucher ${data.voucherNo} was ${isUpdate ? 'updated' : 'added'}.`,
      isUpdate ? 'update' : 'create'
    );
  };

  const handleDeleteVoucher = async (id: string) => {
    const voucher = vouchers.find(v => v.id === id);
    if (voucher) {
      try {
        await deleteVoucher(id);
        setVouchers(prev => prev.filter(x => x.id !== id));
        handleLogAction(
          'Voucher Deleted',
          `${voucher.voucherType === 'payment' ? 'Payment' : 'Receipt'} voucher ${voucher.voucherNo} was deleted.`,
          'delete'
        );
      } catch (err: any) {
        console.error("Failed to delete voucher:", err);
        alert(`Failed to delete voucher: ${err.message || err}`);
      }
    }
  };

  const handleSaveEngineerDocument = async (docData: EngineerDocument) => {
    await saveEngineerDocument(docData);
    const isUpdate = engineerDocuments.some(d => d.id === docData.id);
    handleLogAction(
      isUpdate ? 'Engineer Document Updated' : 'Engineer Document Added', 
      `${docData.type} document ${docData.docNumber} was ${isUpdate ? 'updated' : 'added'}.`, 
      isUpdate ? 'update' : 'create'
    );
  };

  const handleDeleteEngineerDocument = async (id: string) => {
    const docItem = engineerDocuments.find(d => d.id === id);
    if (!docItem) return;
    await deleteEngineerDocument(id);
    handleLogAction('Engineer Document Deleted', `${docItem.type} document ${docItem.docNumber} was deleted.`, 'delete');
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
          { id: 'camp', label: 'Camp', icon: Home, permission: 'canManageFinance' },
          { id: 'vehicles', label: 'Vehicles', icon: Car, permission: 'canManageProjects' },
          { id: 'cicpa', label: 'CICPA', icon: ShieldCheck, permission: 'canManageEmployees' },
          { id: 'safety', label: 'Safety', icon: ShieldAlert, permission: 'canManageEmployees' },
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
          { id: 'visa-fees', label: 'Visa & Onboarding Fees', icon: CreditCard, permission: 'canManageEmployees' },
        ]
      },
      { 
        id: 'attendance-payroll', 
        label: 'HR', 
        icon: CreditCard, 
        subItems: [
          { id: 'timesheet', label: 'Monthly Timesheet', icon: Calendar, permission: 'canViewTimesheet' },
          { id: 'deductions', label: 'Deductions', icon: Wallet, permission: 'canManagePayroll' },
          { id: 'leave', label: 'Leave Management', icon: FileText, permission: 'canManageLeaves' },
          { id: 'payroll', label: 'Payroll Register', icon: DirhamIcon, permission: 'canViewPayroll' },
          { id: 'job-offer', label: 'Job Offer', icon: FileSignature, permission: 'canManageEmployees' },
          { id: 'experience', label: 'Experience Letter', icon: FileText, permission: 'canManageEmployees' },
          { id: 'noc', label: 'No Objection Certificate (NOC)', icon: FileText, permission: 'canManageEmployees' },
          { id: 'passport-acknowledgement', label: 'Passport Collection Acknowledgement', icon: ShieldCheck, permission: 'canManageEmployees' },
          { id: 'emirates-id-acknowledgement', label: 'Emirates ID Collection Acknowledgement', icon: CreditCard, permission: 'canManageEmployees' },
        ]
      },
      { 
        id: 'finance', 
        label: 'Finance', 
        icon: Wallet, 
        permission: 'canManageFinance', 
        subItems: [
          { id: 'finance', label: 'Financial Dashboard', icon: LayoutDashboard, permission: 'canManageFinance' },
          { id: 'accounts-payable', label: 'Accounts Payable', icon: TrendingDown, permission: 'canManageFinance' },
          { id: 'accounts-receivable', label: 'Invoices (Accounts Receivable)', icon: TrendingUp, permission: 'canManageFinance' },
          { id: 'petty-cash', label: 'Petty Cash', icon: Wallet, permission: 'canManageFinance' },
          { id: 'everyday-expenses', label: 'Everyday Expenses', icon: Wallet, permission: 'canManageFinance' },
          { id: 'vouchers', label: 'Add Vouchers Section', icon: FileText, permission: 'canManageFinance' },
          { id: 'projected-expenses', label: 'Project Expenses', icon: TrendingDown, permission: 'canManageFinance' },
          { id: 'engineer-hub', label: 'Procurement Documents', icon: HardHat, permission: 'canManageFinance' },
        ]
      },
      { id: 'engineer-hub', label: 'Procurement', icon: HardHat, roleCheck: ['engineer', 'accountant', 'admin', 'creator'] },
      { id: 'tasks-notes', label: 'Tasks & Notes', icon: StickyNote },
      { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'canViewReports' },
      { id: 'about', label: 'About', icon: AlertCircle, creatorOnly: true },
    ];
    
    if (!systemUser) return baseItems.filter(item => !item.permission && !item.creatorOnly);
    
    if (systemUser.role === UserRole.EMPLOYEE || systemUser.role?.toLowerCase() === 'employee') {
        return [
            { id: 'everyday-expenses', label: 'Everyday Expenses', icon: Wallet },
            { id: 'tasks-notes', label: 'Tasks & Notes', icon: StickyNote }
        ];
    }
    
    const systemUserRoleLower = systemUser?.role?.toLowerCase() || '';
    const isCreator = systemUserRoleLower === 'creator' || systemUser.email === 'abdulkaderp3010@gmail.com' || systemUser.email === CREATOR_USER.username;
    const isAdmin = systemUserRoleLower === 'admin' || isCreator;
    
    const filterItem = (item: any) => {
        if (item.creatorOnly && !isCreator) return false;
        if (isAdmin) return true;
        if (item.roleCheck) {
            const matches = item.roleCheck.some((r: string) => r.toLowerCase() === systemUserRoleLower);
            if (!matches) return false;
        }
        if (item.permission && !(systemUser.permissions as any)[item.permission]) return false;
        return true;
    };

    return baseItems.map(item => {
        if (!filterItem(item)) return null;
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
      const systemUserRoleLower = systemUser.role?.toLowerCase() || '';
      const isCreator = systemUserRoleLower === 'creator' || systemUser.email === 'abdulkaderp3010@gmail.com';
      const isAdmin = systemUserRoleLower === 'admin' || isCreator;
      let currentTabItem = navItems.find(item => item.id === activeTab);
      if (!currentTabItem) {
        for (const item of navItems) {
          if (item.subItems) {
            const foundInput = item.subItems.find((sub: any) => sub.id === activeTab);
            if (foundInput) {
              currentTabItem = foundInput;
              break;
            }
          }
        }
      }
      if (currentTabItem && currentTabItem.permission && !isAdmin && !(systemUser.permissions as any)[currentTabItem.permission]) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, systemUser, navItems]);

  useEffect(() => {
    const isEmployee = systemUser?.role === UserRole.EMPLOYEE || systemUser?.role?.toLowerCase() === 'employee';
    if (isEmployee && activeTab !== 'everyday-expenses' && activeTab !== 'tasks-notes') {
      setActiveTab('everyday-expenses');
    }
  }, [systemUser, activeTab]);

  const handleOffboard = async (data: OffboardingDetails) => {
      if (showOffboarding) {
          await offboardEmployee(showOffboarding.id, data);
          handleLogAction('Employee Offboarded', `Employee ${showOffboarding.name} (${showOffboarding.code}) was offboarded. Reason: ${data.reason}`, 'delete');
          try {
              downloadExperienceLetterPDF(showOffboarding, {
                  exitDate: data.exitDate,
                  conductText: `During their tenure with us, they fulfilled their duties to their best efforts. Their reason for exit was entered as: ${data.reason || 'Not specified'}.`
              });
          } catch (pdfErr) {
              console.error("Auto experience certificate download failed:", pdfErr);
          }
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
    if (!systemUser || systemUser?.role?.toLowerCase() === 'employee') return;

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

    // Check CICPA documents
    cicpaRecords.forEach(r => {
        const docs = [
            { name: 'CICPA Passport', date: r.passportExpireDate },
            { name: 'CICPA Visa', date: r.visaExpireDate },
            { name: 'CICPA Temp LC', date: r.tempLcExpireDate },
            { name: 'CICPA Card', date: r.cicpaExpireDate }
        ];
        
        docs.forEach(doc => {
            if (doc.date) {
                const expiry = new Date(doc.date);
                if (expiry <= now) {
                    results.push({ employeeName: r.nameEnglish, docName: doc.name, status: 'Expired', date: doc.date, type: 'cicpa' });
                } else if (expiry <= tenDaysFromNow) {
                    results.push({ employeeName: r.nameEnglish, docName: doc.name, status: 'Expiring Soon', date: doc.date, type: 'cicpa' });
                }
            }
        });
    });

    // Check Safety documents
    safetyRecords.forEach(r => {
        if (r.certificateExpireDate) {
            const expiry = new Date(r.certificateExpireDate);
            if (expiry <= now) {
                results.push({ employeeName: r.employeeName, docName: `Safety: ${r.certificateName}`, status: 'Expired', date: r.certificateExpireDate, type: 'safety' });
            } else if (expiry <= tenDaysFromNow) {
                results.push({ employeeName: r.employeeName, docName: `Safety: ${r.certificateName}`, status: 'Expiring Soon', date: r.certificateExpireDate, type: 'safety' });
            }
        }
    });

    return results;
  }, [employees, companies, cicpaRecords, safetyRecords]);

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
      onNotificationClick={handleNotificationClick}
      activeTheme={activeTheme}
      typographyScale={typographyScale}
      ambianceMode={ambianceMode}
      animationIntensity={animationIntensity}
      portalBranding={portalBranding}
    >
      {activeTab === 'dashboard' && (
        <DashboardView 
          employees={employees} 
          suppliers={suppliers}
          vendors={vendors}
          projects={projects}
          attendance={attendance} 
          leaveRequests={leaveRequests}
          user={systemUser}
          auditLogs={auditLogs}
          setShowAuditModal={setShowAuditModal}
          onOpenUserManagement={() => setShowUserManagement(true)}
          onOpenManageCompanies={() => setShowManageCompanies(true)}
          onOpenOnboarding={() => setShowOnboarding(true)}
          onUpdate={() => {}}
          setActiveTab={setActiveTab}
          onOpenHolidayManagement={() => setShowHolidayManagement(true)}
          accountsPayable={accountsPayable}
          accountsReceivable={accountsReceivable}
          pettyCash={pettyCash}
          everydayExpenses={everydayExpenses}
          projectedExpenses={projectedExpenses}
          activeTheme={activeTheme}
          animationIntensity={animationIntensity}
        />
      )}
      {activeTab === 'company' && (
        <CompanyView 
          companies={companies} 
          openConfirm={openConfirm}
          onUpdate={handleUpdateCompany}
          onAdd={handleCreateCompany}
          user={systemUser!}
          initialSearchTerm={companySearchTerm}
          accountsPayable={accountsPayable}
          accountsReceivable={accountsReceivable}
          vouchers={vouchers}
          everydayExpenses={everydayExpenses}
          camps={camps}
          pettyCash={pettyCash}
        />
      )}
      {activeTab === 'suppliers' && (
        <SupplierView 
          suppliers={suppliers} 
          openConfirm={openConfirm}
          onUpdate={handleUpdateSupplier}
          onAdd={handleCreateSupplier}
          user={systemUser!}
          accountsPayable={accountsPayable}
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
      {activeTab === 'visa-fees' && (
        <VisaFeesView 
          employees={employees} 
          companies={companies} 
          user={systemUser} 
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
            onOpenHolidayManagement={() => setShowHolidayManagement(true)}
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
        <PayrollRegisterView employees={employees.filter(e => e.active)} attendance={attendance} deductions={deductions} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} user={systemUser} companies={companies} onLog={handleLogAction} />
      )}
      {activeTab === 'job-offer' && (
        <JobOfferView 
          user={systemUser} 
          openConfirm={openConfirm} 
          companies={companies}
        />
      )}
      {activeTab === 'experience' && (
        <ExperienceLetterView 
          employees={employees} 
        />
      )}
      {activeTab === 'noc' && (
        <NocView 
          employees={employees} 
        />
      )}
      {activeTab === 'passport-acknowledgement' && (
        <PassportAcknowledgementView 
          employees={employees} 
        />
      )}
      {activeTab === 'emirates-id-acknowledgement' && (
        <EmiratesIdAcknowledgementView 
          employees={employees} 
        />
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
          onDeleteMultiple={handleDeleteAPMultiple}
          onDeleteBatch={handleDeleteAPBatch}
          onBulkUpdateDate={handleUpdateAPMultipleDate}
          onBulkUpdateNotes={handleUpdateAPMultipleNotes}
          onBulkUpdateCompanyId={handleUpdateAPMultipleCompanyId}
          onBulkUpdatePaid={handleUpdateAPMultiplePaid}
          onUploadExcel={handleUploadExcelPayable}
          user={systemUser}
          companies={companies}
          bankAccounts={bankAccounts}
        />
      )}
      {activeTab === 'accounts-receivable' && (
        <AccountsReceivableView 
          data={accountsReceivable}
          projects={projects}
          suppliers={suppliers}
          vendors={vendors}
          companies={companies}
          onAdd={() => setShowARModal(true)}
          onEdit={(ar: AccountsReceivable) => setShowARModal(ar)}
          onDelete={handleDeleteAR}
          onDeleteMultiple={handleDeleteARMultiple}
          onBulkUpdateDate={handleUpdateARMultipleDate}
          onSave={handleSaveAR}
          user={systemUser}
          bankAccounts={bankAccounts}
          creditNotes={creditNotes}
          onAddCreditNote={(init) => setShowTaxCreditNoteModal(init || true)}
          onEditCreditNote={(cn) => setShowTaxCreditNoteModal(cn)}
          onDeleteCreditNote={handleDeleteCreditNote}
          onSaveCreditNote={handleSaveCreditNote}
        />
      )}
      {activeTab === 'finance' && (
        <FinancialDashboardView 
          accountsPayable={accountsPayable}
          accountsReceivable={accountsReceivable}
          pettyCash={pettyCash}
          everydayExpenses={everydayExpenses}
          projects={projects}
          employees={employees}
          setActiveTab={setActiveTab}
          user={systemUser}
          camps={camps}
        />
      )}
      {activeTab === 'petty-cash' && (
        <PettyCashView 
          data={pettyCash}
          projects={projects}
          employees={employees}
          everydayExpenses={everydayExpenses}
          onAdd={() => setShowPettyCashModal(true)}
          onEdit={(pc: PettyCash) => setShowPettyCashModal(pc)}
          onSave={handleSavePettyCash}
          onDelete={handleDeletePettyCash}
          user={systemUser}
        />
      )}
      {activeTab === 'projected-expenses' && (
        <ProjectedExpenseView 
          data={(() => {
            const direct = projectedExpenses.map(p => ({
              ...p,
              type: 'direct' as const
            }));
            const everydayWithProject = everydayExpenses
              .filter(e => e.projectId && e.projectId !== 'no-project' && e.projectId !== '')
              .map(e => ({
                id: e.id,
                siNo: e.siNo || '',
                date: e.date || '',
                invoiceNumber: e.invoiceNo || 'N/A',
                billDescription: e.description || 'Everyday Expense',
                clientName: e.clientName || '-',
                siteLocation: e.shopName || e.supplierName || 'N/A',
                workDescription: e.category || 'Everyday Expense',
                actualAmount: typeof e.billAmount === 'number' ? e.billAmount : (e.totalAmount || 0) - (e.vatAmount || 0),
                vatAmount: e.vatAmount || 0,
                totalAmount: e.totalAmount || 0,
                projectId: e.projectId,
                uploadedBy: e.uploadedBy || 'Staff',
                uploadedByUid: e.uploadedByUid || '',
                updatedBy: e.updatedBy || '',
                updatedByUid: e.updatedByUid || '',
                type: 'everyday' as const
              }));
            return [...direct, ...everydayWithProject];
          })()}
          projects={projects}
          onAdd={() => setShowProjectedExpenseModal(true)}
          onEdit={(pe: any) => {
            if (pe.type === 'everyday') {
              const original = everydayExpenses.find(ee => ee.id === pe.id);
              if (original) {
                setShowEverydayExpenseModal(original);
              }
            } else {
              setShowProjectedExpenseModal(pe);
            }
          }}
          onDelete={(pe: any) => {
            if (pe.type === 'everyday') {
              const original = everydayExpenses.find(ee => ee.id === pe.id);
              if (original) {
                handleDeleteEverydayExpense(original);
              }
            } else {
              handleDeleteProjectedExpense(pe);
            }
          }}
          user={systemUser}
        />
      )}
      {activeTab === 'vouchers' && (
        <VouchersView
          data={vouchers}
          projects={projects}
          companies={companies}
          user={systemUser || CREATOR_USER}
          onSave={handleSaveVoucher}
          onDelete={handleDeleteVoucher}
          openConfirm={openConfirm}
        />
      )}
      {activeTab === 'everyday-expenses' && (() => {
        const roleLower = systemUser?.role?.toLowerCase() || '';
        const isCreatorUser = roleLower.includes('creator') || systemUser?.email === 'abdulkaderp3010@gmail.com' || systemUser?.email === CREATOR_USER.username;
        const isAppAdmin = roleLower.includes('admin') || roleLower.includes('creator') || roleLower.includes('super') || roleLower.includes('accountant') || roleLower.includes('finance') || isCreatorUser || !!systemUser?.permissions?.canManageFinance;
        return (
          <EverydayExpenseView 
            data={
              isAppAdmin 
                ? everydayExpenses 
                : everydayExpenses.filter(ee => {
                    const empObj = employees.find(e => (e as any).userId === systemUser.uid || e.id === systemUser.uid || (e.name && systemUser.name && e.name.toLowerCase() === systemUser.name.toLowerCase()));
                    const empId = empObj?.id;
                    return ee.uploadedByUid === systemUser.uid || 
                           ee.uploadedBy === systemUser.name || 
                           ee.updatedBy === systemUser.name ||
                           (empId && ee.employeeId === empId) ||
                           ((ee as any).employeeName && systemUser.name && (ee as any).employeeName.toLowerCase() === systemUser.name.toLowerCase());
                  })
            }
            projects={projects}
            onAdd={() => setShowEverydayExpenseModal(true)}
            onEdit={(ee: EverydayExpense) => setShowEverydayExpenseModal(ee)}
            onDelete={handleDeleteEverydayExpense}
            user={systemUser}
            employees={employees}
            pettyCash={pettyCash}
            onUploadExcel={isAppAdmin ? handleUploadExcelEveryday : undefined}
          />
        );
      })()}
      {activeTab === 'camp' && (
        <CampView
          data={camps}
          onAdd={() => setShowCampModal(true)}
          onEdit={(c: CampExpense) => setShowCampModal(c)}
          onDelete={handleDeleteCamp}
          user={systemUser}
        />
      )}
      {activeTab === 'engineer-hub' && (
        <EngineerView
          user={systemUser}
          companies={companies}
          suppliers={suppliers}
          projects={projects}
          vendors={vendors}
          engineerDocuments={engineerDocuments}
          onSaveDocument={handleSaveEngineerDocument}
          onDeleteDocument={handleDeleteEngineerDocument}
          openConfirm={openConfirm}
          bankAccounts={bankAccounts}
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
          companies={companies}
        />
      )}
      {activeTab === 'tasks-notes' && (
        <TasksNotesView systemUser={systemUser} />
      )}
      {activeTab === 'about' && (
        <AboutView />
      )}
      {activeTab === 'cicpa' && (
        <CICPAView 
            records={cicpaRecords} 
            employees={employees}
            onSave={async (data) => {
                const isUpdate = !!data.id;
                const recordId = isUpdate ? data.id : doc(collection(db, 'cicpa_records')).id;
                const finalData = { ...data, id: recordId, updatedAt: new Date().toISOString(), createdAt: data.createdAt || new Date().toISOString() };
                await setDoc(doc(db, 'cicpa_records', recordId), finalData);
                handleLogAction(isUpdate ? 'CICPA Updated' : 'CICPA Applied', `CICPA application for ${data.nameEnglish} was ${isUpdate ? 'updated' : 'submitted'}.`, isUpdate ? 'update' : 'create');
                setShowCICPAModal(false);
            }}
            onDelete={async (id) => {
                openConfirm("Delete CICPA Record", "Are you sure you want to delete this record? This cannot be undone.", async () => {
                    await deleteDoc(doc(db, 'cicpa_records', id));
                    handleLogAction('CICPA Deleted', `A CICPA record was permanently removed.`, 'delete');
                });
            }}
            user={systemUser}
            initialSearchTerm={cicpaSearchTerm}
        />
      )}
      {activeTab === 'safety' && (
        <SafetyView 
            records={safetyRecords} 
            onSave={async (data) => {
                const isUpdate = !!data.id;
                const recordId = isUpdate ? data.id : doc(collection(db, 'safety_records')).id;
                const finalData = { ...data, id: recordId, updatedAt: new Date().toISOString(), createdAt: data.createdAt || new Date().toISOString() };
                await setDoc(doc(db, 'safety_records', recordId), finalData);
                handleLogAction(isUpdate ? 'Safety Certificate Updated' : 'Safety Certificate Added', `Safety certificate for ${data.employeeName} was ${isUpdate ? 'updated' : 'submitted'}.`, isUpdate ? 'update' : 'create');
                setShowSafetyModal(false);
            }}
            onDelete={async (id) => {
                openConfirm("Delete Safety Certificate", "Are you sure you want to delete this safety certificate? This cannot be undone.", async () => {
                    await deleteDoc(doc(db, 'safety_records', id));
                    handleLogAction('Safety Certificate Deleted', `A safety certificate record was permanently removed.`, 'delete');
                });
            }}
            user={systemUser}
            initialSearchTerm={safetySearchTerm}
        />
      )}
      {activeTab === 'vehicles' && (
        <VehiclesView 
            vehicles={vehicles} 
            everydayExpenses={everydayExpenses}
            onSave={async (data) => {
                const isUpdate = !!vehicles.some(v => v.id === data.id);
                await saveVehicle(data);
                handleLogAction(isUpdate ? 'Vehicle Record Updated' : 'Vehicle Record Added', `Vehicle [${data.vehicleNumber}] ${data.model} was ${isUpdate ? 'updated' : 'enrolled'}.`, isUpdate ? 'update' : 'create');
            }}
            onDelete={async (id) => {
                const plate = vehicles.find(v => v.id === id)?.vehicleNumber || 'Unknown';
                openConfirm("Delete Vehicle Record", "Are you sure you want to delete this vehicle? This cannot be undone.", async () => {
                    await deleteVehicle(id);
                    handleLogAction('Vehicle Record Deleted', `Vehicle ${plate} was permanently removed.`, 'delete');
                });
            }}
            user={systemUser}
        />
      )}
      {activeTab === 'profile' && systemUser && (
        <ProfileView user={systemUser} onUpdate={handleUpdateProfile} />
      )}
      {activeTab === 'settings' && (
        <SettingsView 
          user={systemUser} 
          onPasswordReset={handlePasswordReset}
          onViewAuditLogs={() => setShowAuditModal(true)}
          bankAccounts={bankAccounts}
          onAddBankAccount={handleAddBankAccount}
          onUpdateBankAccount={handleUpdateBankAccount}
          onDeleteBankAccount={handleDeleteBankAccount}
          onSetDefaultBankAccount={handleSetDefaultBankAccount}
          activeTheme={activeTheme}
          setActiveTheme={setActiveTheme}
          typographyScale={typographyScale}
          setTypographyScale={setTypographyScale}
          ambianceMode={ambianceMode}
          setAmbianceMode={setAmbianceMode}
          animationIntensity={animationIntensity}
          setAnimationIntensity={setAnimationIntensity}
          portalBranding={portalBranding}
          onUpdatePortalBranding={handleUpdatePortalBranding}
          accountsPayable={accountsPayable}
          onDeleteBatch={handleDeleteAPBatch}
        />
      )}
      {activeTab === 'help' && (
        <HelpCenterView />
      )}
      {activeTab === 'backup' && (
        <BackupRestoreView user={systemUser} everydayExpenses={everydayExpenses} onLogAction={handleLogAction} />
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
          <EditEmployeeModal 
            companies={companies} 
            employee={showEdit.readOnly ? { ...showEdit, readOnly: undefined } : showEdit} 
            readOnly={showEdit.readOnly}
            openConfirm={openConfirm} 
            onSave={async (d) => { 
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
        {showHolidayManagement && (
          <HolidayManagementModal 
            onClose={() => setShowHolidayManagement(false)}
            holidays={holidays}
            employees={employees}
            openConfirm={openConfirm}
            onLog={handleLogAction}
            canManageSettings={!!(systemUser?.permissions?.canManageSettings || systemUser?.role?.toLowerCase() === 'creator' || systemUser?.role?.toLowerCase() === 'admin' || systemUser?.email === 'abdulkaderp3010@gmail.com')}
          />
        )}
        {showVendorModal && (
          <VendorModal 
            vendor={typeof showVendorModal === 'object' ? showVendorModal : null}
            onSave={handleSaveVendor}
            onCancel={() => setShowVendorModal(false)}
            openConfirm={openConfirm}
          />
        )}
        {showAPModal && (
          <AccountsPayableModal 
            ap={typeof showAPModal === 'object' ? showAPModal : null}
            vendors={vendors}
            suppliers={suppliers}
            projects={projects}
            companies={companies}
            onSave={handleSaveAP}
            onCancel={() => setShowAPModal(false)}
            existingRecords={accountsPayable}
          />
        )}
        {showARModal && (
          <AccountsReceivableModal 
            ar={typeof showARModal === 'object' ? showARModal : null}
            projects={projects}
            suppliers={suppliers}
            vendors={vendors}
            companies={companies}
            onSave={handleSaveAR}
            onCancel={() => setShowARModal(false)}
            existingRecords={accountsReceivable}
          />
        )}
        {showTaxCreditNoteModal && (
          <TaxCreditNoteModal
            isOpen={true}
            onClose={() => setShowTaxCreditNoteModal(false)}
            initialData={typeof showTaxCreditNoteModal === 'object' ? showTaxCreditNoteModal : undefined}
            invoices={accountsReceivable}
            clients={vendors}
            companies={companies}
            bankAccounts={bankAccounts}
            onSave={handleSaveCreditNote}
          />
        )}
        {showPettyCashModal && (
          <PettyCashModal 
            pettyCash={typeof showPettyCashModal === 'object' ? showPettyCashModal : null}
            projects={projects}
            employees={employees}
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
            user={systemUser}
          />
        )}
        {showEverydayExpenseModal && (
          <EverydayExpenseModal 
            expense={typeof showEverydayExpenseModal === 'object' ? showEverydayExpenseModal : null}
            projects={projects}
            onSave={handleSaveEverydayExpense}
            onCancel={() => setShowEverydayExpenseModal(false)}
            user={systemUser}
            everydayExpenses={everydayExpenses}
            employees={employees}
          />
        )}
        {showCampModal && (
          <CampModal
            camp={typeof showCampModal === 'object' ? showCampModal : null}
            onSave={handleSaveCamp}
            onCancel={() => setShowCampModal(false)}
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
      <DownloadPopupModal 
        isOpen={downloadPopup.isOpen}
        filename={downloadPopup.filename}
        blobUrl={downloadPopup.blobUrl}
        triggerDownload={downloadPopup.triggerDownload}
        onClose={() => setDownloadPopup(prev => ({ ...prev, isOpen: false }))}
      />
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </Layout>
  );
}

// --- Staff Leave Calendar Component ---

const StaffLeaveCalendar = ({ leaveRequests = [], employees = [] }: { leaveRequests: any[]; employees: any[] }) => {
    // Generate dates list for the upcoming 30 days starting from today
    const daysArray = useMemo(() => {
        const list = [];
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        for (let i = 0; i < 30; i++) {
            const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
            list.push(d);
        }
        return list;
    }, []);

    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return new Date(dateStr);
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    };

    // Filter approved leaves that fall into our 30-day window
    const approvedLeaves = useMemo(() => {
        if (!daysArray.length) return [];
        const startRange = daysArray[0];
        const endRange = daysArray[29];

        return leaveRequests.filter((req: any) => {
            const isApproved = req.status === 'Approved' || String(req.status).toLowerCase() === 'approved';
            if (!isApproved) return false;

            const start = parseLocalDate(req.startDate);
            const end = parseLocalDate(req.endDate);
            if (!start || !end) return false;
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            return start <= endRange && end >= startRange;
        });
    }, [leaveRequests, daysArray]);

    // Group leaves by employee
    const employeeLeavePlacements = useMemo(() => {
        const map: Record<string, { employee: any; leaves: any[] }> = {};
        
        approvedLeaves.forEach((req: any) => {
            const emp = employees.find((e: any) => e.id === req.employeeId);
            if (!emp) return;

            if (!map[req.employeeId]) {
                map[req.employeeId] = {
                    employee: emp,
                    leaves: []
                };
            }
            map[req.employeeId].leaves.push(req);
        });

        return Object.values(map);
    }, [approvedLeaves, employees]);

    // Color definitions for leave types
    const getLeaveStyle = (type: string) => {
        const t = String(type).toUpperCase();
        if (t === 'AL' || t === 'ANNUAL_LEAVE') {
            return {
                bg: 'bg-emerald-100 border-emerald-200 text-emerald-800',
                dot: 'bg-emerald-500',
                label: 'Annual Leave'
            };
        } else if (t === 'SL' || t === 'SICK_LEAVE') {
            return {
                bg: 'bg-rose-100 border-rose-200 text-rose-800',
                dot: 'bg-rose-500',
                label: 'Sick Leave'
            };
        } else if (t === 'UL' || t === 'UNPAID_LEAVE') {
            return {
                bg: 'bg-amber-100 border-amber-200 text-amber-800',
                dot: 'bg-amber-500',
                label: 'Unpaid Leave'
            };
        } else if (t === 'EL' || t === 'EMERGENCY_LEAVE') {
            return {
                bg: 'bg-purple-100 border-purple-200 text-purple-800',
                dot: 'bg-purple-500',
                label: 'Emergency Leave'
            };
        }
        return {
            bg: 'bg-blue-100 border-blue-200 text-blue-800',
            dot: 'bg-blue-500',
            label: type || 'Leave'
        };
    };

    const formatDateHeader = (date: Date) => {
        return {
            weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: date.getDate(),
            month: date.toLocaleDateString('en-US', { month: 'short' })
        };
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600">
                        <Calendar className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Staff Leave Calendar</h3>
                        <p className="text-xs text-slate-500 font-semibold">Timeline mapping approved leave requests for the upcoming 30 days.</p>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1">Legend:</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>Annual (AL)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span>Sick (SL)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span>Unpaid (UL)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span>Emergency (EL)</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            {employeeLeavePlacements.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center rounded-[2rem] bg-slate-50/50 border border-dashed border-slate-200/80">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center m-3 mb-4 text-slate-400">
                        <Calendar className="w-8 h-8 opacity-40" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800">Clear Attendance Schedule</h4>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">There are no approved leave requests scheduled for any employee in the next 30 days.</p>
                </div>
            ) : (
                <div className="border border-slate-200/80 rounded-[2rem] overflow-hidden bg-white shadow-inner">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse min-w-[1400px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200/80">
                                    {/* Sticky Left Header for Employee Column */}
                                    <th className="sticky left-0 z-25 bg-slate-50 text-left px-6 py-4 border-r border-slate-200/80 w-[240px] shrink-0 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Personnel / Employee</span>
                                    </th>
                                    
                                    {/* 30 Day Headers */}
                                    {daysArray.map((day, dIdx) => {
                                        const { weekday, dayNum, month } = formatDateHeader(day);
                                        const current = isToday(day);
                                        return (
                                            <th 
                                                key={dIdx} 
                                                className={cn(
                                                    "px-1 py-3 text-center border-r border-slate-100 w-[55px] min-w-[55px]",
                                                    current ? "bg-indigo-50/40" : ""
                                                )}
                                            >
                                                <div className="flex flex-col items-center justify-center space-y-0.5">
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-wider",
                                                        current ? "text-indigo-600" : "text-slate-400"
                                                    )}>
                                                        {weekday}
                                                    </span>
                                                    <div className={cn(
                                                        "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                                                        current ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105" : "text-slate-700"
                                                    )}>
                                                        {dayNum}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {month}
                                                    </span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {employeeLeavePlacements.map(({ employee, leaves }) => {
                                    return (
                                        <tr key={employee.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                            {/* Sticky Personnel Row Header */}
                                            <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200/80 px-6 py-4 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                <div className="flex items-center gap-3">
                                                    {employee.profileImage ? (
                                                        <img 
                                                            src={employee.profileImage} 
                                                            alt={employee.name} 
                                                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-sm font-extrabold text-slate-500 shrink-0 border border-slate-200">
                                                            {employee.name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className="overflow-hidden min-w-0">
                                                        <h5 className="text-xs font-black text-slate-900 truncate" title={employee.name}>
                                                            {employee.name}
                                                        </h5>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[9px] font-black tracking-wider text-slate-400 truncate max-w-[140px] uppercase">
                                                                {employee.code || 'N/A'} â€¢ {employee.department || 'Other'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Days Alignment Cells */}
                                            {daysArray.map((day, dIdx) => {
                                                const activeLeave = leaves.find((req: any) => {
                                                    const start = parseLocalDate(req.startDate);
                                                    const end = parseLocalDate(req.endDate);
                                                    if (!start || !end) return false;
                                                    start.setHours(0, 0, 0, 0);
                                                    end.setHours(23, 59, 59, 999);
                                                    return day >= start && day <= end;
                                                });

                                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                                const current = isToday(day);

                                                if (activeLeave) {
                                                    const style = getLeaveStyle(activeLeave.type);
                                                    return (
                                                        <td 
                                                            key={dIdx} 
                                                            className={cn(
                                                                "p-1 border-r border-slate-100 text-center align-middle relative",
                                                                current ? "bg-indigo-50/20" : ""
                                                            )}
                                                            title={`${employee.name}: ${style.label} (${activeLeave.startDate} to ${activeLeave.endDate})`}
                                                        >
                                                            <div className={cn(
                                                                "mx-auto h-8 flex items-center justify-center rounded-lg text-[10px] font-extrabold border shadow-sm transition-transform active:scale-95 cursor-help",
                                                                style.bg
                                                            )}>
                                                                {activeLeave.type || 'L'}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td 
                                                        key={dIdx} 
                                                        className={cn(
                                                            "p-1 border-r border-slate-100 text-center align-middle hover:bg-slate-100/30 transition-colors",
                                                            isWeekend ? "bg-slate-50/60" : "",
                                                            current ? "bg-indigo-50/10" : ""
                                                        )}
                                                    >
                                                        <div className="h-8 flex items-center justify-center text-[11px] font-bold text-slate-400">
                                                            {isWeekend ? (
                                                                <span className="text-[8px] font-bold text-slate-300">W</span>
                                                            ) : (
                                                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Dashboard View ---

const DashboardView = ({ 
    employees = [], 
    suppliers = [], 
    vendors = [], 
    projects = [], 
    attendance = [], 
    leaveRequests = [],
    user, 
    auditLogs = [], 
    setShowAuditModal,  
    onOpenUserManagement, 
    onOpenManageCompanies, 
    onOpenOnboarding, 
    onUpdate, 
    setActiveTab, 
    onOpenHolidayManagement,
    accountsPayable = [],
    accountsReceivable = [],
    pettyCash = [],
    everydayExpenses = [],
    projectedExpenses = [],
    activeTheme = 'indigo',
    animationIntensity = 'smooth'
}: any) => {
    const [showQuickAdminMenu, setShowQuickAdminMenu] = useState(false);
    
    // Stats Calculation
    const activeStaff = employees.filter((e:any) => e.active);
    const exEmployees = employees.filter((e:any) => !e.active).length;
    const officeStaff = activeStaff.filter((e:any) => e.team === 'Office Staff' || e.type === StaffType.OFFICE).length;
    const otherEmployees = activeStaff.length - officeStaff;
    const activeProjects = projects.filter((p: any) => p.status === 'Active').length;

    const userRoleLower = user?.role?.toLowerCase() || '';
    const isUserAdminOrCreator = userRoleLower === 'admin' || userRoleLower === 'creator' || user?.email === 'abdulkaderp3010@gmail.com' || user?.email === CREATOR_USER.username;

    const canManageUsers = user?.permissions?.canManageUsers || isUserAdminOrCreator;
    const canManageSettings = user?.permissions?.canManageSettings || isUserAdminOrCreator;
    const canManageEmployees = user?.permissions?.canManageEmployees || isUserAdminOrCreator;
    const canManageAttendance = user?.permissions?.canManageAttendance || isUserAdminOrCreator;
    const canManagePayroll = user?.permissions?.canManagePayroll || isUserAdminOrCreator;
    
    // Financial Metrics Calculation
    const totalAP = useMemo(() => accountsPayable.reduce((sum: number, x: any) => sum + (x.totalAmount || 0), 0), [accountsPayable]);
    const totalAR = useMemo(() => accountsReceivable.reduce((sum: number, x: any) => sum + (x.totalAmount || 0), 0), [accountsReceivable]);
    const totalPettyExpenses = useMemo(() => pettyCash.filter((x: any) => x.type === 'Expense').reduce((sum: number, x: any) => sum + (x.amount || 0), 0), [pettyCash]);
    const totalEveryday = useMemo(() => everydayExpenses.reduce((sum: number, x: any) => sum + (x.totalAmount || x.billAmount || 0), 0), [everydayExpenses]);

    const financialData = useMemo(() => [
        { name: 'Receivables', amount: totalAR, color: '#10b981' },
        { name: 'Payables', amount: totalAP, color: '#ef4444' },
        { name: 'Everyday Costs', amount: totalEveryday, color: '#f59e0b' },
        { name: 'Petty Cash', amount: totalPettyExpenses, color: '#6366f1' },
    ], [totalAR, totalAP, totalEveryday, totalPettyExpenses]);

    // Chart Data: Staff by Department
    const deptStats = useMemo(() => {
        const counts: Record<string, number> = {};
        activeStaff.forEach((e:any) => {
            const dept = e.department || 'Other';
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [activeStaff]);

    // Chart Data: last 7 days of attendance trends
    const attendanceTrendData = useMemo(() => {
        let endRefDate = new Date();
        if (attendance && attendance.length > 0) {
            const filledDates = attendance
                .map((a: any) => a.date)
                .filter(Boolean)
                .sort();
            if (filledDates.length > 0) {
                const latestDate = new Date(filledDates[filledDates.length - 1]);
                if (latestDate > endRefDate) {
                    endRefDate = latestDate;
                }
            }
        }

        const trend = [];
        for (let i = 6; i >= 0; i--) {
            const activeDate = new Date(endRefDate.getTime());
            activeDate.setDate(activeDate.getDate() - i);
            
            const yearStr = activeDate.getFullYear();
            const monthStr = String(activeDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(activeDate.getDate()).padStart(2, '0');
            const fullDateStr = `${yearStr}-${monthStr}-${dayStr}`;
            
            const dayRecords = attendance.filter((a: any) => a.date === fullDateStr);
            const presentCount = dayRecords.filter((a: any) => a.status === 'P' || a.status === AttendanceStatus.PRESENT).length;
            const absentCount = dayRecords.filter((a: any) => a.status === 'A' || a.status === AttendanceStatus.ABSENT).length;
            const leaveCount = dayRecords.filter((a: any) => ['SL', 'AL', 'UL', 'EL'].includes(a.status)).length;
            
            const formattedLabel = activeDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            trend.push({
                date: fullDateStr,
                label: formattedLabel,
                'Present': presentCount,
                'Absent': absentCount,
                'On Leave': leaveCount
            });
        }
        return trend;
    }, [attendance]);

    // Chart Data: Monthly Growth (Mocked for visual impact)
    const growthData = [
        { month: 'Oct', count: activeStaff.length - 15 },
        { month: 'Nov', count: activeStaff.length - 12 },
        { month: 'Dec', count: activeStaff.length - 8 },
        { month: 'Jan', count: activeStaff.length - 5 },
        { month: 'Feb', count: activeStaff.length - 2 },
        { month: 'Mar', count: activeStaff.length },
    ];

    const COLORS = useMemo(() => {
        const themeMap: Record<string, string[]> = {
            indigo: ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981'],
            emerald: ['#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#f43f5e'],
            crimson: ['#f43f5e', '#ec4899', '#6366f1', '#8b5cf6', '#0ea5e9', '#10b981'],
            violet: ['#a855f7', '#8b5cf6', '#ec4899', '#0ea5e9', '#10b981', '#f59e0b'],
            amber: ['#f59e0b', '#f97316', '#eab308', '#6366f1', '#10b981', '#8b5cf6'],
            cyberpunk: ['#8b5cf6', '#a855f7', '#06b6d4', '#ec4899', '#10b981', '#f59e0b']
        };
        return themeMap[activeTheme] || themeMap.indigo;
    }, [activeTheme]);

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
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-[0.2em] font-sans">
                        <Activity className="w-4 h-4 animate-pulse shrink-0" />
                        Portal Intelligence & Diagnostics
                    </div>
                    {(() => {
                        const hour = new Date().getHours();
                        let greeting = "Welcome";
                        if (hour < 12) greeting = "Good morning";
                        else if (hour < 17) greeting = "Good afternoon";
                        else greeting = "Good evening";
                        
                        const isSystemOwner = user.email === 'abdulkaderp3010@gmail.com' || user.email === CREATOR_USER.username || user.role === UserRole.CREATOR;
                        
                        return (
                            <>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight font-sans">
                                    {greeting}, <span className="text-brand-600">{user.name}</span>
                                </h1>
                                <p className="text-slate-500 font-medium max-w-xl text-xs sm:text-sm">
                                    {isSystemOwner ? (
                                        <>
                                            The dashboard is currently monitoring <span className="text-brand-600 font-extrabold">{activeStaff.length} active personnel</span> across <span className="text-slate-800 font-bold">{deptStats.length} departments</span> with workspace syncing enabled.
                                        </>
                                    ) : (
                                        <>
                                            Your team portal session is active. Ready to coordinate workflow shifts, timesheets, and accounts. Always stay synced!
                                        </>
                                    )}
                                </p>
                            </>
                        );
                    })()}
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {(user.role === UserRole.CREATOR || user.role === UserRole.ADMIN || user.role === UserRole.HR) && (
                        <button 
                            onClick={onOpenOnboarding}
                            className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            <UserPlus className="w-4 h-4 text-brand-500" /> Onboard Staff
                        </button>
                    )}
                    {(user.role === UserRole.CREATOR || user.role === UserRole.ADMIN || canManageSettings) && (
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                            <button onClick={onOpenManageCompanies} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-all cursor-pointer" title="Manage Companies">
                                <Building2 className="w-5 h-5 text-brand-500" />
                            </button>
                            <div className="w-px h-4 bg-slate-200"></div>
                            <button onClick={onOpenUserManagement} className="p-2 hover:bg-slate-50 rounded-xl text-slate-600 transition-all cursor-pointer" title="System Users">
                                <UserCog className="w-5 h-5 text-brand-500" />
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
                    icon={Users} 
                    color="brand"
                    className="lg:col-span-2"
                    onClick={() => setActiveTab && setActiveTab('staff')}
                    index={0}
                    animationIntensity={animationIntensity}
                />
                <BentoStatCard 
                    title="Clients" 
                    value={vendors.length} 
                    icon={Globe} 
                    color="brand"
                    className="lg:col-span-2"
                    onClick={() => setActiveTab && setActiveTab('vendors')}
                    index={1}
                    animationIntensity={animationIntensity}
                />
                <BentoStatCard 
                    title="Suppliers" 
                    value={suppliers.length} 
                    icon={Truck} 
                    color="indigo"
                    className="lg:col-span-2"
                    onClick={() => setActiveTab && setActiveTab('suppliers')}
                    index={2}
                    animationIntensity={animationIntensity}
                />
                <BentoStatCard 
                    title="Active Projects" 
                    value={activeProjects} 
                    icon={Briefcase} 
                    color="orange"
                    className="lg:col-span-2"
                    onClick={() => setActiveTab && setActiveTab('projects')}
                    index={3}
                    animationIntensity={animationIntensity}
                />
                <BentoStatCard 
                    title="Ex Employees" 
                    value={exEmployees} 
                    icon={UserMinus} 
                    color="emerald"
                    className="lg:col-span-2"
                    onClick={() => setActiveTab && setActiveTab('ex-employees')}
                    index={4}
                    animationIntensity={animationIntensity}
                />



                {/* Personnel Allocation (4 columns) */}
                <div className="md:col-span-2 lg:col-span-4 bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-2xl text-brand-600">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Staff Allocation</h3>
                                <p className="text-xs text-slate-500 font-semibold">Active workers by operational department.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center">
                        {deptStats.length > 0 ? (
                            <>
                                <div className="w-full h-[180px]">
                                    <ResponsiveContainer minWidth={0} minHeight={180} width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={deptStats}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {deptStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value, name) => [`${value}`, `${name}`]} contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontFamily: 'sans-serif' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 w-full text-left">
                                    {deptStats.map((item, index) => (
                                        <div key={item.name} className="flex items-center gap-2 overflow-hidden truncate">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                            <span className="text-[11px] font-bold text-slate-600 truncate">{item.name}</span>
                                            <span className="text-[11px] font-black text-slate-900 shrink-0 ml-auto">({item.value})</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Users className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-xs font-bold font-semibold">No active department stats</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Attendance Trend (6 columns) */}
                <div className="md:col-span-2 lg:col-span-6 bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-sky-50 rounded-2xl text-sky-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">7-Day Attendance Trends</h3>
                                <p className="text-xs text-slate-500 font-semibold">Evolution of daily workforce participation and status.</p>
                            </div>
                        </div>
                        {attendanceTrendData.length > 0 && (
                            <div className="flex items-center gap-3 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Monitoring
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-[220px] w-full">
                        <ResponsiveContainer minWidth={0} minHeight={220} width="100%" height="100%">
                            <BarChart data={attendanceTrendData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis 
                                    dataKey="label" 
                                    stroke="#94a3b8" 
                                    fontSize={10} 
                                    fontWeight={700}
                                    tickLine={false}
                                    axisLine={false} 
                                />
                                <YAxis 
                                    stroke="#94a3b8" 
                                    fontSize={10} 
                                    fontWeight={700}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1e293b', 
                                        borderRadius: '16px', 
                                        border: 'none', 
                                        color: '#fff',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)', radius: 4 }}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={36} 
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                                />
                                <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                <Bar dataKey="On Leave" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity Log */}
                {isUserAdminOrCreator && (
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
                )}

                {/* Quick Actions & Access */}
                <div className={cn(
                    "md:col-span-2 bg-white rounded-[2.5rem] p-8 text-slate-900 border border-slate-200 flex flex-col relative overflow-hidden group",
                    isUserAdminOrCreator ? "lg:col-span-5" : "lg:col-span-8"
                )}>
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mb-20 transition-transform duration-700 group-hover:scale-110"></div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black tracking-tight">Quick Operations</h3>
                            <div className="relative">
                                <button 
                                    onClick={() => (canManageUsers || canManageSettings) && setShowQuickAdminMenu(!showQuickAdminMenu)}
                                    className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                                {showQuickAdminMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowQuickAdminMenu(false)}></div>
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-20 text-slate-900">
                                            {canManageUsers && (
                                                <button 
                                                    onClick={() => { onOpenUserManagement(); setShowQuickAdminMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-brand-600 transition-all"
                                                >
                                                    <UserCog className="w-4 h-4" /> System User Management
                                                </button>
                                            )}
                                            {canManageSettings && (
                                                <button 
                                                    onClick={() => { onOpenManageCompanies(); setShowQuickAdminMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-brand-600 transition-all"
                                                >
                                                    <Building2 className="w-4 h-4" /> Manage Companies
                                                </button>
                                            )}
                                            {canManageSettings && (
                                                <button 
                                                    onClick={() => { onOpenHolidayManagement(); setShowQuickAdminMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-brand-600 transition-all"
                                                >
                                                    <Calendar className="w-4 h-4 text-violet-500" /> Manage Holidays
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

            {/* Staff Leave Calendar */}
            <StaffLeaveCalendar leaveRequests={leaveRequests} employees={employees} />

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
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result as string);
                setFormData(prev => ({ ...prev, photoURL: compressed }));
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
const SettingsView = ({ 
    user, 
    onPasswordReset, 
    onViewAuditLogs,
    bankAccounts = [],
    onAddBankAccount,
    onUpdateBankAccount,
    onDeleteBankAccount,
    onSetDefaultBankAccount,
    activeTheme = 'indigo',
    setActiveTheme = () => {},
    typographyScale = 'classic',
    setTypographyScale = () => {},
    ambianceMode = 'flat',
    setAmbianceMode = () => {},
    animationIntensity = 'smooth',
    setAnimationIntensity = () => {},
    portalBranding = { logoUrl: '', logoText: 'PIONEER', logoSubtext: 'DMS PORTAL' },
    onUpdatePortalBranding = async () => {},
    accountsPayable = [],
    onDeleteBatch
}: { 
    user: SystemUser, 
    onPasswordReset: () => void,
    onViewAuditLogs?: () => void,
    bankAccounts: CorporateBankAccount[],
    onAddBankAccount: (acc: Omit<CorporateBankAccount, 'id'>) => Promise<void>,
    onUpdateBankAccount: (acc: CorporateBankAccount) => Promise<void>,
    onDeleteBankAccount: (id: string) => Promise<void>,
    onSetDefaultBankAccount: (id: string) => Promise<void>,
    activeTheme?: string,
    setActiveTheme?: (val: string) => void,
    typographyScale?: string,
    setTypographyScale?: (val: string) => void,
    ambianceMode?: string,
    setAmbianceMode?: (val: string) => void,
    animationIntensity?: string,
    setAnimationIntensity?: (val: string) => void,
    portalBranding?: { logoUrl?: string; logoText?: string; logoSubtext?: string },
    onUpdatePortalBranding?: (branding: { logoUrl?: string; logoText?: string; logoSubtext?: string }) => Promise<void>,
    accountsPayable?: AccountsPayable[],
    onDeleteBatch?: (batchId: string) => Promise<void>
}) => {
    const canManageSettings = user?.permissions?.canManageSettings;
    const userRoleLower = user?.role?.toLowerCase() || '';
    const isAdmin = userRoleLower === 'admin' || userRoleLower === 'creator' || user?.email === 'abdulkaderp3010@gmail.com' || user?.email === CREATOR_USER.username;
    const isAllowedBatchManager = isAdmin || userRoleLower === 'accountant' || userRoleLower === 'accounts' || userRoleLower === 'finance';

    // Excel Batch Derivation derived inside SettingsView from accountsPayable
    const excelBatches = useMemo(() => {
        const batchesMap = new Map<string, { fileName: string; count: number; date: string; totalAmount: number; itemIds: string[] }>();
        (accountsPayable || []).forEach((item: any) => {
            if (item.excelFileName || item.excelBatchId) {
                const batchKey = item.excelBatchId || item.excelFileName;
                const existing = batchesMap.get(batchKey);
                const amount = item.totalAmount || item.amount || 0;
                if (existing) {
                    existing.count += 1;
                    existing.totalAmount += amount;
                    existing.itemIds.push(item.id);
                } else {
                    batchesMap.set(batchKey, {
                        fileName: item.excelFileName || item.excelBatchId || 'Unknown File',
                        count: 1,
                        date: item.date || new Date().toISOString().split('T')[0],
                        totalAmount: amount,
                        itemIds: [item.id]
                    });
                }
            }
        });
        return Array.from(batchesMap.entries()).map(([batchId, info]) => ({
            batchId,
            ...info
        })).sort((a, b) => b.batchId.localeCompare(a.batchId));
    }, [accountsPayable]);
    
    // Portal branding states
    const [logoUrl, setLogoUrl] = useState(portalBranding?.logoUrl || '');
    const [logoText, setLogoText] = useState(portalBranding?.logoText || 'PIONEER');
    const [logoSubtext, setLogoSubtext] = useState(portalBranding?.logoSubtext || 'DMS PORTAL');
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const [brandingSuccess, setBrandingSuccess] = useState(false);

    // Sync state with props
    useEffect(() => {
        if (portalBranding) {
            setLogoUrl(portalBranding.logoUrl || '');
            setLogoText(portalBranding.logoText || 'PIONEER');
            setLogoSubtext(portalBranding.logoSubtext || 'DMS PORTAL');
        }
    }, [portalBranding]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Verify image status
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, SVG, WebP, etc.)');
            return;
        }

        // Keep it lightweight for Firestore (250KB limit)
        if (file.size > 256 * 1024) {
            alert('Branding logos should be optimized and under 250 KB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setLogoUrl(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveBranding = async () => {
        setIsSavingBranding(true);
        setBrandingSuccess(false);
        try {
            await onUpdatePortalBranding({
                logoUrl,
                logoText: logoText.trim() || 'PIONEER',
                logoSubtext: logoSubtext.trim() || 'DMS PORTAL'
            });
            setBrandingSuccess(true);
            setTimeout(() => setBrandingSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to update branding settings:", err);
            alert('Failed to save public brand settings.');
        } finally {
            setIsSavingBranding(false);
        }
    };

    const handleResetBranding = async () => {
        if (window.confirm('Are you sure you want to reset the company identity settings to the default "PIONEER" branding?')) {
            setIsSavingBranding(true);
            try {
                await onUpdatePortalBranding({
                    logoUrl: '',
                    logoText: 'PIONEER',
                    logoSubtext: 'DMS PORTAL'
                });
                setLogoUrl('');
                setLogoText('PIONEER');
                setLogoSubtext('DMS PORTAL');
            } catch (err) {
                console.error("Failed to reset branding:", err);
            } finally {
                setIsSavingBranding(false);
            }
        }
    };

    // Storage space states
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [allNotes, setAllNotes] = useState<Note[]>([]);
    const [allExpenses, setAllExpenses] = useState<EverydayExpense[]>([]);
    const [allUsers, setAllUsers] = useState<SystemUser[]>([]);
    const [loadingStorage, setLoadingStorage] = useState(true);
    const [storageSearchQuery, setStorageSearchQuery] = useState('');

    useEffect(() => {
        if (!user) return;

        let isMounted = true;
        const loadStats = async () => {
            try {
                const [tasksSnap, notesSnap, expensesSnap, usersSnap] = await Promise.allSettled([
                    getDocs(query(collection(db, 'tasks'), limit(100))),
                    getDocs(query(collection(db, 'notes'), limit(100))),
                    getDocs(query(collection(db, 'everyday_expenses'), limit(100))),
                    getDocs(collection(db, 'users'))
                ]);

                if (!isMounted) return;

                if (tasksSnap.status === 'fulfilled') {
                    setAllTasks(tasksSnap.value.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Task));
                }
                if (notesSnap.status === 'fulfilled') {
                    setAllNotes(notesSnap.value.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Note));
                }
                if (expensesSnap.status === 'fulfilled') {
                    setAllExpenses(expensesSnap.value.docs.map(doc => ({ id: doc.id, ...doc.data() }) as EverydayExpense));
                }
                if (usersSnap.status === 'fulfilled') {
                    setAllUsers(usersSnap.value.docs.map(doc => ({ uid: doc.id, ...doc.data() } as unknown as SystemUser)));
                }
            } catch (err) {
                console.warn("Storage stats info fetched with fallback:", err);
            } finally {
                if (isMounted) setLoadingStorage(false);
            }
        };

        loadStats();

        return () => {
            isMounted = false;
        };
    }, [user?.uid]);

    // Helper functions
    const formatStorageSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1014; // Approximate for visual sizing
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        if (i < 0) return '0 B';
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getUserStorageStats = useCallback((uid: string, name: string) => {
        // 1. Expenses / Bills
        const userExpenses = allExpenses.filter(e => e.uploadedByUid === uid || (e.uploadedBy && e.uploadedBy.toLowerCase() === name.toLowerCase()));
        let expensesSize = 0;
        let expensesFilesSize = 0;
        let expensesFilesCount = 0;
        userExpenses.forEach(e => {
            const sz = JSON.stringify(e).length;
            expensesSize += sz;
            if (e.attachment) {
                expensesFilesCount++;
                expensesFilesSize += e.attachment.length;
            }
        });

        // 2. Tasks
        const userTasks = allTasks.filter(t => t.createdById === uid || (t.createdBy && t.createdBy.toLowerCase() === name.toLowerCase()));
        let tasksSize = 0;
        let tasksFilesSize = 0;
        let tasksFilesCount = 0;
        userTasks.forEach(t => {
            const sz = JSON.stringify(t).length;
            tasksSize += sz;
            if (t.audioUrl) {
                tasksFilesCount++;
                tasksFilesSize += t.audioUrl.length;
            }
            if (t.mediaUrl) {
                tasksFilesCount++;
                tasksFilesSize += t.mediaUrl.length;
            }
        });

        // 3. Notes / Memos
        const userNotes = allNotes.filter(n => n.createdById === uid || (n.createdBy && n.createdBy.toLowerCase() === name.toLowerCase()));
        let notesSize = 0;
        let notesFilesSize = 0;
        let notesFilesCount = 0;
        userNotes.forEach(n => {
            const sz = JSON.stringify(n).length;
            notesSize += sz;
            if (n.audioUrl) {
                notesFilesCount++;
                notesFilesSize += n.audioUrl.length;
            }
            if (n.mediaUrl) {
                notesFilesCount++;
                notesFilesSize += n.mediaUrl.length;
            }
        });

        const totalSize = expensesSize + tasksSize + notesSize;
        const totalFilesSize = expensesFilesSize + tasksFilesSize + notesFilesSize;
        const totalFilesCount = expensesFilesCount + tasksFilesCount + notesFilesCount;

        return {
            expensesCount: userExpenses.length,
            expensesSize,
            expensesFilesCount,
            expensesFilesSize,

            tasksCount: userTasks.length,
            tasksSize,
            tasksFilesCount,
            tasksFilesSize,

            notesCount: userNotes.length,
            notesSize,
            notesFilesCount,
            notesFilesSize,

            totalSize,
            totalFilesCount,
            totalFilesSize
        };
    }, [allExpenses, allTasks, allNotes]);

    // Corporate Bank Account component local states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<CorporateBankAccount | null>(null);
    const [formVal, setFormVal] = useState({
        accountName: '',
        bankName: '',
        accountNumber: '',
        iban: '',
        swiftCode: '',
        currency: 'AED',
        isDefault: false
    });

    const resetForm = () => {
        setFormVal({
            accountName: '',
            bankName: '',
            accountNumber: '',
            iban: '',
            swiftCode: '',
            currency: 'AED',
            isDefault: false
        });
        setEditingAccount(null);
        setIsFormOpen(false);
    };

    const handleOpenEdit = (acc: CorporateBankAccount) => {
        setEditingAccount(acc);
        setFormVal({
            accountName: acc.accountName,
            bankName: acc.bankName,
            accountNumber: acc.accountNumber,
            iban: acc.iban,
            swiftCode: acc.swiftCode,
            currency: acc.currency,
            isDefault: acc.isDefault
        });
        setIsFormOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formVal.accountName || !formVal.bankName || !formVal.accountNumber || !formVal.iban || !formVal.swiftCode) {
            alert('Please fill out all required fields');
            return;
        }
        try {
            if (editingAccount) {
                await onUpdateBankAccount({
                    ...formVal,
                    id: editingAccount.id
                });
            } else {
                await onAddBankAccount(formVal);
            }
            resetForm();
        } catch (err: any) {
            console.error("Failed saving bank account:", err);
        }
    };

    const handleQuickSeed = async () => {
        try {
            await onAddBankAccount({
                accountName: "Pioneer General Contracting LLC",
                bankName: "Abu Dhabi Commercial Bank",
                accountNumber: "11249315820001",
                iban: "AE190030011249315820001",
                swiftCode: "ADCBAEAA",
                currency: "AED",
                isDefault: true
            });
        } catch (err) {
            console.error("Seeding default ADCB account failed:", err);
        }
    };

    if (!canManageSettings && user.role !== UserRole.CREATOR && !isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                <p className="text-slate-500 max-w-md text-sm font-semibold">
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
                {isAdmin && (
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Corporate Bank Accounts</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Manage official bank details used dynamically in generated Invoices & Quotations</p>
                            </div>
                            {!isFormOpen && (
                                <button
                                    onClick={() => { resetForm(); setIsFormOpen(true); }}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" /> Add Corporate Bank
                                </button>
                            )}
                        </div>

                        {/* Form details */}
                        {isFormOpen && (
                            <form onSubmit={handleSave} className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <Landmark className="w-4 h-4 text-brand-600" />
                                    {editingAccount ? 'Edit Bank Account Information' : 'Add New Bank Account'}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Account Holder Name *</label>
                                        <input
                                            type="text"
                                            value={formVal.accountName}
                                            onChange={e => setFormVal(prev => ({ ...prev, accountName: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-xl text-xs font-semibold text-slate-850"
                                            placeholder="Pioneer General Contracting LLC"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Corporate Bank Name *</label>
                                        <input
                                            type="text"
                                            value={formVal.bankName}
                                            onChange={e => setFormVal(prev => ({ ...prev, bankName: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-xl text-xs font-semibold text-slate-850"
                                            placeholder="Abu Dhabi Commercial Bank"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Account Number *</label>
                                        <input
                                            type="text"
                                            value={formVal.accountNumber}
                                            onChange={e => setFormVal(prev => ({ ...prev, accountNumber: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-xl text-xs font-semibold text-slate-850"
                                            placeholder="11249315820001"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">IBAN Number (UAE Compliant) *</label>
                                        <input
                                            type="text"
                                            value={formVal.iban}
                                            onChange={e => setFormVal(prev => ({ ...prev, iban: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-xl text-xs font-semibold text-slate-850"
                                            placeholder="AE190030011249315820001"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">SWIFT Code *</label>
                                        <input
                                            type="text"
                                            value={formVal.swiftCode}
                                            onChange={e => setFormVal(prev => ({ ...prev, swiftCode: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-xl text-xs font-semibold text-slate-850"
                                            placeholder="ADCBAEAA"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Remittance Currency</label>
                                        <select
                                            value={formVal.currency}
                                            onChange={e => setFormVal(prev => ({ ...prev, currency: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-xl text-xs font-semibold text-slate-850 bg-white"
                                        >
                                            <option value="AED">AED - United Arab Emirates Dirham</option>
                                            <option value="USD">USD - United States Dollar</option>
                                            <option value="EUR">EUR - Euro</option>
                                            <option value="GBP">GBP - British Pound</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="isDefaultAcc"
                                        checked={formVal.isDefault}
                                        onChange={e => setFormVal(prev => ({ ...prev, isDefault: e.target.checked }))}
                                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <label htmlFor="isDefaultAcc" className="text-xs font-bold text-slate-700 cursor-pointer">Set as default account for system documents</label>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <Save className="w-4 h-4" /> Save Bank
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* List box */}
                        <div className="space-y-4">
                            {bankAccounts.length === 0 ? (
                                <div className="p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-center space-y-4">
                                    <div className="flex items-center justify-center">
                                        <Landmark className="w-10 h-10 text-slate-300 animate-pulse" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-slate-800">No Corporate Bank Accounts Added</p>
                                        <p className="text-xs text-slate-400 max-w-md mx-auto">Dynamic generated invoices and proposal quotations will default to Abu Dhabi Commercial Bank details.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handleQuickSeed}
                                        className="px-4 py-2 bg-white hover:bg-slate-50 text-brand-600 border border-slate-200 rounded-xl text-xs font-black transition-all inline-flex items-center gap-2 cursor-pointer"
                                    >
                                        âœ¨ Quick-Setup: Seed Pioneer ADCB Bank Account
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {bankAccounts.map((acc) => (
                                        <div key={acc.id} className={`p-5 rounded-2xl border transition-all ${acc.isDefault ? 'border-brand-100 bg-brand-50/10' : 'border-slate-100 bg-white'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{acc.bankName}</span>
                                                        {acc.isDefault && (
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-full text-[9px] uppercase tracking-wider flex items-center gap-1 border border-emerald-100 shrink-0">
                                                                <Check className="w-3 h-3" /> Default
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-slate-500 font-medium pt-1"><span className="text-slate-400 font-bold">Holder:</span> {acc.accountName}</p>
                                                    <p className="text-slate-500 font-mono font-bold"><span className="text-slate-400 font-bold font-sans">Acct No:</span> {acc.accountNumber}</p>
                                                    <p className="text-slate-700 font-mono font-extrabold p-1.5 bg-slate-100/60 rounded text-[10px] tracking-tight mt-1 select-all"><span className="text-slate-400 font-black tracking-normal font-sans">IBAN:</span> {acc.iban}</p>
                                                    <p className="text-slate-500 text-[10px] pt-1"><span className="text-slate-400 font-bold">Swift Code / Currency:</span> <span className="font-semibold">{acc.swiftCode} / {acc.currency}</span></p>
                                                </div>
                                                <div className="flex items-center gap-1 pl-2">
                                                    {!acc.isDefault && (
                                                        <button
                                                            onClick={() => onSetDefaultBankAccount(acc.id)}
                                                            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-brand-600 rounded-xl transition cursor-pointer"
                                                            title="Set as Default Account"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenEdit(acc)}
                                                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-650 rounded-xl transition cursor-pointer"
                                                        title="Edit Account Details"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to delete this bank account?')) {
                                                                onDeleteBankAccount(acc.id);
                                                            }
                                                        }}
                                                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded-xl transition cursor-pointer"
                                                        title="Delete Account"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isAdmin && (
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm animate-in fade-in duration-300">
                        <h3 className="text-lg font-black text-slate-900 mb-6">System Audit Logs</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                                <div className="pr-4">
                                    <p className="text-sm font-bold text-slate-900">System Activity Logs</p>
                                    <p className="text-xs text-slate-500 font-medium">Track and view log entries for user actions, employee updates, and system changes</p>
                                </div>
                                <button 
                                    onClick={onViewAuditLogs}
                                    className="px-5 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
                                >
                                    <Activity className="w-4 h-4" />
                                    View
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isAllowedBatchManager && excelBatches.length > 0 && (
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm animate-in fade-in duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-100 mb-6">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm border border-emerald-100 flex-shrink-0">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                        Excel Upload History Logs
                                        <span className="px-2.5 py-0.5 bg-brand-50 border border-brand-150 text-brand-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            {excelBatches.length} imported files
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        View and manage files imported into the Accounts Payable Ledger. Only accessible to Admins and Accounts roles.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {excelBatches.map((batch) => (
                                <div key={batch.batchId} className="p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/40 hover:border-slate-200/60 transition-all flex justify-between items-center group">
                                    <div className="space-y-1 pr-4 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span className="font-extrabold text-slate-800 text-sm truncate" title={batch.fileName}>{batch.fileName}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium">Uploaded on: <strong className="text-slate-600 font-mono text-[10.5px] font-bold">{batch.date}</strong></p>
                                        <div className="flex gap-3 items-center text-[10.5px] text-slate-400 font-medium font-mono pt-1">
                                            <span>Records: <strong className="text-slate-705 font-bold">{batch.count}</strong></span>
                                            <span>â€¢</span>
                                            <span>Sum: <strong className="text-indigo-650 font-bold">AED {batch.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onDeleteBatch && onDeleteBatch(batch.batchId)}
                                        className="p-3 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-slate-400 hover:text-rose-600 rounded-[1.25rem] transition-all cursor-pointer grow-0 shrink-0"
                                        title="Delete imported excel batch data"
                                    >
                                        <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ðŸ–³ Data Storage and Quota Usage Panel */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-sm animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 mb-6">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100 flex-shrink-0">
                                <HardDrive className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    Data Storage & Account Footprint
                                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        {isAdmin ? 'System Live Auditing' : 'Personal Storage'}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Real-time usage tracking of uploaded bills, task check-ins, meetings, and memos.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setLoadingStorage(true);
                                setTimeout(() => setLoadingStorage(false), 500);
                            }}
                            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold transition-all border border-slate-200/60 flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingStorage ? 'animate-spin' : ''}`} />
                            Refresh Space
                        </button>
                    </div>

                    {/* Personal usage progress */}
                    {(() => {
                        const myStats = getUserStorageStats(user.uid || '', user.name);
                        const QUOTA_LIMIT = 100 * 1024 * 1024; // 100 MB quota
                        const usagePercent = Math.min((myStats.totalSize / QUOTA_LIMIT) * 100, 100);

                        return (
                            <div className="space-y-6">
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100/70">
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Your Storage Footprint</span>
                                            <span className="text-lg font-black text-slate-850 mt-1 inline-block">
                                                {formatStorageSize(myStats.totalSize)} <span className="text-slate-400 font-bold text-sm">/ {formatStorageSize(QUOTA_LIMIT)} used</span>
                                            </span>
                                        </div>
                                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                                            usagePercent > 80 ? 'bg-rose-50 text-rose-700' :
                                            usagePercent > 50 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                                        }`}>
                                            {usagePercent.toFixed(2)}% Used
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden relative">
                                        <div
                                            style={{ width: `${Math.max(usagePercent, 1.5)}%` }}
                                            className={`h-full bg-gradient-to-r rounded-full transition-all duration-500 ${
                                                usagePercent > 80 ? 'from-amber-500 to-rose-600' :
                                                usagePercent > 50 ? 'from-indigo-500 to-amber-500' : 'from-indigo-500 to-brand-600'
                                            }`}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wider">
                                        <span>0 MB</span>
                                        <span>50 MB (Balanced)</span>
                                        <span>100 MB Limit</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ðŸ’µ Bills Entered</span>
                                            <span className="w-2 h-2 rounded-full bg-brand-500" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-slate-800">{myStats.expensesCount} item(s)</p>
                                            <p className="text-xs font-semibold text-slate-500">{formatStorageSize(myStats.expensesSize)} database footprint</p>
                                        </div>
                                        {myStats.expensesFilesCount > 0 && (
                                            <p className="text-[10px] text-slate-400 font-medium border-t border-slate-50 pt-1.5 mt-1">
                                                ðŸ“Ž {myStats.expensesFilesCount} uploaded receipt(s) ({formatStorageSize(myStats.expensesFilesSize)})
                                            </p>
                                        )}
                                    </div>

                                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ðŸ“‹ Tasks & Notes</span>
                                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-slate-800">{myStats.tasksCount} item(s)</p>
                                            <p className="text-xs font-semibold text-slate-500">{formatStorageSize(myStats.tasksSize)} database footprint</p>
                                        </div>
                                        {myStats.tasksFilesCount > 0 && (
                                            <p className="text-[10px] text-slate-400 font-medium border-t border-slate-50 pt-1.5 mt-1">
                                                ðŸ“Ž {myStats.tasksFilesCount} media/voice file(s) ({formatStorageSize(myStats.tasksFilesSize)})
                                            </p>
                                        )}
                                    </div>

                                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ðŸ“ Pinned Memos</span>
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-slate-800">{myStats.notesCount} item(s)</p>
                                            <p className="text-xs font-semibold text-slate-500">{formatStorageSize(myStats.notesSize)} database footprint</p>
                                        </div>
                                        {myStats.notesFilesCount > 0 && (
                                            <p className="text-[10px] text-slate-400 font-medium border-t border-slate-50 pt-1.5 mt-1">
                                                ðŸ“Ž {myStats.notesFilesCount} media/voice file(s) ({formatStorageSize(myStats.notesFilesSize)})
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Admin Specific system-wide viewing */}
                    {isAdmin && (
                        <div className="mt-8 pt-8 border-t border-slate-100 space-y-5">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-brand-600" />
                                    Team-Wide Storage Consumption Audit
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Auditing of disk and cloud file allocations per individual system user.</p>
                            </div>

                            {/* Aggregations */}
                            {(() => {
                                const isCurrentCreator = user?.role?.toLowerCase() === 'creator' || user?.email === 'abdulkaderp3010@gmail.com' || user?.email === CREATOR_USER.username;
                                
                                const creatorEmails = ['abdulkaderp3010@gmail.com', CREATOR_USER.username.toLowerCase()];
                                const creatorUids = allUsers
                                    .filter(u => u.role?.toLowerCase() === 'creator' || creatorEmails.includes(u.email?.toLowerCase() || ''))
                                    .map(u => u.uid || '');

                                const filteredExpenses = allExpenses.filter(e => {
                                    if (isCurrentCreator) return true;
                                    const isCreatorUid = creatorUids.includes(e.uploadedByUid || '');
                                    const isCreatorEmailOrName = e.uploadedBy && (
                                        creatorEmails.includes(e.uploadedBy.toLowerCase()) || 
                                        e.uploadedBy.toLowerCase() === 'mohamed abdul kader'
                                    );
                                    return !(isCreatorUid || isCreatorEmailOrName);
                                });

                                const filteredTasks = allTasks.filter(t => {
                                    if (isCurrentCreator) return true;
                                    const isCreatorUid = creatorUids.includes(t.createdById || '');
                                    const isCreatorEmail = t.createdBy && (
                                        creatorEmails.includes(t.createdBy.toLowerCase()) || 
                                        t.createdBy.toLowerCase() === 'mohamed abdul kader'
                                    );
                                    return !(isCreatorUid || isCreatorEmail);
                                });

                                const filteredNotes = allNotes.filter(n => {
                                    if (isCurrentCreator) return true;
                                    const isCreatorUid = creatorUids.includes(n.createdById || '');
                                    const isCreatorEmail = n.createdBy && (
                                        creatorEmails.includes(n.createdBy.toLowerCase()) || 
                                        n.createdBy.toLowerCase() === 'mohamed abdul kader'
                                    );
                                    return !(isCreatorUid || isCreatorEmail);
                                });

                                const totalSystemSize = filteredExpenses.reduce((sum, e) => sum + JSON.stringify(e).length, 0) +
                                                       filteredTasks.reduce((sum, t) => sum + JSON.stringify(t).length, 0) +
                                                       filteredNotes.reduce((sum, n) => sum + JSON.stringify(n).length, 0);

                                const totalSystemFilesSize = filteredExpenses.reduce((sum, e) => sum + (e.attachment?.length || 0), 0) +
                                                            filteredTasks.reduce((sum, t) => sum + (t.audioUrl?.length || 0) + (t.mediaUrl?.length || 0), 0) +
                                                            filteredNotes.reduce((sum, n) => sum + (n.audioUrl?.length || 0) + (n.mediaUrl?.length || 0), 0);

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total System Database Size</span>
                                                <span className="text-sm font-black text-slate-800 mt-0.5 inline-block">{formatStorageSize(totalSystemSize)}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Tracked Records</span>
                                        </div>
                                        <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Base64 File Attachments Size</span>
                                                <span className="text-sm font-black text-brand-600 mt-0.5 inline-block">{formatStorageSize(totalSystemFilesSize)}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Documents & Voice Memos</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* User Filter & Table */}
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search system user storage by name, email, or role..."
                                        value={storageSearchQuery}
                                        onChange={(e) => setStorageSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 outline-none focus:ring-2 focus:ring-brand-500 transition-all font-sans placeholder-slate-400"
                                    />
                                    {storageSearchQuery && (
                                        <button 
                                            onClick={() => setStorageSearchQuery('')}
                                            className="text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {loadingStorage ? (
                                    <div className="flex flex-col items-center justify-center p-8 space-y-2 border border-slate-100 rounded-2xl bg-slate-50/30">
                                        <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
                                        <span className="text-xs text-slate-400 font-bold">Querying user-specific storage data...</span>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-slate-200/60 rounded-2xl">
                                        <table className="min-w-full divide-y divide-slate-100 text-left">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest col-header">
                                                <tr>
                                                    <th className="px-4 py-3">System User</th>
                                                    <th className="px-4 py-3">Role</th>
                                                    <th className="px-4 py-3">Entity Metrics</th>
                                                    <th className="px-4 py-3">Space Footprint</th>
                                                    <th className="px-4 py-3 text-right">Quota (100MB)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs bg-white text-slate-750">
                                                {(() => {
                                                    const isCurrentCreator = user?.role?.toLowerCase() === 'creator' || user?.email === 'abdulkaderp3010@gmail.com' || user?.email === CREATOR_USER.username;

                                                    const usersToRender = allUsers.filter(u => {
                                                        const isThisUserCreator = u.role?.toLowerCase() === 'creator' || u.email === 'abdulkaderp3010@gmail.com' || u.email === CREATOR_USER.username;
                                                        if (isThisUserCreator && !isCurrentCreator) {
                                                            return false;
                                                        }

                                                        const q = storageSearchQuery.toLowerCase();
                                                        return (
                                                            (u.name || '').toLowerCase().includes(q) ||
                                                            (u.email || '').toLowerCase().includes(q) ||
                                                            (u.role || '').toLowerCase().includes(q)
                                                        );
                                                    });

                                                    if (usersToRender.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={5} className="text-center py-6 italic text-slate-400 font-medium">
                                                                    No system users match your storage search criteria.
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    // Sort users so that users using the most storage appear first
                                                    const sortedUsers = [...usersToRender].sort((a, b) => {
                                                        const statA = getUserStorageStats(a.uid || '', a.name);
                                                        const statB = getUserStorageStats(b.uid || '', b.name);
                                                        return statB.totalSize - statA.totalSize;
                                                    });

                                                    return sortedUsers.map((u) => {
                                                        const uid = u.uid || '';
                                                        const stats = getUserStorageStats(uid, u.name);
             xœì}ÛrÛH–à{}Eš[Ó¢ºDŠ¤d•,Kò¨$U•f|[IÕÝ3ZO"S$Ú À@K,–"öi_6b"vfwcbßöö‡ææöœ¼ ™‰Ä¤|érFX&Aäýä¹å¹R¹ô?Š‰çŽÝø»YL#r@ºù=üím‹ÿž~U½=[ë“~Í¾pâQ{ìúÍf;qÔŽƒØñ.Ü_(ÙTú_g}>ÞÀQ¬?ýjážCOCŸ4n Ë~’wtv0Ÿºƒ{Ò÷œ(zéŒéAc¼§áÞõ°yNL[;›;$?rc7ð[ýÀÂ¨q¸Tï|µßÉ]k›Lf­^ûñ
gÜ÷«i‰µM_ðMàÇ-zKsxÃG±fO Ê®½ ÿ®q8Ÿ¶}xû~«?àhX÷WÝÎäî:”m
è˜ÜéX;®·Òqío®dÁ÷7ãÁç ]ÆÌßB=ì£Ó~LÂ`êè u3õ<¾WOpk ™N&4ì;ÅÖçúÃÖ­; ä:4$_ÏW0Óvxô ¦çÁ-¡Ïæ:988 kÎ P×yFÖàÔ»þÀpìÅäÄœlâû·ÎÙûÃë‡Ô‰ƒPðfÚE®£ŒP>I†(¬xŒk	RÄžDçüAOvÍ¿î@Ç+éöþíýêpÆœ/2ùõW²v:žxÁŒÒµûýÕ ‘Ïåì¢ÓHGïþiÝ†Î„I«H€ö”8pì¼¢!°a˜D fŠý
¤«?­p0Xþãßþåÿ‘9çèÝ„úŽ¡§øž\»ž­næMN?þJþë—+;Ñ;¹Œìó—e¬Z`ÿ·\F?ˆhÓqði.ãgÂDqÜÑ±‹øíó`ØˆÛ•l1ÃÎ’)¾	Â±_ ³á)Šo¦8·þ¡øø'yl¼\q9æUŸ–NÎù{×K8°d;Ûä‘fñZ±z|ÁÖ¿œ²ÒVòOÐŽbrÛÚÚyHöÅé8jõ©ƒàñçi»7³õŒ›é)#Y%cä¶ÕÝQ¨²øC…Ã1b¢‰V¨¬¸ñ‚ÛÖÈ¨O¢QèúïZ’=Ïpé›Û@j(|sßÓŸ6™•¶ˆ%Šg—sra<Ú#o¿žsm“s×œôãÒ[¿ÿ›·ä~5|¼ZTÑvÄW[[ú
§jAÚ!Ùíq/"TB¡ '~Ú–?9ãkØZñ>¸À¬|d ˆ­´ÍÍ¢Õà²¤¹*z.«¢iÅçiÛää{÷Žšå_(IIáâ-¬/¦¿_ Þýzs½Þa‚©]ƒYõÙAçÚ£Õ*TÜÁ’1—´Rð³¥añvæùÜŽPYG~÷»õ¿IQ+ÞŽ€´'¨û
ØŠŽßIk7—Hît€: «Ñ˜8¾;Æ ÛgÀþLC‡]lU†³Ô§­Yk·àü—söå<	ò![pŒÙÒ„qR
yàh‹SDÏVïÎ3V„¿ÒêæãªØmÿbâ„ïGÖøšÇÀ¼<V;*Õ¨B*BguÑi´•‘7¼¡†<§ÿÎ¼Éàr‡ãGÃã œ Ãàô:Ï'gÀsÅn<ÛßmUì~’#’=–:»ˆŒãVz&4ã-Z<¢dÂz\ƒuBJ\Ññ¿ÿ×ÿéú}o:pý!{­Ï*/àvH7°‚5Ôðà¬?a»€•¢é5vKÞ»‘8ƒ8}`9"â ‡3¢ ïaÔÞßœ¬d£ªáˆÂC¤.Þ0t;‡?x'µºd<ØK¿öØÙ%“Ä	Ï±~Ô»¥4{¾ù{òXeò#[
ò\µ×!}ïÒ[òûÍ´˜«)…A&bÆ5o)pï“ÖŽ‚¨š²¡(6wÙ€ßQJ¶Þ”	@ÎuxS˜`²{àÁzpŽáÊln"Éµ7[[€K$âœL½ˆV;ìÕOqÑýŸý,£!ç¾)Š¹>Œ¯[ÛC¶ãÏY0åÆ‹ý®Ã9eñð6‘äˆm`Â³
ð°&¾¥”)_n• •ÀÄ/ ì5øÓÕQ#µÌ+ýz ¿Ô¿¼7‡$W«`±¸üÌé•U_A
g²v'Wº^ÓßwÇ€oÃþ\ˆ{@³ñAã9"kaØ³†4|xnvÐðƒ–|ÔÐ‰*;nB4®ÿLû1`?v\¿ÒiË¯>+¿’çò[™`äFPÙ¢ì-;À|Ó})ÝÂe7ê»©ë!žïY¸˜¶¶5…„"J³À:Øå`äƒ²øulòL`MD®~à+¨6^B}ÆŽÌ%2*x}ûúìÕËÓÓóno•}sÎnJoå@
ËÉÌ¯:íRs`ìð"(!CË,Æ…`Üp=N^\×¯Î/ž %©	Ïu_·Á²¼U^ðlgu­Û6…ªªp­}Ò?N»9}Ô´’ö«oUW³bO±VrË3FæÝ¹Çíë¼L—DÔC‚‡¦$\Ž\¯‚Á$édà Y$ðy¡”›˜-Å!ï*‘’\?Š?öfª|4ÔôCà´"rëÆ#d' sáXgµ+.cuñª6++¸S$	¦òaXÉ
\ºa:ÈÔ¨‰”u;Ó§µ˜îB«4ÓMÐ0UA(àÍë¤¥¼.ò7tLCÇKµ/òûNjI%¡T
lU#ÏZà±ÅøªQiXµ¬©f½Á5äõ	¹U6ÀzãL½˜œÓI^ê5ªŸªZ]¥P*ÄKE9ó'pHÿÆ
-9¡À3{Qma^jþ¶+ŠØAØs®©WO¶}\M¶í5š f"bG™ä·Õû›¬×Å$[»tXeUòç¬+JŠÅµRYø“ áè‹'ÑAÖjQ˜{«úNvÀtÝJb.ßØ)¤?£ lM—C±Gâ°"6¥ú:à•9‡	þ`ž_@‡Æ^ìÀâî˜d€©»˜ T`ðaÂvÂH7GA ÍAu¥ü·yLˆd@:‰µÓ¿~ùÙ$À¿÷ú‡À<³*.Ã[µ'Ï&D°lú•~ŸNâƒÓ#oþ~ÿxäøC ÃðßÀ£¸üÉ}ýÆT'®Ù¬×F-&¸:Ä²”hÓê&—HÝÚ6ºfƒ‚Xt°~¬u*Ÿ‡cgíÀILH
.\°ÐÉ=²mò#ˆûè&ˆˆž¨ ‡óÊ_NœÓ…úŽP14®"×@ºÚ¤ùÂ¹sÇÓ13¼ô¯8áŒDÎ%Þ ?ßý÷ß­Wã¶“u«–(÷ú±°ÃëiþB??Æ¼j¼žYà$‚õî`Žn‡°oñs>™æÚZMM“,ºÍÖ .IMVR¢Éà-â®i—$IH·7$nÇ°½`u„vE%¸:9®¿J‹©bÎé¦ÉYã4/|KL1¸za~Q94ApUEÇ‡á‚Ù.þT{F°eò{ªÇ ×¤ÆüøâH«ƒå{Ç›ÒƒDíY}ÏSšÛ¤êYÇVš´;áÆmÖ|;œ@›ÒÛ^¯VXy:‚IÃƒmÛD(d«O/{‘¡Ú}*ìwÞíNæ’à.2”G†½s0=×§\'}ô§Ñ^ˆàÑS¿¤€]R°Ò«[6|¾'É° B!ý)Ÿ$1Äå“h(÷<mõ–;O©BÿË‘åTr¿ÐCUi¯êÁªÉÐ-ÆÄÜmùs7ºpÞÃŠJõh-(æÌ—Â Z¿‘¬Ðb€Wzïe¨K¾•
LÝÏ„²D««QØ½ýx ?¥v'U.‚ù¦š¹¤{ RÀ\ÐZµý¨¡=57m¶ù“v»Ûòjáb
Rv‰ßi¢š“hõù÷ÿõ¯ÌÂ&©	šl¹â_=^³ÒKó¦ˆ~ý•$÷³ÐiY^ÐÊ_äe%ûQ¹­\¯'K-"C-.;Çæœò¯n°ä¸·$Ö)y9ŒÂ$Ò¹g‰aëÕHõ¤¶JDÜT÷1¬žhëÊìküÃÊ<[½EryªmØ:¾ní¨šÍ
RhÌºÈHug«Ô
25”+5Š+·á¬vób³ËÛï(Ÿp…4²…ä5T¹…ñT»ÃÍöçU?ÑxCƒ×Ò\¥æôûè}H&¢ÒáÔsBoVÚaøçG®Ù'ˆ0ðå„Ù1/?…6ÄWŽöŠ±šnccA‘Ú+Æså›Æ·£d©ËpW¦ùë<#—·Aë{§!9šÆ#ägúìÆu…§åh0 ŽO˜ŽxÎæÜ€”ÆQ‰í ­äÔd6{ìŠLóÕÔŒqÛ	ƒ/a™íÑ›Xp4ÐîngdÖ»B8>QÌÊÀU§Ì§Ì—ñùûçÿLOä}r1‹àè#4àßG.GtLIâÏ»‹Ôp9§×h©Ê<:&`Ëw<é0ò…%cÜ6WÕ¸hÆãx­Ø…á°K˜F“ °%À&zÚc»!M¡€o†¡3Í6Ôûî>Âmû¡‡ï"i<“(rñF;¶’ù]?ŠÌ5òÚ/“ís”ew£W¶%ßæ+ÊBaÈ"›‡°¨œO ’Š¬ÄÝ¥G¢±âî²UÙ"~UM¸#î „Nîjmƒ`7ø~Æ¾“W}
 Ð_Cï"Œ‡·G®Xx¨w3¼@‡ÇJ,-Œõ†ÜoÔéVC¥ýžòä•¹‘ÙíMð”ŽëªÚ=÷Cwç(íùbê£Dsœ<×ºf·QiÏòrªv·ïÝÀ£qÚëy0ƒûùTës2'žÚ+¯¼P¿Ì‰<íö»i@z$j½rwó´Sþ}¡%žAÍÉÔ—ö{,‘—4»Èb~“¾û3Çg_+uý¦=v&ÍfÌ¸Õ”u,”dÜv(å’Ù£>2	C4±­dÕâ1ÇY‡à?«Èé°%M5ã8édX;œP}›Œt`±ÍJÌ°0œ×8ëºæÍîãµú½í%½¥–—š¼eˆõj\¨HaIcù'xÌ´dAC´Œ%ímk«0[¦­ù× ùü¼^uÞÀk›´/ÔU·nWu¬öbYQ4½‰Ã©mÂ(k‡=­®+»ZZÒÏ–ñY	ó'L|ÐNöÓg¸”a_ô’³
v«ûaØ-6 ÆW1_md?<Jß¥jøÄŠ>ãÄI{Àˆ‘§cÝÈ ìÖÝ›µšDyÀ
úJÇG°Èñ4¤Ì´›ý":¾À­ãÉ½éæÕ4¾qc¼U™€ ÕïØ”n/iD^¸(_x0£´Û¿cÊw×`@~ ¥,Øqzã^«ò7ÍÜ,É¤PÌ€¸y³8/€z¢Góc}àŒîß|¡ûX€î[õcv¬¹‹ª2€KvÈî+©ß
ºÉznáö FÂ0,UCo³þñ(Wïþ“¢ˆß%*\Çø9‘Æ£É„pÌm™ÉgD!o`®*y<ÅE ¨ì‡ÎRr!H	$ÖR´X„‡o¬Mªœ8tï”Þ_‡´ïF L#õBþ.ÆpÄ1 dCŸûõSê]TÍ¡Y úü×†7»~0”<È^pK¾G]7Êt$§ñˆ¢êLB:Æ@øh·ã„\Ì†M„S‹Ú)vPƒ’:×MJëeejáÈÄ4YkŸ%u”a32Ê†þ…Ž~töâãRÀgLI/““‘“ÈÉnÿ3 Ÿ"Ð‹€Ñû£äþCN!úŒhh4‚x¤„<\LUú]_‘5¿£Î4vo¦¹ÃQë–ÄÃëUôÇéÏ”Û º¤,òÉd¦Òsö€¼æN@ŒËº 
¯Œå?OÃ“¶0 _D‚Iìâ½#ë$šP:¨=4aU‡Ã|úäŒ»ý“Ë`8ô”1ü#øâ.‰ÙOëš/NHÿ2¥¸,·Aø®5uœšºËRS¹Ñ¨|ÀC<k²6?šš<§¬îÊŠå“ ¬îÇ¦¬îçLYk¡{ä ƒ‰	a£8ªA&F]a°DR5àÁ*)¯ô6IæväÑ0^ŒÚV¶«RÐ
¬«äP•“wéÀ¬¬N1‘y	|É0¯ŠªCo“ÓA×äsÚ§ÌX„k_ù^p‹¼ïCœêL.<{ï:„åX[UôP¹Šy¶WÙ€¶KÚ^Ù:Lì¯xLÌ‡0Àª¸e§UðHùºþô«û§_}µ¹IZ­ù‘zrÌOÔ0,*<üŠ'ˆÄŸø/ì‡Ây	N¹ù+[)œö97}@RNvž°c/ß"c*óvq¤ã1ÞÄA;@âCT¼²A†Úÿ¡-Ô‰®Äª}äjHã•Ïf¹¹i´1¸3‘bÑv…1Õcâ¸ÍÓë?êÍˆ€1"VØ&p &Q[ã;Ó	Å0Ôcg/zÓfðSÄ¶^À“‘7#—î˜F#Jc;×8/’t
ç+iªMþ!˜’¾ã“±K<ë4"Í×ähƒüqƒÐ¸ß^ç‡V¹fø5
à$äôµ3X‡¨Oyx}¥Ñ°L¼rN‡n„[²A€œU˜²ŒÇëO=Y+r<'tá&OøøØê‰3ãÃJW%¤}@ªQ:%z‡Ù¢„²#ä±'a€þ2èH“3…“ ?£6ëônâ†3müÇ#Š¤õU„I€”x¸Ì¥d êãRÂÁÇal XGÎ9=;Y‡ÚNLœâ]&.EAà·Ñ´KâE‡ãEÉVöm!`9ƒ÷lÛrÆ-n´ŽþÔF}
[7c–Ð†°žVe=‰€#®“n“cž90bëÉÂ3tµ#4’MB˜ñ†H°a½ÉY3‰V3ÁÅœ» > Œã»BAji›Îe6×)1¾iH3‰¦þ8CI+F±²(-‚wK„®ö<‹Q†¿Ü°ïÑÜ¨8i˜›5B¶ÍGÏ£^†(#ï‘o‡jØTÐñþæ¨—ÓM‘•©ÆŸ©øípŠ~Àì4fL­ä>Ÿ¶nwF;‚»m3«4„KÓ% ÛßÕ¬?&Ã{ZàóÒá;\ßSgÛâëXE9”±báñ"w«$@ +s°^  :Á’oH·’ÍË›¢^³•ôŽ™¿;¦JS O¼V·ÌwžO à¢›>›M°Ê(‚ÄnÇ„”<šâ¸`6€4PŒþ’ÂbŽ1‚ÆpÌ3ûîŒºÐænãðÕ4$HŒÚSgŒÎy¬úè’Þöæ·ÓÄ´?ò‘Å h!ƒj9 ¤vd#Üštß£]ô=R8ô‚$Ê´Ë¼‹äy¿ótÿdØs ìƒt÷cr!f}	³¶ L›b¡”#ç,õw°Óê0‘Á¦{.s?°8€á½=¹Q˜Ún¤Ëµ!ð¬ÉÔïlXµg‰&™ÜïÁ³k/­x1ÖÊIÕul‘xŒËDaöme²¤Ñï•ì”—vß{FÈÍ¤éâ¨›Jói]½ƒ D¯?Þ>ÿ¬6/ž(­‹'zãIE½mn-ÏÛN²P'm§¶ôfbêÇjÛIÅ´í{ÁÍñ‘W½¯ ®Q}mÛÎž)‘ã ¥Dë².8«£,yQ­dY¥t‹ê$«Ãê¤ë“WçþŠÁÞt@/P.¿;f·=íLf;@!ýqÃÁ<G­ÌoÈ32¿'{ÀåÏöHkgƒDhµGºíN×LZçú€V¯r‹"zÁžNøÛ{l6(XðúvYƒ³½õd5ï¥}$|>kÙ’—<¯qGd¶Ñî„r%Àþ÷j
[ÏïdöÞú=¼ÔÙ¶ö5ga jÄ.¼ &r57>H–0ýmXÑ3žÀ/ðm×Öìcã^Gÿ¦8Ì²ú¯ÊHßÏr¦¼L.)ñJÈÏ&òä1cK3B%§¹â”4c×FÐbkuâ§åÁâcJé¡ö=¹žØymp&ìõœX,	Ñ0n~ÔhßÙŠÉ‚j¿(Ì–NDs®¸ƒV¬`Pº7õæc†[—ª]ôj±ËÙL‹!y¨ZbÚ-¾,òiW‹#k"1kÐ¢ïQ)!ÖÀDäëÌ¾\x6÷—óöÀNRâÛ¶ÍF_½ÄËœ‘ºa3ÞP‘œ¤÷‚Âùƒ6Ãáë9Q¬÷Y ê¬”^U,·<*\Om¹´>ìÁÿ6÷S»7Á¶ä6‡y²½¼ÑV‘Âc ¬îÎ+»:UÖŸ}d15µ«&éÈáTçˆ%ƒÎ5
|>eÎa€yÈ«8xà .bD¤MÌÃ~°eõ³†¹òÂ¶\²±Ê,·EWvw[$ÙèidÜ4)+ÃÁJ_ôÞ°ßAf˜ï”=°ðàRw†Ê9Æ‚«L·`Çñ²¿Œ© úpÒ¦Vª”?Î0Çe¯Éî–q±&kp¦¥zFEÁ1×ú±=.¾×ÉAYÂ20•åh64p’Yð»Êàî±‡Fê{kuÝªµÉBaåÆŽÙ®ÚAótge´Óô"9 ãk¸2ÙnCg’Ž¡À×*O[!¼„¦­sNîBçvKÛîèû0ðÏY&ó,„¨Ýnô1›RÈ@^ÀÝHÕŽ
iyºf?uÄT¥ßqEI9±«õD ¢$~F3còùÝ…BÙKU%a^·c2½ÊÕüVæj>©TÄ±r>”UY¶ì)ÉKmÕŽ,´m¨ÿEàÍ¶CƒïT9´žìkrÇYSïÃ…š•“Œöf:dKR“4e51u‰•©oÑZ©˜|Hêâg¥"~íÊ-ù4/O×¨²FBO$þzÂü<+àf´êµ~lõÄÔŒ¥[ò¾ L˜ìî0à¯ 0Š,Ž±~Ù¢Ö*3îÙ€,ÕŽ²¤–9¤ÊÊ­ô«œ³_˜…aƒÈA€KˆQ–¤T6²©\<‚æ²GÅÎ¹OîŠè:Kó3Š™è˜nrÇR¶‰¼TªµPãð›nïoŠ.Ñ
G`Ëd"/rQ
´ÐúÍLj0LU%at1½fv@3ô‰™Ùœ¸!Å€`3i4Oìu"„OËîR 8üãì¹ÅÈˆøßéÀe__ÝÜ0R‡ŸO¨GcviqNÿB ~ÂÖå;,¦Q²î+ß›m0‹‡¡O¢ƒ3ÖÄÏbqJP6dL{‰ÅÑÕ›"c2HF~b¿°a>Û&Nïw ªðÃ4m/ûŽð³²ùŒK_ãËQúš±V¹ï²Å×Þºt­íà²î	S”ŸÐ¨äWâ4óZéjC½ˆ)
´ßå`ßh¯½’Œà«û{rQ'ì.i8Æ=/’¯o ¸`LÈQLqñT­%€ë{×‹90ÄÇê½î‘çÕt+uO’¯eAN¿›ñ‘²j…ýµ~0 -'ê¯ÁÌù”0Ø7Œ&Á>à–2¥º*ßç¬6Ó&ŒŽGÁíÎäÈw¼Ù/bØú3mì7ŽQ½	´âuNùGhãÆCm>„Ä>6ÙnªöŸYöÑÄ¬×Ÿµ„ŽÝ]+£gmË{¿þ*^
Ÿ1-Ô-êâéCEUŸ[?­Ux•e}T^dv«â§ëÁÔ{‡9À'[nço‡øS ÈúúñùéÑå«óŸº8=oã¸oÚý[bwzSt™?( A±'ðƒÿBïÜŸ$‡F,îi>Rj®K®ríåæÑÚÓTc=sÍÉ³‘Ä·Õ>×Í—©âƒ y–Ö’ÏPÑ—<Têk£sB½l²žÛC£Ucs}=oœÉ@odGÁF‚U¿Øùx[Ö"IƒéÓ§ZeFß”ÚÌ¬R¯*å\4°|3l³üŠ[ÜÁë	Ñ,Ÿ;¼•´ÊŸÀõ26™Vë©öP4úÍéöÒ_îíâË±/ú—Ãƒ¯ébv¸õh¤¬hZ“=y÷í×sÞÄ=‘ŸØ]tka­°ˆã¢½û·i‹i¬]¬ŸvÀªã~°Úø*'ÂØŸ‘·¤fßø%‚~™bŽ6^Ðq°ÏOÊÕ›Ã&'ÃWov»}†Î¬\P!÷‚ÆÍ„Ð3£1Šh[‡õöÃêÍ>>îãº÷y s†Ù××#¸Jx£a6  ÜŠt¥cKN†7À_8¼AñðØø€E;ò&#ÇŸ7êö‹3o5Šœ/é£y,•‰…ˆ\e"Í¦‰¤mˆ2QW“Þ¸wo½ÁgÐáá·OÅM…ãÉ7ž&,WÊzû«7äÕ÷–Sš®È?§N„ë¥Jž€GðK)£„ýJXàâñvF6V1„X¾NÜ!šÅ¦µ”]³“ð #ÝŠ‰FÄá&Ì€0,}ŽYK²ï6ûÞÜü§æÕQëÖ/-òæ›gëÍÿ2øfýëMc ÚÄy|ÉÑ(gíiæGÎ-y
Zaˆ‡`¢/,Ióì«î›§™W’N D#zæÇ¼µ«@b·cŒÿžPà1,á(6ÿ	æüõf;©¹)V'ƒT3#[{)`úìd-;:ûEã–Rï÷ºÏFe}v,í•ÿ-Æü|‰³õÆ¶úèLal“Þ…þz{2FÍô þÝÒƒš¬TzRñÄÝ+Ëvo#§ÔCa>€=cÐ:žÐÇêxÞK~Š$Þ0g¼HC½cZ$1_Ö.Á;úÎýÀy‹1ÔòA¤¸‹Çq»M„•{³ßÁtâ¡£›³L²†Ê õõé»—|xuýg•Ú@Ðµ¢É÷p=Á‚M±\¯ñfÝŽ%ð¤àkÇŽzMl²bL³élþÃiÃÊ kuÿa)	é¶ÂyƒHß\lÊµ4!Ru«m% ZkO}¨\Ú­…Ú¦ÃZ/š®ÖZÛ£þ0éVé" PÂ0€’ŒÚð±	€Ö¨u ¯Iç®¬ŽIµ¸çZÒ&€É,i‡>çR‚F¨"Ìˆ‡€j@R1záL™W!ú
ËÕf+ÇvL‚©ËnÅMÈ”+üHëêŠYcË¶">,Eu,¨KÖH¡¨Ž Ù3‰Y˜G“²•Ÿ7ÀàŒC­b=3HÉù5¯~ætÅ1g%@’®¥&ó`û¦Õlrì$žÁ$»¨{QÌhY~>/˜xÚçPŠŠÊ.Bž—	:Ýiú. ¥LÜbŽW‚y]ßà„Z©Ž5ã e¬~"@øÆWy(ZÁ\:Fº zÀ×‚qãqj"HHiô)|ßGNé>}ó`”§8§íú}o
°ÐtsùX¤st<„ð\
ù…†AkâXŠ)¾ñÜ1ç:‰ØñÞ¦ð¦Çñ'i²ürÎîél÷²¢,’@N…ùŠ8½®?HŽ.;ˆúA°³ðNXpi8P<X’lÙßÄõH;Ì[‚tp0×‚{N«%GUrÒŒ‹Ì›ìU¶TÔ'c²ÚUç8qùÝØ=HìO6÷™¸"Ì­Üõ6<eg§©pƒ¬uÖr&ÎÓÎ*rÄ
C ðÑpÒn÷Pîç/‚XŸ<Wõ¥SA"8ÍÜõ2Ð‹›ÉE›…}•ml}U¶[p­yãœVæyz®³¿iŒLögÀ7–‡Ž¥\ÈìS²äÒ%+§.t;bÒBábU"pŠƒØñ~€a³$EùêÑ°¢Kh‡t0íÓf“µ÷3«Ã¾’oð{›AŠ'ÀYbÒŽ1"¡¹Aýs¹ºý¥š3Ïã}©tó1¤D2O¿#L¯1îV'«—È\§è€”ŽuRù„jÇµŸüw~pë‚%#lðì"ÃÊ‰F­`ê…ä.cp®Ðb¼;ðø‚å˜(}à$åÂ 3X“Î†j°§gLkB¶O?]J“mÖÜ7ßd'GÛ¼}ÛÄÔø[f÷V  Èª[ {C]$¨à4_2°<P6WEùÉk<€¿öžàÔ„öNÌ+©­Tç/ÒqR ¿²†­¿Ê0Ç{J!$UŠÚ$“AÐ?»ž::cÃi'>ôx;’ü‚0½–Ó€tµçˆÓld¢ÿZÔÐsç:˜†h eoÊ3·4fiù/<Ò6°É£~•(åñmn^ý“Óúå¨õÖ“7›€RÖLJ,DÚñäôìD6«­á"mÉTÔ×t‘FÅb¦Mš«[Ò¨UŒ®‰F'Ayï,ÓÖA_á„IÎÛƒuØL[‹ÆB¬¨ÕÌZ¬¢Ý&´DŠŽ9?GªBiw¼kã¢Ž*u**à©–©³®?*„~q ÁEjóš–ÑŠKZ]­I©Z¦“ò>Â|öº¢ü
úA;I­]7Å~=6)
·‹àR^Ká˜RGòÉ‹M£•¢ ÄØÂl4½c¿¤/ê
F@‡;”ûõ¤O°cq6™Š«v»-‰ñS;šU½r+áMƒv6>GÚ‡:œ‹­ô˜«cH›×êoE\—Ùkj%RØ3cçrzNÛ h¼\lðk>”÷Ð^ž¢‘³U|ÏLQ×0ÐZF$«0XfS4Úë‚Ñ:p´ª}NÁxË‰ë¶b†Cì¬§–¤•¾è½¸ÈÑb¨Ê;VGX8•¢Š;ú)cÿë<ºjíeØp©6Yší ŸzÂÒ—úåe"D§Q–r…óðÒöœ¸(	^OYl¦ß‘©3`©F³­Æ§ÌVš9¸p§Õ5ÏíÇŠ«³ÁZ5›6aŽf×9•8$Ë‚a4˜Íª=XQ¶ñ¼è5©ƒÇ·Ÿ“Öµ7YHÔëWŠœÜœùªÓ~²ûÆâ	œÌ(‡ü’¹gŠ?CÆƒaGÚzsla¦î³)zÅýp>íÝN6Ì¦á¯˜Ab‰üÚ“f±ly~rÔÊpÛÂ¸‹=Ýr¹þv<KW"	6™zmÝ¹$wry	ÀJR½G‘[P?)w2å†üšëlâá½‹éˆò¥URÝ¬ÏGà$Ók!@ÍÝÃ=:ˆŒ‘¸åÎãÆá&«Á”÷„ýW´iuiç‰Ñ–a^•š.±Kª¾ýv‹¢¾K9Í®bÞâVU•©˜Ò[s£a¤le^ûöºj’Y…\|-?Ö/\†Ûû%¡…+žjY>#</‹²}¥ïbùP¨^–Šòe)€ŠZq“«MM’ ‹²s¥Ô@ñ§)›yYbÈŠï‚N<é(¾Ä,‚æl%´ÙàÎšˆªE'ž3È¥›gäíÕ×Êƒû7D˜Î–a6ÑÅâ//N²Œ)8ÅÔk®C‰BË2tŸ§Æ=Ò7Þl\ƒÄÕXŠÅc/Û.#+DáãˆGA–¾sÂR£ëª¾›9!ƒ4˜Æ¸K3·;†Ë§7ÜcŸÃàVDi¨"ÑØ¢ªˆ·Â+ÎÎ{ý-B7FAA×zÐ½Ù#ÜW’|ÆX|ï·sb¸²®\2ó±=FJá¢€$0UùŽ
bì<Ô´OÀÎ˜ù	BrvÒn·bnŽóT Î?âÀ<ŒÐ÷¸*Ù‡ÔOªIÛ±‚˜ÞfM5œ"†Ð$“V¹„öã4f~—{ì
øaxOó]‘%ø®’`c"2þÞMÐŸF{"i†ò%Í¯a°ªs£uØÕÃñ–‚¥!¬[81%8 ·<ò¤À‡”;–m¯Æ‡ÖÛaA\d“Åù“šm0†o¹Õ‡Y­å€Àâë„ˆy?Ê#¨ˆøev(ÉGäŠ¬R"’È‚Ê¶~*à–Ùa2Ä>f1
|&4 nC û¬Ë•¤iø²2Ýúþ&oó0ß2	K‰ì°RaË˜t9[©.02ÉÉXŒCÒ$ÒJ9¤Ôhr«Ã_ì·£é57òhÂÌ¶:ë÷€’±Œ¢ig[¬|‡ÝÄN›£Ü§bž¶À¾,çDËÃMNÚ˜ªh(Õ­ÖÃA©cìÔÝZ)~d1_/íL’31¸?„	0=,LpµzM®ƒÕ1`8‹<ó‰í|ÀÂ…Á®Á»òŠMæ.Ä5áHBŒ )òþ¯qÈŒ?›¬a‚“ÿoÿc½ÙÚÃ+:kƒÿZ¿Adƒ‡¸ç¤yÔúÇú(×pÃ¿ã_Hó%½©|ñÖ P”Ö^yƒòÖÊŽ›IË,YÕŸá·ßÄ›ËÅOœmWxj:Eó”>í	õ‚ê)¦”g.ÿ\1åHi—Î;yW=ËÉRµƒO—±J©O)ƒÏá6ÀMåÑ‚µöº¹Ô°üW¹Ýø,òƒ$M1µŽ¤LM17¬n¹Gx1'•¹H6ØÐuÚ:"²L~Èš¡í&hrÅý’é”¥È+^›\’'£¥Yž?’QM˜‹w6ÖDáò–ž`,J|¼£PìŠÚú¼kUSË«;“	.àýáÉÏIw ÑÄ‚‡µDÛ†ñd^{Ó('¶&%åÑ…
4rEY-`³`ÂMÇoêÛ2º¶Lxï|Ý[Ï¦|Û©4é„ghÊÓHÄ,Û†¶Àìh§¹XÅ°úçÁiÍ‹ÌÁ*ÙÔ84.É¹˜Þ\/”i1Öô™¦©ján¡<|(éNxî·ýÍxô‘Ær’ºýŽœýˆcyßý……žûˆÃxÉà`Nê6
ð½ôèüˆkrÁÒ~Ä¤Ž>òž„<6 y[aEà°èv§½íÇ×Á`¦NP2f¾›ñA¢º²Ü]<Ý6}Òˆ…h“Lx2ú*ìUÆ­„{ +î!"¬tpª“ƒ\DT^é},yå×óƒŸv3M‹JÀ¨Eƒ_™c]:í'™,E…)o(¦ÿõWò6Bö¥õõœmÅýÛQ-†€˜„Òk7Ó¨{Â…ÇÅËSÂFöØ·Å²¶W1PKÃ`#›¬¢ˆcmæ^n? ûŒµ,S©RÈKS]+÷H£Ø´@-°šªË~<0P`Åkô¤j	3k¶jkY¤^†?ªÒMÏ£V-y mcø¼<vjdÛÄVD{¨î¨Y#?–z&¬°Á›/°`Xà€OÂ p0=ƒH	ÀXïìhàŽ‡$
ûF£÷Äñb|ˆJ³{?w­,Äœ¶÷(ž%ˆA®
 {Ì~Ð’
µEC.>?>vä„Gq³S~mbBu”&KEÓ—Lµ…jÉš#{bW¯
[r­µ_ÍpñKk°8€VÂ=y)(í%‡E4øÀ¢˜ÜÜl™••š×p0…gi©^nÕNq[¾MZNÌë%·%íë»ñP±0á_¦­1©þÍt¹üÆ-€6VÔû\øî-+åpbÜs1’û`À°ÿge‡‹ÍU²ËÁÃ’»± ,JBêW«YdÕ=œööª¹O‹êY7tfØ°’;ôëµ.‚{[4ü2›Ý$½mc:âºCúÈK®õEØ|kr$¿…¹‡;<³Azé¾Ën·ð"¢«\DdôhÉ(Qu«h3lež¸/ÂúU3	ÎôY#^†ˆŠ²0zÏÉö`Ú ä-°ÉØƒ?9€^ån.¯ðènõaQäºØ&ÕÄåŸ×1/Æ¬;³ú©Zœy?·Ö>Gl¶b—[±º¹Þ*õ”V²Èè@Bc¥úº5ÇT‰ë‹­¬ß.Ê¢˜Ž¯[uU¾Ì–^Å53‹+¯fèZ[d%¥R»ù0Dêó:å¥,Æç}nI´Ñ¤j„‚€• Í{#îuŸµ“J?Ø%ÐŠ9%
G³Qà¿¶k¼ÐøÉ]oOBvžÉ4?ˆú®ÆÎ~
ôïƒsóêe	0ó=ÆÌ'Ï¬|’áß_’•Ÿðkó—2®p,_fqCLÕ³(W4WÐ‚òIû·¢b\`–;Ì•$p»Úþ£D¢¹9&Y¡i"8ñ§ÌM¥|ì˜Ø­™éOØ´/Þø}`³h Ætnúu™–gN³¡TDvã‚L?öìGŒ¯äÇ6ït¼¬l XV„5/[[t…Rá,ÖÚ×§3C¯mÏî]¹½B›Ä¢²€–r®s!ŒOÛöéœ~KN¹&pbø0¤z”¥CBÃ°€'‹zøB¾R_ND2¯kè]TV}$]ùùZk#ÂvxÇ¾?[˜W´#‹úR®eeéS„%s’dnÛåN–…N”L¿ôyiäWwš°ˆ%×hñÆ–4êx_MWz°X³.,õ-7€²JxËšËXU-+04XÅ1Å’9ªf*êöògË_!%”Eå••“^*Ëu°#sˆI»Kl,KXü¬”s”åá•Hÿ1Ï’r³üi’=äyâköÑOO‰ããçy„¼‰üëñN¨GcºìÁ\BÛ·Dš\-§š§ \^òãKöÁ…¾ËÐ‰F½ÏRì{°‹ýÍÄû«¼ÂzÉ¨÷7W·B÷;t¯Ë‹¶Áü˜+‡}³¸Ç©é\ó±…É¯OZ[½Š‘²Ž4=„%ø£Æ{Í8‹—:ÓŒ¹ƒ7_·v¬ÆvÝÔßõýR0F}ÒƒBð‚D¶ÊÂ[”ÄÊmeï'½œûÉ'Üi‡ßIÇÜ«óe DP¼ÁUÛßmt8ÉÚQé·à<¢ ÍŠÑLåÂÆ(ýÓãN½¿†¸ü^ô)£"ž2ùïY0Ñ—!G¥Ã:rp#ý62töþæ¤`¤µ"KˆÛ3#º#&ÉËðÔˆÑ%Ÿ–81*«+²c‹/aPœ8 <‡TiÑ8ç€Xš5±ŒQÌa×ˆ¬†UÓ¸“ÁÀñ²aXK±Ùü½qËQÕÜ¸wt@\£ÕIãjï˜'ÆƒrœñZduÞt	¬rƒÎ£E&PÒ#¸4êyŽ_oêKË|s{¥Î¹9~½¢Š¾Å^½Gb‰’"ñ-†Â•XÂ5ãØ©*¡@tcjXAäŒâ`ò Ã2‹Ðæª"ƒÝÛÍÖA4;…kßR˜šjÜRxÛ –sp-tjMÕ6õZSâ¼WFY²cÙ©ÌcÖ`õê9/îë¼o}-pf:eÔ«Ñy–^M¶z£S£Ÿäñö²ØWúVPcmL£¥W|MÐùÊø×`<M‰Oþ¤p2„Ð¸êùø“è¿eóÞª°Uä*¡×-(/eS^ýŠs÷œkêe€oWSœXsÀ,^Ð'ÏÓÕBÍýMÖÛbX£¬Ûd‡^Ž×MW·÷Ôo„•=F‰]‰L¶öró¨¢	ßŠÕ§³ÏŒ½Ã@ƒÉ–œÝraï)ST`Ü}ÆXÆ`¡PÐ( þý¾šÂfu ° Ñ™‘DÍµP²:ÚÂÊˆ¿RkÙ “NZiCãyÒCÀi–ÊÄFaîJT,Õ@ìØàˆ	ÖáÃÐ™DµU7çUF„ÌÈqRÆý$2žëâ"e¤†ýxe7_¢4ƒ×Þ8^D¿H”Ö²„D¹j‹”¬î¨uõ¤ó~T–ËùrQÚÝãQÊyðÝÅdË$sÙ27^±ÂÒW‹W¬5ûÉŠœiÀN-âs‚f?Ž*<¨Ñz—@ß£Ò9zçBƒ2˜Nà$B[ð9ÀÐòQ„2…ôH èwräiŽ‚àº´œž&ð©‰Æ9„$W4¶G(û,ÅãÚ4¡3~‘‘ÈË"ÇV•8’Àª\LÇc'œ‘¾ƒWÀ. H“xÄÂRZ8–*£†î€à¤?†,ì¥_·–ÄµÕèörR‚Œí•«vXîá¬GÑ7ã1°l1)¦âÁàëaMÛˆ¶,x“â‰Ñ84£°×í7=¦Qæµ»5ÖëGb"ð(ÃR‘ŒÌ_á,"Òß± DRÇ "i¸uDDž¡‹t•>øø
T¹ò†|…0’Þfa„QïIHQF‰È€Æ,Àç‡„ŽÊŠ–ÜìU;¬)ÃaBÇ‰äÏó`À‘2]5ò|Ê¢ARHÓ>m6~=3#FÜáù¿µÞ†MGÀÝéÔòß^|^H#õÜ¡øm¦^ìN< ]L0Bûƒ°Oµé­¤ü•iªÅ:#7êÌ“¼°ƒ¿I(Ûw!uÞ£å“ß	ÅFj©ô’a	“ž:ž/6fJ1ò)Áu¼óSôÐ¸ÌâÅ`ïo]˜'¨IªD—Åv&™T?3õÔ=aQÈå‘¯çóÍ}¼GN„ü
9`¨šŽÒ~zŽ×Iƒ	•ÍZ1Pýj½\95¢YÊsÍç‹çË	í‚Ö¨J” ·¼?QZ	b)OÈVVðúzq¯	ÏÈZ&y”Âþo>fÑ2*$9Èú¡€°Ü¿­o•¼ Áhað^›’¬ËðYS!ÁwSE–¯Q›\·¶ñúj›'µ]2ð’êÕ‚%Ê”g@[î¢¡ºµžÍ°)œä~ ;Wô®¦ Ê	(ég÷¸¢¼ÊIÆ+ØÆËé˜†nŸ4p¼f×«ˆº»XX¾L;y!jòƒÃ?@HCµ4ÙZâŠG*Í‹L®Íyk·‚¨Ç9òG×eãy—
.KÂ†˜)t@!˜Ãí² †
•š_ðì¼øhìúëí‰3¸ˆ0nnmµÎÚ:ˆ¨¼ÅCdÉ—iÝ¹+jýcîc×ZÿÃm ï¶å‚É¢›L+Ø“åñ–èóìd™d#ÒW–ñcŽÀªÐ^¾ù)iòŠ*‰d»FÖCÍÞÓiã·ò«x,ßÏ('*9^qÉj©)­€fqpÑ•ÿ[,ºù–ˆrÏmê•¼½K"‰eõ–É±ŠÁ{EªòƒØ|_åªÀÚš.£-lÂ@|ŒéÅ «AÄäyGcOƒo)¢þŠ“Y¤nÿü#¤8"aw%\b¥ìµ¬?Kï,™€€(¾ku¦ûÖ¢O—öF•‹±®B€QC©Ê&Ë®Ôu%*9bJ=–lñ4ƒðÑ
ø®¼aJí":îl´’n°Ì-Ú¦‚gÄÜÕHûVµ°é1Õ´Ÿ»œ«\á\eaûgáú4a.=Ø¶ôÆ
p0ÓØ9,—Ì#YKWÓüîešÄñ)EKhu±˜´Í5ò;ÂyÊ•HUjY!Äb)óå¬ZV4¬UÈA+aÁ©
K¹0YeZ¯%	êr(wžêÞ–O]³úQ.Êt‰*æÚ/Æ¿-L œÂ2Š1mÈù„˜q“ÛmÓ4‹¸>ó¡\Áe#`øæ…0RîøÍs¨Ý[™®gEG>Wz:“•¬²Ì“ËF-áÓž­œ\.®ºÏ+ŒîâHWóE-Î—jtc3´I¤Cþu·“›2Fçb§*ÖDäLM)E¨l¢ÛylJ•zjÑÔØkuajmåA4jñ÷îÐ‰ƒ°Ý÷Ü	‹ Õ¾EóKX=„ØöM¯ÓrD+ÒX¨ÅAôÕ|{L\àø>Kóõ<3„û·+Ä
tjÁFØ¾±Y ú°Lf«ƒŒsx&ËyËNÒH;OÌ<\9›ÀÎ>·iÙîÕ¡ÉÕq²«àbWEÎ²ÿjú²d¿0·Ã»r_­UÊŠÿñoÿòÈ¥;Ù#ú1¸Åup' 7÷Ì;®ÅŽ{³G+XÎF
ö–Kþ·TúZ6€Š7–™ h…

-ËÉ Ä27±šm™dÚ¼ŽGQ¡5þyMÃÚÓë¼hdrÁ÷8Èå®ËþÚ:Ö „÷ÕV²Â”WãBYÛ½ª%1ó[<¼ÃeŽ;A¥Öôë‘äc·Vën©Ú™å¹,Hã‚Uù]ž¸"úÄa¦P}Ú®—–àðÝ?ýê+nÿu×sixô§¨ï¸#æiÎI$~Û` D?ü4°4RÁ„úÇã†cr¿GÒ·÷’6“z@aÈ½ÜAÚ<Ò—ÕÒ¦÷-¾W„ˆŒ¡Ø‡$feøoúl.ã§¹°oæ®”½p¥¬é>™…özn’ÞÍßka–ƒn«q7E†!–p;â¦«Ø
&»ÒqïR—‡:Ka×Ø¾j2—Ç·íÃ ’nsßIöôº÷ ÇÊ3dF»sdP¢ û\c
, #?v\¿TÓWmÝ¿§&·k¿['–ë.Ÿ(–áör¦ÃbnÞ+ô@Ñ+„×§±ÖåFåU9öŠžA\¦Oë´O£„ã×A^g­œ$3T',o¥*	ô%yáŒDñ9ÑNd\¥ç®ÿèLB7«¢”¨KÿÙO¦·¨$O‹L2ØVò5½BY¯ª^¡ù\TžFÏ<„þC=zÂyœä0Ÿ¾q=)Èl€µ¾Ç‡hdzõ&-þÑ`€o¿­TÐƒrŽlÊ˜£ÌÞ–2aiß{ä
~iæŽj}ƒüMY¢7É‰5EŸbY²ƒ­> 1Ù³Áj§[0Õ6‹Ù¼ÁoÚî€<:8 rhx+bD[ß/ºé¥xL[¦Ò·«®#^õ¤‹ˆF€ÊDðÑ3õß›õâÎ?ÌÚ§²`¾ôK~®çž¿ýÚdQTžãÞ`Á]´l—åÊÄ/‘¯Qº"MÒ$/Ä,dáö;ý>ú.G¯Æ€ÖE1E¼ºz“•«ªˆbØÿS;âÀ²ƒˆL÷ñ…C>¨:‹€}øÉ6¤g{äHrõF“èøJ\¡ö3n fâ{ñå,
ôp# ÌÅåÊÚÚÁ-ãŸÇØyèþÈ@ Žø:v0/~œŒ_Ö‚‡A8­1¯#Ë?Å¡hŽç°†ÏÜyFÿT¹Á"oÀF~&¾h#WÍZ“JÎû´ÿR^éœ2A ­˜>(«L@áýáÙ€Õ<•ßÔjh7„Jî_	†Þ:ä¸´F0êFºúQ*æ‹Ø]Æs­aù°¼i[³‹6%Îº½³¶V.Z«Åö›Û²òzÊm,x4ôŸ@|<óôæF½<™|¦1~=”a§µýAK;¾7ø©Ö¾$9ä¢D¼vø¬,»»€÷žµ-ïúç/†Öv<nixL/*mÐ¼R¼i]«ðª3»¾ò";|â§ëÁÔ{ç ¬N¶:ÝÎßñ'`àÇÖ×ÏO._ÿüÓÅéyÄÿô+eÊ#*€n}/pçt„1¢Pƒæº7¤)ãÝ'“Öœc×
Í/v/ƒr‹¼ˆþÚƒ^q½TúL±qâãÙ©‘’³´HÉº¼¹°·ÐG×¸8o“ÿÔØãooHwÃøý§×¯ŸŸž“ãW'§ðž&+1×¨F^—G/´¾HH©0Lš—G"ç§?œ]\ž]ž½zI^¾j¯«ÕrW¬Í#³ãW//Ž/ÉëÓó‹W/õQ*è<¯úé‹£³çäèääüôâB­Í(§Öë_½<%/zñÝé¹Z‰‘…Ü‘]žþðêü´1
â‘Wç»Ÿ.Î^ÂÈl#´)¯êÉ«ãŸ^œ¾¼¼ ÏÏ^þýéI£˜iÑô6^¾º<½ ›°9/ŽÎÿ^ëº¤ïX××Ÿšðz‹(äOÏ/þÔžÆ˜¬þÏ°?ÇÁÏÑˆÒ¸™B³r’››ä„Þ ñgß£(sO£8ãQÄ¢‚öo:ö#Äèï"2	ƒÊ0•ãaX”Ó»>õ2£Â 90²+mÎsrÛí‘]r¿Ázg‡ÄöF÷1¾‚o¨ÇÄöæVæM<¶7{òM8…¿ëPoí´#^Õ ÜÚ¨|S…jëŒweï’m/mËÖLÐ-lÑÖ¼–Ù–P™¼û&…ŸÛèjíîï?¾ÕY¸¼Öáò`çgŸÞ6@4v&ÀúèÞ^o@Û€÷ôŽ+ ó.cwL)O gè‰Å.n®ý;»x%æÖÛ‘çöi³³Aºs$Ì0	Ï-ëûmÒïÏ'nHû@Zg?súõó×ó¤¯ûöÝI£¡{öEð®B<8­RxÓ$âºäJ‘£7m¬ßl«}ÍIŒÓæZægÏ¶HóZ} ‡°¬QÒÆº6 =+’Gcr<ó:0ç’.Rn•c‚=ç›Šy“1’÷2ßÆ¢ô/?JE‚œ"úÑ#•˜ÇºãæºAùï	^»`‚é[fÕ‡±pv5ß^px¦e(|²HLÌGlæ‚%¶Kõ,³ë%égiŸ{ä‘üœmìÞ\…¯²Ÿpg¥¢€\>9¹(OSÿ—)@Ôš*ÇûÔ<dÕW—wÀl)S`"ãª±]&wQÅ×ÖÛ®ß÷¦5ÙàŒ¹k­2?µUdÿVÐ*ãÎŒ†Žmé-®|–ñy¸kL™’—5ì—+¨5`eéµm‚FÔõU¿ò…IŸ$Qd“êhoƒh²ª*pê˜vâáÝÄgâ¬¥;ahpæ<3]¶}U9;i€883ä=Õ8Åq0¥eGÿáÖ	YŒöCòë$Oþ(ÙÁ,&g;ÈÚža¯6´ÉÇÇßQhVÍâ^sàÞÜœ83\N<j÷©ë5›¼bVøˆp	![‚ôÉ:ð/Ín§Ó!¿';ÉŸÞ¶‰‹åT’~ö‘®Šõúæ›ìË	Ik #!—Ò¬s¯Á”†éä®b—„ç„…Þß#o¿ž‹ßïÉ)ÿðUh^bœ˜a’o[Ë¨äâîu:kªf{”Û×£ø]ôˆo^¯÷°hi×â»Ò»xb@ô‡§ÄµG„R'šù}«‚à‘T>2Ì!ŠôDŸ	åÐ!Rjlš	GÉÔ“ºææ¢NHaœ™ârWPÈO_)Ha3§*\'}+*!,1C­që€¤ÅºM9+c(ŠâõÓS¶j‹Áu¬™p÷ØU‡ …Æ:o«¾‡ò¨u‘LF‚ÉkXá0ö™ñ'Ïh‡!•û¨Ôg[ª(Ô2›‰@ bÀ_mp ;žgnŒº»™	å‚´Ðû¦`H¹Ü«:Ô9„¼fBz’šVQƒ÷Æ¯	ÒÎJIïŠ_íÈW’ZüJM´
Ã¶Að<¨é ÜÁáŠQ£så¢C·©T“A›Ú—#8¨°å âÃ­ãÇLíÇëÅ#7J@å¹Ä¯‡Œ¾ã`“kJ¦þ  ¿m´mG>úrñ^’årÍ;±5¬Òs8S?MPGY´]B•'v³úõãöññëé{`Yö¼|ñüÌŸLãS"s˜ËP@€Hdû†3hW7:}xÄï¿MD'Õ¢c$âÈŒœ³:{OÚ¯OŠ¾-«É[EV|g÷>Ã{Ö45õb¨. ÆÆ…öƒñÑckø®ÈGgcgH›¼ecc˜ì—„¼í5NƒqßÍq¡ÒF´ÉðT´•ßs­1¶Žß¬-çKM™eÇÿŽ"lü§óçÜ”A¾R‹Léá¿‹Öº¦ÓFqŒ7o˜ÆxƒÏÜH‰6£»¡Å’-VÞ`ò|Gjy31|S¢»¨ SR‘Å`­<ç2©ìú„ßïà©µÏ¯À’hÔÍXGm×Ê?`—D±µ¿9êæôVùSOI[u„Ï™Sk@`ƒ€Tá{tŸ„Á{´ƒGH¾Ñ–6D_ßD—ÕÎY(‹cNÎê•BÔÑ8êl–i‰à~[hÈdô¹¬˜ÂDÔ‡^n[»2ƒé¤æ²q}œkàb¦@ð<zch”`ÒênöÏ~ÎviÆh±SR»9Öeë$à¨…aZ]O9/"Š³´8cR@TœNÙEbTlnÏ&ŽŠ& Èt'•†1õô¢/É@
î€@‹›zïxSz0O%÷b×‰Àç4VX@ë¸*Ê-qÂ°d»ò0ç$äª¶´ ½U¼/ô Ç†)$ueÙö2ù£aŸ÷¢^T¾¤»LcôßoùxÑ–›~"wÊ¡,~yd¤Êî2W-»t¹‹Œí0…ˆ$‹Nú‘äî@SÙÌ±)I›XÃls£yÕMæQî“³bEA¶r£Dmi® A²Vj¥·ÙT>‰<­H‚Ü¬Û¢¾-pˆJ]©Šg©õ?gRj8RÕ
 |ÅåB%RE$¬Çf··‹f=ßGI ›/Œ’²_zj!ôÏLÆÆw1@ØÍÇ1«™r\óàÞ{ªíWÕöÜ«
²;Ÿ?Èb©þÿ‡Ðü†±Ûw¼Vœˆ¥/ßãÊ1—†¡{XH(òæüHp—Â„âf·ó`ÐñÚ›FyPzf‰#Vû´·˜ªVxl£¿siÎjÇq¥©)s\áo+?ûcŽcQÖÉBïÆžð£K]39TßGñ1¡'›pYF]À¢ËïÖðœpÞ–£©Ä!Ë¦AP|q’)Ë[Ëû´e3û´™ª„s:t#\¿—ô69Såùsµ
ÛItÞ±‘ð”g˜QL‚Év1O Ó# >òzØEdâ„±ýë(wß²þ6gwÅ…%lë)±ñV.¹U\ãçÙäÜ´vÕgY¢âõfQÜŽÝ°ïQKZÀRÑÏ~!ïÊ¼0‚õÒíõPÏ’~å) vêž×2­bRoui×e\>%•“Š74K¨”h½ŠJ‹EÕp×bC·ÚKÕ™Ô“f@S”kt œ¨kÚÚ¶Ñœ³ÕétË«
íŽv\ÎWe•<Ê•j»ÝNÝ\øýª®÷!÷%¬ÛrHû“YlôÈ¦EÙã`<Á8ú ËÛV²Üà7²ÒÈ‹›?|Ù´h0Ë,å€Ëµ¦U¬LV‹r5ó•ß, Ÿ27™#n¹óŽÓ¢Á1¿Iü[zçŒ'EWµú Ì¢V	ÂÂÂê7º¯™³ORõrÓ¢Aî7O¾í’ÒëK,&¼2«½UÂ«0üÍÂë±°}ü«iÉ
e/„QF´Až¨øqû%W›X2|ƒXë•²‰íêo„ÑÛ÷e@š—Îáj¹Elƒ‡ë¿°Nã±×ðîãÖÀº1º‡Ö‡iáD½¶¶J fÖÖ¿YxN4Ü…¦GÔÃp¿Ÿ9Ù t«„úÀ™º JsýUB©t¨	¨®Zƒ	Ã_|:>ôÆ!ÿ“ÿZ»ø£q(?Ukj“ÃÖêÏª¶û×ÂÈtí´}‘23E#ß³ò¢IxÓÔ?Š¢â*Ï_âÙóñ)…ÉÛ	’_²à›Àð]EˆÆ>œ:Ÿ9P“±ëcl_è±&ˆ£=AÌÃzð $AHB¾ˆÄ¹†qéŽ5	®¬á•êº¹›ÚýÚvEŒÉ$níäÇ™¯q«™cÌPvüòìÒËÑ“*R,Üê½RÕ*8ý>Ä½y6_±–ÍœW†+ðÉà®~å®–<'…Ê&iºr5…³VÃ®
)Òªú¸hy¹…M™-¹™¿Ê4%ßI¼ÊÌ»*fðØÿÁ®ÓƒÔ K8ÂáB–¯ÊJòC¤‰Ò®”­×Ü ¹Å?¹	OR¤/’ñí©©Wë9‰á­›Çðn¼)åkècc¤i±¨Ý×p¹hÛv£ñ2¤eFQÎVŠì¶Ì=i‘lx0)Ð?öŒ†Èuxìø}êU´4™x·›£Ú•£*¿m³ÉK0ò†YË¸ž’÷œ?ý6Ë,˜¶—‡ÇB*v\eÓ­;?‰†i(Tìœ5¤ÎYð¹Òæg˜\ë–G-+æìT¹>qÒ•Ìf½œ Øxs»8’€£ÜÅ·¸¿(IDìÊü3šÎlÞ÷‹±Âê6O@ÜË§!…áàMØL¹vÂðÁ6‹%üÌ¬ƒ=#<Óhi’\A€Û#¦ybAìédr6 ÿHÁÜHsžz=òØ9ù•ŠOèÒ Ä•EŸåØMÂQ¬]|ÚõL¦7ûö13Ãî]aZÆ4ÅœÕÂp`NGòÚ;PânCÄSá]FåâÕÔðe¶¸eëó|$1„k'$™xý3ÂòÕÿÕ6«íŒ‡›í¬¤§kŸY5÷¼èG$ÏyH’øŽ¿±3"ç]ÿˆ\{ÓÏàˆðìðfòMqR¶ØIÙJ<@qFyÄ#	¾^û<`MÂ‚\çÑ  j(Î}dˆÑßàQS¯xŠáÏä807›Òãf¹Î;bµ;¨©/<«9‹YYò–'GXÆ$©è9ÏË"p¶ÎY¹ŠH6ªøÇW™«í2`_ø·@Ýiv)œ;7:hÌ,Úlvm)¬ôx£÷Ù71ëDê•Ä×ÂÄ’µœ«¶D”&­Áìª[VZËŽÀcVÛJ®Ó —|Õ¾Ü"ÌÇšïèLÉþåòß„ÎƒÿRð‘–$@ 
¢®å×š*v”„m;¥žÒÚ÷´N/£ÂcJz’ÜÝ˜É@ÅUÇ€Þ8S/ÇÄ¿ºš6¹SÁÐ((uX[=Do=íöSc‘[ã3i¶0UáŽu-C]ÉÒ6KÉ•‡ž¬ÞöùP¹®¼æu™B…Ò7•ŽèüYåm%—y²”Ctµ«Ž¼Ñ	x†ÎµÔ+®[bt-7OIRÏ,e¶žª¶ ÉÀó£CTóxÕ«ž:½bHËUÒ¹Éf3GuÈ¸¬ywKO¸> µUgœUËÙgµIÌL´j©–•Vúª2ÔjÃ¨+Õ ¯êkÕ.5”ër=Ë§Ýìe’%«§UR)²kÐ†Y'Ì
–¬øe$%Kù’jËŽEõÐ3oÔwÌøF*’«L-"lK6xÂÃT«\£Îò.ã+ÂdÕx9XŠÌ¤uWù×Y²@”F=VØË$ËÇ$,õ–Ë>NzèHª%I­ížúvOõÐBs|Ô»Héòáö®(’Z*¬uŸÂwæI.M¦YQ` ï’gæºhù]ŸÜ8ö¿vŸ]Õª§º«åéVbùUÙîTær_Âì´: ëq\Õø'ÕÛ0ô IŠÄ*Þ6²¥ÅA¾Šù!KUú[Ø}sçdªÊÛ¹…B_ÈòeçÒb„7Q#j,sp¬¡x‚—	!!Ë€H‹¹—I×ÛÃÅb(ÈòeïÒb=Ì<8Ãâ äã}0 X,(,_  -: _ù%ð¸’YùáPø¢.ý²üõ@gwY4Pà1„nï²Ô‚E<àe©ºýU]Æeù”öIGqYÌm]Äa\–Zû›ã;îD˜®òN×ÐQ¬Æ¥<§¹E]Ë“æJ]Ìµ·«û¬Êò)®ðTÝ­æ¨*‹ÁN÷ô]B,e=¨\º›ª,UQYž[UMË"h-åúYi µ‹ºÿ  ÿÿì}ýrÛÆ²çÿy
„•{IIÉŠ£èãêÈrâ½Nì²”œ{KåJ ’P&	€´Ä££gØÿ÷¯}Œ}ž}}…íž/Ìf€räcMUÀ|÷ôôôtÿš¡Ó«ä$b…æž…:É^ˆ~®Vm–##Jw@%í.õÄ2µ™_ÀNF&G¬ÆÁiˆœÀ§?ë»ós»ët¼`qõH\ #¾ûÌiæÖ61ÛÜ àìõ$Ël˜›Õcã@U%Þß…x´÷z«ÐZÔtø¹˜¢t+7„Üzïm^oÕ¶J‹Q=5&c˜‡6÷ü{m¸óñÃ¦–¦}ÍônÂ2þ6ÿ¡SåÒ¥§–o¼z³±bY¢†¥¹'KÑe‡mwüÑÀG‚âi—ÔBÜÄÅ÷xà ïøÛ«ð{¿»›õr¾«âN‹y.z]ö’ºM”JŸ—R©Î$*m´õ¨ìy»ä‚Îw Ë»}Ø%È#~×¾£¾^#LêéÎÇÈ§ÿ`üÂî5+sy«[v¥Xú¬'&^0'êV+Ž=ï>ÉÀÙx×w6DîÂþ Å …GiHåe¼ý÷"Û4/³§Z“ù½˜Kaã®Î%¼Y˜Nú¦ßë™Ö1›Pz<"'Ï)ý¿ÿëÿ¿ÿó?U¹Í÷#²ä×Ë[uE¼¼ª²Jƒˆˆeæ»,
ÑoúâQ.${MŠÿ5‹ÒbØ&á;QÃ„ÁyÊDãÚUQRÂ[ñ^=Ä@ôð´ù+›|þ¯@Oðøù‘@~SO°ˆÆ£§©w)ž"†vóžß‚ÉKþSÍ¼®Âò´«ÜÖ@9¦zÊ¨÷?ØûkÔBj:ÇÃKÔ®‹šH±þE²÷ûâÃb§½)|7AåI<ÇñP÷‡G!ÂuÐ‘å6ªŠ÷eK½ø[B–†V3gð·8Î´¨ðÎ]KžL³¹Ð>½öƒV8}Î³·á2¼“þ~ƒ»U¶ÂÙ.ÞXŠÂY—†¤0˜Âú¯Ï–³ˆê4¸Ò¸¹ñƒg#ç	Ë[(=oö¥6ÛZÆ_cµoÃxÔÜè‚¼F-ìân0%Fí@É6ßÂÌº¤º£	ŽŽ@o£ÿÕk3ÔíÓàý?¥Áž=‹3†g²øê³ÜÛ”FóœËWbóÞšBLxÜ¦áéÁMvOÊÁÂý˜Ä°ÕbiT¯Ã¸Jð`¹-mìY¿G\	ë•Nõy|“Úü®W¸óÓÖÑ0ùC‹>Œ‹ue;u	Ê¢-¨Y¼©ŠR`–F;'-]ûÛk(SÃQáX_•ŽØ°¢ÞÖP7‰¼úÐÈ}WtÝ%” L`šëÂ5È–'¥!ìÆë·åþRéoÍ±ª+È•‡+ä÷¬ué[¯»•o>GLÁDÜ%0£9FÆ
‹ÌØ Ýi`±
/i¼YÌaƒ#"IÍ±.mˆŠl¢^´5ŽN^w²T"Àë.Oçh€ÐÂ¼q{ÔîÐ!ž,&/S¤Ädúãd»Á Ž¦Æ7xe¿B¯VÉú/Bg89ŠrŸ”:v4ê€úÿ%H£Ž¦ÃóHæ&›Þo´j*¾g(WáÒŠ†^âÕÎdžµ+Ë}Ìe¬¥v¨\|ë]¦»Ükq”ÂF‰ÊÑŒŸ<³qg ^;ØÚ °+ˆ­n\qj<AQÁrAÅäë.©hØqL;~å4ef oTlã˜ÑöÃyìu<ýàQP—x[.—o7ÔAªçh)'`‚BƒÍtÒ4)¯ÖÒºB[-&·Q£ºÒÕCÁŸ‚ƒ`Ë_eÊ“¾àh•¬cU8Xi›6Ñò~ë2†`Ë[Ë­´­&IøšU¬éB lÐJÕ)Nód|¼H†‹	K¸¬´ƒ|+UÇß
ã]ÌVòÀ¤‚ïoíž-°¹åª„UdÆj0+^\ñmb»MBqî½'å¯û–@™Ç¤ö Ö²¦²µâYìmÊ`vÅoL{—¤è„{ö=©€ÇÅƒmQc~ gF²ŒLLlN¥¶Q˜]G£N]Y"(R‘ààãkrKM'’É´6RWÓÚ
{'¡£’ÛI8^ãå‰ †„º`œš ‰áûüq*l†Jl(Ëx—ùÆ!ßNªµHZWÎÒeŽˆè Y&È0^é$ë6×i~Jn†/–F`/ƒÁêp.ót¡Es1™Ó‘˜2g$ò/Táˆ*¡|x	ŠàMš±yOò2N³yûoŸÂrX~SrÍjSÒ ÿÊgÁys®œšÊTÂçeVüýò°í’y„TÊÌTk€“#l*ŽÏŒØšZxÎÄÊw]‡m¨hã& 	ZC[>•T]25wŸˆTNE5­fê5O*©l›æ^[ýúš_qnŽÇÐbÆ9fø-’„öu.T$açèîcQ&6Ïã-N?'£plžK¾×í›Ê7÷§<É¢
qzŠY
 žYûwü/Ëw³hzœLOàÓüGñkéêQ¥xß*ÆMWæÅ· ñP‚Bõ¾QŽÒd†÷)zU2§ðœ¢P5l!<‹ì™ÇÒ²/Ïx
,-ïßÝqPÇÝ ×[ƒ¿ºß·xìïÞ¾@à•RF_”Ñ'%”P
—¼EÄQÆ‘‘çßÈhŸø@Wª¢+-Nõµ31âD]u³y2{^ü.›»Dª+˜¶qÐgSÄ1ÙšàÙêzí=ípÇ‡/šfAM‚;¨¨Ó*µ™iWœ­|_VÉ` "æáì£ûÚû/Ãžê«ò\)âym ãUñNNÓKv6"0·çßõ>^¿w £>Xüä‹qŸSçM,‘‡N.pÃÜYWg§Ü‘4ÐÅïá;‚Psu:Â<CSGˆqq½¾èþ	æ£êÛ	Ì×éYnvÿÈzDÌÙëô(7(d=â°AµPzdý¢8Aë·£3æ–.7*;©D$_ÃBï9JÎ#ë8õWå=­Þ`ëº›-Dê¹—ÃA0žSyÖê&àfpÚúZŸ•Ü0×ò¦ž¿ùÃú™¯Õ¿ÜÕµ@ÐuÜÊ]n›×…Q>h<ðr9Ò(Ëª9uà0ð–P‹ü9}&;¥=fkÍ›ù°œVŠâ¢@ÞñrÍ¸³ÃÇš=ô¾­Åß£èY°«®°ò/;é–{Íæp<šx"yÉ…W…›/Tb~±Y–¯2{t½6€f«x¼Šø[Äp5–i=óx¡]Ðíãƒ×Ñè
o.ò(uGoËCÑY»ï…šƒéîk1µÌ,¦!º„“oÏ;TóÃ÷mU}EžZ€ÊqŒjÜäQd_£FÐâ4˜F7ÁE<gþÀ:uŒ<7êzÄ
jbwêÞÑŠ
šœmkp&ùÊÝà6¬ê ügN'lÊpŠð‚7†@;Y 3—äæö´ £¬újRé¨§9°ð$ÐÊüLé5xFÄ]%6KëÙLI4@BÊ»öª²°Ÿkæ±Õ[ÍŒØÎø ,D@ÙZ5ÆªŠtvüÔ€j0Õ"Ÿõ
*`®g€~3GQ”x£8€¯‡KÊ‰Ìùôc#
šMýý7<Ð´Œc³š)båx)î‚Ísdb8&äºn°6¡µ-[|4^,¢]2=£EôbM­YÕ-e½^-«Åƒt­…J*TµwpÛ¢kËè¶ý¸\u*;+á`Ùp¿lR]ã€	È»6(3úüñË:ŠXÚÒ”
Rºi2,2¸ÐDÖ‚·4%¶¿ò°OÎmëoLŠ&ãe 7+IîX´Šý”Åž¬©MnŠNo|=ÕñÈ×Ó¿U‚ú~4ÿ§v?ôõÌùSá`*ÔmåŒ¥&à¹NñCF©é-4ïþ‡¯¾¢¿·i‚ñm5»­ý u‡èRøªÍ­¯ÚÂŠª-ÛI÷ ñwy"œâÈyÄÚQ^<‰oå÷y¹»›?×±4‚ŸÞ|ŠuJ[Ë¥öQ«ØEÕ¶‡úÔvPü€ý=±*)4ÇÓÊ@Ü†ñ“›Œ\¦I-úîõw‚k[›•>s—Èo!m‡Ñ5‡ÞÞûkG—D*1¸zžv°Yª²2+ê½Ë­ÌøÍ32»clÈæÜhÞn£ ¯•¥<WÄw·.©¿^øò.„Î>Œ‡ç¾k¸€-Ýí¯t{AÎ¬uõêzuƒ@\à;®vC@KG«Mˆi‰‚Š³óÜÆå~L’«qô½>©»Gj¿œC÷ôl_î*jk’éÑh„_îß‡«S* Ðx'âFB¡$¯z78‡-[›6Ú¤Õïƒûr±Œ‹&-Vc‰Wb€œLßE“„6€uõÕh­µw”ß_bu—x/Œø{¼	Ÿ¨û´Ö}VÖËº^ÉÊäAªüØq	Ì…B<¨JÝ A¥Ánp¹Q^÷§ygÏžæñ'éoÔ]3çä˜óX™Y™+ÇâÀ+>2åH œ@¡´ƒEìJ>dâXqþ¾xžp8`¹ô%¿Ê&qíá´ÊÝàt™œð+©^¢mÚóË$¼çaÍÕ_²ï¡kíá¢–DÜ4t³)‘0Î„öh8ŽaR~)¾'C"Ek	®îÒSåy4žòiÜ€ƒÅF“¾€í~˜Æ3QS^ ÈžÒ‚ß0ÚžnÄ»x:L&ê#Ü™`o=¹…©Ép)Jï`‹¯¦Ñ†èòòðš¼½g«‚oÌœÛ²§ 2¾—á8‹ôL§áÇ<ýQ‰¹HåóU™E`ø¶ÓJÎ¶—jðÏ ½¨/ƒRˆä%%×ª{¬Ëå²ÊreÖ+/wök«NyÊ(5›Ú¥i’ÒáÁ¿¼†F8¨²Æe4szØq–l4™v‹Ÿ§§ß¥É8:$êí›(=•¨š¦Q8OÒ¦Ã§áhO¥©­8}u1ZŒ?„@,³­^¿÷Wø
„õ‰ñóãw'GgoÞýþëéÉ».¾D.ðÃWR‡³$…BííÏ oLÑ˜ªä<ß³÷]ÌÝjOº 7Ôa—0ƒÞFÐ	Zò6Ò÷íà\±¡´†£8´'¾ÄØK‚"º0±“ÖÆo§Ú¯$Îˆõü}¥KDñ•òËÓðƒÞmµ8.±^åZqÑˆ[¼'êÓN"ømt¹À[¤Ú¶­ŠÎ!r¡ÈñW/”lJ±b‹X¹ð×lS‘‹çMÂÙÌÈƒÙäá‘~ÒŽåxcò"ï%êTg»-‘‰F¯4Dº>ïÃN³œ#™ò½›L=£TlLþ§O°JKœµœab)°•ŽÈ6„)8£¿/bX7Ý†q¤^Š¿¾’Êç;uŒÿA~E«–ø$¦9,µ‘áMÏ©¤ÓâÒš"‰--ƒnYx2ˆ."—M„áÉ"ÊˆFYDžÌ¢”[qŸXeQC‰¬Ã“Aæá©LöáÉ.ñt_œ+– !ä[Œo=¼Z°Ï2‰ÖF°/a‚s×<	²ðcÄåénðvÝàu4ü@‘*`9M#r§K[Úl$+6Î.Ùæ±JÛ.ã)¹þ+4IÐx¡?tÙÖ5“Êòµ=nÞàé@ -wºRš‘3‘³C]ô‘W¥ß~ë¡Ç;öÏ¢­_5ê©½/¢q$7 †#•–´ª¥z³Ý`E°öh7Í#àS0×A¶`Ü„SÄÔ‡%B²Í¯ãŒ“Èap†¿è-?
eÓd\DÁb:J¦QW+ÚÌyÕ¡¢•ð¡Šõ#qÎµ!ª¼!â6ÏƒÙE§¯~ÕÁâŠc|µKþN“ü›ª‰åÌðˆß­AÛf5P\éþa`4 Éµ¸·™I}{Þë¢I™°íZ ~’ï|TèFU‚·*÷º_ÐOo{¹›óÕ¼·yÝ·ÔaCIÊÞ3”$r-v[fy†µ^8!}¦l’ÓÒ½2C’	5…ÙxÖÈ³Š*8'ßl’“oÑÐ‹ßaß”E…Óë@—ÒK–j¹é<ïWˆ'RF]ôx(^ÀN± Þ2Ž.	*K2ëô7A‡(åÉÔ,É3Î(­²C‚€wnb`PSAïYO±i%q8³òë¬x:[ÌËU{óåŒO¹uˆOœu]PB·[ž™‡rm¹µ‚0\ÅÇQ#ƒWØ=(ëžB¿um–RTÃ­J[ãAÏ`Á®„s×Ö±4P»{ÌªXïJhxëUŽµËÖ;²üŒïîŠº…ROkèô-e9„e\	Y+×`Õ@×b7LœŸÁ—i¥&f·JAåÔáÁ%ˆÑ6û:ÚÖÊ([?Âyá·(ÇP e£Øp—Ï§|ÜŸƒ§æ:ãß?¾Ï!ØD7û½µSAk-Ÿ}T80î°"”HL†	5^ÊYÙ×¥[ ªª°Ÿ,öMðoÇöd1l*ƒw*5iâX£¹]0"»ƒ”b £òí ÃK‘V‘É·ÑëÓván*fF÷R,­‘šÖ;’‚èæC[ï¬ŠõKt#"ƒèZ°¢Ê OL¦qð‚Ø¯Ã)6
²!œ‘‰>¢ÈTArIåwtVdBZ)Pfµ¹ŠYv :?yÈj'`.‚i428yF£‚ƒWiœVÌ°c¤ò?Ã®w§Ã±Fye²4?í}-;XkÏ6X V?˜Œve|,8ëä?·\–çÂ­:Ã‹|kÇO @ï|¹ÈðSåq8Õ`2Èþ·âPWÇÇ°¸Ï+²zµh¯¹#V6_9pEÝ«nðöÝÿ€i°ÝéõúÕùÙ™KQùWËLÅ£—¤D‡s^n@èêiýbJ«X{?F²•áßžÈV#[>Hgh¨ãO²Äšg$K/v¾X’e·’O«&…bÙmon¦QZƒËŠÂµòZéÚñ‹%_~‡þD»y2rÛS”ý)—ß\¯“nóÛð/–ji¼Ô_+ÝRµ=^ÇVÏôgNã:¡
ŠuRªd˜ñÅ’êÉtD5h½!$áxã‰f×C³Ì®g+L…¾Xzõ€eÝË¢1n_Ý¹úÚ{1Jbƒ¦Q5¶¯$>‡‹ˆ„ðÖý€þo“¾õ.æ˜[/ :8û³vao¦ÁOD½Èþp+ho“Òàú—ª\dàÍC-Æ¹á¡ÛŠÄòÃ4
?ó5‰è1è7ÕÀ zJìäæƒkèeÛÍJ‹
Lúb—ò¯sÅ+&¥_ìfs"ìfb8ë-$YÌŽ\œ²_Äéu8y5LŸggk£ÑŒ]E:LT¬›ø%7„Û‚¦¦9bY»uDYÌ½®+ÂNA:Tm²©;‚ ‹‡¼¨~3À,ÍžªrIcªS×9ž¼~d+Ÿ«U^«ø§Åþ´ØWZìÔ¹âaÖ8wÜxZÚnKûõf	¸;ËÓâ~ZÜ+-nÍ=êaVyÁëi¹»-÷#æ˜Ï´€¸¦=€†Óu=ês­çIÖa½èk¥è&èº\Ü—ŠÉ±æj©w”-3ŸsÄ>Z$Ö‡=H¹Cqê©¨‚M1›gD"79IfÑ,}ö"‡Óa4v0Ö(œõ=ç-ª$3™nN¸éìøªhD;è™ba—G»†"Ò‚ðC,ï©…TìÀ˜º©àžï¸È’ÂÛ8Ûo,Å7„Î³ý;ÕÛü¾ø!"@‘:ø°Ÿ¥ ^¦Š[ÌÃP)°8*w:>R0“\TÍ†§b^Áj²³mÆ‘XyöåOÂpoâxdÿp”†W¯ãlMqð´8óG›šA€í–âÂWCs‡JÒ¹;ò;ÏSŒëNüÑá §cj)ÐRg]†‹±Å}Ì]8B0J¿°µ¡A5üÿ¦³…áyàSL²kv&)RvãpÇØ‡Ž¶ª	ªf£*€–sÓÅýX±+zMã	ÕFq$Ó¦L&ÿ\rk`äW´_Œ BÄ+JNWixÁy¬ôèý;~3²$¤ öYÜ’ÌN”ný·{L¹YŽ+…¹ã<»b<kãJÐZod«1*ÏL+ÊŒMÄS`i•®M>aÈÖ…Ùªê6˜®Ÿ9­ž>÷ÿéôfÃŸö‹„|¬(™ä7®œ=êx²†#×‘ÜËG .Dq\ú\X“Wla5:×JñÿsewËìA¦'Koô %¿“S$O¾Î¸…Ú<™/åðT¤ ÷#—“<ï1ý9t„Éoä0íaŸW¡Qˆ\kš<Žåa&¹y)ÎZêÄ¥a¦ºú}º©Ûs¬Áaü]â–¨xºÃ/'§H€6ß¶ˆŠOƒËpDþ?ZPwHuÙ‘zè¯1•j[Dcà¥Rã`æ+hÔÜéØhÆqîE¨gYâíå£}Æ¤©ÕT´'Î¹–óO®[ç—0óÚ´MC¿«ALÓVËŠ§§iË“ÉgûP½
Ÿ‡\µõÝˆxz"‚<)DÀ½“jS ÷•yÀù¯íŽÃ“ëì»Z[óôYN¿6¾aÍ<æm5›kž<dÔõØ`[Š[ÍÛRh=›lQX¥m¶òu9JÃ€üøèÂ,2´oHgÛ½ùóOêÂVh•ç^À“»ž>K†ÂS‘±P×4ß'?NSÓNO£'Ÿ?îÕÂ½èžÖÊŸ°V˜SÜ'X)uÝïôô0ëÄçSwGžÅp÷›çnÞ7<.’Sm)Pr–y@A~—ž\eù*Hª*Ã£ªûÖü|ê±ñú&Â…¢\L†·\M†iàÕÎw~wÔ¢-5w'Lþ¶Åz²q1]|»&}Çªïû£'ŸÝkÎ@zò¾Bñ“þVW>«™
­ËÂHYÃÆ<œ•\z¸#Å="&FÚ³#Ã´:3Ãô/ÂÐ0iLÍßÇÉ”<øÙŸL©ÎéÇŸêfyüÈË§Ê¥O<HIO<HKZÁË”<˜Ñ:ý³Lé‰+­¤Ëöòü26íQƒ>›µª­Óún`¦ä±L×èfJæäó©-¸Ë ÝÏ¼®´¬îfZ„¸{½¾N_£å¾ÀvAYt¾ÍdÔwW3Ç6ËórÓè’f—ú¤™šÌì'#“K0­¯]}º³>Cø`×Å
pú2Äƒ›\xí{ˆ|åà.l›` Ä[½×}&æ	æÂ²—¤ÅÌî~oë÷hîõV¡±Q&àçb:Ä«ž5îýÞæõVýA»N[Ø$1rS`Þkó1Ù‹èvÓ0D&-Kª<ÍÃ¸M˜·h‚2Õ(güA£I<ôzM Ú•[ ¬x#.`3È[@~IÕ“ßuêÆ¢“w­¼pö[*ž=Á
œKß¸÷Û„j³ø,ö#.Pn“¹Kˆ±²²JcŠg±5ƒp–Ô\ùó} ŽPük¥Z˜&Ä
¸Æk¯ûKøFN«ìeî¤7þ’0KÄ ›EÃø2†æÏDWÓ–³ÿã8¹ˆ>»ÙWaîÅï§Ù÷*þ8GÓQ˜~.àÝCƒÅ“‹Š±¡õtræVÜû’Ãà’¾ÑŸßÿ{³õfz•` ëšgXW!9¹‰éÆÚŒsš»PÇóNCX¹xÊòeë»hE[ý†åyƒÑtÃËë’TZåÁ¿cª§ŒÉ z]}ùéÁË_’ùÚ¶R¬?×!ÙŠáñÎû}q>a®‰î
¾›à!’®® G!‚Ýtð6á6ªŠgK&¢ñ_ì¥1ùÌ¼Ïc¡9™ùP-„ˆ€jÔ;pèf_ÃéƒŽp9Ú><zþ«ÕÔc;¶Ý(jªƒZk/áº%zìT6PªË«êGÌ#ÖAÍÞ’Í÷oüM (ì¸Ã=˜’¢ºó]tÆÑéœD®y÷RwÌk°=ßmòO£çú´Ì­TjŽ©±^Y1´^*þ¬YP¨–¢z5Ë:ƒ¼†+ÀÏ
sK…uÒašdÑgN„ÚEöçGe—ŒV	Ãðí'd¨H©ë4òk˜4LJR<±¬]Ä(RÊ“Pa¹zƒƒC¿äà°Uë,\›¼‰æÁÛÍ×ëbøäêÌFÈí Õ*ÚEö6‚NÐ*±UêmlûÀwƒ‚\Óvu“iøÞôˆ®|‚í¤nÿ× ²‚}æÓXbÌ~‚ÿØ!€+çÚoË¼ç«/ês@a‡uì¯b$7JãÑËxL©íüýFwM¯æ×÷Á‹d¸˜@³Ç¤¥¬…öeúƒ.fõÁþ0©ˆÌÛEó3t[nÃ#AsšñÜÌ‰tŒE›ù›{ïIñHbgÐ•uéPý©ó,‡*Ì†ìäTŠ–.7¿Ù0[‰¦™Øp”ˆíøYAÚT=3’edbÒ±,f•ÚFav²³ŽÊ\†ÎnACí#öq_1>Ç;™É-5Ó™\T`Ö™LÆWÎ¦FöNÂ>$w»“p>¼&H½¿ò‡
MbðµxšFW“âÝo	¡”Ù3nò-C¾@Xh¿Žœ¥Ë ‘Íº²Li@?€ÑJ'Y·¹N›8Š®q±4ú\: üÏÓ…†ï¯ÆÄL¹3RyŠ—*ƒáÇKðR²I36ïé8^Æi6Gí‡e3–ËÿÑŠÊYÚ×0ï>6R3§ÙcoÛþ9…có6ÎFeßP¸¹›8Õp (ßß©•­%?µjÝ¿ãY¾±ü8™ÂÜMàÓüGñkmºôà¼gåC¦‹žñ-0ÓˆÏñðâþxÕ(Mfhz—¢Åf>uð¨±óoVâ Ó¡³PQ°Á.”ÅSHÂñþÝ?Hí½6õ‚¿ºß·xÍ½ŽŒ¦RF_”Ñ'%”PL`‹l_Ìê±À™OÁ$¼íÐ:ê¿ºÕÑâÈ{»(%œØæGÝlžÌ`¬gá¹§±ðJö€ÂmøsaYý¤|óÙêÇ¥=B–°Ò‡oYaWÃ~7¨¨ÒÊã”«ÍV.“«D0PAxQzÁ#\‚ü—ß7T™C|¿XSH
Fgïœ¢—LŠZ¿îœ×ûxýÞ!PÃÁúÃS]ŒøœZ½c‰Ü5©À
s…°ÆJ¹8iŸ.ðÃ÷ákkôƒYÔ?¢~SÕ:=Q­^;ÍGÕ-ŽWY£cŠAç#ëV«Î£c*ÒÚ#ë™Ž+æÑ/ë‘õê”8Ô›+ôPxd}Ñ}K=:döƒìùõÐ¨Ð4¸ãpViÇÙ\ÇÃìô
†yú éÐZ®”\ªo²…]³d”$TéíÆ_ÝÿðÕWÃdš!lû}©øöƒÖ]0¤¯ÚüàÖ'°¶|Æ
îwññ./PäÚ¨Ô÷1‰Gy	ðt(¾•ßçåî2¸X|yGžFóE:•Î`ŸþìÅ:¥²JOW«œªjŸ¦>õ)ŠK¥ß©´ÐÏ£”¸ÿŒ£“Û­R™Å²^‰kuÍ‚[i³ÒgÊÙ<ž%\^5íjÓW¥Ndk$¥«Ä-ŠF<¹
²t¸¯d½Âñ<DD|¹ó”D$J#&È.†¦pªœVž¼|ÿºˆÇÈŸµ°)µÂuÕ» ¯«wAƒÆ»üTÎ7v(W‡»Ú§ÖÙ§¹ZMŠÓ¯HeW[Wçr÷k3©¿^¾Ì.ž@Ž¢œEâéØfÄ–éÒˆU6}û+]¿Âw§úš5ZlÏI³¢kTÃí¸jTìš[0 ÓV éHlüüÇ$¹G/ð.^]¤veè%^¶çÜL¿€·ó„dz4á—ûw-,D`l‰ŠbýcÂAþâW^õnp/Z¶6m´I«ß Þ•UÇ…°«qÃþy‰¢ãîNÚ ÖÕW£µvÖÞÑ.½Em]bu—ü	í#y>Q÷i)¬û¬¬—u'¼’…ÉƒTù±ã(b|â|ñZê©%=€÷r£¼îO3òÎ÷;˜|ÇÀRÍG«ŠC‰äHŽJä:Îq”±	’šÆŸˆóû	œ‚ý½È¢”ýÉ§ù%ï~Ðl¶É»p8Ä³vö6\†0%û0ê›wÑ0Š?j/?&‹á5š™æ"`™ËQ¸Vlù«a8™É¿gÑ|¾<³kòì+rÞS{,Žr¥ÐyrÓFÀvþËÇ…~ÁßÂaagÑ~u ÙnpºÌ@zùµdøwƒŒ˜ä‡Þ©Oì#*}›?ÔÇ>úþijøâD}¤Œ<¼>†ÿk¯Ä$Àë·üoœ‰ÝPê<¿LÒÉ‹p¶ñªå%ûñ&F5X9ÜcH4 +eÿ
G£4Ê2ú#š„ñ˜þ9»N¦ì”óé_ótJÿ¦œ1pÈIN8±ÿ 7&f×ùmùn_iÌ%äŒôL§áÇ<ýQ‰ÝçóU™ETÁ¶‚ú$gÛ£Tü3Àûªzk¥"Ý„5ˆzÍÍ+Å²gåÒ‹7SÑÊÏÒskRd¾p”1+,+müÒ4IéØá_ãÆ×ðÉå%Þ¶´m3¾ujûªÒ\k1ÑÍá¾d¢õ^é‰0k9…EÍÎhOÒÃ.€e°Kd‡Ýâg°§ÒïÒdÌ\¡n¢Vi„]C„X)á<I›Ÿ†£I<•>$«‘½º-ÆB ëÙV¯ßû+|…²ñóãw'GgoÞýþëéÉ».¾ÄåÎŸv8KRØŠ9+§ÝýD»Â”0ýÛ¹Eàó÷]Ìßj³¹ Ÿ·Â.U[2³éùkœˆ¼Œ¥AÜBÎ¥IH%Rœ÷.PÚ¤µ±Á›ªõ-'ZÓßÀ…¡t¹ y.~Ð»®•ÇÅP&aå>Z13‹Èq*“ìjuhp>^À!³E¦IGJYx])•…Üü°vaâ$+•˜‹‡0Ã“ˆÈ÷ØÁ‚4…/:£*¦ÕÖ°Ñ•Ç	HYîjþS4VZÛQi3Ô–æV#³+`U·³8]ž2-!)«‚ÉF4ä`h)*VëD6O`Ÿ‡ï§ö9©Ôùq4"l9ôÔ7a:E¾I^ˆ7¤ú.lñ'áðZÌŠJv¸*È´²—X«Î9óöÑoäêY‹R:Í9Š//_„KŒŸÃùu$¢q«E3vaxÏâ	2´‚üÉF°´ú½^/øK°#þlojÂ®ˆzö£°ñúöÛâÇlëZŽý yØPêyîR˜
Ÿ•¬’Ñç]@n‹vƒ?¾¹cïïƒúÇevœ€@Úd1¤8"Íô¸ø“à®I‡%¬‘O·­FöžÕˆ_ž&ÉT­×—Mn «·f¶–”µBA%Avƒ©³åt1<; ¼Eþ•`Ò…½œˆ­Y°8Œˆ°„iÍüûG»Û0r}»Çô•T>—$©iéò+Zµ$ašÃºPÞ„ñœPZ¼SZS$™û“ÈÙJÿ˜é¬,à’á ±¸'uš²C•mð_Bs€îçI…#Áå‚·ãˆØ{_GÃÔ8Hc
’^pâ$IâQazŠd*¤øWiÛe<Çc}¨åù*ôÇJ£LâÏé¸Ú|"Q5Ò¥sšÒŒbç7ì‚žeóº*öZÕ}°/xUÐY{^Dˆø˜7 ñ³®VµtWoO¬ÖžF[}{‹&;Èì›pŠ[Z0¢Ùæ×qÆiä08Ã_!%	§É<¸ˆÐmèº«mf#êPÑJøPÅº¾(_ä%CôVÒ¯³qŽìóÄŽ&°wƒwt Ka™á”>ïýtöóëWˆ¡}2ŽPò8°ŠPƒÀb¾¤²Óyï½Êæ¿¦:aaÑBà€@‰÷b”)Þ‘ª$ŠOºÉTíRôqnJZê,ÜmlÜÇ9k=¢l1žcTVJ0&ùÇ	9‘Nè”ðG¯&pöiÑ’µiÁ^r²¶N­º
T0e~Rå:«»§;}±l™÷Bæä@Âp´£Æ’­4u_süßQ†…ÿúî5Õí«tWi ÀAŸ³‹N_÷G4ÞÍ‰öñÕ.ù;MnðozgãÕ}š‰Ù¨á
ÄÖ›[¤ëU¡Õ+ƒ_²îÒÎ{ÝA4)³_µ]án×^DoÒ+ààÿ FôŽËÖÜÇ’Ûµë~áÆpÛË`šs— ²áà¿ÜÛ¼î[*³¹=ÓÝƒÈÍùí¸däh—é}±Èâ)z€’Ãœˆ’ËËx	\KxBE¬t²!°ôxÄ¿5;¼=U,ãXIƒ*‰g“œÄ„¶ÍÍT€øoJ¯ù,‘Xx~¨å¦ó¼\¡§LR‘=üÊ¶=ü
£SýV™TÙ!Á	:71lžSÙ¥ô¥!~Käú¬ÜaÎ!¶á€Õ”{*A&y×…
&Iƒ?y;-/ŠÅLÈÞåÞºZU©§7(/ÉmbŒ‰³”:ýnUÆœHn½î×«Ð½4l»·¾ªp J «SƒµË%”!ûVbÁ8»k=9¤™j6¼²M‹)EvY¶šàqnÃ`ŽRX6¥-ñw¡,kw±Œ˜ÍöÓ]Qõ\:ÁÖ([
CtÀ'_Lä«æØéC*,dßÈræ,š§¾mUÏn;;””¯ïJë:*õhôø¬g]¿šQÍ³•IóÇ4žý¥ó
´GîÉ“|µÊ¬+®¼1ãß?¾¿Íçž7q³ß[;¼/2Ûì£¦ŽIŸ+R@‰€l˜P£eE‘•ÝñKa‹Km•³ªÅ¤þíØ½S-¶Ôeþ¨¥VÔL!7EÉdÇª@ôRÄ³€Ÿ¿vŠ¤P÷@æîºbT—ÆÁ;†‰üÝpZ«€@0»ƒÞ™4—ºJfHµù3-G%´KQ"8puý,_¥{3QpúíÇìº  ï8zÍV{¦‚£¹àíaW9ŽÓá8ò=tç½¯e-mÙœ–Aüy2Ú•Ýhá¼˜ÿÜ±ªGlÅW©ID>³Ó’02öpXJsÝì—Z^½c˜?c@>ÇÃ‘,t›én•O£ºñÊ5ê^uƒ£¾C6vUn¡îí\Zª\¤W=êyŒ5•ïýœÈÿ\J•=ÁŸ(U¡Ô×ÑHê'¨V£ãTƒf©;Íºi–^J~q4ûu 1Î	Þ¾>Q-O
Õ—¬áü?r#£Iº%÷Ûë'\vmþÅQî1úõ‰ryR(÷Ûï¿ëÐÒþ`+Ø~¶ó]²%¶ë'[fâñÅ‘ízétD-_žÈ–'…l_bãß^/3¢ØccUƒv™}Ñú©W.}qô{öî— õÛÑã»_³«çdšÔ:œAãn¥Tƒ”çétýdLLê	£¦"Ç=AE…øU¦¡ e®•¼ß&éXÎqnblK-Z¯Žß¶ƒá$œ¶ƒ—gG zÍ‡]Ç€Ó(üóÖ@Mâu®ƒ`OèêœÝ¾÷]'DÇÝ02 ×7Ð´ËH¹!]F—QM‰•ÆU<FÔ½'¸†§xù^Cã!Í,¢Ñ4@ý!Û§~¢ÕU¦‹õ1³Ö—†Šs3”Úv ë3š­TÙ©ˆ·LÔ(MØˆ	S8F³ù~#F»¿Í¿8æÒHH·Èl1«KG4w“í ûá‘zÁp‘fIÚ™%1Ãñé÷ªáÒ`Í]Íá€yzgTehÂ™–bG˜UÝA:0ÅfÎo™¹,ÎSõ¨8 }U’3*‚Aã¼HŸk˜èàÿ‘†Õ¶] E‰˜øPR³€¿QšMñooÆÑMCmÙÒêAÞ8Žáj05fGƒ’›zŸ§^Þ±kùAW¹|–ŽõOä¸"Ücãà8„Íqìg¿ )œYôV=ç­ª®1]”N8¯ÔË^(csPˆ0ñ]¯`> £¿h”_®®pWoyeG”Ó±°÷|ñ"÷oãl¿±4ìDÈöï4Ï<ƒ<€ˆ"¤>Gìg)¼™×íß»ýS
,Ë]Á•@eäVí(ú˜ÇYŽaß#™xÆÊ³/ÜÑ2‡ ‰GöGixõïã§8z_«Æƒ±šèÛv‹±¥!Ö^nøDi>7‚P~çy…¥@6»@H@:ÛâGÑe¸[ÌZÝÙ%Ðþ°Ç¬q+ÙÂp[c,ÂÈ;“±Ü:–µcìC§X†D®`ÈÎM#„RŽ†ÈG÷O¡³\—‘'•GÓŠr=Dbž*	Ú/Üaz”’ÓU^p&,=º BŠ'ÆS§ˆyRØ·ÌÆÝný·[þ[¯ð<!åsƒD¶Ü0´ÃÂ
B[¼™ˆÏ]Ñ›ˆ§ÀÒÖy('øC¥Ï¢œÜ`•†¯"QiŠ#±¸FnrûÌ‰ßôQâ¬u^ògfe¦ µ‰Â=œ™jG…Õ’0f¶ÕÅ¾Ô5†UõÌÛeAOóx>†®(-66n™=ÝÉ²–9›ÈïEÈ×<¿P›ç–P'Ò¦"…æ^Ç¹ÄY#ˆå¿òÄI8K{â7¯˜öHe+P®(È‹‚E®5‘–ìªþ)HËhMk!,ÅÈÖHVÜòö!‰JóÁh²:KÃìÚÛ­ÖX”7aU…HãÉ:ÜUåºGýF ³ruƒÂ¶Üíms`ƒËpDþ?Z¤Äç¶"¼¢R¾‡R“ñm«ð´êc3+wÉÊYå…š;+wd²å³{ªF…Xø²‹.™M¾¬(C(°˜úºÕå*v|	3¯MÛ”‡z˜i³X»>MÛŠÓFánÞlÆžO·"§•mIkÏ>±i|ÀÙ·ÙL>ÍþJ³¯šdÖž}fø€óo·:üÂ) žŽâ«D‚ˆA;½zÄ ì©['S¹±cmÚ˜§Ó¤³ßziÂÝ€§u“·	†l~Ì¡h¹öœ®Õ#;Ajº–1sÁú‚|ÁpíAäùRÛµõ’”ÍØb€ögUVÍJIVë?ð^¯¯Ó×èQSì”Ð!èc€áÐfN1×‰—4Û)®bNÅ´4“‘É:£qp~Œüº³¾Ç˜V+Ð—)ÀÓ…S€'Q¬1‚R1r“mnä¸P|ž`.ÖèI4w5xø¹˜á€-9ÝiÓ¹‰×•€iüï†ÓVc2¦!¡é\<·Ñ2>ÙšèîÓhë`Ø¢¡‡]rQm+_«ó‡]b:î§þõ%€õÞB’O-š¾-Œ•F¦Ál:LÌç•¶trR(Rqâ [ºÎ[µQ!WóVCJq³¹íªÈ,k!½™»Qn*—³öÕ‘*Qf‰çÇa:Ò€½ºh:ÿz+¿I±îô£d+ƒA¬ÛC3‡þ¾nÈ\håLê Å}NýVbuU§•\`U­>­‘ÑG¨n£jÌŸgk®z××†È¶ö
:µÖÚ¢ŸA×µÊêÌC´Çâþž+1I¨Æ1˜¥ÉGX£¦¿üá×ê‰™Kô€ŸÛ´çÚK˜vyð4ñ^Å[,ÉÛä­	|1™áÉÇ¨Àà??	U+} “"nªŸóä WÚZõ
ÁÅ8¼xX:*ñS­- ÌÒÈJ6&)„g©ìY;7i8.Ò(üÐ!~œ¢õhšÑèUå0ª/³|•Änj(º5pŒp[•L´æo†³·	=4BÓè½‹†8þ<®/ëhîc!BOb˜dú×½»`íS"ñ)ØKû¥ñÜ«q«ê¯‡èTj‡®‚[ïÒ0Ý•„¥ÍÆñ0jõÚÁQË‚\ùqD¥íÄ‘æ’Fµ½W·)jð,éÙüðõÉ}8¯œfÌlŽîíbh2Ú~Q0¹·¥za\r/F¹\æÅØP©žy˜œü-Ô6-L@û«µÔŸ#’æÕSlÔ¨®lñŒ£éÕü:8¶ü…žôåþ@‹d‹ÂA/­9Sùù[‡!ì[µõ
¤i5	ÂW1º&Y¹lÌÊÐC‚ÉØë&§ê¸D°ÇÕûžÙêØEÛBò¨À5¼A0©NÌÛÅ«æ¢Ñ½v×WiEo¾ë±R„f m“sm²‰sï=É~Ýª)â´r4{Úƒ\0>.ÀÞ¦ìÉ\üÆ´mÜ¦+EÃêž}?*8dr$j?±DTwBƒŒLLªá¬RÛ(Ì®á¦û)×<ÕGoàþ@wôœÜÒË8¢–H¦+IØHÝ×KgYŽ÷rH$^.ú®æA|.q¬š ˆQ]œ2(wTv”ÐJ)¶»-~Õ¶¿j^¹Yh]9K—A8"¢t†Dµ¢Àx¥“¬KúsJœ•/ðË‘øì2N1úkÙ-í£!´•©Y4¢9gªÆd9aåœ²{\6)êÄVDq<†³9)”ÃáT|³,‚Q¡ÇœøXØo-Ñ'Ø[!{üœŒÂ±y&…–¡X¸¹'8ÝI•‹ÔhÇ’¿ Ä0—Çû„OóÅ¯5Ž¥ã~ˆž)~«#G¿õ7¥tß¡S]jKF/Î³wÑ0Š?†c(­ø¬<ïÛp©fdÌ¹>&‹áu”fÐSö—ù»Vär.Ona®2„KÑŸX"”„“|LþgþbÍçËcØ÷ïÄŸþTKñ›,“ÿN [9ý±	Æqê•xRcÈ’ÕS¦8¢k9ûÙøá+öIÃ£ÍçÑt„–phpGû»˜xÑd6N–QÔp…¶¯$NBU”m±ˆÛ¼cmy½÷,B³ˆæJk‹³—ñm4:Ç!	×Î+éÎ£pB$¬&3é†Íðò²‰g)Ã7¯P‚šBKÏàQó©‚óŒØé´É&Dþ|Õ,²D{yoéK4÷ ¥ôî°›±·ÿZj“É÷°[ë%uß¾;9=ùåŒÇb%ÿln?Eãž&’`¦xÊˆ'‹V+5›¼ÃÀò¿sM˜ üîtžZb!“(¼ìi½ÙTÃô²÷Ýx:/FQÖjž5!Ë‹ñÁófXßhÒÈk+†¬g¡ŠÓ>?%­mºWÑü'`²ÖÆFwŽˆpÓ´ƒf¯i-bOõ2~Ž§‹yäX
‡?¾¹ƒÆÜï~s‡Þÿ¡ÞåqÄM‘}CI2}Uü‹}ÊÆE¢3ugŽ‡"y¼'|)IÄRò#YÌI)‰r<
0ùGØ%C-H’­À ¼¢e‘<ûÆ8öA“Š^M1‡Þk¶2É;è”§R£Z”R’!f²¡Ú7‹¹©^i‹/Hy¤’Ý¼im3w¤Åï:4›·¤PÎ½m¶ó¢ä­zþ·$ý “¼¢gŠ?}OjC~FF$ºÒÍfãxÞjî6éõ óR00Oæáøgº2~ç×]rZla{þìôŒypL¤l-hù8ø[ÿŠB7‚ZƒíÒ¢~Ê×$iÀå8IÒ–RÇ&f¯Z¢¢ÀŸó•RþK©(„“Œ<rR €íF€ÕÝÿ!Ïð½ÊEUÈL*Ë“ü5ì>xæ¸„#ÇÈ¼*èÄ4"òÚköžïözÍ‡"„çœžÀX~©¤fÿ;|ÂósÏgNaÄkæ!ï#8'‘OŽóßŠB7üƒ–\x7–9®\ ãiy‰ìAu‘¬‹JÎ%Z%eþ”ÿVŠœŽUœ4–XŸžƒìÔÛPû‘ÐJHuoèß.U¡ ·M’ð_µØi2§Ã‚ÆÆáÐ
ÄÔAG-(ÎN“˜ á´©äž?æ‘ÿä m&aÆ”²h+$R³Kz4¶ík>kœv¥MÇºáTî6|"`Éö¼¬¦ÊÌâq"c|yÉ™áŒß`¡AGßŠ¤b°£"÷L¦Æ^Å»o÷Æ¯LKZëás?‘l*YÙ8éáå8	ç-ž§;Oñ¶œ`%ñîXHv×ÉM0A…¡ý`~-ƒ0‚XxÔŒB6á Žuà»1i
„sryç-“§nMúxàìœ‚‡"ëÄ*ÝÊD1_%Ó–Â«Ù©(u«L¢•«}{D°:ÍÑ
Ð·!]ö¾ok¼Tãƒì¨Þ{uQÒc4úKA×Ãl9…è¯iY|­åÍÒx œ¿.ž©Â›0ž‹CsQó ¹1pÝÂ[zÐ.Žëiá…`¨…7”'+L¿ð¶("9Ððzi’€ë¹iÝ5°™—«Pµ *91}EKzœ	1ø§I®KÆQ—¼dŸÈy¡F\ÐZ.DøÖ òÄ	®Ý™$%„)©YT:jP%v>\õÀôÇ0¥e²²ûã&œ"‡†$#0® ™ÙÁ3¸LÒà›;AŸN¨ßÜ	Í ’ç0Ë×	Â>ã#&ÛmÜþ¡¶ÁÜ%Û˜iËŠ'³Ê‚¯.3eUÑEDCñ–ièZ†×åÂ“J(û†f·|hwí@'£¼&39Ù†H'+QŽ……jÛürB*XÉá²
¸é'B$_„Ã£4™u.Æ‹ý +meþABŽ öòv#¿4bÃ®yç•ÆÏ¶ÄÎ&¨ãðW÷{ÛFÛB›å-	¦]
+½E®m™1¢ÂÞÈÈ¨ã«‚1zÃKKS±©Ùìù÷½×Ww1|Äª„´y2{³^Øƒ–¦J6À¦êŸÏ¸¢™ƒt[Žuu­=Ý,;ŸyÄ)!Ð¼×ŸW›”>»MÏÁ¼mA,*I—Ü>Þ·ù¤zoÎQgi‚Æ‹¯0(‰\›0z4–Áp{5Ž]„t¸Ö {¡ùµ'Ò·	P×r¿1M:üQ¥i‰›u¤Ò®îð:Læ ò•—¼RXˆ²V›LÓœ[4è|ê8WùV;{¶W›làdi7OT_³(¹ÃNí.nMŽ®NVz²I3šv~=m¶ƒ;<›íÍéb¥ñžL Q×ðdœL¯àç„#é½˜Fõ ”’­õ¥ý…IÁ7U•Ãoåft*«AÕH=C×½ÿR¹òå7£f›U…ûÒ´ui¾%÷lnlî^</¶[qX"Ó×I5Õž÷ºÜ„Ð¶Šz•Rð®0kžFchl@Ï>ÄP(—ðùSAVD¸ÓR‹C2²‰xdÛ!žÎÝ²t—¥q”µ^ŸüxòËª8jÃ‰tò^¿¶§‚pjOl8|‰‰xR8;iæMU­–“¸…nepô)œd-‘b2ˆ£æ¤‚kx´Tuß/•…ÐÐCAÒõaÌ7yæ$i2_çÃ ¡ =0"ÔÔv "Nmö{ŽÑáò´+ê* ôòc”«•°“1µ«Ý¯¶è		9v­ÅsŠU+½|—€¥^wånBå
×Îø˜½»âÿh–å%²Ð„ÁÀ¸[ë»šO—²»R":ˆ-Ïðö®¨€³1¾ujçaveG2i64ç‚©€š.ÝUü¶ãüHV²³øoLGO/g¸N?q	Jï!åöU·ÀA6´7O•:2Ì³rÉ›Ü/v^Mç²Vx!RÒžx©çÌ~9Ö^®köØ×¶šQ›<éN¶¥bè9;´TD–£iæ®gùÞ@»–Ä—5ðDÃª˜Ïe§©ôqb¶”hß,æ•jÙýÅÊdËÊy¢[=UÒmuˆkÐ:'¼ËØ¿à8¹Å7±a<^ÊVæHë¶n¹­Õc‚kaŠB8Ž.‰G2ëô7A‡L*™â%yÀb½Éý}æìñ\gqRßå)]‹®²:åËmÉÌ@[§Ô‚e…Õ:FÏ®YJ×ìöÖì@_´¦€òá¸›¥ `×ŽÐëœkO}¾o÷ƒm×Ï³y4ƒÒ»ÏÖÂ‚0Žb¹Ðp%ëEUáŒF˜§Ä!¨Fµq@EYJnŽÚYGþh{Y¢LÓ0X–rù¸¯ê,àm‰–¿BÇ¾z¥žàÂo˜9š^ý®Ä|kÃMø°ÞŒ—±]f¾âÆ
M—2S5Ñ:òX'«ÁRåL–:0ûh:_›ÕD¥ï]™kÖêÃXÙjyU]ä•ê/Ø7 ±i°¼‹&aúÁ‘8®*vÎ€f9¬'¶–Ðà«šÞM‹;â–°Ÿ">ƒõ¢Æ™a‰á˜ØÌu»ÝòìeNóe¤•ðmg’»,—l·±ÅìÊ”O•>ßâ2D¶U+‰égèÅ4Ú¿“¨‰!³b|íÍ(iG“mExC¢Ù·Xw(·œEµt±üîBti—™añŒÅÜ’Á¼ÉMd2‹*A)qÝW°ÊN¤h&C÷|}Ù±¡CÚàD$†SAYç‘ ³YETçj+š±ËŒ@tÉš#–Mvã)8 ¶‘eâp¹bÞw] iq­UAo»œ–CNb»2œDéç¶!ÔÏ.xnÇ¦kX¦»ÆO½T¨nÂˆ¦,uˆ×¾L\¨÷;ŽÓá82tÁI¤'Fð’EC"¨ÕjÀ_Ø–—aÿÛÛÌ­?ó76öÓ³£³_O?>yýú÷¿þ¸Ðe»×0gŸ`ŸÝÜŸÛìÉßïMX
Ñ$JÃ1¹ËÚfk‰?zÞ“€¨øCŒ °Ók¶-…ýU*›²VQ.þTÊd¡|ËÊûÛÉÉþþæåKV¢l•)‰;J©BØüÎ^îÛ_ÿúúÕñï?½yýêÅÑ³Ò?ÆÉ8šËMfO”òÙ³Š†Ÿ¾:þÏß_ŸývÂ
OR9åÂÙ¥pö¬j”ùå×£×JñâFr[±S
Ïc@””ýë/o^½PÊN“Li8ù­Î$>©(øäç“w?žürüßJÙÀ9>Èe“ßJÙä‰(;_Eõ¼	Ì4 ÎÞÌ¢)ó¾¨äWFlŒ¢Ñ	³í{5âÎ#ÜÚÿæðX'â¹RÀÏh:'ªx\åÍaO°õ¯,øçhkÇðÐM)–;¢uLŽh° \f¯¦äkº@*µô6W€</ä…LGi.»—i2q£Ð_»J¹÷í õ{;ˆIããàÛ ¯yPÒÓÖˆ³à™ø©ø 6yßšÁ?ƒ&lˆÍƒVþLu@„ê©ðD˜UZîí¡Z:ˆ“ÕCþº‰¢Øò#›EÃø2b¥ø©Z_†Þ·P>‡Ñ ?GÇ¾š¦˜~BþT>–FO«‡u÷o¬i´>í¡ÁôüýAë¼ßí`«l·ƒ÷? SÞ(ºãy´ ¶ÎÙõ¢ûÛ|ÃT'42{gs¥NþÐVç{Ý£âÈAËê¨§¯îsÍ¥Vö¥ŽµòcÞî³MÂp“,]²ÐtYS[ Š…%¿YòÃè3+eš¥ÉØ“LoÙ%Ó÷°'ŽÄa“¸mðÚ++ü¥oÃcýOwüQV·²0ýµ,ú‚'ùÈ_èåhdË”‡Fæ(ŠÏ„O0:9)ÓÀ×>Ò6ã¹¨ëŽê‰È(MâÐ<.›Ð‚âgýü3XaÖÏùgg‹(³~·•÷·h4-ùr[*ñ(Øúá³üÃ—ilýlGê/¬ÂTþð½2v”‹ý†/gðŽ(çä¢žÃ|ãìÒ-³ÕŠò=ÏDh¥ÝÕ6r‡ˆÝâž«´ïJe_<}¡-'«Q(£!$f†¹0ºÕ˜Q1ÈŽÂq+&ñ´•o1tï0"EÀ+‘'¼­Ê#5œùbì³üû¿Ã¯½}Ì_Xpå»gÉp)µZ1•ÐeÜ,›\_ºÛ´T‰¾_æ4ƒ¥R±fÙÚÐ
¸÷ìª,]ÕwÐ.âŸµZa;¸ „B?.Œu²Îß›°4èªb$¬uËä¾}4›—¥þÛÚÒ-ååáöÇVƒÄMâK÷”8Á^Í.™E4°p·a$?ÛPç½siÅÛq„´þ $ñD9e zÍJ;±îb+&#2 àv…AüKPè’âÏ·móV-Õ ölL!Á>çõKPEÇ_‰c“Y\êÍåüÿ  ÿÿì}ÛVI¶àûùŠ,M’h#øB³0à*Vc` wuÇ$R‚²-)Õ™’âh­yž×ù€Yk>m¾`>abÇ-ãž‘)íjÇêv‰ÌˆÈ¸ì½cÇ¾Zõò&0—g/A]¥çâÇ{éj2kþxÏ¢–éñkÔdr¯è*3Žzlyz¿‹±V6ÕèS¦Ÿ{÷-WÁ½»g×ÒUÏ.ØB›ÎØÖ÷”™¶KNÉØ+°‰ÚkäqìUÐu;ôWHþ‚Ù“úÙ]6‰†u{<”a‘šûÀ,;jÐ`¬i±1çÉsjŠMmXªveó1—½å)×ãŠ©P#«D®ÁUƒ¸Øâ$O(äq®ïMq0OB3LÑ6!Z¼lÑÁ§bHÂƒÙ…wØBM¾õ¦èÒaVÞ£ž+(u¯zðôðªNêéB¿ñè>ôÙ][ó¢µ¯Ó‹^‰Êoô¤¸48],}Ïn®þ!ß¹Ž.áÅ†²± †ñv¸úÆþ»Uˆä™®!!”éáÿ"|Àd¦(<¼Íšõ¢Ô÷áì®X{vJ…ëcÈãœë(ùnÖ^yžÏ÷-ÑèVRáx}z=:øRSºÅ¢—u~‰FÓÜ±öbJ†â¯½Ú¿ºS¬#ä–IÉJÅGDI±¾ou†¤Zö¸ ¡¬.f#²ÐÏ($×z(š¬ì%p²¢%`†Ó³à&!bÑr¬¢#¾7‚Èt(“sI…§µò´d@ˆ—F2­“Ó‡O¾®(o99Xó±~É&wLÓoâ½“Û`’¸å‚•ü:Žè<9…¥%t+@+2û÷‹"Õ"¼òëP‚Yq+Ûéÿ-JiÃ,Ä½:ïšø½<ÛY@œ«LÂž@{¦ü<ujÁ$[	Æ"“pYièÔâ¢=}õ]A3ä4 V“˜":Úî³NÃÔ¤íVMÏ‹”ß„Jšïì“c/û
©C6˜9NžE$—¿"RŒát0‰›LòüDÀeh!®YÏÃQ”L³Á•¶¹ Ï/R1K¬=T„b()dbÊh…ðjœnúSh#à…ÌálC‹	Aù@PØ f°ÙÞXß.}°ÀÝýÊ_"«ré/‘J¡«Ç_V,†ÿ7t{›¤ÚÎ*ÆÜnÐ'0wž¿õc„8Öþ¶ôlX½Ü]Ýq#ü#8#XR¹øLË-­ªê|¼Œg•ô7fOãYïè8ª‹håE¯D¦¼á:ÒRê[.öC; –\ã$Æ· ¿hV­‰Wk(j4‡§J4‡55Ð‘65xƒ¥Aåv»šÒfoÅÃ*€Ë0Õ"ÃšG
–Ñˆßà›! x¤Í8†ø9p†Y`+ô|ƒzæ‚t=M†< ÛÁ Î&>ßñ£ð04ÅïX¥öÕ%T‡5ùæ±ü«ÂZM%¬à,×a-iw@}Ž³aë
ˆí¯®ƒ·Å—&+³¶‡¸e®Ï,Í ¹”ÇfÐvû	H8°21®˜_{@þÌæ«è2vßxÑz™éý—ù² Dþ ¯°ŠF&½È3Ñ]áÙ½ÇÜ‚·¨ qA”4¨ÄboÉ«)žj tJæåÕŽM²ŸÁñhàÒôˆ…­X£ÐŸdÔ…­gf-XXê-¦P‡Pø&Å?lLqo%‚²•ËF³KÄ*{v³¢Ÿáª9%SÿqTŽ¼;d;†àèÖ-\³Åóý}»mÈlÍq¹}6*á¬pSª8Ê¯‹téð}.{ªä‚òßÙ¾³±ª;€SE‹2\Àñ„ÿg÷Œ¼½€ûà×½æ‚ƒ®X¦EQQî]f`ée•SIÜA1¸ Àéª
S³,qÝ¤Ë1þÑ„Güã;¾3Û ‰–gæxñÂ™³ûƒ>}†¤F¤ªD,#ì»ä’Ôu˜™ÛùÓ@“13ŸÏŠ®QBœØ=?o±òI+ïŒ=TI	TÎÈ8<dGü#÷KVÈë¢é6ôÎ	›–;Y^&Ø‰™œ«½ÛÙÞì08è¿/WHÿñøîx=Ôyà”gŽø/‹zû£Þc!±níˆÆw¤Ëw¤kÛ5¸«˜Cûbar¤Çâ¸öå‘øoª‚ÎrbÜË¯‹èž@Ì¹ç ˆD´w“¢Û²Ï-žï—è B®é7½’Ñ®Ù5“Iu·æê7=J‰|`—¼w²RöþÉ
F]6HbÉJµ;)+sÄÏØœó½°™5ûƒG^cœFŸahð_æô€|ÆRùî–Ø^±XÅ-bÌï[­ü^æÃüPu˜¥[y‡qÏËbVjìnâ–úC³K(%K 4·¤H•œVTÞi"a`láPI|Âir!+DØ …V4JJ„R’VJ0kPÊ['	c^Ž¶zË XñÄ³âü*_ˆ}á2íGg_ÖQœQ%¯—Ö¯Y›ää‹ FO¦c	Uâ¬ìEÔ
Dáþ!ö-Ó*ÃáN*ðÕ~] ­ú¤c7ú’ÄÀµ¦€Ã„^h¦pM¹r"Zåê¥e¢ìñÎ`à¿c¥)ÒW·Çï?<Èãh$Œë<ÞþÒd¥¶½¾—¨jw-E…úŒXK€å7±1l¯Å¹b8N½%V¹¢±¸›wÙÍ‡K0¿\‘ˆ81sodbF÷5_ô¼ƒ{çåOzÃãt¨à†×û®vÚ`ó«]ïO§EÜ±†/t´]û¾ñ+ßÓUåÎ÷Ô¨T¾ÍæºïqŠW¹|Ü4\~W¥!ßäH¦j@¸9†O¦àweW9ÎÊÃ_YK’ìoÿ®êhe|öpZžÈêÞ_“qœ”ó1Ìã†½’Y0ó`â¡ÿ5ºC<S4	K¤Ä4Zs‰YÏ_ƒ!Ì#[s•ã.„l¼såê$¸³¼¿Á6ª°nJR™Õ
ÜŽ®t'•Y9eðÏË~×»v	Öl.ë=‡Y¾Ù@Ïa„O’«*,×<éSç·à+0Æ§Zz5êFE;>«}¾îv#»ø~A>UÜY†nšÏ‚>ú¿À§òôªñô9¿[Dà"ÙZK,b9¶íž~£Œmo™/®_œàUµ<A`Äâ`ßdHê
-›×õqm2¯¬Üàn2êÅ$¥Åàþ ÄdQÁOÏadãï}¢G9µ#~¹QƒŠ
“Å«IÜžð¼VØnkæoâÖyÜA<ÍÖH.¯H	ž¼Z@^¡{Z\7¼Ýºï¬ûU®š¯¯([ß‚H}¦s©	WùZ‘FNÒömH¾5ñ0GÖ5é:ñu¥zÔ›¹>Ù_˜iÊ± ' ++ßqáÏcËwè<VØ¼`BsHwŠ1SÈ«æ¬'¥‹Z×-4Ôëé Lƒ½éjÉ–š&ïîÒ;KÛb2´ñJñ›rçÏbÙÜÀUíÑ°Ë‚UE/º‚³éAÕ7bx¬ð›"kºI‘|¢½˜¬Sœ!›À"nÕèA®îÍÇcÚ„8R~ÔÛôòàöòQÏ]þÝ÷F œÕÜÑ¾Ñ“JÚ^sTb7ôM¯dÐ±RûæÈÑ7ž€åÀâ6–xãõù÷T(ýo§=¥ÇV¼:‡ sypoˆDþÏi„nÚÕ¶S´òÚXli+Ñ¨ÁJXBYH_u5ÅŸ±øfµÝs§Ø|jÊ]jØ{»ÌR`Å_ÝKñÖ‹Ó:a?]‰èÍZSÎ´ÉOùBÎ[×k&ŠŽÙ®Ñ]ÎÇÍ» Ÿ2Û˜ye|\Ôê)|òBº2@ˆK:ßÍÝ6Wµþ”³Aæ¶¥6Íì•tQQmP‰5"5Z>Éö†r¹÷ßBn9H	NŠX2?)	¯IÁuKÂÝÜ©ÏÑõ;ëGÑäoqtCR¿		ÜB!›’°-!é¹Èc‡¼_Ö¸%£=Ôl‰ÏºÉ‘åúGçÕh7]Åé0ÿÀAÚü‚DE¿&ÈÌó6…×ÑÂÊÚòÁÅ^NœÊŽd¯ÃÚå‡Eé¤¾Õ¤rÂ2ô±nÿ<"+;9ãJs¯+yÜ&ˆ€þ¶ã#IéLoI¾‚ÿÄÉ¤^5à_%çhF×»Ñ`@¿åKÝ#<èm,'àûkæè?Îv“ñºóÒ³¢³ƒá8I'j'ÊÓânNÐ`''iô¡•Ðú¸ £n8" /ælÑôˆÕÆYÌÞvËPQÎªfL&˜F
Ï›*¥²£=^NŸX
¿×ä·1IœjaÁÆ(ÁZJGùw0úÞ"õcÞ m‡gÖ=RŠð34„%®V<U‹ðm!Q‹òwÚlÎ!Ò|Þ*_³äKâãVWFKŒD§3Ó·FOÿøZ}ªd—DSDB
HÈ.Ižzó=¾|¯öó›¯ùŸß7ènþaÏ4i¦Ç9åýÚÎýg$.Ü¥`[Ý‘`Sm~H5H§KÚ;wÈVFH‘^‹I7ñXxšM1ñÜ^r3$hº!ÚÖèä¬Ð“.Ò¼‡¸
šBˆªDêuîºÌIÐ(¦Ä¦¢èÏœ3nè¶vuYÁ.:ê›8ÁÙàäS†èƒy¸ÙÐ<¯•©¬}Ó•òŒò&0ôGív'+;+¿­œüºrv¸²s¸òîpeÿp	}¨~b…hí€*=7T‘u»uÈg¤W	|„inrKµ8rpBÙÒ¦²b6~Ô6¥Þ^]]m[bAj;R??>Ý	~ywúö]pºÿËÎÙŽ­¥ukVÛ†•ÇM*­>nY¼¸š¶KEu'xÃÝpÆ|¦÷Uf:Þ[pöëÎÙ¯Á_ß½Ý9NvÎ~Û9zÌM°î¸²	ÇÕ|PWd›°s™!òkXpåÉ! M-÷Û¿žý½5Äƒ¬õ,}œ$ñí²‘Ó? ßdïë?€µWýƒ”ŒÊ}pÓEwãö†º×ôÅÚªåE»cka{aý†õEgCXÃR\ÊKq™$Ÿ>¢3]<Õ×îoÔ£«us¹Œg9¨ñëù9œÀjj7i<ÁGnt‘“±p¶}$7Ü¬ùG8[·ƒì–åÃ“ó°fÝ4vQµ0EéitExLôãå¯ço÷âÏû,µá·ví„ÄcÃ¡h¼5‹9Hg…\ÕÊJ°3$Ãpw±%#/øLúc$pšTHí‰·Ôé8pj£ke9¿>&L‚‚³KX^“LõÕ€|ïSÎHá1þô»ÊaÁXÐK}§Yº#“O‚4¥=¼TV®Ynp¸ÃIw
?¡¢×w½Æ—TAÊ›&ç9!Þ…¡_˜2íÕæ>A_·È$F“d¢ûà2ê‡ŸcÈKYÏ†I2é×—‰z0BËeô$åzDÄ×õr	0—YóÚ2g¼}]p}g;Š7Y`?Ea¥ŒZøPÏë¥Ö$9L@íBy³z/º
§˜Ò=©†æ4HF×uåŽyE¡u}¢~hfüŽ>3¨
’Â¼p…Î~Ö^²Æ|àò5.¯òÍIÙa±}»ó³ö>Ülš®p’”»NlV]`fyï&vÖH0É’E·×’ŒÐ{ë’Œ„ÆdIž¨K’Wy…f­®‰ØAûgí|XLëXV]XÞyÉ%!lÑ„äyºù§#~)Î…Ãü¥(%óóMÍöœÊ‘…š	1äÝˆTIoÁàŠu^¡‹OþN°"ÞfÍsv þË#@ßm>@ùíñt"½ÆoÐSYçc˜^ã£Õ@ÛXÂeUÓÈ—“ÈØÕ,ð6w­œ…Oß»²7ÃÌoèN™_dk.››™çe~Ž¦á€ªé,•@0W`ÁQ‚ƒVAÝ ;¥üÉ©“]BaþdGÒcA{#êbòÉ®å!<âÛh˜h<
=ûrÉ'Ñ@ÈÚØÊo`õ"0\ÑˆÚzFwß™p¤K¤€:Q‹¶RV˜J¡’îþ0NÁÞä ¼g£ãJ²íV”¿ÁòK'a–ƒ}Äh‹ÔÉX~ëêè0¼D@¶¦=sWõ½¡3CÏÿ„è:#Ì:2E!fn"Ôd¯n¥¶fm¬¼ÿïaóæ¬6_|XA¤–ëåÑîíì±n¥5¬Ò[@¡CyM«tJ3ïR]Ý‚N½£l/éÂ±®¡°¼ò
ó;¶=XB›iêQYˆõª­Å"úm@ãòÌ­`Íîý%€Pþ9Ò±sÚF•2pÐšéÄX~ä„¢}€ˆ0ÑÙ–WŠà¨ç’d–áÎÓ¯±[J·¦wt$ÑÑ³è~st=`ž~¶g‰;X¯l'T7G˜8®••àà
QÒ<‚ßö÷ÿúñøÍ›er¸ÑíxwE’TƒÐU	’4 ×¯€F¹‰šŒÄóôÁø	Ùx»5ŽÎìvÉ>g»	3–<Û§Cý˜qÞK+K†Q£‘ŠLõ)ž>W]BI[9;HÝ¸ØïhüIç•È~C+!«ë–
»\OÙ›[üma™ÅUáò¨ŸÍnp £ Òm'›aSœ‘ë›{H“ã«+’‰)#;Ðs‡®`*´IÄs6}LÏ­Œ3÷¼è°n#Y§*2ÚŒ‘¢˜½„´A¯H	,âGtM^Ùtð?Ðï#ŠF~y¤¹[“8Iø”%&¹“‰HÀ)bËy2È¡Ÿš”£•)€„ýFÚè½æN0WÄp‚Ù¤h{'X;ZŒëF–€ëË]ÀG-ê¸2Ê~¥ÂÈ%àqü‚«[>!ÃÍE½wá-Ã{—÷ØÂV{â‚ˆæ~¼GóNž.füs`»:!õÅ÷‚ÌD›o>eÂÂ=ø ‡8‰6i ¦èyC»1S¿a/––Ð÷µú–/çqŽŽ&,¸‹K+J.ãö5-FYmZˆ~5ÄÝXVÖ!ZGFû°•L(©d1Cì~”‚äÊScý6É›m8pÒ-áXTúÔÔ>àë¡U§_*óˆvÿ‚ Ç^Ì§EŽ°·O±‹Ì.ÌÊé ñ›SZ«üî’Ða|õLcÄÒIñ;’ßÊz†ƒñµ£Ä<!t²™¦Õª)4›@«(‰RfŽ½†Î ¶…ï±Nùƒ,_gZAaWð®ŠJé>Øñ0³¦àål£:/á{­ñ4ë³êè&spvÌ&Ì¦ü¼¾ô~UDÊZdTkÆþÎ-rãoeÎ°dª¤þhïã)K±Ð&¿ Hi2Š%Â”*Kì’¹J>#gR¬œìøQäÆhmc–ªqÞWf%äºü—nÊ.™‹›”)èš’¤“7,ã²®dÕ?,å‰œùÁúôÒ+Ù/:Þ(ìE)¢÷ul}ƒ® Ø®ý—Jláç^4FrNôW«Õ’Snõ$:ë'i*4—¯bƒþ>>§¶.TjÜ#Æwžç¯I&7ØÏ˜€¸Îï°PÅdqFíì°¨Èðž-Éf.·6Yáå«{üO¹îÌ(·ŠwzõÎÂ¸À>‰Â!Ij.1	zuUD_€îÜçÏÑ£ºÒ7Þ0D_öÃnßv{]ü­õËÜ¹RÚ™ùŽž×pÞ
=‚>R,ÂD{4Q8–$§nÁ¶©Ê&D·|;xŽº"<"/âœ¢'AãÇ{4YÉ"?(iêW^& ½Íº¥{ýêëú écÆ¾Ã³´ÁÚ>#?•z@”eVé)µLß>caôuåƒ>EI¾áÍ¾¨âðlŠn¸)‰.2">±ð"XÁi»´¬î;§¿~ýêç8íÙtMG_oé
‰wÛ Â Ö/ä\ÚäçÓLcÜgÀÇÏinÉWdÁÇ+~dmËí‰<$¾·Ù£g³jôþýLþ~&?“¿ŸÉâƒïgò÷3y¾3ÎÅ
Ç1jVþ$ÆÙ­Ì1–}<¼—´‹5ÿ!VÅ05’Ejp'ÌN>.vÒ(¸K¦h«é›pïÄ9Ø9<´I¼çfÇ3ô³žm nÆ^’x¶’Ip„`oh‚›Í?†¬°lâãQ±Ó“¶*ÈµDñ™ì<!UäÞd€í—òMEª¢î›¶¬…qJß¶SÈj÷©‹à17XBQ­¼õ§¹'äZÖ[DÉ§JT£—8fG>n,ùÒ—(Î@¶u¯þÐOÏHÈ¦§Æ¡25½©!|ÂÖ½á¡Þ’sª[÷ü§^K“5mÝkì£Â¸¥PÃô%ƒ]ˆï$=Ð[€´sëþ•ß)1m^Êê•Â}’Ä˜~Ûd’|[¢z,t’<*½¶èßâ\<uºÄUªÄ„•è!~SVY'í`¶­$_/êjð#DôÒÂÃv¬ˆêÑå·$šØ|k
S€RÍ¸Âëžÿ´ß;OÓcÒ |Í§R4Q[Ä5*+*™D×›ø7âÍà·+‘/ŽÇ¥ÒhÓàÌ‘¼L-ý[w)ZÜXÊLîˆðï
ªJbj¹sŽ(ÑØ¸ÓÌÝL
ØÉÃ¤‰yIò-ƒ¢)aïœyöìAä
¢=îö£Ï)Bòèj"Ç,ÛúÍgÌ²âœZ,Dˆ(¦¶Æ£æOxjÏlã‘fAY	 n£)0¦žéKeðòö€Ö–øv>q19]Xõe<¼²´»UëO&ãlseåj^w{#I­ÜtVWÂ¨5]×{=Ùª½ÛÙ¯É °†  Ã2Öûv!R•ž$î¶j£¤É9§rðrüº‚rŸº?‚žB~™Åb¨+¶‘cÔ¼IÃ1¥ÃCîb„Ê««î@Ó>ÉíJf¶3dµ³[@“/ØåfP¼³ÛyÁ%+BZ»dEÏùm½'%Ü&lc“¸`“þ]:B©TT5S`&ÞL.Y¦3wþX­Ì“Ui1A1à¨ñ%òXUMs¶ð<ÖŒ‡÷…YClDæÒ^Ý²Ñƒbƒæ@K®®Ðö6Ûå¾O’³ªÁ…)Ï³a¯+'>c5Ä†ë¾ùÐ<jO˜.00ƒàˆÜgs$.ï‚ÅÔYÅ{æÕš'¹¢±À[ö%CtÖG›ö©¹ZÂ¶óŒº5´ƒ9ø0Û¯ Û~ynAÑÉË
	.dRÛªf+»&ãÌ×eƒÎI=Ê€ÈG‡†èÀ¿W,-¾Cx8ÀáãYâ®ñT	œñòLëÃÊ&=þs)±`^‰~}2À9>®Ìo÷æó°pï|3·úTØ9¸x-ä+?T°¼pçwJ“,b™&ño-~*ÅÇOÚB²rl¹B‰kÅv1Õ$¤JÞé)M¨¡»m1˜á.Xð"s§Š¶<®(°%AV[§:“ÐJîüC"¦À¼+
7ñ³z
/³d A¶è²Ñ1+€Öøä»ÃhÀn5ñ“ÓÆ‰‚Üg·)È]QJDç‘:¿Õj4¥)r¯“ò‰òðÐ•Ó.´7*åàˆ¿çöe7ìæN¡Í¾i>]/™HÁÜª©L¯îMa˜Ý)+îw¾7åvËt„¥ˆ©M ¦dl`dS¡§:m+ùd¹¦Î:­zO†â‘Kï<³~§lü}Þ\ePúq¯ IP§Ú+B»ÑÒ{eSñ:ÕËU‚Ã¡=Pä™|YÑæ9!Ü×=GF‡NÁ¥Äcsa©2 ûœ.|%ð¡*B¢a”†ƒ§ìox°7eè‡Ø¦,	#Yi¯z%…aÅ0Þ!2àÂÙÁ`ÿ¶}Q¢c`üÀ”}ºË³´£ß:ÁÓ2 Äê—úõ²€…rûlÅÈ¢A’¸šØ¢ÂC< ´ÁÙ=@	6ãlœFaˆUtÔ0sQ0J !ØAl²/©–L1¨ŸãdM8¬Ò?up¥/Ê@¬Ð¤,ÐæÃ@p;ÿ¹‰>ƒÎ´ôiÙ¤€nY¶àyi›íž[gš
8vÁ”¬XòI†¦h”D8Q¹¾ ‘í»OÉ‰·«›Û9÷¥e”T^YÔ¼÷ƒ{0|õ{bOqV¸[d’ØêRò·Ä4·ôžñ£©¬fÑ(Èµ¥ó…;9Eùa£<›‰û&õ Âœd|à¤Pc@I"êsƒ…Ãý‚+‡ˆé/$ÅD÷B7²-†É#å~§k³
äOP6sõF!:i(d‡ÇEFã£ÃßéÒD½³wr5lqòWå‘¦´t¬ÒÐ¨,„lÓ^¹ú©¦¤ vl€û<¦ËÏ½×îõÿôSpÑøQ·ge¹\—Š¿jDÂ˜Q—[›xÅD+ âs[–_ó¬2™Án_,`®¥å"îY,É–Ëÿ†Ø&°œk*ºñÈÑIÞ†“~krB¯<s”Cï$†-!ý„·ÕûÄÙD‰Á¡l9â`‹Ìàgô“ÄÜ@¿ž<q-ø‰À»ôiE[ Ýx{9BÂ‰. :;Ä"HcW]Ç®õ ósÑ‡”ç‡=$»!À¶)P?ûžÜÎâçàønD’ ªëP`$øE(M£DÇæ" ºÁ]È“)jOâ!‚ì‰‹,xŒq((Wðo÷ÛÊŽ•Bê¢/ËÜªz¿
ÎgÜJÉåüÆ‹Ç$ÎÐ#¹©uð®î
Hc*t}ýX¢Ó˜JAÄcÅ†E°)ÓÆT.€HÇ,ñ<„º!Ön–TF¦¢Á‰WK˜uÖ°¿µ¿ñIÑ'õd!~å±šzæ–7;áfÙ·ƒHÈòã=å(f&h›¸~†s3àµYE[à¢~VFµP³
…9þpÈEîfÌXÙAýè`!gÂåãÛºOHÕÃQ-Òé®ª¹æ©Å´E¤žÐ\i$6Á-rßbë¸·UËsþ 5'I2¸SÉ„ß*_èºüü¹|ÙhÞwÒhøÝÔáNÏlÌbˆCÛÃÿÍ1þÑ„À^M0'YzSBüšk¨sÙ¡®öë.Ëè•¿¿bWæà4¹	þ²â¸YÍ³áCèrÈ=yà¢XäÉ³Î–åR_Ÿñ¥sÌÖÁxÛû¸z¢Î>Ü°t0xÃÈ“uA§ùýä:.×éó8îÙ?§!¢úÝ^ù´Ÿä»Ø¹„MÜsŒý5i­A0€†•†‚Ìmhó=I-§N	KIL]éE„h{ö¢ì“wsMpx)îäØ(ûå6€«ª!® 6‘Œ@Kš~:i7Ž¤°£Þ¦%ìC_®ô×<kŽmŽHŠûÑp«Ub þ,ÄÄ¡¬H’Ò{ÞG1Ž„­ Yòðßã¨_A„C|®ñ ’-Ï¹‚G.wV€Äböh’\Ã\4÷éEÚÚ¢Û‹_ŸÄçNŸD>O\(ÄÂ4ð³à×F´Ôðyê÷wYÃv¾ÂÒ1)bLwæ–0ÉwsÍ¥«m¤MYŠaO·p*ÒÔªE–Ý®sqºðÐàòbÞ~ÔåŒÐÄç{à¹A ®ùåñS»´ ³ýŽ‹Â
ùuAXáçbë¼~@:×4dÁO•Â¾ÆÎæ¼‘ˆ±Èƒ¢ÙÝöºý¢xÇ$ŒDhKRéXÏ½[F?ÜáËÃG»@³íé/U:ÂsïhÏ¼8>³Ó–èÏirÄÉñø÷Ú+²$°Q›eXc2Ò¶ ®LªU®±É1‚ª@$šêáy°RFNñÌI:ÙI`9(JºN(^NB°*\òîÅãƒ6zÎÞÆÅäš—‚D~jS×w4w2Ž æJ“ŒèÕ'TD÷“tbÎý\T¼ÐMåe2Æ¤û›÷fÐ/Ð©ÀpUò- Åð¹Æ=]·™ž2Ïk"+d&åGRrÉ]®“ú 1ò½Ø{Iv– Âç¿Þ©Ð®½z“&ÃG?˜
bA‡ëî+>˜í·~6”§ˆ‹¢†”¨U£Ie` Á-æCÅŠŠçÉ£#"Ñþ-Igß‘°¸|GÂÂ?È)_p+õ`ã¹güj¾øÛî5ÜÓÙœØ¢:{|˜ÃG•Ï©Ftk0í²Â:Iþ&¸!JÆËì!PÕØ[UiÉ2;Q¢'‹ïìª5à÷ý1;Y:mz¥] VÔoÃôS@£—7¬†ÇY‡[Žs‰K¹ø6'¾GX.SûÖ@yçõB ™;öË.ú_ÓH xçòÛ„ß??üò”ãóB°Õä‹À°‰5¬º¿EÑ§àøêêÛÞßþüÀ{òîõáÁîÇ_öv~Ÿ„waÕí÷ÙÆbîÛ\…ƒ˜^¢•e½ß,Ÿüúçæ³ƒÝ¿~<ÜßùÛþÜ€œ`õpsCÔ¬ÒgO76¾4 ³ÑUä3Zy…Ÿ£oˆÏÿü@¼stônçpA`œÛ*b}a æ2 
Üðh4ß*ïü@ñ»£“ƒ½A1»6)W»§_†ñ8¼ã‹ ün4ãÞ·
Âïþ@xÿíþé/ûG»¿/ŠÇ°ÐCŸ<ýò|1Y(ÞFéu4êÞ}«€¼ÿçdæp7/¼Ò zP/±<ºG)%þt+M–'„<%Yñ
"–Añ„-SÔÎ5Áèß’ JF}˜\{E‘Âí¾RPµ{˜V‚Õ\ý(Y‡ø
ÏÈë5¦œ“Â’XÝ°©Ó<yA€´Ð©gSË"jK¼RÌ’fK´‘Ò#kv/1³ì×Õ ¹iÒ`0™¾n<â{!˜sÊ1îÂÊÀ±1ÕT]mÝgÝ4ÀJ8ŒGQz]ÍoÌIx‰@¦ËjH™"¦ß|€ªÛh¯®~î7;ÏWÇ·Kò…ÓI¯\†isÒmÆ¿/ñ—dŠ‘g¡´‘.IuŽ™ÝÃûvÛ¢æå2ÊÀÆ$5ê®7ÄðÖŠ?eÛÏág"E-³ µ<¾dD*îpóUÓ|5øá'çµíÃ`‰·:8[÷ñQœ«›hÐÒëË°Ñé<]î¬u–;ë«Ëí%×²I“ð3S+coæa]-„ wÁ«ó2¹-çF€[E=CòM%.þ>BÐ|§g¢7ùÆ£î`Ú‹²¤š.k¤¢Â”·œ…ØÜR†NÙ7žˆZˆ©,¢íhbÁ–a]°	IôYY–è3L½¼,ËÉò!í¤ix×ïìXŸE“ÆûV«¯—ôƒŒõÃ’)soQ)E-d©>ÇYŒhØW³\ð_–]µÑ“ò!æ 
€ZeÁJµ˜U¶×b‘né‰)zmF è3ZYIsM3»*GJ(7M €ùC¬SÂ¿7O>J©Ôd|¤¥9VVL‘Ç•„ÊžÇÅ"ƒmlC'P…´mÍB<çsY.ã§×Å7,fø$% s§ƒ© çi|}c‡uƒŽLÇ=/z8Lbˆ´œGù	Ü² ‹á]8Š’i6ðP¸±RÎˆÎ˜ßÕ$tó’ õo¶eU“þð°œQÙ\!†ÁÒf­Þ^¨¤¶_Œ‡•I¿÷g©êÁçÙ“Š6Â'ùB™Ï,Ãb±Ö¢¦šé¯qªÇç~óÌíg{þLÚ‚]šæpc…išÜøû1ñlœˆÀ†wì[$–Ð¯§Ò^P QÌÄ]Kï/ò{)JóGôüB49.å‰G¤¹Aà¦$!z³Z{j6+ü–€=ë¤d–K(|c¶ƒ:(†¢<aù½šca=ØÄ•òøÖRô^gð¢Ð±jÑ®
	Ö^a3pï°9¶ŽµÓ¾‘S’dvã	ä€Rg¶’Ÿõ#P|¢Øùdô<B^¬®Úå	)œ«Š@a0?õ-C_Ï“I8(^=T#u	é
„9/'—IOÊ
„vâzÝôM]à…n»Áå¸eD•n7ƒöPñt¥ A“ô`Âb„jÉ…“¹Ÿl·LPqÐÃÔúÌS	cAÅÃ†¼P¸úá%ré8Wj^
Óqõ0æYŠñ¨IÞ@’–ó¶›Aí‘ƒF¼œôÂAã™„Ï‚ÚTHÈ„Ê+/Ðo„¬½¡üå`šBè°?àtÃKÛÔ÷aÃ°edx‹'õZA2eé .!,ì•»õBe{Ÿ+
÷ `ßçIø ÈrùLÜ
µ¨Ì%\ó¥.éBÿþ@©@áty‘X%¸ T›‚šH†Žì„ÃáuHÂo–ïö«–Ÿ•!,\÷`ëù¦ù-Õ3)»©(Y*%éŽºÖk¾®ÞSÕ€¢B/AÀ5Çq·bÄHÐN† «ôZc\µxxdiwKét„ƒ	<„ˆÓ3ƒ&¯Oþ“\þ!2:m>ƒ>1®¢4Ò“áÁÝVm”4Ù£ÒÂ&VüÃ/˜
™ ¢­aº3i¬V‹uQg+\p3UÂf½LÒé¨PÜ"®½ÝYÅŠS¶eeÅj]¢:âôt¶¼¦ÎDY¯ó6¬Ä«0 a×ëp BÚÙ£|?g>ý×ð>—$³3/…“#mEühÌYàŸ~B/°È;þf¿Å“~CÊc°´ÔB·œi7j4²ép9 7ô3x4Ò )"ÃÉ¯.-£ÿûÁ·ÿ"V’ªAyø4ò—HÄpHg!nÃ¨×h¤bnbQµä±1ø‘²y4Ãh¢±îÿ²´÷žŒm»Eb¾~€ÝºŸ•íRõ¹••D€ÒWè.¡Nhüá­üÌ#OHî¡rWt´ÉË€Çgî­OÃüÆ˜Ä‚y:ÂÞý |=b·TîÈØÂù¯_¥`R@£˜(u)”š•¸M p².Pµøs$ô„ƒøzÔ"†géÉÃVÖWKJC¡(ƒàáì|çüÝÙÇÝýÃÃ¯¡X""‰(­÷`”ª®´7rÁ*b‚±8UC¹*ß´+;vM/‘ƒ3ŒšÐh;¨1Ag‡éTÙƒ6#"µX±ù~}õß?”{°RVþÅQ²PAÛÚÀ¢ø~óýf¯Áò±"3\I•.]9¾ßC€>ºÞƒÆ=I<CDk$Ï&?ŸÊ„&SËœx+~Õ)¼Ò×Ÿá-±çÿ¼JÒ!3VíUÝC0O’Hï?ýÐæ÷¢æådTÑÅç`ú‚ü'?ÞÓ?I:3$=¼pæ4\yZ2B­X*noõà|¥“•š`T)ªèsÜ¡ Žk$nÔ_àî)é)®qê»NÅµrºZµ»”*M,÷ù€©Ï3|N4}L¥ÊÍ,o[ÆøA-÷ì4í©¾¨¥¤éÝžãôŠÕ'«ÛL—Êû"gšhk™&D f&Õ™ÞøL%¿Ó<Ùæžmó2ì]—ÍMaYaqgý9 ¥’Êãˆ,üo„xL~l±ï©j¸©»T©v­
UÀäZÕ¶®UÍEˆ©~1rTeÓ§Xs£ž·_½Ñ8S/Ê‹WTû#Îù6ê…ƒ0…ëmÔšDá„ó>¾ºŠ»IS.¾<€E…ƒà=ª—ÿ|ÅñŽIÔ.©°¢Ê"zd]\¢&îU×Œ‡ÐúT4ç@Æý9ÖBŽôRy$‡>ë4zÑå”mò¾ÌOÐ<áJß<Âç‹O½8æµ¦˜	²üWù‰]{uWrQ©½må^Û¹Žr‹±ësC:§üØaŒ‡`ùJ¯^4å:lîˆ±¿ðyt†nòØñ%àáUfsr®P÷Öf'úî) Î~ƒ?ÆýÙÉ¯Õk¼.snÓ|ú<‡²mgj¯(ùœ{øÕÿ—´_¥¥—Q./\yã6õ‚âr¡B­ÁÔËe
v•$é*AEàv Üú‹’"ZüÛ2Äx˜)èšÉP°ñ¹LÐåmXà˜ËÝŽ€TEøÚY­Î›úÆ´àv6Ã{Ó|ôÑÿ%‡‘ùôõÄAv?°¹ p‘VIöúÿýïÿõ?éØ-ÄCÃm\ÎA)ÐO¸‰_AZ„O5jû¼&iÜ­tj»ŽVãnE¾À×^ítÓ$Ë‚Á€pûå½IJA_Wj©“'Á°	ÔóÙlßîOA<‘ ù8«±"çÊ’›G=ü‚p;ãüÆ9¤ñGTÌ3;ãåÀ¦g.TÙ‹•üÖ~N˜‡ÔÓÏ§Â.5‘;4Epö5m!½¡:¬*H2‚]têM°s–Ç‡.: CJ&ðÎ8JZ(0{nVŸ£^¹û3Óª—j4¯
ž(Dý\[2;*IÄ$(p>¢"'×©?têÌ_4£Õ<óxÄJ‰ëÍ¬R½ÔÙÍnðÍ»’ùœù‡œ˜²@ÎXRcîÈ4 Í	FEÕÅÉfp/Ò*ŠƒjWê{¶€ªªÄ¦Hð¤2XRÀW’p³Ç”0xDshž³ª¨ú©ºžÕ%+æ¤Ö.Œq<ñ†Q/ž¢›R³òPËAYy¯>OµÔÂ¼ú4þµØ«ÏÄæ;=û´àQ‹ã[ ºpö™„³Q—AWFþ@n\V6W‚Íš'%@¶"UÓê	Ú‹ãsÂÒ=Ú…¥œ0“²zÂP«žfHã15Ú&³"Ì-äˆ¸Ïg4ëÇçrØÂÁ ¢þ[à/K^˜T¤ÐUä¿¶ˆ~8Þœ!8žypö°aøêh·xQÉäøo1Ë›cš¸³òÎöSÉÍ[
[(ñd6|ÃKî¥P6¨%dÌs4´çJdI§OQ8Æþš†‚ Óµ’µWG	µH‚@–hM^®ô×Ý-Ì¸h™Û,_®	Î¨˜ÞY¦Ý~<ºÆá{Â _]E`T6qˆ¯F@&ô®ŸPqÒˆÜ¡õre\.À¤ŒP¦Œr÷Qnz
PHÿd`jÌ—99ËUÓÉ|e&[÷JÇfT	Æ–8$,Ü0×íNSX7rðFäOs‹dônL¾@‚þ’3”<³µØ$Yd±Ôg¡YÉ8í&£«8nÝèµú6e³ŸÿíßÈaºg$Îù÷·8ºA*1&de9èñ×Ëâ0–ƒi‡i7"jGY0ÛÂÑp¦“îß¢›D–aºGä÷ôÔ,zy¢C)¼äã kþê8Qouªßé}©3+f.L[jM’ƒ³c*¯[jeãA<iÔÏëKïW?ðÐ2t<tgù˜öó¿½Æü'>Š^‘ý’º&Øx¥¤ç3þ§Øq£^WZ¦²º·ÒT~ælîÆhç…ÝþÁ0îáD}*Mî–0ÜDT–ìç <îØ_ÁÌ>Ån8zŽÂëè$¼ƒ0ª¤Ït»5F³Œ³àd»¥Ö¢Ò±•• Ùlû£>lc/ ŽY€‡¯¤YEiœôH2!á4—:¦fu4èz8àÿvÑ1“ë¯ôºM‚ wYôæÆO¤ÎÉ’¼Ò˜UÒÕ(¹…º‹HÙ¿‹ïQì¾AKù;ÚPÄ–ä¢eú}áIÐ¶Ëš0&S</~<…Ýüoe§!Be¾Ó“$ßg@1ò¶Ž
ÞÔëêwØbí¢Î®“ôNZ/öÐ¸dx7Ìå^óËfgú²îb2¤Ž<óí*ä˜" ÝŽòP<n7ñ¤ÿöQ<žðÉtÂŸ™Çž¤“×tÈø§Ü9Ð¸½(ëâñ_!ý#‚œ+Iÿf¯™ñè³y/òÇ	)<Ž7êSðco§‡Ý³»Q7P±$¾jPò/ZW"&€=%#ŸÀ€ÕáM#Ž&üqbÌúEÆÇŽ|3Èš"ËA›°¸Wñ(ê‰0	å¯¤ˆfäž‰‹×KnFƒ$ìñì½Ã··('Î2ÇÛêé*öÔ¥Dèê¤!¯]’Æhp8tZ„1´-¦âõ5ÅhZõáPy¾4!¼	×óp\3QÛh: ÀohQÕôDÆO”"¾6š€b
‘º4Ž(JÑ8wðS‘fB4R·uÃúSAM¶özØÅ_«ŒæÉÑ/hk×í|¶±´×Ù?Â–Õßìœ×¥Ý§³Æ%Á	ºU ®T™É8ÑwîH•­à}õÜY[Ö;~†¶gŒÿWÚeh#áŽ’·|Ö^žÃàV7Ä¦Oµ¦$"o×é¬¢é=‡ÿ“v§DS¡´€îõ5n±Žjw6Vái˜«Ò¼B¸~íàï€ã|ú°ì„>ðPâJ`ü´Õ1Vt†(ã¤ÆÃj£žÃ¾ÔÈz…£«D:1µ_£ÁçhwÃÚ2øz5å+´æYüGÔh?×_oµ˜ùÀ•­Q;98>Úß?öÞž'Ç§ç;‡hdH6Ä©Ù'1„¸¦ñÂ5Îð<”Gmý‘e.˜Ñï!X@L01–Ó¦à§à$…ƒÉ]ð·dÚíCt,<Õµ¶©»‹_¢Q”"°CôñD"Ñ•ÂD"v‡v³¡ Ã^ÒÎA²µ€Xs-¥€w„þ·•¿-+¸·¿÷n÷¬ÕþÑÎáùïÁßŽßíþº
kÕù&áâ‚îvp°·ü4E|ÙŠ{­lzI¸+@ëç°±ïÀFk7Ì"º«;t»ó&œ×èì´?I“n„|7Õ GÐKÕiï¥á™6¨Ð%õÕ%ôu‚I[¢Ãá·¸‡øðÕÖ†2Æz×  \G]µ_àÊXÎ"‚í<&\p~ÆBFRJ÷„ýn¿Í”ÑÌöóUòƒOz{u?ˆ+ÄžÕ‡'§ûoOßßŽÞŸ¾Ý\Bcƒ#pcqˆ£m7IÌÏ]¯=5
Ï5#ýx<lƒ=üß>¡»ß¨x±±A?Py:äîv“ù3Ã6U9ó%­­ìðQ?[Ô{Q_ÊÆüÌ5’^Þ@Ð³EhŒnß˜Ñ§ãy¾î«¯74Q‰ÎfpæÌ!ùs/š„ñ ûF°òütçèl‡l{ûç;‡gôèo·W•	Ÿã4:„µ|`f’`ƒÒ:à)ušXmQu
!­jgää3#€îßˆÆ{½%“ˆR±vÇxÖ˜\Õ>G·×½ÍXjK âÎñi«¿C.Ýý½%¨û”×Õ·î4¹	>‡ƒiäVb›/Öº÷À÷žWª×¡Å<ª%üÎÐ¤Q˜¡[M£n|G=¶zks'pã§Kf®ÂùÏ‘7p.tØ<bN”­âZÇ¨XÀh‘,åÚ2Ä>aM6<ŸÀð±ãX£C­§ú°ù†O'ÀÎhÛ)pM«kp)ƒ€=Í¹¦5…kâlY'üQ•t“:/x¥ŽZä•TI?Vbƒ–[Ò/œ¥Âã[_ƒc~Øy*½âÞ£š‘o¼Œü·‰©ÅØ?U¾ð®²±HB¦é¤Ÿ¤ñøÜ‡¬$g˜	˜¦^„é«Xøwç¿ŸüZ…³ƒ_ŽvÎßî³ƒó…õÊÑ~±JIÙ?V®˜ãU!dx¿ž¢U=Ã%/1âƒ&H÷†ñˆóÅb.²Þüö°³û×£ãß÷÷~Ù»tŽ~Õ¾èäÝ*£C¼ì;]¸	¢Ü{©¾ mDxFf*“«`Ò3jMÐÊGÿBA‘7I6½8ëÂxh`¸ªŒú™{«LâfjxZÁ	dD«Ó‹þî°Î* ’d"kKR|6Üe B¨a±*:¾€¼'QÝ6ƒµp‘å×xBáçø~J?±ûGñÎ¶2x‰5Æƒ°5Vþ[ödåÿ8F[]¿ê³ ÁV ­qïê‚Îu–kAwÃAw
GjÐ»C}ÆÝ üŒ. ø|Æ
ËŒLÕqý;3'ÁPÙ0kõ–4Âºš·Ñ0±¨+‡á˜j
Þ†cªƒê!fr?›5ö'h	ÅÝâæ ­«$Ý»ý†Aea°ìáþ”Ý¢ÚQYgC•Ç—ÿUª´ÅÏZ_qv5 :hPÏ¼7––\=ß‰›kbTÈ²—^Y¹ÿîôh‰¡}ãn¸„ã]²µ]]fËº(10QÃ®<Ù
Úú;«½SONlš(×‡ÏgøóËÐVTr(Ôb”¡Ã“™½PO$Df¨%½9vE7Ÿüït}¥ïæ@sê‡YcIU±ã·Ë–7+{¨Ž^Èã¡É§q”5”¸™-P×6árp‰¡ûÑºÖ _°¢9!z¤¶ÂI:ÞÃv€ÁÅ‹É+UÊ
Na x½2%d³®`@Þ×¦y—øþPHþÐ5†þ…k.o³¶&x—ò3áªˆ¦’Ñ5z ý@Œ‡):Tâ®9Y]L³9ï§ènMÇì¥ƒ(X„¶‰OÄ\‹n+¬"Ás5ºç¸þ­ÕR°Íe¶¼Ï‰Û‡¥œZƒ%\ÛÑ`ÈÐŠø$‘U8Ô$5¶ªpÊrä X™Á@j$@†-²·>‚MÐž3½H²Í³.¬È,VðÆhÕØ¦A>¹$ÕM}ž™ÁvæëXö‰cÙMKM8é¤ÍíôS¨P}ÉÉ'K/9°˜$Ô+¨g€
Ü€°)Ì697,t0&”lˆlõ`ðâ*x„/‰‰ÚB“ Øj†dÐ;¶
Æ(KÆ£œX¡>¹y#í³»P³"Üe—p‡8\‘’“wŠ;(Z9Ÿ+$è2¢Õ¸Ñêû¢[a ¬P_l3õ¥œ•
˜FÖJìüÊc1ˆãL–ù3Â§@÷œÐÜ+Ê¦QÂÇ Î£Éƒ«pY¢Y¦ñèB?]äÃ…|Â¼³ÔHÑ¶µ‚fNÀHŠlYð2P_ÍWíp’Ý½
äW®ÎfdsY5A\¤UB¼YÄt„µÒ²Š¦…)30®+Xnu¨-’ßèæ"¥%…KG«IÃ	Ž¼~Œ@Í7¶ÜôÑ6<Õb’€µdintÌ[ãÐá½Öu’\¢½4þÆ£ON(ÌñÊ>Ñ Ó6iè:UnÚš\„úd6“Yƒ·ù6Œt”™‹AUÌƒäm»~ÃÌ)¬—œÛyËì<ÑàâŒm¹7¬·DŒÏ*F>ÏFx!âî§£ŒŠâÂbFÆ;[Äz"7/qoþ>°‚ÜpÈOÏí=²³œ‹óµ¦æÓè«%Ð‹9TJÙ)fKì^n0›½ô•KKlB9ƒi;å<Ô%ÕrîÝ¬øËP}i%bÚ BÏïkŸ¿¯Îëû¢q¹cLÆp)I£àûìM(¿)óñ‚é[¾ |û²Â·¹Ù¼0#zµc¾i°¿d„â%C°ü1Äëå}¿öìûÒ¿oºb0pEZßSÆ„p«"¶™d%Ë¢»¿0-ªät£¸¯è>&&GÅ×Ãä±!8`Ÿ
Asù^þzr þ!ò[p‰h^/HFüÊj±ÇgÓá„h¶ÝbuJ§¦R"x™açê{àUi×\lØmíá¥Y/ƒùãô0	G¶æbK7É¤¥¶öø¥Ð¿Ô%uTÛ1„Ž=„àâN<Ù‚vÊ}œp~øâ1_q1á¿iYßÎº»É¾@„Ä¡¼A{þë„!ÍßQ{kãø¸°+ïÑìaÞ‚ƒEV°Ï†6. 6fÓØÀg£ƒÖ±êß¡ÓöH=K”N•QÝÛ€lY±K¤ÕÈ'~úrp9*ìêïóÝ×Ÿªëboh.¬³án/d~bè‹!çœ¡‡®XFÄý&	|g4ÆE»:Ò¤0ü:½Dª?y"W¶K.
˜$
EßP¯ø–úÚu·øÚµS«G?Ï÷Ë|~/ðŒæÛ/
óO#î‡˜äùš¨Zð«¤ïea·)ÊL‘NSX“+4gòP§]—+®21¶®Éç›âªE·ÉTEõ|5wÃ¶2wJg¯0÷eð?´	û·Ýh€þ§D"üàF-Hu$h"ÌäFŒ})P\¬‚5¹U"þ:ºev \°ªHkg­£¤¶I@¤ë6k¹Ûªx!8ÞÛA±ÿ¨PËt½kl3¼É¤ÁÌˆÝP‘KTA\ƒZ˜}\Á55”\
(pæÕ	…t´ÈM÷Y#ƒq¾éKŠ¹õ&eoU%ÛéM37jhvDM™O±)3þ ³t®gòÇ ¸®"”´6;¥öcy£n,H8·ƒúïhì>»r²÷f	²5ô°Šø	®T?Jê²mÃL&kùi‚0±5žf}Å™Ay­F¶å	È^SBz2 Õž«0Y;?Æn—–Z µnr`Ó¿,B•ÞPƒtdXù¾Y@ÃÏ*x¨ÂU~ëlYM¨ô¡‹`¤½5@‹ySÚSšy(ìßÏþÞšNâAÖúúìÇIò'mÀ¾kêí›K¹Ée’|úˆÎ\ñ¸U_‡ˆnz´×›ËeôÝeØ®N>à„¨é$,Ë!” ÏÚ”©…MG`|BÇÛGb|‡íùì
;’ÓQÕÀÍ`!äÇ“d¹qÏw­®Îù&'ÀÓFx–¹bö‘\õâ(ûHæŠzæ6kÝ²[ƒa!Ä`Ò
í\eô“•†˜;ºÀ qpY7«Ie«‡øRÀàšÄX¥ÿx(Ž T- ®„#€â,1f®ü¯Ã‡v½¢~ü/žYüøih…9n?}xãqÝ“?hÜ¡ûŒ{tìŸgïÞ¾Ý9ý=8Ý‡š5âÒ™Ë7ò=»EÊIbá[é¦„Hˆ
’›8ôËät[³D´SÅ$7P´VjXÙ"PcÈ´Aì¥7,Í¨ˆèçÓÕl3à Á—¾ú]ÞõÀï÷G½:9XG0”så``q¶&d/4Ä·Ø&s¡oÐYlšZ_ëñ9JÏÌØIë˜‰ò¥~ImÊ\°#
u?‚ÿ¸e^1<!úœô“áç¥BD Š=UÝkéÑG2»¯“[;á“Â¢Ý¼ÖI™ÎÓ6w0W°Ÿå‹ï¤¡‡ÄkŒ2¯°?vv­íº%Òƒ$kG]¯0á5HCE± a¯Mâ¿/]ÐÜ<±g<|IlC.Pu|šKWñq˜!í“‹ö¡âù†-Ü·:Ì)¬›}|÷lŸ‚²kc]‡¸»l#$¸£aŒaQžÏí¯M¨Ñ˜î‚'Á†9BD¥.èAeR\ù-‰ÇŠïªÄÔÕ†]JÁ¶¨*¥µP`ßUW¹7ÒL®ŠÇ8^¼¼>op:•ç>[XÞ[ÎîEÎ«•Ó3.qÏ%ýƒËÄ]ð
AÁ†Q©Eî'p0˜¸ uVõç8b×8
'A_Æ:u‚ib§ÅW¼m*æY7O‚#ë6Ú0Qlà‘zuÌ´5òÁP½m!¦šb¬ÞÆsõ–nVÛ©ˆ¬ì BÚhˆ­Ô)E1
[´ˆ{önƒ:¸jÛ†ú^¼¤Ø@C¿g&ôS¦'Ä´à²ùf]À¥9¯/Ø¡	Ç[“†Yš¿$+Ö Ç
w_¢Ä¾©vÔé,‰Èbë‰Úð‰sL±~Z¬ëÝXqÆÐ‡?Ý+× Ç8ï¯æ8%5ÀÈùÌ"|‡¨‰8áå£Y`è§›ãdSOµÜ`âDi×gm¡¢óÂTÌbƒ Úôàº.Ê0ëþÊà¬î£ërî¬þþ¿‡Í?všÿ±Ú|ñy­ÛÜÓÏ“ëkt-è&ƒép„íè˜«’¨¨/­¹öÒPy“˜¯
A‰y@âºÁ1~›½jÖC¹"Ü¡ò_ÙPy|äÍ@W:ã	æ&NâwC³Ý’ëËRøåm9üò¦b@[ø}º6þ_çfª|Úd ›¢«Š¢TW‡ÿÑ’ª™=XB¤§A8B(:‰š1h÷ð³AŒ4AîÕ¤yŸÖƒÞ”Ä„JÆŽû•¿0	0¸e10ºÿ×iÜý‚à/+Jr	g>§Áõ&þ&7ðÛ˜bä2šÜDÑgw^7$±ç&~ÙïhÙ8:·{F,9§¯!í	ŒaÍ‘ÈDÐm	r	kusF ÛLL7¾mvZÁø®Ùx~C)¹¡œ«EÎ¾UŠs¯¸ôœöw„±è%1ºT²Tw%X·çz¹ÒïXÞ¸«?‡4Ÿ
IYÀÙÈ ¤"ªelF‡þƒµEÔ8þõè•“ä&éb)tó&Î"s†Kv;Äß¤áØžÔ~ÒÍÔÀ×h¿Ç®?…¶áe†Hâ¦pº÷õ`’Œ›í•NÐÄÆëx‡Ü —}¨ 'pÆŸl^%ÝiÖÜG›Bš´cVwg’žx4žNÜÉM_$;íÎÍ‰Æ>Âæ(ÝªÑ©ãT`ÄÞ‹–iØ¹V«åîGÇÛºÏÍÚÜi§’Ñ.dâ¼44Œ`Eµ&azMZ¸Ó‚Vb§A³ÝFgÚ„ð€÷åoúfŒY•:òacxØpÍQ2Š¼k›À9£^…?øÞ­´Wés)½²«Ãæ¦ùt]ÈOo•cç…õµg·båååK£â$¸BBBÙ¤Í#®	[HÄ5;º(hÒ‡Œs›ÂÃ§E‰e=ò•ý]Nˆµ†€¢ÿ:·\!Ëg¯eLG
­Âá;á´þ³#„0×x„Ø|
wà`±„¥ªe‡£˜º–ì‹P	2^ÊÅÞQŠŸÈ˜gq‚£5mÞÌ@ÅÕ|±aßxšÒvh>+ wÄ‹dîÀATÁå1˜a›ÜÈp#Ðu6×§©Ôè ñ`,€â‚0XqZ´< ¬¬!°HÈÛç{túÔŽB¤eT
=)±’ªÐ³œ»Ÿ$7Ð’{n ÆÔrèÁSGa~ó7Äc!†ùí±ËÍ½x U8`qJvQ­]^‡iáã~6»aÚÆÍ¾…k·*kLvîÚm¾ìd]A”„Ý L÷˜DÕmoÄ  ÖØ$§1 8Aàéc6ÛÅ&š®BkÁøýÃŽlßt‹e¹ÓN‰L’fìƒ”òä‘9ø)˜8wCüv9‚a
,½ûœ3gŽÏÀ]xfR‹ÇåÅ]’à†_K*º™…«ÑØjññ‡°·{ Øo¶¢yx¸p^QŽleæË„ßwGÅ¹}kèDY£×r#|3º'‡|ND­éVßj±šo!¾Y¶Ó‚—’©=ð”X¥`Ge;¨]^9î…UºN<Í³…»®bÙÄ]ó”´2_­ž×9K—“p÷g×27‘€¼Ô„À;èDïýM“
"ÅÌjôb9PÈ5ûóý ÂÆ‰ÀÎ¼îaÈÂwzÄKuzd#LË™1ÑB*6GÇßiŸ¥¸iß!ÂŠ¯›ö™=KÿØóø–æÂ,°¿ dAÿpI§ò4Í…ø†Ø… "xšÄ(¬€B6¬Gáçø:œ$i€þ‡¿€¾%3
"p'®³Ýw~ —÷âxPü‘
G@%¤³á ˆú˜f'Ê
Ev½WËpPÌ1¯xTBˆ“À'Szë˜[¥°Û>§Éè0º2	‰ XÀµ¸'¬-ô"F†Å«Ä
×ú	ük1ˆ@Q€ÅW.VÀrDQ–hE»«(ÝßY”Þ*Ü_Äâ·`7VDô»1'9ÌD4ôÅ9›Ädû6iÇ¬#íP
ÐÊKh_+h.°æª¯TžU•`Þ6ošïÑ‡Æ·Š§n Ü+ibp@”!lp1gÈÊË„d/üÝmÝ[è?3gä/¿¡ð![8ëÃ,h Ÿ8îÐ,ø¿ÿãÿ`¦û!1äF‘«K³%ÿ‘®¡úh©€‘&=T*:Üœ~\å1žá›dXò$‹bVN±IÞƒp+Ž-_šY¸n»ƒñcpÌ~?0--Þ7J´h>`«ØAÉÁ°Z­–#”Ç’Ï•`æ¾’×pÖÞóšÙ·ÉOµÍrT±HâÃ­½š$.ËKÞñ£€Ö$Y<`A¬µyÁê<ùW*7´ÔÖž3›ˆÎ&¤È&¡*¨YØÈž+Mc0U‡Þ%édÉËpâ:{ü†§Y³dÃÍüÏN0ì	®™yþç†ÓfÃã5PRo“ Ølï]Æ/1ï¤añû6pf X·ÛJ€Zn ßcC~¹‚ûw|ßã2¢\BXßåmc•‡U-doˆ•;CºÎ—göí(W@i)+NV¸µWr?XéGŽËP{%ÿ]©K!–qí•ðG¥ÎŒ¡ˆk¯Œ+}@ˆb\{%üQ©³cˆ„[{…ÿSÜû†Q$Å%~Ëßý¬‚Öä¡O«R!xê#Ð›ÿ  ÿÿì}ÝrÜ¸’æ}?¬íé*M«Jÿn[-Û!Kr·wlYáŸî9ãñSEJÅcV±†dµ¬Öèr÷r66f®öfö1öyæva‘	€@ÈÒûÝVU‘øÍL$™_~¡ò†-cÿ²»æ¡?Ëv#½ˆ­z¸v³qB1J@twn“À–Ö‘ cž¯è¿/ý„|˜öéjñšj¢’ò¾X¹ÎÜÐM§/GˆC*Zzú¿µƒµÑZëàðÈ_…@¥Ò!0Â,y¾È§ˆ<¯¥Stdù :üó?ó,Œ9óó–ìÏŸ¾ó.¥cûrx\ ÌBÝ8>]$‹ëÀò®<^Â7×l ¢ø+¯¼ÎCt[éÃrRÀ¥Ç¿BxAñ1Š[×,eúc•Ó/Dý×®}C¨Ó+\Þ/€!±·O»×"PóËà¾2˜p•ªs\8áféç°ŠÏÂ$Í,lS•^Qã«ÈïX£tA%˜ú9</¦^O®rv«U€cˆ(PéïAØä?XÔh%%*¾6Ú;yÂª6g þ€éOŒ’ä²œç1Y«¾6ê(¶AfpcŸÌ6PÌµi-Ô«éK¿¿¨”„, L™ätÇæ&£Ö§MõWoD7v¹6æt]îÂEŽHûA’bÑ™$½T‘Çn†ñå%ƒO¾¼]ðætL·#z³ÕU}ãú6TÓö†6ïÂ³ÜxÿE—»	ÌºËúF–£>}øµ¯‡Ä¯ûd¹ìaûõ(à²¯Mò¡òÀyª…1sÔ•</ëùCèy	F@$ÀwÂÎ™»µ@*¨ÊÕ~ít0›'³¨pç-)?mO
¨¡ìÈ&Òêd°†¬ôO,m8/DSJ%VE6|˜w‘nJéõnF˜SÅ³åðÁV”Ã³’C ê»>óQ6Ë%O\Õúc¯ïÒêW'K¼‘å/|ç´S¥Ñ%¶NžúXQu‘í.ø³—
ËÏê•ìJ,«¨%S¹3äâ1…m~9äÁ`­vÈ’ŒSféP'T¬¬/`o‡£œÙÔÚÂUOR@MÂ¬Ê˜%Ð¥%¯|+ŽiókmÑzœ&A:Þ?¯XôÚ·™ÌÎ|Æj–Ô"NÿZ#‘*¼¡’…F$—òp~5C
5x˜).e[µ@¥ª¯6:ž%žÉ×YL~è+TÅ<ªMaòT0Œ¨˜Q0Œ2h?“Àyà†TkcÒì5eê­Æö9©‡B	ÁÖˆ`M‚£$ÌgÂ3'fD’ËÒ,b‡'ñ4^z\BwfÙaHö¹¾ý:à<m^50Z„z-:³ô(šA¦][|¿¾÷º-£DÍÆøá|R³(VµZ¹ð„||'r~¨»•a¬‚ç€uä­[¡€9š–+¤£ÕjT³B)Â§¯Ó·ÏéHbx@¹ß¨4íþJW#bã¶¥e·ª»Mp“Fµ7U[0¤†¤X7"„$]ODY½n^ ™…$Þ©`‚×~¿¾÷dµ"Kï2ù[BiYŽ_ûŸ|&ÇíDÏ²µ¿ùÊõ×Íõ\nbú½(H²ý0AêwÎ/e•»-Þ/²ÒÝËç³«3¼9…Þuñù/ayAÿ LG!ÝÜ§`LÁ=í+;Ù’[;É(À,µO‰#ÌöSµG>¬&ºôæè[LÅ@ÿ_%Ð§»±ŸÊ=º96;ÉÿiÎÐñ;¶PõføªtØfþeäˆ*ö’ZL|œÐ{tCïµ8‚Wdø V{`ÉñçTNP6€ƒöYqu+›`ªeÿ¨aÔÖÿq4OÕÆïÓ¶ïW²`ùŒ7KÔ£*ÕPDô5,ëîêxÓŠZ 4®Gž±ÆròK–%ØoÃìwŸ/E0õ<_DÇ#³íî7qµÁ~¸„ñ6çØ€¢Êþç¿ÿÛ¿9ÙFcz(ÂÓ^FçÏY›Pà7jnžýPªaƒ¤ü¿ÞÖ±ÊÕpÝèjÈh"&!Fi×ö»1&­"N©.ÄØI¼a¸²T³I6RŽÂ“=LC¢c*C¼Þ<&NZÓàü9eo)1$º¹ô,€”‰ìˆUÖ¿¤ÄÍ+^!EÍz¸y“c“Å¥ˆêéHùž­¨¸¹·ÇD)<¬î††ì0«8&ÜÓØ&’ÅX=AÓÚyìS‰Õ_†ÓQ4§Òª¯½¡>¶Ì*€p¬–ØÇˆ(4Ç£ÇM±evacùÄ7w¡žš1hšn¶îÖÆ–[‡©™%`‰/\¹­<5ìÅÔiTõõ·Ã‰ÀŸïyZC!`þû§;ÙË-Žà ¶‹YØÙ
Ô@~ßÄ@~¹T\34ü²% ¾òÛräèv|]‘HÑyT·6Y'RlºGCvÃró„Â6Ð)Þ“ZÈ(yFgz#ÏCxgd[eæVË*GØµ¡õ{šÀdqMÖ;5KáÉjÞ×Üú©Ö&a#^=¯Q¢à(ÎàJ …@›œþ°3/a Ôú]ÒdØQçº½Î«¶b£iì îB±d"¨×Yå…bƒßk›‘”÷WöÜó€lDñÃP^ýG—÷ÌöŒ{ª$rËe$i„á—É0÷+,â—4‚ÒR–]ÑØ›`*£Ú‰©Ð³à…ü;VÁz?;GY€}R·6HœÚœ6ß¶C8o-K›‚Ñ‹˜ú§!åw3LùŠ™2lÃÓg  T†}®>p‰üd€ÆŸÜªÄ¯ÈÈ[ÕŒj±ÂÇ´…3•Fòôºú5¢Ùàb­æ«'A}ôÙÚyQ½©ý^æ”¦¾ª¦<Å8Ûº,}Ò]¶G(LC=#(¡ÿhÉN 	1˜#cØù¿CñF£`–=Z
á·ú·+ÞlF%4ú¬ÎüSûŠdùÐ÷ddQŠ]¬X&kSZÆüh0{äQ±ÉÁçôÉðýÚ7ìÈE ïºf (zé†Á3nAÎÙ×ø…M.9½°ª†1&Ã¦>­ÔK/¦#b›Ô®º—€W”ô Ž•ž{añÕs …>o›~12°W¤è5ÚbPdÕ¤UP$¦uE4ÑŽ4‹¨ˆéè­j¼j1½W­é
þÙK¼Ì{÷ú£z·ºìô,|ÒîQ‹-
ßK­[g“èYœ,B`ZøJ8˜@7Š¬K¾—Ž¿|è©K\³_- îåv6éÃ£y’ÆÉ`‡ÌÇB5’ZM€Ýê@ÙåZUb75"¯µäë”Ì§#¸y\Ø"†$OHÅ;d‰÷‘k'«¨¬ ðƒ4QÇÏ–®líQØ9U…=Ø˜PŠaDvÑ{Ø†Ë±J9Îl‘Ä'*øBú+%)˜ÿdƒm!Š
!Îm‚ŠX.Cìÿ‘)ñ£ñÆªJY¿h.Ø/±$Û8Á†	í|³øºÊÏ­ˆI"oáëâÜ&;¶ÁšžFô¬Ì4ÉkqtËÛø<ðæY\å^•á8Êö`æéÂx¯Fqy³´Î†¾›é†Ûp”É”¤íÒþ±úÃ¶sn{­uG#“ÌT¨foã³³(è÷àµ)O£(š«qã‘w»öÈ«ma†íïlááWh,\˜Åê¬Ià–gE¬7æ9`¿ß@áu,ì,‡VÃÐ3³_paá’.^þãü+oØ^X—[öÚ4ü¿œ¶Ü9wW³ñM2¨û_báQ8yu`
ŽçJš{ƒ¸]Ò\(¡ä Ô·ÖþÛ‹YpÓ|É.¾ræÂ9S8itàK	bóÆ·«†ó‹Û°Ì•p_|Kós$±ch–eÐÔúDRwºiP±w³“Ø¿B×‡vgpAø¢çA•ÓpBŸ<N‚4˜Ž2‰}˜–xöÂ»ˆç™K]ŠxÙâØÄ<uýâ$ÅbL¬½ÌºLf`/¬•0Ö|é"ÕÒø—Ù<™º¤ØœÄ0”!=Ú8YÑCÙ§d§×"\ 7£ÿ”
a/ztyIø]ìY[!ôÿëk¶¦KQ<FJ]ëX—sUÁç0Óû„÷Âô¯áÃm×êJ(Fòéò¾r“MO³q’’3z*ŸÙÛFí·(»™¯K<Ú³Õiˆº;S^­)
0T{J=.7|ô8.€2àK–QyèÜ.5µ»^	på¿øÉÿÓù	»éS*¸}|¢•E§|çR‰Ù`‘(½QZ¶,Rû[›ÚÏÈ˜þ'£ÐÊPdVáˆæ®Ð* kKÆ¬tLñÓÀßÌT –åÉp–ÄpeÃÖOä±qÊÂÉI“Ñ#¨[©úŠxQÆ¾Æ¸ƒ1lÌþ‰Oþ*ìF¼D·‰Ó I‚ä8¦JúÅ£¥i<_9Ùüõ´Þm¬8{,lg4ö’½¬¿†¡8½'½ö½rÅ¢´”)øjë7ÅÛÖR£]/óiÃ¹z7ýDEô”º¶=ra•c¼‘õ‡ÓÐxxML<8†8uÊÍRÂ—+ò•ËMá§TN´Íî÷DþøõmÌßnu‘1À\ â%4¨2Ž/gÆµsíåhÚŽ³ŠŒ¾ù¶Y\‚”öÅJ¸¾C–”<Â¡ O¢xôi©+†A;ìx/Å²ô`™åßˆÍ"ÆV\)ª÷†=²Ó¹CjpŽh»Œ¡,µ.p’Ñ¼W#ÚP'¢y	úDô@|µ Nc„Dwª°èu¼ù¶éÉ~šˆÑ¯ÒÜu€eËŒlz¹dóÓF¹ÞØ;ÝeÐœÏªà—xü‡Ï¼—-!a*;q‡ö@:vÍffÕ™ùž)ì…—ÉÂ,
À("…
´&¾¼Ž?ø6h:kŠ8U–Î6!0¦Bçô,ŽÏ¢à 	 ñ[7mv×s3˜éeL\Êj§ ŠÂük-ý™òêô“½qÈT’ ‚ƒa<¦tê§q~@ìT«B1êWxÍ)_+˜ÑÒæhÄ¶÷ª*Œ—^Ñq“7áÙ4ðÉO¸F	s¶o¡ýÙÊîágÊTKBúmnV[ùª×îå–§*Jüm¼çLÅÙ£ÎTÊ^vÇIð[œ‘ýK€(ðvˆÜõ{+dŠŽu¾îÆò»xÙ.™T]11OaäÒâŸ®C~¡S£ÅþÜ_TÄÇ,‚)l}ÿL¥­½¡+9k¤ìÇç¥ß\<ëûˆÔ"MÔXØËå-eÍþk QNž|Ðä—x>Ìi¸U¥¨BL #‹$Ën$¹hÚ¢bòÐ§«6=C‡dÿKP0Ìâò—þ•yaP¡í5‚”…½ùÃRhûñô4L&ý¥ƒ 
èi(Ÿú¥²´—ä"ž“tÎÿ8÷¨‘ÅTmPš Ù8LéßpAÿ„>ß=2KŽåc—òõáð^Ëð+(]4ƒj¶Ù,'`ÙÖýò¯W³•cŽ7Î"o/oÜ&¹ö#ùîjîÉa÷’µ6QåîªæiSëýÞ=Õ˜<n¢`z–ëçd§q\T<WéÄÿPr'ËCÑ‹dÄ®Ù¯Ð@GofÞôÑåÖ•Ê§[yðL¥I^5<9˜=ÞŒãsZMÍ”^Ab€K¿üu&e±t¢³%Ò’½ˆOÁ	½ÂÀØÉ¨i™”æ:†)V}£rÕMˆKèog™HB/yn—Ÿ@7"˜‡h#«wíãOÔ3`ÅLÓ÷ ŒÇ*¶	Jœ€»‡Ôä³Áú}6ñÌ¼è 0q¯Žá&ÕïßW&,¸	Ð{·Œñ§Í¡C•P÷Ì¥FÕj7½¦È4ømtÛ:ŠQBè&1ƒž–ðL$f$î¼½YÙŸ[àsÓ{>ƒ™ÈC™Þ&d4ŽãD Güðô”’U1‹DŽ òeyÚYrBÞ±t¸»:«é™E®¾Edà› Šˆ´ÜP7j‡žr.ÇrpòB“ì±4y·™"ï ÍÑlÈMtôFeçIü™¬’Wtv"ï¢àx9ÓÍyfYÌnì³|QÛ	§t"L6/ðÔ<¡ÿúI<ƒkâ.~¼HË‡f‘ wQ„Srêùø¯?OôucÇlL—S*•2¸bu*ç@›‡»‹»›1æÜ8¦ÁûÛ¿?(Ñ£<tÃHŠ³ƒP.tû”§¡-Éó°Y‡¼”ÏEÀœ©Ó,žÓõðÎðå~Å>d/ü•;*‘(EYVÊ·÷o·Z…Ú9ib¹JzæE±š$^àS/˜ó–Ëº¬ÔHšŒî,4ñ——ù‘91ÖÊ_l¼ù,emèÀ9z±6_þÕæ+æÃãp·X3-®ÀXó‘×…‘*;Z£dÌ…nø³Ê”¢h.n¨0ð’,ý5ÌÆ*íí ¶RoÙÊGýp­”jtÖ5wÁ=üz—8)º£2&Ë²î<Í<*NeÐ…	¯	÷íºQç[ÜXA1‚±íÊjhYÖk|šÀÕÝ-s¥¿v)ï×‚W‰èÊò!kd1Ï&oÎìùØõ¤J6ãçLe´RG*3ð­oÀ¯$Èås›µ!QÝ/«¹yÒ4v³@ÕK¡Ü¾›¦óÙ,N²ÀoÜÍ-Väq£ímÓØÊ£]GÞtgä„Ò^@§Œ
~˜PÉ]P…—dã@ðà
¡{Zßé;ù-#ä`ˆÇžÓ?#ˆÖ‰.êUJÏ<k˜M'„"ºnªŠVXW%MzmõJLÓòáê“ÛqÇïtá˜QùuªÙœNòßáÊÓÒòdáob¡ëÕ¨fAÔ¡õ—ÎŸÚ]àËØ÷¢2¢N£uü2(®NíW¥³g‘A½úü¹ ãgÃõ/S•k”A~IQ{¼„Rõ)EX²ÐÆ@ËŠO^‘eðgC°§eW
î„ºÄ´B+$ Ç³Òƒ^ÍÁWÈÚTd>‚Sayð®‚øVäy;Ó—ÛáJóX!Ã#vîRÁ‹S»|ûÓVnêF·ØÈ²EzC‰ƒÔœ
ž(DÙQÀY+°¿¹t{3Z/YHeó…&wÙÅ²É"oÖÚtQ 4¿›a¶#ŽO<-²šß ?÷I>£Tød¯ÿØâRØ=Ö
¾F¸»žkZÚB´´¤’»Šà²0P–V|Ó‚ÝMÐQ9'`Ì·
Ù}Á!xºÿÃÚoc›È»ªŒö83GJŸµKš÷Ç6–(íÒa™²g^[6I!vì%’ÌÚ&§¤(åÌ² ÈQ©¡.9&EqÞË9)J‘{R¤bÌsJÚfc,ò-Ú:4å¸*žlø\}¦áÔJ¶Zj%îBk¹AaÂQé‹#æ?§ÔŽrùC
(!ã”R.Ž"¦U^H¹\®{g¹Ä)“¤Ò×íÊ_Å[¦Ÿ”‹#­wHI)G_Su_Uƒâ—Zg°¬iBXj—á²¦rc@ûR×\˜5JaüKíreÖTŽé3—\²h*•Ykìi—ÃgWÅdý£˜8'ú¬™CÒO¥š»‘ TéRÕJ‹Ä réž$ô&·'“Õ«Å Û&•‹aËk‘@T.ŽÛß’ŠÊÅ%‰ƒòw½RòŽ˜eªØ¹ÛŸ¢øD»W×’Öåöm§¨Å¼ÊÃôs§PÈ³\GSSw!Ýþ :Olr¥ËE‘ã,›¥;««>ÌÇœ ´­Uû|¨¢|9Ú~MÙéu=èØ"7p(Öš¼kçãò5K°j¾d,Uò±—ÂÚŽÙÍ	+Áßüfâ[RpRÇÁò§I<Q„‚¿É.¡yRiÌâ	ÙÝä4å%ƒ»ÍæýnŸ„S¸&¹ …öÃ5ä¦SÍ¯úÜ$§Ad8g”†â(#Zg—†buïÕ™ÈLŠ±,gþ½‹
Ûyó:r÷ŠÂ/¦[Í•çžÎ7ïp¥¨;XôbÒüæµu::¦ýÅœþÓ9¥¥(Ë,J‡œÀ¢tÌœ÷d¡9‚Eé’+XíÙs‹r-¹ƒÕ^ßpaQô©SeP´­s}‹Î1\®÷ÈëžkX”69‡ów;ÓgçÄyWœßrLŸáˆçáš£X”š\Å¤ûM%.¾‹y‹Ei©r-yŒóÚkò+æQ=§qÍE^cn²:>xé¸«NJn™óî:ß9¸!ÒTŒÙ·±5TSÉØÛ­”•×Æ²ús)‹²ˆœÊ	•kò)çÉNœ)åâÎWöy—EqG]²vÄZ”§m+ÏÎ"J¼$ÐáwvÐ mY6 ¢¸sÜµ8(U›Ý™:UÀ`Ô£*!ÞÀUC1Ý„÷ñ>øV4ƒöØsÃ-u»“œÏ*üUé–b¸Ô¾Åd`Ž'%vJ½ß$ä>©NGåÖDÜö5Ø±¥ì‡)€(ù.ïUû ß+Oj^Üf¼hˆ>¬
h\Óñ¦‰/þbmÿ‹áïðø,àôëáÑ7”v³z4ã£9Tÿ\„ÌuCÒ©ŒF”* Lß0Â‹€Žö¥7¥º)h<ˆ÷üˆô/‹Ü•+$‚g^ÿ4ÒŒ~œ§A²BXŸ~—€<ÉUáZÍø–5ó>ÇçGML9êûûmˆÖõ&ƒÌ§^”Š“'…“2mxEâCúQ~q÷…Ô9òÏ8ô±Ì§¼²ip.*:Â?•Ö/÷^OxèíeÝwAfÃsót¸wtônïÅŸ_îýrH+<‚ô[…wè£Å‡¯àïü€/¦¡¨ÞÉ„ÍFþQéR¯§ÍÆd&žüœ±	‘¿©{wäMÙ
ã\¥ìÉäÉòä$LS ïz2Ô¢Â„=•ÄO!³OÇ”ÅIÏôÛž?	§½™v´ºJXÏðï)ð=vLê“@xdÅ:õ2˜Ä}}—áùN*²÷ûýd‡È`Ø ê²æQjZÖ¤:-kazƒ,V
FàuŽvÏõUŽXÊ6¨TNe¬”ƒ”="‰`*Ìs‘fR}©2l_Ê°§¼Ï®¢–‡átÍý í³†àûŠJ #[—Jøp»W” [n·OZÖ¡T Í¼àæ«ò^“Œ’Ì”™<§Ëƒì{ˆ–„a(¤ÀÈ-#/Í#¯@çäü½¤sˆ¬ÿÿ HÂ^¦p‹ôF¼îÞã>ûR%tÛ°<UXÛ~ñY#Œóä¬ËºÓ EÞß\–)ß)Ýc¦g]DK5^Ð)~*z3<²gô¹?Ñ_úJëç¯ôðKøº¯VK·¥”>pñêô%)´¸ÂêZ!ëJ$JßJŸOë^#ßCxùÚ24Î&I®„ï´é_ƒà­Bë{ë‚¾AO.Á7n*ßPuÊ»Ç¨øôjÕåGZ?šÿ›V>cŸù„Íõ€¬“üÓøbé¥uxœ}E_­˜­céõ|Æ”Î¬HM¦OÞ¸‚(ªÛxã”íöù“ï¥›$:¥{¾ÏpLâyÊzÞKÉÌó} D:¿…~w'¤	i-†©†ÓßÓ™ ÿú±„uîaŒs1 ¡IàÓV©ºÆ†¾ûñÛKeª®ß^òüÇÊœ-é ÞÀÚ÷7VHo­·,=é~ý¨¶žOÙp6OÇ†ŒÓ¸~+Ä_._«Ð‰=šOvˆáÆ%L¹°Á×wª}¦P~ì¨¤<&ßšHà|Ñ¹\È×¼z­qYw•ž~ýý÷æU6¬Ú…ºX«…
¿PŠDkÖ&l^›,™/ziŽ=Àû½p
ˆ"ÄËÐñì[ìü)ÀAå“ø<%ýÉ<ÊBúE
Nb?,kì?¥Ú¯YÐQyÅ%Ý÷š¤3¼]~s-—vßiW¼—BHž­ÊäÅr1¸âëiN­Äâ”aKDUèÈOéÔJ1¹iqQrBüÅUç||…J§pPy#X1Ê÷R-!uÁòAÝã~°¼kê»œª¡¡,Vô2øBÕ”Xû’BÛh8Bu5ôàHb„ëèÁ÷=xS‚hn½¤ªuÑ&÷f³$þ-ðÙIöYœp®¡jÕº# Oê÷sÒá.Æ3§~Ju>v†©è,ÃŒª",ÔoeÖ#ÌÇÇ¯_ýrx góÓ=Q_Ïx”Úûî;Á µ$ÃÜX!ÿ²‹G]f·0qô)0’/šÌªü[ÂÓ>³¾hö_þ¥Ò/ñ ë‘.Û®<ù¼v>MÌ>…‡_í¸\Xžk“ô3³Ý5¨H&fàNÕsš[Öaè…Ý¼<ÍÒÊTË/ÔM÷{¢Lxñjy3n-¯,O!“6ô+ØRN¤4,²Ð`7	ï§–Êº:ŸËôÃò	á‘ž®Öð„ n"C¸—@éá,žC­úK9©2›¡naºR«íù`ŠNŠ¼È52”¦i&‘>éo;²ÀÑºZµàìaZ™¨¤Ìd¢3%›T•Wð]…øÇ \ý'q–Ñ¶
tºrŽ”fßTÌp}Ziµ«¦Â›õ¾]ƒ±×`Õ/=fôXØ×wWÇM5by¦Ì‚ øÞh3k‘Ç¤}Z•…“`Ÿž

®HuP…Œhåé[Ë[éÕ{–Äóº¬.»ÜZÜ&ªÕìÄš`0Áà<¤œ=•ÓÊm+8š§'i}òcv¿
ÍÔ_E)!|èùr‡õ/ó ƒÂ¾X¿WŽ%(îJ—µ5É7„Ñ€žf	ómØn·óM±!Á![æàõ<8„£š–nÏ÷·Äb:©žÎŠå®¹¬XP¼"{Ci
N¾Ï I‡Íëjd(Ò¸2S5ÈÅø”È$÷æÆea;¶%‹ËÑ´ÙK¬B¤lHyPj[ºo4ûþ
û:Ó²™)½ñ%(OÈ’É7 žó5êŽå½Cô=¡°÷ÀäS/LÚCu‚<Ü;¶É¼÷‚Nn5Í6ç"èHÕùíÈ_%eç£ÿJÝ•e7¿œkAÝâÝ–^·ûèwôµ~¹V>¸e>Gd°þ6J³3âo°ÊEHøB‚¾`R
V¨â¤"7€îÔ6ËÕîqDKf@Pr„¹ÏQ/k¹˜
4¬¯É±ÔWœ»ÔÔ`ŠÛ qW€p8À4ÀfWàn‹w{ _Z‹rmÂÜ¶jYZ1êÚL	ö©kÎàÏÁÒíé©)¸|ËYõ­¢>39<hÊû4Þ²N´ÇFÜ¯b	g`³0C2oƒÎ^@2‡bm©óêxËü»„"5ñwd´ËèLú¸…³qßföMm	›„Ítâû‹DfˆÀ©Kp.L­…b{F•‹r^ýÏÿ·Þ]ÂêÐxh•‹ˆ’—½×ìã*±ñrEnGZ¹`>6a¿‚øuJXë­0¨ŠWuÌ]7s5¬ÕÛÝn–m>nVyÝñôß†~U)IÝ¡J÷íP=–.(³gTéšá¶@•UPîöÀÊÖ¯@É¯Ñ$ æ{Š@€°ÀäÁX¸é)Ï«-³×.‡v¯Ûa(ä£á˜Ò0’Gm¥IŸþ…—O½î”È=z<ËcÍèÁëã·ÚW>ZC?ÒãRos}è]-“úŠàªGý}—¹sõþãÿŸÿ÷ÿ'9üûŸ÷Þ½y{xÐƒŠ{Ôµõ4,ÊeÉÝ«©'ZæƒxXåñ+(.wö-q¹Cˆ\ÄÉ-ÒÙ–>6¬Kå“°B®/•ÞÀME×†à’ny•¸(UáÅIœ²,¹—6üíœÒÖÚ*ã‰ÒÿÊìnÒÍ ïÐZÙ*^›Ã¸Ý½étîEü¶ð„/[˜ÒÍØ›§tMïµ	ðÅúÝbv¡,<$	
§'¸Äµ«þj¹.õ(¶ñ˜wSEg'ž·T‰¾‹,nHÕj­G9k[hPè˜Ñ	G»­
uYër%L@ç†¶Þ<ßÿ;ÑÒ›pôéºÚ9|yøú§Ã£ý?‰Æ'êéèâºZ|wt¼÷ü@4÷n:óè.Ý¢-çÝM‰„þ›Ä9e†+fV«TL)–{Q-V”îc×å×øØÝ$õÃ©ÿ•ÐoÐ¹[à‚mÜ-òî9˜–Gq4 õÝ>oÁõ|Hz¤£$Äýï6 `Mø%·cæã0¯´¹8¯O“08.èi~Íó]3]ÔÀS]+ìWÎ9¬®Å2w!¾U¾±yÄäñÔÄ¦mRKÕÕÛr–È=*xkn¡Gn®Ég¹QJhy×1dgºðüwŸ\;o&obòÛxˆb‰2?™„™Õ'”aÔ€€ÔÁ„4c¸:¨‹ö1pv,ps$°ôPó¬ÿŽ‹eõ¦¤ìÎž-ò¦+	ÊíEšß"IºÝLC³Ý²õÆ¼æ›·ö*eæmãOÐœ”ÜÒQ+WSh3ã{MR¡
Ã}xn=gyk“}U¢ò.YbíåØ{Ç•¢Ûüãb7­„ÉËC£®ô9vIí²œ¦”×máSÔŠEåÓ<œ\}L¸š3°Ž;äòƒý¹¹$žwÏLEM¶ÑÚKŠ~ø’øTÂŒ]ŒÇ7™YN^ýÇs4°Ÿ;7œ?g?(m}	Œôè:yw|
 ´ö+€ò¥ûànÖ¿ ›¼flÃÝÏ Š#-»!f;û`V~Púûè-}°G_µ]kè–ì»I_èîŸ Åñuƒ~
6í-ÊWÁ¦­Åû+Ø´º(Ÿlë:Ryã£wW¢µôaÀµÎ¶êxÅå-	Ûø5@q‡} \CÓ»Ë­|°?_ca†g?(.V…n>Pn)À—ûGÜéì#}s÷“€òÇô•€Rfg§(\ÐÍÁÊb™ ­ýºµÇVæš9Ëæš¡ëÏmø?@±gYK?(nÙ¥Ú¯ŒÝ×nÚoÝ3Šýp˜B·›4Ç¤Ø$VY OÅeÔÊƒùT¹/C”‘UÈ˜ˆ%ÿu¤î±cß¯=€f•ƒìSêIâˆüÌ2á:ZaÖfªt²ƒ'ñ9ü]{ŽHrdvû%ÇSÐvÉíºÄà‹IJ]N Ùx½®Cü5’ñ¥œ¤ M.8sÏN½y”õVÈ%Þ!½(žžÑ/ ‰˜~šÎ'AŽ 8´ÞbdcvÄ#“nŸšÌL6‰Ò]Ò”iÒ4‡FvOd…w ù¥rŽÒÂÞ_Û.C=,CËµI£˜…YD{s,òà`å¢¶»?~Kâé‹à´Öq-Ùæ´eDtç6¹È`›ƒëœ¦…,#¤sƒ¼Ðl©,´Ýjá$ÜõÈñ¾¿p¶‚q\K½ù~½<eçZù;làÅmýóŽU[7ÖX¹}Ÿ'ÞŒa
›º^I8ÅSkõ¥.¥’€nb^TäºŸ`7¶9“×q5ýœxk«[’¨” ­:í!Š¾ÿŸ3âVnñ\¯ŒVm{õ*ß¯t¡…¶/nË‹[êÅN9Vy=ó-îÔí'»¸^º©ö D%Ÿköi±“Íê¼žÙ½w˜nírí6æ¼ÐU¤¤íNº“žë2ã¹EÅ~Æå»Åì,5?5Ÿ?MÛs¢8‹®×L"ÔiÌ YyM.;™æ5ú#¶Þœlô3Ýû‡@Õ¸«ªšžT›ŒÝ$ÿf>µ¤õÇ/cëGßÎÛG|ëZÇsÛGŸ%¡í£o¼lŠæ©`Ù•j)M4kAŠ¼°A*×£¸¥%œN1¤Ž˜q˜ÀŽ¹mÂŸ–~ˆ<—íKæâa‚©ªÄ6Xó't±ðÎ‰iD®FL7ª¤mDë•\«}¥"‡O‘¤g˜Åð·w,«uk?þØllwòF²°6e¢­<j'PB=úPQuÚ€ZAPËeI\þ°½ÂT[n«Œ4(Òo {ˆ¤ŒhØ]•3&µ2H˜5áWìô€EK›çêkš¤vl^âÚ*¿oÓ0¥àHCð; ,ø‰ÎïpmýØ·H5ÕÕ4aƒó;ó0C!\_rc¼ï¾Ã¹Éûº©·ìx eá8:¹p‡&<aÍSÏ?«Î¢`*­b®šv©«bbMüÆmËLéÐU¶.?¨¤Vµvþª·ëL½]“4Ë‰ßÒÏÙÎ0Ua÷ãeÊ#¸v«Ý|ƒõét–ˆP–TÿrX GVƒRPÅ’¸¶S%ÎRL[nÓxå¾Ðbwƒ¬‹Žsï¸Ð¶WçyÏ„!+%‡¿±üÇðFW »Ê¦ÇôÀ\­» D9åIy¶›Íê)Æ(ÚÚ0¥ê@Ð_[!›ËLûK‚j„¥!}}) %éyR4¦ÜpÅjÏ0¬¾Ö›`W•§{{/zí{€Öœ¦öïârëoº´^7šº 9—ûqýpîHçÀ›V/BAU†únrB.%µ\ðHìuÒ.*ÙuŠk¾ij:l–Ì§#P:*¬I-v¹äìò„ô¬ÝSõ¦”ÚD|¿Ž =²Ó±_ÈD¬WfS°nÇ•;#‚ªÒ“‚¡XwªÌ¥%[§Ü#öíbºÔ«¶®•íš^¿ÁºÐº§@½°›¯KÛœÌž`”'Èœby÷®vÈ·—Bþ\}l×L‡Ð5m>l¢tÓ` eç»F°Æñ?hz³´Ó´d‘ù]OÒ~DPØLÓíý4Œ‚çVÚ	J“NÎHšŒ0‚Rýñ¢Œ}Í¢xËž¦cöO|ò8‡`ÀKtÓ8è$Ç1UA.-MãøªSD"PÝ»9§Ù'ÃÑØKö²þâµ÷ž´g&ì]{†j
™¿^:èñÍfé±Æ¡ï¦Ÿ¦ñùBŸï|à&Ï.*pLÏèÉç1Ù¬OSUUt9Â„ÀÓá¹°ÑËÖþJ»¾,õ·‡K%¡_¨âÄ÷Òqà—vƒ–âäûŠYÍ+2‰“ú;ã4µ@w‰¶·°{´
ë|Ü:ÜYå¾zj?2/ŒRrìMƒ¨òˆy©ÅŠ›-÷Z5sÃ+ÓYä]ðtö¹ÝµšÓ8™xôã¿E‚Ö$Õ›;(Jvù^0üô]ÏÙõ\á¤È>Å•fÆšƒÕ§ŒMtß)1\ëˆËHpOw;£Ù›uƒ]!ZÇX¹·:Eß”&n]\’›°Ä]ya™Ôt>§ŽBð?ÿý_ÿ»Yþ]ÁdïÜÁé(üÌÙ<ó ¾¡<póÐyOÉ¥ÊaNè&Öj‹lvp„Ò|ŸÅKZÜciX=ÜkÛày[u¡1ÄºÕ3{·ò/tD‰¨”ÛŠåÚ-DË¬W€õiÍú¤bHAOJS±ÂÌ£´±ôø(Éç}ŽP"R˜#„n6SØ†`ÐM.À¬J¿HGT™šGô•,&çqòéž1;½^ì²nò˜ŽŽ8§äÔóñßü
tÓI(h«ÒÁ|£fàÛ5ßžù÷N˜~»åq’M·Æè"‹Ä…Àõ¾Eêg&Œùç‰/Ë^~'Þò[­ÿ ˆ€3¦eSçp§?†ÿUEÀXÚ©Ö7*£™·kÜŽÊ®FGê«áê«áªªt5\éèlátpÞ™äŒ–åÊ½R×l/ë4ÐÊnqO`MÇ1Æ)F$ÑÓ$ŽXO‹éã"|ôÒàGMtËZámt2¬˜ê×ñJû[4*ª»Þ±8]—-¬ÕVWcjÝé¬«¤ëÆPŠ«­nœÖÁ ÏÞoÍì]^-ÃiÂ½ÚŒý#¼Ë`#6Þ÷®m—¼Ù\ [Šá?W-x#S¶œIà‡ó‰ÒU­Ê¯‰ŒœµÜ`>eÖÒž…™d-MÇq’a„7ŒÕÊ98P÷ªoKË@ŽåÙuZ])}é.AJÈÀ{°ùq¢è Õ]\_×t•íÜS¨PÂ; ˜ô«ÇKò§¥Eè)ò–„Ø²××œMw±À³ µµTôÛk¨Ë|J*YÔàÏÁÈK|¨¤>/3=Ô –TB}èÍçí|F×Í:€Ì;Ñ›ñÜ‰æ¹ËHEÞ,š¢»²qàù&Û,Ñ,/y$@~?UÂ:±6+Ò^¨·8Â#®-Ššœ„ ßZ'žñ-và8HÂØ¿Õ.0£â-vŸu°ÍÞ43ËîÐ§’&¬þÙÍNbÿBåÚµÁá^²¹ºÕÐš¨NäÃ4Å³ÞE<·ÁîryFô´øå*¦T¥ê÷=HÄ°BNv„ñ=WÛN†#ºÙf¿—-Ï‚ìm8	úËdP<áŸ(œÅw˜;<oÑñ¾ þ®`qW­,Õ"Ë’Î›y'¿ä×Üù5çÜeUÅ9§YUqËuVU$+G¬m¯.QÏè~?s‹Ri¡¯e¾&ÒÐ2+VSwìáëÅÁ×‹ƒÊ² {Ë5XãsWê‚vüW~5 •bŠ¥Æ@¥'0SgË‹i¢ê¯Œ‘®,“Ï¶M&É¥G â9„¨L³šUè<XpeîŸ"ªáòÿ(]@Cõ¡ÈùCøªv5`çÕw'ÍÛ‘C­B™Å¾ôÖu©%µrï”{ù…Ç/j$œfPä)Yß¯o#ˆøcÙšÒí(™ÓÁË‰²žßZÜÝ±¥©p¹%µKv¿ul vyúÚ.:_zí%I|nÀEÜQ(OÃ¦cW›‰XØEÈ-ßà«-´Œ´tùÒËÆÃQFý¾y–	ä
ÛY%}º+¯‘¿%÷óÿmlÑ¾'ëWYaçûZš–/SX,ÒSc)ÏY¨†H6âÚjM¨?uðÃàk€,`B”ðñ<>~ýê—Ãƒ×ŒûwÍ¨éÓëÃÿz¸ÿ6ïSý¿¥¾ÀÇŽý€âRYäðR;ü›õ¶Ž]$.‹™j{ÃÖN,Þ6'Ú¤ßp	”ÑËe	<?úénÜk»¦­¨+ZÃŒfƒî3ì½£€èp‹–]2Ûk¼„íº\ééœæ¡JÝë\ÐñpÐ³u9ÁûB n‰SjkºUê[Å5R'Û~dðŒà©òu 6Ñ;C”·	òüW \Ž¼éKoêìê¾m¨Ù¨ òéúøï$š*òonˆa "ÒáCìÔfE¬éÚ÷†ƒ 
øá–î×¹;°Š¡tcTÈzçèðmâ¥ã»M‰·´),„øM¤˜[â!Õe<+íªz‘$ÊIó—lL,Jº}…×øð"X4v£¾3å™îšµäbédãkHžWÿ8º‚Õøw®¢ƒg- Œé§ËHò¬Ò"åkõ±2€Æ†‚8ä˜5ç|°~ÜETøÅþ×è/2a^° m¼eô±ó+ÝÍs:(ý{@»÷ÀÕªo“$`¼Y²ƒ+ŽúÕÿQ¬Aì®Ž7Ú(c4ìJësZÌ_¡1{‰Ê›ÃíÆ|vÐVgtV¨òªdpç¹‡µð5Saé‘]<%ýJyòêÇo¾Y]%ƒÁ€¼Û;$¿ÒEJŽ“8Ðg“¼¹H)Õþ¯Ço–É›çÏÈáçYœdd?žÌâ)ÀãÑW¿ù†9
î¿zùòÕÑŸiE~ºwôwoÈ#òº$àm±C–'aBç.%GO–VÈ(öáÛµ5J^ë–ÈÕŠúÂÞÁþSÒß;™“ƒ±wB»“ …^DžzÓOËJ%ÛPÉV¹’ƒç´Žƒù‰’çtí&áÈðò&¼¼Q~ùÙ}ùY˜ÐñÝ(¿þ ^_/¿þ’ª+t¹ñù…uñZù…Ÿß<ÝÇ§ÉËÐ§
'9ô¨ú%7µoÞ7ÌUDö¦©—„t‘F˜+YzíáCÊ kë†Ù9ôƒiø¤¿¿IöÁ•{€c¼\zÓÐáóh^Ý¢iJßdÈŸs•¼ÊÆpÛ ¿‰…¾ùÍ‡uÙ>%¸Ä‹àµ×ñNƒû˜#•ôOèWGX{Š÷xô»^o¹ø$¼^YUèûóˆˆ—ðð<Hö½4èó*<%}xlNGÑÜÒ~ozâ÷ÐÝJû>àDÝ[^ž¬½œ¤{•ÕyþèÄXŸGÉÌ2Ó*dä]]¡šëó‘òCFùZŒê«ë<õÌuž"CH=­|ælj2^©ntÂxF}‹3Lõ[ãôDã”š%@vQ^|RýRÀøÅ8äÑ¦¡²ÍšNG”y¯äK"¥Çd6£ã_gé›ð”‰ä—±+ýKºÔ¯è~³‚Xzf\)|·Wˆ—¬ªÌ™kþJž¹aæ'3oÂñôE|F®
h™“Þ‹÷öñ…‹çþŠŒò”ûölž¢5èSÎüQ®ƒn…TÓñ„ò7¯áPýN}ÿº¬›[Û÷xðpm]«ìDX™&0ÔÊU¡>­"ôýp¢h¯Å'õå7^ä%Ç{/ãÿèŽúCåÑ•6ˆ¹æÈ;‰ç	ÈZœøìEñY®}÷u0¢*Ø.“a+\–=~Ü¿¼ÒzZU(µ]!EVÕsø«U|ëØÙrðu5Mç.×¤t)}ãýƒÂ}†wNýNYšS/JµG³ IÃ4;œ‚ºÏúu¬|¥T%ó@€Òý)Èˆ€FOÊ>N—Àk¼HŸOY¦¬ée0‰KX î)ü–óÿæZqLbUÎ¼$K¥ÌJøü0EaÖïzÒ±
ªÅ§ÅIü97jªHEZóN;{õýÚ‡eý±	ŽòÜºüo!÷ü€Š¹»Ì
YC×–Â‰½rµRˆÎiš!V(Ï	Dµ&ˆ.¸«¶4×>ÈLÍlóÎå‡¯Œ
y6ñ+%YÆD<=@—céqyÏY´Gø{@xfî”ê)Q,uŸ¦=?<=¥U)%Î”Å(rT\<kÞ3t]ó1	å¢nºît¤%½rð=þfI0‹gs8‘óq0å«”¯"Sm†­,¯a0Úþ >?Ôvô/4nRÚ&¡Õ¨m+XciçPgN©@žªg<Œ27êÙÅþ,Ñ7ÿM„T¦ME›0Nöï?”ØTä‚~h°ob©€!Ô)@­ÜÂe†cØžÄÛ²¶Q5/½9ƒÈg b"Üäiàß43¸>_,.ÐÕƒl£ÛÔ_hFùÄ$ÅÛ‰Ù†Ç¨7:	Ë?‡žné¯a6î«¢]#4©Ýƒ ÇUhay»~Ñ®_Õ®ß¦]äyÑ9”ŸòúÁJ1+E×´
”Ú~(´œ©XSº¤tÿN¼Ñ'C/¨ö¢Bé¡}’4¢÷0ÀZ0ÂÃ;¤ýx4OŸ‹'ØN…,ªó¹Ôõ)ëP]0<²S}*¥çËê>€vEGu«¢Uù72|Ñ46¡nyñ?+ª×~Þ‘uo.ú¾ *Ã>Ó÷!ñÚ/ô…ò)èÂbS“^bŠ3Ï=õ§áˆ|O~Žç)Î¿'o1Ø•¾çOïEQ|¼˜†¦ì!`†,ð&L½:=Ga¹+`‚äŸƒ•“NyK¿ê™çV¹7É`9xý%ËÚªaO’ÀûäÇçÓ'ta$´©5ð]UóÑ™Íò›Á$Â~+õb‡Ì†gIœ¦ìðñ#Ì1QÚb]¬(à£!ø[—rZi˜s0ò}c˜‚ßøJ²Y˜ÑNìMâù4Ã^QÏÂ	¢¯Òzò‡Yu¸Ã£AÐP¯/&v6ÌâŒRg.ñ4
ã¢¼ R‰ZöHÒ‘þ^þQ	ñŽ.vªë’¸x§$+Ê¯y£ÌRÞ0õ*B‘7
ú«ÿ˜~¿J7”[Ëo
æÛQ¹¶ü .'[î‚îØï3¤Tk¨\,é5i¥MÝÊ×G}Ë¯jjJ•KÞÊl˜P»’4$IWÐwmk…r†VÀüðZœ?%‘öA9ÑM0Ü¡]û šiŸF’’†§ûôUØçT0ƒÖÉÕår¨°öH‚(ÿ”#<qqÓe0<’?Ñòò%éOc2¾˜QÅº
¼“8ãøâQü3>R:4
’¤ÇÆu÷Ð*ƒHZ=5 K<óJ$Ø-Ó­¯-£|€.^¾hµMãspüW*ÓÏ˜Ð"èã·—¼þ"éV‘¤ k0óü7 ñô7èÖzËW¦§_†Óy˜Ÿÿ¨7¼‹ð¼òJéO¡Übd-=› }ý~:ŸP"dŽJó	æIÁxÎbÜQú¦I§“÷sàùA¢¯é(y6$:'oö_¯|{©Ñ×ýJ;–ÀWbõÄß0+ð·Dàk?ü!ñjeïð`’?q£—´Ü›ÊÊƒLÌ¯æe¾Uàã¨RiASOÊ*ºP2£À]$w‚7†-`„(!@¥²"ƒÚ¦|AwÞpÒ‡pì?<ØÊ©§Pï‡#q¼ëIä³¾^¦©uè"WeyO¤à€Ëi·°êÃ©ß_ßb×+Ûû|øV³úüéÞQU?¸N™ó}	'!ÿÄg€Òä;ˆÿ`—t>zGÞëÕwã ïîèrÍ@2åæŒÜXÃLEýB,:ioÑ*Þá¦*Å¼²tƒM·_Ñ¡HR‹Šƒgó(ú­ _}³ª{ÝP7v¾‘K¦Êóø'F›T¶ÁH®9Ýaë15X[7R¹r®.BÚÍÒÑ¤}<< ù““9ˆ‹‚c4ù“!
iàsÑV‡Ø¤Ù'IÍ‘D&ûMUgJ?K§hé§ªÖ¡ÛÞs»B†Ã¡L†‰Ãi¿÷É?N³†~KQºiPnm…KºJUä/
}Ä¯¤š4¸áÓvdcçoùï‡I*Õš{Þ·ŸïÁ¬-‚@YÑF#ÛŒ©ˆ×$1Ô6œÍÓqI\ûy~@&sÚ,=cŸ½Q]ÐZN¦2ø—J&2Ñmåž<¬éßmv‰Ì+ xš×»òÐ¢'ùpzš„)œÝ¤{:ƒ’ý\zïGÔ_Å¶FÏd‡ÞhlÚÚP]Ôv*ÐÕ­Ê°…ÈË´¥Ï”r×¿ÿ^$W¦ž{v£Ø,xƒ»õÍá,T7¤ð´h˜àÇ W­6•tåW®
S&ñ’@ô…xŒ]hYè®¤9:"ÒßËSÄŸO&¸g“órIüxgülà/?VR®B–ýÇ‡åžÁ!Htv3œ²ÞÃÏ¯ÄR­ºƒvÜäh.€Ø¥q~6a·’bîÏì®Lˆ—^LGD—?åk9q“&žÈ¨]ÒôÖ‡ä ¤Ë¿’±²ÅsŸ<%ó;I|Šv†0BQH&•o#fAfkT¢qõºè»ïˆzh¢m6nÖ4ÞyÐ1›±Óèî¡ÔoœÕÆø¶X¥g®~,}å{¡è'ï@_êõ²Î•úÔoXNý$öÃÓ²ô ?m¿CB…»-Àe‰sÂ&€…ÉœÈÒÒb¨sVtõœl`&(°Ð}~/ =âo™…bzì¥/cÐËñ>Øì„*ÃÜ]Âbºi¾¡¿„¡ÉvêÄ`q¥c5?`;5Öìª1BQ^­$RQèøúêTä_^Ì:Ê\jýÙ)ƒ,*«©˜J(ù*¨¨@Ÿ­œrf!¯˜lýG9|×4Ÿ¡l™—‡×q•£`o×u‹ñyJ÷qÒ†u¬ë-KŽ1°9ä—Ö”ÛÑ–è(ö OxvF5-¼©£âß‹˜¸ÍÂ“žÚTCc¦“(>áŸ§ôÏþûÂŠö°5 ††9¡Uªä„ÓÐŒîæÙéàA/7ªÕFá29	ÒåØ—‡Q Ÿú=Ï|zìfƒíÇT¿§ï½{ý‚·û
}èç>×ôJ>…xXÓí76e†t®>*A4R_Ï{	´ƒ.Z&ÒÁú½_ßHÎ»O‡øQX?}ü–öÛKe“ Òhwé2÷®HÿÛKeÚ®–©ÚDå5˜Šd~•ôt6ÙlésªQ wV“ìŠî1ÙhL+pèÑÇkGÁì/=óBØK‚ÏÁˆpX!ÜKQ5eœÄÓðwJÃçI˜éÎÒ
a•Ê­¡>Ò•ƒB#û±¡àÿùÊ”ÐLKÀüBŒÖ<0®­­n­áNê'ñ¢È„Õè¼ÿ;@{¬}Àt[9vã…	ÖZ`¦B‡JÄb(¥GY@È¡n¯€Ý6¡„AIó—×ñM#¼h„Ô¶ISR2I¼"ŒA`†CþVÉÜø·èãjö2xn<xÿpã·ñ9¹_žÔ:+ý,;íCafî5f6f¥­Bú&
D…È©¦Š
Æj‰îqjiaé`Ã)=ƒÅzØ"DQð_î—€HùÍ'»/è™dâ%Î ¡%Í ”»j"ËÕ&¦â ;ƒÄv	¶Ø]otˆQ)L&‚J™L–çW`)wÉ§2Ò'°¡èLó}îyAÐC¿©`§Ý‚·à°¢–)ië –ºŸxPcŒË÷‰+=RÑÌU‚*!×´	x@C×ª¤±ê@¾ª,¬&¶×Dyž{ç>Hë%€?c_XÖòl>#?A
Óª,ånùN·x‚S9à@ãåÜØîQdzòdC”li³@¢+M{’jÊC´KO)AT–V‰Œ\ŒÅ”¹ñ½”ÓÒãõ!ÉM¢¨%í®b“ÝbZTs¨îo^4§›jÉó²9J’ò	j+.-õráÿ3/9²!6czYFRÎ½uRPõ0&¡¾  ‚zžaª¹)äû=¥ê~º¦lÈ'Z|È÷–µÕõ5þƒº‡lÛ}:©nn¼,¼oÑ·Pr!¶Ì)ÏPÎ#úü«òõÅé?X½»Ê´ÈóÒ˜è…QNë­°¯Þ6KnÉËW?¿>,ÝQØ±f8Í-8N°¬ëÍ!èTo|ç¢G—ë›Í\Æ‰B?.¶`yÝKZexÃÃmÈ€I<Íë~;’ 
ÎË˜v'H-åWYõï5+œ_"7mIõUÛ]à¨‡Ö¥;Ë´`¨²“ïW†rg¨‡Åü´5Ä£]OxgøÈagÊÚ°P>òJæyÿß¼Áï{ƒX<üp‹ltG™çÝîÙèž„ó®,TóSåqò„t.+S€1`$iå	óRwbÑbØìñR¤¼Æ«÷uëQžÒX9ŒÂaU&W'øvÖÜÉÎ":ä”¨Î±EÆô?©ñû–é
]½ ûÂÛˆ¬²uLI¿j¥®–m}mp[æŠ„…æ~˜Ž(¡¶‰|ìW&ÕtX´ƒÉ/ˆE‡%É
	]NpQÈNo!=­Ñ·éQ-
qL›×Èþzô—J.ÍÝqì>bò]Œ½Vè&†3Àø¨ŒdvPÚhóñó87òš‡öõËªe ¥]ë¤A#zÂýÆ_²ü¥ªÌã|€);ÔÛ6Î~M\¸¨3}ÕŠ,Xõ¾«…°(—kâúdsu©ú›ªRßª’°j©W¥¤¬b‰œ¥…m~VölUŽÖšk›JrÖ¨IätPUJÊg£OT	˜ÖÈï´BHòR¢ÏMLzzJ^°™Ø§­ª9èIÞvë[þr÷jy%;‚2•¹k•{ÌÉ‘;yÓý<™ºV«â¸AD×bjä©TÑ³y¡5ŠðÍVª“qqÓ·ôø(È@ ;¤¦mÌËŸ²Í©l—ØTœlÓ»6Ä³Ô‹ û¸’G¤ÙEXñ¶O¸ª4ÇF,½€¯;«+•§,;+ÚÇ“‹¶HÏPJ Ñ6—gI/ªNA(Åq“ÿµdªLÜœÛ‰¨dÅ0×K-ê–Soµ^KIUq±TÙ¦²ÕÎ—ÛZšJŸüIwˆÐÖŒ‘ÐØÉÿ  ÿÿ <ÇÓ~xœì½ÝvG’0x?O‘Íñ4@ AR’%J”†&)›3É&i»=}RHePÕU‘l6ÏÙ«½ÝsöìÕ^ícìóÌì+lDþTþÖ@Rvw»fZ«2####ã'32’’'žíN‚ÙÝ¾¡dûÉh~âyº¤£¬¤ô3¾nß^¯‡uÈ»´ŽÞoÚËƒô‚æ½ÏA4§½”&Q0¤íµÿÞ[»èVk•Ü®®ÞþKYÃuƒ6‰£M·o>~óì1 @Úo‚(ÃOä;:£iÓÑêÇåÛFA–SèýÇËîæS’t×{OÈ N¡U’ÆóÙˆŽºÑÇ³¼;g1ÉéUÞÒYØï«Œ ªä«›i˜eáì‚‘¼&-¬Lðïf¿Oâ'ýµÍ>Â_<ë÷[d«¨’EÐ¿î¼¼]²k¯®ör--Q+iÄ\Iº›+‹a€2ÑaN–RÆŒÛ7iN“(¾¦ô4žç0 »ñˆ.Ï(î,ÑÀ.2Mî6'kœj3ŒÎº“ft2Fì£pF»³xFáÓpžm¥ÐîºþG8…1ðiŸLƒ«îe÷Ýú“~rõ~e©,ÇøÜì¿}{|ôá‡ýßîýçYo$íö ˜}êÁÁèj•iøø¼Œ“<Œgä½Þ¾A˜·’•°™ÞÙçÿ=ƒ¸}¹Æ+,ß«eáåŸ#s;œ%ó;Líü:ö‘Ÿ—c@|Ä˜†0Ÿ¡äÛÛgËæÃ$¶þm‹´•$éáò·¿¡n»OQr€~1¢ëÕ•ƒYFÓœÀÄ"0³–§«©I?nªIA0Í“„¦Ã £J{"E4Ý™BÕ®9ñ§¦7ñÏ$­©›¿ê,›ÍÑ"Yž¦álûf}y.}³}³y b¢‚ëì$G%sÝú¼Å^ÌÞ“NîsŠï‰v*gùÛ Ÿô€píÍõŽø#¸jÃï#6mS
¬®ÞÑÀÖ8ï²»¾A[ÊÜõÃì¿¼ÌÌå8èWŸix1É…¬¢£p>µº¥ÄØÊ+°5ÇáQ^÷òø0=ËÑ†jÜÖ!78+Âé|ú&†h;ì…ažm‘ò»÷ñí¯ÚµÏAèÎß]ïú‰ì­0dŸ:½›Ñü7Ô1¨‘6¯±ú¢QÑÛ†"â&¥C˜ôY/¢³‹|B¶ATöÉÿ¸€]ýrôyÅ8:KÐÏn½î>såçÒÇrQ­¼:Š	’ÿ3%ÒRCoFþ…z“0ƒF¦ÐÆuo±1i>hÀñèºÂÉV^èåÚ(üìÿ,>y¿Ý¬}MÎÞÎÝäôNH/É×k~¼_$}0²lÆîuw£Â&y9ÙÔ«˜k#j*ªTv_Óç:œ—!xÓbúf`¯¼*–yúoÂˆÈ·qÈ×ÈI,p³|õåÚd³K«g`RrŒž÷û:‚›º¨àÞ­£ïK"Œ×”FH}P›å¸qy(ŠÕlŒâKEÐ!æNO âc2þLÓqƒyîÝuƒ(Z!y˜G€ån"ýbèfrMA€!às£ÆN|	Å]?	sÊ¾t/Ó Q˜…ã]œ•3¾
V8¼	ókl;¥3ìXÀFb
þpDÆ0`Æ¬€¬XwáÚ’×Î{dä7qŒñMã(ór±=ÎI÷©’Ü›uîXð?žÀ¨GôŠýÓÉD²éûÆ—è6Í¤8úežåáøº; ù%¥3r #”ÅË( µ4tX#<¬¿A†ó4‹Ón‡ì¥`\¤©šy,~nÕ'tøi_U[e¬mßÀüÌÂ,ßŸ¡LU‹8×æ=1j+ëU€¯™†uú˜Là¶*7†qSÙ¨þ%¬µ¾þ!Çn…Za„¾„ù3+—v…iÌQ\W^ ¬@Á‚–eëL#š!0o[¬³õöóÂ³U”Ÿ3àŒˆM½Q j$åË5l¸l"1.+Q ö|`ˆ<Wµ˜ór0ÏsÀµnàQ:mßà8«YdÕ§äU÷	5¿^È~”KµîXNÙ©ŸÖß@Ù	ÊÓ­bN¯¯,CÔÎ,q4PØJMËY¢ZÒî³!*„ 'ç}Ñ¦Û(¢ûW	è?ÉÕt…›†Û7a¬ˆ+×lºf(î}–ß"ÃøTFm~ã ÞáØH<¶bÐ@ XPâï„ô›ÅLûÅ—T-gRàÆ…w0Á[-ô®Ä‹	¿ü]vä_îÅ—³(F±µRçÍ:#òš´øÐô1ªØŒü‘ìe iÙB—´‰àmÑn8 U>fÕ¼W­ƒÍWÓiÜ3¾hÁ)¹}ñ/ÿ¦	Øq'Á5(èè”^€ éh´lãÒGa§wHƒÑ1Â™Ó™8š3éï¹ê£#¶Ó®g?8‰:džÑ´#¬úÁÄ³Ãø‚ÜnÉrÍvn8v‘wÒáä¤*BÎÏŠ?ßB ì,z¶[-éSÉj“øò§${‚ˆWÔ^UÇA”Q³ö0˜½fÁdàÅÓ×=î¸Î	¥^÷ìR/þE‡£„££ýÂ±a@ÞÒiÜnëý„'¥ù<)Úöxåv›nYßª¢!Ë$ _êÏFíöp,-ö‘U²í&#hOÔ²<Qq÷§!òiv0"XÞÌ§0Û ×T}aëé% N`2¡xã`6ÄüZHíiûAEöw0ä¿ì‚70`Š¿ØBÂ%Xm¯ª]ñwÿ+èþu§û_ýîó÷bÜ‡+ŒÞþÁžkÐpX’€@“¦Ë ÄT mêÖ õ@9˜…Ù^<DáH"“&…ÃÙ0šã&lÙ¬Â`ú Z„¸'¨-în›3šTÐ¯¶ÉfùÊŒÆBª9À\Ô1Xe‘Š;8Õœ:«æ+›„g¥Ìk“4bë­½FT›²Ü»Àõ‚rðõÃ@§ .ÁW¸o¸jÎ©y~+æüm‡¼Ó”´®>ýð~õ«³¶FNiÊ,Q2žÏ˜"0ït]¦Û«o„^ÃÙné¤pLÚŽÚ3LÓUKƒMóöÊQ\¨Km!¼'ŽXoÅ’gœ×´¾¿„Ú §ðsqaÁM”êM–S:D­­ìœB/§ÊZQ›Ì¨+™nG8ÅÓ A{øÎyöS˜OÚ†a´ê•Ñ¬Ý=:Âv•MU´;RíŽÊÚ-Ón‚æCçèb	{¦ÖZA‡ŽBmµB¹
paöFí«0Ó`ÊÐlÇá0¾ÆãNýãZôÀ€ä^YZ\ÀÎã<ˆ¾¹…4*ðÅÔ¢ív6Ÿn¾Ú!Ú8Á{òc&Xõ§8ýD™Ó_íÀÿ,a&©’Ò¬Ü4Úò²<Ÿg¬;Çœ±—½“Óý³ý£óU1ìÖ„ì¼qçzKr*Áp¥Öáb°SU}V±¯$ã(aêž‚l¶Ä y\'Ø”9Üà±?™Çƒ]·|•¿²pHx%¤7Hið	<ÀYoÀŠn‘¾o‚œçzÀô1D‡5aÅ±´~È>ðG`j|P†@F8KAiÅ %…1N¢¦Ã^ª¬Ëçè2£h¬“Ëre€Žó	˜Ì;è²#»Ö€‹YéPß¥q–©áLzø‚ÿí+ÿÃ,	@bµwHÛUV…‘Ž(#ö^!UõÎÛÇsÂFC•?ÎK‡
ïLãù,g¥ãœÿá+yDs½·Å~¤YôÖÔÐ–¢ºD¹òçÃ³?÷æye½_²xö!?dJó6ª1MØŠ*³Ê Ž?}˜ÑË¶VÒþ$	È#õrÐv;dE:·R£¯Ø.Ó0§¸qÃê|å?ÈE²â‡¯nQrÛ»Š²«Ü­éëÆÄó­m;ÂPâôwåý»òþ]y%WÞ¿+oèwåíþgSÞ0úëm¨³˜Ê¾ 9 É¢0ù>ŸFoâ´W ¼5Ü!	ªšêÙÒäé)Û¬z÷^SG[¤~õÕÀ$‹|±µýCéªÕSV+§¢Š†ì&ÇÓm¦:ÀÀÃO;Ž®EgÝÎZQtýÊ(: D‹ììïµt…)ˆÓi³áEdXÇ¡Õ²¡Ö†f‘$ÔèeIæíV×^ñfkQ¬´\ÂøáU©­% ¯‘rMÜf€ê>ápÞõßÛmhVŸ[|½¤8ÚwP&=(¨œ¶±11!H—¬wÈº]O ÌC{ŒFtÌ£œŸ.­(Õa½€¿`di[Å¡9Á­~²p—m}„,Ôab±‚zÄö–ÔÎ[ä<ž  uöÄ~áfìçÙ5£©ÁHeÀz]ËNc&_­üÎfæ¾(ú: uC$ØŽçÂ’mäa©®ÙJé²?¹Òd?ƒ0=‡Ÿ¨øÑà3-äNŸÜ"(u‹Ý¿¹õr€ìá!Hc¨ôÎUO7„„lYfVCã·ê·µ¦ê	CE3DeÙÙêê…‰âPª±¦DÐË¡HYãilõ^§{umË<Ê$>¦5u?Ó4£AïÉzÊ¢ Övý{Û'Ð‡¸si?NÚ´à‘lø0¾…Ïx>€¼nîaóð3¦±VpøZ>æôx´M$Ø’ccºAñþbø¼ÌSÐ×Õ(‚|qžÇ HÖ“+’Å„ÿ:^??QwÃ‡¬$aT&@é˜õÇÉÕq²6
/f8àãüÆÇ Îþõñ7Ož<}þ‚Ç\RŒß"Oú}hñ«E²&!ÜàÀbÓýñú7…Ä7	Ð°ÅXÖ†’WÄ)ôŒ˜Åw¦H'4Ê¨_Þq·	8—˜ Òì{«[ÀšuiÓà…Ÿé+Xé>Xè!X§|€„úh­¬b1FO ÅC Ã¿RŽ–jÿùã`sðÌj†Š6z†TzÎºyôÔª›@_Ý(õ–èN,ùwÂ™PwœqmÉïG¯rûôvm’V±iipÕñœaW–N3Ïô²§3•dånR²§¡œ¼/ùe™]ãÕÈÍ/Îìø|ucúÿ·D.¾¯Aº‚ƒù÷j9ýpœ¬˜¯R[”h
›5qëšøáL˜ÕO-«Z²÷.›ÛÎBÒ¾§Ox»owår‚Ç<Ú&´—²]gbýÆ57uƒ¼•, °Ë]!dä…æº!û–nµ°3æÑ£~fA†Pû•Ž®á–@«"Š“b=ÇöËÌ¯^Ak5úÛãˆåÄë!®­Æc”¬¤}x|âÆV)ÄšÈÖá`ô„®ß›!á¬ÜÞ±¼»Føú.[JÿY£áÆÓ§^™Ú•BUg¶eí}RK–…?‡çU\wÎžØ^`/ðYÌÿ üþÕöÏ-UEà…fqNA‘|lÄ÷Á:üŸ­JËùþ`oiíÜr>ýˆ;[e÷¿»*YšUWí…4Å\R©{D0Ð~÷„pµVq¸³Š,ôº²\³ÿæ9ûO·[ƒSªÝÅr²5ê”ö‰íõtñ”jÎhº¢z{A»Ì‹ìãœâþDt	¥_Ëp„‹Ïëýþ¿½à)§ø‹g}6…ùìÜ"xj–àYÙ¤ ÜcVb_á¤go
n`ïñ·ÁRÿÉ3Á(œã¦‡?]°G]9ÿÆìñ²‡ÒèvÉ÷û;{û§¤Ûõ…&ªFa–DÁõ;•ô¢8Y*Ž÷n~XW4}AOtÙá%^¥Ë=^‹ý7T_é}6îÔRE+²š/KgJ4Y—½’ƒÕ"‹ËâgØ¢!Ãžƒs=926žÃÁìö{ýM:Ó‚Í Ü]ØR§È™+¤m#€œ¬W¡šØ˜>‚õñÿŒ×7Œ¿Ñ1~úø›ÇÏ.ÆýÞú“:„‹P4êÎ`¶¼\KJM 
óHc&WlT®”hÌÇNŸŸ=Ñú¼ñäé&x§	ŸÂ4ñÍ¸Áx4SmÎ>Ca÷,¹r&!§y1/ÂËU7ˆâá§¦¨Úƒª°ªÍMÿ·Òlºï¿=9<þyŸ½9&ßì-0õ/Òpô‚ýÛÍ1ªÏ¨IçÓ’cœâÿ^à!Å*	õlŒ‡}ùô¶iû´lÎûÆ¬NqV‹Ðqx²SöÖï-@>
’˜Nþ2gßf“•†‰G|—Mzw6¼ÿç»D~³Ï0*¦îÁÞVÓ¬"Ú÷.ô<=<ò«Qb™&©K¾ Õ4:¡Lþ‚”IÿŽ(µG3Ú_÷I§ÍÍÇëOž”,ÒÞHµú÷F.‘À €/J-Ù(‹L8ZÛiÝÕªóþÔéþN	6™ø…XàÛ`ö‰°°†1Mÿ®fÃü¾EpÍdÁd¹, ç^§Ê—%æcy0­5¦aÆæ˜bNž9ñÖÑ&»„IÊeðh¹ÏE¥$/2ÔÞ+¹•Ù­Å_ßç ¬÷ÏŸÙËÞÏlmO±Ö}¢/ok·- öÆXE¼ŒÙ¿&œ^ßeÓ´xÚØunÊ–‡n‰ A‡Qå’ÒOÇã±øôüÇüS2Dáð{t*‚kQ@üU±‘av¾fóÕx*×g-°xëaôw?¹sztpôÝ¦yÙßûa÷üàøèŒœìíw¿ý¹‹ÿ} ÿráE!¯ŒöñbU VIkw‡+¥§µ&çJMgv{–gúÏª—g”ËÂoö,TðpÙ¨~24ú£
)¬¤G-ÏßÝ¾Û(qýå¢¡L›‡"ƒ-0ÛDÀ5³‚/Šl†[dŽFtÖ€,/¤Æh9m¿¿QjS}‡ |ÕÄe½ãîbjsÉé]èß(ú½¦a{ós5’wkÃ&791ðáÛMFˆßén›Y²¥Ö$K­Ê‡*D–:5ô€BKnÜýÝ
-E¥ßEÕb¢ÊÜÀ¼aEÇã„Õ˜ƒapÿÂÊØ6„Ã9Šg¾”¸*Ç¨«É+SñÛ•XeïKìÄ£ýsr¶s¸sú39Ùi²éàã«þx4~¬æ–ÆAƒÁø›Q_ßUÀÝ×Š­…»lgòdŒŽõ)|Â%WÀJœ¦™[![=[|(×òéÓ'›1f¤8JðÒ‡ZÉX†á†>ã¼A4ÌsÖ}:n¦ÿHÓpÒALŠÈ:ÓŒ ]bOÕeöÄlüÛ,ë:pk›Xß€\ò¬¿9*ß&®•w2À«8³[™Žøþ7ßŸïŸ’³óóý·ûGçf­&àÝºbkŸ÷íñ=V4Õg€k­ œŽ¼â±EBà™Ð¶—+ƒ¹Î1?üÀNùÍqÀ.Š´îŸ'*B‚ÙˆŒbšîÎIJÿ2S
µ’ÉuS³<˜&ìþ–¤ÌbBdG¶ƒ÷ d½EÇâìà»£ã7op0Þžœ=ŒSý¤J‚UŽó(È&T‹W1zÃÖŠæyäˆXªž!/³<g'{Á·  ß’w8Í1¡íž±-§yŠ	­YC•È	MéàF÷Ó,¾Œèè‚bÎb&9FÄN¯	LcÁIžÑ×YàŸšþ;ó|§€ÓHŒ@œ^77qÊ&'Ì°ÑÉnFÛ,gÒT¾“±iVwavQ‘M€%ã=NèŒeè=(ùX—­ ~‹	K€z¿ÕÂ”‡ž%ãOÒ—KYbÿGêËbÊüÌæQôªÿ®úr!±ºCÌù³ÏÆ!žGnó‹
A$±"Çü/ûx<×ÿ¡ßU'Y¢<…Ìrßú+9…¿pF¥_%ÒR¹”œêH¾ŸÂÙ(Æ|Ù—ìG/†k·ZÒú0ˆ‚Ù'#Y=­š0¶JÁ°Ksr ¶‰a+µ†ÿ1ð¨hÀÀkŸ8˜Ð <N/Ay%CäÀn-â;Øo3	¸X¬x	,&P+dÝ¿‡Sv,}žFíÖ$Ï“lkmEiÖ»ˆc+Af˜`m˜e¯ùÞ6Ë²u	¢ößƒ¤Ek-s”ºèS<ï÷ÿ(Dövv$Nž	%75øqÍòÕ˜Û=ëÒº}QSWÆ;ªÚüOÒÂ…“¦pb×*z‹ˆT¬Ô“é”¥yZïÃÊ¶+,lôœkûlì™òÜ+0ðž n†O]¿+›¬_W°ð‘kKrù£C	c‰ãYÌè{‘ÂÅlm\*[%àÌrFv6ZvŠûQ­ŒÃü<>	À¥EØÑ\x¾ñoT#ðšü|i|´—Ìô­&›n`“>…y—I+>Ý`„«:5ß¥A2	‡ì:z†=ƒ>ŸælÝê­ÖÉÃ7Sy>E¶4CŒÝX€€¬Ýñýº,3ƒþõìiN|JÜS¬Û.…Iåj7p{ÎLÈ‚ñÿìÂ¾ l°né! £TE“ÿŽ&œ¥êHH´òƒUUôwÁé[!¢Œ·J5íbé‰¦2Åùr­Du¿¬XýêF3C<M¾\óT†–Lãá£nyhÆOq±ÏaÖ–æˆ®u½Å‡xQ»¬»<Êø
2â<œÒxž;—q8µÙï¶­øõnë·²Ùï—¤Ss­~+šQ…ËÑ¦V·Ê¼¨vžÎi=B;Q$jfžÌ¬•¿¼×Óñgy{«É
aöçœÝòòðgÛ—~¶¡·t¯©g:K÷švöîygÂ?º/FMÁ/åÞ`céâd¿û5¿û5¿û5¿û5UCò»_ã{~÷kþ©ü‹`+;]¾0b[0uw8	£àèü9ÆÀß€;eB¿»T.ÕK%ï+
–Ý€þŒ`"àFo8#ã`Äþtg?ºã4žŠ]¸îc2š§ÌpÁÛ‡íí>ï}¼Å­ÓÓ‘ºu~/wñty\ÌËÉ†sy1^]î½Q÷9¿)—_Ðžãv";zÅò†ËdàÀG%M%NKò¦í~që4ï®¯¼bvnt-#TÖAÜyÄ^˜Ÿ…§Àtÿ´|é–£äÎ°å÷!Ûõñø¯ G9˜Tž²ç÷ê•ƒHêyNY>¼Û:Nºëk„G1
]³Æå×ü˜â¼Í.›?`Óä‘¬Ä ª8qÕ…¸LBgÕÑ6¹D\Ü"ŽUß NØõà$šn¯ˆÞg˜Bo‹¯®ú9ˆætûF]9W#¶Ý‹ÇÕí®êÒqµæÊqãVã¨»¾²Ä¸Û¸ÙÕÚÅ ÇXê¦×´ÛÇëc¶¶.¯(—©<|£‰×_vŸ>nraué×‡C,Åéäå.Xô³Q–3ûæ=3ûÓÅ™½·sfg‹+Õ%–ÕöÚ[¼%×n¿2.7vx¶Å³}äÙÇwâÙÒ{ÕŠ™Wuµt<+ƒóênT·nS·—+ˆ¯~Fã®hhp¡qeq:õTy|Lô‹Ó«Ç¡ä¶rE8›¢Ä,¾°D6TNFš–\f®.Ç5+¶^U&c*/¼o>6Ü´®ßæKÅË¸
þIßšâýºçêzx·öLŒžv›ýowáÀwúäC£À¦lLùMjä§<aøæÇÓº¼m™1äSÈP0Oî6erRSÁÒŒ]|ààak¹Û+‚ê;‡‡ê†ºÚ¹ÌºN…uwØî_i´#“µd2K¢èº¼ó¯ÑÈßgþ‹®å£³ÆÝY |8[¬xî|Ðýæ4œ¶ë7¿&+ÀO^£ÃÔcÁbüÕSSmÈøT•°Æ †g‹µ`ÔW¼mM"‡ÁËÁWØÓ&ƒþL†ó±E‘ˆŽÖŠûšï•åñÒª³ÜÇ»îª†ó‹«¨oœ‘ÃM­í¯nÊ®£¾]ýXºÀS:kšD¾âS½^p?»Ã l¾	lnÊ/>àBv])CKýH/¹îÝåËÞe	zÛE•«.&a,OªÉŽûÔÇu#Îpè
ØÇþªsÙWì¡©B†Ñ¢1ñZ¡í»s
¬»‹3%í¶6ˆÖw˜|á½ßhFß¥8>¤Q.ÃÍrð‡A.^sŸ¨_è443pqu”‚“4ˆæiw:",UøüËµ|ò«`Ì
¦|	o}Xc·Éü&ÐÑÓ…ü&b‡­DàaÝ±øÀH?oö È|ãˆæñ1ìµWò6ˆÁŒNiDÍIå ^éòöóÆ#¨Î7þºSMØmB2äšHR)ÿ#"P‰Xk;Vs*!Tk,~”\'(ZÜI¸&âGa‚Õ â±PÄ=××\{Ÿ†'5îûêë:\ªpÜ÷uØ¸Ü%VÉ÷4m÷a.Ó.oï¡/.½+=ÔwŸzwËýÏû¾/µì©‹gQ=4/uõõ·íÜX^ÑËjºxÐ~nVŸOôzsÎU¹ñÎ³€_ï<+Î2¿Ø‘¨öÈG;öM^âµ›‹UÇ‡ûìhø€oñ\óšñ•¾Z¨t«L–ÀÔl)øðã÷|­ÊCwžº-0ù,SvÜiTÑ0!wœu½ºzû×f€'bÊaƒçK´¾^c^vØÉów÷½òæ/»ÏÈþ7P[GÅŠFtáY¥+ò‰ð?+ìHµÓ`‘£Á².IcPô`Š±¬¯›ŠUÂéÉÒá¶ô–Q¾]œotO&ü?ñà°``v|Æ‹5R:¦iJÓ“8
‡×Û+³¸+_Õl„–?«xYÛÒýãè'Aº“·ûMs<Z(4VÚ³P’H­ÚRµdÍú™²Þ{Â£{¸/·<Û˜­¡°]q–¶W:®€qU¸êÏŸôyax‘¬JS]­,*2ìGòðò}]n(‹ö€+°<C3Œ²$˜éƒ-.¦pÇ<¹bCž\wûj#‚(½ ÖMŠMáwÏ”‹Àm-s~Sk‘l4[Ã¬yþçÿþþ¿ÿ÷ÿ §û?ìÿT¾Ø”XkH­å±Zbòófïk*«Éõî¹©]ÊF¦nâ=mÍ´ÇwœiN*áûSÞðMø-îxù0.Ø6Jˆë!Ì’Buñj‹VY(·œmªªu(m¹­" fÑ)æŒ~wò —Î{y|ãˆ³ƒgÚ«ü‚TßËÜv*,0 B+3¢sQ
9Ê³”ò¥9·—áMg`–P6êºj­bª^MsÔËŠê¶}û„<"vÚíŸø;O¾í“ï—°Â–!ï’–csŠ;8÷–/…è¯={ÊÖá¿_àgQwÚ	t¸s«M>ír×/Õ>Æ'½êJÔÖüÍ¦0¸_±«ôT'‡¼C|ò%›GƒG7êí‡¢Ä‚RÊc<-,Vô‹ÞÐ†f¬ëZ(ÉÃ,åFq9¾çÖˆ¾äÕ‘f~³8×ò‡¯
«$ÚÇ7jy‘¿À5±…ÚXÆÕ=,»ß’‹“›Õ+•žÆßW*«Ÿ…±6±ô±â‹Ý„íÚ#¾çŽB=+‰¨=3(±tÝ¡Xk2•ÇU¶„pdÍË/	èŽ°Š3T‹R}Ï&ÊBœc?ÒÑ¶ãñµ—ÏÜ ý¥š\†MD„dŸ+#l~	_¢&¾	€l¥‡‡M,±èSbì¯ÒX4JÞCX]ä¶jˆ«S¿—'}o
j}d#ÇŽ?xä]˜a
í›²ü¨ž Œ3ª±(ÍüÃó›za0¬Œ#4NRO=1Xy"*XÌ¿fçlnJ or¡†ý÷'&Z¨ûÞEu$`X­Z:ü”À8ys92íÔL#ÇlJ;^œXØ¾)~zŠ©ø¡íõÛSP÷lkgx
Ñ;ö±;·8ÏR"žÅO/ã‹íöŸ[‡üÅoc~bLž!ç1§G#û1¤˜`ª-Ò¾´éh¤èˆŸé)ýËœf9|RîðjIãÖÑÏË€7PŽ¨§˜û3—Ð<¿Þ²	×ótÚõ(¸¡³Ûðè¨xÅ
fó$‰BšB‰Ï€[Œ?æÆõ´"ÿr«"bxp•Þ˜QÞÈiÌÞé‘g@”=ük˜gÇr%£ü>¤í~‡|#±$tŒ×Â*²üË€jGüðª3–áKµøÂúŽ!TP¦wAó7ó(ú™©[h
…’¢,ë´øˆ¬¯ö’`ÄPjot0£V]„Ü|üêæú¶ûÕÍô¶Û_©¬oÍÁ‹þíóß_²wf·ì˜ûb/¸Ö›ºîðZÇh.¬i·oõ\Poê'˜VB4å)ã§[0ÄÓÈ{2Š§ÓÞ±^i´3ÖÐ«v+Ÿ„ÙóÕ²¸þøÓæMG"gcÒ’õØ?kkäOsð!}È)žßåW"æä{¦R­ ¦ÚµBe[ÎÍ·ˆŽùi!Eì?7û`Fgì+þ—9Š¦êÅ5àÌþáCNiËb ™
Îð?8—ar½DCõ‘±bø80„kÊZÅŒ»3O«Êtö›³¶64…ˆkÛÁ£J>˜™	q„n»!Š58·„‚ŽwFDcBÿˆ@áÏ¬QÆý6Q»HÔu/)£viu¦¾:[9ü’èÔHîcè]²Ï4Äá×åšfH6å)­üœCmŽñ ]ŠÊaÇA »d³O¾&áŸ§}ùÏz¿oG‘¹§õ<³X«v°Š
¼#õƒf°­D†.Š]™e8¨dÜ¥ä÷¿°¶Xg ûoƒ|ÒGqœ‚˜Z#›«0x›§3¨é>”€	os)u`Áøõ¦xÕ 1#Á£Þ«þ:°¼=^j}£»¹Þ@&hIEË­þFŸ·lçµZúnøZçæ¢ˆŒ×³Q9S¦<Ï
š_L¹Á€ln ºæ’)%ey­EŸIÕÎ³<ž¶,k§¨íï®áèMø÷½<u¿{øg ²kD™aGì$FûÚDL•™ª2S·bv±qS/Ágz5šq
D‰éU5ÏTeŸéu?³KséÊém	ëcp€ž=×¯‡Å$ð¸ã4,ÉÏðtß¾íîíuÈÞþÂ7ø{ííÛ5þ\e—8ˆô™ø1ˆ¸.9Ùdd–ÈZ”“I¬ÕX@|'!4„kñ˜“ÍX4ÌŽ‚#YAéãU/l…=Ž¾V©ÚÞÓüo­NC\yÁ”iG‚ëÉu3Ò9H¾˜'yŠ´[\ùLzÿ—öÒLsŠh0Ã–XA)	Î[«ïúï{)eIÖÚkÿ½¶vØƒ€ÐÞõä;f‚‡àðHÂÖ„;0˜ Û$ÛUy"êÛ8ÆÂ¶ï†€ÄÑ'òjµ·Ë(¬b+Ê¡.xì“3ŠÔ²
›ÿ^ïêüã†çãÇ²9j¢µa¢…v¾>|1í;sbDWh0¹jÁÁ ãZÀ¾×n„™ô9ÐŒÌò‚|àGùÎÏ±
ën…õª
Ìêû¿ádIÖý}Ì^‘u/1ð•€ÅgZÖ]…UÂ´ŒÇ”¼$ëüoA• („«7’õFPos}•¡ç©W²bU©[FõZEÓ
š9¤OÆ¨uÍ…g‡¡ˆm)5Ò•°Q–lÄ4d»Ïja"}1a¾œg¦ƒâ"<¸öqK›fdÈü¼ƒÙ©0çÝ«O˜·MÜ@÷²MwÉ-åf¦Ž/",WëçÈföKR¼«ª(–¥‹j¯ˆxSVI¼Å„l‚rcù^T¿j¯WX‰=~‡€4fÊò‚–ÌŠ.Õ›RÇ‰’^Ú;#æ™0Â’–qµCŒ7ëïWùÊ—ñvã½}Ê¼á,ÓÈ;*¢@càThÑY÷»o[rƒSd´K—ÝŒÛ'ÑáM6sþFÇëÏ§4‡­bQÝÎŒ„ôMüÄ¦Äa0 Ÿoé4v6/„É£ñäl¶jí°œÂÃ8e­
fv*~|“ÆS¼ÓÙf)UÏÑ..ÄÌAå)‹Ú <–|Àž2¨i¹ånnB€s”Þ3ûO”´í5ÎcŽ÷ŽBu
Õ)«.P©­Ì:qÍ±gaÆ³Ð)ûƒ'UX÷O{'ûPîà1aÃÁJ‡­œý-¸8Éœã­ó(góAòÏ.îÆþk8‹üÏÿö5b•r¹ˆ_¥ãøãÎy7Kè0‡Cq¡zt˜;Ÿñ"§™6ß}òöíü:áŠ?êoŒÍ°Ö”gÚf[Eb½þzÕ.>˜[c 5»„Š¿x<Ä«’íJ)Œ›í {eµ)rÉkba‚Wl<õîújƒúGñÇ¯Øu§Bg@'ž¼@øùŒâ…éálD¯È“’Ný‰œì–øÓé?­³AþÓÿÏ&ÿÏãVY_§Æš|é¾š›JlC+î÷§Ú÷Ï÷çÚ÷Í–C+Ä²l8wù½Ó<sŸì¿ñÒ¿ùæZK
[øº?Ó¡{Ï ƒF‚ÿæ—`£hƒÕºj.ÆëËè*öñÕdèª6ká/·„wÙO›)m.jý>×ƒB7WMl#Cx*ž«õÔ­µQ_ë¹[k³´–]ò±]ÒY½ëXA-–ÉZHÙ&ÆŽ!’‹Ë¸|õrÔC1‘¥Þ9ÝYù`Ý¸^é•7tÊßo1Hì$iñ7ìŠOÌ/¼Ø÷ùÅ<Ëñ×MrŠÜ„óXü<Š?¯÷èÿ6 Z‹JYòŽ‚÷ý-(G¡DÇ‹R™««D\YýbÌ,íW(,%ú0wHyÜ–Øk¼§µ%¹\C±þ=É=3ÕŽ Jø×dƒlyW^ŠÇ©¶Õž,\m«=q³¾î}·Ãîn‡ïiüd×Ã0c¹lM?ž7h, ‹¥ó¿ñhž¿¿‡3:òä•jâÖ«Fk–\$@Ÿ?XÚøÌ†Ý	~"H9°µDCþ°½-©¼xlHÖÄp8M-0I4¾1V…¶9vìOK`ûæˆ"óT®FyÃB4í)TaŠKÙ,US7!lX6OBØ´ <- <+]¶dŸí)©i7ÇÃ3a/½ÅhgœxŽÄ·~¥al˜XÅ¾®B\- ÉÇ3øå6¬Mÿö7òî=n;ÌFíöP!3ÄD~‚)¼FÂ;É~a·z¼‰ë?”2 ¨Å$k ¸â;gœÚv)±µÂüÖKšîx=CÊh€'Ïñ•õ°´Oë4 ª½yQÁAŠBGÅ2VÃÃóä™cŠUÞñ[ AbÜÆ>®:«Ab·-"žºa,-›·ƒ§—lßÝz“!Ø²!'&û¡{š‹¦e¼øò³=6SdpN2-P>Âæ;øæƒ\Ö'ÖÙ:ìÆÆ;ôM¢ãµˆz²ˆyÒqÄ‹JoÙ.|•†ç-xÀÍc‰[s\>ù]qY¯øÍ†Ðô°iý%­Ír[o
Ö eêAõè…»jaJ¹Lkd;6ë5qÛŽD/@<„ÄÖ„´%‘&²5ƒy£Œë²-r#V5ùÖ¹äÉÿ$·ïpÄÃMí3½±^2Ï&mÙ`1D‹…WsÛÌ¡ i8ÜR—æ]¿ƒÃÆû:¥Ì¹y·Ù!;äÉ2 ˜›óîi‡|Ó!Ï  y÷·Ôáë–×«zRÜê>E¶nN»)Í?älÞc¦‰#*¥KÛd7).•—]kmÌ wâj–Uv[¦Õ_–~Hë…€áìðDÐå“À1üU–³ÙtXðËuZ>Q¬Þ¨D!ÌÁSY½5èƒ<ªë±«õÉ‰ô-íV•„VÝ@ ƒ’€‘•ñ„;¾\ÞZ¶cOíò˜¼i"²r[÷×››»Î–ÅœNŒFáE',eVqUJÏ9¿wh|žR2EyŠN|>¡xà¦y
Ñ`¿ÄwL±UÖÝ1K«†5Ø¯(Š/åü(­Ä&ïÁPEâ>â šõ]›•˜rŽÎrL<:f„ßùÍ[P½Î®30ÑJ°1sJsÎ¨ÍzÝ·Zåi®µ¾bÎoÀC4±Ùa c–Û>‹SŒ3GUƒ¤„Ð)³Ÿ†³özÇèÍšÓz9ÛéŒŽŠ1ÑGèk²,€¾bÙûl$¶¼káU4³DÌ—"‰:X¥*‰úp®Ñ¾`ux×XŠŸªê"t„)ˆ‚BÁîF]í*dšào«GÛ¢
[ÅãX`|ïÂŒ/Àª£Ýxl¹Ãcû>çñøñdOÀ7?TíÓ¥`ù…‚>5€ê87‚Ž&ñ¶ûvÌÿò®:²û¾Qö‘VÊÚî²{ª»˜|"Å+-´0Tû¬ü>ªûâ*mÔÅŸß‚µÛÝ RVÑ	³wáS
 Û-VÂ‰ºçÕ˜‰.û`–(Àáe=˜Ì0[vñÆô¶ÄÄ^ð5àÎf4ýþüí!xpkî¤ÿw¼Üømû,ü+¨Æ¯nÄðôâ4DÉ‰Ü¾ðW‘÷Ì«Jü‚xå)š„­>¦Ôô±NçSVêÉtÊRo®oÀ_“nä#»
¤¤?\FëÈ±\CÀ¹Ê€YÃ)H.ˆh¯÷ûÿ¶JþN‘ÙßˆëFÉ%
ø8ÌÏã“ ‚ükO·ÈóÓ€§\aÎS´-¡¥Ï—ÆG™n{‹ð|ÛúG†GIÒî%|
åÔ`}ìr=§÷}pñ]$“p˜!zô*òÎÍÁ{Î[·zcÞVºÛ«µ¯ñ»h>Â# 3Þ1f¹À@ÌòŒ|½æTéÍb^®Cø÷ÿýß[‚Œî4ÀgÄƒM¶»—waüÞÄ`W‹	dDó Œ2m2DËc2 -6VÀÔaê!ö9Ëã„`Bë”îKZŠ6ˆ§O9_wÁó-¸Z’JºÂòHu³$Rì»t±n8/ãtÔeo‘O”&,AR]%–H±é0
«òR,£Ïxç^‚&xNãË¦Íä:™Àx±`€Œàµ”,ãÞsxA½£ž8i0}NM¤
É)Â[È:«5Í¬Ñ¼´—4g²JtÚo„ËZÐóÑHF1qˆ%©b²šd²8î¸¥Bèã$b$#á…â0¶×^òMJèÅaq}ð,¹ª—K^øiƒ
Œ‘Xv.ŒþÚÒRC/F³Ò)¡uàù}wÀ;t§t
ƒ°ÜðDj86ÝYúBÂ’3fd4g{¥|¨ ï !øq•W˜ùÅ›>é¦]\éï0Ï˜×MñU—ãÕ´B0ütÁ«mí
ÕñTŽÁ(œÃ¬è7ˆê¢î(U4I¶& 	}mÙGòùºâ¾#¦ã¶È¿öÙS‹²IŸ®¬=fO³ÚÅ}ž‹´ëÒà£ÇHPi! ÅËpLÀ¦¾ï«›ý¸¥ÏÝ€/|x /·‘1ØUØ§œ;Ž@z£¤œRàÝáì)3€Í~ÜvÈú“â¨º0ËØ?ìô`D»¸¸8BfŠRp;æ)_òÀ)Ç=	=ôôøpÿÃéþÉñéù‡ÝÝý³3'¢­úñîPVØPo÷tçüøôý–{ÔÊæÓ)&’ïVá¿yÑ‡A¡KŒ/ÄÏlÊã~“¨W[ÓœmãMù!®°è< >¬VÆî/ƒx½ÉiŽàå3,¸'©ýüÀVêÓ0‹gì­Hœä´>gˆÜ ÒÊÓÃ¯%žGàŽußw<ôÚÙ{{pô;µRë{cÝ{ªqØ?úîàhßƒ‰Õž"ˆÖÙjØg?œìŸþxpæ›@åÐ²Ö°ÚîîñGç;Gç¿"¿-ÂGëÔÈÛ“ÃãŸ÷÷Ý^yÃ%äjï¥™¹ ÇÅ\úº—Æ<`Àm/´J.ÞÒ‘È×V16FuøŸ—×ŽÙµK½Oô:k»²Vìn½ù„?y¶%ææ§¢îjy'ð‘÷úy~±•Äwí÷É-ç
µ‹.qëxêYðŽ+¡âØÁiñge*3¿9½pÆ|å¬]pö*záò¼WÀ¬qÔû›1Ë¤:µÐFÆÄ|¸f"#ÆåßfÈ|Ñ€åÎ0Ìücœà+OñœD:íÏ®á„ÉGÞœïà	Žþ:ºÖSÂ®àäËÈ™ïÜÆ)Ã@‰T€t$±³^›H^Sžl#:ð¯#‚—Šåo™ý¾Ãrü=Ÿ…¾ÃÖMpÝ/“PµWÆÈ«1F¿¬`wØ¯AñkXü¿hñk\üBcZI’`šoØ/6YYÀoÓþòÄ~ñT}jùF~ùF¶üYdôËs»Îz_V¿_üeòbõ¡ƒ?”Í5ÅœóÆŒk?ÄtòìšÕ:Dah‹‡kµÕý¾â´„{"MÄzÌS´­eô3ßAz-þËÏÌTœW1`à–+€@„°“f5ûø²¶—Ì¢û´`\ÇÀoãh¶xâòÝáë¨#ZˆC{¼*ªÆ¢ } LHãt@¸S.‹ræÇ™}§Òl:D×FŒ€‰¤÷–h'ŒŒ5&Ce=#ªQè½;Ñµ±«o¶ï½º¤ý‘j_O»ZßþÎ‰Ûo3¶¬h<HÊZ­ûvdZNKqP1o
ÒAR=h®““"„ÐF¨+ðH†ex$C…‡rWßü¾°]·.~“Ò2d(UÈ¸A‚H"©ÚXÏ¤«DÃÊ¨è ¥á%Œõ=œ÷åf®4Æ”’×Ç—Ä—è±%J"8RbÙ =ÀDMxG,hâWÅGVÝ"Ô=:%H¹å½ Þ EÇDÝÌ,¯í¾ÉÍs·ZÐ¾ã²ãvþ½f{âFDÏ3y<Xb(×‰¸«0T†Ï³ ºÎBÝÅäšÅ©˜†Çø‰Õi|“”ç‘UejrÉjÓŒ”ç“5ûaçk”t$¤u(°”$ä×O@šìÏF¡±x
59xš‚-ÑwfGl±ö;ƒc·8Ýîtbß˜=–—žáò®‘ 8 ¯ÎS½°*Q»’äåò*#¹kÛ0H]Ž†'ôŸ~Ær~¢FuöRUŸç¨3A@52¢Jü\’'3
º[‰ó·
6ír·ãNtž0>)þ0^s^ñ¦\àP*ò- 4àOÅ#JÀÖ¦£)Ž:XRð·äGÉìë¡–ëÇþÔPGËüc~X(ªj%VÚè³¤Þñ2…;¶]ZÔp,tx>ÅêµÀÆ‰«µcû%9«Q;$l‰ì£Iât•…ÿZCem q²dxâ‹ù¶.tH#lïìcªù[çhžêãÏ»ú›.5NçIÙdÑl·“FÆ¼~NÄ{\¨þ<ËË#:Ü9	²]>ÛÀ—ÄVµ1ËbÐPµ® ?Ëæ[. –tŒr÷Ñ†7Xç¸Ê¡záÅìÞÂ¤ÁA¾ºxX¼	qîD+{Í@­›¦§ã(ëTCCSÐ_;Ôp¯§ ¯Ÿl¸—ÓXˆTGyJ\IÕÇŽ…“}4¤ÀiÎiâ‘¤w¦
B$ñÇ»…iˆ:Šˆîutdü´`·&ï…lÕ¤·~¡2XZ»úŠ1¿è×U¿
Ø«òÃ…’~¨òv_¢|íõãÏ-T`©îoö!ª¾–A—#îoB/aÁ×?ù€ÏÀ…õÂT—Oš ‹÷þùpÞÀ,±ù<«‡sR³#zù}˜R®%¯éy!YBcb‰íÃ?äñx<ˆƒtÄùªê€­6TGûxúb‘ô>óó†+Pš°nµbF=¾FÄI¸ºbÇ%©LK:öÛ:˜qsašŠâ‹Œà]\~–4ä‚Å¦™K²v1W1óoYÖan©ä4à™
[l–í³ŽÇ-´aõl'vDä^y“‘”wð#Äæ$ãü8ä—´¿ÅXOþÇˆ®ÉÎþ¸¦öú½È«öm
µ‘O¡>¸”±J)Ê˜üíMÌgx’(íM°$+™í!ËhJ½÷Ö<ÔfTe`$m1F¿]P «[-H¼¾zK&ð±m8ÉÕz$Î,<<Î[âê‚w5}ÜÛï•ò¯§ëÇç¢ËìT‚¦yœ^hËh 4Œ§¶øTKƒšÞjzgñÞŸhÝÕU˜ƒ°öÑè.^3$ûëh)/½Ä½w^Óó8ŸÐT÷Ó75kæSuìO3˜à=Lž‘8ñWuÖ9ßjHšD÷ØJ,[PŠY5Ú5‘paXÓAU)Î=¢ùà’O$këzØ[û¬rýßºª×@L×ßMUqL>iˆÆ¸£ÍÖ–ÛœfÓ–e?yv±„°¥›Sn±B@ºŸ4©ãû(„ŠûI›¾þú¬tKÑý SÛýZØL¾OÊÊi²EWr‘«¾šÓdã®ãóÐ:>¿ÊÚÚm°X4»‹.ñ]=uååªž£Ä…d/sþ…EöµÍFgÓSm„+qeKR¸”=<˜öÚlE;ýÅYÑjâÚær5E>˜ŠÊEM}!ÚÛ×ŽN-kñì}}L*óØ¾ÃYÊÃ**jÇË©´óäI/ñøÁú{é\šjAkïˆ]Zº`k…«V
ÖXf]ºÀlÃ×˜Ì)¦NÌv½¡ ñªJž–M<µ@¦:ÈÔÒ›E.{0@³4q€	1r`ðÒÀµ+hÇlƒR½˜k‹t@¹±£p,2ZIJZ±šù\HÝöM×¡g×!‚ºˆv:˜i¸Û¡SÉET{y‘®‰gt`×=éÝêdXÁ·EÃÇó|±–EÐÑ"Mû†m)¾ ”Oöµ$?$è¶Þ²Nç+Ü)ÄcÇ–hO"ÚÏ ¾²Ÿul6ë8\Öq'†iùØm%ÖS<Ù1ø¤ã¢f5Y´§Œ'mP×}…¤Q?O;vlÞè8ãiŸ	è, ÊÒY[#ÒÀ²:Åã"YDç±Z&ÁžpMiÄ#§à[ÔJâp–[¬—ê)¤”Ò	§æy“ïÇs²«‚µ2½Þ…r&3çœ²ãåxu`„¹ôÂ™¶¾ÆRº9{<ù¢2HxF‹Ì6µÅK,3´€ˆü“ÕI:Sl‘§á`.‚`LOeeg0'{“`®`z:.	dl<†½59ieo>š–=›é/Á¤aé_¦Á¬aÙ¦S 8ùÓü2›Ö92¬óŸ“ œ6FêÍü— ¨XZ\Ÿ<Åï².BHeB° 4;›gôm+[Ä“ÅJñ/hjKïº»0‘™yÌ²È¥F†\<YÐZõ&Iô¯¡/1VRù$=‹z“ £V`K
\ÐMÌÆnq.GÑC´’áŠ7/äÂÀº ŠRðà&+¾X òª ®”íðAç]‚¼ÖçÙ’³ÉÝ¸öL]ðgñ¨Ø'zbU<üÇSì½w…cyp’áj¸ï®­|.å[½…Ò…w_Ó‚¸wíA¦!ŠÆZ„® ~•b^™œŒbdÈ¿Ò4&©¡),	Ž%lù¯ƒ<˜Õj¥•Î7•ÌÁ‘…Iœš$HNä{WÍ	k¨Ð3ò›GÎ%~9—”É9½]$nR>@¼dÙ0Ø„/ÌW*Cù‘Ä>PPA Y´)™ŒÖ6±hiPE9F@°·a•2¦ƒ#¯Ó”ˆgó)Ú_˜¬'”\ç³çÏƒ+4VµìÈÆ—÷ÁëhÕ‡ßéŒ‰ëáÄâ&Ø9Šg]œ!Fíl>œ T’«©„Ù°„¥V-d'ç³7´PXØäzºh‡Džoû„‰v§Þ­Sûz½îå,ž¹ƒfwø‘ÛÇÞœI’ˆ
e‘tÍÑ4Gk‡™íº ƒò§š¯ëíËIƒ¦´a´ÛÃ¤'t†é\r:e$¯O_n‹	ófö9‡tÏJ/xæ`A¼‡	3€¾£ô›ç ×fÉ—Hàf2}·²ïž¿Û²67‘É[ÜâÉºSu‘ÊmùhŠJ:;¼ÜÖy:‚\aädåÜÈ"ìOAš‡,MgM:Òs:Þº+2 NKx»äú…rå[ÍØÉ?c'÷ÈØ‰ÃØÉ?c'åŒ”0öIÖ2uÊµÀ6xÙƒùðÍû6ùÉ|þçæú‡§úßO×?<×ÿ~¾þ!‰X¦/±¼Å¼s[ÕÉ5S´cjž&žþÚEl
ÇcqJ’q´Hê;e‚9 Y ¢¨]À_#˜´oœzÚxls¡ °\uÌµZ!øJm{ÓÐçÌÀë3[ßCÉnÉ’hã¥†ýÕ¢¢Ú²ÚEèœâ©‚±ÃB0ž;0UÂ0ËóÕ0&Ž©šøZKˆû¿NKN«ð"-—rYNKîÎiÉ=pZ² §%Ëp¨ùïÏaÞŸô»ÜwfI±Ì×ÛY¤ƒ%y¹/p®ö9Bæ:);bP.9™ç=ËÃüZ™jý0û4‹/g-¿p÷	¥¯Ã®SÁ%N±=á­ÄòhUFBŽ‰Sývnm"å¥I¸«&’2³€eÇh³6‘vL8Z}ÝF˜»X]$»ìu«„Qg|e)uÐKN©…G¦ŸxÌl
Èµ8ü‚*v1øÌ^[íVí®n_@}Ñ0ÑÙ"-¾“ÓrÃ‹Púm¡pÝÏ)³¯BÒñÔ7žè&ÖÃ-­§n™<1P|dÏ[ìV×ƒSÎýò-KwºÙv„³2éÈmW9÷M+±ÒXcë?ÖT~gÔïõzukƒ|n—ê*|šÎo|ápIñÄ¹ûK"—Ec‹LFÑªèñ%gH6ÅTqp)qŒÓÑ`{Èêw‰^ß’09ü@·–&€´„>¥‚!,øúz{çdÕ39ñB#)¼1+Q#8ði"<v(@Ô•IV´ IµÁ‡K{a½°$ŽñÕw™ÌrAW;õÂÂ·BÎOj«ãíR)/N®üû†È T"ïá«¶¸BÖÓ^6‰©¢ñOÁý…Ö.¶ Î  OÐãˆbÄL:;ŠëÕ»Ö_¢œþR•`†ëxTÂªZd}_w™¤»{m¶kîk™ßŠUcû.Êb§Àþ —•ýU:þb~ ¾-O	ewaÝú®¯—[â.¡ÝSÏKÏ–¥žºº6¿;ÚÜj4Šô[äÌWLœÆ¨÷½¼EÐóâèÑ@ÍÝÂñp¿Óp'•WjTL¨E+ÙÒ£cîT^ñÙñ¤có\A*ö)4[Gˆ`û–PÔíÏØ †[Ë-u·Àm=A˜'‰€ÉG‹i/›+‚¤æBõêC¹Ý:#š)Koº`µ,¼àx.9nd+—ÜqÇ8ÿä¾‚û“ßXD¿´I³Hü‚´ÒÁ^†®¢î‰* 4 èÂÔzÀ¢TT"¬‚„,x£”%ipésüT\:ÚkAÂ5ÏuÜRÖÎnŽi\»ßý–µ[NÚiK92¾Ë'ôGAöŠ¡¡¯ã?¼Ê;Æ¸(cŽ›jxÈW7ã–[ÒÆŸøúvoÞà¯Wñ$]÷“?·«íUï§­¦]Æ”}B6ôÄj;ü;üYëðgÕáÏZ‡?»ö.‡™Ýõp†èÔŽ8eøžÖ–ÚÞò”¨´Ò8£+Ýì¸;ê\›"iåÝ‹-[ªŠ‹-]â³èzKíR§&ïm‰ŸE–9«˜y±¹ë½ Ÿ®È¹(P²ÈZßÿf¹®÷1wyßKWnü2[èeÍûT>æ‚¯¿ŒÕ×_Ö³zã/XH´\êàSHž´\òà#¥btòÈ£ËêW`œCE(™ø‰¢råýQœƒaözÂCÞ3vÊûxž·€J½È,]¦èñ3Í†iÈnÛªPóP0•·0|Ë.‰foxpÍ›4žV(-P®T´Ð•YÉîÔ)Se´Ààó#Gœâ!aW[è«,Š ŒãÁâ’5øÒwr£•YØôtë÷*¯¸ÄÓÈš,µÅ5cônæ¸¨°ÈÇ%ù˜Ûùxk¼PyÎ¨Uá¼· Á¯u»‰ÛTš ½ÁPYG¿î6\öC_xÓm×–i k»závu‘…ÚÌ/óÔÓ„Ú‚ãëœ·kì{Þ7äÆ½Œ²:ìéK¬oú¾ÔÔÃ‹¸ÍKŽÔËÂœb&ÕšòÔ¼ŒÓO{w]u,´bxù…çûW¸âIÜ+ÔÑ°ÀWaÄj"0ÄyÀnIWÙâ1Ù™Loôîµ^Š¥äÅàƒzÏ²BÞ~Èã_Ýˆ‚·-ˆ¬pqË-”Ôrë)Ì±3À*T¸Oøá,¨ .µ¹ýÀWá¥è—\•å*ZÞæOŠ‡Á€FÄº-ƒY]c þN}ØGâ%MN	t·ïÚúZØÓè8ÉEpûVxÑ	¼îuWëIÑ+Ð`Ii{íÝÿ
ºÝéþW¿ûüýÚE‡´>TÀâ)M4ºh/©&t!œ]|Àddì
¼üj.dý[ùFkSc-KOvbŒ¯~+“=È˜½LÜp¸å³NÑ|©ºmÃ³‰XŠ#ÚÚkëþ}Ôöœ•™•î÷B™bá\-þ®Üým	^8°ß%%÷ŠõrVX-Ÿ—”g9ù¶D¾¾R˜Åbº Zü]RƒgHáùGXž½¯7²%/&ñ<ÃH^í¿% ö’¥•*iì?âp†0P±Æ~á/ðo/êñÙ5æ/<¼d^’y¯<%3ð’&ÌUnÂe'1è:<$¾F*F®šáDƒ)ÀñEÓÕ¸Ï723r°GŽbÞj<œ³ê^÷Ä6gÆ×±ªÚWP²lNÕèz¡ñ2A‚ŠÓë˜¢P%Ð“ ã¼êv5Ÿ¸‘ÓLy_%¸=- UtS‚kÒIÊñ<%»xÒÒígÄ¾âÇ&=Õa•wVÁlÐ]dEÌ&}^ZT¿ %¦ì¯&„ÙŸaÄêPüU]ø[&GE.)ÌÁ¸êJÙò˜ŸË ˆ™.âK–ñ_Bh;r™eèaÙ\ñì~cRZdõ)Q7,BÛB¼íÁÜüPè`J=<²ÅÎ$Údœ°ì›?j!U¢Ýí¸”©Zúå×`U%fO›æ7')Í(‹ÎçMXà´sBªÉ3ö²wrº¶t¾*Ò6Vµ–mdçÛ¦mˆô‰ª#'‘‘É+íÅàŠçá”ò*5©t+ñib>²r”;+w"F´¶ä UTØèå9¹+ŠŸÖs(+ÈVQ˜Ïhvšá0¾¸ ¯eK’˜Š·ê­KËÛEf“¼»t*éñl¼}oÅETúV(D™*¶†ÊL '¾âÇ’ú<9|Iu•9¾LÎ«´ªW«m¾{S–7ÉCzEŠÃ2Cæír1Õrz•ŒÍ}¨ùï(·=÷®—2]I†Í_‘ÿ”ãè¦ÔôWy÷±¸Ö÷‚ôÛŒnW	ûã{¦’÷¿&}Â/ªi™'Kù™þÔ[Ëâ/Á‹e¤:èŒ~9Y·K3Ø²âœÕ
*9f¼¬H­Ë ˆ9f‚¨LÖËªan¼_Ð¨V™«—U“ÅÁÚg”O#ï1ú¾íÖÒrÃBä{±'T!beX 3U*€0°Â¢`•dPeMh£v ±ª±VlvU¯ŠÍ`yxF»"’bU´Ã/ài—‡j¬ZÑ‹g-ÇýÄH	*qgÒ#H®ªvã²¨êO½ñ"zI
±Scœˆ(€-#Ä­¢<·äXy±;^Y¸fWª•„­QQ÷-'*9¥ŸélNUýÓµdªUë¤Êt‡ùÚ!È½-–Ã]@xËHì–OÛwÞfˆø“ÏymäŸ|öj" åsÚ0P>ûKGÊ§Ad |"BP>_ RP>¥ƒòi9h’ä>#-‚<\$¡NŽ
ÛiY(Ÿ3;ÂÐ_Ô‰$”OãˆBù,YhX<ÂP>‹DÊçW8”Ï}Eš„¼s¢|¾ˆ8ðG$VPh‰ÈD“>wŒP´¨ó²¡$bÑÂ B7âsÞ4‚Q>{"åsº@D£|ö›F6Êg§a„£|ÎìHÇòâ3‡½®•MCås~¯!ŽòÙ«	u”Ïi£Gùìß!ôQ>;B åsæ†B.­³Š0/J+–;ðs£ˆU“öu¹Q½W}ÎW>§õç}å³ßèÜoy}Ii+Cþ"Ô^–Ø*ÚŠM‚†ÔVQcMÉ4"·ÐUOr#Ž«žÂÉ¢.zZJaçýû|,yØ¸ÜÉZxR´ä–eÅA>12‹ÝÅZ.oŸeÙ™ô’rxœ}­°–›Êó§õ£Ûú6Œ"µRl„/[úÚ97*â+·õµ<ÔÒÂüÄX¨÷³ž†û#5L³Àä–\S9OM®i6Yµeœƒ)ã*yq=Ò²¤Æ…“Øn eIÝa>×6aW¦ÏkFÖàždaî1%ÐYA).¸Dsó”UdF¼Ö;û,øéþù0çßŸ¾%ms·JÎ~xûvçôg0?["‘èX±çÝÂoŠDæ{ÚûŽ…&hZkœÉ‹5Ú<1z—|_‘õ`µUuÛHÏ“žÂÛ­ŠÊJQÒ¯Jðä‘Ö2”Ðr[TPI®¹IJÚšÕÊÜˆ$—DÚlH#+E‡—>ýÄ°RØ/ÑcÞ‚vò'’âÙ|:Òëªn•qé"ã»ßÞãÔ!÷4wTô"#Ê*Õl­0ª9§<oÈ)Þ)uô6Ó¦Ô³‘7·ü£RˆËÐÉIÿG™!ž´÷¯è4ÉÉnœi½ß>ž40KÏ&O®ö¥g”º<¢Í_€¤À Öõñ~æW£ñ^Ž¿öÏ…
Û=þqÿtçÛÃ}L$z²ó3þ\ÅòoÎwî†¾™ªçNDììîÿpt~†4Ü?ø‘‘°½sºJv¾;8úŽìíþ|vpV…êÎ%ß²´¢eH‹¿A3‰i£ï—’;§:pÒ‡‰ºÙçFm:PÉÅZ…zŽps?hg6×¹§
¹²>ØåéËAû ½xŠØ=¯ï…]n‘^°,¸Ú‹çýG‚«ŽA\Žæ´’«déEû!²óÞoO(‘ÝŠh·a|Dlû·¢'¼²V°Yw˜èÿ–™BÑ°4‘góäK
L'eöƒvæ¦›´ûA{ñ@ÓMþ ½x0éKgþ S^±ò Ò2i(-ï´ qc~‰¤]p/b+Û:?>ß9$G»Ço÷±gÅj»½gß³ýH¼7.«mÙ,ãÑIô›¹p‹­| ]ôöÿ|²t¶V† J;¼eù‘^²ð‹·ìö`§'&Ò–@x”M»b ?›ãeev“MA1_Ž/è‘¶\ö{spújõ›Ñ×iÔPf«eÃ`]˜l7‹pÆi<õÙ,MQÒ]1è•è(/¯Â¶8"öf%F*ÃC)J¼Å&ÂvŒçjmÔ»úÂšDÆ•‘ùŽ’,©8ÃÑHˆîÿ¸ôÃ¾ÃúéæãÇzQØ¶!õXŒY¿~‘‘öu»±Ø^Vj5¬·wpº¿{NvÏÎÏî<.*¼´Rü7ƒêN¯°EÁ†#mï¬—V%íRŠV(Â
·(ËâñÉþéÎ9zR^-¾ ¤bWö)•´Xdá	Z1n†E±È¨ÕtßBÙkÀ<ìøà’ëÉéñ›ƒsB»± A­Ð¾+Úæ˜—«wÔ3Ã8Mb<Øÿ!®<*§¸ú”Çí‹ü9¿9*”e	…NORšMâ£y7¿yÒï{.Æ.
+#@Þà5®Úà>*
t U-ïÍ1Ô„ú5é÷úÏÝJuªÜ0ò–æi8{^9Åóûxg±ôÐ”.ý1ˆØIŽ–7aò_òˆå>Ô§Ù”8ËO0"0]Êxš}8ÆiŒ2º]~Î­i
ré‘Ú=>=9	ºOÎwþLvww8yz|ÄŸÕ¥á²0±d ²)X\‡gÌ§ÆÃm0(XÍƒø3UðW­´ÙÒ˜"RŠ1Ìq#X‡ÙzþoUî‚	jÿìüà-Ðv˜dÞãF¥†'NïkudŠìŒ1|ö³]·ÀéN
¢±®³¸"&‰<WæHìÑAXj›Ã÷Ý”ŽX~©ì¶”Ýâ6a®Îà	¥}ÓŒqÙjßm¥¡an·â5Î=ôÓÜèå¨ç5Ö=i9û–lIX­‡a0Y*™„«6_í&˜¥YËh^-¶ˆ–©ä†:èNVLÕ,Ÿ\©W\Ü[~¸äRïšc¼zð¨÷8­u­wå9Þ&í['y¶´šˆÅj<äz×30‹[i†§~v¶¿¼ŸÏœ¯xF¾f#=ÞÍôîô^-½®ƒà©MØŠcñí<½Ö‘|´0Øe	xx°óíÁáÁùÁòÎµ³-RB¨d±ØtRV®•ßÙ]ç”/ë°BÏ‘F;ûúáàüçekŸÒ<g¨Œ‚³š+í¦b.gyWÛbq;°|»wóÒ¡Õã(¾¬ï§âTc/+ÜŸ„ÂQsñ…ï,ÛëÑ<üÌSÕµvwÎ¾'o"oNßj‹P;»ç?.,(ÐE 2ÒŸmXìÎ³œ4³djQj1ÿÙiÑ:‹­f;Ý¶¯-S5üãÔ+®ºØg¥p™nó®3v´ÎU¸‚Ç¼ÑX·«FÎîRŠ>äZÝ­}?ñ%ž§þóáÙŸ{ó<Œ²Þ/Y<ÃäÓÌ lã”ÐfŠ¨20«âøÓ‡½ÔO:ÛŸƒFd$ ^:Ðn‡¬ðÄÓ+v½Ë4Ìé›0¢¬äÇ¯ndÒãÛÞU”]}”‰¿´Þ<cñqâ^²|CÂÑ–ÚÎï ãEñ&[äÛ Ýi¾¡ó…¨DZÅòGrHÖäD±€V@’ÜãdºÄ
æ9¾×B 8 ³a`ºwŠi§+(R›œ‰÷Ê!Ø}ÐÓO@J( lJ½áï8€S:Æõ•ÝKcÑWAáZ`§ÔcÛX[Y-àã`ŸÓ«Ü^žãQ€‹c8lÄÉÎ,ˆ®³0+€íÑp9ˆO\­€á!)ÉÈð&f·¦™¦Xë'Šö"wðZQfôì,I8bCå«å¬T@wô—E·ð•¯SI!M-ÞðÊ?QämÝ“yÍÂ³ËõQdµÒ ©Wb®¥!3{ÄCi‘]Çæ%E‹ó”ÛF?$žêÅÁQU_½Äd~6Ëf[Š?»³Æê {gJ‹M—'`ŠDT'Ë=Z}ápÞâkB^ÌnhÇÌ±tÄ¹<¹—˜¹Ó×s²‹4	mCò¿…ŸÉ0
²ÅæöÊ8¢Wÿéãˆ€tfÝ!LHš’_À¶Ç×òÏ¤»¾AÝË	”")¨´u7¯"2ˆÓàÿéf0Áhw½ß'Ù$Å—ÝlJr˜ÁÎÊ+G½<›„4íD4ÍuÜ.»ëOÉÿaõñZ¸î€;tƒÞKãO´ûn½÷äý
Yó@lêÀ@vfcw€ëÊìÇöùucåÕQŒëï4ËÐê~¹6ÙôÀOðC1¸êbÏ=½ÅçgLY'Rê‘ì:²EAžbš‘YŒwQ|¦h¡"&	M§a–1õŒ1/æ)åVM>ÁõîœFQxAQ¼?…—õ\”×Ÿ—kÀê•TŸœÕþ±y'K‚!í^wŸ‘d Ìaõõå4FÛÃJ&á,ÌAlßÜ °Séý¹cl£On]&˜…S ®QaUð÷`ùèÚMÒp–¯Å=#[9G¢‹-ö;/ñ·wÊh~IéŒ\I÷q	¼4Hï|l8ìµY°o?ü,—§ð$_7/&ùÊ+›-€‹7*Ú«âfÖèäâE~J'`F‡È¢¨cópˆç¼2©Í3Æ›/ò3*»º«ûTBÅ™¸òŠÝ/rŠ7yñ+(^®aÝW=‡at×J©WJlÿ^¦à7ƒXÈ8Ÿ\Û Ä¥ìÛ€ñ ©¨É9>íÑ`C¿^2ôøÜf©ôaã$g®©)á‹;nà3&\å9á/~ÇAi#¬ëƒyž{ÎÏÛÏ'z½}Ãpç“ýÄ³Ý(~Ú¾áé‡2*.
ÇTËz(j@n†³ê^Èg%¹‚™œ\w7Ša€QàÂ=Ó…;&&g÷0t˜l¨ÍQÆñÙX)Of¡?Ö57¼Õ¹xôç5YžRŒÏ°å,&X'º¿ŠRký•æMl{ÎNðâ´+_­Ô«±r^–ÏKFPQ¦ßì=5ÿzõ´ý0d¦Q5:/×8c—C\-éP‰ð¯÷7k_Sè±{™˜¸"âö¢?2Ç:~ÇÑ Lñ¯×Ü¶«õÊU¤ô
çT0q(Þ¹_jµÌ¦[	#¸.¤Ê™à¹«¬DNaÏé8ß"šÃlçýfY³s”÷˜
©{ó×,:5óö»ºï® æS³BW-kÓ ÌÒµç}&µ•ø¨hŠQÁ¿îgü$Ì>°uIÝ}‡—„%2-ð€‚Þå¨Cx¹$¨Íþ‡?b “çŽ Ç:ù—9ø74µ»ù'ñzQp×4p`áe‹ 1ÿoÐ}eüxSg-˜÷"‰ruŠOS•ŠS«I#¥ŠæEÛ^áðë%6>–*’$ºÆÉçi›el2–è¯
Khe|P3o€àÝ¼®ÉPmuÚ¹¡Æ‡'¬VÝS9£ƒÀ‡kd..-«TÉÄÅ@šøi¡-+ÝRË …×š¨f|_½vÅØ±~Å§^Ç2Ä*0+Sª. bPp%Ò}E¤>9žÆå¶2…Â€û«JˆfÕõhÓ_:ål\£ü.Î»õ~rõ¾ÄU{mÍpéÙWá´]†#\ARç§ºá©@.NÐ»jÀÎŸ1Øk[»k²‰0A3„m˜´˜¸g²‘6íÁÏš÷Xó’;–(h·†l3Ì¾Ñ÷xVìGT`~ÏQÀÖk<âLï3ÞxžGáŒvgñŒâ*O§Ý$ÙêWýˆ…ymžÑÓ¾32±	Q]³Æ®öó)ÇxÓtÅÿçÿ?1à}sþyükó½¼Sõ¹~Ÿ7ñ;Ï›Éó@¤»q|ÃfKU³¦™„£x^ÓÑ–_ç ´¸ÖQæÓŠ¤	Ç³ LŽW¾0¬ë4S±)äwÅ­‰Yë™/6ñ˜ã²€ÆaÝ£#Ö±%æ¿¸™ÕæcÉ¿·éÿ  ÿÿì}ûvÛFÒç«ôr’ˆœˆI],qlyiINü­m)’’™|>sl I$ À@KŽžaaÿÛçÛGØª¾à~i€ DÉÂ9q@è®î®ª®®®þUXÌÖ& /V€|FÎøSê²ýÀ=`Lví»'ÞPsîa–é¶fÐÜL¬¼™êfó¦ŒC:g8ÓÞMs?«<Z&oP XeàXÆ,FC¹Œµ-À.aHGhAÜ4÷€û÷ÖËûX¸ëÓ¼Îx.A³QóÑV1?#üozÂiµZEDÈËj^B€Ð óXIn¸û{f4;m2³é€PwmAu8¶÷)r#¦ÂžE7øƒ­ìöÙIpÑ¹®Ù…;²GN~™ï-ïƒÙé³G$0¸”	€Ü¾†è}¿§cÎdñ$XÄn¬ýÅtš>A¯²%~ÏÁø–æÑ~vï°YrùåÔº1KQ…ì Ê|dO‰BØÝ5ãKz÷å(¯šÃ”Š6ÕlÅ ž„|µBÍ]¯ÈKFyžœ¿$_/^àjYþKÜ	°ÇgìÅ©5U“6LÖÍe´íY,Vž³hÑšÊX´«$YŠ‘Y	?eo•„ùûýíˆö£égMAÍS?7ùª;ôT¦nº-ßˆY%Ý‘Âò¦_ô†ÖñtÐ<Úl€ŒÔJèt›š{µm˜*Ýßtíæ¦,¡ÁÁ#WykÙÓ-L8Wc%²âk;É°€è^c>°¼Kîúwbkê½¬]ÿÚñÅ»ógg—äôÃÕËIg•~*)+tÇ7§.nlŸF:á{ƒ¹¡5z¦§¦2[öÑžeá>,Œ¡P„D75À»*¶ånªuÍK$¿ñ7z¯¹ÔkV5ÑñH‡bÝ•(yÉ"ÇƒXieÜâöùØ†>Àp3ÒÁ¨†iÏÿÙÅPÿçÕ«	£³Œì•{Áµ(ciôÞ¾GÔåÌ©õÙ#_úg§ä»e@ x	ðíÊE°Þ¸ûÜ&ÐËÆ°@6igÞ"O'±`,™v ùà·Cä$šAqŠ¼³¤á6$cePÂ‚÷N&ÚðOŸ:+KPâŸ;^a¼sðÊô|V×‹n¿µ_uËÐÜÄæòE,¾§‹­—(4À”îêwd	K=|ãŽ¨°FÆgÀ¡só}ã.!"!*d3£€|ùØ›'`§ºŽ.Š^H¼dNÑ®MžÎaÊT(`¨†L²SÏldæG$û„Y6N!"`¬<2¹ŸpÁ$pÈ°l$òM±‘Uÿ1L™pW‘q6´[»—¢ýdJ°wî¤„ŸÁcJsN0LŽ·<ª>â¸DY}8PX' ˜Dekc{èqd&×£Ix¢ÛCDZ‘1îGg‡ÙÉ›Má#Û(©ñ#SDðq	eK›Á¬‰ÆUÓ%B©¬û¸€o#Ò<X,ºØ¡·2*µ§,æ¼/^‘ð§bQ…¯ÊKgßÁ ä²¼]·N´š¬1'pË»#¼‘žä‘X'Îý9,’P:žÚb¦ˆËäì_sgõ¸;!Ñuôà*È?ø.£~8¾4?(Ÿ"}kAH)ê™éÛ¶uóëŒF†”Ñ6Š?»©•Ã±¬…‘×¨""©’°Ê ÂC<JôfŽAÖ x`Åõ ƒwÉ1Åª4ï]1Õc{)¢SBGÿ† hÈÛMWõ‚÷Û§9®@ü¢ø(j3Åvé¡`¿S»!Wš[ÖF;)0´ÿ0ù³øXÈÑÿ­ù&ÓÂš»?ÙºZÊhÒ”iaZ\ø(B…‡SQÂ§Óÿ:æ0êÉ>/œ jò©ÇÙ¡“)dÎÈQn ›Èsê{+hö	Uç•aWþZœcidµéŠäI©õqKÕzH«ûï\Ñ‡­‹Ë³«³×(‰Eý#TLfÿM•ÿˆR(Íäç×ägkngRš„‚“^Ýna,è£… —·Ûô?Þ}û±AL- vd8š‰sŠˆŠ}É.´íJµhVíðVÁm©}•Ý2ãK¹ þ[…W–…tqJ_$ëbì¼’š8istS7ô„<\¯gœmáÉ°;Næ6öÈ+Â¾§!ÞŠ¦dˆ8¢N(å™?¹ryŸµtç|4XÐ6X\¾&mÒ#³ÉÁÔÁ<ïH2Dc„(Pâ_«¢ê£vó3»$Í lÝ…Y&è(&÷kéªºßWc¬…Q¯ûÏ-—Yôù>¬Žàp/ÖÝ%×ûƒ½ Ù¦mç
cI2ÛqJVoPÓŠb=ÔŒtYb9ÌR:È€§ª¾|·¤3(<$¾ÿÕ[fF•†ÚŽÐ•¶åN•[}:Ÿ¾µªdOõ±î:Q©ô%óƒ<Ñ|4V§:iv¢!y9”g†×§OÁ0id~#ùÝ2ÆÇ¯€è×dëG–>÷ŽõCôµUú"“2ÖQiT€ô¢Slvð7ëìÔÆ2÷JÐVH-nõbÂù£Y$`þFa&$Ç+Aì“G,þâšÇÌwËEF;¸,¯2	È²wzã~,)yCŸð&ùP‹RÄR©˜ÀÂž3VÄVt‰”à	(¶'›‘—èÎ¿ŸàÖ,ZønÁúLrÔ¯{¬Ko±6Iœ¾G¶ó)°Mex9ö™F¤‚}P~	ç7N¦$à	.¼G"í:
¥,Î#^©r{â~¸ÔƒÐ•wÜ¥†Ë'l)ô7S³otÃˆ{£¼ªÃJ] O—rÍ}ÓÊ$
Þ~ÊŽ·…!*ß³WhÒÒƒ§hÅÈòÖiZ`‰§ixdÀß0zt>ÄY†¯ý=ðä~KÚ.Ïè/º,c¿ÃCg1Æö«sö{Ýqla)ÞºsŒ·™Æõ[¬Þ¿Ì‚ü2ÓZ
-HŠe¢KÐêX[’Öæí`yi'Á>(ºIN Å¸apM¦èq°ø¹-Žœ:ãÑüãž‰ƒ‚ðÿ&<ã•ò¼HyÆË?Œ_Ñ‚·[{Iï§´ó€×?(¦2Öìô%ÐÜÑìWKü7ýœ¯Ø„u^-½Ûô·ý°WKÿ>ý}Õsˆ¿Zú÷åóÜRÜƒJÂò¿ômHÿcÿYú÷ž™ójéÝfôŸb„­ y’Q“aÿãØ£ô¯CØ3ÒP4ŽÈ‡_ˆÛô·au§Zø.¿Ém‹ß„”w“ðîC°ƒ‰Î€¨RReäë‘uãÉh¼’@íã é ¹ô@¥fë–J~`91Ì…€F½k[˜À%b*z7ªcç°ÊÀ0kPÈ=œû2ºe î“G»ˆá_i‡ˆÜè`Û¾f!eRƒzHÛÏ*‰ƒ' ˜ädöJÏ’çÖBk
$œ	;`Z‹ƒò¨8vÆ!ú¬&
¦nç"Zz%LöâGÚ§Ò ÷ÓCnB*»Ç<…‚lðrg²'INü€ý­CÒÚ©Al ÌYÀ³f°,NghÍ0{JFŒÐ%”e.À—]céíuŸ@%ÜU›ž àI¼’+PÂNXÁp¨rB”ï%#N{õïºãA¢çÑ’Mª!¤'Ë±Ôè¯’2ÂBœŸ¿Ü¡•I–‚ƒ&Ù.ZÄ›¹n 1ÝJ‘Ï¨k¢ÿÙuXKeÔG3—¤ßÇ‹–Á¹†ñ‹6µ¸’Ì~‹”XÆ,x'e†ÿ.(Jc 
kg?†…Éd’‡,ŠpA!DdpM±q}ÁÊãø{Ý.
ˆ5^òÜ¦„À	Ÿz×Ž–=(Nºæ¼Üaï+|Ygê
@Ù§òm'|êïáÈC˜G‰¦Kp,áÛãŠßÇìÎÄ}írägáfÇHÚa¢V@6O&ÚWÛ2Ñ‡œ¨5(ÀNžÚH]IuÈZ19H{â¢øRÌÎ ë”kk<Npq$Vñè& Lëd+®4é&U+´µ±ü‡Y&°¿Ùµ×ü´{ˆE¦µyÄU<A‚¸â9‹`Æ`|CÓmqŸàVé™¢P¾qy:BÈB3B”1¬ÞUnEãhH¡ ®¯ÁÆ³µ½è€ÂeáË©à¯ü¥i3urøÒ®´¼GatêbeþbúþëÞ:_&ûBè‹Í(ž%æ[)¿ž–PÉ&-×Ú„êÑÁk«5Ø*˜Ùˆ¯ÛÑÊ|bvÊµrK[xïkä•Ö¢Hq%KP,¨þ‘†BG +­@÷žìôhëÏeß¶•Ekd[Óú’°ðyAî¶Iý³Øtí¶»{äGøÁ–•,Þ‚qKÅÅóñÁ—ˆ,Ù‡e‹)£ 
^fÌ0OË±K•zœ–·^]Þw}Œ¸´ï
iô¤Ö–Ðê´˜š/_»K&‰^)*ž–VŽÇë[Ñó½bŠ¯bŒ‚—D¶Î¤«ö_Š	jaQÛ&µ·ÚÀ÷0+Þôg¶n°'ôÿ5)¾D`uÍZF>ž;.Þ]i3WC~ÂçC×â·a¼ÅãSmÈîWÊãŒ¦Èd0ç©·%'8¼B“åMsx¼¤u”œìð**@Å'=úÕæN|¬QR“_WxæîIÏP|R¼so@e³//2AK¼ž§©ô«¸ž‹ì‹ýÒ©ÿÒ!u˜…HÏ¾4Ê«ÐhÑ](ºKê0AÑ0mUXô.½TÏ(æ°
‹Þƒ¢÷HæB(¦¾’E?ÏróCNÜHv)+ä©Ã„,äêFw‡ÄìÍÞ¹Ëž›œ©µ÷¡`ø¸¶—›+i·ç{^ØÉG`½œìÆfËÎƒI`D4çµe¸1,çÂÉnN]ÃªjÇ¿Á
x´ –Èþ‚RPs·Ý®»%SÍµõ¡³M”1nV>4å6®¼•¹ª»D7¡stP¡aÁU5»“b•Ç‡+ls‚š5šn˜…þâ¼“±ê‡NQÃ(od%wg÷UDæ¢º—Q¥P^>é}oï$)k–ÜÎIZ.ÉåR,M“—BFRAÊlšHgw¯j‡1g´$\]öìTq&ù#%±«ÔD"R‰°ïå/³_Rs«ˆôj "â·ÂÝ^‹¿qö.WáëSÞ—ä:0¯ôqÒÙIç¾÷²ìUÈß©“ò~û²¾À ÏÌÕ]$µ(^ç	&ŽÃŠ’PÖÖOŸÕyeæ(WâÁ¢¼œ÷‰'‹ò>’;+$®üƒ1h»†È¶+×ž]<³pj+#—¼óZúüPŠ³Å“«ôÃC(ˆðÜä™0å­mÏºFImNo¡ØæÔ…qÍ4ÀM\±Dey´Ô ]™3@˜5|ˆ&¨B¶ðLã`¶Úè*lØ#ÉÆ1/íj*!ÉU«ÈOÑY;~«©ØL‚óŸ;±l<|S>kðctõ¥2GZ"úsÏ[GZ¦E‚`¿1~skÇŒåÅñ)œÅ¯0!D~2ÛL:¥Y9–sª†’a"›Jz;Ÿ»˜9{üÄ2æÓüæ4¿ÔÁ¶„3[ÞüOÙ(À9aTÄÇžfHúœ¢¬p]6ÿ„DÑñai«ó±%`,oÅÐz@ËrÑ5Äº2{¥B+—:SV8à*I£vÂ9Ó©SÆJÜx¹ÒåUjÜ[å•š‘~˜YDž´M–BaW8j"‘Û	”<¶l„2ÁùŠí‘ËêÂ´–Ó–R‹,†ˆ‹p"?ÅÓÂûS—Ôûg§¢ÄÊUP¥j©Þã‹Wi>Ìç½ÈÐ~{g7´CÑ1œ"|&Ýª4Â3w—ÐÒ?F–íô¡ÃUrIÓî]±þNŽõHˆûWù´Ñ¿!«Wÿþ÷hÀ!uXT"|O ‰é¶CCêXªGS±fdctFÏØ¹«\n—sEƒ™‚¢Ð:¼¿èpÑy#q
K…øÅîv0c÷®q·­_Öÿl–EuüzðÖ×>Ïš%®Yv{ä¿5Ûj2­²CÎnµéÌ%?Y–z_º…Ý;ÐW@ÒÜÁ‡Ø¨Hf Q4FeP0Ê-Y×Zã	Áëa¢ÖMW8ûkV8ÿ†a|dÊ¦vÜnµÛ,ø¡å Št¾&ˆŒ}xçò°”ÓÇ~/M¨ÅËwV*’ç£qN_ýÐ@±F}»¾í¹1b[½tÖ3íò#IßžÛFÊoÌX6bÚ=Ó¡‚×dtºgÞ™ÏÞ™tï"Í&ºf¨ZÀ;C{RÖ9óì|yv¾P­KXžûpÀø¢~Oþ—çP|tó­Uò ¾òDÝó¨øYp=DfAß¦¯xÖíb¡XÆ\Ïˆ>ypÛB¦ü§2ßh‚Î«7cí£:âqMÏÚ&Á“Ûî	Ëù”ŠyòÞ•Î9Lôt‹CVjˆ{i‰ùˆùXXV­í ³ÞØt½³nO‹i™Që<o7ïwºÉÕÂÖ›êi	Ú³žÁ¹1¼^§K’…v»Äeù1¹^"&D²ßå±›¼&wT(õïè–¡éõQ›'w÷P£ß(¦™ƒ,‘ˆÜ¸ÙÚÔmÒ¸àaðÁ¢©ê,ÊÔ’ìHQ ‚‹‡ÕãœØÙ ”0-¾á‰Ú±uû~¬¶Ûé´kÍp¡úÁ²â1•ŽÆ]Áw¼ùü	ôý‰ µe¢òèÇ»·FíøÿýŸÿý¥cêäÙ>åº'Í2wt‘á1RO0|±?{‹mò—Úx–¾$wžw%ÀmÆo»èš„|gôVó¦9U	”<Ì¸DÿÐåÐ•¿[s›ÄÖ¦å‡Ýh·CMS–§•/ýáy‹\Ot‡(4»»¯Û…ys¢‘Œ@ÊV‘3Â½(ièQÍíáDÁS þîÐ}Æ(©¶7ü°ÀÑÒ§ô±Ž0¢¸%Í÷jž¸c“lÄ\‰(nqöNÍ3åÐ²å!àÍÀ¼<O-íOÖá%‘÷)tJñu
HHÞQAqåëŽ©~hÖh.R–`L8õ´ïª7¹îÏhÈøSâßÐ–èÓs¨^z“7† F6Æ…Â€)ñx-Rï_68el™¢úËÄÕgZ:Î/)ŽågâON#Dr‡et×7<ø&¿„#ØÆ8#ù…Ïç¹/²Ç<ÿX6¥a}Ñ¨e7–ú{Aj`8T®¢£ÀÃ#`I¬Îµ"«—dRÀ¸ˆA(z.ºSlÚßlU–©÷R22XsU´+½Ê³$ò•Ÿ¯Mšd·MN•†—Îmd»Á2åõHB?æÃ?5·ýy·HTŠâÏL®žLÄn¨8`TäÖ½Ûù|®±ÆVÉº°î#Éº:ŸÂu+¸¿Z²ê£ö¼ã¹xäwüQçóÌ˜;!Ä=PK Gc…m“Á;Ž¶”"“4¹d6tÉ«$™Y}Lm^ašörƒü•à&>ÈY<…xÒe³3Kò°eT˜(N¶õ.I®dí°P‘…fÊrÎ7ZWT	¦ïü-ySî*åK¯ÚäØ#Tëú#^¹}IêKà:(ö­~«©õvãîûr1%Å‘Ñ¾ñbcâ1(ô/±0šrÑ'4 C«6a…‡jJ;Ð;4 ìl|¨æ€.uÜ…A½ÂDx¸_¾Ã>¾ûþ¹»;.ÓQÝÖò¯7òuCÞ¤d,D Þ¿x¶à#oVkÁ_p—ÈÃññ1ÿæ,ø¹KcjiÓ×`Å‹½•~ölÂ'¼VÜ„Ÿ= 	?{@~öÐ&ülóMøY~ölÂ¨ëÙ„6áW6á÷žMøµì°¿§eMW4{º¸âˆFÐ"Õs3SÆ0_ƒ…_h0ä¯HâßöˆIƒ÷É`œQ·‰îœ©º‹†hÖ«æ¶ýüºG?ŸÑª¿ZºŠŸý¼˜M4Óûê)†£IÌúˆÔÅ÷‰9¦væ'E\-LšŸºx“‹ííEuÄÌÕ0{³¯qùŠDØúŸº{ø“a3t!’Ÿü¥K¯f•!79Ò“-7™d8ÞS\WSSÿ0œ5b(ÌŒ«Kå§/{Í>ªzòÈ­·Çêý[¶UÎxYˆJ¨ê9›míK³KÀÇºY¼Ž€bÐf¯jŠ¹CðÀæÅà¢©·µ%ºP>9/ÔgŠíhoKq£™Q0Co» îüLm‚«Ù¯jN+ßÎlµ2»àˆÑÈƒˆuÆuEa’Fbj¡è êù›èÀÓ4\áÌÏ½>:v›¹=þˆ–Æž„êÝ—í	àÀ<C4˜>6ChpD
ˆŒZÿÜ,*LPGÊ3på\Â®¯R§Ç0ñ¦EùÌºÑÔÐÔÇkì{&1™C»Q{ú˜’Á¢aï‹ÿRÿz—1Í­SÍ
sÔnÏ³±\ÝEóJüœ(Î»¡2\{.c9I³¾\P¥—Æã(ÜU>À.Ùç+±èªs›ÈOSa/¡—
-I³j=Œ@’ˆC4­ý aæ2¡À°[Xà/éÈ"aÉG/^4—ð „|"r%ÿƒkýtÈèà´	#q1Ê6rd8(¬\–ÁºRæ†›2)Ä¤4YÆkŒõ_ÕÞ™L×a´5ö^ÁÕ®^`ý(?”ÕÄ˜e¨•|ÅfÌÙT‡õ¸viÝ0K¹nƒøÊBQÿ-¿²+UÕˆ/Nc•œêXì`Žãð	ëÁ´=j°Ì¹žýÍ?ÑØZòÈÅi£_Ò¥€¸Ùº•‘Å#L_QúZì—Ôw*
ÅT£ßÂ™o€®¾¨®Î+þ1PºÁøÛÏ.‹ë[Ñâí@Û*2Z/1wt 1ÊõZ0'§e ×XU^ÍN¨è(|'
$|:()…$
&z5Qì?”Ir±C‰bÕäNøcª˜É…ª…j‰…þ:’¾A~™ß(zJášDá£ÄÂ/A¢ ðÿ5Á°é”þI”>N,ýíü¤”;näs[ÊÍÖ!Bº£LÝnöV†'=ÒLø˜K\v¾€ZYEªvWhç®t;#ßÂÏœo+kßžtûRŠ¤[Ù¾§6í¯0f9|õ ­9X¡5+p`Î·•µïÅ
í{±Bûr¾¶/®#_”jñÎÇ¦q©ãAáÃt"ë!º—I¿CšW8Ó·<Sfçàað‡ü¡Œ‚?ÆÝÀýnà~/p¿¸?Ü¿ÈµÅ¢íAÀ&ÖßbM
ÿF~«‘ßZä÷(ò{þÝÿÜÿ<ÿ|áÿ”op‹(ßèäƒ~0Œ>P£´èƒQôÁ8òàEàw67z'¡Á0 vô…ç±¤}TfÚH:ƒ--À‡¹ãbzÔ(l-$²’UÞ^A½uræ˜Lý–÷qv£;åtz§‚J®Ó‘Òrð-×qGAÕ.¢Y ®WŽ"j ]P”‘&ÈGQ‘kK‹Xô´¸LÅ§st¾
«Ê¿aq´3»2…Ð…±Þñ‹ÚÍ)ÊÔÄÑ¼@!œ¾fRE~Ñ{ùîNGsû†`=\fKø'XÒªÀwõ|?]íRg]¢zwCïNõî4ïnäÝsM>Z¬Pd_Ü®]Ù/öe_<EÈ~ñB|ñB´ø…Ü§  eë@È#V	¿£Š&Ë~Äë.ÇãÎ˜6¿Ôþ5×X™Ô·LkKêÃÛéîÅëfŸ¢Ùç~œ¥¥|ë²i£ðJLµM0Ô~^2(¼³HÑïsPá•Òv½—"GºóWrŽÞ¦ecÖ Ìb€ñB&ÑÁ£í#Ëjd¦Ù#mè‚ê´][Ñ]Òß#3e¬5a¼Èd¢«¹Ñn~'¶5MOÍ¼^ÒØ$¢â†°mÍcq¥¹ïp3óçëï±Ÿ>ž¸S£G¾Hùÿ'î(Ìs-êH?Ã¦x/Gÿ7¨¦™èÿ¡Oñ^ÉóF¯)eö9œNI§ÿÐ›üS¦Dù-Ç¥.
¶x ÿÓM‡ùËˆ^¥›Í£ZÿÒ¦×Ê½W¾„™¢â.Ò*E4ñÿÔÝ&å:r×d&Ih·Ê°<sT[¢<s€Nø%#„T4§,ÁÆÎw¢)ªf;;#Ëráÿ ïÅ˜ï¯Ùï«îè4E4¨K`Yº_'î®2æÁx"Þ´ÇúéÚÙâTwfÀ	äüãûß)ê	Uà*£¼Q„þ2rt+7»íŽ'=0™®\€}v+1Ø*Š—à0eSèzG%£Šµæ!)Ç2ænùæcôÁ*œíZ³U>·Wo)Ýi·¿_AEÜ6«(Ge"×ãç®ÊSåìÍbz„F”/ä¶ÉbÕV,ˆÃ£Z±œ
4òjÓ‚¼ÌQÙ—L.3ÑébìU\Þ[&1éúvÝPm˜O­398ªôJ´9"íW¢Ñ)aÕ”dWSÌ¤šbÔJŠÁ8™J
¢'‹*)iÒ©¦˜œ}jÙbr¶re‹Ù«¤˜Y%¥XÕ”¡WR‹Í-fw¬l+á%4¯Í´ÝÊsÀŠåx“ö
å¬g:8±¦3\Ab°"ub8Ãyô8?äQDï·Ìø*ZQÛSôû.ÆB’øo½]–Hõ¤,Õ{÷G3Pm'F´V´§™ @	®kÅt¸VªóßÂCˆê-å¨ü™ºÈ0±éÚ–áÈ9#‘Ó¦Õä¼Âîu¦>voVæy^ëõHAêÀÈû0FÇ¾4FGåå³Ø§•xÓì´Éÿ	‚‡Îù'$‘ŠD4‡{@|Ù)øÿ^1UàÏ?Ãb°ô~ÄMæ€€Wrq°ô‘ÁÓ’:‰3üy8£ì áÛë>UØ†®˜Czß£Ôyèˆ“0|q$î>…¼Úñoýk˜öÉ{ý«FÞê"®üÝ²ÿdûu<êz¡Ùº¥¾§§Ór (™kI^½1ÌA}šE‡éQ8Cþùj™°Ù*?	àLÑpºh¶hvCIÇ"™X:íÐ) ƒpB´„´áãå.õÐË3'Ýª‚Ü|© ''7aMá¬(¤ðºÄ!!xº˜Z3Ôüu-;Œî‹yØžünÂLÒ¢óX½ÀQI¼²¹úDØçP°OyJ†u¼ï¡8…îmB-ñ	-‹Ó·]úxMŒR,Í‚ü6/uíP>ïÛšBþn+¨èåí(]ý™¶ü«%àg0´÷=`–)Ø¬s×ò3KÇŽÉr“JRK½Ä’w:®=§ÇÅaC6É}6·Á‚Æ$K;è„gh.ÝÐ2ô?5:Ð2ãuP ¦‘äÀocg‹Òc„}U4c½ÅG0à]ìÀÜnä|Ò´u0×¡ß3…s†Ì¤ˆ„¶w¬-€èæhS=!ût±#”ÍÂæ¢¡+-rah8j#qQ& žDÜ	¨ÿˆÜMNà=Pï­—;ðqáÚ^mEªS5WÑDé§?iñ>†ºßD‘£;dÌ;R²î!‚úkèX`åí±­,àwei­ÀÆ8YkÌ‘2TŒá;ºhc_îÌêSK¡žZs }çúæOò“Ûˆìè;yÃ,[›¡mdºhUboZ£‘>Ôƒ9£QË(z^^—…‰¨ŠÍOT"âç”a™1U{ˆ¦ƒY¤LZtý†—ô‹ØC'”¯pPEÃk,{2ÕÈ5½”Ém#×ÙçKwŽÚÌ4â¦ÄÓ˜‚‹¬fü…âH®ÞŸxù}RteQh4D@XÐ8 BN¹¤‹CE`™‹ò“t±ØÌ!ë»¢'z5•:ðÌ†gé­®9xˆóÓ?­˜…õú°GàZß°¥«¿ækþ!,Ú`$% –â”ŒY”]ßâ6ŒÛ’ŒMºjÅ[0^/fGÖ¾îÄXlÉà­¤ë¸Š±Ç¦vCX¬éwM±iÐã¬b›t
vC¸ÍT3Ë'?bt_{¥:Ø†åc?«=ZínÕÃÏÁGCgK3›?½ÙÚ&K¢¢û1y w‡ð„ö*<q&`µÂïÐx!7¶3íâQ–_¾[ú´Öiç7îÀÌ
=†kÜ})^4’HÒöc6(¯d!“ÊˆRºåJá<ÿË…Jþ—.òz˜ÈÝ¿+Ûÿ[?qð¢ý–Xçn¼ÎƒP‡Õ×¹¯ó(Tg§S¶Òµh
ŸÒué
¯íÏº¢*]Qè‹˜ƒèU–T\	kÃ’¼Ÿ“bœ•€“Lª8lâíGÍ·ÙmsÍ>’É@ÅKKv'¨ÄmË"éýÒ®d‹¬\¿¾ô>ÍKþ‹ˆ`ò'±æ‡Ï šü»¸o¶¿nÅ+«z•3X±HïV2¢–ÕJ ¥$nŸð|ÙÉ›iw¹÷C áR£va¬†ÔÏÌ±¡;“R³òíÈÌ?¾rx-SÖ¯S-ŠÓ#µ‹wçÏÎ.ÉO—ç¿^ó·ääüÃEÿã»³+R¿º8iH&Ìì“
úvaõŠxDŒ
‹Û1bô0×ÕGðZ¿¾üxOŒš.7°Smì¯™e_·\˜_a9[ƒù©»w´xÐÁ#"»OƒWý\N§÷1“ï7"9|;š¹È„º'Lµ'ÄM„>g‚§%*’¥”¾=âhLt÷ÛAA~Ál=¤†¡
Ï\:û°xXGÖ¨¦;*rZV:L~xG½v¼LtÕË¥š_W»¾±™4hòõUÕÖœÂû\Åð`¶Þë–ÂÚG'OjŽìŠ·M~5u\]öa5G8™óÍOª%?-ñYÉ]£ž–J éÂ­Š«³“k0åI§Çað„æ9Í.$).y?ÅŠÉT¢~ˆ´-©Šý)ñ'ÞWx/ž{Ýïù¾asw¥ó1(ÖU÷ªè7‘îõr‘ð æê=åçË¤(a!$	‰RX-ÃPf"k‹p`Á/®u*z, »¬ÇËÅ£É+¨×NeTaDñy*	"ÙgÈÔ¹*ÍG¶ª¡îNB‹&%Tb û÷ö¿÷ö¼ãðßµcÄº¶õ.9_î¸“5‘B2G°óÎ~`/>‰.ŽTïŸ66Š0”ú%úÆ‡Bª€øÚ.;® s/]Šh¸ç(¹C»ívHÇ¯l]Ñ|ž¡Td–ôI©ŠHÜä~ˆÞÒÚLMêÞ\†ñëëµŽRÛ&µ+ÌÍ¨Ø*AëO%Îœ‚ìÐà%¯#þ
/RðzX·¸¥‡4…èn:Ñ÷èéŽê>Ðâ6OJ´iÔyxfë%0‹Œ$Li6–Û4éÝ
LÀëjµZáO·B|t×(Û¦NJI%]²<u‰äH$í„•ÆÁFKã`C¥q°‚4N9üS—ÇaŽ<ònØP‰n´D7T"‡+Häðá$’&Qxêò¨æY¬Ø	*êFK£º¡Ò¨® êÃIc(ûÈS—J-G*C±¡Ò©m´tj*Ú
Ò©=œt†Ó÷<uñåˆg¸76T>G-Ÿ£•ÏÑ
ò9z8ù	°žºdŽs$SôÃ†Êäx£er¼¡29^A&Ç'“˜4¢Û#×ÖÜÆÄ“Ðí
[Ü+}à¡yí¢¸²X\l¼Cf¶…›Q*‚âóŽÐixT9ø*žõö^¹N´©¶‘R”°$¿Ò\+±ëZZL0õpŠ¡Í«Þ¦ü2ÒMM]VíÝC…u4r2Qì±\²†U´wéL,¦^g>øS[€X3øÖ1CÖ1TêÄÇx$¼[^‚w7Q‚“òq–k!Ëî³Î>&°×#ÿ­Ù¡ÉCŸ¸í½‡O[6»7R¤½›hiWÎÅ9T>&‰Úï‘³[m:sŸ¸4í£4ñ–n´$%¥.=9îoâäø,ŽñKˆãA¼£¸ÆÄ3õ¾)+÷ Åô'Ë‚õ(Ãw¦ˆhÜÊýµöHDö ¼Èl¢È&e÷.mÏ®¹…IÜ_ôH0y)ð9“þoLê_ ÔG:büè•À‹òJàÅãPe[È²Ä>”ˆ{¼KMrûþîCqtŽ'Ë®@mxŠ¡»ßN9ÓJqoë¸•AþÄ³›£H2N.W‡-Þ9U2ZwAò³r÷§ëY0WDˆÀ:É“ì#õ‰(~D¾Àã=Eðgé	ÃB´^•‡«gj»¸®Ÿi¦Ãw¾3ªM8Q{H¢Ç3“EvÚ±¬<{ÄNÁj÷VÈû‘–à±¥ ð»1•uë¤¬ ÂSÜë4 ÷‚Ü=dÓìRðö®XÁŸz½j³Ì¡t~ˆ74Ôþ9^6è˜¸ØÞUOÕíÖ’Çõ¢ó[âAÖÀ9½è!Ù½vhLc¦òCÚqà|­èxkRAÕ[ÍqÐ¼Zª;xšÛžJÎ—–š4Š3¨ì9ROå¥au¼(}š4Þ£	]Ò¤æÑw%D8‰.ØÈ…¦}´Á[-@Ü„.ÄWxGåWxGÞÖH&ØSß”—¨Ó~Ê!vywQ§ý8üE¥ÛH¿Ý$QùÑÂoN£p7W gQÜ_Ôél¦ÃÖx›ë.âÚY„ýó-»Š¼+èÚí‘šKÝ§sùˆÉÄ¤`2îŸÝ¸ûÇOÊºª¶3¥ (Œ±ÐByøja7P7o-æ8¨À=„Î¡˜k(˜8¶”w(™žýAþ ]	P.hš´Ÿ+ò‡ß/:Z
!t¯NxJ7¿²æöP{0Rè¬Nõà,­†¨Ï(ÃVìJ ªvŒòwa±$£OÂ!Õõ¼¢•€ÆŠÍN÷‰û›:ìŒeEXÌ1_ Qá®rKÏààbvÆÐÀëˆwãáW±¹úÐK˜HN7©éÌó#†ºlÐò” ®•ÛûòTÉí0ÔŽ›KÐÙ}ê¢·› zv`"HAº‡öØ%Vú+‚™øY…(îU ŠË¡Y¯Å#4]¸"€Õ·°¸©¹Ê‚9~EÚä5Á•—‚	](žðn»†ix+þ´qwo¾ÏâN’szt†Z\¬%dú2,çkæ~”4þÛüÞ®ð×í>±©ù°#ä–”–L£dD°Ó#@ÖŒŽRP*"ks*C”ŒHÂ‘ _! cÁ\D71Ot“fy’,V*ûéûLÅÈ°ç8µE¤¯+&Yñ þ­øú[ËJ©¸–É¹èÿÞóþHCò.ÏNÎ;»äOî,±ÈòƒâNZÊÀ©‡JhxyyŽÇ@lörª›út>}Ëj\:êcÝuz¤»)èÿr×(Ÿb•¼OÊáX8Þl¯' ~ ¶5Ò]òA±Çˆ«8±¬`åãÏ"Ù
»Ô!·çIakß—Ã•–£l×•¶ãRû×sW²<è"½5Ð#
je¥}Öh­¬WŽ’ºéá[ Ó5“¢1MáÎ(áŽNp%w=5é2»ðÔ"kNntg‚Û¹6ïyîhíÂ&×n‡˜+&b²¿®€*êñ¥<U&»„i bÅ%fÑÎmÇ²›3KÇÇe×C:]””VsîbDÚ0V­|)&m*¢Ï|Ìj¥KN´áŸšú
“k1¦ã<§±\ð[ÍÙº+O­ežL0µÕ«e=°]©©NkYa	ù¾wiÐ'þšüÝÐàÞäpîôpúl˜´£ìR®ù;%¹,jeX [©›¿[`l…­Æ­»ãß5‡Ô…–e—Nùr‡Êà³ìJ^÷,»¦u¢•<K.½¤%º¬„à~´HýD±íykÙ7Š}Ïb[pº/º‹‰&`Ø‚e`Xß¸!˜Ô%ë2ÁÖG{P™ÍŒsÆ²Ê§¬r‡XŠ˜.:Gè;nŸÂ¢W•¯Ïl¼ª™Wÿ1öëÓ_§]˜PÛ³m¸’f˜Ì*g>›ƒy×c•ÚuX„‰BûlŠ«Ì–µ%XàÕÜw%‹”xíåÎÔBi+óÍ”„¼Éwq”Óµ›–ª±¡U5WÑMÝ"?ü@ê©U½ôéÉ$\7uWWŒWË%±fÊPw=Ò&wÙ2§˜úØ&ôQ'ï£€0“µæ¢y˜®¦²»›ÃÛŠé°Ýò^û
z7	Í¡nè,^í”öTº×ZÆÊÇ8)0êo&0‡xæþ.µ÷ˆ3QTë¦éLýàÚ‰®ªš™1›$%;Î™|^NöâË‚ØÞUêŠ ºÀP‚`ß]jcÝqíÅËÉ^!»1BŒqÆ©ÈÊ k~ÃcŽS†
HØÍ!a£ ¶Î·5UŸOÉÔÅ¿Úñ{•¶FÄ	Ÿ¤¦õP/§ðÕË½óòÿ®)öJWwç.Îcº~ ^d	ú1’Ð‚YÆØç¨¥¼„ÊÍém>³HFñJ<E"tÓN•ì{“k$B·Shc'¤	ý€[º{XäàŽ|2GîÂb¼AEœ)&Óº±•Yíø¬³bÑžCç)|õè|g~µô¡¶s©¹g&Hýâ1Pz}ù±J2ã!.UÑ©Ü–Ù~ ŠQ¿×÷¿o<"’Y„dAzå¤CÒ‹à"°è$°GªBHXÎÖ“ •–b[Çiš9†aAKÃ^Òíçx‹Šz`D”e\ÁzêÕòð.‰:<<Š{&’â™SÂ;ñÑŠš:.>7ÐÄ°ÆcŠÏ—nÿ´ŠÆ·ˆ£‘ŸiÀŠU~´28`ªÌêu÷¶‡ÞçmâÞ¾SáÞœctuFÈWB vÏŸÚâÕ’åX(õÎ~›u>=F‚–˜e;e|Ó‘X;O¯$(ƒj\C³X¯¯£‹{âó˜©Ê7>Ò8a%XÛ.ï»m¡Ž­¬™iO'ÁƒÑ‹Ôè¼÷«x°PüKú#þ}Œß”¢~•0À%ov9ÇZyQ©;ifOle«À@péÒÔnZÌ Z*üß`Ä§<ˆqK3›?½Ù*}Yžj´Èâ(mmT5	Så¶yƒÓ¬kÏÍ!Ô‹·ÃŠ5jü>Pó÷®m®Ÿ„hˆ2ç¬žM™•G¸VÑ$Û\¬YÛ©*/ê÷]ÄTQáÐ9Ø+_w#{¤po$† ó“#tøÑ’Þ€¦‹2n4äª|í/«œŸœá=Ïq¬ç;Õ‘þQÔÇp‘ÇwrýâÛþí&ºÇ]âôýÄ×};¿P5CÁ7[{IïJbµ1¾ÓRkŸ›RŸº­}[›þ3bv0W6w]#Èƒðb7š©6á>D6uàmŠÍU·5Dü¾ö{¨s·ÿóý+˜éŸA›l5p/£Æ}ç±‚#ƒç„<¿iœúv\Ýw*ã3M÷•î¬è.]ÆºßUF#ºSôiëÄRµ­m²…µ²ÿ#û)°*þ<±¦`ÖÑÛSm¦Øòˆýrô±I_ÆŸ?Átà lµb/¶þI—S\7¡·ƒ®„&‰kÝýõzÀ VêìÐj±NÂ!þ¬Mg†µÐ4ÖYRTô¨ÜË¼Ûå^÷¹,5b åÞ?›êèpÈ»SRç8XáìvÖ.áF™f;)÷ù{e`Ímr‚J«\	a–ûæƒ5Ðù‘`ŒNêoG}š÷Ã˜jO?CŒÅ?óqOBT×ÕLU1‡ZŠR¹°5‡ëþ@Ü_ì&ï¯\Å;OCqÌ”…SBvWÀZsA[þ«9StÕûìªSùÃþ”k]uÎ<V´LÍ}R*—÷Üç!ê,[w@Í±N<ãj˜`o’ïÌ/ß-g¶öõƒï¢„ùBŸO£Ïhgý¥R6õf¬àì{;ôäýùŽLèÙ…&Èþ©­#8%ÿ‰2w´§Â¼¶… œïøö“Z†Î÷ŠšpƒP¦æœö
+Ç[xô0Ý±â”¯›%†Ï©ÌA­¬µ#ÍÖ8°]@ªÐ(.îC+±ÕŽ0«UYð–‹óYÚ¶‰5Ûá0­v˜üø­ý[ÏyžO%6ßo-®ú…Ñûø[îÍRPÑØ²#}uB³•±ö7´lx •|v•[!ÓÊ-A‹Ø2ùpþF!cè¶¨XîTÕ“–û(›íÂTe|€Yà«²þpHAú…rªt7Ðj[S½ß°É¼±Ÿ‰¦¹©í·‡öQêi(qò}Þ¸ºúW˜‡H (¼GÞ™ôMñó|îŠßh
á³ÇØÎ|ŠæW¦Þ
öÆf71Û‡›X!P‘T™ÙÍù»¼/WD ¡ãPlÄnâuW™Ÿ4w3Èk!õ»Ë»Ò—rN ú*öÈÖõùuÿ=y÷ñäüÃð¦ÒÃ ×i	˜,MÿJÝ‹?òç3Íu(œïÌm¢B\w;$ôò¾F¸œo‘;ùÍî Ygÿ¸8ûxuv#L`,Å¨-â=dÍÜt?Ã©¿Ë¾|t!VË…›ðñìš\\ž¿}w½óþüŠ·¡.Ý»Ò½]A“¬ÍçˆcaÐl{dÙS6Ëíª3mU··‰^0ìÄ9Ñï¢ÛÉ¾ãý6‘ŒEÙ&vkÈÔB´Ï©‡Þ+àHD[ÓEiaL¢Ô};&ÜS?ñÁZÃ2{fY›¥ájè†_VÓ_i>€c Lˆ‘xtÀp™(J’ÝR^G÷KmúeöQ$Ê=¶wn·Ô‚uÅ’<‘µ“À¯ý38wÀçÓ¹î	Á‡i]
€ tÓ%HäÈ¶¦íï”Ð•Þ±„¤:£šO<z.B	Ý!?x)êJO@X(ÇRöÕ#JdRýžk²COE¥Æ;B(UO‹<]¥šÐx¡VYs=•êG@=«ÔpiÙe¥!WšOèiýÜS½NÝn$Ûê Ö¾¦Ùü…”&–²ú‡Ö4TzÀ¶} Õ˜ª'ÕY±£  Få: ¤¾bçÄkB}½mfzh1`ë+Ù)°ôÁ ›N£AþJ:í6º¾Õo5µÞiÜ}ÿlR¬“ÐXŽëÜ›ÊàOL_ë¬°²ð–©ž•-Ú{£¸"[&é…û¯<+£5+#Šû¬‰$®G¥‰Îá/
=a.älÝúˆûãHÝ.iÄdÿ¶Šñ’¤4Bþ¶g•±f•aÙµó¬4Ö®4ñEN'öç~ÒÀÒ'Ð<	¨`dVBõà|S`Ø²ýí®uß”ˆzÜ½õø|QNÎîï,²/Nl”»œ¡7²Oª1Ž)ß¡²‡È+öcÄÃ?ž¤Kã>ö1qöfø,hÒûKum$ngš^9:õ^1Ý‹E&¦žeÜ4sh:Á¢eŸB!‹4¤/MÖ&f¬oæŽn2P{ƒ¶Îbf¥g8n™æáþSÿääü××ï>þÄ·¢XÓªÛô¬Pá°®à³mdÙ…vÅ|\ŠŸ={#ÝøÔEmøû~ñ~o|R7ÿ]ó31xVQ¨WdãªÀ~”ság÷ÏëØVh¦+ÿ!ŒO¢ÿêCÚiE?Ñõ¦€âaÞeÌóZ«©4pc(ûswbÙº»Xëv)ÕêaŠ®'¶æL@$˜æÛ}±ßn·™ª¹À&¸¹{rê_›Îéíï¥'A€^ÕÒœGSå¶U°öîQûbU¬s¸"~Ãb$‰3`A´}ô=ýrîZö‚¢Á”è£³«ëwú× Ä'ç—ç—pK®ûÿ §¿ž=Â®{·Ýj±ÃXà9‡È!†®t<QÉ%¹ÁÓWŒ,cr]ßÂÑhˆ)‹¡|“3V¬KÄ,åyPŸ'©â“ýáÈ/qx\7ÍBÚ)]séìˆOb}j]‚àú^R¿ ³»‰‰é*ñp’nOÀžçWÛPg Tõ5óÚ\;9®„ÿæÍÃDŠª3d÷·:.ó.»ÖÄ2Å6áïÎÆ;LŽä‡çÓ™29ìAMñlcüW[ÆÔ`¥ûûÁBCŽ…aò&‚l	{°*Åõ–Ý‰eå&íÀª‰;°…û$iÿUMÞ-\6ßz/Lž”îÜb…Ò@¯¦HÔ‡ETJÚ`Iiš#®¸ñVÖh3aqÕWŒÿ+bb¬4ƒ‘sä˜âm~Á™ò;|×î_pª¹µN²üís€ŒÒ4\•¦|uÞ(¬«ã'Þž–s»ï8Úúcoè^´e’Ÿa†Ñ›giauÍT—ï	ƒF%”ðëè¤S>@‘‰@ùœ
i`,ú—­‘n€¥QWlTFŠÝ¢«x‡qÿf«Ñ²Ñ®ÕëÊp¸oQÍ÷  áªEpµðDñ¼	ÿ A„ÿ  ÿÿì=ÛrÛF–ïùŠÖÔˆJDR¤¬ØV$ydIž¨Ê‘U’¤ÖåM@¢%b êŽªö[öÓöK¶Ïé@À«áÁ¾œ¾>÷³-üz2—+À<’êqoj“$;³ü…:ð#<Ã£B~¤øQþH½J˜Ë3BT:òl…²;{Â0ËÀuF//Kæ)n£IÄ¶9§Œy‰ÅØædˆ¢ÖQµtSm[
ˆ½ö¢™DÜ‡<·-É[¾ÐÒÂâx„£:@\à%)e%iJ³ˆWX¡†pÒBÈðCøml¬à%Éš(yCfìö
 ƒÆ(ºäUD)††‘kÑ¤@‰öËKÄlalr|tõ#yóöÝ/z£\×Z_úÆA©ó²×º
[á‘dDk7gÒ’B¤2‘3‘œ¤ÀÆY½ÉKÂä-&Nr‘¿±ý "“ëð—#ÔÊûž•˜Ÿnj_Á~|(ff){€hÓ±—}¥ô‰¹¦¨´Ùól:ÿý`ÐÆ›»B¸Ì9v÷•Ž¹Qg ÷‚òœOGipz<tòJa°UÐíƒ¡"O/‰æÎÃÐf€NIÍ.†^þŽ¨}ÌnoôWx²1µöÒƒXÍ•ùŽ ¾t¤ñ¿ $ìØß¡·jT˜ d•H1Ê‚á-CæBP\HHÁ“Ò“Ü<Ñ›j¯7FóôWM*âŸÙÑT.Cy¢s]DKkdôÙÉ‚ƒÅ`Î[Gä?ä4»0ãÿ!*]*_ú×»ª#‘¤àSü­ve%,ÖU}ZUãªº˜;RG¬ÃºFÐXÙ¨ðZ®m™[a}ÈøÊ†1À” 3m$Ö
XŽ4]µM%[=Ôt|‰GÜDœ	¾ ýã¤¿!öias›b
Øú¡˜¯nàÒßEàï71ÆfG'™š	TG¡ëÉ^j4œçIÃ»¶£Ô÷w$Ôö7O”#Fª‡½½„,” ÞcëGîXpŒ\"N>7™
aÏ!aŒáQ’¥éPH)8ŠÞý¦ä Ï¸X¿Í
v2YiDw‰¦5ñzÔý¾l^\ž^ž¿ßI´‹öhu«vxôºJ^ˆyu¢cú]!Q÷›À$‡Î€ò*xB@M0½/Ÿ†cXÐBaI\:ïjµ¢Ê0,J\YM×`B›GLß´XP¤~Á?LË ãÖñ\f"NÙ#ùÑŸ ³¦/ŸKÚr€gài›r’§ÌÍæ™”\ +ŽíÈ!$}…=-Áx|·>~l¬Œó£ŠˆßP¢ UòŠOŒó+œMÑ×À‡|ªårŽ—Í5>oûŽ)ÁcYºAÏ'‰a0pb…'F•À#E|1’`À«Ô+Õ‰ipÌ[\ö¦iŠM"Í¬ðâ|_ëÏõâI€Å“.ª)÷P®w•®¥j{)O{ut®VÝn¾Ó–€Ñ¹…Ì2ÌÛm	ðpe£„˜K€Òh„B´«-Õ€>¤álk¿ æ5#ù¦¼001º¥yWSQ®–ÍÀÏ`3FF0'ÎõuQFOŽ¬‹? 6ãÛFlÃ2ÐÊ´ÅÈU_6%H×2Õ]oÄ°œl€ÿ*Ø@5FqI·9ïsQô¸IN”G!ïáR¢©Ìnc”{+A,D­¨BæÙ=’¢LÈÿýÏÿ&ÞJ•h9éÙXé´ZjÙPàœÞýèø”Qóå9©$;VKL¹wqÞ:‚´wzÚ,KñÃ³ÉŒòð	9†«}ÊnËq¬•eÝ™3tãÁÆïÁ;qnœ0Ø#-2°î_€Oø½$¶Úý”<œ/æµ¡Þ]_w=Ë·ÑHqQ{JW‰ýu6„5¹]Éþêqw¨¿Þö*-€ÉßéXNÆ"(‘CÒNE"Z´¤ÊTDá}ÒˆJgÓ‚T<¡Ý2‚—²B—‰$ª9‡¢ØjÛÍímµüþ÷‰)~ü0|?òo‹Ø‚_Ú¦‚KsÖ=¥hTÓ®‚=¡
dí¤ånœˆ¦ÎØ:Ú€›G~}Ú>óÙ>’-a“Ý4ïY‚m½ÈÊ6b¤äþiˆ£Eß7êƒZšôýà/¹Þ™½âQ™uYsûM®zl@ñuWŸb+o3ÆyIK­äŒŒëµKï	üÓ@C˜kÔh7w›5îÐh¥¼Æ„ñ‘÷#×âT0¸/ Ô-âØ÷ŒA“¤‚âÓãÒt-û†ÃhÈA,’q’cäžfq‡³6ÛXÓe¦Ç¹&0¢(cMòxµÍÍ4PÎÐvn<•øù<–øÐŽ—Tƒº5€)Y#˜,ˆ‚’ÿJÉß/ÆwïI¯
¾q4¬EÕ¤®i€ñu;Ò&F¤mJá˜¨©é&ç;Ä·ï.²Æ˜D:šþs7¥þLÀéIåXCj¹ªþH×Â×sâ1Û@
neÜpBŽ/á?ÓŠÕa¬T©”pÓôp†žûÀÚ÷)/Xgè2ª²˜Ý¼ƒ Ñcœ45Cí@íÛK=ýÀNké#sâXôFÓE®Í}%¸þLØ:—StÇæ¤‚ˆB>,—’Ï4%vòY˜¼sE*yÇ"ˆëäÅËÊZÑ*²“Ìon(ìßtAÚdf€ðŒPî]Âœû9ºÔÌ®úì¿&;4NøÀ[ØOQëÌÞ}:6F–S%qzÀZLÄÆ¦ð¸—?óÝü-åo_vÚ8ÒÎÿ
nöïÿò€0ç¨yÔÌ6"è§îY_»@ÔÊ,ÁOš4jö\‡mÅóeuËS<ë§VX3=üµ4ëC©A–»oAQs¦ªåp\ÌŽùJ†K2áâˆrV6‡·Vs±0Öç˜Ã“žà¯æŠ½v†)Sù7ü]dZ äÞˆiÞ·L •8¹Û·2hxVÕÙ§Âê4q²ø’ÂÑØÐLex*9LvŒfêAœÈb6°3u…þ*²#î¼¢ºá?+t2/£ÜÒÒ:]È_Rœã˜·­•ðèKÝÅCzGv ˆš6û+Šä ïšÜ ÃÆ¿^o,ÒRM'LŸ^Ï½»ô4|uÈ‰òÊ}–B2óºiÕ6ÔR±hY6½0•áéŸ´Œ-s¸šËœ!¼’0+Ã&r%ÇÄL°"œÜ…juö„TDQ‹Ýï2´šmWj²¶ìSƒr]ÐLØðÖszôÜ[Šb}ouáPÃO¿±$û63•˜ÆYCí²~µ ƒË4¡Öv£„äÖšÑ”{öÆ2R¬IÄFm!c«†!F_†­†E¬¥ÏÑBgN¯lÝ)Ìú¢CšEùO…èdmðÂhåxÕîzöƒ¹öHÂôGƒ¦a¿5ð`!›é/l<áOžm¹i]–¼ÑáÁÄ	.9Eeá}noxì2,0©#B
hxf¬Y¿¶Ü€î±àÁ¤Ï6…KñÇ/NØ?ö†×ÎMº<£ï]¶´XŽðžâ¤më0Š$­ÍËæß<þÀ%×ÇgÇG?;çú„ø´çùv°E¤Á:ûÓ^Y·þ?¡à™¹EÆ…xµCœ3¯¨å÷úï©?`MllÇ¤Þƒwô1På¶`j¢jŸX=Ö"¸ï3¾-Ù¨+ÉFúÞÎ#oCþÒ›Øg½Ö‡c×W½eƒd…)ÖüYüˆõÍ—%VÉ	NïaZÑºTýžVÄéÝÙÀºá}^h/b sëò@+Ð±-VæôúšÝxõzB“Šáôd%TM±yÎœ[xøæzÜbCN–úWÏþdÙNåáCñ_5G¬°`›òªi(ÇÈ<^Ð÷\Ê#ŠÜQÿØ
h]hŠz>µBÏß(PÔ²ÎP+ÈéðO]{ì~¶lêv¶ÛÛÿ¼Oàya,~|yzôþÝåo®N/›ð´búù%ñÁ*Î‡RÇù&%¯õÇ±K-Ð	E?>Ž&#yØE@ë­ÿm5þ<jü×vãå§ÛhÚÊðÖxÇ§g'²ÕºŸ=·Q¥Å±ÇŽkjƒ‰VØëÓàÄëAk±h„6>Š™Ïš/`þ“¦ ž¹M¾lÊ+ý€ì˜ÓgÅ$ê‰×OµUùU%V~3ú©O´Pú¨Z;Þ¸NÐ5ó ¡alñÈ·º2tÒÌ

È¹´m/¾•7›CÅõº%4 Ýè0*"ºÛDœBí£p³yCÃ÷Î PH#*aKlÆ0 {¾{oé5„¤©Y.îhùoH¶Ëµtž<{¶ƒ
~§óài¯HnLÑÚ£Ž[Ç[¤ÞÞÞÞ&ß’ïÕ?g›¢ÞcrD<^ÎÙðÚƒ1qyPÆ¨‚;‡Í½,”¼ePS 7Ø{¾	A¾ilä{Bll×êRwOo N÷òËEfóBN.ZW¦]Zã¿XÜÜ˜áhÄöç­åfôs~”Ùfûñ‹Z/ç^­»Ne–æöO2Ûg7ò.¡Ééõ—ëfNÏåif³]w¬ Æ¿c_R¶ã2›ý=ëšË¸nx¦5ýaÛ;«i¾9»&Š¦ô,±æUÉömzmÝ°â2ŠShÎ"Rhé<Î§Ú9G*yˆbäc=ôÇ4u)³™²XUIqˆÜÎÄ)ää™ÓY€«X+ÖbW%~Áà‘(HH¨k…Ç2F™4VGð¶—Y_ÎqêÒÛ¸r›äÜk²õeð“ïH;­Ø8EjìÏ'ÍÎlc1NB3[””$…¡ðOŸ‘pò ‹ë.ùªWŠˆÚÌŠ0Ä»&¯?ìc%ÛëÊ±›Ÿœøéõé%R´‹¡(ŠEëâ‚ßÄâÚŸYßßQyþÛX\Åà…ÕoCéKê:7ì;õÅÓŠð³b½ý(Œ®—Wšo*¼îbµ¢Íf¨ý³XìÆ»¤cS†ÅÁÀnÙ7õ!sŽ±…dßP5·ß“(Ê6§o¾ÞÑKx7¥Z‹¼ëõÆ#ü‘¬}14òžAòöXßžx,amsjª[OÕíIü™1^Y“‡ÕêåÎ€äcŒøƒUÓP¤ªœyµ×ûÜ„·kKWõý1jî÷MžŒÄ´©.ßÅN¯ïeÎ	Š>`F¢ÕG)înô53NÕŒæRÖÌ›J^M›ÈJÎ¬¢Ïc„àõiŒÞgQ}.8‰œr'€Tä4JRÞPü
2ØIa)–×¥§¦
x·bI+šlþÖˆ~–ÿ9ØÿŽÒ¯å4WzwÙ¯o¯~mŽCÇšÿ¼áo¡Çs#åm¥ná»n¼J×ó>ÿÆè#O~fad‚hõ®»ÅúÝ"5¾~—\jPKV¿óÙ<½awVøÿÆåx¿ý}¢± ¡wvõNÊ^››1ZßÞ"ííÍÇæ½Üÿ®µ¬þhµÈOZïZ`ÝRÈ‘vãy7ìRD(k±Q3º­éz7õWË<<@ö;¨Æ.ÁÀ	BˆÈ„Ã—õñ†® ¡€`T‹Ðaäî¦>ÈÅ£É$å”²|MºQ/7¹`œa£ßÇF‡$®®I(g²Ý±Höþí{wðwÌKàßã t®]ÞA7à¹õ½Aõ“ìABÙÎPí÷Û© ÏîÝœØgq÷ƒÚ!ßM\¬qÁ÷[ývF_£Œx‰˜ØµÃ÷Ð[©ÞØ‡€Üp÷22^kGSPÃð¡Î¼xÐÜo
Éß3×#6ï0Ï;Ys×‡!ƒ#SW ²w§÷YŠÎù¦ËV-#;°Ÿx6N“O[‡Mœ´ëÜ»I7¸¤2eÀÎ˜e{wðWJ¹¨k-†ÀÍsÑ1›©dëSöO¼»¡ëY1½Ï]ãé7žÕHë0{ö&šœ[ÜüG³ÙD×Ì+†
 èÇ>#*ã~‹¯Õ¬™dŸL&Éa—œòJgPŸL÷^JÝN{(˜nÏÄ.LÆÃÑ§ÇÐßÖéuð’*îÏ6SÉ:¯Ù).VEã#ŠWàŒD±òWV¬¼âƒŠg¼UQ¸OS¬‚älŠ•Ö¹É¢ƒŒm±ÂI¾³è<‚Â¹esÊcQ´ù‚ë“3²G*l¹cºã~dÅ_¼À³a pn´·w#ªìj…o”(órwQõÂqlÊ iì"6ÏdW(‰jj|•KÆÜÀŸ;ñ±ùßX|þÅ´v¢V7X·ÀœBÎàFß±£\€Àad1gms)ömÏFle™Æ'áaçòžÚÂµ~`ç˜éìsµ¦ÞŠÕe´ï˜Í—Ë˜"0ðFv«C¸¥pxøBÜ¤‰ p°²»s†£q˜Ï€%+'ÑòÍRQ×gõjbÝäÑ¶ÈÙÉa÷‡³vcç·Ã8Ö1=˜Dš—|Ã,v£?5»©4kÐtÊ´Zþ›Øì#¯ØAB„‘ÛhwØmÉ¦U’`jGÁF»lèiŒúºözì2~¨ÑÑHùpŠÄ2ØýdOSÆŠfQ¶†c‹ïÛU¸û†5½¬MŽf-†©SÁ”k Q|ö®ûÔšb“•í~WŸöô)/`ÇzÏËC*´·“DX¶l/”ÃN^í·Âþz Ä93 ÄHÉ·Íõ„ÈÄ5-&æn	éõú€éNHëú€¦‹èÖ*Î$­<ºÄu] æà\¢sÄƒSO‡-ß’êç¢ü}´¤ÔGÆ.'Nãˆ?Š¢ø‰I7Y*ÊA ÛÄìêypaüªšOÓSÍß¯fUÑþÆ¥ò£Í1`U©ð$ä3¨ÐD`,•°u¬'Ë”æ–öûŒ}øG§ìŒ¤\:Fžh`G”&0œivQò%âçß'©¾"½±x~cä9X(É¶j+^{þ@:+ÌL>ÜØ×GWåô|Ú‰ ˆ(p*Øb¹ž+D)3@X-ÔÏ¾3¸!ßKú‘Xn†Ïø²f –ûü?¯·$;hler9µ¬§Z_„>AþÇ›ºã\fõÐBçc½‘ÕsÂ‡F'Ÿ‡Ím»| uxÖ%v–^+d—›‘i¼ÌìÈô{@¦‘r#—¦õ!:·^‡&Æ·2š‚#C9íˆ’¶k(„nÄçÿÁß;°"ŒÒµkKÀ¬)¸gÇ¬ñ&fåƒÃÇ½–ØõªïP×>îS¶jä¦¡Ï)BºLàž°²±ˆ¦ )”8|™8
G·z%ÀÈÅP]³ ü½rü$€ž#z‚cØé5Žù	9‚èKAN™™ÒiÔj‡“˜UìÜÒþäzhóOŠ*\r¹š¤>Í¯ô\Ls¤Ó_Zr%ƒ Í Øi>üpv²èF™|Sot¼™^‚3BÜ¶Ý_Æèç•hU…m-„o¥Pf‘}V…¤»‘“G+Õ@¥d¹Zè ².q±ô|6È$%©­–í©¤YfÙö
œZe¹›–=O	æQIœb€²Òá’?Ï=mµ|æìŒŸHš³ká»vËÕ+×_{Wu¨|gê2¬TÒý™%¼ødî^Õ•WÜàªU#ÞÍg]ê1ªP$Ø v^ŸŒ®êjÒö	äLL6?M‡67¹ÓÙc!q®€ˆ§šç=¥LŠóÝÜ8á¾Y¡©ÈÙ¯ØPŽ¥fÞ3éë$-ÙJËövLì7«ª†ÉDØŒ:sBCËqƒòU¼&O¨#¯Ä‚çºç=Cpc‰B`Ì šåTÉgn§K>eú¶9ûq“OÅc'Óñ‹¨¶Î»s?}ò§ðÔvBá V½½ê[ž}„aN§R5Zùtªp:d­:ØŠT‹ëi©Ô¤jÉDN‹ÝE|T«ÞGï}+èwÖk'íÁÂÝåþWe"æOXè>Ü//hCô«‘5<˜<4‘Åá¼Â	Ù2æX¹ž¦)'”Y¥†Rö=1Òhèm3EÍU… O[‘¼`P¼˜U—1iò,žL?Ù—Ê§#˜3öNzq“70ÓF××Ê½íJÏ©„‡Âá{ÿX6®Þð†<xc_„“oË¶‰…‘¢4«I³Sn.TeÑGáâsº”¡ç«£¡3`ësáÓ B‰¤š¨€”Ù+… ­)q†Œ&ml“?»ôÒùhc?
ošO­ˆØŽ“‰´þÚc¨v
=kñIˆUjO«Dï°\7	J)F±cHÌÂ¾EÊ£KÎ±B”ìT·žm£†Üö½ÄÁòAz“Ùržo×L“¾EÐ€€ýÕ|¹»EØ«Nµ…Pµ±•©¤¦
(q×¡¸¿çÇNs×§ƒODèã¹[D:€¿ú/·oûŸRš»bÌ±/ºJNŽÙ+7ÅœÞe"Ûµ1ûxJ·Åh$è²šE¼¥Š#Ó8e‹×E'7|D¹¦g"ƒæbÎw-„Û€ ¸®P $!2psZa´…9Wö*ú—2¢Ïyä@âªÃòºB]ÓXRÙwpˆæ*íèPR•X:ÅO	HJªËeêw
–,M-UÛ×rÒ§}ÊxbvnÑ²Ê»ŽGD‰X¸ŸeœJb!†Ú·ø\ƒÝO€&±ÞÈ÷z4 ’FA•I!ò­ &%Ó¯Ö8.Ü1„,‰Å>‰
.ç¯qö˜˜ïË8SGƒ/ÂgyåÆÊ€©Ä7wp+
çé"LÚ<†SOxŒÉz‰"F†•ûnSDUŽá4.:¶Dêî|@WbF¶·¥|nT$ã,$CøÃ?péàWoïE?wx&û¢	“Ö·äŠ!Ñ®åï)·”ŽhÈ·­‚‡"ƒå{1›.Û(sb;ˆóÍ™Ê9\à]•ÏNß½ýö2c¬ht0‹I¦(ÔÙ<ÔqÑE4Ý“,«lEIªndl#0þ[¬ïQ›²™gP²ÎpÈJ09Îœ,Ûcé¹órÛ ]­nz0?Îi‘ÞfðT³æA<C¢yeˆœÕ¼òDÃ©X¤92<ÕM’q4å•œÎ°»´ÈÝRhÇ¯¡ÆŽ1ÑÒ,òzì;Á-p}püÐc09­~@Sy‰‚ËÙÌ¥@¨nÌUUìm¢(’Ð‚Üä=< wä¬ÜˆÕëÑ;ˆèòÐú¶º
*ïf6…¶Ê BÉQÁràwðªùqûÓlšh )¡­dDþêúò¦ˆÜšô_!p§=¼é¦‡!
Á>è€Xb4(}öQô¥ÌÙbÝYNôJ8(qXØF½30dÚƒÙG	O"Ì`³ÙÔò%Cj°æEe+ú<Îm¡à¿£ ÂÁ~¸|Ë·ÙŒv•kÏ`q‘'–tÔ6‰“YÕ°Çâ½ðd:Ï›sæzFlÎ™	aH˜6ƒÐ12udÝ gVtVê€CN´ú›óÞ‡ðv;?!%<ÈPF"I³‘Œ€ŽQ@A÷Æèý˜r‘LDk¬¾/„¹É%°âòjÍ@×ÍßÊ¤º…É¢-E¦ËÐbå×\Ä’ŠÒ†¢©Í¿¤°ez¤‰¬²ó¶|Üiu>­JÖR0Å2e-…£Rà~#£R¬RØ2§€ð˜„-Ó‚Sð™ø¥/àà¨Ù£M± )À±>HñIzÎfèùªä1\€ŸûJPƒ'iMÑ®Ÿ¤5ÙÏ“´F=OÒdæ’Iž¤5j>Ikä“M)=Ik²žåJkÒYWž¤5OÒšÜ&Ÿ¤5ñv– ­ÁpbOÂšÌ€{E¿6QMnD¾•Hj¦çÃÝûZç[9ÍLùàÉÓƒô=	iJ ð•
i`<ÉhŠvý$£É~žd4êy’ÑÄY8žóIDS æ“ˆF>™DÒ“„&ëY‘„Fæ¸}Ð<	hr›|ÐÄÛY€Fw–™ß*gtgÌÙC6Žî»*/±JHk’QèQS¢Œîy]«1á‹ó»Us°´ø˜u!ë`¥‰‰g³' j6f¨Í¼M)Ýã9l§,ÊzÙmS{1SXVf#oºÎò´¸ÓSáF‘®—$wÚ÷FˆøŠ×~¹¨þÂ8ažÑoøû¶ßâåæÒ	o”Úˆ–ð¯¹6ÌÆ }¾çÛòåiíð’2æpÎí~¸ 	ŒmÍÞã6Ö°G]wÎ-Ÿñ0ºâ^éB‚ßªÍï·8ªZ`(Þ¯ë2g4 åþŠnðtö ¿ÎBÐ´;8]Ø:_‰‘Ow¾U&gl
¢kÍç3‰¹Î="ú>ŒÚEAÄ¦hi<L—åSkNW¼>c†—»ÞE‡s»ÔGì,Ñ>»ƒ©ÏîÛFÖÌrÉÐc‡u]]Z©Þñ³ñ£R~œ%™·ò¨·DÑBe!TÅO–3$o€ç~Ã#¹TP1°÷zžÛ …›i¢°Q..GRß—½M`¬8T‚xÿ övc,/ûf-}®õ´Kú	½~Bµª{äfâdDyøœ‘ç‡5v¤ÿCV£¾ºê¾y,n2o¼"ÿ|ÆpEŽ§
£å5ó«%š¯-f˜±RãÓÒ;•_TÓ8¾ç/ž5~eþƒÿ/z=?œžÊ0Î(_TÉaªŠÆQ~:×ìw!Ã„8Þ5yíøaß06Ûë–«"ÇÃÅÌÀ-,üs‹ßœÿÁtÀÔ×ò'LU5.Î1».CÿaAÃº¤®sÃú7ŒÉŸÊHÖ3ŽæÝˆvAÃùÉë‚b5ó ð{µ3¤×5Ží»—ÏÛC–ãfá>ö©
âÃjñóƒ/kñQÑ{Äÿ´=öqØìyƒñ‚ú'€¡Î\¿‘*Sm“õÍ'-4p.éõÌcž•ßî7F÷Ql´Žˆ573û^šàêïÏ¾ø2—o7‡÷¬µGä+ÍLUª²SÀœ‘A™‘ŸÀ’±@KjNú;³™p.‚Æ~ÒçJŽ7ûT‰ç^éó¤jÊ“4Ô0e˜äËt	K`¢tuU‡µ° úÂ<DÜŽ™«tË¾^Ò€ža¯âfhbáë†ƒÊ\3€¨úzÅk/Š\®–ô	Ñç õÚwè5vR×ÿâùŸžÜA@}éÚþjqý	;Ü7œ£ Çl³›ø¬¨È1‡’<W¼úâÑ>ÏŒ"ÎÒ—FöQU#H›7Ma/€X ê¿‰©L‹l§ž5¹ì@õºÙ#=±ØaÇyh/p˜ïé`DÞZ]H&Q†‘2<1â% @µ{ÎÔÆÂw*Ûqö]‡PõªßvÉúK¥M´à÷Ô´lhå¦YÔT ©2sÉ+oMÉ•9-J ¥Ta£ÝáÄB2ëa¿{ŸH×Co §DÙÝ&ìò$Á=fÊ¦0¥u*ä½lÎ¼˜ykñj"Ún+®z~QR·3Í`ÇS5î½S8_Õü®Pž´ Í6
'"(cEYÕí¥R’E¾iŒÚ_ÒÃ%¾ØlÇËÕŽ2pLtÓ‹Œ¼Ð•F¼¼‘v:'(b«¦],i‹‘LÇiG³˜¯eƒg;ˆåa)£{-³+
(u Åý09™˜ZQ*¦¬D`ÆO	ðö[©|_±ï  FiéËHÞ‚Ýw×»O©‰diþ»Õ“‡}d›íÓSþ0bºbÒsK!¶»Ýz™L!6°¥ÃËŸ»^½q¸ê”b3æ›1‹X¹ôaˆG–Ï¶ªH¶%{±ÉÂîxž“Xv-’ãœ›ÚþÊ™ÂÀÝy*ChýD ?ÐKúG†AÈ%ÅÝBå%=µºNùá¤©dk0k˜bM·RÎÕÃl\´lk‚´y§q@$%^H¯®ÝíüKk
¡]ÔªœÇÓìÇž8ýŒ¨¤°ÍÝˆLìb)ÊdÓÜ}„a;E&d	ÿ²èÒü	›~k#±(wá”[y%°¬{Ykeó‡oøæî³±§„1“È£nq®tK±ž[º(g7+¾‹»±ÙªLE¿¥8Lù†<î1dú€›_áYd]`»(+Þ8½ÂÝIÈD\Õ Ø³Ç¿t_«~+\ö£õHÙOT{IÛßtââKÇ:èLøz°Áš„¾Bl#ÔñÅf3ô@Èç¢lá
—ëtØø×ë´¥åÕÀµ‘Ì[˜ØÆiÓÛ,‡~DucE	éIÔ­JOÙÆÊõ¸ù«êÌ‰ö#]RîžµÒeÖß÷Eð^<iuìSÌ’6‡cÓ.;1»bl*üþEüÂ€~œÈ’ÏØ¿[Ãw€fÀµèÄDf€©Ü­d^’žŽ
% Ñg]6z0*eÇâKžâÕªC^}I÷nýØnnw>'^Cž¦ -Só¬'jó‡BŠ¢¤(êÄ6åTöÊèµ‹£kðÑù^ˆ­cÈŠËÏqîÛàÚ»Ñ&NèåŸ×…ð1®jDüTÍÈßÓò|@$²þK5#~NoÅGÙoCÜ+$ºd2êCá[Çsç%‹‹ŸP!VÜ”uŽ•!ÙdÊ¡Ø”ÜH$wÜ,q‚°v(næòÇØ[^¦_Ö ¢Sƒ‰WÚÏ8yÆÐÖÿ  ÿÿ ˜¨ |