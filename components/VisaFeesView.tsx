import React, { useState, useMemo } from 'react';
import { 
  Wallet, FileDown, FileSpreadsheet, Search, Building2, 
  Filter, ArrowUpRight, Award, Coins, Users, CreditCard,
  User, CheckCircle, Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Employee, VisaFees } from '../types';

interface VisaFeesViewProps {
  employees: Employee[];
  companies: any[];
  user: any;
}

export const VisaFeesView: React.FC<VisaFeesViewProps> = ({ employees, companies, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');

  const isEmployee = user?.role?.toLowerCase() === 'employee';

  // Find linked employee for the logged in user
  const loggedInEmployee = useMemo(() => {
    if (!isEmployee) return null;
    // Match by email or nickName or code
    return employees.find(e => 
      (e.email?.toLowerCase() === user?.email?.toLowerCase()) || 
      (e.code === user?.employeeCode)
    ) || employees[0]; // fallback
  }, [isEmployee, employees, user]);

  const filteredEmployees = useMemo(() => {
    if (isEmployee) {
      return loggedInEmployee ? [loggedInEmployee] : [];
    }
    return employees.filter(emp => {
      const matchSearch = 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCompany = companyFilter === 'All' || emp.company === companyFilter;
      const matchDept = deptFilter === 'All' || emp.department === deptFilter;

      return matchSearch && matchCompany && matchDept;
    });
  }, [employees, searchTerm, companyFilter, deptFilter, isEmployee, loggedInEmployee]);

  // Overall calculations
  const stats = useMemo(() => {
    let total = 0;
    let count = 0;
    let maxVal = 0;
    let maxEmpName = '';
    
    // Breakdowns
    let totalInitial = 0;
    let totalApproval = 0;
    let totalDic = 0;
    let totalIloe = 0;
    let totalLc = 0;
    let totalEntry = 0;
    let totalChange = 0;
    let totalMedical = 0;
    let totalInsurance = 0;
    let totalBiometric = 0;
    let totalVisaEid = 0;
    let totalOthers = 0;

    const targetList = isEmployee && loggedInEmployee ? [loggedInEmployee] : employees;

    targetList.forEach(e => {
      const fees = e.visaFees;
      if (fees && fees.totalFee && fees.totalFee > 0) {
        total += fees.totalFee;
        count++;
        if (fees.totalFee > maxVal) {
          maxVal = fees.totalFee;
          maxEmpName = e.name;
        }

        totalInitial += fees.initialApplicationFee || 0;
        totalApproval += fees.approvalFee || 0;
        totalDic += fees.dicFee || 0;
        totalIloe += fees.iloeFee || 0;
        totalLc += fees.lcFee || 0;
        totalEntry += fees.entryPermitFee || 0;
        totalChange += fees.changeStatusFee || 0;
        totalMedical += fees.medicalFee || 0;
        totalInsurance += fees.insuranceFee || 0;
        totalBiometric += fees.biometricFee || 0;
        totalVisaEid += fees.visaEidFee || 0;
        totalOthers += fees.othersFee || 0;
      }
    });

    const avg = count > 0 ? total / count : 0;

    return {
      total,
      count,
      avg,
      maxVal,
      maxEmpName,
      totalInitial,
      totalApproval,
      totalDic,
      totalIloe,
      totalLc,
      totalEntry,
      totalChange,
      totalMedical,
      totalInsurance,
      totalBiometric,
      totalVisaEid,
      totalOthers
    };
  }, [employees, isEmployee, loggedInEmployee]);

  const listCompanies = useMemo(() => {
    return ['All', ...Array.from(new Set(employees.map(e => e.company).filter(Boolean)))];
  }, [employees]);

  const listDepts = useMemo(() => {
    return ['All', ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];
  }, [employees]);

  // Bulk PDF generation for overall summary
  const downloadOverallPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    
    // Header banner
    doc.setFillColor(79, 70, 229); // Brand color (indigo-600)
    doc.rect(0, 0, 297, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PIONEER CONTRACTING LLC", 15, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("OVERALL VISA & ONBOARDING FEES DIRECTORY REPORT", 15, 23);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Total Record Count: ${filteredEmployees.length}`, 15, 28);
    
    // Summary Cards block
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 42, 277, 24, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, 42, 277, 24, 'D');
    
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SUMMARY INSIGHTS (AED)", 15, 48);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Total Expense: AED ${stats.total.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 15, 55);
    doc.text(`Average Per Employee: AED ${stats.avg.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 15, 61);
    doc.text(`Total Initial Application: AED ${stats.totalInitial.toLocaleString()}`, 110, 55);
    doc.text(`Total Visa & EID: AED ${stats.totalVisaEid.toLocaleString()}`, 110, 61);
    doc.text(`Max Fees: AED ${stats.maxVal.toLocaleString()} (${stats.maxEmpName || 'N/A'})`, 200, 55);
    
    // Table Headers and Body
    const headers = [
      ["Code", "Employee Name", "Company", "Initial App", "Approval", "DIC", "ILOE", "LC", "Entry", "Change", "Medical", "Insurance", "Biometric", "Visa&EID", "Others", "Total (AED)"]
    ];
    
    const rows = filteredEmployees.map(e => {
      const fees = e.visaFees || {};
      return [
        e.code,
        e.name,
        e.company || 'N/A',
        (fees.initialApplicationFee || 0).toFixed(0),
        (fees.approvalFee || 0).toFixed(0),
        (fees.dicFee || 0).toFixed(0),
        (fees.iloeFee || 0).toFixed(0),
        (fees.lcFee || 0).toFixed(0),
        (fees.entryPermitFee || 0).toFixed(0),
        (fees.changeStatusFee || 0).toFixed(0),
        (fees.medicalFee || 0).toFixed(0),
        (fees.insuranceFee || 0).toFixed(0),
        (fees.biometricFee || 0).toFixed(0),
        (fees.visaEidFee || 0).toFixed(0),
        (fees.othersFee || 0).toFixed(0),
        (fees.totalFee || 0).toFixed(2)
      ];
    });

    // Add total row
    rows.push([
      "TOTALS",
      "",
      "",
      stats.totalInitial.toFixed(0),
      stats.totalApproval.toFixed(0),
      stats.totalDic.toFixed(0),
      stats.totalIloe.toFixed(0),
      stats.totalLc.toFixed(0),
      stats.totalEntry.toFixed(0),
      stats.totalChange.toFixed(0),
      stats.totalMedical.toFixed(0),
      stats.totalInsurance.toFixed(0),
      stats.totalBiometric.toFixed(0),
      stats.totalVisaEid.toFixed(0),
      stats.totalOthers.toFixed(0),
      stats.total.toFixed(2)
    ]);

    (doc as any).autoTable({
      head: headers,
      body: rows,
      startY: 72,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 12 },
        1: { fontStyle: 'bold', cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
        12: { halign: 'right' },
        13: { halign: 'right' },
        14: { halign: 'right' },
        15: { fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] }
      },
      didParseCell: (data: any) => {
        // Style the totals row at the bottom
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [224, 231, 255]; // light indigo
          data.cell.styles.textColor = [30, 27, 75]; // dark indigo
        }
      }
    });

    doc.save(`Visa_Fees_Overall_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Bulk Excel generation for overall summary
  const downloadOverallExcel = () => {
    const dataRows = filteredEmployees.map(e => {
      const fees = e.visaFees || {};
      return {
        "Emp Code": e.code,
        "Employee Name": e.name,
        "Company": e.company || '',
        "Department": e.department || '',
        "Designation": e.designation || '',
        "Initial Application Fee": fees.initialApplicationFee || 0,
        "Approval Fee": fees.approvalFee || 0,
        "DIC Fee": fees.dicFee || 0,
        "ILOE Fee": fees.iloeFee || 0,
        "LC Fee": fees.lcFee || 0,
        "Entry Permit Fee": fees.entryPermitFee || 0,
        "Change Status Fee": fees.changeStatusFee || 0,
        "Medical Fee": fees.medicalFee || 0,
        "Insurance Fee": fees.insuranceFee || 0,
        "Biometric Fee": fees.biometricFee || 0,
        "Visa & EID Fee": fees.visaEidFee || 0,
        "Others Fee": fees.othersFee || 0,
        "Others Remarks": fees.othersRemarks || '',
        "TOTAL COST (AED)": fees.totalFee || 0
      };
    });

    // Add Grand Total row at the end of Excel sheet
    dataRows.push({
      "Emp Code": "TOTALS",
      "Employee Name": "",
      "Company": "",
      "Department": "",
      "Designation": "",
      "Initial Application Fee": stats.totalInitial,
      "Approval Fee": stats.totalApproval,
      "DIC Fee": stats.totalDic,
      "ILOE Fee": stats.totalIloe,
      "LC Fee": stats.totalLc,
      "Entry Permit Fee": stats.totalEntry,
      "Change Status Fee": stats.totalChange,
      "Medical Fee": stats.totalMedical,
      "Insurance Fee": stats.totalInsurance,
      "Biometric Fee": stats.totalBiometric,
      "Visa & EID Fee": stats.totalVisaEid,
      "Others Fee": stats.totalOthers,
      "Others Remarks": "All Active Records sum",
      "TOTAL COST (AED)": stats.total
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);
    
    // Set column widths for beautiful look
    const colWidths = [
      { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
      { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 18 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visa & Onboarding Summary");
    XLSX.writeFile(wb, `Visa_Onboarding_Overall_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Wallet className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <span className="bg-indigo-500/30 text-indigo-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            {isEmployee ? 'My Personal Account' : 'Finance & HR Management'}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
            {isEmployee ? 'My Visa & Onboarding Fees' : 'Visa & Onboarding Fees directory'}
          </h1>
          <p className="text-indigo-200 mt-2 text-sm sm:text-base font-medium max-w-2xl">
            {isEmployee 
              ? 'Review and export the individual breakdown of processing fees, security clearances, medical, and governmental charges associated with your employment.' 
              : 'Complete directory tracking of governmental application fees, security clearances, labour card, medical diagnostics, biometric scheduling, and visa processing charges across your workforce.'}
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Visa Cost</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              AED {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Average Fee</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              AED {stats.avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Employees Tracked</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              {stats.count} {stats.count === 1 ? 'Employee' : 'Employees'}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Highest Processing Cost</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 truncate" title={stats.maxEmpName}>
              AED {stats.maxVal.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </h3>
            {stats.maxEmpName && (
              <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{stats.maxEmpName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Individual Employee Specific Layout */}
      {isEmployee && loggedInEmployee && (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg">
                {loggedInEmployee.name?.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">{loggedInEmployee.name}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{loggedInEmployee.code} — {loggedInEmployee.designation}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadOverallPDF()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/10 transition-all cursor-pointer active:scale-95"
              >
                <FileDown className="w-4 h-4" />
                Download PDF Statement
              </button>
              <button
                onClick={() => downloadOverallExcel()}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download Excel Report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Detailed Onboarding Charges (AED)</h3>
              <div className="space-y-2">
                {[
                  { label: "Initial Application Fee", value: loggedInEmployee.visaFees?.initialApplicationFee },
                  { label: "Approval Fee", value: loggedInEmployee.visaFees?.approvalFee },
                  { label: "DIC Fee", value: loggedInEmployee.visaFees?.dicFee },
                  { label: "ILOE Fee", value: loggedInEmployee.visaFees?.iloeFee },
                  { label: "LC Fee", value: loggedInEmployee.visaFees?.lcFee },
                  { label: "Entry Permit Fee", value: loggedInEmployee.visaFees?.entryPermitFee },
                  { label: "Change Status Fee", value: loggedInEmployee.visaFees?.changeStatusFee },
                  { label: "Medical Fee", value: loggedInEmployee.visaFees?.medicalFee },
                  { label: "Insurance Fee", value: loggedInEmployee.visaFees?.insuranceFee },
                  { label: "Biometric Fee", value: loggedInEmployee.visaFees?.biometricFee },
                  { label: "Visa & EID Fee", value: loggedInEmployee.visaFees?.visaEidFee },
                  { label: `Others Fee (${loggedInEmployee.visaFees?.othersRemarks || 'Remarks'})`, value: loggedInEmployee.visaFees?.othersFee }
                ].map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                    <span className="font-medium text-slate-500">{item.label}</span>
                    <span className="font-bold text-slate-900">AED {(item.value || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between bg-indigo-50/40 rounded-3xl p-6 border border-indigo-50">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Info className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Calculated summary</span>
                </div>
                <h4 className="text-2xl font-black text-indigo-950">Total Onboarding Investment</h4>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  This card outlines the complete investment made by Pioneer Contracting LLC for visa processing, health care registration, and regulatory compliance.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-indigo-100 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Total Sum</p>
                  <p className="text-3xl font-black text-indigo-950 mt-1">
                    AED {(loggedInEmployee.visaFees?.totalFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
                <div className="bg-indigo-600 text-white rounded-full p-2">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Directory Admin Layout */}
      {!isEmployee && (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          {/* Filters & Actions */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                >
                  {listCompanies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                >
                  {listDepts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => downloadOverallPDF()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/15 transition-all cursor-pointer active:scale-95"
              >
                <FileDown className="w-4 h-4" />
                Export Overall PDF
              </button>
              <button
                onClick={() => downloadOverallExcel()}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel Sheet
              </button>
            </div>
          </div>

          {/* Table Directory View */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-4 text-center">Code</th>
                  <th className="p-4">Employee Name</th>
                  <th className="p-4">Company</th>
                  <th className="p-4 text-right">Initial App</th>
                  <th className="p-4 text-right">Approval</th>
                  <th className="p-4 text-right">DIC</th>
                  <th className="p-4 text-right">ILOE</th>
                  <th className="p-4 text-right">LC</th>
                  <th className="p-4 text-right">Entry</th>
                  <th className="p-4 text-right">Change</th>
                  <th className="p-4 text-right">Medical</th>
                  <th className="p-4 text-right">Insurance</th>
                  <th className="p-4 text-right">Biometric</th>
                  <th className="p-4 text-right">Visa & EID</th>
                  <th className="p-4 text-right">Others</th>
                  <th className="p-4 text-right font-bold text-indigo-600 bg-indigo-50/30">Total (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center p-8 text-slate-400">
                      No employees with tracked visa/onboarding fees found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => {
                    const fees = emp.visaFees || {};
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-center text-slate-400 font-mono">{emp.code}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-black">{emp.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{emp.designation || 'Staff'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500">{emp.company || 'N/A'}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.initialApplicationFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.approvalFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.dicFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.iloeFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.lcFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.entryPermitFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.changeStatusFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.medicalFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.insuranceFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.biometricFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500">AED {(fees.visaEidFee || 0).toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-500" title={fees.othersRemarks || 'No remarks'}>
                          AED {(fees.othersFee || 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-indigo-950 bg-indigo-50/10 font-black">
                          AED {(fees.totalFee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Totals Row */}
                {filteredEmployees.length > 0 && (
                  <tr className="bg-indigo-50/30 border-t border-indigo-100 text-indigo-950 font-black">
                    <td className="p-4 text-center">TOTALS</td>
                    <td className="p-4" colSpan={2}>
                      All Shown Records
                    </td>
                    <td className="p-4 text-right">AED {stats.totalInitial.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalApproval.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalDic.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalIloe.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalLc.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalEntry.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalChange.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalMedical.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalInsurance.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalBiometric.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalVisaEid.toLocaleString()}</td>
                    <td className="p-4 text-right">AED {stats.totalOthers.toLocaleString()}</td>
                    <td className="p-4 text-right text-indigo-950 font-black bg-indigo-50/60">
                      AED {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
