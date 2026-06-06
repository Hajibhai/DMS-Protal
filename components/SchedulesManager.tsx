import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, Plus, Trash2, Play, ToggleLeft, ToggleRight, CheckCircle2,
  Clock, CheckSquare, Square, AlertCircle, RefreshCw, X, Users, Settings, ClipboardList
} from "lucide-react";

// Firestore Client SDK
import { db } from "../firebase";
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";

interface Schedule {
  id: string;
  stakeholders: string[];
  reports: string[];
  active: boolean;
  createdAt: string;
  createdBy: string;
  lastSentAt: string;
}

export function SchedulesManager({ 
  user,
  employees = [],
  attendance = [],
  deductions = [],
  accountsPayable = [],
  accountsReceivable = [],
  pettyCash = [],
  everydayExpenses = [],
  projectedExpenses = [],
  selectedMonth = new Date().toISOString().slice(0, 7)
}: { 
  user: any;
  employees?: any[];
  attendance?: any[];
  deductions?: any[];
  accountsPayable?: any[];
  accountsReceivable?: any[];
  pettyCash?: any[];
  everydayExpenses?: any[];
  projectedExpenses?: any[];
  selectedMonth?: string;
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form fields
  const [stakeholderInput, setStakeholderInput] = useState("");
  const [stakeholders, setStakeholders] = useState<string[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>(["summary", "attendance"]);
  const [isActive, setIsActive] = useState(true);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch configured schedules directly via Firestore client-side
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const snap = await getDocs(collection(db, "report_schedules"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Schedule[];
      setSchedules(list);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load report schedules from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // Add a stakeholder email to the list
  const handleAddStakeholder = (e: React.FormEvent) => {
    e.preventDefault();
    const email = stakeholderInput.trim().toLowerCase();
    if (!email) return;
    
    // Simple email validator
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    
    if (stakeholders.includes(email)) {
      setErrorMsg("This email is already added.");
      return;
    }

    setStakeholders([...stakeholders, email]);
    setStakeholderInput("");
    setErrorMsg("");
  };

  // Remove a stakeholder email from the list
  const handleRemoveStakeholder = (index: number) => {
    setStakeholders(stakeholders.filter((_, i) => i !== index));
  };

  // Toggle report types selection
  const handleToggleReport = (reportType: string) => {
    if (selectedReports.includes(reportType)) {
      if (selectedReports.length === 1) {
        setErrorMsg("At least one report type must be selected.");
        return;
      }
      setSelectedReports(selectedReports.filter(r => r !== reportType));
    } else {
      setSelectedReports([...selectedReports, reportType]);
    }
  };

  // Save new schedule channel directly to Firestore
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stakeholders.length === 0) {
      setErrorMsg("At least one stakeholder email is required.");
      return;
    }
    if (selectedReports.length === 0) {
      setErrorMsg("At least one report type must be selected.");
      return;
    }

    try {
      setActionLoading("saving");
      const userName = user?.name || user?.email || "Admin";
      const finalId = "sched_" + Date.now().toString(36);
      const docRef = doc(db, "report_schedules", finalId);

      const docData: Schedule = {
        id: finalId,
        stakeholders,
        reports: selectedReports,
        active: isActive,
        createdAt: new Date().toISOString(),
        createdBy: userName,
        lastSentAt: ""
      };

      await setDoc(docRef, docData);

      setSuccessMsg("Monthly report calendar channel scheduled successfully!");
      setStakeholders([]);
      setStakeholderInput("");
      setSelectedReports(["summary", "attendance"]);
      setIsActive(true);
      setIsAdding(false);
      fetchSchedules();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to save report schedule.");
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle quick action active/inactive status directly in Firestore
  const handleToggleActiveState = async (item: Schedule) => {
    try {
      setActionLoading(`toggle-${item.id}`);
      const docRef = doc(db, "report_schedules", item.id);
      await updateDoc(docRef, { active: !item.active });
      fetchSchedules();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update channel status.");
    } finally {
      setActionLoading(null);
    }
  };

  // Delete configured dispatch directly in Firestore
  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this automated report schedule?")) return;
    try {
      setActionLoading(`delete-${id}`);
      const docRef = doc(db, "report_schedules", id);
      await deleteDoc(docRef);
      setSuccessMsg("Schedule channels deleted successfully.");
      fetchSchedules();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to delete schedule.");
    } finally {
      setActionLoading(null);
    }
  };

  // Test and immediately Send Monthly Report using locally computed metrics
  const handleTriggerNow = async (item: Schedule) => {
    try {
      setActionLoading(`trigger-${item.id}`);
      setErrorMsg("");
      setSuccessMsg("");

      // Compute details for the chosen month & year
      const [y, m] = selectedMonth.split("-").map(Number);
      const currentMonthIndex = m - 1;
      const currentYear = y;
      const monthName = new Date(currentYear, currentMonthIndex).toLocaleString("default", { month: "long" });

      const activeStaff = employees.filter((e: any) => e.active);
      const monthlyAttendance = attendance.filter((r: any) => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
      });

      const monthlyDeductions = deductions.filter((d: any) => {
        const date = new Date(d.date);
        return date.getMonth() === currentMonthIndex && date.getFullYear() === currentYear;
      });

      const monthlyAP = accountsPayable.filter((ap: any) => {
        const d = new Date(ap.date);
        return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
      });

      const monthlyAR = accountsReceivable.filter((ar: any) => {
        const d = new Date(ar.date);
        return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
      });

      const monthlyPettyCash = pettyCash.filter((pc: any) => {
        const d = new Date(pc.date);
        return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
      });

      const monthlyEveryday = (everydayExpenses || []).filter((ee: any) => {
        const d = new Date(ee.date);
        return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
      });

      // Simple Payroll calculation to estimate Total Payroll Cost
      const payrollDataList = activeStaff.map((e: any) => {
        const empAttendance = monthlyAttendance.filter((r: any) => r.employeeId === e.id);
        const empDeductions = monthlyDeductions.filter((d: any) => d.employeeId === e.id);
        
        // Match base payroll properties
        const basic = Number(e.paymentDetails?.basicSalary || 0);
        const allowance = Number(e.paymentDetails?.allowance || 0);
        const hourlyRate = Number(e.paymentDetails?.hourlyRate || 0);
        const otHours = empAttendance.reduce((sum: number, r: any) => sum + (Number(r.overtimeHours) || Number(r.otHours) || 0), 0);
        const otherDeds = empDeductions.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

        const gross = basic + allowance + (otHours * hourlyRate * 1.5);
        const net = Math.max(0, gross - otherDeds);

        return {
          code: e.code || e.employeeId || "",
          name: e.name,
          presentCount: empAttendance.filter((r: any) => r.status === "Present" || r.status === "present" || r.status === "On Duty").length,
          absentCount: empAttendance.filter((r: any) => r.status === "Absent" || r.status === "absent").length,
          otHours: otHours,
          netSalary: net,
          grossSalary: gross
        };
      });

      // Summation of financials
      const totalPayrollCost = payrollDataList.reduce((acc, p) => acc + p.grossSalary, 0);
      const totalAPAmount = monthlyAP.reduce((acc, ap) => acc + ap.amount, 0);
      const totalARAmount = monthlyAR.reduce((acc, ar) => acc + ar.amount, 0);
      
      const totalVatReceivable = monthlyAR.reduce((acc, ar) => acc + (ar.vatAmount || 0), 0);
      const totalVatPayable = monthlyAP.reduce((acc, ap) => acc + (ap.vatAmount || 0), 0);
      const totalVatEveryday = monthlyEveryday.reduce((acc, ee) => acc + (ee.vatAmount || 0), 0);

      const pettyCashIn = monthlyPettyCash.filter(pc => pc.type === "Income").reduce((acc, pc) => acc + pc.amount, 0);
      const pettyCashOut = monthlyPettyCash.filter(pc => pc.type === "Expense").reduce((acc, pc) => acc + pc.amount, 0);
      const totalEveryday = monthlyEveryday.reduce((acc, ee) => acc + ee.totalAmount, 0);

      const totalIncome = totalARAmount + pettyCashIn;
      const totalExpenses = totalAPAmount + pettyCashOut + totalEveryday + totalPayrollCost;
      const netProfit = totalIncome - totalExpenses;
      const vatPayableAmount = totalVatReceivable - totalVatPayable - totalVatEveryday;

      const reportStats = {
        totalIncome,
        totalExpenses,
        totalVatReceivable,
        totalVatPayable,
        totalVatEveryday,
        vatPayableAmount,
        netProfit
      };

      const attendanceData = payrollDataList.map(p => ({
        code: p.code,
        name: p.name,
        present: p.presentCount,
        absent: p.absentCount,
        otHours: Math.round(p.otHours * 10) / 10
      }));

      // Submit data package to Express SMTP mail router
      const res = await fetch("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stakeholders: item.stakeholders,
          reports: item.reports,
          monthName,
          year: currentYear,
          stats: reportStats,
          attendanceData
        })
      });
      const resData = await res.json();
      
      if (resData.success) {
        setSuccessMsg("Monthly report emailed to all stakeholders successfully!");
        
        // Stamp success in database непосредственно client-side
        const stamp = `${currentYear}-${String(m).padStart(2, "0")}`;
        const docRef = doc(db, "report_schedules", item.id);
        await updateDoc(docRef, { lastSentAt: stamp });

        fetchSchedules();
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        setErrorMsg(resData.error || "An error occurred during report dispatch.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to connect with scheduler engine.");
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate high-level stats for cards
  const totalSchedules = schedules.length;
  const activeSchedulesCount = schedules.filter(s => s.active).length;
  const totalStakeholdersCount = schedules.reduce((acc, s) => acc + s.stakeholders.length, 0);

  return (
    <div className="space-y-6">
      {/* Visual Indicator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-brand-50 rounded-2xl text-brand-600">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Scheduled Channels</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalSchedules}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <CheckCircle2 className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Daemons</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{activeSchedulesCount}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-violet-50 rounded-2xl text-violet-600">
            <Users className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Stakeholders Reached</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalStakeholdersCount}</div>
          </div>
        </div>
      </div>

      {/* Info Banners */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-800 text-sm font-bold"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-sm font-bold animate-pulse"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center bg-slate-900 rounded-3xl p-6 text-white shadow-lg">
        <div>
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400 animate-spin-slow" />
            Report Automation Core
          </h3>
          <p className="text-slate-400 text-xs mt-1 max-w-md">
            Automatically package business analytics reports, then email to subscribing stakeholders on the last calendar day of each month.
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-brand-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Schedule
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSaveSchedule}
            className="bg-white border text-slate-800 border-slate-100 rounded-3xl p-6 shadow-2xl shadow-slate-200/50 space-y-6 overflow-hidden"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h4 className="font-extrabold text-sm uppercase text-slate-800 tracking-wider">Configure Dispatch Channel</h4>
              <button 
                type="button" 
                onClick={() => { setIsAdding(false); setStakeholders([]); setErrorMsg(""); }}
                className="p-1.5 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Stakeholder input email tag list */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Stakeholder Recipients</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter stakeholder email (e.g., manager@pioneerdms.com)"
                    value={stakeholderInput}
                    onChange={(e) => setStakeholderInput(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddStakeholder}
                    className="px-4 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>

                {stakeholders.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {stakeholders.map((email, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-800 rounded-xl text-[10px] font-black border border-slate-200/40">
                        {email}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveStakeholder(idx)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <X className="w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Report selection checkbox panel */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Include Business Reports</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div 
                    onClick={() => handleToggleReport("summary")}
                    className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border select-none transition-all ${
                      selectedReports.includes("summary") 
                        ? "bg-slate-900/5 text-slate-900 border-slate-900/20" 
                        : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                    }`}
                  >
                    {selectedReports.includes("summary") ? <CheckSquare className="w-5 h-5 text-brand-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">Financial Summary Report</div>
                      <div className="text-[10px] opacity-70 mt-0.5">High-level P&L statement and net VAT liability</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleToggleReport("attendance")}
                    className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border select-none transition-all ${
                      selectedReports.includes("attendance") 
                        ? "bg-slate-900/5 text-slate-900 border-slate-900/20" 
                        : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                    }`}
                  >
                    {selectedReports.includes("attendance") ? <CheckSquare className="w-5 h-5 text-brand-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">Attendance Ledger</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Workforce metrics: present, absent and overtime logged</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active channel State toggler */}
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
                <div>
                  <div className="text-xs font-black uppercase text-slate-700 tracking-wider">Channel Daemon State</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Pause or resume this automated sending channel</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className="text-slate-600 hover:text-slate-900 transition-all focus:outline-none"
                >
                  {isActive ? (
                    <ToggleRight className="w-12 h-12 text-brand-600 fill-brand-100" />
                  ) : (
                    <ToggleLeft className="w-12 h-12 text-slate-300 fill-slate-100" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-50 pt-4">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setStakeholders([]); setErrorMsg(""); }}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === "saving"}
                className="px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 active:scale-95"
              >
                {actionLoading === "saving" && <RefreshCw className="w-4 h-4 animate-spin" />}
                Add Schedule Dispatch
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Configured Dispatches list */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-2xl shadow-slate-100">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h4 className="font-extrabold text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Configured Active Monthly Dispatches
          </h4>
          <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-3 py-1 rounded-xl">
            {schedules.length} Scheduled Channels
          </span>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 bg-white">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mb-3" />
            <div className="text-xs font-bold font-mono">Querying Automation database...</div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-16 text-center space-y-3 bg-white text-slate-400">
            <Mail className="w-12 h-12 stroke-[1.5] text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No active dispatches are currently scheduled.</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Add your first scheduled dispatch configuration on top to automate email distribution of monthly analytics report.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 bg-white">
            {schedules.map((item) => (
              <div key={item.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-slate-800">
                <div className="space-y-3 max-w-xl">
                  {/* Stakeholders list */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="p-1 bg-slate-100 rounded-md text-slate-700"><Mail className="w-3.5 h-3.5" /></span>
                    {item.stakeholders.map((email, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-800 border border-slate-200/40 rounded-lg text-[10px] px-2.5 py-1 font-black">
                        {email}
                      </span>
                    ))}
                  </div>

                  {/* Included reports */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivering:</span>
                    <span className="flex items-center gap-1.5">
                      {item.reports.map((rep) => (
                        <span key={rep} className="items-center px-2 py-1 bg-brand-50 text-brand-700 rounded-lg text-[9px] font-black uppercase tracking-wider border border-brand-100/50">
                          {rep === "summary" ? "Summary Report" : "Attendance Ledger"}
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* Creation stamp & Send trace */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Created {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    {item.lastSentAt ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Last Run: {item.lastSentAt}
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Never run
                      </span>
                    )}
                  </div>
                </div>

                {/* Dispatch Controls */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Active status toggler */}
                  <button
                    onClick={() => handleToggleActiveState(item)}
                    disabled={actionLoading === `toggle-${item.id}`}
                    className="p-1 hover:bg-slate-100 rounded-xl"
                    title={item.active ? "Pause Auto Send" : "Resume Auto Send"}
                  >
                    {item.active ? (
                      <ToggleRight className="w-10 h-10 text-emerald-600 fill-emerald-50" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300 fill-slate-50" />
                    )}
                  </button>

                  {/* Immediate Manual dispatch test send */}
                  <button
                    onClick={() => handleTriggerNow(item)}
                    disabled={actionLoading !== null}
                    className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-xs transition-all flex items-center gap-2 active:scale-95 shadow-md shadow-brand-600/15"
                    title="Send Test Report Immediately"
                  >
                    {actionLoading === `trigger-${item.id}` ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 stroke-[2] fill-white" />
                    )}
                    Send Now
                  </button>

                  {/* Delete schedule */}
                  <button
                    onClick={() => handleDeleteSchedule(item.id)}
                    disabled={actionLoading !== null}
                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/30 rounded-2xl transition-colors border border-transparent hover:border-rose-100"
                    title="Delete Schedule"
                  >
                    {actionLoading === `delete-${item.id}` ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
