import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Employee, JobOffer, PassportAcknowledgement } from '../types';
import { 
  Search, FileText, FileDown, Calendar, User, Building, Award, 
  ChevronRight, CheckSquare, ShieldCheck, Printer, Trash2, PlusCircle, Sparkles, Check
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../services/storageService';

export const downloadPassportAcknowledgementPDF = (record: PassportAcknowledgement) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const issueDate = record.date || new Date().toISOString().split('T')[0];
    const signatoryName = record.signatoryName || "Authorized Manager / HR Director";
    const signatoryTitle = record.signatoryTitle || "Human Resources Department";
    
    // Top colored indicator bars (Pioneer DMS Branding)
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(79, 70, 229); // Royal Indigo-600
    doc.rect(0, 8, 210, 2, 'F');

    // Corporate Head Name
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("PIONEER GENERAL CONTRACTING LLC", 20, 24);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Pioneer Document Management Work Portal — Passport Custody Division", 20, 30);
    
    // Line divider
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.4);
    doc.line(20, 37, 190, 37);

    // Metadata Block
    const formattedIssueDate = new Date(issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(`Date: ${formattedIssueDate}`, 20, 46);
    doc.text(`Ref No: ${record.refNo || 'PGC/HR/PA/TEMP'}`, 20, 52);

    let yPos = 68;

    // Headline Centered and Underlined
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // Black Slate
    const headline = "PASSPORT COLLECTION ACKNOWLEDGEMENT";
    const headlineWidth = doc.getTextWidth(headline);
    doc.text(headline, 105 - (headlineWidth / 2), yPos);
    
    // Underline the headline
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(105 - (headlineWidth / 2), yPos + 1.5, 105 + (headlineWidth / 2), yPos + 1.5);

    yPos += 14;

    // Salutation
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("To Whom It May Concern,", 20, yPos);

    yPos += 8;

    // Explanation Text
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85); // Slate-700
    const bodyText = "This is to confirm that the Company has collected the original passport from the below-mentioned employee for official company and administrative purposes.";
    const splitBody = doc.splitTextToSize(bodyText, 170);
    doc.text(splitBody, 20, yPos);

    yPos += (splitBody.length * 5.5) + 10;

    // Grid Table Formulation
    const tableData = [
        { label: "Employee Name", value: record.employeeName },
        { label: "Employee ID", value: record.employeeId || "N/A" },
        { label: "Passport Number", value: record.passportNumber },
        { label: "Nationality", value: record.nationality },
        { label: "Date of Collection", value: formattedIssueDate },
        { label: "Purpose", value: record.purpose }
    ];

    const startX = 20;
    const colWidths = [55, 115]; // label width (55mm) + value width (115mm) = 170mm total
    const rowHeight = 9;

    // Draw Table borders and content
    doc.setDrawColor(30, 41, 59); // Slate-800
    doc.setLineWidth(0.35);

    tableData.forEach((row, index) => {
        const currentY = yPos + (index * rowHeight);
        
        // Draw Label Cell
        doc.setFillColor(248, 250, 252); // Soft light grey fill (Slate-50)
        doc.rect(startX, currentY, colWidths[0], rowHeight, 'F');
        doc.rect(startX, currentY, colWidths[0], rowHeight, 'S');
        
        // Label Text
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text(row.label, startX + 4, currentY + 6);

        // Draw Value Cell
        doc.rect(startX + colWidths[0], currentY, colWidths[1], rowHeight, 'S');
        
        // Value Text
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        
        const textVal = row.value || "—";
        const splitVal = doc.splitTextToSize(textVal, colWidths[1] - 8);
        doc.text(splitVal[0], startX + colWidths[0] + 4, currentY + 6);
    });

    yPos += (tableData.length * rowHeight) + 12;

    // Safekeep Cautionary Note
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // Slate-600
    const safeNote = "The passport will be kept safely by the Company and will be returned to the employee upon completion of the required official process or upon request, subject to Company policy and applicable regulations.";
    const splitNote = doc.splitTextToSize(safeNote, 170);
    doc.text(splitNote, 20, yPos);

    yPos += (splitNote.length * 5) + 25;

    // Signatures Area
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);

    doc.text("Employee Signature: __________________", 20, yPos);
    doc.text("Authorized Signatory: __________________", 110, yPos);

    // Title / subtitle of signatory under Authorized
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Name: ${signatoryName}`, 110, yPos + 6);
    doc.text(`Title: ${signatoryTitle}`, 110, yPos + 11);

    // Save/intercept output
    doc.save(`Passport_Acknowledgement_${record.employeeName.replace(/\s+/g, '_')}.pdf`);
};

export const PassportAcknowledgementView: React.FC<{
  employees: Employee[];
}> = ({ employees }) => {
    // Realtime collections state
    const [jobOffers, setJobOffers] = useState<JobOffer[]>([]);
    const [savedRecords, setSavedRecords] = useState<PassportAcknowledgement[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Active Formulation States
    const [selectedEntity, setSelectedEntity] = useState<{ type: 'employee' | 'job_offer' | 'manual'; id?: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');

    // Form fields mapped exactly to schema
    const [refNo, setRefNo] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [employeeId, setEmployeeId] = useState<string>('');
    const [employeeName, setEmployeeName] = useState<string>('');
    const [passportNumber, setPassportNumber] = useState<string>('');
    const [nationality, setNationality] = useState<string>('');
    const [purpose, setPurpose] = useState<string>('Visa / Labor / Immigration / Official Processing');
    const [signatoryName, setSignatoryName] = useState<string>('Super Admin');
    const [signatoryTitle, setSignatoryTitle] = useState<string>('Authorized Manager');

    // Action status states
    const [saving, setSaving] = useState<boolean>(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Listen to Job Offers and Saved Acknowledgements in Firestore
    useEffect(() => {
        setLoading(true);
        
        // 1. Subscribe to Job Offers
        const qOffers = query(collection(db, 'job_offers'), orderBy('employeeName', 'asc'));
        const unsubOffers = onSnapshot(qOffers, (snap) => {
            const list: JobOffer[] = [];
            snap.forEach((d) => {
                list.push({ id: d.id, ...d.data() } as JobOffer);
            });
            setJobOffers(list);
        }, (err) => {
            console.error(err);
            handleFirestoreError(err, OperationType.LIST, 'job_offers');
        });

        // 2. Subscribe to Saved Acknowledgements
        const qPP = query(collection(db, 'passport_acknowledgements'), orderBy('createdAt', 'desc'));
        const unsubPP = onSnapshot(qPP, (snap) => {
            const list: PassportAcknowledgement[] = [];
            snap.forEach((d) => {
                list.push({ id: d.id, ...d.data() } as PassportAcknowledgement);
            });
            setSavedRecords(list);
            setLoading(false);
        }, (err) => {
            console.error(err);
            handleFirestoreError(err, OperationType.LIST, 'passport_acknowledgements');
            setLoading(false);
        });

        return () => {
            unsubOffers();
            unsubPP();
        };
    }, []);

    // Filtered lists for Employee selection panel
    const filteredEmployees = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        
        // Match from system Employees
        const matchEmps = employees.filter(emp => 
            emp.name.toLowerCase().includes(term) || 
            emp.code.toLowerCase().includes(term) ||
            (emp.documents?.passportNumber && emp.documents.passportNumber.toLowerCase().includes(term))
        ).map(emp => ({
            id: emp.id,
            name: emp.name,
            code: emp.code,
            type: 'employee' as const,
            passportNumber: emp.documents?.passportNumber || '',
            nationality: emp.nationality || '',
            details: `${emp.designation} • ${emp.company || 'Pioneer'}`
        }));

        // Match from Job Offers
        const matchOffers = jobOffers.filter(offer => 
            offer.employeeName.toLowerCase().includes(term) || 
            (offer.passportNumber && offer.passportNumber.toLowerCase().includes(term))
        ).map(offer => ({
            id: offer.id,
            name: offer.employeeName,
            code: 'New Hire Job Offer',
            type: 'job_offer' as const,
            passportNumber: offer.passportNumber || '',
            nationality: '', // Typically missing, filled in manual
            details: `${offer.position} • Status: ${offer.status}`
        }));

        return [...matchEmps, ...matchOffers].slice(0, 10);
    }, [searchTerm, employees, jobOffers]);

    // Handle selection from directory results
    const handleSelectEntity = (ent: {
        id: string;
        name: string;
        code: string;
        type: 'employee' | 'job_offer';
        passportNumber: string;
        nationality: string;
    }) => {
        setSelectedEntity({ type: ent.type, id: ent.id });
        setEmployeeName(ent.name);
        setEmployeeId(ent.type === 'employee' ? ent.code : 'TEM-NEW');
        setPassportNumber(ent.passportNumber || '');
        setNationality(ent.nationality || '');
        
        // Generate elegant serial RefNo
        const initials = ent.name.split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('').toUpperCase() || 'EMP';
        const dateObj = new Date(date);
        const randNum = Math.floor(1000 + Math.random() * 9000);
        setRefNo(`PGC/HR/PA/${initials}${dateObj.getFullYear().toString().slice(-2)}${String(dateObj.getMonth()+1).padStart(2,'0')}-${randNum}`);
        setSearchTerm('');
        setActiveSavedId(null);
    };

    // Manual start from scratch
    const handleStartManual = () => {
        setSelectedEntity({ type: 'manual' });
        setEmployeeName('');
        setEmployeeId('');
        setPassportNumber('');
        setNationality('');
        setDate(new Date().toISOString().split('T')[0]);
        setRefNo(`PGC/HR/PA/M${Math.floor(100 + Math.random() * 900)}-${Date.now().toString().slice(-4)}`);
        setActiveSavedId(null);
    };

    // Load saved record for editing/preview
    const handleLoadSavedRecord = (rec: PassportAcknowledgement) => {
        setActiveSavedId(rec.id);
        setSelectedEntity({ type: 'manual', id: rec.id }); // Mapped logically
        setRefNo(rec.refNo);
        setDate(rec.date);
        setEmployeeName(rec.employeeName);
        setEmployeeId(rec.employeeId || '');
        setPassportNumber(rec.passportNumber);
        setNationality(rec.nationality);
        setPurpose(rec.purpose);
        setSignatoryName(rec.signatoryName || 'Super Admin');
        setSignatoryTitle(rec.signatoryTitle || 'Authorized Manager');
    };

    // Save current acknowledgement record to Firebase database
    const handleSaveRecord = async () => {
        if (!employeeName.trim() || !passportNumber.trim() || !nationality.trim()) {
            setErrorMsg("Employee Name, Passport Number, and Nationality are absolutely necessary to validate custody.");
            setTimeout(() => setErrorMsg(null), 5000);
            return;
        }

        setSaving(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        const recordId = activeSavedId || `ppa_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
        
        const finalRecord: PassportAcknowledgement = {
            id: recordId,
            refNo: refNo || `PGC/HR/PA-${Math.floor(1000 + Math.random() * 9000)}`,
            date,
            employeeId,
            employeeName,
            passportNumber,
            nationality,
            purpose,
            signatoryName,
            signatoryTitle,
            createdAt: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, 'passport_acknowledgements', recordId), finalRecord);
            setSuccessMsg(`Custody letter for ${employeeName} saved successfully!`);
            setActiveSavedId(recordId);
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch (err) {
            console.error(err);
            handleFirestoreError(err, OperationType.WRITE, `passport_acknowledgements/${recordId}`);
            setErrorMsg("A system processing error occurred while attempting to write to the cloud database storage.");
        } finally {
            setSaving(false);
        }
    };

    // Delete record
    const handleDeleteRecord = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'passport_acknowledgements', id));
            if (activeSavedId === id) {
                // reset fields
                setActiveSavedId(null);
                setSelectedEntity(null);
            }
            setDeleteConfirmId(null);
            setSuccessMsg("PASSPORT CUSTODY DISCARDED SUCCESSFULLY.");
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            console.error(err);
            handleFirestoreError(err, OperationType.DELETE, `passport_acknowledgements/${id}`);
            setErrorMsg("An error occurred. Unable to delete custody profile.");
        }
    };

    // Trigger printed copy directly in iframe context safely
    const handleDirectPrintRecord = () => {
        const recordMock: PassportAcknowledgement = {
            id: activeSavedId || 'temp',
            refNo: refNo || 'PGC/HR/PA-TEMP',
            date,
            employeeId,
            employeeName,
            passportNumber,
            nationality,
            purpose,
            signatoryName,
            signatoryTitle,
            createdAt: new Date().toISOString()
        };
        downloadPassportAcknowledgementPDF(recordMock);
    };

    // Filter saved list based on search bar
    const filteredSavedRecords = useMemo(() => {
        if (!savedSearchQuery.trim()) return savedRecords;
        const queryVal = savedSearchQuery.toLowerCase();
        return savedRecords.filter(rec => 
            rec.employeeName.toLowerCase().includes(queryVal) ||
            rec.passportNumber.toLowerCase().includes(queryVal) ||
            rec.refNo.toLowerCase().includes(queryVal) ||
            (rec.employeeId && rec.employeeId.toLowerCase().includes(queryVal))
        );
    }, [savedSearchQuery, savedRecords]);

    return (
        <div id="passport-ack-view" className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Compliance Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-2">
                <div className="space-y-1">
                    <span className="text-xs font-black tracking-widest text-indigo-600 uppercase">Employment Formalities Suite</span>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-6.5 h-6.5 text-indigo-600" /> Passport Collection Acknowledgement
                    </h1>
                    <p className="text-sm text-slate-500">
                        Record secure corporate custody and generate legitimate formal Passport Collection Acknowledgements for current employees and onboarding job candidates.
                    </p>
                </div>
                
                <button 
                    onClick={handleStartManual}
                    className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-extrabold hover:bg-indigo-700 transition-colors shadow-sm ml-auto cursor-pointer"
                >
                    <PlusCircle className="w-4 h-4" /> Start Manual Blank Draft
                </button>
            </div>

            {/* Error/Success Notifications */}
            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 flex items-center gap-2.5 text-xs font-bold shadow-sm animate-fade-in">
                    <Check className="w-4 h-4 text-emerald-600" /> {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-semibold shadow-sm animate-fade-in">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. Left Selection Column (5 cols) */}
                <div className="lg:col-span-4 space-y-5">
                    
                    {/* Select Selection Block */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" /> Start Custody Document
                        </h3>
                        
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                            <input 
                                type="text"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                                placeholder="Search employees or newly hired candidates..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Dropdown list of filtered results */}
                        {filteredEmployees.length > 0 && (
                            <div className="border border-slate-100 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-50 bg-white shadow-md">
                                {filteredEmployees.map((ent, i) => (
                                    <button
                                        key={`${ent.type}-${ent.id || i}-${i}`}
                                        onClick={() => handleSelectEntity(ent)}
                                        className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-slate-50 transition-colors cursor-pointer group"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">{ent.name}</p>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    ent.type === 'employee' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                    {ent.type === 'employee' ? 'Staff' : 'Candidate'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{ent.code} • {ent.details}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {!selectedEntity && !searchTerm.trim() && (
                            <div className="text-center py-6 text-slate-400 italic text-xs font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-100">
                                Enter a staff's name or search criteria above to auto-fill their document fields.
                            </div>
                        )}

                        {selectedEntity && (
                            <div className="p-4 bg-indigo-50/60 border border-indigo-100/50 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                    <span className="text-xs font-extrabold text-slate-700">Active Formulary Selected</span>
                                </div>
                                <p className="text-sm font-extrabold text-slate-800">{employeeName || "Custom Draft Form"}</p>
                                <p className="text-[10px] text-slate-500 font-bold">
                                    Entity ID: <span className="text-slate-700">{employeeId || "Custom"}</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Saved Acknowledgement History */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" /> Custody Log Directory ({savedRecords.length})
                            </h3>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
                                placeholder="Filter saved custody files..."
                                value={savedSearchQuery}
                                onChange={e => setSavedSearchQuery(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <p className="text-center py-6 text-xs text-slate-400 italic">Syncing records securely with Firestore...</p>
                        ) : filteredSavedRecords.length === 0 ? (
                            <p className="text-center py-6 text-xs text-slate-400 italic">No saved acknowledgrements found.</p>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                                {filteredSavedRecords.map((rec, i) => (
                                    <div 
                                        key={`${rec.id || i}-${i}`}
                                        onClick={() => handleLoadSavedRecord(rec)}
                                        className={`py-3 px-2 flex justify-between items-center cursor-pointer transition-all rounded-lg select-none ${
                                            activeSavedId === rec.id ? 'bg-indigo-50/70 shadow-xs border-l-3 border-indigo-600 pl-3' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-extrabold text-slate-800">{rec.employeeName}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{rec.refNo}</p>
                                            <p className="text-[9px] text-slate-500 font-semibold flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-400" /> {new Date(rec.date).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            {deleteConfirmId === rec.id ? (
                                                <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-lg border border-rose-100">
                                                    <span className="text-[10px] text-rose-700 font-extrabold px-1">Discard?</span>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteRecord(rec.id);
                                                        }}
                                                        className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black hover:bg-rose-700 cursor-pointer"
                                                    >
                                                        Yes
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirmId(null);
                                                        }}
                                                        className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold hover:bg-slate-300 cursor-pointer"
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            downloadPassportAcknowledgementPDF(rec);
                                                        }}
                                                        className="p-1 px-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                                                        title="Download formal PDF"
                                                    >
                                                        <FileDown className="w-3.5 h-3.5" />
                                                     </button>
                                                     <button 
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             setDeleteConfirmId(rec.id);
                                                         }}
                                                         className="p-1 px-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                                                         title="Delete entry"
                                                     >
                                                         <Trash2 className="w-3.5 h-3.5" />
                                                     </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* 2. Middle Editor & Forms (4 cols) */}
                <div className="lg:col-span-4 space-y-5">
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">Document Configuration</h3>
                        
                        {selectedEntity ? (
                            <div className="space-y-3.5 text-xs">
                                
                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Receipt Reference No</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={refNo}
                                        onChange={e => setRefNo(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Collection Date</label>
                                    <input 
                                        type="date"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Employee Name</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={employeeName}
                                        onChange={e => setEmployeeName(e.target.value)}
                                        placeholder="Full legal employee name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Employee ID / Code</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={employeeId}
                                        onChange={e => setEmployeeId(e.target.value)}
                                        placeholder="e.g. TEM004"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Passport Number</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={passportNumber}
                                        onChange={e => setPassportNumber(e.target.value)}
                                        placeholder="e.g. S0848222"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Nationality</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={nationality}
                                        onChange={e => setNationality(e.target.value)}
                                        placeholder="e.g. INDIA"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Collection Purpose</label>
                                    <textarea 
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none h-16 resize-none"
                                        value={purpose}
                                        onChange={e => setPurpose(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Authorized Representative Author</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={signatoryName}
                                        onChange={e => setSignatoryName(e.target.value)}
                                        placeholder="Name of who takes custody"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-400 font-extrabold mb-1">Authorized Representative Title</label>
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        value={signatoryTitle}
                                        onChange={e => setSignatoryTitle(e.target.value)}
                                        placeholder="e.g. Human Resources Manager"
                                    />
                                </div>

                                <div className="pt-3 flex gap-2.5">
                                    <button
                                        onClick={handleSaveRecord}
                                        disabled={saving}
                                        className="flex-1 py-3 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-xs cursor-pointer text-center"
                                    >
                                        {saving ? "Writing DB..." : "Save Record"}
                                    </button>
                                    
                                    <button
                                        onClick={handleDirectPrintRecord}
                                        className="flex-1 py-3 bg-slate-100 text-slate-700 font-extrabold rounded-xl hover:bg-slate-200 transition-colors text-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                                    >
                                        <FileDown className="w-3.5 h-3.5" /> Get PDF
                                    </button>
                                </div>

                            </div>
                        ) : (
                            <div className="text-center py-10 space-y-3">
                                <Search className="w-10 h-10 text-slate-300 mx-auto" />
                                <p className="text-xs text-slate-400 italic font-medium px-4">
                                    No profile is active. Please search and select an employee or candidate from the left panel or start manually.
                                </p>
                            </div>
                        )}
                    </div>

                </div>

                {/* 3. Right Columns - Live Formal Preview Render Sheet (4 cols) */}
                <div className="lg:col-span-4 bg-slate-100/50 p-6 rounded-3xl border border-slate-200/60 shadow-inner flex justify-center">
                    
                    {/* Visual A4 Letter Container */}
                    <div id="interactive-sheet" className="w-[100%] shadow-lg border border-slate-300 rounded-xs bg-white p-5 text-slate-800 select-none relative overflow-hidden font-sans space-y-4" style={{ minHeight: '600px', fontSize: '11px' }}>
                        
                        {/* Fake letterhead banner */}
                        <div className="border-b-2 border-slate-200 pb-3 flex flex-col gap-0.5">
                            <h2 className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">PIONEER GENERAL CONTRACTING LLC</h2>
                            <p className="text-[7.5px] font-bold text-slate-400">Pioneer DMS • Official Employee Custody Department</p>
                            
                            <div className="flex justify-between items-center text-[8px] text-slate-500 pt-1.5 font-mono">
                                <span className="font-bold">Ref No: {refNo || "PGC/HR/MA2605"}</span>
                                <span className="font-bold">Date: {new Date(date).toLocaleDateString('en-GB')}</span>
                            </div>
                        </div>

                        {/* Title Underlined */}
                        <div className="text-center py-1">
                            <h3 className="text-[11px] font-black tracking-wide text-slate-900 uppercase underline text-center decoration-1 underline-offset-4 decoration-slate-900">
                                PASSPORT COLLECTION ACKNOWLEDGEMENT
                            </h3>
                        </div>

                        {/* Salutation */}
                        <div className="space-y-1">
                            <p className="font-bold text-slate-800">To Whom It May Concern,</p>
                            <p className="text-slate-600 font-sans leading-relaxed text-[8.5px]">
                                This is to confirm that the Company has collected the original passport from the below-mentioned employee for official company and administrative purposes.
                            </p>
                        </div>

                        {/* Bordered Table */}
                        <div className="w-full border border-slate-800 divide-y divide-slate-800 rounded-sm overflow-hidden text-[8px]">
                            <div className="flex divide-x divide-slate-800">
                                <div className="w-[35%] bg-slate-50 p-1.5 font-bold text-slate-700">Employee Name</div>
                                <div className="w-[65%] p-1.5 font-bold text-slate-900">{employeeName || "Ronnie"}</div>
                            </div>
                            <div className="flex divide-x divide-slate-800">
                                <div className="w-[35%] bg-slate-50 p-1.5 font-bold text-slate-700">Employee ID</div>
                                <div className="w-[65%] p-1.5 font-mono">{employeeId || "TEM004"}</div>
                            </div>
                            <div className="flex divide-x divide-slate-800">
                                <div className="w-[35%] bg-slate-50 p-1.5 font-bold text-slate-700">Passport Number</div>
                                <div className="w-[65%] p-1.5 font-mono font-bold text-slate-900">{passportNumber || "S0848222"}</div>
                            </div>
                            <div className="flex divide-x divide-slate-800">
                                <div className="w-[35%] bg-slate-50 p-1.5 font-bold text-slate-700">Nationality</div>
                                <div className="w-[65%] p-1.5 font-bold">{nationality || "INDIA"}</div>
                            </div>
                            <div className="flex divide-x divide-slate-800">
                                <div className="w-[35%] bg-slate-50 p-1.5 font-bold text-slate-700">Date of Collection</div>
                                <div className="w-[65%] p-1.5 font-mono text-slate-900">
                                    {new Date(date).toLocaleDateString('en-GB')}
                                </div>
                            </div>
                            <div className="flex divide-x divide-slate-800">
                                <div className="w-[35%] bg-slate-50 p-1.5 font-bold text-slate-700">Purpose</div>
                                <div className="w-[65%] p-1.5 font-bold text-slate-600 leading-snug">{purpose}</div>
                            </div>
                        </div>

                        <p className="text-[8px] text-slate-500 font-sans leading-relaxed">
                            The passport will be kept safely by the Company and will be returned to the employee upon completion of the required official process or upon request, subject to Company policy and applicable regulations.
                        </p>

                        {/* Bottom sign boxes */}
                        <div className="pt-8 grid grid-cols-2 gap-4 text-[7px] text-slate-700 font-bold">
                            <div className="border-t border-dashed border-slate-300 pt-1.5">
                                Employee Signature:
                            </div>
                            <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
                                <div>Authorized Signatory:</div>
                                <div className="text-slate-500 text-[6.5px] font-semibold mt-1">Name: {signatoryName}</div>
                                <div className="text-slate-400 text-[6px] font-medium">Title: {signatoryTitle}</div>
                            </div>
                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
};
