import React, { useState, useEffect } from 'react';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { JobApplicant, JobOffer, UserRole } from '../types';
import { jsPDF } from 'jspdf';
import { 
  Users, Mail, Phone, Shield, FileText, Download, Plus, Search, 
  Trash2, Edit, CheckCircle, XCircle, Calendar, DollarSign,
  ChevronRight, Sparkles, SlidersHorizontal, Info, Briefcase, FileCheck, Check
} from 'lucide-react';

interface JobOfferViewProps {
  user: any;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
}

export const JobOfferView: React.FC<JobOfferViewProps> = ({ user, openConfirm }) => {
  // Auth details
  const isAdminOrCreator = user?.role === UserRole.CREATOR || 
                           user?.role?.toLowerCase() === 'admin' || 
                           user?.role?.toLowerCase() === 'creator' ||
                           user?.email?.toLowerCase() === 'abdulkaderp3010@gmail.com';

  const canManage = user?.permissions?.canManageEmployees || isAdminOrCreator;

  // Active sub-tab inside Job Offer
  const [activeTab, setActiveTab] = useState<'applicants' | 'offers'>('applicants');

  // Firestore Data State
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal State
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<JobApplicant | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<JobOffer | null>(null);

  // Applicant Draft Form
  const [applicantForm, setApplicantForm] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    position: 'Cleaner',
    passportNumber: '',
    salaryExpectation: 0,
    notes: '',
    status: 'Applied' as JobApplicant['status']
  });

  // Job Offer Draft Form
  const [offerForm, setOfferForm] = useState({
    employeeName: '',
    position: 'Cleaner',
    salary: 3000,
    housingAllowance: 1000,
    transportAllowance: 500,
    otherAllowance: 500,
    passportNumber: '',
    mobileNumber: '',
    joiningDate: new Date().toISOString().split('T')[0],
    offerDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Offered' as JobOffer['status'],
    additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.',
    applicantId: ''
  });

  // Listeners for Firestore Data
  useEffect(() => {
    setLoading(true);
    // Subscribe to job applicants
    const unsubApplicants = onSnapshot(collection(db, 'job_applicants'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as JobApplicant));
      setApplicants(list);
    }, (error) => {
      console.error("Error listening to job_applicants:", error);
    });

    // Subscribe to job offers
    const unsubOffers = onSnapshot(collection(db, 'job_offers'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as JobOffer));
      setOffers(list);
    }, (error) => {
      console.error("Error listening to job_offers:", error);
    });

    setLoading(false);

    return () => {
      unsubApplicants();
      unsubOffers();
    };
  }, []);

  // Preset list of standard job designations to select from
  const designationsList = [
    'Helper', 'Cleaner', 'Supervisor', 'Admin', 'HR Officer', 
    'Accountant', 'Driver', 'Project Manager', 'Safety Officer', 
    'Mechanical Engineer', 'Electrical Engineer', 'HSE Engineer', 'Foreman'
  ];

  // Calculate position statistics (Applied positions count)
  const positionStats = () => {
    const counts: { [key: string]: number } = {};
    applicants.forEach(app => {
      counts[app.position] = (counts[app.position] || 0) + 1;
    });
    return counts;
  };

  // Handle Save Applicant
  const handleSaveApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const applicantId = editingApplicant ? editingApplicant.id : doc(collection(db, 'job_applicants')).id;
      const data: JobApplicant = {
        id: applicantId,
        name: applicantForm.name,
        email: applicantForm.email,
        mobileNumber: applicantForm.mobileNumber,
        position: applicantForm.position,
        passportNumber: applicantForm.passportNumber,
        salaryExpectation: Number(applicantForm.salaryExpectation),
        status: applicantForm.status,
        appliedDate: editingApplicant ? editingApplicant.appliedDate : new Date().toISOString().split('T')[0],
        notes: applicantForm.notes
      };

      await setDoc(doc(db, 'job_applicants', applicantId), data);
      setShowApplicantModal(false);
      setEditingApplicant(null);
      // Reset Form
      setApplicantForm({
        name: '', email: '', mobileNumber: '', position: 'Cleaner', 
        passportNumber: '', salaryExpectation: 0, notes: '', status: 'Applied'
      });
    } catch (err) {
      console.error("Error saving applicant:", err);
      alert("Failed to save applicant: " + err);
    }
  };

  // Open Edit Applicant Modal
  const openEditApplicant = (app: JobApplicant) => {
    setEditingApplicant(app);
    setApplicantForm({
      name: app.name,
      email: app.email,
      mobileNumber: app.mobileNumber,
      position: app.position,
      passportNumber: app.passportNumber || '',
      salaryExpectation: app.salaryExpectation || 0,
      notes: app.notes || '',
      status: app.status
    });
    setShowApplicantModal(true);
  };

  // Handle Delete Applicant
  const handleDeleteApplicant = (id: string, name: string) => {
    if (!canManage) return;
    openConfirm(
      'Delete Applicant',
      `Are you sure you want to delete applicant ${name}? This action cannot be undone.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'job_applicants', id));
        } catch (err) {
          console.error("Error deleting applicant:", err);
        }
      },
      'danger'
    );
  };

  // Update Status directly
  const handleUpdateStatus = async (app: JobApplicant, status: JobApplicant['status']) => {
    if (!canManage) return;
    try {
      await setDoc(doc(db, 'job_applicants', app.id), { ...app, status }, { merge: true });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Trigger Offerd / Hire Modal from Applicant
  const triggerHireApplicant = (app: JobApplicant) => {
    setOfferForm({
      employeeName: app.name,
      position: app.position,
      salary: app.salaryExpectation && app.salaryExpectation > 0 ? Math.round(app.salaryExpectation * 0.6) : 3000,
      housingAllowance: app.salaryExpectation && app.salaryExpectation > 0 ? Math.round(app.salaryExpectation * 0.2) : 1000,
      transportAllowance: app.salaryExpectation && app.salaryExpectation > 0 ? Math.round(app.salaryExpectation * 0.1) : 500,
      otherAllowance: app.salaryExpectation && app.salaryExpectation > 0 ? Math.round(app.salaryExpectation * 0.1) : 500,
      passportNumber: app.passportNumber || '',
      mobileNumber: app.mobileNumber || '',
      joiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days later
      offerDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Offered',
      additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.',
      applicantId: app.id
    });
    setEditingOffer(null);
    setActiveTab('offers');
    setShowOfferModal(true);
  };

  // Save Job Offer
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const offerId = editingOffer ? editingOffer.id : doc(collection(db, 'job_offers')).id;
      const data: JobOffer = {
        id: offerId,
        applicantId: offerForm.applicantId || undefined,
        employeeName: offerForm.employeeName,
        position: offerForm.position,
        salary: Number(offerForm.salary),
        housingAllowance: Number(offerForm.housingAllowance),
        transportAllowance: Number(offerForm.transportAllowance),
        otherAllowance: Number(offerForm.otherAllowance),
        passportNumber: offerForm.passportNumber,
        mobileNumber: offerForm.mobileNumber,
        joiningDate: offerForm.joiningDate,
        offerDate: offerForm.offerDate,
        expiryDate: offerForm.expiryDate,
        status: offerForm.status,
        additionalDetails: offerForm.additionalDetails
      };

      await setDoc(doc(db, 'job_offers', offerId), data);

      // If tied to an applicant, automatically mark them as "Hired"
      if (offerForm.applicantId) {
        const linkedApp = applicants.find(a => a.id === offerForm.applicantId);
        if (linkedApp) {
          await setDoc(doc(db, 'job_applicants', linkedApp.id), { ...linkedApp, status: 'Hired' }, { merge: true });
        }
      }

      setShowOfferModal(false);
      setEditingOffer(null);
      // Reset
      setOfferForm({
        employeeName: '', position: 'Cleaner', salary: 3000, housingAllowance: 1000,
        transportAllowance: 500, otherAllowance: 500, passportNumber: '', mobileNumber: '',
        joiningDate: new Date().toISOString().split('T')[0], offerDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'Offered',
        additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided.', applicantId: ''
      });
    } catch (err) {
      console.error("Error saving job offer:", err);
      alert("Failed to save job offer: " + err);
    }
  };

  // Open Edit Offer Form
  const openEditOffer = (offer: JobOffer) => {
    setEditingOffer(offer);
    setOfferForm({
      employeeName: offer.employeeName,
      position: offer.position,
      salary: offer.salary,
      housingAllowance: offer.housingAllowance || 0,
      transportAllowance: offer.transportAllowance || 0,
      otherAllowance: offer.otherAllowance || 0,
      passportNumber: offer.passportNumber,
      mobileNumber: offer.mobileNumber,
      joiningDate: offer.joiningDate,
      offerDate: offer.offerDate,
      expiryDate: offer.expiryDate || '',
      status: offer.status,
      additionalDetails: offer.additionalDetails || '',
      applicantId: offer.applicantId || ''
    });
    setShowOfferModal(true);
  };

  // Handle Delete Offer
  const handleDeleteOffer = (id: string, name: string) => {
    if (!canManage) return;
    openConfirm(
      'Delete Job Offer',
      `Are you sure you want to delete the job offer for ${name}?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'job_offers', id));
        } catch (err) {
          console.error("Error deleting job offer:", err);
        }
      },
      'danger'
    );
  };

  // Format currencies (AED)
  const formatAED = (val: number | string) => {
    const num = Number(val) || 0;
    return `AED ${num.toLocaleString('en-US')}`;
  };

  // PDF Generator for Offer Letter (Formal UAE Corporate style)
  const generateOfferLetterPDF = (offer: JobOffer) => {
    try {
      const doc = new jsPDF();
      
      // Decorative border and header
      doc.setFillColor(15, 23, 42); // slate 900
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("PIONEER DMS PORTAL - HR SECTOR", 105, 10, { align: 'center' });
      
      // Letters body
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(22);
      doc.text("OFFER OF EMPLOYMENT", 105, 30, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240); // slate 200
      doc.line(20, 35, 190, 35);
      
      // Date and Salutation
      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text(`Reference: PNE_HR_OFFER_${offer.id.slice(0, 6).toUpperCase()}`, 20, 43);
      doc.text(`Date of Issue: ${offer.offerDate}`, 20, 48);
      
      // Candidate info block
      doc.setFillColor(248, 250, 252); // slate 50
      doc.rect(20, 54, 170, 32, 'F');
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Candidate Details & Contact Info:", 23, 60);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Name: ${offer.employeeName}`, 23, 66);
      doc.text(`Position Offered: ${offer.position}`, 23, 71);
      doc.text(`Passport Number: ${offer.passportNumber}`, 23, 76);
      doc.text(`Mobile Number: ${offer.mobileNumber}`, 23, 81);
      
      // Offer opening paragraph
      doc.setFontSize(10);
      doc.text(`Dear ${offer.employeeName},`, 20, 93);
      doc.text(`We are pleased to offer you employment with Pioneer on the terms and conditions outlined below.`, 20, 99);
      doc.text(`Please review the compensation breakdown, key benefits, and responsibilities associated with this role:`, 20, 104);
      
      // Salary table headers
      doc.setFillColor(241, 245, 249); // slate 100
      doc.rect(20, 110, 170, 7, 'F');
      doc.setFont("Helvetica", "bold");
      doc.text("Compensation Item", 24, 115);
      doc.text("Amount (per Month)", 140, 115);
      
      // Salary breakdown rows
      const basic = offer.salary || 0;
      const housing = offer.housingAllowance || 0;
      const transport = offer.transportAllowance || 0;
      const other = offer.otherAllowance || 0;
      const total = basic + housing + transport + other;
      
      doc.setFont("Helvetica", "normal");
      doc.text("Basic Allowance", 24, 122);
      doc.text(`${formatAED(basic)}`, 140, 122);
      
      doc.text("Housing Allowance", 24, 128);
      doc.text(`${formatAED(housing)}`, 140, 128);
      
      doc.text("Transport Allowance", 24, 134);
      doc.text(`${formatAED(transport)}`, 140, 134);
      
      doc.text("Other Allowances / Food / Utilities", 24, 140);
      doc.text(`${formatAED(other)}`, 140, 140);
      
      doc.line(20, 143, 190, 143);
      
      doc.setFillColor(239, 246, 255); // blue 50
      doc.rect(20, 145, 170, 8, 'F');
      doc.setFont("Helvetica", "bold");
      doc.text("Total Gross Salary", 24, 150);
      doc.text(`${formatAED(total)}`, 140, 150);
      
      // Standard Terms and Conditions
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Key Terms & Conditions:", 20, 161);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      
      let currentY = 167;
      const clauses = [
        `1. Joining Date: You are requested to join services on or before ${offer.joiningDate}.`,
        `2. Working Location & Hours: Standard shift schedules in correspondence with the assigned site.`,
        `3. Probation Period: Subject to six (6) months probation as per UAE Labour law requirements.`,
        `4. UAE Legalities: Residence Visa, Medical, Emirates ID, and Labour Permit expenses are covered.`,
        `5. Additional Details: ${offer.additionalDetails}`,
        `6. This offer is valid until ${offer.expiryDate || 'N/A'} after which if not signed, it is Null & Void.`
      ];
      
      clauses.forEach(clause => {
        const splitText = doc.splitTextToSize(clause, 170);
        doc.text(splitText, 20, currentY);
        currentY += splitText.length * 5;
      });
      
      // Signature Blocks
      doc.setFontSize(10);
      doc.setDrawColor(203, 213, 225); // slate 300
      doc.line(20, 240, 90, 240);
      doc.line(120, 240, 190, 240);
      
      doc.setFont("Helvetica", "bold");
      doc.text("For Pioneer (Authorized HR Officer)", 20, 246);
      doc.text("Candidate Signature (I Accept)", 120, 246);
      
      // Save PDF
      doc.save(`Offer_Letter_${offer.employeeName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Could not generate PDF: " + err);
    }
  };

  // PDF Generator for Acceptance Letter (Aknowledgement Statement)
  const generateAcceptanceLetterPDF = (offer: JobOffer) => {
    try {
      const doc = new jsPDF();
      
      doc.setFillColor(15, 23, 42); // slate 900
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("PIONEER DMS PORTAL - EMPLOYEE HUB", 105, 10, { align: 'center' });
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(22);
      doc.text("LETTER OF ACCEPTANCE", 105, 30, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 35, 190, 35);
      
      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text(`Reference Offer: PNE_HR_OFFER_${offer.id.slice(0, 6).toUpperCase()}`, 20, 43);
      doc.text(`Date of Acceptance: ${new Date().toISOString().split('T')[0]}`, 20, 48);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("To: The HR Management Team, Pioneer Group", 20, 60);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Dear Sir/Madam,", 20, 70);
      
      const p1 = `I, the undersigned, hereby formally confirm my acceptance of your offer of employment dated ${offer.offerDate} for the position of ${offer.position} on the salary and structure outlined below.`;
      const splitP1 = doc.splitTextToSize(p1, 170);
      doc.text(splitP1, 20, 78);
      
      let nextY = 78 + (splitP1.length * 6);
      
      // Details Confirmation Box
      doc.setFillColor(248, 250, 252);
      doc.rect(20, nextY, 170, 75, 'F');
      
      doc.setFont("Helvetica", "bold");
      doc.text("Confirmed Terms & Personal Details:", 24, nextY + 8);
      doc.setFont("Helvetica", "normal");
      doc.text(`Full Name: ${offer.employeeName}`, 24, nextY + 16);
      doc.text(`Passport Number: ${offer.passportNumber}`, 24, nextY + 22);
      doc.text(`Mobile Contact: ${offer.mobileNumber}`, 24, nextY + 28);
      doc.text(`Designation: ${offer.position}`, 24, nextY + 34);
      
      const basic = offer.salary || 0;
      const lodging = offer.housingAllowance || 0;
      const transport = offer.transportAllowance || 0;
      const utilities = offer.otherAllowance || 0;
      const total = basic + lodging + transport + utilities;
      
      doc.text(`Basic Monthly Salary: ${formatAED(basic)}`, 24, nextY + 42);
      doc.text(`Total Gross Monthly Salary: ${formatAED(total)}`, 24, nextY + 48);
      doc.text(`Proposed Joining date: ${offer.joiningDate}`, 24, nextY + 54);
      doc.text(`Associated Offer Code: PNE_HR_OFFER_${offer.id.slice(0, 6).toUpperCase()}`, 24, nextY + 60);
      doc.text(`Current UAE Mobile Contact: ${offer.mobileNumber}`, 24, nextY + 66);
      
      nextY += 85;
      
      const p2 = `By signing this letter, I agree to abide by all internal rules, regulations, safety standards, policies, and code of conduct set forth by Pioneer and UAE Ministry of Human Resources & Emiratisation (MoHRE). I will supply all relevant background documents, passport copy, original degrees, cancellation paper or visa copy immediately to ensure timely processing of my UAE residence residency documents.`;
      const splitP2 = doc.splitTextToSize(p2, 170);
      doc.text(splitP2, 20, nextY);
      
      nextY += (splitP2.length * 5.5) + 30;
      
      // Signature Line
      doc.line(110, nextY, 180, nextY);
      doc.setFont("Helvetica", "bold");
      doc.text("Employee Full Name & Signature", 110, nextY + 6);
      doc.text("Signed On Date:", 20, nextY + 6);
      doc.setFont("Helvetica", "normal");
      doc.text(`${new Date().toISOString().split('T')[0]}`, 50, nextY + 6);
      
      doc.save(`Acceptance_Letter_${offer.employeeName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Could not generate PDF: " + err);
    }
  };

  // Filtration logic
  const filteredApplicants = applicants.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (app.passportNumber && app.passportNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesPosition = positionFilter === 'All' || app.position === positionFilter;
    const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
    
    return matchesSearch && matchesPosition && matchesStatus;
  });

  const stats = positionStats();

  return (
    <div className="space-y-6 pt-1">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <Users className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">Job Offer & Applications</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 ml-1">
            Conduct interviews, track initial position applications, and generate professional PDF Offer and Acceptance letters.
          </p>
        </div>

        {/* Floating actions */}
        {canManage && (
          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <button
              onClick={() => {
                setEditingApplicant(null);
                setApplicantForm({
                  name: '', email: '', mobileNumber: '', position: 'Cleaner', 
                  passportNumber: '', salaryExpectation: 0, notes: '', status: 'Applied'
                });
                setShowApplicantModal(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Applicant
            </button>
            <button
              onClick={() => {
                setEditingOffer(null);
                setOfferForm({
                  employeeName: '', position: 'Cleaner', salary: 3000, housingAllowance: 1000,
                  transportAllowance: 500, otherAllowance: 500, passportNumber: '', mobileNumber: '',
                  joiningDate: new Date().toISOString().split('T')[0], offerDate: new Date().toISOString().split('T')[0],
                  expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'Offered',
                  additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.', applicantId: ''
                });
                setShowOfferModal(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Draft Job Offer
            </button>
          </div>
        )}
      </div>

      {/* Statistics Block - Position Applied Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Object.keys(stats).length === 0 ? (
          <div className="col-span-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-center text-xs text-slate-500">
            No active positions applications logged yet. Add some to build the pool!
          </div>
        ) : (
          Object.keys(stats).map(pos => (
            <div 
              key={pos} 
              onClick={() => setPositionFilter(pos)}
              className={`p-3 bg-white rounded-xl border cursor-pointer transition-all ${
                positionFilter === pos ? 'border-brand-500 ring-2 ring-brand-100 shadow-sm' : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-ellipsis overflow-hidden whitespace-nowrap">
                {pos}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-black text-slate-900">{stats[pos]}</span>
                <span className="text-[9px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full font-bold">Applied</span>
              </div>
            </div>
          ))
        )}
        {positionFilter !== 'All' && (
          <button 
            onClick={() => setPositionFilter('All')} 
            className="text-xs text-slate-500 font-bold underline text-left px-2 sm:col-span-2 hover:text-slate-800 transition-colors"
          >
            Clear Position Filter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'applicants' 
              ? 'border-brand-600 text-brand-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          1. Applied Positions & Candidates ({filteredApplicants.length})
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'offers' 
              ? 'border-brand-600 text-brand-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          2. Hired & Job Offers / Letters Hub ({offers.length})
        </button>
      </div>

      {/* RENDER TAB 1: APPLICANTS */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates by name, position, passport..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Position Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Designation:</span>
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5"
                >
                  <option value="All">All Applied</option>
                  {Array.from(new Set([...designationsList, ...applicants.map(a => a.position).filter(Boolean)])).sort().map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5"
                >
                  <option value="All">All Statuses</option>
                  <option value="Applied">Applied</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Interview Conducted">Interview Conducted</option>
                  <option value="Hired">Hired (Offered)</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidates table / list */}
          {loading ? (
            <div className="text-center py-20 bg-white border rounded-2xl">
              <span className="text-xs text-slate-400">Syncing candidates database, please wait...</span>
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
              <Users className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <h3 className="text-sm font-bold text-slate-700 mt-2">No Candidates Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No job applications match your filters. Create a candidate manually using the "Add Applicant" button above.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-5 py-4 text-[10px] uppercase font-black text-slate-400 tracking-wider">Candidate Details</th>
                      <th className="px-5 py-4 text-[10px] uppercase font-black text-slate-400 tracking-wider">Applied Position</th>
                      <th className="px-5 py-4 text-[10px] uppercase font-black text-slate-400 tracking-wider">Expectation / Status</th>
                      <th className="px-5 py-4 text-[10px] uppercase font-black text-slate-400 tracking-wider">Interview Log & Notes</th>
                      <th className="px-5 py-4 text-[10px] uppercase font-black text-slate-400 tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApplicants.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="text-xs font-bold text-slate-900">{app.name}</div>
                          <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {app.email}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {app.mobileNumber}</span>
                            {app.passportNumber && (
                              <span className="flex items-center gap-1 text-[9px] bg-slate-100 w-max px-1 rounded">
                                Passport: {app.passportNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                            {app.position}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-1.5 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> Filed {app.appliedDate}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-bold text-slate-800">
                            {app.salaryExpectation ? formatAED(app.salaryExpectation) : 'Not Specified'}
                          </div>
                          
                          {/* Rich Badge */}
                          <div className="mt-1.5">
                            {app.status === 'Applied' && (
                              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Applied
                              </span>
                            )}
                            {app.status === 'Interview Scheduled' && (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                Scheduled
                              </span>
                            )}
                            {app.status === 'Interview Conducted' && (
                              <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Conducted
                              </span>
                            )}
                            {app.status === 'Hired' && (
                              <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-max">
                                <Check className="w-3 h-3" /> Hired
                              </span>
                            )}
                            {app.status === 'Rejected' && (
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Rejected
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <div className="text-[10px] text-slate-600 line-clamp-2 italic">
                            "{app.notes || 'No comments loaded.'}"
                          </div>
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              onClick={() => {
                                handleUpdateStatus(app, 'Interview Scheduled');
                                alert(`Status updated: Interview has been scheduled for ${app.name}`);
                              }}
                              className="text-[9px] text-amber-600 hover:underline font-bold"
                            >
                              Schedule
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              onClick={() => {
                                handleUpdateStatus(app, 'Interview Conducted');
                                alert(`Status updated: Interview logged as Conducted for ${app.name}`);
                              }}
                              className="text-[9px] text-purple-600 hover:underline font-bold"
                            >
                              Log Compl.
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {app.status !== 'Hired' && canManage && (
                              <button
                                onClick={() => triggerHireApplicant(app)}
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold rounded cursor-pointer transition-colors"
                              >
                                Offer Employment
                              </button>
                            )}
                            
                            <button
                              onClick={() => openEditApplicant(app)}
                              className="p-1.5 text-slate-500 hover:text-brand-600 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            
                            {canManage && (
                              <button
                                onClick={() => handleDeleteApplicant(app.id, app.name)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded bg-slate-50 hover:bg-rose-100 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RENDER TAB 2: OFFERS (LETTERS GENERATOR HUB) */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-400 bg-brand-950/50 px-2 py-0.5 rounded">
                Official Letterhead Generator
              </span>
              <h2 className="text-lg font-black tracking-tight">Employment Letter Center</h2>
              <p className="text-[11px] text-slate-300">
                Pioneer standardizes corporate layout rules. Standardize basic wage, accommodation, transport allowances and execute print processes instantly.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 font-bold block">
                Total Drafted: <span className="text-brand-400 font-black">{offers.length}</span>
              </span>
            </div>
          </div>

          {offers.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
              <FileCheck className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <h3 className="text-sm font-bold text-slate-700 mt-2">No Job Offers Issued Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Issue a standalone offer using "Draft Job Offer" above or transition any applied candidate to draft status.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.map((offer) => {
                const isAccepted = offer.status === 'Accepted';
                const isDeclined = offer.status === 'Declined';
                
                const basic = offer.salary || 0;
                const housing = offer.housingAllowance || 0;
                const transport = offer.transportAllowance || 0;
                const other = offer.otherAllowance || 0;
                const grossTotal = basic + housing + transport + other;

                return (
                  <div key={offer.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4 relative overflow-hidden flex flex-col justify-between">
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4">
                      {isAccepted && (
                        <span className="bg-green-50 text-green-700 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-green-200">
                          Accepted
                        </span>
                      )}
                      {isDeclined && (
                        <span className="bg-rose-50 text-rose-700 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-rose-200">
                          Declined
                        </span>
                      )}
                      {offer.status === 'Offered' && (
                        <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-200 animate-pulse">
                          Offered
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 px-2 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-bold">
                          Designation
                        </span>
                        <span className="bg-brand-50 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                          {offer.position}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-slate-900">{offer.employeeName}</h3>
                      
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <div>
                          <span className="font-bold text-slate-400 block uppercase text-[8px]">Mobile Number</span>
                          <span className="text-slate-900 font-medium">{offer.mobileNumber}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block uppercase text-[8px]">Passport Number</span>
                          <span className="text-slate-900 font-mono font-bold">{offer.passportNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block uppercase text-[8px]">Salary Breakdown</span>
                          <span className="text-brand-600 font-extrabold">{formatAED(grossTotal)} / mo</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block uppercase text-[8px]">Proposed Joining Date</span>
                          <span className="text-slate-900 font-bold">{offer.joiningDate}</span>
                        </div>
                      </div>

                      {offer.additionalDetails && (
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[9px] text-slate-500 mt-2">
                          <span className="font-bold block text-slate-600 uppercase text-[8px] mb-0.5">Special Terms</span>
                          {offer.additionalDetails}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">Status:</span>
                        <select
                          value={offer.status}
                          onChange={async (e) => {
                            if (!canManage) return;
                            try {
                              await setDoc(doc(db, 'job_offers', offer.id), { ...offer, status: e.target.value as any }, { merge: true });
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="bg-slate-50 text-[10px] font-bold border border-slate-200 rounded px-1 py-0.5 cursor-pointer outline-none"
                        >
                          <option value="Offered">Offered</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Declined">Declined</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => generateOfferLetterPDF(offer)}
                          className="flex items-center gap-1 px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[10px] font-black rounded cursor-pointer transition-all"
                        >
                          <Download className="w-3 h-3 text-brand-600" />
                          Offer (PDF)
                        </button>
                        
                        <button
                          onClick={() => generateAcceptanceLetterPDF(offer)}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black rounded cursor-pointer transition-all"
                        >
                          <Download className="w-3 h-3 text-brand-400" />
                          Acceptance (PDF)
                        </button>

                        <button
                          onClick={() => openEditOffer(offer)}
                          className="p-1 text-slate-400 hover:text-brand-650 rounded bg-slate-50 hover:bg-slate-100"
                          title="Edit Info"
                        >
                          <Edit className="w-3 h-3" />
                        </button>

                        {canManage && (
                          <button
                            onClick={() => handleDeleteOffer(offer.id, offer.employeeName)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded bg-slate-50 border border-slate-100"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT APPLICANT ================= */}
      {showApplicantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-950">
                {editingApplicant ? 'Modify Candidate Details' : 'Register New Job Applicant'}
              </h3>
              <button 
                onClick={() => setShowApplicantModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors h-7 w-7 flex items-center justify-center text-md font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveApplicant} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantForm.name}
                    onChange={(e) => setApplicantForm({ ...applicantForm, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={applicantForm.email}
                    onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                    placeholder="e.g. john@pioneer.ae"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Mobile Contact *
                  </label>
                  <input
                    type="tel"
                    required
                    value={applicantForm.mobileNumber}
                    onChange={(e) => setApplicantForm({ ...applicantForm, mobileNumber: e.target.value })}
                    placeholder="e.g. +971 50 123 4567"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Passport Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantForm.passportNumber}
                    onChange={(e) => setApplicantForm({ ...applicantForm, passportNumber: e.target.value })}
                    placeholder="e.g. N1234567"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Role Designation *
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      list="applicant-designations"
                      required
                      value={applicantForm.position}
                      onChange={(e) => setApplicantForm({ ...applicantForm, position: e.target.value })}
                      placeholder="e.g. Cleaner or type custom"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                    <datalist id="applicant-designations">
                      {Array.from(new Set([...designationsList, ...applicants.map(a => a.position).filter(Boolean)])).sort().map(item => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {/* Compact suggestions badges */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['Cleaner', 'Helper', 'Supervisor', 'Admin', 'Driver'].map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setApplicantForm({ ...applicantForm, position: item })}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                            applicantForm.position === item 
                              ? 'bg-brand-50 border-brand-200 text-brand-700' 
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Expected Total Salary (AED/mo)
                  </label>
                  <input
                    type="number"
                    value={applicantForm.salaryExpectation}
                    onChange={(e) => setApplicantForm({ ...applicantForm, salaryExpectation: Number(e.target.value) })}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Application Status
                  </label>
                  <select
                    value={applicantForm.status}
                    onChange={(e) => setApplicantForm({ ...applicantForm, status: e.target.value as any })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Interview Conducted">Interview Conducted</option>
                    <option value="Hired">Hired (Approved)</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Interview Log Notes / Background Check Remarks
                </label>
                <textarea
                  value={applicantForm.notes}
                  rows={3}
                  onChange={(e) => setApplicantForm({ ...applicantForm, notes: e.target.value })}
                  placeholder="Insert qualifications details, interview outcomes, background verification summary here..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowApplicantModal(false)}
                  className="px-4 py-2 hover:bg-slate-150 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow transition-colors"
                >
                  Save Applications Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT JOB OFFER ================= */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingOffer ? 'Edit Employment Offer Draft' : 'Draft Official UAE Offer Letter'}
                </h3>
                {offerForm.applicantId && (
                  <span className="text-[10px] font-bold text-brand-600">
                    Linked to applicant: {(applicants.find(a => a.id === offerForm.applicantId))?.name}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setShowOfferModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors h-7 w-7 flex items-center justify-center text-md font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOffer} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={offerForm.employeeName}
                    onChange={(e) => setOfferForm({ ...offerForm, employeeName: e.target.value })}
                    placeholder="Candidate Legal Name (matches passport)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Assign Position Designation *
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      list="offer-designations"
                      required
                      value={offerForm.position}
                      onChange={(e) => setOfferForm({ ...offerForm, position: e.target.value })}
                      placeholder="e.g. Cleaner or type custom"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                    <datalist id="offer-designations">
                      {Array.from(new Set([...designationsList, ...applicants.map(a => a.position).filter(Boolean)])).sort().map(item => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {/* Compact suggestions badges */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['Cleaner', 'Helper', 'Supervisor', 'Admin', 'Driver'].map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setOfferForm({ ...offerForm, position: item })}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                            offerForm.position === item 
                              ? 'bg-slate-900 border-slate-900 text-white' 
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Basic Monthly Salary (AED) *
                  </label>
                  <input
                    type="number"
                    required
                    value={offerForm.salary}
                    onChange={(e) => setOfferForm({ ...offerForm, salary: Number(e.target.value) })}
                    placeholder="Basic wage component"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Housing Allowance (AED/mo)
                  </label>
                  <input
                    type="number"
                    value={offerForm.housingAllowance}
                    onChange={(e) => setOfferForm({ ...offerForm, housingAllowance: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Transport Allowance (AED/mo)
                  </label>
                  <input
                    type="number"
                    value={offerForm.transportAllowance}
                    onChange={(e) => setOfferForm({ ...offerForm, transportAllowance: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Other Allowances (Food/Utilities/Utilities)
                  </label>
                  <input
                    type="number"
                    value={offerForm.otherAllowance}
                    onChange={(e) => setOfferForm({ ...offerForm, otherAllowance: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div className="sm:col-span-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-indigo-900">Calculated Total Gross Salary:</span>
                  <span className="font-black text-indigo-900 text-sm">
                    {formatAED(offerForm.salary + offerForm.housingAllowance + offerForm.transportAllowance + offerForm.otherAllowance)}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Passport Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={offerForm.passportNumber}
                    onChange={(e) => setOfferForm({ ...offerForm, passportNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={offerForm.mobileNumber}
                    onChange={(e) => setOfferForm({ ...offerForm, mobileNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Letter Issuance Date
                  </label>
                  <input
                    type="date"
                    required
                    value={offerForm.offerDate}
                    onChange={(e) => setOfferForm({ ...offerForm, offerDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Proposed Joining Date
                  </label>
                  <input
                    type="date"
                    required
                    value={offerForm.joiningDate}
                    onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Offer Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={offerForm.expiryDate}
                    onChange={(e) => setOfferForm({ ...offerForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Internal Offer Status
                  </label>
                  <select
                    value={offerForm.status}
                    onChange={(e) => setOfferForm({ ...offerForm, status: e.target.value as any })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                  >
                    <option value="Offered">Offered</option>
                    <option value="Accepted">Accepted (Will Sign)</option>
                    <option value="Declined">Declined / Withdrawn</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Additional Legal Clauses / Custom Allowances Details
                </label>
                <textarea
                  value={offerForm.additionalDetails}
                  rows={3}
                  onChange={(e) => setOfferForm({ ...offerForm, additionalDetails: e.target.value })}
                  placeholder="Specify flights frequencies, health/dental coverage plans, or specific location assignments..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="px-4 py-2 hover:bg-slate-150 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow transition-colors"
                >
                  Save Draft & Lock Allowances
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
