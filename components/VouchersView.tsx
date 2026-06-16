import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Edit2, Trash2, Printer, Eye, Calendar, Wallet, 
    TrendingDown, TrendingUp, Filter, X, ArrowUpRight, Download, 
    CheckCircle, AlertCircle, FileText, Link, Receipt, Landmark
} from 'lucide-react';
import { Voucher, Project, Company, SystemUser } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface VouchersViewProps {
    data: Voucher[];
    projects: Project[];
    companies: Company[];
    user: SystemUser;
    onSave: (voucher: Voucher) => Promise<void>;
    onDelete: (voucherId: string) => Promise<void>;
    openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
}

export const VouchersView: React.FC<VouchersViewProps> = ({
    data = [],
    projects = [],
    companies = [],
    user,
    onSave,
    onDelete,
    openConfirm
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'payment' | 'receipt'>('all');
    const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
    const [previewingVoucher, setPreviewingVoucher] = useState<Voucher | null>(null);

    // Form inputs state
    const [formType, setFormType] = useState<'payment' | 'receipt'>('payment');
    const [voucherNo, setVoucherNo] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [payeeOrReceiver, setPayeeOrReceiver] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [vatRate, setVatRate] = useState<number>(5); // Default 5% UAE VAT
    const [vatAmount, setVatAmount] = useState<number>(0);
    const [totalAmount, setTotalAmount] = useState<number>(0);
    const [paymentMode, setPaymentMode] = useState<Voucher['paymentMode']>('Cash');
    const [chequeOrRefNo, setChequeOrRefNo] = useState('');
    const [description, setDescription] = useState('');
    const [projectId, setProjectId] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [receivedBy, setReceivedBy] = useState('');
    const [attachment, setAttachment] = useState<string>(''); // Base64
    const [formError, setFormError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Date filters helpers
    const months = [
        { label: 'All Months', value: '' },
        { label: 'January', value: '01' },
        { label: 'February', value: '02' },
        { label: 'March', value: '03' },
        { label: 'April', value: '04' },
        { label: 'May', value: '05' },
        { label: 'June', value: '06' },
        { label: 'July', value: '07' },
        { label: 'August', value: '08' },
        { label: 'September', value: '09' },
        { label: 'October', value: '10' },
        { label: 'November', value: '11' },
        { label: 'December', value: '12' }
    ];

    const years = useMemo(() => {
        const extracted = Array.from(new Set(data.map(v => v.date?.split('-')[0]).filter(Boolean))).sort();
        return ['', ...extracted];
    }, [data]);

    // Handle VAT Calculations helper
    const handleAmountChange = (val: number) => {
        setAmount(val);
        const calculatedVat = Math.round((val * (vatRate / 100)) * 100) / 100;
        setVatAmount(calculatedVat);
        setTotalAmount(val + calculatedVat);
    };

    const handleVatRateChange = (rate: number) => {
        setVatRate(rate);
        const calculatedVat = Math.round((amount * (rate / 100)) * 100) / 100;
        setVatAmount(calculatedVat);
        setTotalAmount(amount + calculatedVat);
    };

    const handleVatAmountChange = (val: number) => {
        setVatAmount(val);
        setTotalAmount(amount + val);
    };

    // Auto-suggest Voucher Number
    const generateVoucherNoSuggestion = (type: 'payment' | 'receipt') => {
        const prefix = type === 'payment' ? 'PV-' : 'RV-';
        const timestamp = Date.now().toString().slice(-6);
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `${prefix}${timestamp}-${randomNum}`;
    };

    // Populate or reset form
    const openCreateModal = (type: 'payment' | 'receipt') => {
        setEditingVoucher(null);
        setFormType(type);
        setVoucherNo(generateVoucherNoSuggestion(type));
        setDate(new Date().toISOString().split('T')[0]);
        setPayeeOrReceiver('');
        setAmount(0);
        setVatRate(5);
        setVatAmount(0);
        setTotalAmount(0);
        setPaymentMode('Cash');
        setChequeOrRefNo('');
        setDescription('');
        setProjectId('');
        setCompanyId('');
        setReceivedBy('');
        setAttachment('');
        setFormError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (voucher: Voucher) => {
        setEditingVoucher(voucher);
        setFormType(voucher.voucherType);
        setVoucherNo(voucher.voucherNo || '');
        setDate(voucher.date || '');
        setPayeeOrReceiver(voucher.payeeOrReceiver || '');
        setAmount(voucher.amount || 0);
        setVatRate(voucher.vatRate ?? 5);
        setVatAmount(voucher.vatAmount || 0);
        setTotalAmount(voucher.totalAmount || 0);
        setPaymentMode(voucher.paymentMode || 'Cash');
        setChequeOrRefNo(voucher.chequeOrRefNo || '');
        setDescription(voucher.description || '');
        setProjectId(voucher.projectId || '');
        setCompanyId(voucher.companyId || '');
        setReceivedBy(voucher.receivedBy || '');
        setAttachment(voucher.attachment || '');
        setFormError(null);
        setIsModalOpen(true);
    };

    // Base64 File Upload
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setFormError("Attachment size must be less than 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachment(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!voucherNo.trim()) {
            setFormError("Voucher Number is required.");
            return;
        }
        if (!date) {
            setFormError("Voucher Date is required.");
            return;
        }
        if (!payeeOrReceiver.trim()) {
            setFormError(formType === 'payment' ? "Payee Name (Paid To) is required." : "Receiver Name (Received From) is required.");
            return;
        }
        if (amount <= 0) {
            setFormError("Amount must be greater than zero.");
            return;
        }

        const newVoucher: Voucher = {
            id: editingVoucher?.id || Math.random().toString(36).substr(2, 9),
            voucherType: formType,
            voucherNo: voucherNo.trim(),
            date,
            payeeOrReceiver: payeeOrReceiver.trim(),
            amount: Number(amount),
            vatRate: Number(vatRate),
            vatAmount: Number(vatAmount),
            totalAmount: Number(totalAmount),
            paymentMode,
            chequeOrRefNo: chequeOrRefNo.trim(),
            description: description.trim(),
            preparedBy: editingVoucher?.preparedBy || user?.name || 'Authorized Portal User',
            preparedByUid: editingVoucher?.preparedByUid || user?.uid || '',
            approvedBy: editingVoucher?.approvedBy || (user?.role === 'Admin' || user?.role === 'Creator' || user?.role === 'Accountant' ? user.name : ''),
            approvedByUid: editingVoucher?.approvedByUid || (user?.role === 'Admin' || user?.role === 'Creator' || user?.role === 'Accountant' ? user.uid : ''),
            receivedBy: formType === 'payment' ? receivedBy.trim() : undefined,
            projectId: projectId || undefined,
            companyId: companyId || undefined,
            attachment: attachment || undefined,
            uploadedDate: editingVoucher?.uploadedDate || new Date().toISOString()
        };

        try {
            await onSave(newVoucher);
            setIsModalOpen(false);
        } catch (err: any) {
            setFormError(err.message || "Failed to save Voucher.");
        }
    };

    const handleVoucherDelete = (voucher: Voucher) => {
        openConfirm(
            "Delete Voucher",
            `Are you sure you want to delete Voucher "${voucher.voucherNo}"? This action cannot be undone.`,
            async () => {
                try {
                    await onDelete(voucher.id);
                    if (previewingVoucher?.id === voucher.id) {
                        setPreviewingVoucher(null);
                    }
                } catch (err) {
                    console.error("Voucher deletion failed", err);
                }
            },
            'danger'
        );
    };

    // Generate beautifully exported PDF of Voucher
    const downloadVoucherPDF = (voucher: Voucher) => {
        const doc = new jsPDF();
        
        // Header card
        doc.setFillColor(30, 41, 59); // deep slate
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("PIONEER GENERAL CONTRACTING LLC", 15, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Dubai, United Arab Emirates • Tax Registration Number: 100234567890003", 15, 30);
        
        // Voucher Title Box
        doc.setFillColor(243, 244, 246);
        doc.rect(15, 50, 180, 20, 'F');
        doc.setDrawColor(209, 213, 219);
        doc.rect(15, 50, 180, 20, 'D');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(17, 24, 39);
        const titleStr = voucher.voucherType === 'payment' ? "PAYMENT VOUCHER" : "RECEIPT VOUCHER";
        doc.text(titleStr, 20, 62);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`VOUCHER NO: ${voucher.voucherNo}`, 130, 62);

        // Core fields setup
        const startY = 85;
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);

        // Grid entries
        const gridData = [
            ["Voucher Date:", voucher.date || '-'],
            [voucher.voucherType === 'payment' ? "Paid To (Payee):" : "Received From:", voucher.payeeOrReceiver || '-'],
            ["Payment Mode:", voucher.paymentMode || '-'],
            ["Cheque / Ref No:", voucher.chequeOrRefNo || 'N/A'],
            ["Project:", projects.find(p => p.id === voucher.projectId)?.name || 'General Accounts'],
            ["Corporate Corporate:", companies.find(c => c.id === voucher.companyId)?.name || 'Independent Unit'],
            ["Description:", voucher.description || '-']
        ];

        let currY = startY;
        gridData.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.text(label, 15, currY);
            doc.setFont("helvetica", "normal");
            const splitVal = doc.splitTextToSize(value, 130);
            doc.text(splitVal, 60, currY);
            currY += Math.max(8, splitVal.length * 5);
        });

        // Amount Box
        currY += 5;
        doc.setDrawColor(209, 213, 219);
        doc.line(15, currY, 195, currY);
        
        currY += 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("SUBTOTAL AMOUNT:", 100, currY);
        doc.setFont("helvetica", "normal");
        doc.text(`${(voucher.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} AED`, 160, currY, { align: "right" });

        currY += 8;
        doc.setFont("helvetica", "bold");
        doc.text(`VAT (${voucher.vatRate ?? 5}%):`, 100, currY);
        doc.setFont("helvetica", "normal");
        doc.text(`${(voucher.vatAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} AED`, 160, currY, { align: "right" });

        currY += 10;
        doc.setFillColor(243, 244, 246);
        doc.rect(95, currY - 6, 100, 12, 'F');
        doc.rect(95, currY - 6, 100, 12, 'D');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text("TOTAL AMOUNT:", 100, currY + 2);
        doc.text(`${(voucher.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} AED`, 190, currY + 2, { align: "right" });

        // Signatures block at bottom
        let sigY = currY + 35;
        if (sigY > 265) {
            doc.addPage();
            sigY = 50;
        }

        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.setDrawColor(209, 213, 219);

        // Col 1: Prepared By
        doc.line(15, sigY, 65, sigY);
        doc.setFont("helvetica", "bold");
        doc.text("Prepared By", 15, sigY + 5);
        doc.setFont("helvetica", "normal");
        doc.text(voucher.preparedBy || 'Portal System', 15, sigY + 10);

        // Col 2: Approved By
        doc.line(80, sigY, 130, sigY);
        doc.setFont("helvetica", "bold");
        doc.text("Approved By (Admin/Acct)", 80, sigY + 5);
        doc.setFont("helvetica", "normal");
        doc.text(voucher.approvedBy || "Pending Signature", 80, sigY + 10);

        // Col 3: Received By
        if (voucher.voucherType === 'payment') {
            doc.line(145, sigY, 195, sigY);
            doc.setFont("helvetica", "bold");
            doc.text("Received By (Recipient)", 145, sigY + 5);
            doc.setFont("helvetica", "normal");
            doc.text(voucher.receivedBy || "Pending Acknowledgment", 145, sigY + 10);
        } else {
            doc.line(145, sigY, 195, sigY);
            doc.setFont("helvetica", "bold");
            doc.text("Deposited / Saved By", 145, sigY + 5);
            doc.setFont("helvetica", "normal");
            doc.text(voucher.preparedBy || 'DMS Portal', 145, sigY + 10);
        }

        doc.save(`${voucher.voucherNo}_Statement.pdf`);
    };

    // Export currently filtered list of vouchers to Excel spreadsheet
    const exportVouchersToExcel = () => {
        if (filteredVouchers.length === 0) {
            alert("No vouchers available to export.");
            return;
        }

        const exportData = filteredVouchers.map((v, idx) => {
            const projName = projects.find(p => p.id === v.projectId)?.name || 'General Accounts';
            const compName = companies.find(c => c.id === v.companyId)?.name || 'Independent Unit';
            return {
                "S.No": idx + 1,
                "Voucher No": v.voucherNo || '',
                "Voucher Type": (v.voucherType || '').toUpperCase(),
                "Voucher Date": v.date || '',
                "Payee / Depositor": v.payeeOrReceiver || '',
                "Payment Mode": v.paymentMode || 'Cash',
                "Cheque / Ref No": v.chequeOrRefNo || 'N/A',
                "Amount (AED)": v.amount || 0,
                "VAT Rate (%)": v.vatRate ?? 5,
                "VAT Amount (AED)": v.vatAmount || 0,
                "Total Amount (AED)": v.totalAmount || 0,
                "Associated Project": projName,
                "Identity Company": compName,
                "Description / Purpose": v.description || '',
                "Prepared By": v.preparedBy || 'DMS Portal',
                "Approved By": v.approvedBy || '',
                "Received / Acknowledged By": v.receivedBy || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Filtered Ledger");
        
        let fileSuffix = "Vouchers_Report";
        if (activeTab !== 'all') fileSuffix += `_${activeTab}`;
        if (selectedMonth) fileSuffix += `_Month_${selectedMonth}`;
        if (selectedYear) fileSuffix += `_Year_${selectedYear}`;

        XLSX.writeFile(wb, `${fileSuffix}.xlsx`);
    };

    // Print summary statement containing list of vouchers with subtotals
    const printVouchersSummaryPDF = () => {
        if (filteredVouchers.length === 0) {
            alert("No vouchers available to print.");
            return;
        }

        const doc = new jsPDF('l', 'mm', 'a4'); // Elegant wide landscape mode
        
        // Brand Identity Title Card
        doc.setFillColor(30, 41, 59); // Premium Slate Dark
        doc.rect(0, 0, 297, 32, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("PIONEER GENERAL CONTRACTING LLC", 15, 14);
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Corporate Treasury • Voucher Listing Summary Statement", 15, 24);

        doc.setFontSize(8);
        doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 282, 14, { align: "right" });
        doc.text(`Active Filters: Type: ${activeTab.toUpperCase()} | Month: ${selectedMonth || 'ALL'} | Year: ${selectedYear || 'ALL'}`, 282, 24, { align: "right" });

        // Table Header
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("ACTIVE FILTERS SUMMARY LEDGER", 15, 45);

        // Core data arrays
        const tableBody = filteredVouchers.map((v, idx) => {
            const projName = projects.find(p => p.id === v.projectId)?.name || 'General Accounts';
            const compName = companies.find(c => c.id === v.companyId)?.name || 'Independent Unit';
            return [
                idx + 1,
                (v.voucherType || '').toUpperCase(),
                v.voucherNo || '',
                v.date || '',
                v.payeeOrReceiver || '',
                v.paymentMode || 'Cash',
                `${(v.totalAmount || v.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} AED`,
                projName,
                compName,
                v.description || '-'
            ];
        });

        (doc as any).autoTable({
            startY: 50,
            head: [['S.No', 'Type', 'Voucher No', 'Date', 'Payee / Receiver', 'Mode', 'Total (AED)', 'Project Link', 'Identity Link', 'Brief Description']],
            body: tableBody,
            headStyles: {
                fillColor: [51, 65, 85],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'left'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [30, 41, 59]
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 18 },
                2: { cellWidth: 28 },
                3: { cellWidth: 22 },
                4: { cellWidth: 35 },
                5: { cellWidth: 20 },
                6: { cellWidth: 28, fontStyle: 'bold', halign: 'right' },
                7: { cellWidth: 35 },
                8: { cellWidth: 35 },
                9: { cellWidth: 'auto' }
            },
            theme: 'grid',
            margin: { left: 15, right: 15 }
        });

        // Add Bottom Aggregate Card representing full summary statistics
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        
        const drawTotalsBox = (yPos: number) => {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, yPos, 267, 18, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(15, yPos, 267, 18, 'D');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);

            doc.text("LEDGER METRICS:", 20, yPos + 11);
            
            doc.setTextColor(225, 29, 72); // rose-600
            doc.text(`TOTAL PAID OUTFLOW: ${summaries.totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})} AED`, 60, yPos + 11);
            
            doc.setTextColor(5, 150, 105); // emerald-600
            doc.text(`TOTAL RECEIVED INFLOW: ${summaries.totalReceived.toLocaleString(undefined, {minimumFractionDigits: 2})} AED`, 135, yPos + 11);

            const netDiff = summaries.totalReceived - summaries.totalPaid;
            if (netDiff >= 0) {
                doc.setTextColor(5, 150, 105);
            } else {
                doc.setTextColor(225, 29, 72);
            }
            doc.text(`NET TREASURY BAL: ${netDiff.toLocaleString(undefined, {minimumFractionDigits: 2})} AED`, 215, yPos + 11);
        };

        if (finalY < 185) {
            drawTotalsBox(finalY);
        } else {
            doc.addPage();
            drawTotalsBox(30);
        }

        let fileTitle = "Vouchers_Ledger_List";
        doc.save(`${fileTitle}.pdf`);
    };

    // Filtering logic
    const filteredVouchers = useMemo(() => {
        return data.filter(v => {
            // Tab filter
            if (activeTab !== 'all' && v.voucherType !== activeTab) return false;

            // Month/Year filter
            if (v.date) {
                const [year, month] = v.date.split('-');
                if (selectedMonth && month !== selectedMonth) return false;
                if (selectedYear && year !== selectedYear) return false;
            } else if (selectedMonth || selectedYear) {
                return false;
            }

            // Project Filter
            if (selectedProjectFilter && v.projectId !== selectedProjectFilter) return false;

            // Company Filter
            if (selectedCompanyFilter && v.companyId !== selectedCompanyFilter) return false;

            // Search Term
            if (searchTerm.trim() !== '') {
                const qr = searchTerm.toLowerCase();
                const vNo = (v.voucherNo || '').toLowerCase();
                const pay = (v.payeeOrReceiver || '').toLowerCase();
                const desc = (v.description || '').toLowerCase();
                const prep = (v.preparedBy || '').toLowerCase();
                const payMode = (v.paymentMode || '').toLowerCase();
                const ref = (v.chequeOrRefNo || '').toLowerCase();
                
                return vNo.includes(qr) || pay.includes(qr) || desc.includes(qr) || prep.includes(qr) || payMode.includes(qr) || ref.includes(qr);
            }

            return true;
        }).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    }, [data, activeTab, selectedMonth, selectedYear, selectedProjectFilter, selectedCompanyFilter, searchTerm]);

    // Financial Summaries for active view
    const summaries = useMemo(() => {
        let totalPaid = 0;
        let totalReceived = 0;
        filteredVouchers.forEach(v => {
            if (v.voucherType === 'payment') {
                totalPaid += (v.totalAmount || v.amount || 0);
            } else {
                totalReceived += (v.totalAmount || v.amount || 0);
            }
        });
        return { totalPaid, totalReceived };
    }, [filteredVouchers]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="vouchers-view-root">
            {/* Header section with summaries */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-[2.5rem] p-6 sm:p-10 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/15 border border-indigo-400/20 px-3.5 py-1.5 rounded-full text-indigo-300 text-xs font-black uppercase tracking-widest leading-none">
                        <Receipt className="w-4 h-4" />
                        <span>Corporate Treasury Ledger</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Voucher Management</h1>
                    <p className="text-slate-300 text-sm font-medium max-w-2xl">
                        Generate, search, review, and print standardized Dubai Payment Vouchers and Receipt Vouchers. Track project cost attributions and VAT compliance automatically.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <button 
                        onClick={() => openCreateModal('payment')}
                        className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 transition-all shadow-lg hover:translate-y-[-2px]"
                    >
                        <TrendingDown className="w-4 h-4" />
                        <span>Payment Voucher</span>
                    </button>
                    
                    <button 
                        onClick={() => openCreateModal('receipt')}
                        className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 transition-all shadow-lg hover:translate-y-[-2px]"
                    >
                        <TrendingUp className="w-4 h-4" />
                        <span>Receipt Voucher</span>
                    </button>
                </div>
            </div>

            {/* Summaries Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Outflow (Payments)</span>
                        <h3 className="text-2xl font-black text-rose-600">{summaries.totalPaid.toLocaleString()} AED</h3>
                        <p className="text-[10px] text-slate-400 font-bold">From {filteredVouchers.filter(v => v.voucherType === 'payment').length} vouchers</p>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Inflow (Receipts)</span>
                        <h3 className="text-2xl font-black text-emerald-600">{summaries.totalReceived.toLocaleString()} AED</h3>
                        <p className="text-[10px] text-slate-400 font-bold">From {filteredVouchers.filter(v => v.voucherType === 'receipt').length} vouchers</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/50 p-6 rounded-3xl shadow-sm flex items-center justify-between gap-4 col-span-1 md:col-span-2 lg:col-span-1">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Net Treasury Influence</span>
                        <h3 className={`text-2xl font-black ${(summaries.totalReceived - summaries.totalPaid) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {(summaries.totalReceived - summaries.totalPaid).toLocaleString()} AED
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">Active Filter Workspace</p>
                    </div>
                    <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm border border-indigo-100/30">
                        <Landmark className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Filters Dashboard */}
            <div className="bg-white border border-slate-100 p-5 rounded-[2.2rem] shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Tab Switcher */}
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1">
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            All Vouchers
                        </button>
                        <button 
                            onClick={() => setActiveTab('payment')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'payment' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Payments
                        </button>
                        <button 
                            onClick={() => setActiveTab('receipt')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'receipt' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Receipts
                        </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Voucher #, payee, or details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs font-bold border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Month Filter */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Month</span>
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 text-xs font-bold rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Filter */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Year</span>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 text-xs font-bold rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">All Years</option>
                            {years.filter(Boolean).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Project Filter */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Project link</span>
                        <select 
                            value={selectedProjectFilter}
                            onChange={(e) => setSelectedProjectFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 text-xs font-bold rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Company Filter */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity link</span>
                        <select 
                            value={selectedCompanyFilter}
                            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 text-xs font-bold rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">All Identities</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Report and Export Actions bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 mt-1">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span>Filter set matches:</span>
                        <span className="text-slate-800 font-extrabold font-mono bg-slate-100 px-2 py-0.5 rounded-lg">{filteredVouchers.length} Vouchers</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportVouchersToExcel}
                            title="Export Filtered List to Excel Summary"
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100/75 border border-emerald-200/40 px-3.5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export Excel Summary</span>
                        </button>
                        <button
                            onClick={printVouchersSummaryPDF}
                            title="Generate and Download Filtered PDF Summary"
                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100/75 border border-indigo-200/40 px-3.5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print PDF Summary</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden p-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                                <th className="px-6 py-4.5">Voucher Type</th>
                                <th className="px-6 py-4.5">Voucher No</th>
                                <th className="px-6 py-4.5">Date</th>
                                <th className="px-6 py-4.5">Payee / Depositor</th>
                                <th className="px-6 py-4.5">Total Amount</th>
                                <th className="px-6 py-4.5">Details & Linkage</th>
                                <th className="px-6 py-4.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        No vouchers matching active filters have been found.
                                    </td>
                                </tr>
                            ) : (
                                filteredVouchers.map(v => {
                                    const proj = projects.find(p => p.id === v.projectId);
                                    const comp = companies.find(c => c.id === v.companyId);
                                    return (
                                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors group">
                                            {/* Type */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${v.voucherType === 'payment' ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
                                                    {v.voucherType === 'payment' ? (
                                                        <>
                                                            <TrendingDown className="w-3 h-3 shrink-0" />
                                                            <span>Payment</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TrendingUp className="w-3 h-3 shrink-0" />
                                                            <span>Receipt</span>
                                                        </>
                                                    )}
                                                </span>
                                            </td>

                                            {/* Voucher No */}
                                            <td className="px-6 py-4 font-mono font-bold text-slate-800">
                                                {v.voucherNo}
                                            </td>

                                            {/* Date */}
                                            <td className="px-6 py-4 text-slate-500 font-semibold font-mono">
                                                {v.date}
                                            </td>

                                            {/* Payee / Receiver */}
                                            <td className="px-6 py-4">
                                                <p className="font-extrabold text-slate-800">{v.payeeOrReceiver}</p>
                                                <p className="text-[10px] text-slate-400 font-bold font-mono">Mode: {v.paymentMode || 'Cash'} {v.chequeOrRefNo ? `(${v.chequeOrRefNo})` : ''}</p>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-6 py-4">
                                                <p className="font-black text-slate-800">{(v.totalAmount || v.amount).toLocaleString()} AED</p>
                                                <p className="text-[9px] text-slate-400 font-medium">VAT: {v.vatAmount?.toLocaleString() || '0'} AED ({v.vatRate ?? 5}%)</p>
                                            </td>

                                            {/* Details / link */}
                                            <td className="px-6 py-4 max-w-xs">
                                                <p className="font-medium text-slate-600 truncate mb-1" title={v.description}>{v.description || '-'}</p>
                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                    {proj && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50/60 border border-blue-100 text-[9px] text-blue-800 font-black rounded-lg">
                                                            <Link className="w-2.5 h-2.5" />
                                                            {proj.name}
                                                        </span>
                                                    )}
                                                    {comp && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50/60 border border-indigo-100 text-[9px] text-indigo-800 font-black rounded-lg">
                                                            <Landmark className="w-2.5 h-2.5" />
                                                            {comp.name}
                                                        </span>
                                                    )}
                                                    {v.attachment && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-[9px] text-slate-600 font-black rounded-lg">
                                                            <FileText className="w-2.5 h-2.5" />
                                                            Paper Copy
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => setPreviewingVoucher(v)}
                                                        title="Preview Voucher Document"
                                                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-100"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => downloadVoucherPDF(v)}
                                                        title="Download PDF File"
                                                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all border border-indigo-100/30"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => openEditModal(v)}
                                                        title="Edit"
                                                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-100"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleVoucherDelete(v)}
                                                        title="Delete (Irreversible)"
                                                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-100/35"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE / EDIT MODAL */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
                        >
                            {/* Modal Header */}
                            <div className={`p-6 sm:p-8 flex items-center justify-between border-b border-slate-100 ${formType === 'payment' ? 'bg-gradient-to-r from-red-50 to-rose-50/50' : 'bg-gradient-to-r from-emerald-50 to-teal-50/50'}`}>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-xl ${formType === 'payment' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                            {formType === 'payment' ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                                        </div>
                                        <h2 className="text-xl font-extrabold text-slate-800">
                                            {editingVoucher ? `Edit ${formType === 'payment' ? 'Payment' : 'Receipt'} Voucher` : `Create ${formType === 'payment' ? 'Payment' : 'Receipt'} Voucher`}
                                        </h2>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500">Corporate treasury entry and signature logs</p>
                                </div>
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 bg-white rounded-xl text-slate-400 hover:text-slate-600 border border-slate-100 hover:shadow-sm transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                                {formError && (
                                    <div className="bg-rose-50 border border-rose-100 p-4.5 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-extrabold select-none">
                                        <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Voucher No */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Voucher Number <span className="text-rose-500">*</span></label>
                                        <input 
                                            type="text"
                                            value={voucherNo}
                                            onChange={(e) => setVoucherNo(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                            placeholder="Auto Generated"
                                            required
                                        />
                                    </div>

                                    {/* Date */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1 font-bold">Voucher Date <span className="text-rose-500">*</span></label>
                                        <input 
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Payee / Receiver */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1 font-bold">
                                            {formType === 'payment' ? "Paid To (Payee) *" : "Received From *"}
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder={formType === 'payment' ? "Supplier, Staff, or Vendor name" : "Client or Corporate agency name"}
                                            value={payeeOrReceiver}
                                            onChange={(e) => setPayeeOrReceiver(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            required
                                        />
                                    </div>

                                    {/* Payment Mode */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Payment Mode</label>
                                        <select 
                                            value={paymentMode}
                                            onChange={(e) => setPaymentMode(e.target.value as Voucher['paymentMode'])}
                                            className="w-full px-4 py-3 bg-slate-50 border-none text-slate-800 text-sm font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="Credit Card">Credit Card</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Reference No */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Cheque / Ref Number (Optional)</label>
                                        <input 
                                            type="text"
                                            placeholder="Cheque #, transaction ref index"
                                            value={chequeOrRefNo}
                                            onChange={(e) => setChequeOrRefNo(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                        />
                                    </div>

                                    {/* Project selection */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Link to Project</label>
                                        <select 
                                            value={projectId}
                                            onChange={(e) => setProjectId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none text-slate-800 text-sm font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                                        >
                                            <option value="">General (No project attribution)</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                                    {/* Subtotal amount */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Subtotal (AED) <span className="text-rose-500">*</span></label>
                                        <input 
                                            type="number"
                                            step="any"
                                            value={amount === 0 ? '' : amount}
                                            onChange={(e) => handleAmountChange(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>

                                    {/* VAT Rate */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">VAT Rate (%)</label>
                                        <select 
                                            value={vatRate}
                                            onChange={(e) => handleVatRateChange(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all font-mono"
                                        >
                                            <option value="5">5% (Standard UAE)</option>
                                            <option value="0">0% (Zero Rated)</option>
                                            <option value="0">Exempt (Exempt Value)</option>
                                        </select>
                                    </div>

                                    {/* VAT Amount & Total */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 font-bold block ml-1">Total Amount (AED)</label>
                                        <input 
                                            type="number"
                                            value={totalAmount === 0 ? '' : totalAmount}
                                            readOnly
                                            className="w-full px-3 py-2 bg-indigo-50/70 border border-indigo-100/50 rounded-xl text-xs font-black text-indigo-950 transition-all font-mono cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Company identifier */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Identity Company Entity</label>
                                        <select 
                                            value={companyId}
                                            onChange={(e) => setCompanyId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none text-slate-800 text-sm font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                                        >
                                            <option value="">Default Corporate Accounts</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Received By */}
                                    {formType === 'payment' && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Received By / Acknowledged</label>
                                            <input 
                                                type="text"
                                                placeholder="Person receiving physical cash or bank transfer"
                                                value={receivedBy}
                                                onChange={(e) => setReceivedBy(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Transaction Description</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Detailed reference for payments, bills, client work allocation, item listings..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                                    />
                                </div>

                                {/* Custom base64 file upload dropzone */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Attach Bill/Receipt Capture</span>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2.5 bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-slate-600 text-xs font-bold transition-all hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                <FileText className="w-4.5 h-4.5 text-slate-400" />
                                                <span>Upload voucher signed paper copy (max 2MB)</span>
                                            </button>
                                            <input 
                                                type="file"
                                                accept="image/*,application/pdf"
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            {attachment && (
                                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 p-2 rounded-xl text-[11px] font-black">
                                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                    <span>Attachment Mounted Successfully</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setAttachment('')}
                                                        className="p-1 hover:bg-emerald-100 text-emerald-700 rounded-lg ml-1 font-bold cursor-pointer"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {attachment && (
                                            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2.5 relative">
                                                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>Uploaded Document Live Preview</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const w = window.open();
                                                            if (w) {
                                                                w.document.write(`<iframe src="${attachment}" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; margin:0; padding:0; overflow:hidden;" allowfullscreen></iframe>`);
                                                            } else {
                                                                alert("Please allow popups to open full-screen attachments.");
                                                            }
                                                        }}
                                                        className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
                                                        title="Open in a dedicated new browser tab"
                                                    >
                                                        <ArrowUpRight className="w-3 h-3" />
                                                        <span>Open full tab</span>
                                                    </button>
                                                </div>
                                                <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center justify-center overflow-auto max-h-[250px] shadow-inner">
                                                    {attachment.startsWith('data:application/pdf') ? (
                                                        <object 
                                                            data={attachment} 
                                                            type="application/pdf" 
                                                            className="w-full h-[220px] rounded-lg"
                                                        >
                                                            <iframe
                                                                src={attachment}
                                                                className="w-full h-[220px] border-none rounded-lg"
                                                                title="PDF Preview"
                                                            />
                                                        </object>
                                                    ) : (
                                                        <img
                                                            src={attachment}
                                                            alt="Attachment preview"
                                                            className="max-h-[220px] object-contain rounded-lg"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer submit */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3.5">
                                    <button 
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className={`px-6 py-3.5 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-600/10 flex items-center gap-2 ${formType === 'payment' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                                    >
                                        <span>Save Voucher Record</span>
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* PREVIEW MODAL */}
            <AnimatePresence>
                {previewingVoucher && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-mono">
                                    <Eye className="w-5 h-5 text-indigo-600" />
                                    <span>Voucher Statement Preview</span>
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => downloadVoucherPDF(previewingVoucher)}
                                        className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:bg-indigo-100 transition-all font-sans cursor-pointer"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>PDF</span>
                                    </button>
                                    <button 
                                        onClick={() => setPreviewingVoucher(null)}
                                        className="p-2 bg-white rounded-xl text-slate-400 hover:text-slate-600 border border-slate-100 hover:shadow-sm transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Statement Content Styled like fine printed stationary */}
                            <div className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 bg-slate-50/15">
                                {/* Corporate Header */}
                                <div className="text-center pb-6 border-b-2 border-double border-slate-200">
                                    <div className="text-center font-extrabold text-2xl tracking-normal text-slate-800">
                                        PIONEER GENERAL CONTRACTING LLC
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">DUBAI OFFICE • UNITED ARAB EMIRATES • TRN: 100234567890003</p>
                                </div>

                                {/* Title Header Card */}
                                <div className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-mono">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voucher Category</p>
                                        <h3 className={`text-base font-black uppercase ${previewingVoucher.voucherType === 'payment' ? 'text-rose-700' : 'text-emerald-700'}`}>
                                            {previewingVoucher.voucherType === 'payment' ? "PAYMENT VOUCHER" : "RECEIPT VOUCHER"}
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voucher Index</p>
                                        <h3 className="text-sm font-black text-slate-800">{previewingVoucher.voucherNo}</h3>
                                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{previewingVoucher.date}</p>
                                    </div>
                                </div>

                                {/* Details entries */}
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs font-medium border-b border-slate-100 pb-6">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher Date</span>
                                        <span className="text-slate-800 font-bold font-mono">{previewingVoucher.date}</span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                            {previewingVoucher.voucherType === 'payment' ? 'Paid to (recipient)' : 'Received from (agency)'}
                                        </span>
                                        <span className="text-slate-800 font-black">{previewingVoucher.payeeOrReceiver}</span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Treasury Payment Mode</span>
                                        <span className="text-slate-800 font-bold">{previewingVoucher.paymentMode}</span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cheque / Reference Number</span>
                                        <span className="text-slate-800 font-bold font-mono">{previewingVoucher.chequeOrRefNo || 'None / Cash Drawer'}</span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project allocation</span>
                                        <span className="text-slate-800 font-semibold">{projects.find(p => p.id === previewingVoucher.projectId)?.name || 'General Corporate Cost Pool'}</span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Buying Corporate Corporate</span>
                                        <span className="text-slate-800 font-semibold">{companies.find(c => c.id === previewingVoucher.companyId)?.name || 'Central Group Accounts'}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voucher Ledger Description / Purpose</span>
                                    <p className="text-xs text-slate-600 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100 leading-relaxed font-medium whitespace-pre-line">
                                        {previewingVoucher.description || 'No custom description written.'}
                                    </p>
                                </div>

                                {/* Ledger summary tally */}
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/60 max-w-sm ml-auto space-y-2.5">
                                    <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-500">
                                        <span>Amount (subtotal):</span>
                                        <span className="font-mono text-slate-700">{(previewingVoucher.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} AED</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-500">
                                        <span>VAT ({previewingVoucher.vatRate ?? 5}%):</span>
                                        <span className="font-mono text-slate-700">{(previewingVoucher.vatAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} AED</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-sm font-black text-slate-800 pt-2 border-t border-slate-200">
                                        <span>Total Amount:</span>
                                        <span className="font-mono text-indigo-600">{(previewingVoucher.totalAmount || previewingVoucher.amount).toLocaleString(undefined, {minimumFractionDigits: 2})} AED</span>
                                    </div>
                                </div>

                                {/* Custom signatures block */}
                                <div className="grid grid-cols-3 gap-4 pt-12 border-t border-dashed border-slate-200 text-center select-none">
                                    <div className="space-y-1">
                                        <div className="h-0.5 bg-slate-300 w-full mx-auto"></div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prepared By</h4>
                                        <p className="text-[11px] text-slate-600 font-extrabold">{previewingVoucher.preparedBy}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-0.5 bg-slate-300 w-full mx-auto"></div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approved By</h4>
                                        <p className="text-[11px] text-slate-600 font-extrabold">{previewingVoucher.approvedBy || 'Signature Pending'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-0.5 bg-slate-300 w-full mx-auto"></div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {previewingVoucher.voucherType === 'payment' ? "Received By" : "Verified By"}
                                        </h4>
                                        <p className="text-[11px] text-slate-600 font-extrabold">
                                            {previewingVoucher.voucherType === 'payment' ? (previewingVoucher.receivedBy || 'Signature Pending') : previewingVoucher.preparedBy}
                                        </p>
                                    </div>
                                </div>

                                {/* Picture attachment lightbox if loaded */}
                                {previewingVoucher.attachment && (
                                    <div className="space-y-3 pt-6 border-t border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mounted Paper copy / Signed Voucher Document</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const w = window.open();
                                                    if (w) {
                                                        w.document.write(`<iframe src="${previewingVoucher.attachment}" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; margin:0; padding:0; overflow:hidden;" allowfullscreen></iframe>`);
                                                    } else {
                                                        alert("Please allow popups to open full-screen attachments.");
                                                    }
                                                }}
                                                className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                                                title="Open in a dedicated new browser tab"
                                            >
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                                <span>Open full-screen</span>
                                            </button>
                                        </div>
                                        <div className="bg-slate-100 p-3 rounded-3xl border border-slate-200/50 flex items-center justify-center overflow-auto shadow-inner">
                                            {previewingVoucher.attachment.startsWith('data:application/pdf') ? (
                                                <div className="w-full h-[450px] rounded-2xl overflow-hidden border border-slate-200 bg-white">
                                                    <object 
                                                        data={previewingVoucher.attachment} 
                                                        type="application/pdf" 
                                                        className="w-full h-full"
                                                    >
                                                        <iframe 
                                                            src={previewingVoucher.attachment} 
                                                            className="w-full h-full border-none"
                                                            title="PDF Attachment Viewer"
                                                        />
                                                    </object>
                                                </div>
                                            ) : (
                                                <img 
                                                    src={previewingVoucher.attachment} 
                                                    alt="Signed copy receipt" 
                                                    className="max-h-[450px] object-contain rounded-2xl shadow-sm bg-white p-1"
                                                    referrerPolicy="no-referrer"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
