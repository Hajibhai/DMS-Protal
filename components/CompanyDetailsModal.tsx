import React, { useState, useMemo } from 'react';
import { Company, AccountsReceivable, AccountsPayable, Voucher, EverydayExpense, CampExpense, PettyCash } from '../types';
import { 
    X, 
    Building2, 
    Download, 
    Mail, 
    Phone, 
    MapPin, 
    Hash, 
    Copy, 
    Check, 
    Key, 
    FileText, 
    TrendingUp, 
    TrendingDown, 
    DollarSign,
    FileSpreadsheet,
    FileMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface CompanyDetailsModalProps {
    company: Company;
    onClose: () => void;
    accountsReceivable: AccountsReceivable[];
    accountsPayable: AccountsPayable[];
    vouchers: Voucher[];
    everydayExpenses?: EverydayExpense[];
    camps?: CampExpense[];
    pettyCash?: PettyCash[];
}

export const CompanyDetailsModal = ({ 
    company, 
    onClose, 
    accountsReceivable = [], 
    accountsPayable = [], 
    vouchers = [],
    everydayExpenses = [],
    camps = [],
    pettyCash = []
}: CompanyDetailsModalProps) => {
    
    const [activeTab, setActiveTab] = useState<'profile' | 'financials'>('profile');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const handleCopy = (value: string, field: string) => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // --- FINANCIAL CALCULATIONS ---
    const financialStats = useMemo(() => {
        // Accounts Receivable (Income)
        const matchedAR = accountsReceivable.filter(ar => 
            ar.companyId === company.id || 
            (ar.companyName && ar.companyName.trim().toLowerCase() === company.name.trim().toLowerCase())
        );
        const arIncome = matchedAR.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0);
        const arTaxable = matchedAR.reduce((sum, item) => sum + (item.amount || 0), 0);
        const arVat = matchedAR.reduce((sum, item) => sum + (item.vatAmount || 0), 0);

        // Receipt Vouchers (Income)
        const matchedReceiptVouchers = vouchers.filter(v => 
            v.voucherType === 'receipt' && 
            (v.companyId === company.id || 
             (v.payeeOrReceiver && v.payeeOrReceiver.trim().toLowerCase() === company.name.trim().toLowerCase()))
        );
        const voucherIncome = matchedReceiptVouchers.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0);

        // Accounts Payable (Expenses)
        const matchedAP = accountsPayable.filter(ap => 
            ap.companyId === company.id
        );
        const apExpense = matchedAP.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0);
        const apTaxable = matchedAP.reduce((sum, item) => sum + (item.amount || 0), 0);
        const apVat = matchedAP.reduce((sum, item) => sum + (item.vatAmount || 0), 0);

        // Payment Vouchers (Expenses)
        const matchedPaymentVouchers = vouchers.filter(v => 
            v.voucherType === 'payment' && 
            (v.companyId === company.id || 
             (v.payeeOrReceiver && v.payeeOrReceiver.trim().toLowerCase() === company.name.trim().toLowerCase()))
        );
        const voucherExpense = matchedPaymentVouchers.reduce((sum, item) => sum + (item.totalAmount || item.amount || 0), 0);

        // Everyday Expenses (Expenses)
        const matchedEveryday = (everydayExpenses || []).filter((ee: any) => {
            const hasCompany = ee.companyId || ee.companyName;
            if (hasCompany) {
                return ee.companyId === company.id || 
                       (ee.companyName && ee.companyName.trim().toLowerCase() === company.name.trim().toLowerCase());
            }
            const isHeadOffice = company.code === 'HEAD OFFICE' || company.name.toLowerCase().includes('pioneer');
            return isHeadOffice;
        });
        const everydayExpense = matchedEveryday.reduce((sum, item) => sum + (Number(item.totalAmount) || Number(item.billAmount) || 0), 0);

        // Camp Accommodation (Expenses)
        const matchedCamps = (camps || []).filter((camp: any) => {
            const hasCompany = camp.companyId || camp.companyName;
            if (hasCompany) {
                return camp.companyId === company.id || 
                       (camp.companyName && camp.companyName.trim().toLowerCase() === company.name.trim().toLowerCase());
            }
            const isHeadOffice = company.code === 'HEAD OFFICE' || company.name.toLowerCase().includes('pioneer');
            return isHeadOffice;
        });
        const campExpense = matchedCamps.reduce((sum, item) => sum + (Number(item.rent) || 0) + (Number(item.depositAmount) || 0), 0);

        // Petty Cash (Income / Expenses)
        const matchedPettyCash = (pettyCash || []).filter((pc: any) => {
            const hasCompany = pc.companyId || pc.companyName;
            if (hasCompany) {
                return pc.companyId === company.id || 
                       (pc.companyName && pc.companyName.trim().toLowerCase() === company.name.trim().toLowerCase());
            }
            const isHeadOffice = company.code === 'HEAD OFFICE' || company.name.toLowerCase().includes('pioneer');
            return isHeadOffice;
        });
        const pcIncome = matchedPettyCash.filter(item => item.type === 'Income').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const pcExpense = matchedPettyCash.filter(item => item.type === 'Expense').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        // Total Income: Accounts Receivable + Receipt Vouchers + Petty Cash Advances
        const totalIncome = arIncome + voucherIncome + pcIncome;
        
        // Total Expense: Accounts Payable + Payment Vouchers + Everyday Expenses + Camp Accommodation + Petty Cash Spent
        const totalExpense = apExpense + voucherExpense + everydayExpense + campExpense + pcExpense;
        
        const netProfitLoss = totalIncome - totalExpense;

        return {
            arIncome,
            arTaxable,
            arVat,
            voucherIncome,
            apExpense,
            apTaxable,
            apVat,
            voucherExpense,
            everydayExpense,
            campExpense,
            pcIncome,
            pcExpense,
            totalIncome,
            totalExpense,
            netProfitLoss,
            matchedAR,
            matchedAP,
            matchedReceiptVouchers,
            matchedPaymentVouchers,
            matchedEveryday,
            matchedCamps,
            matchedPettyCash
        };
    }, [company, accountsReceivable, accountsPayable, vouchers, everydayExpenses, camps, pettyCash]);

    // --- DOWNLOAD EXCEL ---
    const handleDownloadExcel = () => {
        const { 
            arTaxable, arVat, arIncome, voucherIncome, pcIncome,
            apTaxable, apVat, apExpense, voucherExpense, everydayExpense, campExpense, pcExpense,
            totalIncome, totalExpense, netProfitLoss
        } = financialStats;

        const dataRows = [
            { "Report Section": "COMPANY PROFILE", "Field Name": "Company Code", "Value": company.code || "-" },
            { "Report Section": "COMPANY PROFILE", "Field Name": "Company Name", "Value": company.name },
            { "Report Section": "COMPANY PROFILE", "Field Name": "TRN Number", "Value": company.trn || "Not Registered" },
            { "Report Section": "COMPANY PROFILE", "Field Name": "Email Address", "Value": company.email || "-" },
            { "Report Section": "COMPANY PROFILE", "Field Name": "Contact Number", "Value": company.phone || "-" },
            { "Report Section": "COMPANY PROFILE", "Field Name": "Office Address", "Value": company.address || "-" },
            { "Report Section": "STATISTICS", "Field Name": "Portal Credentials Stored", "Value": company.records ? company.records.length : 0 },
            { "Report Section": "STATISTICS", "Field Name": "Drive Documents Stored", "Value": company.driveFiles ? company.driveFiles.length : 0 },
            { "Report Section": "", "Field Name": "", "Value": "" },
            { "Report Section": "INCOME SUMMARY", "Field Name": "Accounts Receivable (Taxable Amount)", "Value": arTaxable },
            { "Report Section": "INCOME SUMMARY", "Field Name": "Accounts Receivable (VAT Output 5%)", "Value": arVat },
            { "Report Section": "INCOME SUMMARY", "Field Name": "Accounts Receivable (Total Invoiced)", "Value": arIncome },
            { "Report Section": "INCOME SUMMARY", "Field Name": "Receipt Vouchers (Revenue)", "Value": voucherIncome },
            { "Report Section": "INCOME SUMMARY", "Field Name": "Petty Cash Advances (Income)", "Value": pcIncome },
            { "Report Section": "INCOME SUMMARY", "Field Name": "TOTAL CORPORATE INCOME (AED)", "Value": totalIncome },
            { "Report Section": "", "Field Name": "", "Value": "" },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Accounts Payable (Taxable Amount)", "Value": apTaxable },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Accounts Payable (VAT Input 5%)", "Value": apVat },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Accounts Payable (Total Bills)", "Value": apExpense },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Payment Vouchers (Expenses)", "Value": voucherExpense },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Everyday Expenses (Bills)", "Value": everydayExpense },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Camp Accommodation Expenses", "Value": campExpense },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "Petty Cash Direct Spent", "Value": pcExpense },
            { "Report Section": "EXPENSE SUMMARY", "Field Name": "TOTAL CORPORATE EXPENSES (AED)", "Value": totalExpense },
            { "Report Section": "", "Field Name": "", "Value": "" },
            { "Report Section": "NET ANALYSIS", "Field Name": "NET SURPLUS / (DEFICIT) (AED)", "Value": netProfitLoss }
        ];

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Company Summary");
        XLSX.writeFile(wb, `${company.name.replace(/\s+/g, "_")}_Details_Summary.xlsx`);
    };

    // --- DOWNLOAD PDF ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const primaryColor = [15, 23, 42]; // Slate-900
        const secondaryColor = [71, 85, 105]; // Slate-600
        const accentColor = [79, 70, 229]; // Indigo-600
        const lightBg = [248, 250, 252]; // Slate-50

        // Header Accent Stripe
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, 210, 8, 'F');

        // Brand Title
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("PIONEER DMS PORTAL", 15, 25);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("Corporate Identity & Financial Analysis Report", 15, 31);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 35);

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(15, 39, 195, 39);

        // Section: PROFILE
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("COMPANY PROFILE DETAILS", 15, 47);

        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(15, 51, 180, 52, 'F');
        doc.rect(15, 51, 180, 52, 'D');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Full Name:", 20, 58);
        doc.setFont("Helvetica", "normal");
        doc.text(company.name || "-", 55, 58);

        doc.setFont("Helvetica", "bold");
        doc.text("Company Code:", 20, 65);
        doc.setFont("Helvetica", "normal");
        doc.text(company.code || "-", 55, 65);

        doc.setFont("Helvetica", "bold");
        doc.text("TRN Number:", 20, 72);
        doc.setFont("Helvetica", "normal");
        doc.text(company.trn || "Not Registered", 55, 72);

        doc.setFont("Helvetica", "bold");
        doc.text("Email Address:", 20, 79);
        doc.setFont("Helvetica", "normal");
        doc.text(company.email || "-", 55, 79);

        doc.setFont("Helvetica", "bold");
        doc.text("Contact No:", 20, 86);
        doc.setFont("Helvetica", "normal");
        doc.text(company.phone || "-", 55, 86);

        doc.setFont("Helvetica", "bold");
        doc.text("Office Address:", 20, 93);
        doc.setFont("Helvetica", "normal");
        doc.text(company.address || "-", 55, 93);

        // Section: STATS
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.text("PORTAL & DOCUMENT STATS", 15, 112);

        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(15, 116, 85, 20, 'F');
        doc.rect(15, 116, 85, 20, 'D');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Portal Credentials Stored", 20, 122);
        doc.setFontSize(14);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(String(company.records ? company.records.length : 0), 20, 130);

        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(110, 116, 85, 20, 'F');
        doc.rect(110, 116, 85, 20, 'D');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Drive Documents Stored", 115, 122);
        doc.setFontSize(14);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(String(company.driveFiles ? company.driveFiles.length : 0), 115, 130);

        // Section: FINANCIAL SUMMARY
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("FINANCIAL POSITION & CASH FLOW SUMMARY", 15, 144);

        const { 
            arIncome, voucherIncome, pcIncome, apExpense, voucherExpense, everydayExpense, campExpense, pcExpense, totalIncome, totalExpense, netProfitLoss 
        } = financialStats;

        // Table Header
        doc.setFillColor(241, 245, 249);
        doc.rect(15, 148, 180, 8, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Financial Category", 20, 153.5);
        doc.text("Source Details", 75, 153.5);
        doc.text("Amount (AED)", 160, 153.5);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        
        let yPos = 161;
        doc.text("Corporate Sales (Invoiced)", 20, yPos);
        doc.text("Accounts Receivable", 75, yPos);
        doc.text(`AED ${arIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 6.5;
        doc.text("Receipt Vouchers (Revenue)", 20, yPos);
        doc.text("General Receipts", 75, yPos);
        doc.text(`AED ${voucherIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 6.5;
        doc.text("Petty Cash Advances", 20, yPos);
        doc.text("Petty Cash Capital", 75, yPos);
        doc.text(`AED ${pcIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 5.5;
        doc.setFillColor(248, 250, 252);
        doc.rect(15, yPos, 180, 7, 'F');
        doc.setFont("Helvetica", "bold");
        doc.text("TOTAL CORPORATE INCOME", 20, yPos + 4.5);
        doc.text(`AED ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos + 4.5);

        yPos += 11.5;
        doc.setFont("Helvetica", "normal");
        doc.text("Supplier Bills (Purchases)", 20, yPos);
        doc.text("Accounts Payable", 75, yPos);
        doc.text(`AED ${apExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 6.5;
        doc.text("Payment Vouchers (Expenses)", 20, yPos);
        doc.text("General Payments", 75, yPos);
        doc.text(`AED ${voucherExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 6.5;
        doc.text("Everyday Expenses (Bills)", 20, yPos);
        doc.text("Everyday Spent", 75, yPos);
        doc.text(`AED ${everydayExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 6.5;
        doc.text("Camp Accommodation", 20, yPos);
        doc.text("Rent & Deposits", 75, yPos);
        doc.text(`AED ${campExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 6.5;
        doc.text("Petty Cash Direct Spent", 20, yPos);
        doc.text("Petty Cash Spent", 75, yPos);
        doc.text(`AED ${pcExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos);

        yPos += 5.5;
        doc.setFillColor(248, 250, 252);
        doc.rect(15, yPos, 180, 7, 'F');
        doc.setFont("Helvetica", "bold");
        doc.text("TOTAL CORPORATE EXPENSES", 20, yPos + 4.5);
        doc.text(`AED ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos + 4.5);

        // Net profit card
        yPos += 11.5;
        doc.setFillColor(netProfitLoss >= 0 ? 240 : 254, netProfitLoss >= 0 ? 253 : 242, netProfitLoss >= 0 ? 250 : 242);
        doc.rect(15, yPos, 180, 11, 'F');
        doc.setDrawColor(netProfitLoss >= 0 ? 186 : 252, netProfitLoss >= 0 ? 230 : 165, netProfitLoss >= 0 ? 218 : 165);
        doc.rect(15, yPos, 180, 11, 'D');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(netProfitLoss >= 0 ? 21 : 185, netProfitLoss >= 0 ? 128 : 28, netProfitLoss >= 0 ? 61 : 28);
        doc.text("NET SURPLUS / (DEFICIT)", 20, yPos + 7);
        doc.text(`AED ${netProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 150, yPos + 7);

        // Footer disclaimer
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("Disclaimer: Stored system credentials are held securely. Financial data represents matches from current accounts.", 15, 273);
        doc.text("Approved By: Pioneer Contracting DMS System Manager", 15, 278);

        doc.save(`${company.name.replace(/\s+/g, "_")}_Details_Report.pdf`);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                {/* Modal Container */}
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 15 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden w-full max-w-2xl flex flex-col relative max-h-[90vh] z-10"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 bg-slate-50 rounded-2xl p-2 border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden">
                                {company.logo ? (
                                    <img src={company.logo} alt={company.name} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <Building2 className="w-7 h-7 text-slate-300" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight leading-snug">{company.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                        Code: {company.code || "-"}
                                    </span>
                                    {company.trn && (
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                                            TRN: {company.trn}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors outline-none"
                            title="Close dialog"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="px-6 border-b border-slate-100 flex gap-4">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all outline-none ${
                                activeTab === 'profile' 
                                    ? 'border-brand-600 text-brand-600' 
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Corporate Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('financials')}
                            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all outline-none ${
                                activeTab === 'financials' 
                                    ? 'border-brand-600 text-brand-600' 
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Financial Positions
                        </button>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                        {activeTab === 'profile' ? (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                {/* Details Card Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* TRN */}
                                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl flex flex-col justify-between">
                                        <div className="flex items-center gap-2.5 text-slate-400 mb-1.5">
                                            <Hash className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Tax Registration Number (TRN)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700">{company.trn || "Not Registered"}</span>
                                            {company.trn && (
                                                <button 
                                                    onClick={() => handleCopy(company.trn || '', 'trn')}
                                                    className="p-1 hover:bg-white border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                                                >
                                                    {copiedField === 'trn' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl flex flex-col justify-between">
                                        <div className="flex items-center gap-2.5 text-slate-400 mb-1.5">
                                            <Mail className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Corporate Email</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{company.email || "-"}</span>
                                            {company.email && (
                                                <button 
                                                    onClick={() => handleCopy(company.email || '', 'email')}
                                                    className="p-1 hover:bg-white border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                                                >
                                                    {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Phone */}
                                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl flex flex-col justify-between">
                                        <div className="flex items-center gap-2.5 text-slate-400 mb-1.5">
                                            <Phone className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Contact Number</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700">{company.phone || "-"}</span>
                                            {company.phone && (
                                                <button 
                                                    onClick={() => handleCopy(company.phone || '', 'phone')}
                                                    className="p-1 hover:bg-white border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                                                >
                                                    {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Office Address */}
                                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl flex flex-col justify-between">
                                        <div className="flex items-center gap-2.5 text-slate-400 mb-1.5">
                                            <MapPin className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Office Address</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{company.address || "-"}</span>
                                            {company.address && (
                                                <button 
                                                    onClick={() => handleCopy(company.address || '', 'address')}
                                                    className="p-1 hover:bg-white border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                                                >
                                                    {copiedField === 'address' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stored Information Stats widgets */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 bg-gradient-to-br from-brand-50/30 to-brand-50/10 border border-brand-100/40 rounded-3xl flex items-center gap-4">
                                        <div className="p-3 bg-white text-brand-600 rounded-2xl shadow-sm">
                                            <Key className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Credentials Stored</span>
                                            <span className="text-xl font-black text-slate-800">{company.records ? company.records.length : 0} records</span>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-50/50 border border-slate-100 rounded-3xl flex items-center gap-4">
                                        <div className="p-3 bg-white text-slate-600 rounded-2xl shadow-sm">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">DMS Documents</span>
                                            <span className="text-xl font-black text-slate-800">{company.driveFiles ? company.driveFiles.length : 0} attachments</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                {/* Profit / Loss Highlights */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-3xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Total Income</span>
                                            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                                                <TrendingUp className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <span className="text-lg font-black text-slate-800 block">
                                            AED {financialStats.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 block mt-1">
                                            AR Invoices + RVs + PC Advances
                                        </span>
                                    </div>

                                    <div className="p-5 bg-rose-50/50 border border-rose-100 rounded-3xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">Total Expenses</span>
                                            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                                                <TrendingDown className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <span className="text-lg font-black text-slate-800 block">
                                            AED {financialStats.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 block mt-1">
                                            AP + PVs + EE + Camps + PC Spent
                                        </span>
                                    </div>

                                    <div className={`p-5 rounded-3xl border ${
                                        financialStats.netProfitLoss >= 0 
                                            ? 'bg-brand-50/40 border-brand-100' 
                                            : 'bg-amber-50/40 border-amber-100'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                financialStats.netProfitLoss >= 0 ? 'text-brand-700' : 'text-amber-700'
                                            }`}>Net Surplus / Deficit</span>
                                            <div className={`p-1.5 rounded-lg ${
                                                financialStats.netProfitLoss >= 0 ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                <DollarSign className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <span className={`text-lg font-black block ${
                                            financialStats.netProfitLoss >= 0 ? 'text-brand-750' : 'text-amber-750'
                                        }`}>
                                            AED {financialStats.netProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 block mt-1">
                                            Overall Profit / Loss
                                        </span>
                                    </div>
                                </div>

                                {/* Breakdown detailed sub-grid */}
                                <div className="border border-slate-150 rounded-[2rem] overflow-hidden">
                                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-150">
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Cash Flow Category breakdown</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 text-xs">
                                        {/* Sales Invoices */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Accounts Receivable</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Corporate sales standard invoices ({financialStats.matchedAR.length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800">
                                                AED {financialStats.arIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Receipts */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Receipt Vouchers</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Corporate receipt of payments ({financialStats.matchedReceiptVouchers.length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-emerald-600">
                                                + AED {financialStats.voucherIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Petty Cash Income (Advances) */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Petty Cash Advances</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Petty cash advances & capital transfers ({financialStats.matchedPettyCash.filter(x => x.type === 'Income').length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-emerald-600">
                                                + AED {financialStats.pcIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Payables */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Accounts Payable</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Supplier invoices & bills registered ({financialStats.matchedAP.length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800">
                                                AED {financialStats.apExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Payments */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Payment Vouchers</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Corporate expense payments vouchers ({financialStats.matchedPaymentVouchers.length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-rose-600">
                                                - AED {financialStats.voucherExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Everyday Expenses */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Everyday Expenses</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">General corporate everyday utility spend ({financialStats.matchedEveryday.length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-rose-600">
                                                - AED {financialStats.everydayExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Camp Accommodation */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Camp Accommodation</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Accommodation rent & deposit expenses ({financialStats.matchedCamps.length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-rose-600">
                                                - AED {financialStats.campExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Petty Cash Spent */}
                                        <div className="px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50/30 transition-colors">
                                            <div>
                                                <span className="font-extrabold text-slate-700 block text-sm">Petty Cash Direct Spent</span>
                                                <span className="text-slate-400 font-semibold block mt-0.5">Direct expense spend from petty cash books ({financialStats.matchedPettyCash.filter(x => x.type === 'Expense').length})</span>
                                            </div>
                                            <span className="text-sm font-bold text-rose-600">
                                                - AED {financialStats.pcExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleDownloadExcel}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
                                title="Download spreadsheet summary"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Download Excel
                            </button>
                            <button 
                                onClick={handleDownloadPDF}
                                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
                                title="Download PDF report summary"
                            >
                                <FileMinus className="w-4 h-4" />
                                Download PDF
                            </button>
                        </div>
                        <button 
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-colors outline-none"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
