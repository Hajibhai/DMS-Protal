import React, { useState, useMemo } from 'react';
import { 
  FileText, HardHat, Plus, Search, Trash2, Edit, Download, CheckCircle, 
  X, Save, AlertCircle, TrendingUp, TrendingDown, ClipboardList, PlusCircle,
  Truck, Building2, HelpCircle, Briefcase, DollarSign, ArrowUpRight, Scale
} from 'lucide-react';
import { Company, Supplier, Project, Vendor, EngineerDocument, DocumentItem, DocumentPayment, UserRole } from '../types';
import { jsPDF } from 'jspdf';

interface EngineerViewProps {
  user: any;
  companies: Company[];
  suppliers: Supplier[];
  projects: Project[];
  vendors: Vendor[];
  engineerDocuments: EngineerDocument[];
  onSaveDocument: (doc: EngineerDocument) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
}

export const EngineerView: React.FC<EngineerViewProps> = ({
  user,
  companies,
  suppliers,
  projects,
  vendors,
  engineerDocuments,
  onSaveDocument,
  onDeleteDocument,
  openConfirm
}) => {
  const [activeTab, setActiveTab] = useState<'Quotations' | 'LPOs'>('Quotations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Issued' | 'Cancelled'>('All');

  // Modal states
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EngineerDocument | null>(null);
  
  // Payment Modal states
  const [showPaymentModal, setShowPaymentModal] = useState<EngineerDocument | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    mode: 'Bank Transfer' as DocumentPayment['mode'],
    reference: '',
    notes: ''
  });

  // Main Form fields state
  const [formData, setFormData] = useState({
    type: 'Quotation' as 'Quotation' | 'LPO',
    docNumber: '',
    date: new Date().toISOString().split('T')[0],
    companyId: '',
    companyName: '',
    supplierId: '',
    subject: '',
    notes: '',
    terms: '1. Prices are valid for 30 days from date of issue.\n2. Delivery of materials within UAE is included.\n3. Payment Terms: 50% Advance, 50% upon delivery/completion.\n4. Standard 5% VAT will be applicable as per UAE laws.',
  });

  const [formItems, setFormItems] = useState<DocumentItem[]>([
    { id: '1', name: '', description: '', quantity: 1, rate: 0, total: 0 }
  ]);

  const canManage = user?.role === UserRole.CREATOR || 
                    user?.role === UserRole.ADMIN || 
                    user?.role === UserRole.ENGINEER ||
                    user?.role === UserRole.ACCOUNTANT ||
                    user?.email?.toLowerCase() === 'abdulkaderp3010@gmail.com';

  const isAccountant = user?.role === UserRole.ACCOUNTANT;

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return engineerDocuments.filter(doc => {
      const isTypeMatch = activeTab === 'Quotations' ? doc.type === 'Quotation' : doc.type === 'LPO';
      const isStatusMatch = statusFilter === 'All' || doc.status === statusFilter;
      const isSearchMatch = 
        doc.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return isTypeMatch && isStatusMatch && isSearchMatch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [engineerDocuments, activeTab, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const list = engineerDocuments.filter(d => d.type === (activeTab === 'Quotations' ? 'Quotation' : 'LPO'));
    const pendingCount = list.filter(d => d.status === 'Pending').length;
    const approvedCount = list.filter(d => d.status === 'Approved' || d.status === 'Issued').length;
    
    const totalAmount = list.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalPaid = list.reduce((sum, d) => sum + (d.amountPaid || 0), 0);
    const totalBalance = list.reduce((sum, d) => sum + (d.balanceDue || 0), 0);

    return {
      pendingCount,
      approvedCount,
      totalAmount,
      totalPaid,
      totalBalance
    };
  }, [engineerDocuments, activeTab]);

  // Add Item to Form
  const addFormItem = () => {
    const newItem: DocumentItem = {
      id: Date.now().toString(),
      name: '',
      description: '',
      quantity: 1,
      rate: 0,
      total: 0
    };
    setFormItems([...formItems, newItem]);
  };

  // Remove Item from Form
  const removeFormItem = (id: string) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter(item => item.id !== id));
  };

  // Update form item on index
  const updateFormItem = (index: number, field: keyof DocumentItem, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index] };

    if (field === 'quantity') {
      item.quantity = Number(value) || 0;
    } else if (field === 'rate') {
      item.rate = Number(value) || 0;
    } else if (field === 'name') {
      item.name = value;
    } else if (field === 'description') {
      item.description = value;
    }

    item.total = item.quantity * item.rate;
    updated[index] = item;
    setFormItems(updated);
  };

  // Calculations for Draft Form
  const draftFormCalculations = useMemo(() => {
    const subTotal = formItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const vatAmount = subTotal * 0.05; // 5% UAE VAT
    const totalAmount = subTotal + vatAmount;
    return { subTotal, vatAmount, totalAmount };
  }, [formItems]);

  // Save Document
  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    // Validate
    if (!formData.companyName.trim()) {
      alert("Please specify the Client or Vendor company name");
      return;
    }

    const { subTotal, vatAmount, totalAmount } = draftFormCalculations;
    const documentId = editingDoc ? editingDoc.id : 'DOC_' + Date.now().toString();

    // Check if we are editing and retain historical payments
    const historicalPayments = editingDoc ? (editingDoc.payments || []) : [];
    const historicalAmountPaid = historicalPayments.reduce((sum, p) => sum + p.amount, 0);

    const docData: EngineerDocument = {
      id: documentId,
      type: formData.type,
      docNumber: formData.docNumber.trim() || `${formData.type === 'Quotation' ? 'PGC-QTN' : 'PGC-LPO'}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: formData.date,
      companyId: formData.type === 'Quotation' ? formData.companyId : undefined,
      companyName: formData.companyName,
      supplierId: formData.type === 'LPO' ? formData.supplierId : undefined,
      subject: formData.subject,
      items: formItems.map(it => ({ ...it })),
      subTotal,
      vatAmount,
      totalAmount,
      preparedBy: editingDoc ? editingDoc.preparedBy : (user?.name || 'Engineer'),
      preparedById: editingDoc ? editingDoc.preparedById : (user?.uid || ''),
      status: editingDoc ? editingDoc.status : 'Pending',
      payments: historicalPayments,
      amountPaid: historicalAmountPaid,
      balanceDue: Math.max(0, totalAmount - historicalAmountPaid),
      notes: formData.notes,
      terms: formData.terms
    };

    await onSaveDocument(docData);
    setShowDocModal(false);
    setEditingDoc(null);
  };

  // Open Edit Form
  const handleEditClick = (doc: EngineerDocument) => {
    setEditingDoc(doc);
    setFormData({
      type: doc.type,
      docNumber: doc.docNumber,
      date: doc.date,
      companyId: doc.companyId || '',
      companyName: doc.companyName,
      supplierId: doc.supplierId || '',
      subject: doc.subject,
      notes: doc.notes || '',
      terms: doc.terms || '',
    });
    setFormItems(doc.items && doc.items.length > 0 ? [...doc.items] : [{ id: '1', name: '', description: '', quantity: 1, rate: 0, total: 0 }]);
    setShowDocModal(true);
  };

  // Open Create Form
  const handleCreateClick = (type: 'Quotation' | 'LPO') => {
    setEditingDoc(null);
    const genNumber = `${type === 'Quotation' ? 'PGC-QTN' : 'PGC-LPO'}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      type,
      docNumber: genNumber,
      date: new Date().toISOString().split('T')[0],
      companyId: '',
      companyName: '',
      supplierId: '',
      subject: '',
      notes: '',
      terms: type === 'Quotation' 
        ? '1. Prices are valid for 30 days from date of issue.\n2. Delivery of materials within UAE is included.\n3. Payment Terms: 50% Advance, 50% upon delivery/completion.\n4. Standard 5% VAT will be applicable as per UAE laws.'
        : '1. Please deliver the requested materials to our site location within the specified date.\n2. Provide original commercial invoice stating TRN along with materials.\n3. Standard payment terms as agreed between parties shall apply.',
    });
    setFormItems([{ id: '1', name: '', description: '', quantity: 1, rate: 0, total: 0 }]);
    setShowDocModal(true);
  };

  // Handle document approval state transition
  const handleToggleDocStatus = async (doc: EngineerDocument, nextStatus: EngineerDocument['status']) => {
    openConfirm(`Update Status`, `Are you sure you want to mark document ${doc.docNumber} as ${nextStatus}?`, async () => {
      const updated = { ...doc, status: nextStatus };
      await onSaveDocument(updated);
    });
  };

  // Add payments log
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      alert("Please specify a valid payment amount");
      return;
    }

    const newPayment: DocumentPayment = {
      id: 'PAY_' + Date.now().toString(),
      date: paymentForm.date,
      amount,
      mode: paymentForm.mode,
      reference: paymentForm.reference.trim(),
      notes: paymentForm.notes.trim()
    };

    const targetDoc = { ...showPaymentModal };
    const currentPayments = targetDoc.payments ? [...targetDoc.payments] : [];
    currentPayments.push(newPayment);

    const updatedPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
    const updatedBalance = Math.max(0, targetDoc.totalAmount - updatedPaid);

    targetDoc.payments = currentPayments;
    targetDoc.amountPaid = updatedPaid;
    targetDoc.balanceDue = updatedBalance;

    await onSaveDocument(targetDoc);
    
    // Reset payment form state
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      mode: 'Bank Transfer',
      reference: '',
      notes: ''
    });
    setShowPaymentModal(null);
  };

  // Helper numbers to words (Professional touch for bills/PDFs)
  const numberToWords = (num: number): string => {
    try {
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      
      const g = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? '-' + a[digit] : '');
      };

      const h = (n: number): string => {
        if (n === 0) return '';
        const th = Math.floor(n / 1000);
        const hun = Math.floor((n % 1000) / 100);
        const ten = n % 100;
        let str = '';
        if (th) str += g(th) + ' Thousand ';
        if (hun) str += a[hun] + ' Hundred ';
        if (ten) str += g(ten);
        return str.trim();
      };

      const format = (n: number) => {
        const intPart = Math.floor(n);
        const decPart = Math.round((n - intPart) * 100);
        
        let intWords = h(intPart);
        if (!intWords) intWords = 'Zero';
        
        let decWords = '';
        if (decPart > 0) {
          decWords = ` and ${decPart}/100 Fils`;
        } else {
          decWords = ' Only';
        }
        return `UAE Dirhams ${intWords}${decWords}`;
      };

      return format(num);
    } catch {
      return "Amount in UAE Dirhams";
    }
  };

  // PDF Generator for Blank Original Letterhead Print
  // Important instructions: Generates standard format WITH NO HEADER, FOOTER OR WATERMARK elements.
  // Content must be clearly padded at the top (starts at y = 55) and at the bottom to allow
  // for pre-printed corporate stationery containing physical stamps & signed details.
  const handleDownloadPDF = (docItem: EngineerDocument) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const startY = 60; // Leave 60mm at top purely BLANK for user's printed letterhead
      let currY = startY;

      // Meta Header (Date, Ref No) positioned horizontally
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59); // Charcoal
      doc.text(`REF NO: ${docItem.docNumber}`, 20, currY);

      const dateText = `DATE: ${docItem.date.split('-').reverse().join('/')}`;
      doc.text(dateText, 190 - doc.getTextWidth(dateText), currY);

      currY += 12;

      // Recipient Details Block
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(docItem.type === 'Quotation' ? "CLIENT / RECIPIENT DETAILS:" : "SUPPLIER DETAILS:", 20, currY);
      
      currY += 5.5;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(`Name: ${docItem.companyName}`, 20, currY);

      // Attempt to fetch address & contact details if matches existing parties
      let phoneText = '';
      let emailText = '';
      if (docItem.type === 'Quotation') {
        const vendorMatch = vendors.find(v => v.name.toLowerCase() === docItem.companyName.toLowerCase());
        if (vendorMatch) {
          phoneText = vendorMatch.phone ? `Phone: ${vendorMatch.phone}` : '';
          emailText = vendorMatch.email ? `Email: ${vendorMatch.email}` : '';
        }
      } else {
        const supplierMatch = suppliers.find(s => s.name.toLowerCase() === docItem.companyName.toLowerCase());
        if (supplierMatch) {
          phoneText = supplierMatch.phone ? `Phone: ${supplierMatch.phone}` : '';
          emailText = supplierMatch.email ? `Email: ${supplierMatch.email}` : '';
        }
      }

      if (phoneText || emailText) {
        currY += 5;
        doc.text(`${phoneText}${phoneText && emailText ? ' | ' : ''}${emailText}`, 20, currY);
      }

      currY += 12;

      // Subject Block
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      const subjectLine = `${docItem.type === 'Quotation' ? 'QUOTATION' : 'LOCAL PURCHASE ORDER'} FOR ${docItem.subject.toUpperCase()}`;
      doc.text(subjectLine, 20, currY);
      // Underline the subject
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.4);
      doc.line(20, currY + 1.5, 20 + doc.getTextWidth(subjectLine), currY + 1.5);

      currY += 10;

      // Table Header definitions
      const tableX = 20;
      const colWidths = [12, 85, 18, 25, 30]; // 170mm total width (margins 20mm left and right)
      const headers = ["S.No", "Description / Details of Work", "Qty", "Rate (AED)", "Total (AED)"];

      // Draw table header background (Clean Minimalist slate grey rather than heavy colors)
      doc.setFillColor(241, 245, 249);
      doc.rect(tableX, currY, 170, 8, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(tableX, currY, 170, 8, 'D');

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);

      let colX = tableX;
      headers.forEach((hdr, idx) => {
        const align = idx >= 2 ? 'right' : 'left';
        const tx = align === 'right' ? colX + colWidths[idx] - 3 : colX + 3;
        doc.text(hdr, tx, currY + 5.5, { align });
        colX += colWidths[idx];
      });

      currY += 8;

      // Draw table items
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      docItem.items.forEach((item, index) => {
        // Estimate description height if wrapped
        const wrappedDesc = doc.splitTextToSize(item.description ? `${item.name} - ${item.description}` : item.name, colWidths[1] - 6);
        const cellHeight = Math.max(8, wrappedDesc.length * 4.5 + 3);

        // Grid box
        doc.rect(tableX, currY, 170, cellHeight, 'D');

        // Draw serial number
        doc.text((index + 1).toString(), tableX + 3, currY + 5);

        // Draw description text lines
        doc.text(wrappedDesc, tableX + colWidths[0] + 3, currY + 5);

        // Quantities
        const qtyStr = item.quantity.toString();
        doc.text(qtyStr, tableX + colWidths[0] + colWidths[1] + colWidths[2] - 3, currY + 5, { align: 'right' });

        // Unit Rate
        const rateStr = item.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        doc.text(rateStr, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 3, currY + 5, { align: 'right' });

        // Total
        const totalStr = (item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        doc.text(totalStr, tableX + 170 - 3, currY + 5, { align: 'right' });

        currY += cellHeight;
      });

      // Totals section
      const drawTotalRow = (label: string, val: number, isFinal: boolean = false) => {
        doc.rect(tableX, currY, 170, 7.5, 'D');
        doc.setFont("Helvetica", isFinal ? "bold" : "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);

        doc.text(label, tableX + colWidths[0] + colWidths[1] + 3, currY + 5);
        
        doc.setFont("Helvetica", "bold");
        const valStr = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AED";
        doc.text(valStr, tableX + 170 - 3, currY + 5, { align: 'right' });
        
        currY += 7.5;
      };

      drawTotalRow("Sub-Total (Excl. VAT)", docItem.subTotal);
      drawTotalRow("5% UAE VAT Amount", docItem.vatAmount);
      drawTotalRow("Net Total Document Value", docItem.totalAmount, true);

      currY += 6;

      // Words section
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Amount in Words: ${numberToWords(docItem.totalAmount)}`, 20, currY);

      currY += 10;

      // Terms & details Section (Only draw if space permits, or let's place it safely)
      if (docItem.terms) {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text("Terms & Conditions / Special Instructions:", 20, currY);
        currY += 4.5;

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        const splitTerms = doc.splitTextToSize(docItem.terms, 170);
        doc.text(splitTerms, 20, currY);
        
        currY += splitTerms.length * 4.2;
      }

      currY += 12;

      // Signature Area (Minimal placeholder without graphic logos or pre-filled stamps)
      // Strictly follows user's requirement to sign physically
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      
      doc.text("Prepared By:", 20, currY);
      doc.text("Approved & Accepted By:", 120, currY);
      
      currY += 5;
      doc.setFont("Helvetica", "normal");
      doc.text(`${docItem.preparedBy}`, 20, currY);
      doc.text(`Client Representative Authorization`, 120, currY);

      currY += 15;
      // Signature Line
      doc.setLineWidth(0.2);
      doc.line(20, currY, 70, currY);
      doc.line(120, currY, 175, currY);
      
      currY += 4;
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.text("Authorized Signature & Stamp", 20, currY);
      doc.text("Signature, Date & Company Stamp", 120, currY);

      // Trigger Save
      doc.save(`${docItem.type}_${docItem.docNumber}.pdf`);
    } catch (err) {
      console.error("Error generating clean PDF letterhead draft:", err);
      alert("Failed to render PDF: " + err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Engineer Hub</h1>
            <p className="text-slate-500 text-sm font-medium">Coordinating material flow, preparing Quotations & Supplier LPOs</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCreateClick('Quotation')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Quotation
            </button>
            <button
              onClick={() => handleCreateClick('LPO')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New LPO
            </button>
          </div>
        )}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Count</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{filteredDocs.length}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">active listed {activeTab}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">Pending Review</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.pendingCount}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">awaiting signature/approval</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 font-extrabold">Total Amount</div>
          <div className="text-2xl font-black text-slate-900 mt-1">AED {stats.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">including 5% standard VAT</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 font-extrabold">Received Payments</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">AED {stats.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">AED {stats.totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} outstanding</div>
        </div>
      </div>

      {/* Search and Filters Strip */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Sub-tabs switch */}
          <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 self-start w-full md:w-auto">
            <button
              onClick={() => { setActiveTab('Quotations'); setSearchQuery(''); }}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all ${
                activeTab === 'Quotations'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <FileText className="w-4 h-4" />
                Quotations (Sales)
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('LPOs'); setSearchQuery(''); }}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all ${
                activeTab === 'LPOs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <ClipboardList className="w-4 h-4" />
                Local Purchase Orders (LPO)
              </div>
            </button>
          </div>

          {/* Search bar & status filter combo */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto md:flex-1 justify-end">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search number, client, desc..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Issued">Issued</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Documents Table Grid */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Doc Number</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{activeTab === 'Quotations' ? 'Client / Company' : 'Supplier Name'}</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Subject / Work Scope</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Value (AED)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Payment Info</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                    No documents created by engineers found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((docItem) => {
                  const amtPaid = docItem.amountPaid || 0;
                  const balDue = docItem.balanceDue || 0;
                  const total = docItem.totalAmount;
                  
                  let payStatusLabel = 'No Payment';
                  let payColor = 'bg-slate-100 text-slate-600';
                  if (amtPaid > 0) {
                    if (balDue <= 0) {
                      payStatusLabel = 'Fully Received';
                      payColor = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    } else {
                      payStatusLabel = 'Partially Paid';
                      payColor = 'bg-amber-50 text-amber-700 border border-amber-100';
                    }
                  }

                  return (
                    <tr key={docItem.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-1 rounded">
                          {docItem.docNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                        {docItem.date.split('-').reverse().join('/')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${docItem.type === 'Quotation' ? 'bg-blue-500' : 'bg-slate-900'}`} />
                          <span className="text-xs font-black text-slate-900 line-clamp-1">
                            {docItem.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600 max-w-xs">
                        <div className="line-clamp-1">{docItem.subject}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                        {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          docItem.status === 'Approved' || docItem.status === 'Issued'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : docItem.status === 'Rejected' || docItem.status === 'Cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                        }`}>
                          {docItem.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${payColor}`}>
                            {payStatusLabel}
                          </span>
                          {amtPaid > 0 && (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Paid: {amtPaid.toLocaleString()} / Bal: {balDue.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadPDF(docItem)}
                            title="Download Clean PDF Draft (for original letterhead print)"
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            <Download className="w-4.5 h-4.5" />
                          </button>

                          {canManage && (
                            <>
                              {/* Payment register */}
                              <button
                                onClick={() => {
                                  setShowPaymentModal(docItem);
                                  setPaymentForm({
                                    date: new Date().toISOString().split('T')[0],
                                    amount: docItem.balanceDue.toString(),
                                    mode: 'Bank Transfer',
                                    reference: '',
                                    notes: ''
                                  });
                                }}
                                title="Add Payment Follow-up Log"
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-700 text-[11px] font-black transition-colors flex items-center gap-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Payment
                              </button>

                              {/* Approvals for Accountants/Admins */}
                              {(!isAccountant && docItem.status === 'Pending') && (
                                <button
                                  onClick={() => handleToggleDocStatus(docItem, 'Approved')}
                                  title="Approve Document"
                                  className="p-2 hover:bg-emerald-50 rounded-xl text-emerald-600 transition-colors"
                                >
                                  <CheckCircle className="w-4.5 h-4.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleEditClick(docItem)}
                                title="Edit Document details"
                                className="p-2 hover:bg-slate-100 rounded-xl text-indigo-600 transition-colors"
                              >
                                <Edit className="w-4.5 h-4.5" />
                              </button>

                              <button
                                onClick={() => {
                                  openConfirm("Delete Document", `Are you sure you want to delete ${docItem.type} ${docItem.docNumber}? This cannot be undone.`, async () => {
                                    await onDeleteDocument(docItem.id);
                                  });
                                }}
                                title="Delete Document"
                                className="p-2 hover:bg-rose-50 rounded-xl text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </>
                          )}
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

      {/* --- DOUMENT MODAL (Quotation/LPO Form) --- */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-100 my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {editingDoc ? `Edit ${formData.type}` : `Prepare New ${formData.type}`}
                </h3>
                <p className="text-slate-500 text-xs font-semibold mt-0.5">Define your items list & special contract terms</p>
              </div>
              <button onClick={() => setShowDocModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Document Type</label>
                  <select
                    disabled={editingDoc !== null}
                    value={formData.type}
                    onChange={(e) => {
                      const selectedType = e.target.value as 'Quotation' | 'LPO';
                      setFormData({ ...formData, type: selectedType, companyName: '', companyId: '', supplierId: '' });
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60"
                  >
                    <option value="Quotation">Quotation (addressed to Client)</option>
                    <option value="LPO">Local Purchase Order (LPO - to Supplier)</option>
                  </select>
                </div>

                {/* Doc ID Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Document Reference Number</label>
                  <input
                    type="text"
                    required
                    value={formData.docNumber}
                    onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                    placeholder="e.g. PGC-QTN-2026-0001"
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Document Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Company / Supplier Select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.type === 'Quotation' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Company (Receiving Quotation)</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.companyId}
                        onChange={(e) => {
                          const matched = vendors.find(v => v.id === e.target.value);
                          if (matched) {
                            setFormData({ ...formData, companyId: matched.id, companyName: matched.name });
                          } else {
                            setFormData({ ...formData, companyId: '', companyName: '' });
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Choose Existing Client --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Or type custom client name..."
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value, companyId: '' })}
                        className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Supplier / Vendor (Receiving LPO)</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.supplierId}
                        onChange={(e) => {
                          const matched = suppliers.find(s => s.id === e.target.value);
                          if (matched) {
                            setFormData({ ...formData, supplierId: matched.id, companyName: matched.name });
                          } else {
                            setFormData({ ...formData, supplierId: '', companyName: '' });
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Choose Existing Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Or type custom supplier name..."
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value, supplierId: '' })}
                        className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Subject of Work */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject / Work Description</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Civil Maintenance at Airport, Supply of Ready-Mix concrete"
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Items Table Form */}
              <div className="space-y-4 border-t border-b border-rose-50/50 py-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Document Line Items</h4>
                  <button
                    type="button"
                    onClick={addFormItem}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-black transition-all flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add line
                  </button>
                </div>

                <div className="space-y-3">
                  {formItems.map((item, idx) => (
                    <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-slate-50/50 p-4 rounded-xl">
                      <div className="flex-1 w-full space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden">Item Title</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => updateFormItem(idx, 'name', e.target.value)}
                          placeholder="e.g. Supply & Installation of Interlocks"
                          className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex-[2] w-full space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden">Detailed Specifications</label>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateFormItem(idx, 'description', e.target.value)}
                          placeholder="Specification, Brand, Dimensions details"
                          className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-20 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden">Quantity</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateFormItem(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-28 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden">Unit Rate (AED)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.rate || ''}
                          onChange={(e) => updateFormItem(idx, 'rate', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg text-xs font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-28 text-right font-black text-slate-900 text-xs px-2">
                        {item.total.toLocaleString()} AED
                      </div>

                      <button
                        type="button"
                        disabled={formItems.length === 1}
                        onClick={() => removeFormItem(item.id)}
                        className="p-2 hover:bg-rose-50 rounded-lg text-rose-500 disabled:opacity-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Sub Total Summaries */}
                <div className="bg-slate-50 p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                  <div className="text-xs text-slate-500 font-medium">Auto-calculating VAT (5%) for UAE compliant invoicing</div>
                  <div className="w-full md:w-80 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Sub-Total (Excl. VAT)</span>
                      <span>AED {draftFormCalculations.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>5% UAE VAT Amount</span>
                      <span>AED {draftFormCalculations.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-slate-200 my-2 pt-2 flex justify-between text-base font-black text-indigo-700">
                      <span>Net Total Amount</span>
                      <span>AED {draftFormCalculations.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Terms & Conditions</label>
                  <textarea
                    rows={4}
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    placeholder="Enter payment, delivery, warranty conditions..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal Reference Notes</label>
                  <textarea
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    placeholder="E.g. Approved by client coordinator Saif, pending structural drawings..."
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save {formData.type}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PAYMENT REGISTER MODAL --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Register Payment received</h3>
                <p className="text-slate-500 text-xs font-semibold mt-0.5">Reference: {showPaymentModal.docNumber}</p>
              </div>
              <button onClick={() => setShowPaymentModal(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount Received (AED)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={showPaymentModal.balanceDue}
                  placeholder={`Max outstanding: ${showPaymentModal.balanceDue}`}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Method</label>
                <select
                  value={paymentForm.mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  <option value="Cash">Cash payment</option>
                  <option value="Bank Transfer">Bank Transfer / Online wiring</option>
                  <option value="Cheque">Corporate Cheque</option>
                  <option value="Deposit">Direct ATM / Bank Deposit</option>
                  <option value="Other">Other Mode</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ref / Cheque / Tx Number</label>
                <input
                  type="text"
                  placeholder="Optional reference number"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Internal notes</label>
                <input
                  type="text"
                  placeholder="Memo / Particulars"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all"
                >
                  Register Received
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
