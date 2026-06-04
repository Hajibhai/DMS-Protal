import React, { useState, useMemo } from 'react';
import { 
  FileText, HardHat, Plus, Search, Trash2, Edit, Download, CheckCircle, 
  X, Save, AlertCircle, TrendingUp, TrendingDown, ClipboardList, PlusCircle,
  Truck, Building2, HelpCircle, Briefcase, DollarSign, ArrowUpRight, Scale
} from 'lucide-react';
import { Company, Supplier, Project, Vendor, EngineerDocument, DocumentItem, DocumentPayment, UserRole, CorporateBankAccount } from '../types';
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
  bankAccounts?: CorporateBankAccount[];
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
  openConfirm,
  bankAccounts = []
}) => {
  const [activeTab, setActiveTab] = useState<'Quotations' | 'LPOs'>('Quotations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Issued' | 'Cancelled'>('All');

  // Modal states
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EngineerDocument | null>(null);
  const [useCustomClient, setUseCustomClient] = useState(false);
  const [useCustomSupplier, setUseCustomSupplier] = useState(false);
  
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
    attention: '',
    designation: '',
    email: '',
    contact: '',
    contactT: '',
    address: '',
    yourRef: '',
    ourRef: '',
    mobilizationValue: 100000,
    constructionValue: 0,
    scopeOfWork: 'As per attached BOQ',
    offerValidity: '30 days from this date, there after subject to our written confirmation',
    timeSchedule: 'Project mobilization will be as per client advice from letter of award',
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
      terms: formData.terms,
      attention: formData.type === 'Quotation' ? formData.attention : undefined,
      designation: formData.type === 'Quotation' ? formData.designation : undefined,
      email: formData.type === 'Quotation' ? formData.email : undefined,
      contact: formData.type === 'Quotation' ? formData.contact : undefined,
      contactT: formData.type === 'Quotation' ? formData.contactT : undefined,
      address: formData.type === 'Quotation' ? formData.address : undefined,
      yourRef: formData.type === 'Quotation' ? formData.yourRef : undefined,
      ourRef: formData.type === 'Quotation' ? formData.ourRef : undefined,
      mobilizationValue: formData.type === 'Quotation' ? Number(formData.mobilizationValue) || 0 : undefined,
      constructionValue: formData.type === 'Quotation' ? (Number(formData.constructionValue) > 0 ? Number(formData.constructionValue) : totalAmount) : undefined,
      scopeOfWork: formData.type === 'Quotation' ? formData.scopeOfWork : undefined,
      offerValidity: formData.type === 'Quotation' ? formData.offerValidity : undefined,
      timeSchedule: formData.type === 'Quotation' ? formData.timeSchedule : undefined,
    };

    await onSaveDocument(docData);
    setShowDocModal(false);
    setEditingDoc(null);
  };

  // Open Edit Form
  const handleEditClick = (doc: EngineerDocument) => {
    setEditingDoc(doc);
    setUseCustomClient(doc.type === 'Quotation' && !doc.companyId);
    setUseCustomSupplier(doc.type === 'LPO' && !doc.supplierId);
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
      attention: doc.attention || '',
      designation: doc.designation || '',
      email: doc.email || '',
      contact: doc.contact || '',
      contactT: doc.contactT || '',
      address: doc.address || '',
      yourRef: doc.yourRef || '',
      ourRef: doc.ourRef || doc.docNumber || '',
      mobilizationValue: doc.mobilizationValue !== undefined ? doc.mobilizationValue : 100000,
      constructionValue: doc.constructionValue !== undefined ? doc.constructionValue : 0,
      scopeOfWork: doc.scopeOfWork || 'As per attached BOQ',
      offerValidity: doc.offerValidity || '30 days from this date, there after subject to our written confirmation',
      timeSchedule: doc.timeSchedule || 'Project mobilization will be as per client advice from letter of award',
    });
    setFormItems(doc.items && doc.items.length > 0 ? [...doc.items] : [{ id: '1', name: '', description: '', quantity: 1, rate: 0, total: 0 }]);
    setShowDocModal(true);
  };

  // Open Create Form
  const handleCreateClick = (type: 'Quotation' | 'LPO') => {
    setEditingDoc(null);
    setUseCustomClient(false);
    setUseCustomSupplier(false);
    const genNumber = `${type === 'Quotation' ? 'PGC-Q' : 'PGC-LPO'}-${new Date().getFullYear().toString().substring(2)}${Math.floor(10 + Math.random() * 90)}`; // matching PGC-Q-26010 style
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
      attention: 'Project Manager',
      designation: 'Representative',
      email: '',
      contact: '',
      contactT: '|',
      address: '',
      yourRef: '',
      ourRef: genNumber,
      mobilizationValue: 100000,
      constructionValue: 0,
      scopeOfWork: 'As per attached BOQ',
      offerValidity: '30 days from this date, there after subject to our written confirmation',
      timeSchedule: 'Project mobilization will be as per client advice from letter of award',
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

  // PDF Generator for Blank Original Letterhead Print and customized Professional Corporate layouts
  const handleDownloadPDF = (docItem: EngineerDocument) => {
    try {
      const defaultBank = (bankAccounts || []).find(b => b.isDefault) || (bankAccounts || [])[0] || {
        accountName: "Pioneer General Contracting LLC",
        bankName: "Abu Dhabi Commercial Bank",
        accountNumber: "11249315820001",
        iban: "AE190030011249315820001",
        swiftCode: "ADCBAEAA",
        currency: "AED"
      };

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Joint Header Details for Pioneer General Contracting LLC brand identity
      const drawHeader = (pageNumber: number) => {
        // 1. Draw stylized Logo Icon (Blue circle with white stylized 'P')
        doc.setFillColor(30, 58, 138); // Dark Blue
        doc.circle(20, 18, 6, 'F');
        
        // Draw white 'P' stroke inside the blue circle
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.2);
        doc.line(17.5, 14.5, 17.5, 21.5);
        doc.line(17.5, 14.5, 20.5, 14.5);
        doc.line(17.5, 18.0, 20.5, 18.0);
        // Curve arc for P
        doc.ellipse(20.5, 16.25, 1.8, 1.75, 'D');

        // 2. Main Title Text "PIONEER GENERAL CONTRACTING L.L.C."
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(153, 27, 27); // Deep Crimson Red
        doc.text("PIONEER GENERAL CONTRACTING L.L.C.", 30, 16.5);

        // Document Reference at Top Right
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 58, 138); // Dark Blue
        doc.text(docItem.docNumber, 195 - doc.getTextWidth(docItem.docNumber), 15);

        // Sub-heading details
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text("CIVIL, ELECTRICAL & MECHANICAL WORKS | ROAD & INFRASTRUCTURE SITE UTILITIES", 30, 20.5);

        // ISO badging
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text("ISO 9001, ISO 14001, ISO 45001 CERTIFIED", 195 - doc.getTextWidth("ISO 9001, ISO 14001, ISO 45001 CERTIFIED"), 20.5);

        // Thin decorative colored line
        doc.setDrawColor(30, 58, 138); // Blue
        doc.setLineWidth(0.6);
        doc.line(15, 23, 195, 23);

        doc.setDrawColor(217, 119, 6); // Gold line
        doc.setLineWidth(0.3);
        doc.line(15, 23.8, 195, 23.8);
      };

      // Joint Footer details
      const drawFooter = (pageNumber: number, totalPages: number) => {
        // Divider line
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(15, 278, 195, 278);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);

        // Standard corporate address on left
        doc.text("P.O. Box # 92986, Abu Dhabi, (UAE)  |  Tel: +971 2 677 8396  |  Mob: +971 56 227 4730", 15, 282.5);
        doc.text("Email: info@pioneersgcllc.com  |  pioneersgcllc@gmail.com  |  Web: www.pioneersgcllc.com", 15, 286);

        // Page numbers
        const pageText = `Page ${pageNumber} of ${totalPages}`;
        doc.text(pageText, 195 - doc.getTextWidth(pageText), 282.5);
      };

      // Royal Blue Concentric Stamp drawer
      const drawStampAndSignature = (x: number, y: number) => {
        // Circle Boundaries
        doc.setDrawColor(29, 78, 216); // Royal Blue
        doc.setLineWidth(0.5);
        doc.circle(x, y, 16, 'D');
        doc.circle(x, y, 15.2, 'D');

        // Circular styled labels
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(4.5);
        doc.setTextColor(29, 78, 216);
        
        doc.text("PIONEER GENERAL CONTRACTING L.L.C.", x - 13.5, y - 4);
        
        // Center text label
        doc.setFontSize(6);
        doc.text("★ APPROVED ★", x - 7.5, y + 1.2);

        // Lower label
        doc.setFontSize(4.5);
        doc.text("ABU DHABI - U.A.E.", x - 8, y + 6);

        // executive pen flourish
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.45);
        doc.line(x - 11, y - 0.5, x + 11, y - 3.5);
        doc.line(x - 7, y + 2, x + 7, y - 1.5);
      };

      // Check if it's a Professional complex 3-page custom-layout corporate Quotation
      if (docItem.type === 'Quotation') {
        const totalPages = 3;

        // ================= PAGE 1 =================
        drawHeader(1);
        
        // Title Banner "QUOTATION SHEET"
        doc.setFillColor(30, 58, 138); // Dark blue header block
        doc.rect(15, 30, 180, 7.5, 'F');
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(255, 255, 255);
        doc.text("PIONEER QUOTATION WORKS SHEET / CLIENT DATA", 20, 35);

        // Draw grid boundaries for client info
        doc.setDrawColor(148, 163, 184); // Slate-400
        doc.setLineWidth(0.2);

        const cellH = 8.2;
        const rY1 = 37.5;
        
        // Row 1
        doc.rect(15, rY1, 30, cellH, 'D');
        doc.rect(45, rY1, 65, cellH, 'D');
        doc.rect(110, rY1, 25, cellH, 'D');
        doc.rect(135, rY1, 60, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text("Client", 18, rY1 + 5.2);
        doc.text("Date", 113, rY1 + 5.2);

        doc.setFont("Helvetica", "normal");
        doc.text(docItem.companyName, 48, rY1 + 5.2);
        doc.text(docItem.date.split('-').reverse().join('/'), 138, rY1 + 5.2);

        // Row 2
        const rY2 = rY1 + cellH;
        doc.rect(15, rY2, 30, cellH, 'D');
        doc.rect(45, rY2, 65, cellH, 'D');
        doc.rect(110, rY2, 25, cellH, 'D');
        doc.rect(135, rY2, 60, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.text("Attention", 18, rY2 + 5.2);
        doc.text("Your Ref", 113, rY2 + 5.2);

        doc.setFont("Helvetica", "normal");
        doc.text(docItem.attention || "Project Manager", 48, rY2 + 5.2);
        doc.text(docItem.yourRef || "N/A", 138, rY2 + 5.2);

        // Row 3
        const rY3 = rY2 + cellH;
        doc.rect(15, rY3, 30, cellH, 'D');
        doc.rect(45, rY3, 65, cellH, 'D');
        doc.rect(110, rY3, 25, cellH, 'D');
        doc.rect(135, rY3, 60, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.text("Designation", 18, rY3 + 5.2);
        doc.text("Our Ref", 113, rY3 + 5.2);

        doc.setFont("Helvetica", "normal");
        doc.text(docItem.designation || "Representative", 48, rY3 + 5.2);
        doc.text(docItem.ourRef || docItem.docNumber, 138, rY3 + 5.2);

        // Row 4
        const rY4 = rY3 + cellH;
        doc.rect(15, rY4, 30, cellH, 'D');
        doc.rect(45, rY4, 150, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.text("Email", 18, rY4 + 5.2);
        doc.setFont("Helvetica", "normal");
        doc.text(docItem.email || "N/A", 48, rY4 + 5.2);

        // Row 5
        const rY5 = rY4 + cellH;
        doc.rect(15, rY5, 30, cellH, 'D');
        doc.rect(45, rY5, 150, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.text("Contact", 18, rY5 + 5.2);
        doc.setFont("Helvetica", "normal");
        const contactCombined = docItem.contact && docItem.contactT && docItem.contactT !== '|'
          ? `${docItem.contact}  |  Telephone: ${docItem.contactT}`
          : (docItem.contact || docItem.contactT || "N/A");
        doc.text(contactCombined, 48, rY5 + 5.2);

        // Row 6
        const rY6 = rY5 + cellH;
        doc.rect(15, rY6, 30, cellH, 'D');
        doc.rect(45, rY6, 150, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.text("Address", 18, rY6 + 5.2);
        doc.setFont("Helvetica", "normal");
        doc.text(docItem.address || "Abu Dhabi, UAE", 48, rY6 + 5.2);

        // Row 7
        const rY7 = rY6 + cellH;
        doc.rect(15, rY7, 30, cellH, 'D');
        doc.rect(45, rY7, 150, cellH, 'D');

        doc.setFont("Helvetica", "bold");
        doc.text("Subject", 18, rY7 + 5.2);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(15, 23, 42); // Bold subject
        doc.text(docItem.subject.toUpperCase(), 48, rY7 + 5.2);

        // Respectful Letter Body
        let quoteY = rY7 + cellH + 10;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text("Respected Sir,", 15, quoteY);

        quoteY += 5;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);

        const p1 = "Reference to your inquiry, we would like to offer our best technical and commercial proposal for your kind review and considerations.";
        const p2 = "We hope our offer will meet your engineering, structural, and commercial expectations. In case of any modifications in the bill of materials, we are ready to submit a revised quotation fully accommodating your objectives.";
        const p3 = "We remain open for any technical discussion, site inspection clarifications, or commercial questions. Feel free to contact our technical coordinators at any time. We are deeply grateful to you for giving us this opportunity to serve you.";
        const p4 = "Looking forward to receiving your valuable official work order / letter of commitment.";

        const splitP1 = doc.splitTextToSize(p1, 180);
        doc.text(splitP1, 15, quoteY);
        quoteY += splitP1.length * 4.5 + 3.5;

        const splitP2 = doc.splitTextToSize(p2, 180);
        doc.text(splitP2, 15, quoteY);
        quoteY += splitP2.length * 4.5 + 3.5;

        const splitP3 = doc.splitTextToSize(p3, 180);
        doc.text(splitP3, 15, quoteY);
        quoteY += splitP3.length * 4.5 + 3.5;

        const splitP4 = doc.splitTextToSize(p4, 180);
        doc.text(splitP4, 15, quoteY);
        quoteY += splitP4.length * 4.5 + 6;

        // Executive sign off
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Warm Regards,", 15, quoteY);
        quoteY += 5;

        doc.setFont("Helvetica", "bold");
        doc.setTextColor(153, 27, 27); // Brand Crimson Name
        doc.text("Muhammad Imtiaz Naeem", 15, quoteY);
        
        quoteY += 4.5;
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Managing Director", 15, quoteY);

        // draw stamp and simulated physical signature right beside the name
        drawStampAndSignature(155, quoteY - 2);

        // Draw page footer
        drawFooter(1, totalPages);

        // ================= PAGE 2 =================
        doc.addPage();
        drawHeader(2);

        // Commercial summary banner
        doc.setFillColor(30, 58, 138); // Dark blue header block
        doc.rect(15, 30, 180, 7.5, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("A. PROJECT COMMERCIAL PRICE SUMMARY", 20, 35);

        let sumY = 41;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);

        // Table Header summary
        doc.setFillColor(241, 245, 249);
        doc.rect(15, sumY, 180, 8, 'F');
        doc.rect(15, sumY, 180, 8, 'D');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text("S.No", 18, sumY + 5.2);
        doc.text("Price Breakdown Headings", 40, sumY + 5.2);
        doc.text("Total Value (AED)", 190 - doc.getTextWidth("Total Value (AED)"), sumY + 5.2);
        
        sumY += 8;

        const mobVal = docItem.mobilizationValue !== undefined ? docItem.mobilizationValue : 100000;
        const boqVal = docItem.constructionValue !== undefined && docItem.constructionValue > 0 ? docItem.constructionValue : docItem.subTotal;
        const grandTotalVal = mobVal + boqVal;

        const drawSumRow = (sNo: string, desc: string, val: number, isGrand: boolean = false) => {
          doc.rect(15, sumY, 180, 8.5, 'D');
          doc.setFont("Helvetica", isGrand ? "bold" : "normal");
          doc.setFontSize(8);
          doc.text(sNo, 18, sumY + 5.5);
          doc.text(desc, 40, sumY + 5.5);
          
          doc.setFont("Helvetica", "bold");
          const formattedVal = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(formattedVal, 190 - doc.getTextWidth(formattedVal) - 3, sumY + 5.5);
          sumY += 8.5;
        };

        drawSumRow("1", "Mobilization & Demobilization Lump-Sum Value", mobVal);
        drawSumRow("2", `Civil Construction & MEP Works (Detailed Under Attached BOQ Schedule)`, boqVal);
        drawSumRow("-", "Sub-Total Project Commercial Value (Excl. VAT)", mobVal + boqVal);
        drawSumRow("-", "5% UAE compliant Value Added Tax (VAT) Amount", (mobVal + boqVal) * 0.05);
        drawSumRow("", "NET CONSTRUCTON VALUE CARRIED OVER (INCL. VAT)", (mobVal + boqVal) * 1.05, true);

        // Contractual Terms & Conditions Section on Page 2
        sumY += 5;
        doc.setFillColor(30, 58, 138); // Dark blue header block
        doc.rect(15, sumY, 180, 7.5, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("B. CONTRACTUAL TERMS & CONDITIONS", 20, sumY + 5);
        
        sumY += 7.5 + 5;

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(153, 27, 27); // Crimson Headers
        doc.text("1.0 GENERAL SCOPE FRAMEWORK", 15, sumY);
        sumY += 4;
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const generalBullets = [
          "- All commercial evaluations, rates and payments are scheduled in UAE National Dirhams (AED).",
          "- This submittal forms a Solid LUMP SUM package based strictly on provided civil project drafts.",
          "- Standard corporate overheads, profit margins & operations risk are distributed proportionally across all lines."
        ];
        generalBullets.forEach(b => {
          doc.text(b, 17, sumY);
          sumY += 3.8;
        });

        sumY += 2;
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(153, 27, 27);
        doc.text("2.0 CORPORATE DELIVERABLES & SAFETY", 15, sumY);
        sumY += 4;

        doc.setFont("Helvetica", "normal");
        const inclusionBullets = [
          "- Pioneer General Contracting LLC provides 100% field engineers, workforce, machinery and scaffolding.",
          "- Site setup, HSE compliance safety barriers, first-aid, & custom protective PPEs are integrated."
        ];
        inclusionBullets.forEach(b => {
          doc.text(b, 17, sumY);
          sumY += 3.8;
        });

        sumY += 2;
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(153, 27, 27);
        doc.text("3.0 CIVIL EXCLUSIONS & CLIENT RESPONSIBILITIES", 15, sumY);
        sumY += 4;

        doc.setFont("Helvetica", "normal");
        const exclusionBullets = [
          "- Specialized structural testing, engineering redesign audits, or advanced third-party soil calculations.",
          "- Provision of on-site clean structural drinking/construction water point & dedicated power panels.",
          "- Municipality fees, military clearance permit fees, or custom industrial security gate passes of the workforce.",
          "- Any materials delays or access restrictions due to Client administrative processes won't compromise PGC scheduling."
        ];
        exclusionBullets.forEach(b => {
          doc.text(b, 17, sumY);
          sumY += 3.8;
        });

        sumY += 2;
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(153, 27, 27);
        doc.text("4.0 INVOICING STREAMS & SECURITIES", 15, sumY);
        sumY += 4;

        doc.setFont("Helvetica", "normal");
        const paymentBullets = [
          "- Mobilization sum (AED 100,000) shall reflect clear accounts prior to site workforce initialization.",
          "- Progressive civil construction invoices shall be verified in 15 days of post-dated cheque submission.",
          "- 5% standard United Arab Emirates statutory VAT shall be added across overall sequential invoicing loops."
        ];
        paymentBullets.forEach(b => {
          doc.text(b, 17, sumY);
          sumY += 3.8;
        });

        sumY += 2;
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(153, 27, 27);
        doc.text("5.0 CORPORATE WIRE TRANSFER DETAILS", 15, sumY);
        sumY += 4;

        doc.setFont("Helvetica", "normal");
        const bankBullets = [
          `Beneficiary Name: ${defaultBank.accountName}`,
          `Bank Name: ${defaultBank.bankName}`,
          `Account Number: ${defaultBank.accountNumber}`,
          `IBAN (UAE Central Bank Compliant): ${defaultBank.iban}`,
          `Swift Bic Code: ${defaultBank.swiftCode} (Currency: ${defaultBank.currency})`
        ];
        bankBullets.forEach(b => {
          doc.text("- " + b, 17, sumY);
          sumY += 3.8;
        });

        // Footnotes
        drawFooter(2, totalPages);

        // ================= PAGE 3 =================
        doc.addPage();
        drawHeader(3);

        // Time schedule banner
        doc.setFillColor(30, 58, 138);
        doc.rect(15, 30, 180, 7.5, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("C. TIME MOBILIZATION & TIMELINE METRICS", 20, 35);

        let schedY = 42;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        const schText = docItem.timeSchedule || "Project mobilization will start within 7 calendar days of receiving the official Letter of Award (LOA) or payment of mobilization value. Standard project completion timeline is subject to mutual agreement of scheduling phases.";
        const splitSch = doc.splitTextToSize(schText, 170);
        
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, schedY, 180, splitSch.length * 4.5 + 5, 'FD');
        doc.text(splitSch, 20, schedY + 5);
        
        schedY += splitSch.length * 4.5 + 12;

        // Itemized BOQ scheduler sub-block
        doc.setFillColor(30, 58, 138);
        doc.rect(15, schedY, 180, 7, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("D. TECHNICAL BOQ LINE ITEMS SCHEDULE OF WORK", 20, schedY + 4.8);

        schedY += 7 + 3;

        const tableX = 15;
        const colWidths = [12, 95, 18, 25, 30]; // 180 total width
        const headers = ["S.No", "Description of Civil Activity & Specifications", "Qty", "Rate (AED)", "Total (AED)"];

        doc.setFillColor(241, 245, 249);
        doc.rect(tableX, schedY, 180, 7.5, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(tableX, schedY, 180, 7.5, 'D');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        let colX = tableX;
        headers.forEach((hdr, idx) => {
          const align = idx >= 2 ? 'right' : 'left';
          const tx = align === 'right' ? colX + colWidths[idx] - 3 : colX + 3;
          doc.text(hdr, tx, schedY + 5, { align });
          colX += colWidths[idx];
        });

        schedY += 7.5;

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        docItem.items.forEach((item, index) => {
          const itemsText = item.description ? `${item.name} - ${item.description}` : item.name;
          const wrappedDesc = doc.splitTextToSize(itemsText, colWidths[1] - 6);
          const cellHeight = Math.max(7, wrappedDesc.length * 3.8 + 2);

          doc.rect(tableX, schedY, 180, cellHeight, 'D');
          doc.text((index + 1).toString(), tableX + 3, schedY + 4.5);
          doc.text(wrappedDesc, tableX + colWidths[0] + 3, schedY + 4.5);

          // Qty
          doc.text(item.quantity.toString(), tableX + colWidths[0] + colWidths[1] + colWidths[2] - 3, schedY + 4.5, { align: 'right' });
          // Rate
          const rateStr = item.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(rateStr, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 3, schedY + 4.5, { align: 'right' });
          // Total
          const totalStr = (item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(totalStr, tableX + 180 - 3, schedY + 4.5, { align: 'right' });

          schedY += cellHeight;
        });

        // Net sums row on page 3
        doc.setFillColor(248, 250, 252);
        doc.rect(tableX, schedY, 180, 7.5, 'FD');
        doc.setFont("Helvetica", "bold");
        doc.text("Total Construction BOQ Work Value (AED)", tableX + colWidths[0] + colWidths[1] + 3, schedY + 5);
        const boqSumStr = docItem.subTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AED";
        doc.text(boqSumStr, tableX + 180 - 3, schedY + 5, { align: 'right' });

        schedY += 15;

        // Client authorization signatures
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);

        doc.text("Approved for Pioneer General Contracting LLC:", 15, schedY);
        doc.text("Accepted & Confirmed by Client Representative:", 110, schedY);

        schedY += 15;
        doc.setLineWidth(0.2);
        doc.line(15, schedY, 75, schedY);
        doc.line(110, schedY, 180, schedY);

        schedY += 4;
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Signature, Stamp & Authorization Date", 15, schedY);
        doc.text("Client Seal, Date & Name", 110, schedY);

        // Stamp and signature physical location
        drawStampAndSignature(55, schedY - 14);

        // Page 3 footer
        drawFooter(3, totalPages);
      } else {
        // Fallback LPO layout - Beautiful 1 Page Professional Letterhead Summary Sheet
        drawHeader(1);

        doc.setFillColor(30, 58, 138); // Dark blue header block
        doc.rect(15, 30, 180, 7.5, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("LOCAL PURCHASE ORDER (LPO)", 20, 35);

        let currY = 42;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`LPO REFERENCE NO: ${docItem.docNumber}`, 15, currY);

        const lpoDate = `DATE: ${docItem.date.split('-').reverse().join('/')}`;
        doc.text(lpoDate, 195 - doc.getTextWidth(lpoDate), currY);

        currY += 8;

        // Vendor details box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.rect(15, currY, 180, 14, 'FD');
        doc.setFont("Helvetica", "bold");
        doc.text("SUPPLIER / CONTRACT VENDEE:", 18, currY + 5);
        doc.setFont("Helvetica", "normal");
        doc.text(`Company Name: ${docItem.companyName}`, 18, currY + 9.5);
        
        currY += 18;

        // Subject Block
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`SUBJECT: SUPPLY / SUB-CONTRACT FOR ${docItem.subject.toUpperCase()}`, 15, currY);
        doc.line(15, currY + 1.2, 15 + doc.getTextWidth(`SUBJECT: SUPPLY / SUB-CONTRACT FOR ${docItem.subject.toUpperCase()}`), currY + 1.2);

        currY += 8;

        // Items Grid
        const tableX = 15;
        const colWidths = [12, 95, 18, 25, 30]; // 180 total width
        const headers = ["S.No", "Description / Details of Order", "Qty", "Rate (AED)", "Total (AED)"];

        doc.setFillColor(241, 245, 249);
        doc.rect(tableX, currY, 180, 7.5, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(tableX, currY, 180, 7.5, 'D');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        let colX = tableX;
        headers.forEach((hdr, idx) => {
          const align = idx >= 2 ? 'right' : 'left';
          const tx = align === 'right' ? colX + colWidths[idx] - 3 : colX + 3;
          doc.text(hdr, tx, currY + 5, { align });
          colX += colWidths[idx];
        });

        currY += 7.5;

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        docItem.items.forEach((item, index) => {
          const itemsText = item.description ? `${item.name} - ${item.description}` : item.name;
          const wrappedDesc = doc.splitTextToSize(itemsText, colWidths[1] - 6);
          const cellHeight = Math.max(7, wrappedDesc.length * 3.8 + 2);

          doc.rect(tableX, currY, 180, cellHeight, 'D');
          doc.text((index + 1).toString(), tableX + 3, currY + 4.5);
          doc.text(wrappedDesc, tableX + colWidths[0] + 3, currY + 4.5);

          // Qty
          doc.text(item.quantity.toString(), tableX + colWidths[0] + colWidths[1] + colWidths[2] - 3, currY + 4.5, { align: 'right' });
          // Rate
          const rateStr = item.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(rateStr, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 3, currY + 4.5, { align: 'right' });
          // Total
          const totalStr = (item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(totalStr, tableX + 180 - 3, currY + 4.5, { align: 'right' });

          currY += cellHeight;
        });

        // Totals rows for LPO
        const drawLpoTotalRow = (label: string, val: number, isFinal: boolean = false) => {
          doc.rect(tableX, currY, 180, 7.5, 'D');
          doc.setFont("Helvetica", isFinal ? "bold" : "normal");
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);

          doc.text(label, tableX + colWidths[0] + colWidths[1] + 3, currY + 5);
          
          doc.setFont("Helvetica", "bold");
          const valStr = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AED";
          doc.text(valStr, tableX + 180 - 3, currY + 5, { align: 'right' });
          
          currY += 7.5;
        };

        drawLpoTotalRow("Sub-Total (Excl. VAT)", docItem.subTotal);
        drawLpoTotalRow("5% UAE Value Added Tax Amount", docItem.vatAmount);
        drawLpoTotalRow("Net Procurement Value", docItem.totalAmount, true);

        // Words section
        currY += 5;
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Amount in Words: ${numberToWords(docItem.totalAmount)}`, 15, currY);

        currY += 8;

        // Terms Excerpt
        if (docItem.terms) {
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text("Notes, Inclusions and Special Instructions:", 15, currY);
          currY += 4;

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7);
          const splitTerms = doc.splitTextToSize(docItem.terms, 180);
          doc.text(splitTerms, 15, currY);
          currY += splitTerms.length * 3.5 + 8;
        }

        // Exec Sign Off for LPO
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);

        doc.text("For Pioneer General Contracting LLC:", 15, currY);
        doc.text("Supplier Acceptance / Acknowledged By:", 110, currY);

        currY += 14;
        doc.setLineWidth(0.2);
        doc.line(15, currY, 75, currY);
        doc.line(110, currY, 180, currY);

        currY += 4;
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("Signed Authority Stamp", 15, currY);
        doc.text("Supplier Acceptance Signature", 110, currY);

        // Stamp
        drawStampAndSignature(55, currY - 14);

        // LPO Footer
        drawFooter(1, 1);
      }

      // Trigger download
      doc.save(`${docItem.type}_${docItem.docNumber}.pdf`);
    } catch (err) {
      console.error("Error generating professional PDF details:", err);
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                {formData.type === 'Quotation' ? (
                  <div className="space-y-1.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Company (Receiving Quotation)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomClient(!useCustomClient);
                          setFormData({ ...formData, companyName: '', companyId: '' });
                        }}
                        className="text-[10px] font-extrabold text-indigo-650 hover:text-indigo-850 bg-indigo-50/70 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {useCustomClient ? "← Choose Registered Client" : "✍️ Type Custom Name"}
                      </button>
                    </div>
                    {useCustomClient ? (
                      <input
                        type="text"
                        placeholder="Type custom client company name..."
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value, companyId: '' })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                      />
                    ) : (
                      <select
                        required
                        value={formData.companyId}
                        onChange={(e) => {
                          const matched = vendors.find(v => v.id === e.target.value);
                          if (matched) {
                            setFormData({ ...formData, companyId: matched.id, companyName: matched.name });
                          } else {
                            setFormData({ ...formData, companyId: '', companyName: '' });
                          }
                        }}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Choose Existing Client --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Supplier / Vendor (Receiving LPO)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomSupplier(!useCustomSupplier);
                          setFormData({ ...formData, companyName: '', supplierId: '' });
                        }}
                        className="text-[10px] font-extrabold text-indigo-650 hover:text-indigo-850 bg-indigo-50/70 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {useCustomSupplier ? "← Choose Registered Supplier" : "✍️ Type Custom Name"}
                      </button>
                    </div>
                    {useCustomSupplier ? (
                      <input
                        type="text"
                        placeholder="Type custom supplier company name..."
                        required
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value, supplierId: '' })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                      />
                    ) : (
                      <select
                        required
                        value={formData.supplierId}
                        onChange={(e) => {
                          const matched = suppliers.find(s => s.id === e.target.value);
                          if (matched) {
                            setFormData({ ...formData, supplierId: matched.id, companyName: matched.name });
                          } else {
                            setFormData({ ...formData, supplierId: '', companyName: '' });
                          }
                        }}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Choose Existing Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Subject of Work */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 pb-1">Subject / Work Description</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Civil Maintenance at Airport, Supply of Ready-Mix concrete"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Professional Quotation Fields for Print Template */}
              {formData.type === 'Quotation' && (
                <div className="p-5 bg-gradient-to-r from-indigo-50/40 to-blue-50/30 rounded-2xl border border-indigo-100/60 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900">Quotation Print Form Details (Page 1)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Attention (Recipient Name)</label>
                      <input
                        type="text"
                        value={formData.attention}
                        onChange={(e) => setFormData({ ...formData, attention: e.target.value })}
                        placeholder="e.g. Project Manager"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Designation (Job Title)</label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        placeholder="e.g. Managing Director"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="e.g. client@example.com"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Your Ref (Inquiry Ref)</label>
                      <input
                        type="text"
                        value={formData.yourRef}
                        onChange={(e) => setFormData({ ...formData, yourRef: e.target.value })}
                        placeholder="e.g. Client Ref #"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Representative</label>
                      <input
                        type="text"
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        placeholder="e.g. Engr. John Smith"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Telephone / Mobile</label>
                      <input
                        type="text"
                        value={formData.contactT}
                        onChange={(e) => setFormData({ ...formData, contactT: e.target.value })}
                        placeholder="e.g. +971 50..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Postal / Site Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="e.g. PO Box 1234, Abu Dhabi, UAE"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100 my-2" />

                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900">Commercial Summary & validity (Page 2 & 3)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Mobilization & Demob (AED)</label>
                      <input
                        type="number"
                        value={formData.mobilizationValue || ''}
                        onChange={(e) => setFormData({ ...formData, mobilizationValue: Number(e.target.value) || 0 })}
                        placeholder="e.g. 100000"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Construction BOQ Value (AED)</label>
                      <input
                        type="number"
                        value={formData.constructionValue || ''}
                        onChange={(e) => setFormData({ ...formData, constructionValue: Number(e.target.value) || 0 })}
                        placeholder="If 0, uses Line Items Total"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Scope of Work</label>
                      <input
                        type="text"
                        value={formData.scopeOfWork}
                        onChange={(e) => setFormData({ ...formData, scopeOfWork: e.target.value })}
                        placeholder="e.g. As per attached BOQ"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Offer validity</label>
                      <input
                        type="text"
                        value={formData.offerValidity}
                        onChange={(e) => setFormData({ ...formData, offerValidity: e.target.value })}
                        placeholder="e.g. 30 days from date..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Time Schedule Mobilization</label>
                      <input
                        type="text"
                        value={formData.timeSchedule}
                        onChange={(e) => setFormData({ ...formData, timeSchedule: e.target.value })}
                        placeholder="e.g. Project mobilization will be as per..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Items Table Form */}
              <div className="space-y-4 border-t border-b border-rose-50/50 py-6">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Line Items</h4>
                  <button
                    type="button"
                    onClick={addFormItem}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow"
                  >
                    <PlusCircle className="w-4 h-4 text-white" />
                    Add line
                  </button>
                </div>

                {/* Desktop Grid Columns Header Row */}
                <div className="hidden sm:flex gap-4 px-4 py-2 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <div className="flex-1">Item Title / Category</div>
                  <div className="flex-[2]">Detailed Specifications & Dimensions</div>
                  <div className="w-20 text-center">Qty</div>
                  <div className="w-28 text-right">Unit Rate (AED)</div>
                  <div className="w-28 text-right">Total (AED)</div>
                  <div className="w-10"></div> {/* Delete placeholder */}
                </div>

                <div className="space-y-3">
                  {formItems.map((item, idx) => (
                    <div key={item.id} className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-slate-50/50 hover:bg-slate-50/85 p-4 sm:p-2 sm:px-4 rounded-xl border border-dashed border-slate-200/80 transition-all">
                      <div className="flex-1 w-full space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden uppercase tracking-wider">Item Title</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => updateFormItem(idx, 'name', e.target.value)}
                          placeholder="e.g. Supply & Installation of Interlocks"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex-[2] w-full space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden uppercase tracking-wider">Detailed Specifications</label>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateFormItem(idx, 'description', e.target.value)}
                          placeholder="Specification, Brand, Dimensions details"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-full sm:w-20 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden uppercase tracking-wider">Quantity</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateFormItem(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-full sm:w-28 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden uppercase tracking-wider">Unit Rate (AED)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.rate || ''}
                          onChange={(e) => updateFormItem(idx, 'rate', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-full sm:w-28 text-right font-black text-slate-900 text-xs px-2 py-1 sm:py-0">
                        <label className="text-[9px] font-black text-slate-400 block sm:hidden uppercase tracking-wider text-left mb-1">Total</label>
                        <span>{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} AED</span>
                      </div>

                      <div className="w-full sm:w-10 flex justify-end">
                        <button
                          type="button"
                          disabled={formItems.length === 1}
                          onClick={() => removeFormItem(item.id)}
                          className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-rose-400 disabled:opacity-30 transition-colors cursor-pointer"
                          title="Delete line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
