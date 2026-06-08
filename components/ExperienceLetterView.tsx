import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Search, FileText, FileDown, Calendar, User, Building, Mail, Award, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Employee } from '../types';

// Shared experience calculator helper
export const calculateExperienceDays = (joiningDate: string, exitDate?: string) => {
    if (!joiningDate) return 'N/A';
    const start = new Date(joiningDate);
    const end = exitDate ? new Date(exitDate) : new Date();
    
    if (isNaN(start.getTime())) return 'N/A';
    
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    
    if (months < 0 || (months === 0 && end.getDate() < start.getDate())) {
        years--;
        months += 12;
    }
    
    if (years <= 0 && months <= 0) return '0 Months';
    if (years === 0) return `${months} ${months === 1 ? 'Month' : 'Months'}`;
    return `${years} ${years === 1 ? 'Year' : 'Years'}${months > 0 ? ` ${months} ${months === 1 ? 'Month' : 'Months'}` : ''}`;
};

// Reusable experience letter PDF generator
export const downloadExperienceLetterPDF = (employee: Employee, config?: {
    exitDate?: string;
    recipient?: string;
    conductText?: string;
    issueDate?: string;
}) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const isCurrentlyActive = employee.active !== false && String(employee.status || '').toLowerCase() === 'active';
    const issueDate = config?.issueDate || new Date().toISOString().split('T')[0];
    const exitDate = config?.exitDate || (isCurrentlyActive ? 'Present' : (employee.offboardingDetails?.exitDate || new Date().toISOString().split('T')[0]));
    const recipient = config?.recipient || "TO WHOMSOEVER IT MAY CONCERN";
    
    // Calculate experience string
    const expSpan = calculateExperienceDays(employee.joiningDate, exitDate === 'Present' ? undefined : exitDate);

    // Header Color Accents
    doc.setFillColor(15, 23, 42); // Primary Slate-900
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(79, 70, 229); // Accent Indigo-600
    doc.rect(0, 8, 210, 2, 'F');

    // Corporate Header Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(employee.company || "PIONEER GENERAL CONTRACTING LLC", 20, 26);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Pioneer Document Management Work Portal — HR Office Department", 20, 32);
    
    // Header divider line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.4);
    doc.line(20, 39, 190, 39);

    // Meta-data Ref and Issue Date
    const refNo = `PION/HR/EXP-${employee.code}-${new Date(issueDate).getFullYear()}`;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(`Ref No: ${refNo}`, 20, 48);
    
    const formattedIssueDate = new Date(issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Date of Issue: ${formattedIssueDate}`, 190 - doc.getTextWidth(`Date of Issue: ${formattedIssueDate}`), 48);

    // Margin block spacer
    let yPos = 68;

    // Recipient Address Block - Centered uppercase
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Slate-900
    const recipientTextCenter = recipient.toUpperCase();
    doc.text(recipientTextCenter, 105 - (doc.getTextWidth(recipientTextCenter) / 2), yPos);

    yPos += 12;

    // Document Subject
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(79, 70, 229); // Accent Indigo
    const subjectLine = "SUBJECT: EMPLOYMENT EXPERIENCE CERTIFICATE";
    doc.text(subjectLine, 105 - (doc.getTextWidth(subjectLine) / 2), yPos);

    // Redraw underline
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.4);
    doc.line(105 - (doc.getTextWidth(subjectLine) / 2), yPos + 1.5, 105 + (doc.getTextWidth(subjectLine) / 2), yPos + 1.5);

    yPos += 15;

    // Letter Body Text
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85); // Slate-700
    
    const formattedJoinDate = new Date(employee.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedExitDate = exitDate === 'Present' ? 'Present' : new Date(exitDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const p1 = `This certificate is issued to formally confirm that Mr. / Ms. ${employee.name} (Employee Code: ${employee.code}), a holder of nationality ${employee.nationality || 'N/A'}, was employed at ${employee.company || 'Pioneer General Contracting LLC'}.`;
    const splitP1 = doc.splitTextToSize(p1, 170);
    doc.text(splitP1, 20, yPos);
    yPos += (splitP1.length * 5.2) + 5;

    const tenureStatusStr = exitDate === 'Present' 
        ? `Since their enlistment on ${formattedJoinDate}, they have been continuously working with us in active service up to the present day.` 
        : `Their tenure of employment commenced on ${formattedJoinDate} and successfully concluded on ${formattedExitDate}.`;
    
    const p2 = `${tenureStatusStr} During this tenure, they served in the professional assignment of ${employee.designation} in the ${employee.department} department. Their total active length of service spans ${expSpan}.`;
    const splitP2 = doc.splitTextToSize(p2, 170);
    doc.text(splitP2, 20, yPos);
    yPos += (splitP2.length * 5.2) + 5;

    const customConductText = config?.conductText || 
        "During their service period with the organization, they have conducted themselves in an exemplary manner, exhibiting diligence, high efficiency, and professional integrity. They demonstrated great adaptability and worked cooperatively as a key contributor to our operational success. Their personal character and conduct were highly satisfactory.";
        
    const p3 = `${customConductText} We express our sincere appreciation for their contributions and wish them prosperous growth and success in all future professional endeavors.`;
    const splitP3 = doc.splitTextToSize(p3, 170);
    doc.text(splitP3, 20, yPos);

    // Sign off signature fields near bottom
    const ySign = 215;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`For ${employee.company || 'Pioneer General Contracting LLC'}`, 20, ySign);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("Authorized HR Signatory", 20, ySign + 22);
    doc.text("Human Resourcing Department", 20, ySign + 26);

    // System footer note block
    doc.setDrawColor(241, 245, 249); 
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 268, 180, 12, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Pioneer Digital Document Authenticated System. No print signature or manual ink is required if stamp is verified.", 105 - (doc.getTextWidth("Pioneer Digital Document Authenticated System. No print signature or manual ink is required if stamp is verified.") / 2), 275);

    // Save File Title
    const safeName = (employee.name || 'Employee').replace(/\s+/g, '_');
    const fileTitle = `Experience_Letter_${safeName}.pdf`;
    doc.save(fileTitle);
};

export const ExperienceLetterView = ({ employees }: { employees: Employee[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [recipient, setRecipient] = useState('TO WHOMSOEVER IT MAY CONCERN');
    const [isActive, setIsActive] = useState(true);
    const [customExitDate, setCustomExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [conductText, setConductText] = useState(
        "During their service period with the organization, they have conducted themselves in an exemplary manner, exhibiting diligence, high efficiency, and professional integrity."
    );

    // Filter employees
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
        
        // Auto setup parameters based on employee status
        const isCurrentActive = emp.active !== false && String(emp.status || '').toLowerCase() === 'active';
        setIsActive(isCurrentActive);
        
        if (!isCurrentActive && emp.offboardingDetails?.exitDate) {
            setCustomExitDate(emp.offboardingDetails.exitDate);
        } else {
            setCustomExitDate(new Date().toISOString().split('T')[0]);
        }
    };

    const handleGenerateManual = () => {
        if (!selectedEmployee) return;
        downloadExperienceLetterPDF(selectedEmployee, {
            issueDate,
            recipient,
            exitDate: isActive ? 'Present' : customExitDate,
            conductText
        });
    };

    return (
        <div id="experience-view-container" className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-1.5 border-b pb-4 mb-2">
                <span className="text-xs font-black tracking-widest text-indigo-600 uppercase">HR Experience Suite</span>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <Award className="w-6 h-6 text-indigo-600" /> Manual Experience Letter Generator
                </h1>
                <p className="text-sm text-slate-500">
                    Search and select any active or inactive employee to generate and download their customized corporate Experience Letter.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Search and Selection Panel */}
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
                                placeholder="Search by name or code..."
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value);
                                    if (selectedEmployee) setSelectedEmployee(null);
                                }}
                            />
                        </div>

                        {/* Search result dropdown */}
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
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm">
                                        {(selectedEmployee.name || 'Employee').split(' ').filter(Boolean).map(n => n[0] || '').slice(0,2).join('').toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-extrabold text-slate-800">{selectedEmployee.name}</p>
                                        <p className="text-xs font-semibold text-slate-500">{selectedEmployee.code} • {selectedEmployee.designation}</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-indigo-200/30 text-[11px] text-slate-600">
                                    <div>
                                        <span className="text-slate-400 font-bold block">Company:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.company || 'Pioneer Contracting'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold block">Joining Date:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.joiningDate}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold block">Department:</span>
                                        <span className="font-extrabold text-slate-700">{selectedEmployee.department}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-bold block">Status:</span>
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                            selectedEmployee.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {selectedEmployee.active !== false ? 'Active' : 'Ex-Employee'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            searchTerm.trim() && filteredEmployees.length === 0 && (
                                <p className="text-xs text-center text-slate-400 py-4 italic font-medium">No employees found matching filter</p>
                            )
                        )}
                    </div>
                </div>

                {/* Configuration Options */}
                <div className="md:col-span-span md:col-span-7 space-y-4">
                    {selectedEmployee ? (
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Award className="w-4 h-4 text-indigo-600" /> 2. Letter Configurations
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                                        value={recipient}
                                        onChange={e => setRecipient(e.target.value)}
                                        placeholder="e.g. TO WHOMSOEVER IT MAY CONCERN"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date of Issue</label>
                                    <input 
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 h-[42px]"
                                        value={issueDate}
                                        onChange={e => setIssueDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Employment Duration</span>
                                <div className="flex gap-4 items-center">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={isActive} 
                                            onChange={e => setIsActive(e.target.checked)}
                                            className="rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Still employed with Pioneer
                                    </label>
                                </div>

                                {!isActive && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-in fade-in duration-200">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Working Date</label>
                                            <input 
                                                type="date"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                                                value={customExitDate}
                                                onChange={e => setCustomExitDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 border-t pt-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block pb-1">Custom Conduct / Character Remarks</label>
                                <textarea 
                                    className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 leading-relaxed"
                                    rows={4}
                                    value={conductText}
                                    onChange={e => setConductText(e.target.value)}
                                    placeholder="Enter custom conduct evaluation phrase..."
                                />
                            </div>

                            <button
                                onClick={handleGenerateManual}
                                className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                                <FileDown className="w-5 h-5" />
                                Generate & Download Experience PDF
                            </button>
                        </div>
                    ) : (
                        <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 text-center flex flex-col justify-center items-center h-full min-h-[300px]">
                            <FileText className="w-12 h-12 text-slate-300 mb-3" />
                            <p className="font-extrabold text-slate-750 text-sm">No Employee Selected</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                Please search and pick a staff member using the left sidebar menu to begin tailoring their custom Work Experience Letter.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
