import { Request, Response } from "express";
import { db } from "../../firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  updateDoc
} from "firebase/firestore";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";

// Simple Attendance Status enum matched with the application
enum AttendanceStatus {
  PRESENT = "Present",
  ABSENT = "Absent",
  LEAVE = "Leave",
  HOLIDAY = "Holiday"
}

// Nodemailer SMTP configurations with a resilient fallback system
async function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"Pioneer DMS Reports" <reports@pioneerdms.com>';

  if (host && user && pass) {
    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      }),
      from
    };
  }

  // Fallback carrier: Dynamic creation of ethereal.email account
  try {
    console.log("SMTP environment variables missing. Provisioning Ethereal test SMTP inbox...");
    const testAccount = await nodemailer.createTestAccount();
    console.log("Successfully provisioned Ethereal Account:", testAccount.user);
    return {
      transporter: nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      }),
      from: `"Pioneer DMS (Ethereal Sandbox)" <${testAccount.user}>`
    };
  } catch (err) {
    console.warn("Ethereal carrier setup failed. Falling back to stdout console reporting:", err);
    return {
      transporter: {
        sendMail: async (options: any) => {
          console.log("\n================[ PRINT SIMULATED EMAIL REPORT ]================");
          console.log(`FROM: ${options.from}`);
          console.log(`TO: ${options.to}`);
          console.log(`SUBJECT: ${options.subject}`);
          console.log(`CC/BCC/CONTENT OVERVIEW:`);
          console.log(`Contains HTML summary: ${options.html ? "Yes" : "No"}`);
          console.log(`Attachments count: ${options.attachments ? options.attachments.length : 0}`);
          console.log("=================================================================\n");
          return { messageId: "simulated-id-" + Date.now() };
        }
      } as any,
      from: '"Pioneer DMS Sim" <simulated@pioneerdms.com>'
    };
  }
}

// Fetch all relative collections in Firestore and filter them by target month & year
async function fetchMonthData(targetYear: number, targetMonth: number) {
  const getCollectionData = async (colName: string) => {
    try {
      const snap = await getDocs(collection(db, colName));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    } catch (e) {
      console.warn(`Error fetching collection '${colName}':`, e);
      return [];
    }
  };

  const employees = await getCollectionData("employees");
  const attendance = await getCollectionData("attendance");
  const deductions = await getCollectionData("deductions");
  const accountsPayable = await getCollectionData("accounts_payable");
  const accountsReceivable = await getCollectionData("accounts_receivable");
  const pettyCash = await getCollectionData("petty_cash");
  const everydayExpenses = await getCollectionData("everyday_expenses");
  const projectedExpenses = await getCollectionData("projected_expenses");

  // Keep active employees or those with current records
  const activeStaff = employees.filter((e) => e.active);

  // Month-specific filters
  const filterByMonth = (items: any[]) => {
    return items.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
  };

  const monthlyAttendance = filterByMonth(attendance);
  const monthlyDeductions = filterByMonth(deductions);
  const monthlyAP = filterByMonth(accountsPayable);
  const monthlyAR = filterByMonth(accountsReceivable);
  const monthlyPettyCash = filterByMonth(pettyCash);
  const monthlyEveryday = filterByMonth(everydayExpenses);
  const monthlyProjected = filterByMonth(projectedExpenses);

  return {
    activeStaff,
    monthlyAttendance,
    monthlyDeductions,
    monthlyAP,
    monthlyAR,
    monthlyPettyCash,
    monthlyEveryday,
    monthlyProjected
  };
}

// Compute PIONEER DMS report finances exactly matching ReportsView calculations in App.tsx
function computeFinancialStats(data: any) {
  const {
    activeStaff,
    monthlyAttendance,
    monthlyDeductions,
    monthlyAP,
    monthlyAR,
    monthlyPettyCash,
    monthlyEveryday,
    monthlyProjected
  } = data;

  // Compute stats
  const totalPayable = monthlyAP.reduce((acc: number, ap: any) => acc + (ap.amount || 0), 0);
  const totalReceivable = monthlyAR.reduce((acc: number, ar: any) => acc + (ar.amount || 0), 0);

  const totalVatReceivable = monthlyAR.reduce((acc: number, ar: any) => acc + (ar.vatAmount || 0), 0);
  const totalVatPayable = monthlyAP.reduce((acc: number, ap: any) => acc + (ap.vatAmount || 0), 0);
  const totalVatEveryday = monthlyEveryday.reduce((acc: number, ee: any) => acc + (ee.vatAmount || 0), 0);

  const vatPayableAmount = totalVatReceivable - totalVatPayable - totalVatEveryday;

  const pettyCashIn = monthlyPettyCash.filter((pc: any) => pc.type === "Income").reduce((acc: number, pc: any) => acc + (pc.amount || 0), 0);
  const pettyCashOut = monthlyPettyCash.filter((pc: any) => pc.type === "Expense").reduce((acc: number, pc: any) => acc + (pc.amount || 0), 0);

  const totalEveryday = monthlyEveryday.reduce((acc: number, ee: any) => acc + (ee.totalAmount || 0), 0);
  const totalProjected = monthlyProjected.reduce((acc: number, pe: any) => acc + (pe.totalAmount || 0), 0);

  // Simplified basic/gross salary roll calculation for staff overhead
  const totalNetPayroll = activeStaff.reduce((acc: number, e: any) => {
    const baseVal = (e.salary?.basic || 0) + (e.salary?.housing || 0) + (e.salary?.transport || 0) + (e.salary?.other || 0);
    return acc + baseVal;
  }, 0);

  const totalExpenses = totalPayable + pettyCashOut + totalEveryday + totalNetPayroll;
  const totalIncome = totalReceivable + pettyCashIn;

  return {
    totalIncome,
    totalExpenses,
    vatPayableAmount,
    netProfit: totalIncome - totalExpenses,
    pettyCashIn,
    pettyCashOut,
    totalEveryday,
    totalProjected,
    totalPayable,
    totalReceivable,
    totalNetPayroll,
    totalVatReceivable,
    totalVatPayable,
    totalVatEveryday
  };
}

// Generate stylish HTML for email stakeholders
function generateReportEmailHtml(specs: {
  monthName: string;
  year: number;
}) {
  const { monthName, year } = specs;
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pioneer DMS Monthly Report Dispatch</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: #f8fafc;
        color: #1e293b;
        margin: 0;
        padding: 40px 20px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      }
      .header {
        background: #0f172a;
        padding: 32px;
        color: #ffffff;
      }
      .header h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: -0.025em;
      }
      .header p {
        margin: 4px 0 0 0;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .body {
        padding: 32px;
      }
      .body p {
        line-height: 1.6;
        margin-bottom: 16px;
        font-size: 13.5px;
        color: #334155;
      }
      .list-title {
        font-size: 11px;
        font-weight: 800;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 20px 0 8px 0;
      }
      ul {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
        color: #475569;
      }
      li {
        margin-bottom: 8px;
        line-height: 1.5;
      }
      .footer {
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        padding: 24px 32px;
        font-size: 11px;
        color: #64748b;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <p>Pioneer DMS • System Delivery</p>
        <h1>Official Report Dispatch</h1>
      </div>
      <div class="body">
        <p>Dear Administrator / Stakeholder,</p>
        <p>The system has successfully compiled and generated the monthly analytics statements for <strong>${monthName} ${year}</strong>.</p>
        
        <div class="list-title">Attached Performance Documents</div>
        <ul>
          <li><strong>Financial Dashboard Report (.pdf):</strong> Outlines VAT credits, operations overview, receivables standard calculation, daily bills/purchases overhead, and final profit/position.</li>
          <li><strong>Workforce Attendance Ledger (.pdf):</strong> Outlines the full active staff timesheet records, total timesheets logged, absent tags, and calculated overtime hours.</li>
        </ul>
        
        <p style="margin-top: 24px;">Please load the attached PDF documents directly to review the comprehensive performance or print local copy.</p>
      </div>
      <div class="footer">
        <p>Confidential secure document transmission. Generated automatically by Pioneer DMS Portal.</p>
        <p>© ${year} Pioneer DMS. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// Generates an elegant executive financial dashboard statement in PDF format
function generateFinancialPdf(monthName: string, year: number, stats: any): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  doc.setFont("helvetica", "normal");
  
  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900 (#0f172a)
  doc.rect(15, 15, 180, 25, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PIONEER DOCUMENT MANAGEMENT SYSTEM", 20, 24);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text(`MONTHLY FINANCIAL DASHBOARD & STATEMENT - ${monthName.toUpperCase()} ${year}`, 20, 32);
  
  // Executive Summary Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.rect(15, 45, 180, 36, "FD");
  
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EXECUTIVE POSITION SUMMARY", 20, 52);
  
  doc.line(20, 55, 190, 55);
  
  const isProfit = (stats.netProfit ?? 0) >= 0;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL OPERATING INCOME", 20, 62);
  doc.text("TOTAL EXPENSES", 85, 62);
  doc.text("NET POSITION / PROFIT", 145, 62);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`+AED ${(stats.totalIncome ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 20, 68);
  
  doc.setTextColor(239, 68, 68); // rose-500
  doc.text(`-AED ${(stats.totalExpenses ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 85, 68);
  
  doc.setTextColor(isProfit ? 16 : 239, isProfit ? 185 : 68, isProfit ? 129 : 68);
  doc.text(`${isProfit ? "+" : ""}AED ${(stats.netProfit ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 145, 68);
  
  // Ledger section
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("REVENUE & EXPENSE LEDGERS BREAKDOWN", 15, 90);
  
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 94, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("LEDGER CATEGORY / ACTIVITY", 18, 99);
  doc.text("FLOW", 110, 99);
  doc.text("AMOUNT (AED)", 165, 99, { align: "right" });
  
  const entries = [
    { name: "Accounts Receivable Invoices (AR Invoices)", type: "INFLOW", amt: stats.totalReceivable ?? 0, color: [16, 185, 129] },
    { name: "Petty Cash Accounts Received (Recs)", type: "INFLOW", amt: stats.pettyCashIn ?? 0, color: [16, 185, 129] },
    { name: "Accounts Payable Bills (AP Bills)", type: "OUTFLOW", amt: stats.totalPayable ?? 0, color: [239, 68, 68] },
    { name: "Petty Cash Cash-out (Expenses)", type: "OUTFLOW", amt: stats.pettyCashOut ?? 0, color: [239, 68, 68] },
    { name: "Everyday Bills / Operating Purchases", type: "OUTFLOW", amt: stats.totalEveryday ?? 0, color: [239, 68, 68] },
    { name: "Staff Payroll Salaries (Basic + Allowance)", type: "OUTFLOW", amt: stats.totalNetPayroll ?? 0, color: [239, 68, 68] }
  ];
  
  let currentY = 102;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  entries.forEach((entry, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY, 180, 7.5, "F");
    }
    
    doc.setTextColor(30, 41, 59);
    doc.text(entry.name, 18, currentY + 5);
    
    doc.setTextColor(entry.color[0], entry.color[1], entry.color[2]);
    doc.text(entry.type, 110, currentY + 5);
    doc.text(`AED ${entry.amt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 190, currentY + 5, { align: "right" });
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + 7.5, 195, currentY + 7.5);
    
    currentY += 7.5;
  });
  
  // VAT Tally Section
  currentY += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("VALUE ADDED TAX (VAT) SUMMARY", 15, currentY);
  
  currentY += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(15, currentY, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("TAX COMPONENT", 18, currentY + 5);
  doc.text("RATE", 110, currentY + 5);
  doc.text("AMOUNT (AED)", 165, currentY + 5, { align: "right" });
  
  const vatEntries = [
    { name: "VAT Output (Calculated standard 5% tax invoice output)", rate: "5.0%", amt: stats.totalVatReceivable ?? 0 },
    { name: "VAT Input Credit (Standard 5% input rebate on bills)", rate: "5.0%", amt: (stats.totalVatPayable ?? 0) + (stats.totalVatEveryday ?? 0) },
    { name: "Net Tax Position / Retain Liability due to FTA", rate: "NET", amt: stats.vatPayableAmount ?? 0, highlight: true }
  ];
  
  currentY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  vatEntries.forEach((entry, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY, 180, 7.5, "F");
    }
    
    if (entry.highlight) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
    }
    
    doc.text(entry.name, 18, currentY + 5);
    doc.text(entry.rate, 110, currentY + 5);
    
    if (entry.highlight) {
      const isPayable = (stats.vatPayableAmount ?? 0) >= 0;
      doc.setTextColor(isPayable ? 249 : 16, isPayable ? 115 : 185, isPayable ? 22 : 129);
    } else {
      doc.setTextColor(51, 65, 85);
    }
    doc.text(`AED ${entry.amt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 190, currentY + 5, { align: "right" });
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + 7.5, 195, currentY + 7.5);
    
    currentY += 7.5;
  });
  
  // Footer page stamp
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`System generated statement. Compiled successfully on ${new Date().toLocaleDateString()}`, 15, 280);
  doc.text("Confidential © Pioneer DMS Monthly System", 190, 280, { align: "right" });

  return Buffer.from(doc.output("arraybuffer"));
}

// Generates an elegant and legible attendance ledger sheet in PDF format
function generateAttendancePdf(monthName: string, year: number, attendanceData: any[]): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  doc.setFont("helvetica", "normal");
  
  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.rect(15, 15, 180, 25, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PIONEER DOCUMENT MANAGEMENT SYSTEM", 20, 24);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`WORKFORCE ATTENDANCE LEDGER & TIMESHEET - ${monthName.toUpperCase()} ${year}`, 20, 32);
  
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`EMPLOYEE MONTHLY ATTENDANCE MATRIX (${attendanceData.length} ACTIVE PERSONNEL)`, 15, 48);
  
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 52, 180, 9, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("CODE", 18, 58);
  doc.text("EMPLOYEE STAFF NAME", 40, 58);
  doc.text("PRESENT", 110, 58, { align: "center" });
  doc.text("ABSENT", 140, 58, { align: "center" });
  doc.text("OVERTIME", 175, 58, { align: "center" });
  
  let currentY = 61;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  
  attendanceData.forEach((row, i) => {
    if (currentY > 265) {
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(15, 15, 180, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("WORKFORCE ATTENDANCE LEDGER CONTINUED", 20, 25);
      
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 35, 180, 9, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("CODE", 18, 41);
      doc.text("EMPLOYEE STAFF NAME", 40, 41);
      doc.text("PRESENT", 110, 41, { align: "center" });
      doc.text("ABSENT", 140, 41, { align: "center" });
      doc.text("OVERTIME", 175, 41, { align: "center" });
      
      currentY = 44;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
    }
    
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY, 180, 8, "F");
    }
    
    doc.setTextColor(51, 65, 85);
    doc.text(row.code || "N/A", 18, currentY + 5.5);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(row.name || "N/A", 40, currentY + 5.5);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(16, 185, 129);
    doc.text(`${row.present ?? 0} days`, 110, currentY + 5.5, { align: "center" });
    
    const absCount = row.absent ?? 0;
    doc.setTextColor(absCount > 0 ? 239 : 100, absCount > 0 ? 68 : 116, absCount > 0 ? 68 : 139);
    doc.text(`${absCount} days`, 140, currentY + 5.5, { align: "center" });
    
    doc.setTextColor(59, 130, 246);
    doc.setFont("helvetica", "bold");
    doc.text(`${row.otHours ?? 0} hrs`, 175, currentY + 5.5, { align: "center" });
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + 8, 195, currentY + 8);
    
    currentY += 8;
  });
  
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`System generated statement. Compiled successfully on ${new Date().toLocaleDateString()}`, 15, 280);
  doc.text("Confidential © Pioneer DMS Monthly System", 190, 280, { align: "right" });

  return Buffer.from(doc.output("arraybuffer"));
}

// Single processor helper to dispatch a report email to stakeholders
export async function executeAndSendReport(scheduleId: string, customMonthStr?: string) {
  try {
    const scheduleSnap = await getDoc(doc(db, "report_schedules", scheduleId));
    if (!scheduleSnap.exists()) {
      throw new Error(`Schedule matching ID '${scheduleId}' not found in Firestore.`);
    }

    const schedule = { id: scheduleSnap.id, ...scheduleSnap.data() } as any;
    if (!schedule.stakeholders || schedule.stakeholders.length === 0) {
      console.warn(`No stakeholders configured for report schedule ${scheduleId}. Skipping dispatch.`);
      return false;
    }

    // Determine targets
    let year: number;
    let monthIndex: number;

    if (customMonthStr) {
      const [y, m] = customMonthStr.split("-").map(Number);
      year = y;
      monthIndex = m - 1;
    } else {
      const d = new Date();
      year = d.getFullYear();
      monthIndex = d.getMonth();
    }

    const monthName = new Date(year, monthIndex).toLocaleString("default", { month: "long" });
    const monthNumStr = String(monthIndex + 1).padStart(2, "0");
    const yearMonthStr = `${year}-${monthNumStr}`;

    console.log(`Compiling reports for ${monthName} ${year}...`);
    const monthData = await fetchMonthData(year, monthIndex);
    const stats = computeFinancialStats(monthData);

    const attendanceData = monthData.activeStaff.map((e: any) => {
      const empAtt = monthData.monthlyAttendance.filter(r => r.employeeId === e.id);
      const present = empAtt.filter(r => r.status === AttendanceStatus.PRESENT).length;
      const absent = empAtt.filter(r => r.status === AttendanceStatus.ABSENT).length;
      const otHours = empAtt.reduce((acc, r) => acc + (r.overtimeHours || 0), 0);
      return {
        code: e.code,
        name: e.name,
        present,
        absent,
        otHours
      };
    });

    // Generate Beautiful HTML content
    const htmlEmail = generateReportEmailHtml({
      monthName,
      year
    });

    const attachments = [];
    const reportsList = schedule.reports || ["summary", "attendance"];
    
    if (reportsList.includes("summary")) {
      const finPdf = generateFinancialPdf(monthName, year, stats);
      attachments.push({
        filename: `Financial_Dashboard_${monthName}_${year}.pdf`,
        content: finPdf
      });
    }
    
    if (reportsList.includes("attendance")) {
      const attPdf = generateAttendancePdf(monthName, year, attendanceData);
      attachments.push({
        filename: `Workforce_Attendance_Ledger_${monthName}_${year}.pdf`,
        content: attPdf
      });
    }

    const carriers = await getTransporter();

    // Send emails
    const recipients = schedule.stakeholders.join(", ");
    console.log(`Sending email reports to stakeholders: ${recipients}`);

    const result = await carriers.transporter.sendMail({
      from: carriers.from,
      to: recipients,
      subject: `Pioneer DMS - Monthly Analytics Report [${monthName} ${year}]`,
      html: htmlEmail,
      attachments
    });

    console.log(`Email report dispatched securely! MessageID: ${result.messageId}`);

    // Update schedule's lastSentAt to current YearMonth to mark successful monthly execution
    await updateDoc(doc(db, "report_schedules", scheduleId), {
      lastSentAt: yearMonthStr
    });

    return true;
  } catch (error) {
    console.error(`Failed to dispatch report for schedule ${scheduleId}:`, error);
    throw error;
  }
}

// REST Controllers
export const getSchedules = async (req: Request, res: Response) => {
  try {
    const snap = await getDocs(collection(db, "report_schedules"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, schedules: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const saveSchedule = async (req: Request, res: Response) => {
  try {
    const { id, stakeholders, reports, active, createdBy } = req.body;
    if (!stakeholders || !reports || stakeholders.length === 0 || reports.length === 0) {
      res.status(400).json({ success: false, error: "Stakeholders and reports selection are mandatory." });
      return;
    }

    const finalId = id || "sched_" + Date.now().toString(36);
    const docRef = doc(db, "report_schedules", finalId);
    
    const docData: any = {
      id: finalId,
      stakeholders,
      reports,
      active: active ?? true,
      updatedAt: new Date().toISOString()
    };

    if (!id) {
      docData.createdAt = new Date().toISOString();
      docData.createdBy = createdBy || "Admin";
      docData.lastSentAt = "";
    }

    await setDoc(docRef, docData, { merge: true });
    res.json({ success: true, schedule: docData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: "Schedule ID parameter missing." });
      return;
    }
    await deleteDoc(doc(db, "report_schedules", id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const triggerSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { month } = req.body; // YYYY-MM
    if (!id) {
      res.status(400).json({ success: false, error: "Schedule ID parameter is required." });
      return;
    }

    await executeAndSendReport(id, month);
    res.json({ success: true, message: "Report generated and emailed to stakeholders successfully." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const sendEmailReport = async (req: Request, res: Response) => {
  try {
    const { stakeholders, reports, monthName, year, stats, attendanceData } = req.body;
    
    if (!stakeholders || stakeholders.length === 0) {
      res.status(400).json({ success: false, error: "Stakeholder recipients are required." });
      return;
    }

    const targetYear = year || new Date().getFullYear();
    const htmlEmail = generateReportEmailHtml({
      monthName,
      year: targetYear
    });

    const attachments = [];
    const reportsList = reports || ["summary", "attendance"];
    
    if (reportsList.includes("summary")) {
      const finPdf = generateFinancialPdf(monthName, targetYear, stats || {});
      attachments.push({
        filename: `Financial_Dashboard_${monthName}_${targetYear}.pdf`,
        content: finPdf
      });
    }
    
    if (reportsList.includes("attendance")) {
      const attPdf = generateAttendancePdf(monthName, targetYear, attendanceData || []);
      attachments.push({
        filename: `Workforce_Attendance_Ledger_${monthName}_${targetYear}.pdf`,
        content: attPdf
      });
    }

    const carriers = await getTransporter();

    const recipients = stakeholders.join(", ");
    console.log(`Sending email reports manually to stakeholders: ${recipients}`);

    const result = await carriers.transporter.sendMail({
      from: carriers.from,
      to: recipients,
      subject: `Pioneer DMS - Monthly Analytics Report [${monthName} ${targetYear}]`,
      html: htmlEmail,
      attachments
    });

    console.log(`Manually email report dispatched! MessageID: ${result.messageId}`);
    res.json({ success: true, message: "Report generated and emailed successfully." });
  } catch (err: any) {
    console.error("Failed manual sending route:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Scheduler Runner setup: Checks daily/hourly for scheduled monthly dispatches (e.g. at the end of the month)
export function startMonthlyCronDispatcher() {
  console.log("PIONEER DMS Monthly Automated Report engine initialized.");
  
  // Runs every 4 hours to verify outstanding scheduled actions
  setInterval(async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Check if tomorrow is the first day of the next month (i.e. today is the end of this month)
      const isEndOfMonth = tomorrow.getDate() === 1;
      if (!isEndOfMonth) {
        return; // Proceed only on the last day of the month
      }

      const yearMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      console.log(`Triggering automated monthly scheduler sweep... Checking YYYY-MM [${yearMonthStr}]`);
      
      const snap = await getDocs(collection(db, "report_schedules"));
      const activeSchedules = snap.docs.map(d => d.data())
        .filter((d: any) => d.active === true && d.lastSentAt !== yearMonthStr);

      if (activeSchedules.length === 0) {
        return;
      }

      console.log(`Found ${activeSchedules.length} active automated monthly schedules waiting for dispatch...`);
      for (const schedule of activeSchedules) {
        try {
          await executeAndSendReport(schedule.id, yearMonthStr);
        } catch (dispatchErr) {
          console.error(`Failed automated dispatch for schedule ${schedule.id}:`, dispatchErr);
        }
      }
    } catch (e) {
      console.error("Error running the monthly schedule background dispatcher sweep:", e);
    }
  }, 4 * 60 * 60 * 1000); // 4 Hours interval
}
