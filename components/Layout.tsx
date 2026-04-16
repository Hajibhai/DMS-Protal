import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, ChevronDown, 
  LogOut, Settings, User, Bell, Search,
  Building2, Globe, HelpCircle, FileText, LayoutGrid,
  Briefcase, Truck, Wallet, Check
} from 'lucide-react';
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
  pettyCash
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    
    const results: any[] = [];
    
    // Search Employees
    (employees || []).forEach(emp => {
        if (
            (emp.name?.toLowerCase() || '').includes(q) || 
            (emp.code?.toLowerCase() || '').includes(q) || 
            (emp.designation?.toLowerCase() || '').includes(q) ||
            (emp.department?.toLowerCase() || '').includes(q) ||
            (emp.company?.toLowerCase() || '').includes(q)
        ) {
            results.push({ type: 'Employee', title: emp.name, subtitle: `${emp.code} - ${emp.designation} (${emp.company})`, id: emp.id, tab: 'staff' });
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

  return (
    <div className="min-h-screen bg-white flex flex-col transition-colors duration-300">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Desktop Nav */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-600/20 rotate-3">
                  <Building2 className="text-white w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-lg text-slate-900 leading-none tracking-tight">PIONEER</span>
                  <span className="text-[9px] font-bold text-brand-600 tracking-[0.2em] mt-0.5">DMS PORTAL</span>
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

              {/* Notifications */}
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
                              <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
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
                                  {doc.type === 'company' ? `Company: ${doc.employeeName}` : doc.employeeName}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500">{doc.docName}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

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
                      {user.email === 'abdulkaderp3010@gmail.com' ? 'CREATOR' : user.role.toUpperCase()}
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
                          <button 
                            onClick={() => {
                                (window as any).openShortcuts?.();
                                setIsUserDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-all"
                          >
                            <LayoutGrid className="w-4 h-4" /> Keyboard Shortcuts
                          </button>
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
                                      <p className="text-slate-400 text-xs mt-4 bg-slate-50 py-2 px-4 rounded-xl inline-block border border-slate-100">Try searching for Project Code, Staff Name, or Invoice Number</p>
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
      <main className="flex-1 overflow-y-auto">
        <div className="w-full p-4 sm:p-6 lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
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
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <Globe className="w-4 h-4" />
              <span>Pioneer Document Management System v2.5</span>
            </div>
            <div className="flex items-center gap-6 text-slate-400 text-sm font-bold">
              <button className="hover:text-brand-600 transition-colors">Privacy Policy</button>
              <button className="hover:text-brand-600 transition-colors">Terms of Service</button>
              <button 
                onClick={() => setIsSupportModalOpen(true)}
                className="hover:text-brand-600 transition-colors"
              >
                Contact Support
              </button>
            </div>
            <p className="text-slate-400 text-xs font-medium">
              © {new Date().getFullYear()} Pioneer. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

