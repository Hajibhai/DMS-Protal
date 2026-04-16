import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocFromServer,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Employee, 
  AttendanceRecord, 
  AttendanceStatus, 
  StaffType, 
  LeaveRequest, 
  LeaveStatus, 
  PublicHoliday, 
  OffboardingDetails, 
  SystemUser, 
  AboutData, 
  DeductionRecord,
  Company,
  Supplier,
  Project,
  Vendor,
  AccountsPayable,
  AccountsReceivable,
  PettyCash,
  ProjectedExpense,
  EverydayExpense,
  AuditLog,
  UserRole
} from "../types";

// Helper for error handling as per spec
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// Test connection on boot
export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
};

// Helper to remove undefined values before saving to Firestore
const cleanData = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(cleanData);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc: any, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanData(value);
      }
      return acc;
    }, {});
  }
  return obj;
};

// --- Employees ---
export const saveEmployee = async (employee: Employee) => {
  try {
    const cleaned = cleanData(employee);
    await setDoc(doc(db, 'employees', employee.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `employees/${employee.id}`);
  }
};

export const deleteEmployee = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'employees', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `employees/${id}`);
  }
};

export const offboardEmployee = async (id: string, details: OffboardingDetails) => {
  try {
    await updateDoc(doc(db, 'employees', id), cleanData({
      status: 'Inactive',
      active: false,
      offboardingDetails: details
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
  }
};

export const rehireEmployee = async (id: string, rejoiningDate: string, reason: string) => {
  try {
    await updateDoc(doc(db, 'employees', id), {
      status: 'Active',
      active: true,
      joiningDate: rejoiningDate,
      rejoiningDate: rejoiningDate,
      rejoiningReason: reason,
      offboardingDetails: null
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
  }
};

// --- Attendance ---
export const logAttendance = async (
  employeeId: string, 
  status: AttendanceStatus,
  dateOverride?: string,
  overtimeHours?: number,
  otAttachment?: string,
  updatedBy?: string,
  note?: string,
  hoursWorked?: number
) => {
  const now = new Date();
  let dateStr = dateOverride;
  if (!dateStr) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
  }

  const recordId = `${employeeId}_${dateStr}`;
  const recordRef = doc(db, 'attendance', recordId);

  let hours = hoursWorked !== undefined ? hoursWorked : 0;
  if (hoursWorked === undefined && status === AttendanceStatus.PRESENT) hours = 8;

  try {
    const snap = await getDoc(recordRef);
    if (!snap.exists()) {
      const newRecord: AttendanceRecord = {
        id: recordId,
        employeeId,
        date: dateStr,
        status,
        hoursWorked: hours,
        overtimeHours: overtimeHours || 0,
        checkInTime: status === AttendanceStatus.PRESENT ? new Date().toISOString() : undefined,
        otAttachment: otAttachment,
        updatedBy: updatedBy || 'System',
        note: note
      };
      await setDoc(recordRef, cleanData(newRecord));
    } else {
      const updates: any = {
        status,
        hoursWorked: hours,
        updatedBy: updatedBy || 'System'
      };
      if (note !== undefined) updates.note = note;
      if (overtimeHours !== undefined) updates.overtimeHours = overtimeHours;
      if (otAttachment !== undefined) updates.otAttachment = otAttachment;
      if (status === AttendanceStatus.PRESENT && !snap.data().checkInTime) {
        updates.checkInTime = new Date().toISOString();
      }
      await updateDoc(recordRef, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `attendance/${recordId}`);
  }
};

export const deleteAttendanceRecord = async (employeeId: string, date: string) => {
  const recordId = `${employeeId}_${date}`;
  try {
    await deleteDoc(doc(db, 'attendance', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendance/${recordId}`);
  }
};

// --- Leaves ---
export const saveLeaveRequest = async (request: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'>, createdBy: string) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newRequest: LeaveRequest = {
    ...request,
    id,
    status: LeaveStatus.PENDING,
    appliedOn: new Date().toISOString().split('T')[0],
    createdBy: createdBy
  };
  try {
    await setDoc(doc(db, 'leaves', id), cleanData(newRequest));
    return newRequest;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `leaves/${id}`);
  }
};

export const updateLeaveRequestStatus = async (id: string, status: LeaveStatus, approvedBy?: string) => {
  try {
    const leaveRef = doc(db, 'leaves', id);
    const snap = await getDoc(leaveRef);
    if (!snap.exists()) return;
    const req = snap.data() as LeaveRequest;

    const updates: any = { status };
    if (approvedBy && status === LeaveStatus.APPROVED) {
      updates.approvedBy = approvedBy;
    }
    await updateDoc(leaveRef, updates);

    if (status === LeaveStatus.APPROVED) {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
         const dateStr = d.toISOString().split('T')[0];
         await logAttendance(req.employeeId, req.type, dateStr, 0, undefined, approvedBy || 'System', `Leave Approved by ${approvedBy || 'System'}`);
      }

      if (req.type === AttendanceStatus.ANNUAL_LEAVE || req.type === AttendanceStatus.SICK_LEAVE) {
        const empRef = doc(db, 'employees', req.employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const emp = empSnap.data() as Employee;
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
          await updateDoc(empRef, {
            leaveBalance: Math.max(0, emp.leaveBalance - diffDays)
          });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leaves/${id}`);
  }
};

// --- Deductions ---
export const saveDeduction = async (deduction: Omit<DeductionRecord, 'id'>) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newRecord: DeductionRecord = { ...deduction, id };
  try {
    await setDoc(doc(db, 'deductions', id), cleanData(newRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `deductions/${id}`);
  }
};

export const deleteDeduction = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'deductions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `deductions/${id}`);
  }
};

// --- Companies ---
export const addCompany = async (companyData: Omit<Company, 'id'>, currentCompaniesCount: number = 0) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newCompany: Company = {
    id,
    ...companyData,
    order: currentCompaniesCount
  };
  try {
    await setDoc(doc(db, 'companies', id), cleanData(newCompany));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `companies/${id}`);
  }
};

export const updateCompany = async (company: Company) => {
  try {
    await setDoc(doc(db, 'companies', company.id), cleanData(company));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `companies/${company.id}`);
  }
};

export const reorderCompanies = async (companies: Company[]) => {
  try {
    const promises = companies.map((company, index) => {
      const updated = { ...company, order: index };
      return setDoc(doc(db, 'companies', company.id), cleanData(updated));
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'companies/reorder');
  }
};

export const deleteCompany = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'companies', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `companies/${id}`);
  }
};

// --- Suppliers ---
export const addSupplier = async (supplierData: Omit<Supplier, 'id'>, currentSuppliersCount: number = 0) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newSupplier: Supplier = {
    id,
    ...supplierData,
    order: currentSuppliersCount
  };
  try {
    await setDoc(doc(db, 'suppliers', id), cleanData(newSupplier));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `suppliers/${id}`);
  }
};

export const updateSupplier = async (supplier: Supplier) => {
  try {
    await setDoc(doc(db, 'suppliers', supplier.id), cleanData(supplier));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`);
  }
};

export const reorderSuppliers = async (suppliers: Supplier[]) => {
  try {
    const promises = suppliers.map((supplier, index) => {
      const updated = { ...supplier, order: index };
      return setDoc(doc(db, 'suppliers', supplier.id), cleanData(updated));
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'suppliers/reorder');
  }
};

export const deleteSupplier = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'suppliers', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `suppliers/${id}`);
  }
};

// --- Projects ---
export const addProject = async (projectData: Omit<Project, 'id'>, currentProjectsCount: number = 0) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newProject: Project = {
    id,
    ...projectData,
    order: currentProjectsCount
  };
  try {
    await setDoc(doc(db, 'projects', id), cleanData(newProject));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projects/${id}`);
  }
};

export const updateProject = async (project: Project) => {
  try {
    await setDoc(doc(db, 'projects', project.id), cleanData(project));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${project.id}`);
  }
};

export const reorderProjects = async (projects: Project[]) => {
  try {
    const promises = projects.map((project, index) => {
      const updated = { ...project, order: index };
      return setDoc(doc(db, 'projects', project.id), cleanData(updated));
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects/reorder');
  }
};

export const deleteProject = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'projects', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
  }
};

// --- Vendors ---
export const addVendor = async (vendorData: Omit<Vendor, 'id'>, currentVendorsCount: number = 0) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newVendor: Vendor = {
    id,
    ...vendorData,
    order: currentVendorsCount
  };
  try {
    await setDoc(doc(db, 'vendors', id), cleanData(newVendor));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `vendors/${id}`);
  }
};

export const updateVendor = async (vendor: Vendor) => {
  try {
    await setDoc(doc(db, 'vendors', vendor.id), cleanData(vendor));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vendors/${vendor.id}`);
  }
};

export const deleteVendor = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'vendors', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vendors/${id}`);
  }
};

// --- Accounts Payable ---
export const saveAccountsPayable = async (data: AccountsPayable) => {
  try {
    await setDoc(doc(db, 'accounts_payable', data.id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `accounts_payable/${data.id}`);
  }
};

export const deleteAccountsPayable = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'accounts_payable', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `accounts_payable/${id}`);
  }
};

// --- Accounts Receivable ---
export const saveAccountsReceivable = async (data: AccountsReceivable) => {
  try {
    await setDoc(doc(db, 'accounts_receivable', data.id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `accounts_receivable/${data.id}`);
  }
};

export const deleteAccountsReceivable = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'accounts_receivable', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `accounts_receivable/${id}`);
  }
};

// --- Petty Cash ---
export const savePettyCash = async (data: PettyCash) => {
  try {
    await setDoc(doc(db, 'petty_cash', data.id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `petty_cash/${data.id}`);
  }
};

export const deletePettyCash = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'petty_cash', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `petty_cash/${id}`);
  }
};

// --- Projected Expenses ---
export const saveProjectedExpense = async (data: ProjectedExpense) => {
  try {
    await setDoc(doc(db, 'projected_expenses', data.id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projected_expenses/${data.id}`);
  }
};

export const deleteProjectedExpense = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'projected_expenses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projected_expenses/${id}`);
  }
};

// --- Everyday Expenses ---
export const saveEverydayExpense = async (data: EverydayExpense) => {
  try {
    await setDoc(doc(db, 'everyday_expenses', data.id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `everyday_expenses/${data.id}`);
  }
};

export const deleteEverydayExpense = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'everyday_expenses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `everyday_expenses/${id}`);
  }
};

// --- System Users ---
export const saveSystemUser = async (user: SystemUser) => {
  try {
    await setDoc(doc(db, 'users', user.uid), cleanData(user));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

export const deleteSystemUser = async (uid: string) => {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
};

// --- About Data ---
export const saveAboutData = async (data: AboutData) => {
  try {
    await setDoc(doc(db, 'settings', 'about'), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/about');
  }
};

// --- Audit Logs ---
export const logAudit = async (user: SystemUser, action: string, details: string, type: 'create' | 'update' | 'delete' | 'system') => {
  const log: Omit<AuditLog, 'id'> = {
    timestamp: new Date().toISOString(),
    userId: user.uid,
    userName: user.name,
    userRole: user.role,
    action,
    details,
    type,
    isCreator: user.role === UserRole.CREATOR || user.email === 'abdulkaderp3010@gmail.com'
  };
  try {
    await addDoc(collection(db, 'audit_logs'), cleanData(log));
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
};

export const updateAuditLog = async (log: AuditLog) => {
  try {
    const { id, ...data } = log;
    await updateDoc(doc(db, 'audit_logs', id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `audit_logs/${log.id}`);
  }
};

export const deleteAuditLog = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'audit_logs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `audit_logs/${id}`);
  }
};

export const clearAuditLogs = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'audit_logs'));
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'audit_logs');
  }
};
