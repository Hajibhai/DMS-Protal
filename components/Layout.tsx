import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, ChevronDown, 
  LogOut, Settings, User, Bell, Search,
  Building2, Globe, HelpCircle, FileText, LayoutGrid,
  Briefcase, Truck, Wallet, Check, Video, ExternalLink, Sparkles, Calendar,
  Mail, Phone, ZoomIn, ZoomOut, Move, Crop
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  navItems: any[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  user: any;
  onLogout: () => void;
  companies: any[];
  expiringDocs: any[];
  employees: any[];
  projects: any[];
  suppliers: any[];
  vendors: any[];
  accountsPayable: any[];
  accountsReceivable: any[];
  pettyCash: any[];
  onNotificationClick?: (doc: any) => void;
  activeTheme?: string;
  typographyScale?: string;
  ambianceMode?: string;
  animationIntensity?: string;
  portalBranding?: {
    logoUrl?: string;
    logoText?: string;
    logoSubtext?: string;
  };
}

const SupportModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
      }, 2000);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-white"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Contact Support</h2>
                <p className="text-slate-500 text-sm font-medium">We're here to help you</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              {submitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Message Sent!</h3>
                  <p className="text-slate-500 font-medium">Our team will get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject</label>
                    <input
                      required
                      type="text"
                      placeholder="What do you need help with?"
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Message</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe your issue in detail..."
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-none"
                    />
                  </div>
                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full py-4 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 transition-all active:scale-95 shadow-xl shadow-brand-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Send Support Request
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  navItems, 
  activeTab, 
  setActiveTab, 
  user, 
  onLogout,
  companies,
  expiringDocs,
  employees,
  projects,
  suppliers,
  vendors,
  accountsPayable,
  accountsReceivable,
  pettyCash,
  onNotificationClick,
  activeTheme = 'indigo',
  typographyScale = 'classic',
  ambianceMode = 'flat',
  animationIntensity = 'smooth',
  portalBranding = { logoUrl: '', logoText: 'PIONEER', logoSubtext: 'DMS PORTAL' }
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const isEmployee = user?.role?.toLowerCase() === 'employee';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms'>('privacy');

  // Developer Profile settings
  interface DeveloperProfile {
    name: string;
    email: string;
    contactNumber: string;
    photoUrl: string;
    bio: string;
  }

  const [devProfile, setDevProfile] = useState<DeveloperProfile>({
    name: "Mohamed Abdul Kader",
    email: "abdulkaderp3010@gmail.com",
    contactNumber: "+971 50 301 0244",
    photoUrl: "",
    bio: "Lead Developer & Full-Stack Solutions Architect of Pioneer Portal."
  });
  const [isDevEditMode, setIsDevEditMode] = useState(false);
  const [editedDevProfile, setEditedDevProfile] = useState<DeveloperProfile>({ ...devProfile });

  // Lightbox for full developer profile photo
  const [isDevLightboxOpen, setIsDevLightboxOpen] = useState(false);

  // Crop & Adjust modal state logic
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [cropScale, setCropScale] = useState(1.2);
  const [cropPanX, setCropPanX] = useState(0);
  const [cropPanY, setCropPanY] = useState(0);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const handleCropDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDraggingCrop(true);
    setDragStartPos({ x: clientX - cropPanX, y: clientY - cropPanY });
  };

  const handleCropDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingCrop) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCropPanX(clientX - dragStartPos.x);
    setCropPanY(clientY - dragStartPos.y);
  };

  const handleCropDragEnd = () => {
    setIsDraggingCrop(false);
  };

  const handleConfirmCrop = () => {
    if (!cropImageSrc) return;
    
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      const viewDim = 280;
      const cropCircleDim = 200;
      
      const naturalW = imgElement.naturalWidth;
      const naturalH = imgElement.naturalHeight;
      const ar = naturalW / naturalH;
      
      let drawW = viewDim;
      let drawH = viewDim;
      if (ar > 1) {
        drawH = viewDim / ar;
      } else {
        drawW = viewDim * ar;
      }
      
      const finalScale = cropScale;
      const imgCenterLimitX = 140 + cropPanX;
      const imgCenterLimitY = 140 + cropPanY;
      
      const imgLeft = imgCenterLimitX - (drawW * finalScale) / 2;
      const imgTop = imgCenterLimitY - (drawH * finalScale) / 2;
      
      const cropLeft = 40;
      const cropTop = 40;
      
      const dx = cropLeft - imgLeft;
      const dy = cropTop - imgTop;
      
      const srcScale = naturalW / (drawW * finalScale);
      
      const sx = dx * srcScale;
      const sy = dy * srcScale;
      const sw = cropCircleDim * srcScale;
      const sh = cropCircleDim * srcScale;
      
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 500, 500);
        ctx.drawImage(imgElement, sx, sy, sw, sh, 0, 0, 500, 500);
        
        const resultUrl = canvas.toDataURL('image/jpeg', 0.95);
        setEditedDevProfile(prev => ({ ...prev, photoUrl: resultUrl }));
        setIsCropModalOpen(false);
      }
    };
    imgElement.src = cropImageSrc;
  };

  // Load Developer Profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'developer_settings', 'profile');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const profileData = snap.data() as DeveloperProfile;
          setDevProfile(profileData);
          setEditedDevProfile(profileData);
        }
      } catch (err) {
        console.warn("Information on developer profile:", err);
      }
    };
    loadProfile();
  }, []);

  const handleSaveDevProfile = async () => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'developer_settings', 'profile');
      await setDoc(docRef, editedDevProfile);
      setDevProfile(editedDevProfile);
      setIsDevEditMode(false);
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      alert("Failed to save profile: " + err.message);
    }
  };

  const isCreatorUser = user?.role?.toLowerCase() === 'creator' || user?.email === 'abdulkaderp3010@gmail.com';

  const [layoutMeetings, setLayoutMeetings] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'meetings'), orderBy('dateTime', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLayoutMeetings(list);
    }, (err) => {
      console.error("Error loading layout meetings:", err);
    });
    return () => unsub();
  }, [user]);

  const activeMeetingAlert = useMemo(() => {
    if (!user) return null;
    const now = new Date();
    
    // Find any meeting where the user is an attendee or creator, and is active now or starting in the next 1 hour
    const active = layoutMeetings.find(m => {
      if (m.completed) return false;
      const isAttendee = (m.assignedToMultiple || []).some((u: any) => u.uid === user.uid) || m.assignedTo === user.uid;
      const isCreator = m.createdById === user.uid;
      if (!isAttendee && !isCreator) return false;

      const meetingDate = m.dateTime ? new Date(m.dateTime) : null;
      if (!meetingDate || isNaN(meetingDate.getTime())) return false;
      
      const durationMin = m.duration || 30;
      const meetingEnd = new Date(meetingDate.getTime() + durationMin * 60 * 1000);
      const timeDiffMs = meetingDate.getTime() - now.getTime();
      
      const isActiveNow = now >= meetingDate && now <= meetingEnd;
      const isStartingSoon = timeDiffMs > 0 && timeDiffMs <= 60 * 60 * 1000; // in next 1 hour
      
      return isActiveNow || isStartingSoon;
    });

    return active || null;
  }, [layoutMeetings, user]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    
    const results: any[] = [];
    
    // Search Employees
    (employees || []).forEach(emp => {
        const docEmiratesId = emp.documents?.emiratesId || '';
        const docPassportNumber = emp.documents?.passportNumber || '';
        const docLabourCardNumber = emp.documents?.labourCardNumber || '';
        
        const qClean = q.replace(/[^a-zA-Z0-9]/g, '');
        const empEIDClean = docEmiratesId.replace(/[^a-zA-Z0-9]/g, '');
        const empPassportClean = docPassportNumber.replace(/[^a-zA-Z0-9]/g, '');
        const empLabourClean = docLabourCardNumber.replace(/[^a-zA-Z0-9]/g, '');

        const matchesDoc = (
            docEmiratesId.toLowerCase().includes(q) ||
            docPassportNumber.toLowerCase().includes(q) ||
            docLabourCardNumber.toLowerCase().includes(q) ||
            (qClean.length >= 3 && (
                empEIDClean.includes(qClean) ||
                empPassportClean.includes(qClean) ||
                empLabourClean.includes(qClean)
            ))
        );

        if (
            (emp.name?.toLowerCase() || '').includes(q) || 
            (emp.code?.toLowerCase() || '').includes(q) || 
            (emp.designation?.toLowerCase() || '').includes(q) ||
            (emp.department?.toLowerCase() || '').includes(q) ||
            (emp.company?.toLowerCase() || '').includes(q) ||
            matchesDoc
        ) {
            let docMatchInfo = '';
            if (docEmiratesId && (docEmiratesId.toLowerCase().includes(q) || (qClean.length >= 3 && empEIDClean.includes(qClean)))) {
                docMatchInfo = ` | EID: ${docEmiratesId}`;
            } else if (docPassportNumber && (docPassportNumber.toLowerCase().includes(q) || (qClean.length >= 3 && empPassportClean.includes(qClean)))) {
                docMatchInfo = ` | Pass: ${docPassportNumber}`;
            } else if (docLabourCardNumber && (docLabourCardNumber.toLowerCase().includes(q) || (qClean.length >= 3 && empLabourClean.includes(qClean)))) {
                docMatchInfo = ` | Labour: ${docLabourCardNumber}`;
            }
            results.push({ 
                type: 'Employee', 
                title: emp.name, 
                subtitle: `${emp.code} - ${emp.designation} (${emp.company})${docMatchInfo}`, 
                id: emp.id, 
                tab: 'staff' 
            });
        }
    });
    
    // Search Companies
    (companies || []).forEach(comp => {
        if ((comp.name?.toLowerCase() || '').includes(q) || (comp.code?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Company', title: comp.name, subtitle: `${comp.code} - Company Details`, id: comp.id, tab: 'company' });
        }
    });

    // Search Projects
    (projects || []).forEach(proj => {
        if (
            (proj.name?.toLowerCase() || '').includes(q) || 
            (proj.code?.toLowerCase() || '').includes(q) || 
            (proj.clientName?.toLowerCase() || '').includes(q) ||
            (proj.location?.toLowerCase() || '').includes(q)
        ) {
            results.push({ type: 'Project', title: proj.name, subtitle: `${proj.code} - ${proj.clientName}`, id: proj.id, tab: 'projects' });
        }
    });

    // Search Suppliers
    (suppliers || []).forEach(sup => {
        if ((sup.name?.toLowerCase() || '').includes(q) || (sup.code?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Supplier', title: sup.name, subtitle: `${sup.code} - ${sup.category || 'Supplier'}`, id: sup.id, tab: 'suppliers' });
        }
    });

    // Search Clients (Vendors)
    (vendors || []).forEach(ven => {
        if ((ven.name?.toLowerCase() || '').includes(q) || (ven.code?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Client', title: ven.name, subtitle: `${ven.code} - ${ven.category || 'Client'}`, id: ven.id, tab: 'vendors' });
        }
    });

    // Search Finance (Payables, Receivables, Petty Cash)
    (accountsPayable || []).forEach(ap => {
        if ((ap.invoiceNumber?.toLowerCase() || '').includes(q) || (ap.description?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Finance', title: `Payable: ${ap.invoiceNumber}`, subtitle: ap.description, id: ap.id, tab: 'accounts-payable' });
        }
    });
    (accountsReceivable || []).forEach(ar => {
        if ((ar.invoiceNumber?.toLowerCase() || '').includes(q) || (ar.description?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Finance', title: `Receivable: ${ar.invoiceNumber}`, subtitle: ar.description, id: ar.id, tab: 'accounts-receivable' });
        }
    });
    (pettyCash || []).forEach(pc => {
        if ((pc.description?.toLowerCase() || '').includes(q) || (pc.requestedBy?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Finance', title: `Petty Cash: ${pc.description}`, subtitle: `Requested by ${pc.requestedBy}`, id: pc.id, tab: 'petty-cash' });
        }
    });
    
    // Search Nav Items
    (navItems || []).forEach(item => {
        if ((item.label?.toLowerCase() || '').includes(q)) {
            results.push({ type: 'Navigation', title: item.label, subtitle: 'System Section', id: item.id, tab: item.id });
        }
        if (item.subItems) {
            item.subItems.forEach((sub: any) => {
                if ((sub.label?.toLowerCase() || '').includes(q)) {
                    results.push({ type: 'Navigation', title: sub.label, subtitle: `${item.label} Section`, id: sub.id, tab: sub.id });
                }
            });
        }
    });

    // Search Employee Documents
    (employees || []).forEach(emp => {
        const docNames = ['emirates id', 'passport', 'visa', 'labour card'];
        docNames.forEach(name => {
            if (name.includes(q)) {
                results.push({ 
                    type: 'Document', 
                    title: `${emp.name} - ${name.toUpperCase()}`, 
                    subtitle: 'Employee Document', 
                    id: `${emp.id}-${name}`, 
                    tab: 'staff' 
                });
            }
        });
        
        emp.driveFiles?.forEach((file: any) => {
            if ((file.name?.toLowerCase() || '').includes(q)) {
                results.push({ 
                    type: 'Document', 
                    title: file.name, 
                    subtitle: `File for ${emp.name}`, 
                    id: file.id, 
                    tab: 'staff',
                    url: file.webViewLink
                });
            }
        });
    });

    // Search Company Documents
    (companies || []).forEach(comp => {
        comp.driveFiles?.forEach((file: any) => {
            if ((file.name?.toLowerCase() || '').includes(q)) {
                results.push({ 
                    type: 'Document', 
                    title: file.name, 
                    subtitle: `Company File: ${comp.name}`, 
                    id: file.id, 
                    tab: 'company',
                    url: file.webViewLink
                });
            }
        });
    });

    // Search for "company document" or "employee documents"
    if (q.includes('company document') || q.includes('company docs')) {
        results.push({ 
            type: 'Directory', 
            title: 'Company Documents Directory', 
            subtitle: 'Access all company-wide documents and files', 
            id: 'company-docs-dir', 
            tab: 'company' 
        });
    }
    if (q.includes('employee document') || q.includes('employee docs') || q.includes('staff document')) {
        results.push({ 
            type: 'Directory', 
            title: 'Employee Documents Directory', 
            subtitle: 'Access all staff-related documents and records', 
            id: 'employee-docs-dir', 
            tab: 'staff' 
        });
    }
    
    return results;
  }, [searchQuery, employees, companies, navItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  const mainBgClass = useMemo(() => {
    if (ambianceMode === 'matrix') {
      return "flex-1 overflow-y-auto overflow-x-hidden min-w-0 max-w-full bg-[#f8fafc] bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px] transition-all duration-500";
    } else if (ambianceMode === 'luminous') {
      return "flex-1 overflow-y-auto overflow-x-hidden min-w-0 max-w-full bg-gradient-to-tr from-[#f8fafc] via-white to-brand-50/20 transition-all duration-500";
    }
    return "flex-1 overflow-y-auto overflow-x-hidden min-w-0 max-w-full bg-slate-50/50 transition-all duration-500";
  }, [ambianceMode]);

  return (
    <div className="min-h-screen bg-slate-50/20 flex flex-col transition-colors duration-300">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Desktop Nav */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 shrink-0 cursor-pointer select-none" onClick={() => setActiveTab('dashboard')}>
                {portalBranding?.logoUrl ? (
                  <div className="rounded-xl border border-slate-200/50 bg-white shadow-md shadow-slate-100 flex items-center justify-center w-10 h-10 overflow-hidden shrink-0">
                    <img 
                      src={portalBranding.logoUrl} 
                      alt="Portal Logo" 
                      referrerPolicy="no-referrer" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-600/20 rotate-3 flex items-center justify-center w-10 h-10 shrink-0">
                    <Building2 className="text-white w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-sans font-black text-lg text-slate-900 leading-none tracking-tight">
                    {portalBranding?.logoText || 'PIONEER'}
                  </span>
                  <span className="text-[9px] font-bold text-brand-600 tracking-[0.2em] mt-0.5 uppercase">
                    {portalBranding?.logoSubtext || 'DMS PORTAL'}
                  </span>
                </div>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-0.5">
                {navItems.map((item) => {
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isParentActive = hasSubItems && item.subItems.some((sub: any) => sub.id === activeTab);
                  const isActive = activeTab === item.id || isParentActive;

                  if (hasSubItems) {
                    return (
                      <div 
                        key={item.id} 
                        className="relative group"
                        onMouseEnter={() => setOpenDropdown(item.id)}
                        onMouseLeave={() => setOpenDropdown(null)}
                      >
                        <button
                          onClick={() => {
                            if (item.id === 'finance') {
                              setActiveTab('finance');
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1.5 relative group",
                            isActive 
                              ? "text-brand-600 bg-brand-50" 
                              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          <item.icon className={cn(
                            "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
                            isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                          )} />
                          {item.label}
                          <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", openDropdown === item.id && "rotate-180")} />
                          {isActive && (
                            <motion.div
                              layoutId="active-nav-indicator"
                              className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-600 rounded-full"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </button>

                        <AnimatePresence>
                          {openDropdown === item.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-full left-0 mt-1 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-1.5 z-50"
                            >
                              {item.subItems.map((sub: any) => (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    setActiveTab(sub.id);
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all",
                                    activeTab === sub.id
                                      ? "bg-brand-50 text-brand-600"
                                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                  )}
                                >
                                  <sub.icon className={cn("w-4 h-4", activeTab === sub.id ? "text-brand-600" : "text-slate-400")} />
                                  {sub.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1.5 relative group",
                        activeTab === item.id 
                          ? "text-brand-600 bg-brand-50" 
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <item.icon className={cn(
                        "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
                        activeTab === item.id ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                      )} />
                      {item.label}
                      {activeTab === item.id && (
                        <motion.div
                          layoutId="active-nav-indicator"
                          className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-600 rounded-full"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              
              {/* Search Icon - Desktop */}
              {!isEmployee && (
                <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all group relative"
                  title="Search (Ctrl+K)"
                >
                  <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <div className="absolute -bottom-1 -right-1 hidden xl:flex items-center gap-0.5 px-1 py-0.5 bg-white border border-slate-200 rounded shadow-sm scale-75">
                    <span className="text-[8px] font-bold text-slate-400">⌘K</span>
                  </div>
                </button>
              )}

              {/* Notifications */}
              {!isEmployee && (
                <div className="relative">
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all relative group"
                  >
                    <Bell className="w-4 h-4 group-hover:animate-swing" />
                    {expiringDocs.length > 0 && (
                      <span className={cn(
                        "absolute top-2 right-2 w-1.5 h-1.5 rounded-full border border-white",
                        expiringDocs.some(d => d.status === 'Expired') ? "bg-red-500" : "bg-orange-500"
                      )}></span>
                    )}
                  </button>

                  <AnimatePresence>
                    {isNotificationsOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)}></div>
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-20 overflow-hidden"
                        >
                          <div className="p-4 border-b border-slate-50 mb-2">
                            <p className="text-xs font-bold text-slate-900 uppercase tracking-widest">Document Alerts</p>
                          </div>
                          <div className="max-h-80 overflow-y-auto space-y-1">
                            {expiringDocs.length === 0 ? (
                              <div className="p-8 text-center">
                                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-400">No active alerts</p>
                              </div>
                            ) : (
                             expiringDocs.map((doc, idx) => (
                               <button
                                 key={idx}
                                 onClick={() => {
                                   onNotificationClick?.(doc);
                                   setIsNotificationsOpen(false);
                                 }}
                                 className="w-full text-left p-3 hover:bg-slate-100 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 block transition-all relative cursor-pointer active:scale-[0.98]"
                               >
                                 <div className="flex justify-between items-start">
                                   <span className={cn(
                                     "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                                     doc.status === 'Expired' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                                   )}>
                                     {doc.status}
                                   </span>
                                   <span className="text-[10px] font-bold text-slate-400">{doc.date}</span>
                                 </div>
                                 <p className="text-xs font-bold text-slate-900">
                                   {doc.type === 'company' ? `Company: ${doc.employeeName}` : 
                                    doc.type === 'cicpa' ? `CICPA: ${doc.employeeName}` :
                                    doc.type === 'safety' ? `Safety: ${doc.employeeName}` :
                                    doc.employeeName}
                                 </p>
                                 <p className="text-[10px] font-medium text-slate-500">{doc.docName}</p>
                               </button>
                             ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

              {/* User Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 group"
                >
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-slate-900 leading-none">{user.name}</div>
                    <div className="text-[9px] text-brand-600 font-black uppercase tracking-wider mt-0.5">
                      {user.email?.toLowerCase() === 'abdulkaderp3010@gmail.com' ? 'CREATOR' : (user.role || '').toUpperCase()}
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-brand-600/20 group-hover:scale-105 transition-transform overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>
                  <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform duration-300", isUserDropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isUserDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsUserDropdownOpen(false)}></div>
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-20 overflow-hidden"
                      >
                        <div className="p-4 border-b border-slate-50 mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                          <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
                        </div>
                        <div className="space-y-1">
                          <button 
                            onClick={() => {
                                setActiveTab('profile');
                                setIsUserDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all"
                          >
                            <User className="w-4 h-4" /> My Profile
                          </button>
                          <button 
                            onClick={() => {
                                setActiveTab('settings');
                                setIsUserDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all"
                          >
                            <Settings className="w-4 h-4" /> Account Settings
                          </button>
                          {!isEmployee && (
                            <button 
                              onClick={() => {
                                  (window as any).openShortcuts?.();
                                  setIsUserDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all"
                            >
                              <LayoutGrid className="w-4 h-4" /> Keyboard Shortcuts
                            </button>
                          )}
                          <button 
                            onClick={() => {
                                setActiveTab('help');
                                setIsUserDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all"
                          >
                            <HelpCircle className="w-4 h-4" /> Help Center
                          </button>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-50">
                          <button 
                            onClick={onLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all"
                          >
                            <LogOut className="w-4 h-4" /> Sign Out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Search Modal */}
              <AnimatePresence>
                {isSearchOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsSearchOpen(false)}
                      className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100]"
                    />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -20 }}
                        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-[101] overflow-hidden border border-slate-200"
                      >
                        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                          <Search className="w-6 h-6 text-brand-600" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for employees, documents, or reports..."
                            className="flex-1 bg-transparent border-none outline-none text-lg font-medium placeholder:text-slate-400 text-slate-900"
                          />
                          <button 
                            onClick={() => setIsSearchOpen(false)}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                          {searchQuery ? (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Search Results</p>
                              {searchResults.length > 0 ? (
                                  <div className="space-y-1">
                                      {searchResults.map((res, idx) => (
                                          <button 
                                              key={idx}
                                              onClick={() => {
                                                  if (res.url) {
                                                      window.open(res.url, '_blank');
                                                  }
                                                  setActiveTab(res.tab);
                                                  setIsSearchOpen(false);
                                                  setSearchQuery('');
                                              }}
                                              className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:border-brand-100 hover:bg-brand-50 transition-all group text-left"
                                          >
                                              <div className="flex items-center gap-4">
                                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                                      {res.type === 'Employee' ? (
                                                          <User className="w-5 h-5 text-brand-600" />
                                                      ) : res.type === 'Company' ? (
                                                          <Building2 className="w-5 h-5 text-brand-600" />
                                                      ) : res.type === 'Project' ? (
                                                          <Briefcase className="w-5 h-5 text-brand-600" />
                                                      ) : (res.type === 'Supplier' || res.type === 'Client') ? (
                                                          <Truck className="w-5 h-5 text-brand-600" />
                                                      ) : res.type === 'Finance' ? (
                                                          <Wallet className="w-5 h-5 text-brand-600" />
                                                      ) : (res.type === 'Directory' || res.type === 'Document') ? (
                                                          <FileText className="w-5 h-5 text-brand-600" />
                                                      ) : (
                                                          <Globe className="w-5 h-5 text-brand-600" />
                                                      )}
                                                  </div>
                                                  <div>
                                                      <p className="text-sm font-bold text-slate-900">{res.title}</p>
                                                      <p className="text-[10px] font-bold text-slate-400 uppercase">{res.subtitle}</p>
                                                  </div>
                                              </div>
                                              <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                                                  {res.type}
                                              </span>
                                          </button>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="p-8 text-center">
                                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                          <Search className="w-8 h-8 text-slate-300" />
                                      </div>
                                      <p className="text-slate-900 font-black text-lg uppercase tracking-tight">Result Not Available</p>
                                      <p className="text-slate-500 font-medium mt-1">We couldn't find any matching records for "{searchQuery}" across the entire site.</p>
                                      <p className="text-slate-400 text-xs mt-4 bg-slate-50 py-2 px-4 rounded-xl inline-block border border-slate-100">Try searching for EID, Passport, Labour Card, Project Code, Staff Name, or Invoice Number</p>
                                  </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-6 p-4">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
                                <div className="grid grid-cols-2 gap-3">
                                  {navItems.slice(0, 4).map((item: any) => (
                                    <button 
                                      key={item.id}
                                      onClick={() => {
                                        setActiveTab(item.id);
                                        setIsSearchOpen(false);
                                      }}
                                      className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-all group"
                                    >
                                      <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-white transition-colors">
                                        <item.icon className="w-4 h-4 text-slate-500 group-hover:text-brand-600" />
                                      </div>
                                      <span className="text-sm font-bold text-slate-700 group-hover:text-brand-700">{item.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1.5">
                              <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded">ESC</kbd>
                              <span className="text-[10px] text-slate-400 font-bold">to close</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded">↵</kbd>
                              <span className="text-[10px] text-slate-400 font-bold">to select</span>
                            </div>
                          </div>
                          <div className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Pioneer DMS Search</div>
                        </div>
                      </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2.5 hover:bg-slate-100 rounded-2xl xl:hidden text-slate-600"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-600 p-2 rounded-xl">
                    <Building2 className="text-white w-5 h-5" />
                  </div>
                  <span className="font-bold text-lg text-slate-900">Pioneer DMS Portal</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {navItems.map((item) => {
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isParentActive = hasSubItems && item.subItems.some((sub: any) => sub.id === activeTab);
                  const isActive = activeTab === item.id || isParentActive;

                  if (hasSubItems) {
                    const isExpanded = mobileExpanded === item.id;
                    return (
                      <div key={item.id} className="space-y-1">
                        <button
                          onClick={() => setMobileExpanded(isExpanded ? null : item.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all font-bold",
                            isActive 
                              ? "bg-brand-50 text-brand-600" 
                              : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <item.icon className={cn("w-5 h-5", isActive ? "text-brand-600" : "text-slate-400")} />
                            {item.label}
                          </div>
                          <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isExpanded && "rotate-180")} />
                        </button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden pl-4 space-y-1"
                            >
                              {item.subItems.map((sub: any) => (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    setActiveTab(sub.id);
                                    setIsMobileMenuOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-bold text-sm",
                                    activeTab === sub.id 
                                      ? "text-brand-600 bg-brand-50" 
                                      : "text-slate-500 hover:bg-slate-50"
                                  )}
                                >
                                  <sub.icon className={cn("w-4 h-4", activeTab === sub.id ? "text-brand-600" : "text-slate-400")} />
                                  {sub.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold",
                        activeTab === item.id 
                          ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-slate-400")} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-6 border-t border-slate-100">
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-red-600 font-bold hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className={mainBgClass}>
        <div className="w-full p-4 sm:p-6 lg:p-10 max-w-full">
          {/* Active / Upcoming Meeting Alert Banner */}
          <AnimatePresence>
            {activeMeetingAlert && (
              <motion.div
                initial={{ opacity: 0, y: -15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                className="bg-gradient-to-r from-indigo-50 to-brand-50 border border-indigo-100/80 rounded-3xl p-5 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-left"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md ring-4 ring-indigo-100 flex-shrink-0">
                    <Video className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-500 uppercase tracking-widest leading-none">
                      {new Date() >= new Date(activeMeetingAlert.dateTime) && new Date() <= new Date(new Date(activeMeetingAlert.dateTime).getTime() + (activeMeetingAlert.duration || 30) * 60 * 1000)
                        ? '🔴 Active Meeting Now'
                        : '⏰ Meeting Starting Soon'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1.5 leading-tight">{activeMeetingAlert.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Scheduled for {new Date(activeMeetingAlert.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at{' '}
                      {new Date(activeMeetingAlert.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({activeMeetingAlert.duration} min)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 self-end md:self-auto">
                  <button
                    onClick={() => setActiveTab('tasks-notes')}
                    className="px-4 py-2 text-indigo-600 hover:text-indigo-800 text-xs font-black uppercase tracking-wider transition-all hover:bg-white rounded-xl cursor-pointer"
                  >
                    View Workspace
                  </button>
                  {activeMeetingAlert.meetLink ? (
                    <a
                      href={activeMeetingAlert.meetLink}
                      target="_blank"
                      rel="referrer noopener"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 transition-all text-center"
                    >
                      Join Meeting <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic font-semibold px-3 py-2 bg-slate-100/50 border border-slate-200/60 rounded-xl">No Link</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={animationIntensity === 'none' ? { opacity: 1 } : { opacity: 0, y: 15, scale: 0.99 }}
              animate={animationIntensity === 'none' ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={animationIntensity === 'none' ? { opacity: 1 } : { opacity: 0, y: -15, scale: 0.99 }}
              transition={
                animationIntensity === 'none' ? { duration: 0 } :
                animationIntensity === 'snappy' ? { duration: 0.12, ease: "easeOut" } :
                { type: "spring", stiffness: 170, damping: 20 }
              }
              className="w-full max-w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <SupportModal 
        isOpen={isSupportModalOpen} 
        onClose={() => setIsSupportModalOpen(false)} 
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/60 py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                <Globe className="w-4 h-4" />
                <span>Pioneer Document Management System v5.0</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-slate-400 text-sm font-bold">
              <button 
                onClick={() => {
                  setLegalModalTab('privacy');
                  setIsLegalModalOpen(true);
                }}
                className="hover:text-indigo-650 transition-colors"
              >
                Privacy Policy
              </button>
              <button 
                onClick={() => {
                  setLegalModalTab('terms');
                  setIsLegalModalOpen(true);
                }}
                className="hover:text-indigo-650 transition-colors"
              >
                Terms of Service
              </button>
              <button 
                onClick={() => setIsSupportModalOpen(true)}
                className="hover:text-brand-600 transition-colors"
              >
                Contact Support
              </button>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-slate-400 text-xs font-medium text-center md:text-right">
                © {new Date().getFullYear()} Pioneer. All rights reserved.
              </p>
              <p className="text-slate-400 text-xs font-semibold text-center md:text-right">
                Web Application Developed by{' '}
                <button 
                  onClick={() => {
                    setEditedDevProfile({ ...devProfile });
                    setIsDevEditMode(false);
                    setIsDevModalOpen(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 underline font-extrabold cursor-pointer transition-all"
                >
                  {devProfile.name}
                </button>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Developer Profile Modal */}
      {isDevModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col border border-slate-100"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Developer Information</h3>
              <button 
                onClick={() => setIsDevModalOpen(false)}
                className="p-1 hover:bg-slate-200/50 text-slate-400 hover:text-slate-750 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              {!isDevEditMode ? (
                <div className="space-y-4 text-center">
                  <div 
                    onClick={() => {
                      if (devProfile.photoUrl) setIsDevLightboxOpen(true);
                    }}
                    className={`mx-auto w-24 h-24 rounded-full border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-100 shadow-inner group transition-all duration-300 ${devProfile.photoUrl ? 'cursor-zoom-in hover:scale-105 active:scale-95 hover:border-indigo-400 hover:ring-4 hover:ring-indigo-100' : ''}`}
                    title={devProfile.photoUrl ? "Click to view full photo" : "No photo uploaded yet"}
                  >
                    {devProfile.photoUrl ? (
                      <img src={devProfile.photoUrl} alt="Developer" className="w-full h-full object-cover group-hover:brightness-95 transition-all" />
                    ) : (
                      <span className="text-2xl font-black text-slate-400">MAK</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900">{devProfile.name}</h4>
                    <p className="text-xs text-brand-600 font-extrabold mt-0.5">Full Stack Solution Architect</p>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed font-semibold px-4">{devProfile.bio}</p>
                  
                  <div className="border-t border-slate-100 pt-4 space-y-2.5 text-left text-xs font-bold text-slate-705 px-2">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-brand-600 shrink-0" />
                      <a href={`mailto:${devProfile.email}`} className="text-slate-700 hover:text-brand-650 transition-colors underline">{devProfile.email}</a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-brand-600 shrink-0" />
                      <a href={`tel:${devProfile.contactNumber}`} className="text-slate-700 hover:text-brand-650 transition-colors">{devProfile.contactNumber}</a>
                    </div>
                  </div>

                  {isCreatorUser && (
                    <div className="pt-4 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setEditedDevProfile({ ...devProfile });
                          setIsDevEditMode(true);
                        }}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        Edit Details
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Photo Edit */}
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      onClick={() => {
                        if (editedDevProfile.photoUrl) setIsDevLightboxOpen(true);
                      }}
                      className={`w-24 h-24 rounded-full border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-100 relative group transition-all duration-305 ${editedDevProfile.photoUrl ? 'cursor-zoom-in hover:scale-105 active:scale-95 hover:border-indigo-400 hover:ring-4 hover:ring-indigo-100' : ''}`}
                      title={editedDevProfile.photoUrl ? "Click to view full photo" : ""}
                    >
                      {editedDevProfile.photoUrl ? (
                        <img src={editedDevProfile.photoUrl} alt="Developer" className="w-full h-full object-cover group-hover:brightness-95 transition-all" />
                      ) : (
                        <span className="text-2xl font-black text-slate-400">MAK</span>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      id="dev-photo-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCropImageSrc(reader.result as string);
                            setCropScale(1.2);
                            setCropPanX(0);
                            setCropPanY(0);
                            setIsCropModalOpen(true);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label htmlFor="dev-photo-input" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-[10px] font-black cursor-pointer transition-all border border-slate-250/60 shadow-sm flex items-center gap-1 hover:border-slate-350">
                      <Crop className="w-3 h-3 text-brand-600" /> Upload & Crop Picture
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Developer Name</label>
                      <input 
                        type="text"
                        value={editedDevProfile.name}
                        onChange={e => setEditedDevProfile({ ...editedDevProfile, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250/60 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Email Address</label>
                      <input 
                        type="email"
                        value={editedDevProfile.email}
                        onChange={e => setEditedDevProfile({ ...editedDevProfile, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250/60 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Contact Number</label>
                      <input 
                        type="text"
                        value={editedDevProfile.contactNumber}
                        onChange={e => setEditedDevProfile({ ...editedDevProfile, contactNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250/60 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Brief Bio</label>
                      <textarea 
                        value={editedDevProfile.bio}
                        onChange={e => setEditedDevProfile({ ...editedDevProfile, bio: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-250/60 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsDevEditMode(false)}
                      className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDevProfile}
                      className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Crop & Adjust Modal */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col border border-slate-100"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Crop className="w-5 h-5 text-indigo-600 animate-pulse animate-duration-1000" />
                <h3 className="text-base font-black text-slate-900 tracking-tight">Crop & Adjust Portrait</h3>
              </div>
              <button 
                onClick={() => setIsCropModalOpen(false)}
                className="p-1 hover:bg-slate-200/50 text-slate-400 hover:text-slate-755 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center justify-center space-y-6">
              <p className="text-slate-500 text-[11px] font-bold text-center">
                💡 <span className="text-indigo-650">Drag / Swipe</span> directly on the photo below, or use the fine-tuning sliders to center and scale your face.
              </p>

              {/* Viewport container with circular cutout mask */}
              <div 
                className="relative w-[280px] h-[280px] bg-slate-900 rounded-[2rem] overflow-hidden cursor-move select-none border-2 border-slate-200/80 shadow-md animate-fade-in"
                onMouseDown={handleCropDragStart}
                onMouseMove={handleCropDragMove}
                onMouseUp={handleCropDragEnd}
                onMouseLeave={handleCropDragEnd}
                onTouchStart={handleCropDragStart}
                onTouchMove={handleCropDragMove}
                onTouchEnd={handleCropDragEnd}
              >
                <img 
                  src={cropImageSrc} 
                  alt="Crop Target"
                  style={{
                    transform: `translate(${cropPanX}px, ${cropPanY}px) scale(${cropScale})`,
                    transformOrigin: 'center center',
                  }}
                  className="w-full h-full object-contain pointer-events-none transition-transform"
                />
                
                {/* Circular Mask guide */}
                <div className="absolute inset-0 pointer-events-none border-[40px] border-slate-950/70 flex items-center justify-center">
                  <div className="w-[200px] h-[200px] border-2 border-dashed border-white rounded-full bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                </div>
              </div>

              {/* Zoom & Translation sliders */}
              <div className="w-full space-y-4 px-1">
                {/* Zoom */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span className="flex items-center gap-1"><ZoomIn className="w-3.5 h-3.5 text-brand-600" /> Zoom Level</span>
                    <span className="text-indigo-600 font-extrabold">{Math.round(cropScale * 100)}%</span>
                  </div>
                  <input 
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.02"
                    value={cropScale}
                    onChange={(e) => setCropScale(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                  />
                </div>

                {/* Left/Right Offset */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>Horizontal Position (X)</span>
                    <span className="text-slate-705 font-bold">{cropPanX}px</span>
                  </div>
                  <input 
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={cropPanX}
                    onChange={(e) => setCropPanX(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                </div>

                {/* Up/Down Offset */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>Vertical Position (Y)</span>
                    <span className="text-slate-705 font-bold">{cropPanY}px</span>
                  </div>
                  <input 
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={cropPanY}
                    onChange={(e) => setCropPanY(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                </div>
              </div>

              {/* Alignment Tools Row */}
              <div className="flex gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCropScale(1.2);
                    setCropPanX(0);
                    setCropPanY(0);
                  }}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm text-center"
                >
                  Reset Positioning & Scale
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsCropModalOpen(false)}
                className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="flex-1 px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Crop & Apply
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Lightbox Modal */}
      {isDevLightboxOpen && (
        <div 
          onClick={() => setIsDevLightboxOpen(false)}
          className="fixed inset-0 z-[230] flex flex-col items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md no-print cursor-zoom-out"
        >
          <button 
            onClick={() => setIsDevLightboxOpen(false)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10 cursor-pointer"
            title="Close Lightbox"
          >
            <X className="w-5 h-5" />
          </button>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-[75vh] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 cursor-default"
          >
            {devProfile.photoUrl ? (
              <img 
                src={devProfile.photoUrl} 
                alt={`${devProfile.name} Full Profile`} 
                className="max-w-md w-full max-h-[70vh] object-contain block mx-auto xs:max-w-xs md:max-w-md lg:max-w-lg shadow-inner"
              />
            ) : null}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent p-5 text-center">
              <h4 className="text-white text-base font-black tracking-tight">{devProfile.name}</h4>
              <p className="text-indigo-400 text-xs font-bold">Solutions Architect</p>
            </div>
          </motion.div>
          <p className="text-white/50 text-[10px] font-bold mt-4 tracking-wider uppercase">
            Click anywhere to exit view
          </p>
        </div>
      )}

      {/* Legal Policies Modal (Privacy and Terms) */}
      {isLegalModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl relative flex flex-col border border-slate-100 max-h-[85vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 block shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Legal Center & Governance Agreements</h3>
                <p className="text-[10px] text-slate-400 font-bold">Policy version 5.0 — active operational rules.</p>
              </div>
              <button 
                onClick={() => setIsLegalModalOpen(false)}
                className="p-1 hover:bg-slate-200/50 text-slate-400 hover:text-slate-750 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-100 flex gap-4 bg-slate-50/20 block shrink-0">
              <button
                onClick={() => setLegalModalTab('privacy')}
                className={`py-3 text-xs font-black relative transition-all cursor-pointer ${legalModalTab === 'privacy' ? 'text-brand-650' : 'text-slate-405 hover:text-slate-700'}`}
              >
                Privacy Policy
                {legalModalTab === 'privacy' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />}
              </button>
              <button
                onClick={() => setLegalModalTab('terms')}
                className={`py-3 text-xs font-black relative transition-all cursor-pointer ${legalModalTab === 'terms' ? 'text-brand-650' : 'text-slate-405 hover:text-slate-700'}`}
              >
                Terms of Service
                {legalModalTab === 'terms' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />}
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto text-xs text-slate-650 leading-relaxed space-y-4">
              {legalModalTab === 'privacy' ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-800">1. Data Collected & Operations</h4>
                  <p>
                    We collect essential information to facilitate secure document workflow. This includes company registries, 
                    employee names, designations, corporate attachments, invoice bills, receipts, and user access records. 
                    All data is persisted in physical data systems and Google Cloud hosting nodes secured by direct Firestore access rules.
                  </p>
                  <h4 className="text-sm font-black text-slate-800">2. Usage Rights & Communication Scopes</h4>
                  <p>
                    Data uploaded is strictly analyzed to notify project overseers about engineer document expirations, 
                    attendance balances, personnel tally sheets, meeting updates, and accounts payable balances. We never share, 
                    license, sell, or rent your database storage units to external metrics hubs or commercial vendors.
                  </p>
                  <h4 className="text-sm font-black text-slate-800">3. Cloud Permissions & Auth Rules</h4>
                  <p>
                    Secure Firestore permissions are monitored continuously. User login credentials, biometric/camera feeds for attendance 
                    clipping, and storage drives are locked on a strict role-based permission system. Employees can only access logs associated 
                    with their specific identification keys.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-800">1. Terms of Service Acceptance</h4>
                  <p>
                    By logging into the Pioneer DMS corporate dashboard, you represent that you are an Authorized System Employee, Subcontractor, 
                    or Administrator. You agree to upload authentic, verified files, tax registration numbers (TRN), and invoice ledgers.
                  </p>
                  <h4 className="text-sm font-black text-slate-800">2. Code Integrity & Platform Standard</h4>
                  <p>
                    No employee or supervisor may inject scripts, dump mock telemetry lists, or run unauthorized scraper hooks against the API. 
                    The software is provided "as is" under the governance of the head software creator, Mohamed Abdul Kader.
                  </p>
                  <h4 className="text-sm font-black text-slate-800">3. Accounts & Reconciliation Audits</h4>
                  <p>
                    The client agrees that all Everyday Operating Expenses must correspond to registered operational receipts. Any discrepancies in 
                    personnel tallies, petty cash balance mismatches, and accounts payable remarks are logged to the Audit Room automatically.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end bg-slate-50/50 block shrink-0">
              <button
                onClick={() => setIsLegalModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer"
              >
                Accept & Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

