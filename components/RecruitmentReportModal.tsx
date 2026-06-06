import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Printer, Download, Users, FileText, CheckCircle, XCircle, 
  ChevronRight, Calendar, TrendingUp, HelpCircle, FileCheck, Award
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { JobApplicant, JobOffer } from '../types';
import { applyPioneerLetterheadDoc } from '../utils';

interface RecruitmentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicants: JobApplicant[];
  offers: JobOffer[];
}

export const RecruitmentReportModal: React.FC<RecruitmentReportModalProps> = ({
  isOpen,
  onClose,
  applicants = [],
  offers = []
}) => {
  // 1. Calculate General Stat Groups
  const totalApplied = applicants.length;
  
  const activeApplied = useMemo(() => 
    applicants.filter(a => a.status === 'Applied').length
  , [applicants]);

  const interviewing = useMemo(() => 
    applicants.filter(a => a.status === 'Interview Scheduled' || a.status === 'Interview Conducted').length
  , [applicants]);

  const totalOffered = useMemo(() => {
    const fromOffers = offers.filter(o => o.status === 'Offered').length;
    const fromApplicants = applicants.filter(a => a.status === 'Offered').length;
    return fromOffers + fromApplicants;
  }, [applicants, offers]);

  const totalHired = useMemo(() => {
    // Unique count of hires from either accepted offers or candidate hire flags
    const acceptedOfferNames = new Set(offers.filter(o => o.status === 'Accepted').map(o => o.employeeName.trim().toLowerCase()));
    
    let dbCount = 0;
    // Check applicants
    applicants.forEach(a => {
      if (a.status === 'Hired' && !acceptedOfferNames.has(a.name.trim().toLowerCase())) {
        dbCount++;
      }
    });

    return offers.filter(o => o.status === 'Accepted').length + dbCount;
  }, [applicants, offers]);

  const totalDeclined = useMemo(() => {
    const declinedOffers = offers.filter(o => o.status === 'Declined').length;
    const rejectedApplicants = applicants.filter(a => a.status === 'Rejected').length;
    return declinedOffers + rejectedApplicants;
  }, [applicants, offers]);

  // 2. Compute Position Designation Breakdown
  const designationBreakdown = useMemo(() => {
    const designations = Array.from(new Set([
      ...applicants.map(a => a.position),
      ...offers.map(o => o.position)
    ].filter(Boolean))).sort();

    return designations.map(pos => {
      // Applied in this designation
      const posApplied = applicants.filter(a => a.position === pos).length;
      
      // Interviewing in this designation
      const posInterviewing = applicants.filter(a => a.position === pos && (a.status === 'Interview Scheduled' || a.status === 'Interview Conducted')).length;
      
      // Offered index
      const posOfferedOffers = offers.filter(o => o.position === pos && o.status === 'Offered').length;
      const posOfferedApplicants = applicants.filter(a => a.position === pos && a.status === 'Offered').length;
      const posOffered = posOfferedOffers + posOfferedApplicants;
      
      // Hired in this designation
      const posHiredOffers = offers.filter(o => o.position === pos && o.status === 'Accepted').length;
      const posHiredCandidates = applicants.filter(a => a.position === pos && a.status === 'Hired').length;
      // Subtract possible double-count
      const posHired = Math.max(posHiredOffers, posHiredCandidates);

      // Declined/Rejected
      const posDeclined = offers.filter(o => o.position === pos && o.status === 'Declined').length +
                           applicants.filter(a => a.position === pos && a.status === 'Rejected').length;

      const successRate = posApplied > 0 ? Math.round((posHired / posApplied) * 100) : 0;

      return {
        designation: pos,
        applied: posApplied,
        interviewing: posInterviewing,
        offered: posOffered,
        hired: posHired,
        declined: posDeclined,
        successRate
      };
    });
  }, [applicants, offers]);

  // 3. Print Report Trigger
  const handlePrint = () => {
    window.print();
  };

  // 4. Download PDF using jsPDF
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const stamp = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString();

      // Title & Header section
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("PIONEER DOCUMENT MANAGEMENT SYSTEM", 20, 45);
      
      doc.setFontSize(11);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("OFFICIAL RECRUITMENT LIFE-CYCLE SUMMARY REPORT", 20, 52);
      doc.text(`Generated on: ${stamp}`, 20, 58);

      // Horizontal line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 62, 190, 62);

      // Core Summary Metrics Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("1. OVERALL RECRUITMENT STATUS METRICS", 20, 72);

      // Core Summary table/boxes
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(20, 77, 170, 32, 'F');
      doc.rect(20, 77, 170, 32, 'D');

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("TOTAL APPLICANTS:", 25, 87);
      doc.text("CURRENT INTERVIEWING:", 25, 99);

      doc.text("TOTAL OFFERS ISSUED:", 105, 87);
      doc.text("SUCCESSFULLY HIRED:", 105, 99);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalApplied} Candidates`, 68, 87);
      doc.text(`${interviewing} Candidates`, 72, 99);
      doc.text(`${totalOffered} Pending Offers`, 150, 87);
      doc.text(`${totalHired} Employees`, 150, 99);

      // Designation Table Header
      doc.text("2. DESIGNATION LEVEL STAGE BREAKDOWN", 20, 122);

      // Draw table header
      let startY = 129;
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(20, startY, 170, 8, 'F');
      
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("DESIGNATION", 23, startY + 5.5);
      doc.text("APPLIED", 75, startY + 5.5);
      doc.text("INTERVIEWS", 98, startY + 5.5);
      doc.text("OFFERED", 123, startY + 5.5);
      doc.text("HIRED", 145, startY + 5.5);
      doc.text("DECLINED", 165, startY + 5.5);

      let currentY = startY + 8;
      
      // Draw rows
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      
      designationBreakdown.forEach((row, idx) => {
        // Prevent overflow
        if (currentY > 240) {
          applyPioneerLetterheadDoc(doc, 1);
          doc.addPage();
          currentY = 45;
          // Re-draw header
          doc.setFillColor(30, 41, 59);
          doc.rect(20, currentY, 170, 8, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text("DESIGNATION", 23, currentY + 5.5);
          doc.text("APPLIED", 75, currentY + 5.5);
          doc.text("INTERVIEWS", 98, currentY + 5.5);
          doc.text("OFFERED", 123, currentY + 5.5);
          doc.text("HIRED", 145, currentY + 5.5);
          doc.text("DECLINED", 165, currentY + 5.5);
          currentY += 8;
        }

        // Row background alternating
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(20, currentY, 170, 7, 'F');
        }

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);

        // Designation Text clipping
        const label = row.designation.length > 28 ? row.designation.substring(0, 26) + ".." : row.designation;
        doc.text(label, 23, currentY + 4.8);
        
        doc.text(row.applied.toString(), 78, currentY + 4.8);
        doc.text(row.interviewing.toString(), 103, currentY + 4.8);
        doc.text(row.offered.toString(), 126, currentY + 4.8);
        
        // Highlight Hires
        if (row.hired > 0) {
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(16, 185, 129); // emerald-500
        }
        doc.text(row.hired.toString(), 148, currentY + 4.8);

        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(row.declined.toString(), 168, currentY + 4.8);

        // draw border bottom line
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(20, currentY + 7, 190, currentY + 7);

        currentY += 7;
      });

      // Signature / Approvals space
      if (currentY > 210) {
        applyPioneerLetterheadDoc(doc, 1);
        doc.addPage();
        currentY = 45;
      }

      currentY += 15;
      doc.setDrawColor(226, 232, 240);
      doc.line(20, currentY, 190, currentY);

      currentY += 8;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("RECRUITMENT PIPELINE AUDIT COMPLIANCE & AUTHORISATION", 20, currentY);
      
      currentY += 4;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(115, 115, 115);
      doc.text("The metrics recorded above are live and consistent with Dubai Department of Economic Development & UAE Ministry directives.", 20, currentY);

      currentY += 18;
      doc.setDrawColor(148, 163, 184);
      doc.line(25, currentY, 80, currentY);
      doc.line(115, currentY, 175, currentY);

      currentY += 4;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Prepared By (HR Coordinator)", 27, currentY);
      doc.text("Approved By (Managing Director)", 117, currentY);

      // Apply Pioneer letterhead and dynamic footer stamps (UAE Licensing compatibility)
      applyPioneerLetterheadDoc(doc, 1);

      doc.save(`Recruitment_Workforce_Status_Report.pdf`);
    } catch (err) {
      console.error("Failed to download Recruitment PDF:", err);
      alert("Error building recruitment PDF report: " + err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* 
        This modal is excluded in standard app prints using Tailwind's `no-print` utility,
        and its printing block `.print-report-container` displays exclusively when print query triggers.
      */}
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-0 md:p-6 no-print">
        
        {/* Dynamic @media print overrides */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
              font-family: 'Helvetica', sans-serif !important;
            }
            .no-print {
              display: none !important;
            }
            .print-only-layout {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              background: white !important;
              padding: 1.5cm !important;
            }
          }
        `}} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white text-slate-800 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          id="recruitment-report-core"
        >
          {/* A. Modal Header */}
          <div className="flex justify-between items-center bg-slate-900 text-white px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-500 rounded-xl text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                  Recruitment Life-Cycle Audit Desk
                  <span className="bg-brand-500/20 text-brand-300 text-[9px] px-2 py-0.5 rounded-full font-black">Audit Desk</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Filter, view, save offline or print professional UAE compliance hiring reports.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Print Report"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Desk</span>
              </button>
              <button 
                type="button"
                onClick={handleDownloadPDF}
                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* B. Modal Body Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-7 custom-scrollbar bg-slate-50/50">
            
            {/* 1. Header Stamp Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200/60">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="font-black text-sm text-white bg-slate-900 px-2 py-1 rounded">P</div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm tracking-wide">PIONEER GENERAL CONTRACTING LLC</h4>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Dubai Licensing Branch & Audits Office</p>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right text-[10px] text-slate-500 font-semibold space-y-0.5">
                <p>Doc Ref: <span className="font-bold text-slate-900">RC-LIFECYCL-{new Date().getFullYear()}</span></p>
                <p>Status Date: <span className="font-bold text-slate-900">{new Date().toLocaleDateString('en-GB')}</span></p>
                <p className="text-[9px] text-slate-400">Total Database Records: {applicants.length + offers.length} Entries</p>
              </div>
            </div>

            {/* 2. Interactive Bento Grid Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              
              {/* Box 1: Applied */}
              <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm text-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">1. Applied Pool</span>
                  <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-3.5 h-3.5" /></span>
                </div>
                <div className="text-xl font-black text-slate-900">{totalApplied}</div>
                <div className="text-[9px] text-slate-400 mt-1 font-bold">{activeApplied} Initial / {interviewing} Scheduled</div>
              </div>

              {/* Box 2: Interviewing */}
              <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">2. Interviewing</span>
                  <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Calendar className="w-3.5 h-3.5" /></span>
                </div>
                <div className="text-xl font-black text-slate-900">{interviewing}</div>
                <div className="text-[9px] text-amber-600 mt-1 font-black flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> Active Pipeline
                </div>
              </div>

              {/* Box 3: Offered */}
              <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">3. Pending Offers</span>
                  <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><FileText className="w-3.5 h-3.5" /></span>
                </div>
                <div className="text-xl font-black text-slate-900">{totalOffered}</div>
                <div className="text-[9px] text-slate-400 mt-1 font-bold">Unsigned Offers Sent</div>
              </div>

              {/* Box 4: Hired / Signed */}
              <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm ring-2 ring-emerald-500/20 border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block font-bold">4. Hired Workers</span>
                  <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle className="w-3.5 h-3.5" /></span>
                </div>
                <div className="text-xl font-black text-slate-900">{totalHired}</div>
                <div className="text-[9px] text-emerald-600 mt-1 font-black">Hired / Contracts Signed</div>
              </div>

              {/* Box 5: Declined / Rejected */}
              <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">5. Declined/NOGO</span>
                  <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><XCircle className="w-3.5 h-3.5" /></span>
                </div>
                <div className="text-xl font-black text-slate-900">{totalDeclined}</div>
                <div className="text-[9px] text-rose-500 mt-1 font-bold">Rejected or Withdrawn</div>
              </div>

            </div>

            {/* 3. Detailed Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase tracking-wider">Workforce Position Breakdown Ledger (جدول تفصيل المهن)</h4>
                <div className="text-[9px] text-slate-400 font-bold">Comprehensive Designation Count</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-55 bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="px-4 py-3 text-[10px] uppercase font-black">Position Designation</th>
                      <th className="px-3 py-3 text-[10px] uppercase font-black text-center">Applied Pool</th>
                      <th className="px-3 py-3 text-[10px] uppercase font-black text-center">Interviewing</th>
                      <th className="px-3 py-3 text-[10px] uppercase font-black text-center">Offered (Pending)</th>
                      <th className="px-3 py-3 text-[10px] uppercase font-black text-center text-emerald-700">Hired / Signed</th>
                      <th className="px-3 py-3 text-[10px] uppercase font-black text-center">Declined/Rejected</th>
                      <th className="px-4 py-3 text-[10px] uppercase font-black text-right">Success Rate %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {designationBreakdown.map((row) => (
                      <tr key={row.designation} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-900 font-bold uppercase text-[11px] whitespace-nowrap">
                          {row.designation}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-700">{row.applied}</td>
                        <td className="px-3 py-3 text-center text-amber-600 font-semibold">{row.interviewing}</td>
                        <td className="px-3 py-3 text-center text-purple-600">{row.offered}</td>
                        <td className="px-3 py-3 text-center text-emerald-600 font-black">
                          {row.hired > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                              {row.hired} Hired
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-400">{row.declined}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.successRate >= 50 ? 'bg-emerald-50 text-emerald-700' :
                            row.successRate > 0 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-350'
                          }`}>
                            {row.successRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Internal Auditing Signature block (Print-friendly representation) */}
            <div className="border border-slate-200 rounded-2xl bg-slate-50 p-5 space-y-6">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-600" />
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Professional Auditing Sign-Off Matrix</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audited By HR Team</p>
                  <div className="h-10 border-b border-dashed border-slate-300 w-full" />
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Coordinator Sign & Date</p>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approved By Managing Director</p>
                  <div className="h-10 border-b border-dashed border-slate-300 w-full" />
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Director Sign & Stamp</p>
                </div>
              </div>
            </div>

          </div>

          {/* C. Model Footer Actions */}
          <div className="bg-slate-900 text-white px-6 py-4.5 border-t border-slate-800 flex justify-between items-center">
            <div className="text-[10px] text-slate-400 font-medium">
              Licence Stamp: Dubai License No. 708304
            </div>
            <button
              onClick={onClose}
              type="button"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Close Print Deck
            </button>
          </div>

        </motion.div>
      </div>

      {/* D. SEPARATE PRINT ONLY LAYOUT (Fills complete printable pages cleanly) */}
      <div className="hidden print-only-layout bg-white text-black p-8 font-sans space-y-8 absolute top-0 left-0 w-full h-auto">
        {/* Print Brand Stamp */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="font-extrabold text-xl tracking-tight uppercase text-black">PIONEER GENERAL CONTRACTING LLC</h1>
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">UAE Recruitment Lifecycle Status Audit Report</p>
            <p className="text-[10px] text-slate-400">Ref: RC-LIFECYCL-{new Date().getFullYear()} | Printed on: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString()}</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[11px] font-bold border-2 border-slate-900 px-3 py-1 bg-slate-100 uppercase">WORKFORCE LEDGER</span>
            <span className="text-[9px] font-medium text-slate-500 mt-1">DUBAI JURISDICTION, UNITED ARAB EMIRATES</span>
          </div>
        </div>

        {/* Print Summary Metrics Row */}
        <div>
          <h3 className="font-extrabold text-sm uppercase text-slate-800 tracking-wider mb-2">1. OVERALL CORNERSTONE FIGURES</h3>
          <table className="w-full text-left border border-slate-400 border-collapse text-xs">
            <thead>
              <tr className="bg-slate-200">
                <th className="p-3 border border-slate-400 font-black">Applied Pool Target</th>
                <th className="p-3 border border-slate-400 font-black">Interviews Scheduled</th>
                <th className="p-3 border border-slate-400 font-black">Pending Offers</th>
                <th className="p-3 border border-slate-400 font-black">Hired / Signed Workers</th>
                <th className="p-3 border border-slate-400 font-black">Declined/NOGO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border border-slate-400 font-bold text-sm text-center">{totalApplied}</td>
                <td className="p-3 border border-slate-400 font-bold text-sm text-center">{interviewing}</td>
                <td className="p-3 border border-slate-400 font-bold text-sm text-center">{totalOffered}</td>
                <td className="p-3 border border-slate-400 font-black text-sm text-center text-emerald-600">{totalHired}</td>
                <td className="p-3 border border-slate-400 font-bold text-sm text-center">{totalDeclined}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Print Designation breakdown */}
        <div className="space-y-2">
          <h3 className="font-extrabold text-sm uppercase text-slate-800 tracking-wider">2. DESIGNATION STAGE BREAKDOWN</h3>
          <table className="w-full text-left border border-slate-400 border-collapse text-xs">
            <thead>
              <tr className="bg-slate-300 font-bold text-[10px] text-slate-900 uppercase">
                <th className="p-2 border border-slate-400">Designation</th>
                <th className="p-2 border border-slate-400 text-center">Applied Pool</th>
                <th className="p-2 border border-slate-400 text-center">Interviewing</th>
                <th className="p-2 border border-slate-400 text-center">Offered</th>
                <th className="p-2 border border-slate-400 text-center">Hired & Signed</th>
                <th className="p-2 border border-slate-400 text-center">Declined/Rejected</th>
                <th className="p-2 border border-slate-400 text-right">Success Rate %</th>
              </tr>
            </thead>
            <tbody>
              {designationBreakdown.map((row) => (
                <tr key={row.designation}>
                  <td className="p-2 border border-slate-400 font-bold uppercase">{row.designation}</td>
                  <td className="p-2 border border-slate-400 text-center">{row.applied}</td>
                  <td className="p-2 border border-slate-400 text-center">{row.interviewing}</td>
                  <td className="p-2 border border-slate-400 text-center">{row.offered}</td>
                  <td className="p-2 border border-slate-400 text-center font-bold">{row.hired}</td>
                  <td className="p-2 border border-slate-400 text-center text-slate-500">{row.declined}</td>
                  <td className="p-2 border border-slate-400 text-right font-bold">{row.successRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Print Sign off */}
        <div className="pt-20">
          <div className="grid grid-cols-2 gap-20">
            <div className="text-center space-y-12">
              <span className="text-[10px] font-black uppercase text-slate-500 block">HR Coordinator Submission</span>
              <div className="border-b border-dashed border-slate-400 w-full h-1" />
              <p className="text-[9px] font-bold">Authorized Coordinator / Date</p>
            </div>
            <div className="text-center space-y-12">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Managing Director Ratification</span>
              <div className="border-b border-dashed border-slate-400 w-full h-1" />
              <p className="text-[9px] font-bold">Company Seal & Authorized Stamp</p>
            </div>
          </div>
        </div>

      </div>
    </AnimatePresence>
  );
};
