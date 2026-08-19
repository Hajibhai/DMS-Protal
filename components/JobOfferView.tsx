import React, { useState, useEffect } from 'react';
import { 
  collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Company, JobApplicant, JobOffer, UserRole } from '../types';
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
import { getPioneerPDFAssets, applyPioneerLetterheadDoc } from '../utils';
import { RecruitmentReportModal } from './RecruitmentReportModal';
import { GoogleMeetGenerator } from './GoogleMeetGenerator';
import { 
  Users, Mail, Phone, Shield, FileText, Download, Plus, Search, 
  Trash2, Edit, CheckCircle, XCircle, Calendar, DollarSign,
  ChevronRight, Sparkles, SlidersHorizontal, Info, Briefcase, FileCheck, Check,
  Video, ExternalLink, Upload, Eye, X, Filter, Building2
} from 'lucide-react';

interface JobOfferViewProps {
  user: any;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  companies?: Company[];
}

export const JobOfferView: React.FC<JobOfferViewProps> = ({ user, openConfirm, companies }) => {
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

  // Filters State for Applicants (Tab 1)
  const [applicantSearchQuery, setApplicantSearchQuery] = useState('');
  const [applicantPositionFilter, setApplicantPositionFilter] = useState('All');
  const [applicantStatusFilter, setApplicantStatusFilter] = useState('All');

  // Filters State for Job Offers (Tab 2)
  const [offerSearchQuery, setOfferSearchQuery] = useState('');
  const [offerPositionFilter, setOfferPositionFilter] = useState('All');
  const [offerStatusFilter, setOfferStatusFilter] = useState('All');
  const [offerCompanyFilter, setOfferCompanyFilter] = useState('All');

  // Modal State
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<JobApplicant | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<JobOffer | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Applicant Draft Form
  const [applicantForm, setApplicantForm] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    position: 'Cleaner',
    passportNumber: '',
    emiratesIdNumber: '',
    salaryExpectation: 0,
    notes: '',
    status: 'Applied' as JobApplicant['status'],
    interviewType: 'F2F' as 'F2F' | 'Online',
    interviewMeetLink: '',
    interviewDate: ''
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
    email: '',
    emiratesIdNumber: '',
    joiningDate: new Date().toISOString().split('T')[0],
    offerDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Offered' as JobOffer['status'],
    additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.',
    applicantId: '',
    company: ''
  });

  // Signed document uploads state
  const [showSignedUploadsId, setShowSignedUploadsId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
  const [fetchingFile, setFetchingFile] = useState<{ id: string, type: 'offer' | 'acceptance' } | null>(null);
  const [uploadingState, setUploadingState] = useState<{ [key: string]: { percent: number; status: string } }>({});

  // Fetch chunked base64 file from subcollection
  const fetchChunkedFile = async (offerId: string, type: 'offer' | 'acceptance', chunksCount: number): Promise<string> => {
    if (chunksCount <= 0) return '';
    const promises = [];
    for (let i = 0; i < chunksCount; i++) {
      const chunkDocRef = doc(db, 'job_offers', offerId, 'chunks', `${type}_chunk_${i}`);
      promises.push(getDoc(chunkDocRef).then(snap => {
        if (!snap.exists()) {
          throw new Error(`Chunk ${i} not found`);
        }
        return { index: i, chunk: snap.data().chunk };
      }));
    }
    const results = await Promise.all(promises);
    results.sort((a, b) => a.index - b.index);
    return results.map(r => r.chunk).join('');
  };

  // Delete chunked file from subcollection
  const deleteChunkedFile = async (offerId: string, type: 'offer' | 'acceptance', oldChunksCount?: number) => {
    const limit = oldChunksCount && oldChunksCount > 0 ? oldChunksCount : 20;
    const promises = [];
    for (let i = 0; i < limit; i++) {
      const chunkDocRef = doc(db, 'job_offers', offerId, 'chunks', `${type}_chunk_${i}`);
      promises.push(deleteDoc(chunkDocRef).catch(() => {}));
    }
    await Promise.all(promises);
  };

  const handlePreviewLoadedFile = async (offer: JobOffer, type: 'offer' | 'acceptance') => {
    const url = type === 'offer' ? offer.signedOfferUrl : offer.signedAcceptanceUrl;
    const name = type === 'offer' ? offer.signedOfferName : offer.signedAcceptanceName;
    if (!url) return;

    if (url === 'chunked') {
      setFetchingFile({ id: offer.id, type });
      try {
        const chunksCount = type === 'offer' ? (offer.signedOfferChunksCount || 0) : (offer.signedAcceptanceChunksCount || 0);
        const fullBase64 = await fetchChunkedFile(offer.id, type, chunksCount);
        setPreviewDoc({ url: fullBase64, name: name || (type === 'offer' ? 'Signed Offer Letter' : 'Signed Acceptance Letter') });
      } catch (err: any) {
        console.error("Error fetching chunked file:", err);
        openConfirm('Load Error', 'Failed to retrieve document chunks from the server.', () => {}, 'danger');
      } finally {
        setFetchingFile(null);
      }
    } else {
      setPreviewDoc({ url, name: name || (type === 'offer' ? 'Signed Offer Letter' : 'Signed Acceptance Letter') });
    }
  };

  const handleDownloadLoadedFile = async (e: React.MouseEvent, offer: JobOffer, type: 'offer' | 'acceptance') => {
    const url = type === 'offer' ? offer.signedOfferUrl : offer.signedAcceptanceUrl;
    const name = type === 'offer' ? offer.signedOfferName : offer.signedAcceptanceName;
    if (!url) return;

    if (url === 'chunked') {
      e.preventDefault();
      setFetchingFile({ id: offer.id, type });
      try {
        const chunksCount = type === 'offer' ? (offer.signedOfferChunksCount || 0) : (offer.signedAcceptanceChunksCount || 0);
        const fullBase64 = await fetchChunkedFile(offer.id, type, chunksCount);
        const link = document.createElement('a');
        link.href = fullBase64;
        link.download = name || (type === 'offer' ? 'signed_offer.pdf' : 'signed_acceptance.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err: any) {
        console.error("Error downloading chunked file:", err);
        openConfirm('Download Error', 'Failed to retrieve document chunks for download.', () => {}, 'danger');
      } finally {
        setFetchingFile(null);
      }
    }
  };

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
      const pos = app.position ? app.position.trim() : 'Unknown';
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return counts;
  };

  // Helper to ensure a job offer exists in Firestore if status is Offered or Hired (Approved)
  const ensureJobOfferForApplicantDoc = async (
    appId: string,
    appName: string,
    appEmail: string,
    appMobile: string,
    appPosition: string,
    appPassport: string,
    appEmiratesId: string,
    appSalaryExp: number,
    appStatus: 'Applied' | 'Interview Scheduled' | 'Interview Conducted' | 'Offered' | 'Hired' | 'Rejected'
  ) => {
    try {
      const existingOffer = offers.find(o => o.applicantId === appId);
      const newStatus = appStatus === 'Hired' ? 'Accepted' : 'Offered';
      
      if (existingOffer) {
        if (existingOffer.status !== newStatus || existingOffer.emiratesIdNumber !== appEmiratesId) {
          await setDoc(doc(db, 'job_offers', existingOffer.id), {
            ...existingOffer,
            status: newStatus,
            emiratesIdNumber: appEmiratesId || existingOffer.emiratesIdNumber || '',
            email: appEmail || existingOffer.email || '',
            mobileNumber: appMobile || existingOffer.mobileNumber || ''
          }, { merge: true });
        }
      } else {
        const offerId = doc(collection(db, 'job_offers')).id;
        const salaryExp = appSalaryExp || 3000;
        const basic = Math.round(salaryExp * 0.6);
        const housing = Math.round(salaryExp * 0.2);
        const transport = Math.round(salaryExp * 0.1);
        const other = Math.round(salaryExp * 0.1);

        const newOffer: JobOffer = {
          id: offerId,
          applicantId: appId,
          employeeName: appName,
          position: appPosition,
          salary: basic,
          housingAllowance: housing,
          transportAllowance: transport,
          otherAllowance: other,
          passportNumber: appPassport || '',
          mobileNumber: appMobile || '',
          email: appEmail || '',
          emiratesIdNumber: appEmiratesId || '',
          joiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          offerDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: newStatus,
          additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.',
          company: ''
        };
        await setDoc(doc(db, 'job_offers', offerId), newOffer);
      }
    } catch (err) {
      console.error("Error securing job offer for applicant:", err);
    }
  };

  // Handle Save Applicant
  const handleSaveApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const applicantId = editingApplicant ? editingApplicant.id : doc(collection(db, 'job_applicants')).id;
      const data: any = {
        id: applicantId,
        name: applicantForm.name,
        email: applicantForm.email,
        mobileNumber: applicantForm.mobileNumber,
        position: applicantForm.position,
        passportNumber: applicantForm.passportNumber,
        emiratesIdNumber: applicantForm.emiratesIdNumber || '',
        salaryExpectation: Number(applicantForm.salaryExpectation),
        status: applicantForm.status,
        appliedDate: editingApplicant ? editingApplicant.appliedDate : new Date().toISOString().split('T')[0],
        notes: applicantForm.notes,
        interviewType: applicantForm.status === 'Interview Scheduled' ? applicantForm.interviewType : undefined,
        interviewMeetLink: applicantForm.status === 'Interview Scheduled' && applicantForm.interviewType === 'Online' ? (applicantForm.interviewMeetLink || '') : undefined,
        interviewDate: applicantForm.status === 'Interview Scheduled' ? (applicantForm.interviewDate || '') : undefined
      };

      // Remove undefined fields to prevent Firestore setDoc errors
      Object.keys(data).forEach(key => {
        if (data[key] === undefined) {
          delete data[key];
        }
      });

      await setDoc(doc(db, 'job_applicants', applicantId), data);

      // If status is 'Offered' or 'Hired', ensure offer is generated
      if (applicantForm.status === 'Offered' || applicantForm.status === 'Hired') {
        await ensureJobOfferForApplicantDoc(
          applicantId,
          applicantForm.name,
          applicantForm.email,
          applicantForm.mobileNumber,
          applicantForm.position,
          applicantForm.passportNumber,
          applicantForm.emiratesIdNumber,
          Number(applicantForm.salaryExpectation),
          applicantForm.status
        );
      }

      setShowApplicantModal(false);
      setEditingApplicant(null);
      // Reset Form
      setApplicantForm({
        name: '', email: '', mobileNumber: '', position: 'Cleaner', 
        passportNumber: '', emiratesIdNumber: '', salaryExpectation: 0, notes: '', status: 'Applied',
        interviewType: 'F2F', interviewMeetLink: '', interviewDate: ''
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
      emiratesIdNumber: app.emiratesIdNumber || '',
      salaryExpectation: app.salaryExpectation || 0,
      notes: app.notes || '',
      status: app.status,
      interviewType: app.interviewType || 'F2F',
      interviewMeetLink: app.interviewMeetLink || '',
      interviewDate: app.interviewDate || ''
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
      if (status === 'Offered' || status === 'Hired') {
        await ensureJobOfferForApplicantDoc(
          app.id,
          app.name,
          app.email,
          app.mobileNumber,
          app.position,
          app.passportNumber,
          app.emiratesIdNumber || '',
          app.salaryExpectation || 0,
          status
        );
      }
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
      email: app.email || '',
      emiratesIdNumber: app.emiratesIdNumber || '',
      joiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days later
      offerDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Offered',
      additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.',
      applicantId: app.id,
      company: ''
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
        email: offerForm.email,
        emiratesIdNumber: offerForm.emiratesIdNumber,
        joiningDate: offerForm.joiningDate,
        offerDate: offerForm.offerDate,
        expiryDate: offerForm.expiryDate,
        status: offerForm.status,
        additionalDetails: offerForm.additionalDetails,
        company: offerForm.company || '',
        ...(editingOffer ? {
          signedOfferUrl: editingOffer.signedOfferUrl || '',
          signedOfferName: editingOffer.signedOfferName || '',
          signedOfferChunksCount: editingOffer.signedOfferChunksCount || 0,
          signedAcceptanceUrl: editingOffer.signedAcceptanceUrl || '',
          signedAcceptanceName: editingOffer.signedAcceptanceName || '',
          signedAcceptanceChunksCount: editingOffer.signedAcceptanceChunksCount || 0,
        } : {})
      };

      await setDoc(doc(db, 'job_offers', offerId), data, { merge: true });

      // If tied to an applicant, automatically mark them as "Hired" or "Offered" based on offer status
      if (offerForm.applicantId) {
        const linkedApp = applicants.find(a => a.id === offerForm.applicantId);
        if (linkedApp) {
          const newAppStatus = offerForm.status === 'Accepted' ? 'Hired' : 'Offered';
          await setDoc(doc(db, 'job_applicants', linkedApp.id), { ...linkedApp, status: newAppStatus }, { merge: true });
        }
      }

      setShowOfferModal(false);
      setEditingOffer(null);
      // Reset
      setOfferForm({
        employeeName: '', position: 'Cleaner', salary: 3000, housingAllowance: 1000,
        transportAllowance: 500, otherAllowance: 500, passportNumber: '', mobileNumber: '',
        email: '', emiratesIdNumber: '',
        joiningDate: new Date().toISOString().split('T')[0], offerDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'Offered',
        additionalDetails: 'Standard UAE Residence Visa, Medical Insurance, and Bi-annual flights to home country provided in accordance with UAE Labour Law.', applicantId: '',
        company: ''
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
      email: offer.email || '',
      emiratesIdNumber: offer.emiratesIdNumber || '',
      joiningDate: offer.joiningDate,
      offerDate: offer.offerDate,
      expiryDate: offer.expiryDate || '',
      status: offer.status,
      additionalDetails: offer.additionalDetails || '',
      applicantId: offer.applicantId || '',
      company: offer.company || ''
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

  // Handle signed document upload
  const handleSignedUpload = (offerId: string, type: 'offer' | 'acceptance', file: File) => {
    if (!file) return;

    const originalOffer = offers.find(o => o.id === offerId);
    if (!originalOffer) return;

    // Up to 5 MB as requested
    const maxSafeSize = 5 * 1024 * 1024; 

    const uploadKey = `${offerId}_${type}`;
    setUploadingState(prev => ({
      ...prev,
      [uploadKey]: { percent: 5, status: 'Reading file...' }
    }));

    const saveToFirestore = async (base64String: string) => {
      try {
        // Delete old chunks first if any exist
        const oldChunksCount = type === 'offer' 
          ? (originalOffer.signedOfferChunksCount || 0) 
          : (originalOffer.signedAcceptanceChunksCount || 0);
        
        if (oldChunksCount > 0) {
          setUploadingState(prev => ({
            ...prev,
            [uploadKey]: { percent: 15, status: 'Cleaning old files...' }
          }));
          await deleteChunkedFile(offerId, type, oldChunksCount);
        }

        const maxDirectSize = 950 * 1024; // ~950KB max size for single document path to stay safe under 1MB Firestore limit
        if (base64String.length <= maxDirectSize) {
          setUploadingState(prev => ({
            ...prev,
            [uploadKey]: { percent: 45, status: 'Uploading document...' }
          }));

          const updateData = type === 'offer' ? {
            signedOfferUrl: base64String,
            signedOfferName: file.name,
            signedOfferChunksCount: 0
          } : {
            signedAcceptanceUrl: base64String,
            signedAcceptanceName: file.name,
            signedAcceptanceChunksCount: 0
          };

          await setDoc(doc(db, 'job_offers', offerId), updateData, { merge: true });

          setUploadingState(prev => ({
            ...prev,
            [uploadKey]: { percent: 100, status: 'Complete' }
          }));
          setTimeout(() => {
            setUploadingState(prev => {
              const copy = { ...prev };
              delete copy[uploadKey];
              return copy;
            });
          }, 1500);
        } else {
          // Chunk storage
          setUploadingState(prev => ({
            ...prev,
            [uploadKey]: { percent: 25, status: 'Packaging layers...' }
          }));

          const CHUNK_SIZE = 800 * 1024;
          const chunksCount = Math.ceil(base64String.length / CHUNK_SIZE);
          
          for (let i = 0; i < chunksCount; i++) {
            const chunkData = base64String.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const chunkDocRef = doc(db, 'job_offers', offerId, 'chunks', `${type}_chunk_${i}`);
            
            const chunkProgress = 30 + Math.round((i / chunksCount) * 60);
            setUploadingState(prev => ({
              ...prev,
              [uploadKey]: { percent: chunkProgress, status: `Uploading chunk ${i+1}/${chunksCount}...` }
            }));

            await setDoc(chunkDocRef, { chunk: chunkData });
          }

          setUploadingState(prev => ({
            ...prev,
            [uploadKey]: { percent: 92, status: 'Linking reference...' }
          }));

          const updateData = type === 'offer' ? {
            signedOfferUrl: 'chunked',
            signedOfferName: file.name,
            signedOfferChunksCount: chunksCount
          } : {
            signedAcceptanceUrl: 'chunked',
            signedAcceptanceName: file.name,
            signedAcceptanceChunksCount: chunksCount
          };

          await setDoc(doc(db, 'job_offers', offerId), updateData, { merge: true });

          setUploadingState(prev => ({
            ...prev,
            [uploadKey]: { percent: 100, status: 'Complete' }
          }));
          setTimeout(() => {
            setUploadingState(prev => {
              const copy = { ...prev };
              delete copy[uploadKey];
              return copy;
            });
          }, 1500);
        }
      } catch (err: any) {
        console.error("Error setting signed document in Firestore:", err);
        setUploadingState(prev => {
          const copy = { ...prev };
          delete copy[uploadKey];
          return copy;
        });
        openConfirm(
          'Upload Error',
          `Could not save the document. ${err?.message || 'Firestore storage limits exceeded.'}`,
          () => {},
          'danger'
        );
      }
    };

    // Compress images automatically
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadingState(prev => ({
          ...prev,
          [uploadKey]: { percent: 10, status: 'Optimizing image...' }
        }));

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions for readability and compact sizing
          const maxDimension = 1200;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Export as JPEG with 0.65 quality (visually excellent but highly compact)
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
            saveToFirestore(compressedBase64);
          } else {
            saveToFirestore(reader.result as string);
          }
        };
        img.onerror = () => {
          saveToFirestore(reader.result as string);
        };
        img.src = reader.result as string;
      };
      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        setUploadingState(prev => {
          const copy = { ...prev };
          delete copy[uploadKey];
          return copy;
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Validate up to 5MB before reading
      if (file.size > maxSafeSize) {
        setUploadingState(prev => {
          const copy = { ...prev };
          delete copy[uploadKey];
          return copy;
        });
        openConfirm(
          'Document Too Large',
          `The selected file "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Please select a file under 5.0 MB.`,
          () => {},
          'warning'
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setUploadingState(prev => ({
          ...prev,
          [uploadKey]: { percent: 15, status: 'Preparing document stream...' }
        }));
        saveToFirestore(reader.result as string);
      };
      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        setUploadingState(prev => {
          const copy = { ...prev };
          delete copy[uploadKey];
          return copy;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle deleting signed document
  const handleSignedDelete = (offerId: string, type: 'offer' | 'acceptance', fileName: string) => {
    openConfirm(
      'Remove Uploaded File',
      `Are you sure you want to remove the uploaded signed document "${fileName || 'this document'}"?`,
      async () => {
        const originalOffer = offers.find(o => o.id === offerId);
        if (!originalOffer) return;

        // Clean up any existing chunks
        const oldChunksCount = type === 'offer' 
          ? (originalOffer.signedOfferChunksCount || 0) 
          : (originalOffer.signedAcceptanceChunksCount || 0);

        if (oldChunksCount > 0) {
          await deleteChunkedFile(offerId, type, oldChunksCount);
        }

        const updateData = type === 'offer' ? {
          signedOfferUrl: '',
          signedOfferName: '',
          signedOfferChunksCount: 0
        } : {
          signedAcceptanceUrl: '',
          signedAcceptanceName: '',
          signedAcceptanceChunksCount: 0
        };

        try {
          await setDoc(doc(db, 'job_offers', offerId), updateData, { merge: true });
        } catch (err) {
          console.error("Error clearing signed document in Firestore:", err);
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
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // PAGE 1: Letter Intro and Table of Employment Terms
      const rx = offer.employeeName.split(' ').map(n => n[0]).join('').toUpperCase() + offer.id.slice(0, 4).toUpperCase();
      const refNo = `PGC/HR/AP-${rx}`;
      const offerDateFormatted = offer.offerDate ? offer.offerDate.split('-').reverse().join('/') : new Date().toLocaleDateString('en-GB');

      // Heading: OFFER OF EMPLOYMENT (Large Deep Blue Centered Title)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(29, 59, 132); // Deep Blue Theme color
      const titleText = "OFFER OF EMPLOYMENT";
      doc.text(titleText, (210 - doc.getTextWidth(titleText)) / 2, 41);

      // Meta Data (Positioning below the header at y = 52)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(`Ref No: ${refNo}`, 20, 52);
      
      const dateText = `Date: ${offerDateFormatted}`;
      doc.text(dateText, 190 - doc.getTextWidth(dateText), 52);

      // Recipient Address Block
      doc.setFontSize(10.5);
      doc.setFont("Helvetica", "bold");
      doc.text(`To: Mr. ${offer.employeeName},`, 20, 64);
      doc.setFont("Helvetica", "normal");
      
      let nextY = 69.5;
      
      doc.text(`Passport Number – ${offer.passportNumber || 'N/A'}`, 20, nextY);
      nextY += 5.5;
      
      doc.text(`Mobile Contact – ${offer.mobileNumber || 'N/A'}`, 20, nextY);
      nextY += 5.5;
      
      if (offer.email) {
        doc.text(`Email Address – ${offer.email}`, 20, nextY);
        nextY += 5.5;
      }
      
      if (offer.emiratesIdNumber && offer.emiratesIdNumber.trim() !== '') {
        doc.text(`Emirates ID – ${offer.emiratesIdNumber}`, 20, nextY);
        nextY += 5.5;
      }
      
      nextY += 4.5; // Gap before subject
      
      // Subject
      doc.setFont("Helvetica", "bold");
      doc.text(`Subject: Employment Offer for the Position of ${offer.position}`, 20, nextY);
      nextY += 11.5; // Gap before Salutation
      
      // Salutation & Opening Paragraph
      doc.text(`Dear Mr. ${offer.employeeName},`, 20, nextY);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      nextY += 6; // Gap before paragraph
      
      const p1 = `We are pleased to extend this formal offer of employment to you for the position of ${offer.position} with Pioneer General Contracting LLC, based in Abu Dhabi, United Arab Emirates. We are confident that your experience and professional background will be valuable to our team and projects.`;
      const splitP1 = doc.splitTextToSize(p1, 170);
      doc.text(splitP1, 20, nextY);
      
      const p1Height = splitP1.length * 4.8;
      let tableY = nextY + p1Height + 8;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(29, 59, 132); // Deep Blue Theme color
      doc.text("Employment Terms", 20, tableY - 3);

      const termsData = [
        ["Position", offer.position],
        ["Reporting To", "As assigned by the management"],
        ["Work Location", "UAE"],
        ["Basic Salary", formatAED(offer.salary || 0)],
        ["Housing Allowance", formatAED(offer.housingAllowance || 0)],
        ["Transport Allowance", formatAED(offer.transportAllowance || 0)],
        ["Other Allowances", formatAED(offer.otherAllowance || 0)],
        ["Total Monthly Salary", formatAED((offer.salary || 0) + (offer.housingAllowance || 0) + (offer.transportAllowance || 0) + (offer.otherAllowance || 0))],
        ["Probation Period", "6 months from the date of joining"],
        ["Working Hours", "As per UAE Labor Law and company policy"],
        ["Annual Leave", "As per UAE Labor Law and company policy"],
        ["Medical Insurance", "Provided as per company policy and applicable law"]
      ];

      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setLineWidth(0.2);

      termsData.forEach(([label, value]) => {
        // Left Column background (light corporate blue #ECF5FC)
        doc.setFillColor(236, 245, 252);
        doc.rect(20, tableY, 65, 6.5, 'F');
        doc.rect(20, tableY, 65, 6.5, 'D');

        // Right Column background (White)
        doc.setFillColor(255, 255, 255);
        doc.rect(85, tableY, 105, 6.5, 'F');
        doc.rect(85, tableY, 105, 6.5, 'D');

        // Draw left label
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate 900
        doc.text(label, 23, tableY + 4.5);

        // Draw right value
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85); // slate 700
        doc.text(value, 88, tableY + 4.5);

        tableY += 6.5;
      });

      // Terms and Conditions Note Header
      let clauseY = tableY + 5;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(29, 59, 132);
      doc.text("Terms and Conditions", 20, clauseY);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const noteTxt = `Note: The following terms and conditions are to be read together with the offer letter and the applicable laws and regulations of the United Arab Emirates. In case of any conflict, the applicable law and the company's official employment policy will prevail.`;
      const splitNote = doc.splitTextToSize(noteTxt, 170);
      doc.text(splitNote, 20, clauseY + 5);

      // Dynamically calculate the next Y position based on splitNote length to prevent overlapping
      const splitNoteHeight = splitNote.length * 4.5;
      let currentY = clauseY + 5 + splitNoteHeight + 5;

      const allClauses = [
        {
          title: "1. Probation Period",
          text: `You will be on probation for a period of six (6) months from your date of joining. The probation period may be extended at the sole discretion of the Company, subject to applicable law and performance review.`
        },
        {
          title: "2. Benefits During Probation",
          text: `You will not be entitled to additional allowances, leave benefits, or other employment benefits during the probation period, except for those expressly stated in the offer letter or required under applicable law.`
        },
        {
          title: "3. Continuation of Employment",
          text: "Your performance will be reviewed periodically during the probation period. The Company may confirm, extend, or discontinue your employment based on performance, conduct, and business requirements."
        },
        {
          title: "4. Medical Fitness / Fitness for Work",
          text: "If, at any time during probation or thereafter, the Company’s appointed medical officer or Human Resources Department finds you unfit for employment, your services may be terminated in accordance with company policy and applicable law."
        },
        {
          title: "5. Employment Contract",
          text: "The employment contract shall be valid for two (2) years from the date of visa stamping and may be renewed by mutual agreement."
        },
        {
          title: "6. Work Location and Transfer",
          text: "You may be assigned to any project site, branch, or office of the Company within the United Arab Emirates as per operational requirements and management discretion."
        },
        {
          title: "7. Confidentiality",
          text: "You shall treat all company information, business data, client information, project details, drawings, methods, costs, and trade secrets as strictly confidential during and after your employment. Such information shall be used only for the purpose of performing your duties."
        },
        {
          title: "8. Restriction on Outside Work",
          text: "You shall not engage directly or indirectly in any other business, employment, consultancy, or professional activity without prior written consent from the Company."
        },
        {
          title: "9. Document Submission for Visa Processing",
          text: "You are required to submit all documents necessary for visa and employment processing, including but not limited to: signed acceptance of this offer letter, emirates id copy, passport copy, attested educational certificates, updated CV, and passport-size photographs, along with any other documents requested by the Company."
        },
        {
          title: "10. Leave Entitlement",
          text: "You will be eligible for annual leave after completion of eleven (11) months of service, in accordance with company policy and applicable law. Air ticket entitlement, if any, shall be provided as per company policy."
        },
        {
          title: "11. Performance and Conduct",
          text: "The Company reserves the right to terminate your employment in accordance with UAE Labor Law if your performance is found to be unsatisfactory, if you fail to fulfill the duties and responsibilities of your position, or if you engage in any conduct that may harm the Company’s reputation or interests."
        },
        {
          title: "12. Early Resignation / Cost Recovery",
          text: "Your employment visa and contract will be valid for a period of two (2) years. In the event that you resign before completion of this period, any applicable visa and employment-related costs may be recovered in accordance with UAE Labor Law and Company policy."
        },
        {
          title: "13. Residence Requirement",
          text: "You may be required to reside at or near the project location or any other place assigned by the Company, unless specifically exempted in writing by management."
        },
        {
          title: "14. Compliance",
          text: "You shall comply with the Company’s policies, safety rules, site instructions, confidentiality obligations, and all other lawful directions issued by management."
        },
        {
          title: "15. False Information",
          text: "If any information or document provided by you is found to be false, misleading, incomplete, or forged, the Company reserves the right to withdraw the offer or terminate employment without prejudice to any legal rights available to the Company."
        }
      ];

      let pageCount = 1;

      allClauses.forEach(item => {
        const splitText = doc.splitTextToSize(item.text, 170);
        // Calculate needed vertical height for this block:
        // Spacing before (5) + Title (4) + Text (splitText.length * 4) + spacing after (6)
        const itemNeededHeight = 5 + 4 + (splitText.length * 4) + 6;

        if (currentY + itemNeededHeight > 275) {
          doc.addPage();
          pageCount += 1;
          currentY = 52;
        }

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(item.title, 20, currentY);

        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(splitText, 20, currentY + 4);

        currentY += 4 + (splitText.length * 4) + 6;
      });

      // Check if both the Acceptance Segment and double-box signature matrix can fit on the current page
      const acceptanceBlockHeight = 55;
      if (currentY + acceptanceBlockHeight > 275) {
        doc.addPage();
        pageCount += 1;
        currentY = 52;
      }

      // Acceptance Segment
      currentY += 2;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(29, 59, 132);
      doc.text("Acceptance", 20, currentY);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("I have read, understood, and agree to abide by the above terms and conditions of employment.", 20, currentY + 5.5);

      // Signature Matrix Table (Double Box)
      const sigY = currentY + 11;
      doc.setDrawColor(15, 23, 42); // slate 900 border
      doc.setLineWidth(0.3);
      
      // For Pioneer Signatory Box
      doc.setFillColor(255, 255, 255);
      doc.rect(20, sigY, 82, 35, 'F');
      doc.rect(20, sigY, 82, 35, 'D');
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate 900
      doc.text("For Pioneer General Contracting LLC", 24, sigY + 6);
      doc.setDrawColor(15, 23, 42);
      doc.line(26, sigY + 24, 76, sigY + 24);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate 600
      doc.text("Authorized Signatory", 36, sigY + 29);

      // Accepted by Employee Signatory Box
      doc.setFillColor(255, 255, 255); // Explicitly reset fill state to white
      doc.rect(108, sigY, 82, 35, 'F');
      doc.rect(108, sigY, 82, 35, 'D');
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate 900
      doc.text("Accepted by Employee", 112, sigY + 6);
      doc.setDrawColor(15, 23, 42);
      doc.line(114, sigY + 24, 164, sigY + 24);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate 600
      doc.text("Employee Signature", 126, sigY + 29);

      // Apply Pioneer high-res dynamic Letterheads, Watermarks, and Footers across the pages
      applyPioneerLetterheadDoc(doc, pageCount);

      doc.save(`Offer_Letter_${offer.employeeName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Could not generate PDF: " + err);
    }
  };

  // PDF Generator for Acceptance Letter (Aknowledgement Statement)
  const generateAcceptanceLetterPDF = (offer: JobOffer) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const rx = offer.employeeName.split(' ').map(n => n[0]).join('').toUpperCase() + offer.id.slice(0, 4).toUpperCase();
      const code = `PNE_HR_OFFER_${offer.id.slice(0, 6).toUpperCase()}`;

      // Document Title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(29, 59, 132); // Deep blue theme
      doc.text("LETTER OF ACCEPTANCE", 105, 54, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 58, 190, 58);
      
      // Meta row
      doc.setFontSize(9.5);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Reference Offer: ${offer.id ? code : 'PNE_HR_OFFER_SAMPLE'}`, 20, 64);
      doc.text(`Date of Acceptance: ${new Date().toLocaleDateString('en-GB')}`, 190 - doc.getTextWidth(`Date of Acceptance: ${new Date().toLocaleDateString('en-GB')}`), 64);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("To: The HR Management Team, Pioneer General Contracting LLC", 20, 75);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Dear Sir/Madam,", 20, 83);
      
      const p1 = `I, the undersigned, hereby formally confirm my acceptance of your offer of employment dated ${offer.offerDate ? offer.offerDate.split('-').reverse().join('/') : 'N/A'} for the position of ${offer.position} on the salary and structure outlined below.`;
      const splitP1 = doc.splitTextToSize(p1, 170);
      doc.text(splitP1, 20, 90);
      
      let nextY = 90 + (splitP1.length * 5.5) + 6;
      
      // Confirmed Details Container
      const basic = offer.salary || 0;
      const lodging = offer.housingAllowance || 0;
      const transport = offer.transportAllowance || 0;
      const utilities = offer.otherAllowance || 0;
      const total = basic + lodging + transport + utilities;

      const hasEmail = !!offer.email;
      const hasEmiratesId = !!offer.emiratesIdNumber;

      // Calculate container height dynamically
      let lineCount = 8;
      if (hasEmail) lineCount++;
      if (hasEmiratesId) lineCount++;
      const containerHeight = 15 + (lineCount * 6) + 4;

      doc.setFillColor(248, 250, 252); // slate 50 background
      doc.rect(20, nextY, 170, containerHeight, 'F');
      doc.setDrawColor(203, 213, 225); // slate 300 border
      doc.rect(20, nextY, 170, containerHeight, 'D');

      let textY = nextY + 7;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(29, 59, 132);
      doc.text("Confirmed Terms & Personal Details:", 25, textY);

      textY += 8;
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);

      const items = [
        { label: "Full Name:", val: offer.employeeName },
        { label: "Passport Number:", val: offer.passportNumber || 'N/A' },
        { label: "Mobile Contact:", val: offer.mobileNumber || 'N/A' },
        ...(hasEmail ? [{ label: "Email Address:", val: offer.email! }] : []),
        ...(hasEmiratesId ? [{ label: "Emirates ID:", val: offer.emiratesIdNumber! }] : []),
        { label: "Designation:", val: offer.position },
        { label: "Basic Monthly Salary:", val: formatAED(basic) },
        { label: "Total Gross Monthly Salary:", val: formatAED(total) },
        { label: "Proposed Joining Date:", val: offer.joiningDate ? offer.joiningDate.split('-').reverse().join('/') : 'N/A' },
        { label: "Associated Offer Code:", val: code }
      ];

      items.forEach(item => {
        doc.setFont("Helvetica", "normal");
        doc.text(item.label, 25, textY);
        doc.setFont("Helvetica", "bold");
        doc.text(item.val, 78, textY);
        textY += 6;
      });

      nextY += containerHeight + 8;
      
      // Deceleration Paragraph
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const p2 = `By signing this letter, I agree to abide by all internal rules, regulations, safety standards, policies, and code of conduct set forth by Pioneer General Contracting LLC and UAE Ministry of Human Resources & Emiratisation (MoHRE). I will supply all relevant background documents, passport copy, original degrees, cancellation paper or visa copy immediately to ensure timely processing of my UAE residency and employment visas.`;
      const splitP2 = doc.splitTextToSize(p2, 170);
      doc.text(splitP2, 20, nextY);
      
      nextY += (splitP2.length * 5.2) + 16;
      
      // Signature lines
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.line(20, nextY, 90, nextY);
      doc.line(110, nextY, 185, nextY);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Signed On Date:", 20, nextY + 5);
      doc.setFont("Helvetica", "normal");
      doc.text(`${new Date().toLocaleDateString('en-GB')}`, 48, nextY + 5);
      
      doc.setFont("Helvetica", "bold");
      doc.text("Employee Full Name & Signature", 110, nextY + 5);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Mr. ${offer.employeeName}`, 110, nextY + 11);

      // Apply Pioneer letterhead, footer and watermark
      applyPioneerLetterheadDoc(doc, 1);
      
      doc.save(`Acceptance_Letter_${offer.employeeName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Could not generate PDF: " + err);
    }
  };

  // Filtration logic for Applicants (Tab 1)
  const filteredApplicants = applicants.filter(app => {
    const q = applicantSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (app.name && app.name.toLowerCase().includes(q)) || 
      (app.email && app.email.toLowerCase().includes(q)) || 
      (app.position && app.position.toLowerCase().includes(q)) ||
      (app.mobileNumber && app.mobileNumber.toLowerCase().includes(q)) ||
      (app.emiratesIdNumber && app.emiratesIdNumber.toLowerCase().includes(q)) ||
      (app.passportNumber && app.passportNumber.toLowerCase().includes(q)) ||
      (app.notes && app.notes.toLowerCase().includes(q))
    );
    
    const matchesPosition = applicantPositionFilter === 'All' || (app.position && app.position.trim().toLowerCase() === applicantPositionFilter.trim().toLowerCase());
    const matchesStatus = applicantStatusFilter === 'All' || app.status === applicantStatusFilter;
    
    return matchesSearch && matchesPosition && matchesStatus;
  });

  // Filtration logic for Job Offers (Tab 2)
  const filteredOffers = offers.filter(offer => {
    const q = offerSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (offer.employeeName && offer.employeeName.toLowerCase().includes(q)) ||
      (offer.position && offer.position.toLowerCase().includes(q)) ||
      (offer.passportNumber && offer.passportNumber.toLowerCase().includes(q)) ||
      (offer.emiratesIdNumber && offer.emiratesIdNumber.toLowerCase().includes(q)) ||
      (offer.mobileNumber && offer.mobileNumber.toLowerCase().includes(q)) ||
      (offer.email && offer.email.toLowerCase().includes(q)) ||
      (offer.company && offer.company.toLowerCase().includes(q)) ||
      (offer.additionalDetails && offer.additionalDetails.toLowerCase().includes(q)) ||
      (offer.joiningDate && offer.joiningDate.toLowerCase().includes(q)) ||
      (offer.offerDate && offer.offerDate.toLowerCase().includes(q))
    );

    const matchesPosition = offerPositionFilter === 'All' || (offer.position && offer.position.trim().toLowerCase() === offerPositionFilter.trim().toLowerCase());
    const matchesStatus = offerStatusFilter === 'All' || offer.status === offerStatusFilter;
    const matchesCompany = offerCompanyFilter === 'All' || (offer.company && offer.company.trim().toLowerCase() === offerCompanyFilter.trim().toLowerCase());

    return matchesSearch && matchesPosition && matchesStatus && matchesCompany;
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
                  passportNumber: '', emiratesIdNumber: '', salaryExpectation: 0, notes: '', status: 'Applied',
                  interviewType: 'F2F', interviewMeetLink: '', interviewDate: ''
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
                  email: '', emiratesIdNumber: '', company: 'Pioneer DMS Group Ltd',
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
            <button
              onClick={() => setShowReportModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-extrabold rounded-xl border border-brand-200/60 shadow-sm cursor-pointer transition-all"
            >
              <FileCheck className="w-4 h-4 text-brand-600" />
              Recruitment Report (View/PDF/Print)
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
          Object.keys(stats).map(pos => {
            const isSelected = activeTab === 'applicants' 
              ? applicantPositionFilter.toLowerCase() === pos.toLowerCase()
              : offerPositionFilter.toLowerCase() === pos.toLowerCase();
            return (
              <div 
                key={pos} 
                onClick={() => {
                  if (activeTab === 'applicants') {
                    setApplicantPositionFilter(prev => prev.toLowerCase() === pos.toLowerCase() ? 'All' : pos);
                  } else {
                    setOfferPositionFilter(prev => prev.toLowerCase() === pos.toLowerCase() ? 'All' : pos);
                  }
                }}
                className={`p-3 bg-white rounded-xl border cursor-pointer transition-all ${
                  isSelected ? 'border-brand-500 ring-2 ring-brand-100 shadow-sm bg-brand-50/20' : 'border-slate-100 hover:border-slate-300'
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
            );
          })
        )}
        {((activeTab === 'applicants' && applicantPositionFilter !== 'All') || (activeTab === 'offers' && offerPositionFilter !== 'All')) && (
          <button 
            onClick={() => {
              if (activeTab === 'applicants') setApplicantPositionFilter('All');
              else setOfferPositionFilter('All');
            }} 
            className="text-xs text-brand-600 hover:text-brand-800 font-bold underline text-left px-2 sm:col-span-2 transition-colors cursor-pointer"
          >
            Clear Position Filter ({activeTab === 'applicants' ? applicantPositionFilter : offerPositionFilter})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'applicants' 
              ? 'border-brand-600 text-brand-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          1. Applied Positions & Candidates ({filteredApplicants.length}{filteredApplicants.length !== applicants.length ? ` / ${applicants.length}` : ''})
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'offers' 
              ? 'border-brand-600 text-brand-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          2. Hired & Job Offers / Letters Hub ({filteredOffers.length}{filteredOffers.length !== offers.length ? ` / ${offers.length}` : ''})
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
                value={applicantSearchQuery}
                onChange={(e) => setApplicantSearchQuery(e.target.value)}
                placeholder="Search candidates by name, position, passport, EID, mobile..."
                className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
              {applicantSearchQuery && (
                <button
                  onClick={() => setApplicantSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  title="Clear Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Position Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Designation:</span>
                <select
                  value={applicantPositionFilter}
                  onChange={(e) => setApplicantPositionFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5 cursor-pointer"
                >
                  <option value="All">All Applied</option>
                  {Array.from(new Set([...designationsList.map(x => x.trim()), ...applicants.map(a => a.position?.trim()).filter(Boolean)])).sort().map((item, idx) => (
                    <option key={`${item}-${idx}`} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Status:</span>
                <select
                  value={applicantStatusFilter}
                  onChange={(e) => setApplicantStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Applied">Applied</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Interview Conducted">Interview Conducted</option>
                  <option value="Offered">Offered</option>
                  <option value="Hired">Hired (Approved)</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {(applicantSearchQuery || applicantPositionFilter !== 'All' || applicantStatusFilter !== 'All') && (
                <button
                  onClick={() => {
                    setApplicantSearchQuery('');
                    setApplicantPositionFilter('All');
                    setApplicantStatusFilter('All');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
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
                            <div className="flex gap-1.5 flex-wrap mt-0.5">
                              {app.passportNumber && (
                                <span className="flex items-center gap-1 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                  Passport: {app.passportNumber}
                                </span>
                              )}
                              {app.emiratesIdNumber && app.emiratesIdNumber.trim() !== '' && (
                                <span className="flex items-center gap-1 text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-700 font-semibold border border-indigo-100">
                                  EID: {app.emiratesIdNumber}
                                </span>
                              )}
                            </div>
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
                              <div className="space-y-1">
                                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse inline-block">
                                  Scheduled
                                </span>
                                {app.interviewDate && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-amber-800 bg-amber-50 rounded-lg px-2 py-0.5 border border-amber-100 w-max font-semibold shadow-2xs mt-1">
                                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                    <span>
                                      {new Date(app.interviewDate).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex flex-col gap-0.5 mt-1.5 text-[10px] text-slate-500 font-medium">
                                  {app.interviewType === 'Online' ? (
                                    <>
                                      <span className="flex items-center gap-1 text-slate-600"><Video className="w-3.5 h-3.5 text-indigo-500" /> Online Interview</span>
                                      {app.interviewMeetLink && (
                                        <a
                                          href={app.interviewMeetLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline w-max bg-indigo-50 px-1.5 py-0.5 rounded"
                                        >
                                          Join Meet <ExternalLink className="w-2.5 h-2.5 text-indigo-500" />
                                        </a>
                                      )}
                                    </>
                                  ) : (
                                    <span className="flex items-center gap-1 text-slate-600"><Users className="w-3.5 h-3.5 text-emerald-500" /> F2F Interview</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {app.status === 'Interview Conducted' && (
                              <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Conducted
                              </span>
                            )}
                            {app.status === 'Offered' && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Offered
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
                                openEditApplicant({ ...app, status: 'Interview Scheduled' });
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

          {/* Filters Row for Job Offers */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={offerSearchQuery}
                onChange={(e) => setOfferSearchQuery(e.target.value)}
                placeholder="Search offers by candidate name, position, passport, EID, mobile, company..."
                className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
              {offerSearchQuery && (
                <button
                  onClick={() => setOfferSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  title="Clear Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Position Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Designation:</span>
                <select
                  value={offerPositionFilter}
                  onChange={(e) => setOfferPositionFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5 cursor-pointer"
                >
                  <option value="All">All Designations</option>
                  {Array.from(new Set([...designationsList.map(x => x.trim()), ...offers.map(o => o.position?.trim()).filter(Boolean)])).sort().map((item, idx) => (
                    <option key={`${item}-${idx}`} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Company:</span>
                <select
                  value={offerCompanyFilter}
                  onChange={(e) => setOfferCompanyFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5 cursor-pointer max-w-[160px] truncate"
                >
                  <option value="All">All Companies</option>
                  {Array.from(new Set([...(companies || []).map(c => c.name?.trim()).filter(Boolean), ...offers.map(o => o.company?.trim()).filter(Boolean), 'Pioneer DMS Group Ltd'])).sort().map((comp, idx) => (
                    <option key={`${comp}-${idx}`} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">Status:</span>
                <select
                  value={offerStatusFilter}
                  onChange={(e) => setOfferStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none border-none py-0.5 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Offered">Offered</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>

              {(offerSearchQuery || offerPositionFilter !== 'All' || offerStatusFilter !== 'All' || offerCompanyFilter !== 'All') && (
                <button
                  onClick={() => {
                    setOfferSearchQuery('');
                    setOfferPositionFilter('All');
                    setOfferStatusFilter('All');
                    setOfferCompanyFilter('All');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 bg-white border rounded-2xl">
              <span className="text-xs text-slate-400">Syncing job offers database, please wait...</span>
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
              <FileCheck className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <h3 className="text-sm font-bold text-slate-700 mt-2">No Job Offers Issued Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Issue a standalone offer using "Draft Job Offer" above or transition any applied candidate to draft status.
              </p>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
              <Search className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <h3 className="text-sm font-bold text-slate-700 mt-2">No Matching Job Offers Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No job offers match your search query {offerSearchQuery ? `"${offerSearchQuery}"` : ''} or selected filters.
              </p>
              <button
                onClick={() => {
                  setOfferSearchQuery('');
                  setOfferPositionFilter('All');
                  setOfferStatusFilter('All');
                  setOfferCompanyFilter('All');
                }}
                className="mt-3 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Reset Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOffers.map((offer) => {
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
                        {offer.email && (
                          <div className="col-span-2">
                            <span className="font-bold text-slate-400 block uppercase text-[8px]">Email Address</span>
                            <span className="text-slate-900 font-medium">{offer.email}</span>
                          </div>
                        )}
                        {offer.emiratesIdNumber && offer.emiratesIdNumber.trim() !== '' && (
                          <div className="col-span-2">
                            <span className="font-bold text-slate-400 block uppercase text-[8px]">Emirates ID Number</span>
                            <span className="text-slate-900 font-mono font-bold">{offer.emiratesIdNumber}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-slate-400 block uppercase text-[8px]">Offered Company</span>
                          <span className="text-brand-900 font-extrabold">{offer.company || 'Not Specified'}</span>
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
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="text-[10px] text-slate-400 font-bold">Status:</span>
                        <select
                          value={offer.status}
                          onChange={async (e) => {
                            if (!canManage) return;
                            try {
                              await setDoc(doc(db, 'job_offers', offer.id), { status: e.target.value as any }, { merge: true });
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

                      <div className="flex items-center gap-1.5 font-sans">
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
                          onClick={() => setShowSignedUploadsId(showSignedUploadsId === offer.id ? null : offer.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-all text-[10px] font-black ${
                            offer.signedOfferUrl || offer.signedAcceptanceUrl
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                          }`}
                          title="Manage Uploaded Signed Offer & Acceptance files"
                        >
                          <Upload className="w-3 h-3" />
                          Signed Docs
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

                    {showSignedUploadsId === offer.id && (
                      <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/65 space-y-3 animate-in slide-in-from-top-1 duration-200 w-full text-left font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <FileText className="w-3 h-3 text-indigo-600" />
                            Signed Upload Center
                          </span>
                          <button
                            onClick={() => setShowSignedUploadsId(null)}
                            className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase"
                          >
                            Hide
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Signed Offer Letter Slot */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-2 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] font-black text-slate-500 uppercase block leading-none">
                                Signed Offer Letter
                              </span>
                              {uploadingState[`${offer.id}_offer`] ? (
                                <div className="mt-1.5 p-1.5 bg-indigo-50/50 rounded border border-indigo-100/80 space-y-1">
                                  <div className="flex justify-between items-center text-[7.5px] font-bold text-indigo-700">
                                    <span className="truncate max-w-[100px] animate-pulse">
                                      {uploadingState[`${offer.id}_offer`].status}
                                    </span>
                                    <span>{uploadingState[`${offer.id}_offer`].percent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div 
                                      className="bg-indigo-600 h-1 rounded-full transition-all duration-300" 
                                      style={{ width: `${uploadingState[`${offer.id}_offer`].percent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : offer.signedOfferUrl ? (
                                <div className="mt-1.5 flex items-center justify-between gap-1.5 p-1 px-2 bg-emerald-50/55 rounded border border-emerald-100">
                                  <span className="text-[8px] text-emerald-800 font-bold truncate max-w-[120px]" title={offer.signedOfferName}>
                                    {offer.signedOfferName || 'signed_offer.pdf'}
                                  </span>
                                  {fetchingFile?.id === offer.id && fetchingFile?.type === 'offer' ? (
                                    <span className="text-[8px] font-bold text-indigo-600 animate-pulse flex items-center gap-1">
                                      <span>Retrieving Chunks...</span>
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handlePreviewLoadedFile(offer, 'offer')}
                                        className="p-0.5 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
                                        title="Preview File"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                      <a
                                        href={offer.signedOfferUrl}
                                        onClick={(e) => handleDownloadLoadedFile(e, offer, 'offer')}
                                        download={offer.signedOfferName || 'signed_offer.pdf'}
                                        className="p-0.5 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                      <button
                                        onClick={() => handleSignedDelete(offer.id, 'offer', offer.signedOfferName || 'Signed Offer Letter')}
                                        className="p-0.5 text-rose-600 hover:text-rose-800 rounded cursor-pointer"
                                        title="Delete File"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[8px] text-slate-400 mt-1">Accepts PDF or images</p>
                              )}
                            </div>

                            {!offer.signedOfferUrl && !uploadingState[`${offer.id}_offer`] && (
                              <label className="mt-1.5 flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[8px] font-bold rounded cursor-pointer transition-all border border-slate-200">
                                <Upload className="w-2.5 h-2.5 text-slate-500" />
                                <span>Choose Signed File</span>
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleSignedUpload(offer.id, 'offer', file);
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          {/* Signed Acceptance Letter Slot */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-2 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] font-black text-slate-500 uppercase block leading-none">
                                Signed Acceptance
                              </span>
                              {uploadingState[`${offer.id}_acceptance`] ? (
                                <div className="mt-1.5 p-1.5 bg-indigo-50/50 rounded border border-indigo-100/80 space-y-1">
                                  <div className="flex justify-between items-center text-[7.5px] font-bold text-indigo-700">
                                    <span className="truncate max-w-[100px] animate-pulse">
                                      {uploadingState[`${offer.id}_acceptance`].status}
                                    </span>
                                    <span>{uploadingState[`${offer.id}_acceptance`].percent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div 
                                      className="bg-indigo-600 h-1 rounded-full transition-all duration-300" 
                                      style={{ width: `${uploadingState[`${offer.id}_acceptance`].percent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : offer.signedAcceptanceUrl ? (
                                <div className="mt-1.5 flex items-center justify-between gap-1.5 p-1 px-2 bg-emerald-50/55 rounded border border-emerald-100">
                                  <span className="text-[8px] text-emerald-800 font-bold truncate max-w-[120px]" title={offer.signedAcceptanceName}>
                                    {offer.signedAcceptanceName || 'signed_acceptance.pdf'}
                                  </span>
                                  {fetchingFile?.id === offer.id && fetchingFile?.type === 'acceptance' ? (
                                    <span className="text-[8px] font-bold text-indigo-600 animate-pulse flex items-center gap-1">
                                      <span>Retrieving Chunks...</span>
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handlePreviewLoadedFile(offer, 'acceptance')}
                                        className="p-0.5 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
                                        title="Preview File"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                      <a
                                        href={offer.signedAcceptanceUrl}
                                        onClick={(e) => handleDownloadLoadedFile(e, offer, 'acceptance')}
                                        download={offer.signedAcceptanceName || 'signed_acceptance.pdf'}
                                        className="p-0.5 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                      <button
                                        onClick={() => handleSignedDelete(offer.id, 'acceptance', offer.signedAcceptanceName || 'Signed Acceptance Letter')}
                                        className="p-0.5 text-rose-600 hover:text-rose-800 rounded cursor-pointer"
                                        title="Delete File"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[8px] text-slate-400 mt-1">Accepts PDF or images</p>
                              )}
                            </div>

                            {!offer.signedAcceptanceUrl && !uploadingState[`${offer.id}_acceptance`] && (
                              <label className="mt-1.5 flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[8px] font-bold rounded cursor-pointer transition-all border border-slate-200">
                                <Upload className="w-2.5 h-2.5 text-slate-500" />
                                <span>Choose Signed File</span>
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleSignedUpload(offer.id, 'acceptance', file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: RECRUITMENT LIFE-CYCLE REPORT ================= */}
      <RecruitmentReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        applicants={applicants}
        offers={offers}
      />

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
                    Emirates ID Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={applicantForm.emiratesIdNumber}
                    onChange={(e) => setApplicantForm({ ...applicantForm, emiratesIdNumber: e.target.value })}
                    placeholder="e.g. 784-1234-5678901-2"
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
                      {Array.from(new Set([...designationsList.map(x => x.trim()), ...applicants.map(a => a.position?.trim()).filter(Boolean)])).sort().map((item, idx) => (
                        <option key={`${item}-${idx}`} value={item} />
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
                    <option value="Offered">Offered</option>
                    <option value="Hired">Hired (Approved)</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {applicantForm.status === 'Interview Scheduled' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Interview Type *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors w-1/2">
                        <input
                          type="radio"
                          name="interviewType"
                          value="F2F"
                          checked={applicantForm.interviewType === 'F2F'}
                          onChange={() => setApplicantForm({ ...applicantForm, interviewType: 'F2F' })}
                          className="accent-brand-600 h-4 w-4"
                        />
                        <span>F2F (Face to face)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors w-1/2">
                        <input
                          type="radio"
                          name="interviewType"
                          value="Online"
                          checked={applicantForm.interviewType === 'Online'}
                          onChange={() => setApplicantForm({ ...applicantForm, interviewType: 'Online' })}
                          className="accent-brand-600 h-4 w-4"
                        />
                        <span>Online</span>
                      </label>
                    </div>
                  </div>

                  {applicantForm.interviewType === 'Online' && (
                    <div className="space-y-1 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Google Meet Link Selection
                      </label>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Generate an instant meeting link for this candidate.
                      </p>
                      <GoogleMeetGenerator
                        meetLink={applicantForm.interviewMeetLink || undefined}
                        onChange={(link) => setApplicantForm({ ...applicantForm, interviewMeetLink: link || '' })}
                      />
                    </div>
                  )}

                  {/* Interview Date & Time Selection (UPGRADE 1) */}
                  <div className="pt-2 border-t border-slate-100/80 space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Scheduled Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={applicantForm.interviewDate || ''}
                      onChange={(e) => setApplicantForm({ ...applicantForm, interviewDate: e.target.value })}
                      required={applicantForm.status === 'Interview Scheduled'}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none font-bold text-slate-800"
                    />
                  </div>

                  {/* Dynamic Dispatch Invitation Copy-paste Segment (UPGRADE 1) */}
                  <div className="p-3 bg-brand-50/50 border border-brand-100/60 rounded-xl space-y-2 text-[11px] text-slate-750 animate-in fade-in duration-200">
                    <span className="font-extrabold text-brand-800 uppercase tracking-wider block text-[9px]">
                      📤 Direct Dispatch Candidate Invitation Template
                    </span>
                    <p className="leading-snug text-slate-500 text-[10px]">
                      Copy and send this invite to candidate <strong>{applicantForm.name || 'Candidate'}</strong>:
                    </p>
                    <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg text-slate-600 font-mono text-[10px] leading-relaxed relative group select-all">
                      <pre className="whitespace-pre-wrap bg-transparent w-full pr-12 font-mono scrollbar-thin">
{`Dear ${applicantForm.name || 'Candidate'},

We are pleased to invite you for an interview for the position of ${applicantForm.position || 'Employee'}.

📅 Date & Time: ${applicantForm.interviewDate ? new Date(applicantForm.interviewDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'To Be Decided'}
📍 Format: ${applicantForm.interviewType === 'Online' ? 'Online Interview Space (Google Meet)' : 'Face-to-Face (F2F) Interview'}
${applicantForm.interviewType === 'Online' && applicantForm.interviewMeetLink ? `🔗 Join Access Link: ${applicantForm.interviewMeetLink}` : ''}

Please confirm your availability.

Warm regards,
Recruitment Team
Pioneer DMS`}
                      </pre>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `Dear ${applicantForm.name || 'Candidate'},\n\nWe are pleased to invite you for an interview for the position of ${applicantForm.position || 'Employee'}.\n\n📅 Date & Time: ${applicantForm.interviewDate ? new Date(applicantForm.interviewDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'To Be Decided'}\n📍 Format: ${applicantForm.interviewType === 'Online' ? 'Online Interview Space (Google Meet)' : 'Face-to-Face (F2F) Interview'}${applicantForm.interviewType === 'Online' && applicantForm.interviewMeetLink ? `\n🔗 Join Access Link: ${applicantForm.interviewMeetLink}` : ''}\n\nPlease confirm your availability.\n\nWarm regards,\nRecruitment Team\nPioneer DMS`;
                          navigator.clipboard.writeText(text);
                          alert('Invitation copied to clipboard successfully!');
                        }}
                        className="absolute right-2 top-2 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg text-[9px] font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                      {Array.from(new Set([...designationsList.map(x => x.trim()), ...applicants.map(a => a.position?.trim()).filter(Boolean)])).sort().map((item, idx) => (
                        <option key={`${item}-${idx}`} value={item} />
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
                    Offered Company *
                  </label>
                  <select
                    required
                    value={offerForm.company}
                    onChange={(e) => setOfferForm({ ...offerForm, company: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none bg-white text-slate-900 font-bold"
                  >
                    <option value="">Select Company</option>
                    {(companies || []).map(c => (
                      <option key={c.id} value={c.name}>{c.code} - {c.name}</option>
                    ))}
                  </select>
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
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={offerForm.email}
                    onChange={(e) => setOfferForm({ ...offerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                    placeholder="e.g. candidate@example.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Emirates ID Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={offerForm.emiratesIdNumber}
                    onChange={(e) => setOfferForm({ ...offerForm, emiratesIdNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                    placeholder="e.g. 784-1234-5678901-2"
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

      {/* ================= MODAL: SIGNED DOCUMENT PREVIEW ================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-black text-slate-900 truncate">
                Preview: {previewDoc.name}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition-all shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button 
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 px-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-800 text-[10px] font-black"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-100 p-4 flex items-center justify-center min-h-[350px]">
              {previewDoc.url.startsWith('data:image/') ? (
                <img 
                  src={previewDoc.url} 
                  alt={previewDoc.name} 
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[70vh] rounded-lg shadow-md object-contain border border-slate-200"
                />
              ) : previewDoc.url.startsWith('data:application/pdf') ? (
                <div className="w-full h-[70vh] flex flex-col items-center justify-center bg-white rounded-xl shadow-xs p-8 text-center space-y-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                    <FileText className="w-12 h-12 stroke-1" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">PDF Document Ready</h4>
                  <p className="text-xs text-slate-500 max-w-md">
                    Due to sandboxed browser security rules, inline rendering of base64 PDFs is restricted. Please click the download button below to load or save your file locally.
                  </p>
                  <a
                    href={previewDoc.url}
                    download={previewDoc.name}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md"
                  >
                    <Download className="w-4 h-4" /> Save / Open PDF Document
                  </a>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs font-bold bg-white rounded-xl shadow-xs">
                  Unsupported file format preview. Please use the Download button in the header.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
