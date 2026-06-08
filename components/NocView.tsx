import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Search, FileText, FileDown, Calendar, User, Building, Award, ChevronRight, CheckSquare
} from 'lucide-react';
import { Employee } from '../types';

// Reusable NOC PDF generator
export const downloadNocPDF = (employee: Employee, config: {
    targetCompany: string;
    workNature: string; // 'Full-Time' or 'Part-Time'
    purpose: string;
    issueDate?: string;
    additionalTerms?: string;
    signatoryName?: string;
    signatoryTitle?: string;
}) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const issueDate = config.issueDate || new Date().toISOString().split('T')[0];
    const targetCompany = config.targetCompany.trim() || "ANY REGISTERED COMPANY (UNRESTRICTED)";
    const workNature = config.workNature || "Part-Time";
    const purpose = config.purpose || "Work Association & Services Assignment";
    const signatoryName = config.signatoryName || "Authorized HR Director";
    const signatoryTitle = config.signatoryTitle || "Human Resources & Personnel Manager";
    
    // Header Corporate Colors
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(79, 70, 229); // Royal Indigo-600
    doc.rect(0, 8, 210, 2, 'F');

    // Company Header Branding
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(employee.company || "PIONEER GENERAL CONTRACTING LLC", 20, 26);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Pioneer Document Management Work Portal — HR Issuing Department", 20, 32);
    
    // Line separator
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.4);
    doc.line(20, 39, 190, 39);

    // Document Meta Information
    const refNo = `PION/HR/NOC-${employee.code}-${new Date(issueDate).getFullYear()}`;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(`Ref No: ${refNo}`, 20, 48);
    
    const formattedIssueDate = new Date(issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Date: ${formattedIssueDate}`, 190 - doc.getTextWidth(`Date: ${formattedIssueDate}`), 48);

    let yPos = 68;

    // Head Address Block
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Slate-900
    const addressee = "TO WHOMSOEVER IT MAY CONCERN / RELEVANT AUTHORITIES";
    doc.text(addressee, 105 - (doc.getTextWidth(addressee) / 2), yPos);

    yPos += 12;

    // NOC Subject Statement
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(79, 70, 229); // Royal Indigo
    const subjectLine = "SUBJECT: NO OBJECTION CERTIFICATE (NOC) FOR EXTERNAL SERVICE / WORK";
    doc.text(subjectLine, 105 - (doc.getTextWidth(subjectLine) / 2), yPos);

    // Underline subject
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.4);
    doc.line(105 - (doc.getTextWidth(subjectLine) / 2), yPos + 1.5, 105 + (doc.getTextWidth(subjectLine) / 2), yPos + 1.5);

    yPos += 15;

    // Body text paragraph
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85); // Slate-700
    
    const formattedJoinDate = employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

    const p1 = `This is to certify that we, ${employee.company || 'Pioneer General Contracting LLC'}, have no objection whatsoever to our employee, Mr. / Ms. ${employee.name} (Employee Code: ${employee.code}, Nationality: ${employee.nationality || 'N/A'}), who is currently employed under our sponsorship as a ${employee.designation} since ${formattedJoinDate}, offering their professional work or services on a ${workNature.toUpperCase()} basis to:`;
    const splitP1 = doc.splitTextToSize(p1, 170);
    doc.text(splitP1, 20, yPos);
    yPos += (splitP1.length * 5.2) + 6;

    // Target Company highlighted card area
    doc.setFillColor(248, 250, 252); // Soft Gray background
    doc.setDrawColor(226, 232, 240); // Soft border
    doc.rect(20, yPos, 170, 22, 'F');
    doc.rect(20, yPos, 170, 22, 'D');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TARGET COMPANY:", 25, yPos + 7);
    doc.setTextColor(79, 70, 229); // Accent Indigo
    doc.text(targetCompany.toUpperCase(), 64, yPos + 7);

    doc.setTextColor(51, 65, 85);
    doc.setFont("Helvetica", "bold");
    doc.text("WORK NATURE:", 25, yPos + 13);
    doc.setFont("Helvetica", "normal");
    doc.text(`${workNature.toUpperCase()} WORK / SERVICES`, 64, yPos + 13);

    doc.setFont("Helvetica", "bold");
    doc.text("APPROVED PURPOSE:", 25, yPos + 18);
    doc.setFont("Helvetica", "normal");
    doc.text(purpose, 64, yPos + 18);

    yPos += 30;

    // Terms of NOC
    const p2 = config.additionalTerms || 
        `This No Objection Certificate is issued upon the specific request of the employee to facilitate ${workNature.toLowerCase()} external work or project association. This authorization does not release the employee from their primary job duties, schedule alignment, and corporate obligations with our organization. It represents that we have no conflict or restriction regarding their work with the specified entity or entities.`;
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10.5);
    const splitP2 = doc.splitTextToSize(p2, 170);
    doc.text(splitP2, 20, yPos);
    yPos += (splitP2.length * 5.2) + 8;

    const p3 = "Please note that this document is issued without any legal or financial liability on behalf of our organization or its management representatives.";
    const splitP3 = doc.splitTextToSize(p3, 170);
    doc.text(splitP3, 20, yPos);

    // Signature Area
    const ySign = 215;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`For ${employee.company || 'Pioneer General Contracting LLC'}`, 20, ySign);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(signatoryName, 20, ySign + 22);
    doc.text(signatoryTitle, 20, ySign + 26);

    // Systems Authenticity block
    doc.setDrawColor(241, 245, 249); 
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 268, 180, 12, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Pioneer Digital Document Management Portal. NOC Verified Electronically — No Physical Signature Obligated.", 105 - (doc.getTextWidth("Pioneer Digital Document Management Portal. NOC Verified Electronically — No Physical Signature Obligated.") / 2), 275);

    // Save PDF
    const safeName = (employee.name || 'Employee').replace(/\s+/g, '_');
    const fileTitle = `NOC_Letter_${safeName}.pdf`;
    doc.save(fileTitle);
};

export const NocView = ({ employees }: { employees: Employee[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [targetCompany, setTargetCompany] = useState('');
    const [workNature, setWorkNature] = useState<'Part-Time' | 'Full-Time'>('Part-Time');
    const [purpose, setPurpose] = useState('Part-Time Work & External Employment');
    const [signatoryName, setSignatoryName] = useState('Authorized HR Director');
    const [signatoryTitle, setSignatoryTitle] = useState('Human Resources & Personnel Department');
    const [additionalTerms, setAdditionalTerms] = useState(
        "This No Objection Certificate is issued upon the specific request of the employee to facilitate project association or temporary service engagement. This authorization does not release the employee from their primary job duties, scheduling, and standard performance criteria with our organization."
    );

    // Filter employees safely
    const filteredEmployees = useMemo(() => {
        if (!searchTerm.trim()) return [];
        return employees.filter(e => {
            const name = String(e.name || '').toLowerCase();
            const code = String(e.code || '').toLowerCase();
            const designation = String(e.designation || '').toLowerCase();
            const search = searchTerm.toLowerCase();
            return name.includes(search) || code.includes(search) || designation.includes(search);
        });
    }, [employees, searchTerm]);

    const handleSelectEmployee = (emp: Employee) => {
        setSelectedEmployee(emp);
        setSearchTerm('');
    };

    const handleGenerateNoc = () => {
        if (!selectedEmployee) return;
        downloadNocPDF(selectedEmployee, {
            targetCompany,
            workNature,
            purpose,
            issueDate,
            additionalTerms,
            signatoryName,
            signatoryTitle
        });
    };

    return (
        <div id="noc-suite-container" className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-1.5 border-b pb-4 mb-2">
                <span className="text-xs font-black tracking-widest text-indigo-600 uppercase">HR Compliance Suite</span>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-indigo-600" /> No Objection Certificate (NOC) Section
                </h1>
                <p className="text-sm text-slate-500">
                    Sponsor and issue legitimate NOC (No Objection Certificates) for employees seeking to associate with other companies or handle supplementary tasks.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Find Employee Panel */}
                <div className="md:col-span-5 space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" /> 1. Select Employee
                        </h3>
                        
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                            <input 
                                type="text"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                                placeholder="Search by name, ID or code..."
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value);
                                    if (selectedEmployee) setSelectedEmployee(null);
                                }}
                            />
                        </div>

                        {/* Dropdown list of results */}
                        {filteredEmployees.length > 0 && (
                            <div className="border border-slate-100 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-50 bg-white">
                                {filteredEmployees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => handleSelectEmployee(emp)}
                                        className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{emp.name}</p>
                                            <p className="text-xs text-slate-400 font-bold">{emp.code} • {emp.designation}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedEmployee ? (
                            <div className="p-4 bg-indigo-50/70 border border-indigo-100/50 rounded-2xl space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm font-sans">
                                        {(selectedEmployee.name || 'Employee').split(' ').filter(Boolean).map(n => n[0] || '').slice(0,2).join('').toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-extrabold text-slate-800">{selectedEmployee.name}</p>
                                        <p className="text-xs font-semibold text-slate-500">{selectedEmployee.code} • {selectedEmployee.designation}</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-indigo-200/30 text-[11px] text-slate-600 font-sans">
                                    <div>
                                        <span className="text-slate-400 font-bold block">Establishment:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.company || 'Pioneer contracting'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold block">Enroll Date:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.joiningDate || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold block">Department:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.department || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold block">Type / Category:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.type || 'Personnel'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            searchTerm.trim() && filteredEmployees.length === 0 && (
                                <p className="text-xs text-center text-slate-400 py-4 italic font-medium">No system staff matched criteria</p>
                            )
                        )}
                    </div>
                </div>

                {/* NOC Formulation Form */}
                <div className="md:col-span-7 space-y-4">
                    {selectedEmployee ? (
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Award className="w-4 h-4 text-indigo-600" /> 2. NOC Terms Configuration
                            </h3>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Company Name (Optional)</label>
                                <input 
                                    type="text"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                                    value={targetCompany}
                                    onChange={e => setTargetCompany(e.target.value)}
                                    placeholder="e.g. Al Naboodah Contracting LLC (Leave blank for ANY company)"
                                />
                                <p className="text-[10px] text-slate-400 font-bold italic">
                                    Leave blank to state that the employee is authorized to offer services to **any company or companies** without restriction.
                                </p>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Work Nature Selection</label>
                                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-55 bg-slate-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setWorkNature('Part-Time');
                                            setPurpose('Part-Time Work & External Employment');
                                        }}
                                        className={`py-2 px-4 rounded-lg font-black text-xs transition-all uppercase tracking-wider cursor-pointer ${
                                            workNature === 'Part-Time' 
                                                ? 'bg-indigo-600 text-white shadow-sm' 
                                                : 'text-slate-600 hover:text-slate-800'
                                        }`}
                                    >
                                        Part-Time Work
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setWorkNature('Full-Time');
                                            setPurpose('External Full-Time Duty Assignment');
                                        }}
                                        className={`py-2 px-4 rounded-lg font-black text-xs transition-all uppercase tracking-wider cursor-pointer ${
                                            workNature === 'Full-Time' 
                                                ? 'bg-indigo-600 text-white shadow-sm' 
                                                : 'text-slate-600 hover:text-slate-800'
                                        }`}
                                    >
                                        Full-Time Work
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purpose of NOC</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                                        value={purpose}
                                        onChange={e => setPurpose(e.target.value)}
                                        placeholder="e.g. Temporary Construction Work"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">NOC Issue Date</label>
                                    <input 
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 h-[42px]"
                                        value={issueDate}
                                        onChange={e => setIssueDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signatory Person Name</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 text-xs"
                                        value={signatoryName}
                                        onChange={e => setSignatoryName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signatory Job Title</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 text-xs"
                                        value={signatoryTitle}
                                        onChange={e => setSignatoryTitle(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 border-t pt-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block pb-1">Additional Terms / Protective Conditions</label>
                                <textarea 
                                    className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 leading-relaxed"
                                    rows={3}
                                    value={additionalTerms}
                                    onChange={e => setAdditionalTerms(e.target.value)}
                                    placeholder="Define regulatory criteria or hours constraints..."
                                />
                            </div>

                            <button
                                onClick={handleGenerateNoc}
                                className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                                <FileDown className="w-5 h-5" />
                                Generate & Download NOC PDF
                            </button>
                        </div>
                    ) : (
                        <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 text-center flex flex-col justify-center items-center h-full min-h-[340px]">
                            <Building className="w-12 h-12 text-slate-300 mb-3" />
                            <p className="font-extrabold text-slate-700 text-sm">No Employee Selected</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                                Please search and pick a sponsored worker from the left directory sidebar. Then you can issue and custom-tune an official No Objection Certificate (NOC).
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
