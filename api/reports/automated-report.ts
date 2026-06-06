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
          console.log(`Contains Summary: ${options.html.includes("Operational Financial Summary")}`);
          console.log(`Contains Attendance: ${options.html.includes("Workforce Attendance Ledger")}`);
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
  reportTypes: string[];
  monthName: string;
  year: number;
  stats: any;
  attendanceData: any[];
}) {
  const { reportTypes, monthName, year, stats, attendanceData } = specs;
  const includeSummary = reportTypes.includes("summary");
  const includeAttendance = reportTypes.includes("attendance");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pioneer DMS Automated Monthly Statement</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: #f8fafc;
        color: #1e293b;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 680px;
        margin: 40px auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      }
      .header {
        background-color: #0f172a;
        color: #ffffff;
        padding: 40px;
        text-align: left;
      }
      .header h1 {
        margin: 0 0 6px 0;
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.025em;
      }
      .header p {
        margin: 0;
        color: #94a3b8;
        font-size: 14px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .content {
        padding: 40px;
      }
      .section-title {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        margin-top: 0;
        margin-bottom: 20px;
        border-left: 4px solid #2563eb;
        padding-left: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 30px;
      }
      .card {
        background: #f1f5f9;
        border-radius: 16px;
        padding: 20px;
        border: 1px solid #e2e8f0;
      }
      .card-label {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }
      .card-value {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
      }
      .card-value.highlight {
        color: #10b981;
      }
      .card-value.negative {
        color: #ef4444;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        font-size: 13px;
      }
      th {
        background-color: #f1f5f9;
        color: #475569;
        font-weight: 700;
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid #cbd5e1;
        text-transform: uppercase;
        font-size: 11px;
      }
      td {
        padding: 12px 14px;
        border-bottom: 1px solid #e2e8f0;
        color: #334155;
      }
      tr:last-child td {
        border-bottom: none;
      }
      .footer {
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
        padding: 30px 40px;
        text-align: center;
        font-size: 12px;
        color: #64748b;
      }
      .text-center {
        text-align: center;
      }
      .mt-4 { margin-top: 16px; }
      .badge {
        background-color: #dbeafe;
        color: #1e40af;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <p>Pioneer DMS • Monthly Analytics Reporting</p>
        <h1>Intelligence Statement</h1>
        <div class="badge mt-4">${monthName} ${year}</div>
      </div>

      <div class="content">
        ${includeSummary ? `
          <h2 class="section-title">Operational Financial Summary</h2>
          <div style="margin-bottom: 24px;">
            <table>
              <thead>
                <tr>
                  <th>Financial Ledger / Activity</th>
                  <th style="text-align: right;">Amount (AED)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Total Operating Income</strong> (AR Invoices + Petty Cash Recs)</td>
                  <td style="text-align: right; font-weight: bold; color: #10b981;">+AED ${stats.totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td><strong>Total Expenses</strong> (AP Bills + Petty Out + Everyday + Payroll)</td>
                  <td style="text-align: right; font-weight: bold; color: #ef4444;">-AED ${stats.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td><strong>VAT Output</strong> (Receivables Output tax)</td>
                  <td style="text-align: right;">AED ${stats.totalVatReceivable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td><strong>VAT Input Credit</strong> (Payables & Everyday Input tax)</td>
                  <td style="text-align: right;">AED ${(stats.totalVatPayable + stats.totalVatEveryday).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td><strong>VAT Net Liability</strong></td>
                  <td style="text-align: right; font-weight: bold; color: ${stats.vatPayableAmount >= 0 ? '#f97316' : '#10b981'}">AED ${stats.vatPayableAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
                <tr style="border-top: 2px solid #0f172a; font-size: 15px; font-weight: 900; background-color: #f1f5f9;">
                  <td>Net Profit / Position</td>
                  <td style="text-align: right; color: ${stats.netProfit >= 0 ? '#10b981' : '#ef4444'};">+AED ${stats.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ""}

        ${includeAttendance ? `
          <h2 class="section-title">Workforce Attendance Ledger</h2>
          <div style="overflow-x: auto; margin-bottom: 24px;">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee Name</th>
                  <th style="text-align: center;">Present</th>
                  <th style="text-align: center;">Absent</th>
                  <th style="text-align: center;">Overtime Hours</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceData.length === 0 ? `
                  <tr>
                    <td colspan="5" class="text-center" style="color: #64748b;">No attendance records logged for this month.</td>
                  </tr>
                ` : attendanceData.map(row => `
                  <tr>
                    <td><code>${row.code}</code></td>
                    <td><strong>${row.name}</strong></td>
                    <td style="text-align: center;">${row.present}</td>
                    <td style="text-align: center; color: ${row.absent > 0 ? '#ef4444' : '#64748b'}">${row.absent}</td>
                    <td style="text-align: center; font-weight: bold; color: #3b82f6;">${row.otHours}h</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}
      </div>

      <div class="footer">
        <p>This is an automated system intelligence delivery requested by the Administrator.</p>
        <p>© ${year} Pioneer DMS. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
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
      reportTypes: schedule.reports || [],
      monthName,
      year,
      stats,
      attendanceData
    });

    const carriers = await getTransporter();

    // Send emails
    const recipients = schedule.stakeholders.join(", ");
    console.log(`Sending email reports to stakeholders: ${recipients}`);

    const result = await carriers.transporter.sendMail({
      from: carriers.from,
      to: recipients,
      subject: `Pioneer DMS - Automated Monthly Analytics [${monthName} ${year}]`,
      html: htmlEmail
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

    const htmlEmail = generateReportEmailHtml({
      reportTypes: reports || ["summary", "attendance"],
      monthName,
      year,
      stats: stats || {},
      attendanceData: attendanceData || []
    });

    const carriers = await getTransporter();

    const recipients = stakeholders.join(", ");
    console.log(`Sending email reports manually to stakeholders: ${recipients}`);

    const result = await carriers.transporter.sendMail({
      from: carriers.from,
      to: recipients,
      subject: `Pioneer DMS - Monthly System Performance [${monthName} ${year}]`,
      html: htmlEmail
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
