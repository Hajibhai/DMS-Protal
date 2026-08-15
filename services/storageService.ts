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
  orderBy,
  startAfter,
  limit,
  QueryDocumentSnapshot,
  DocumentData,
  getDocFromServer,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { compressAllImagesInDoc } from '../utils';
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
  UserRole,
  EngineerDocument,
  CampExpense,
  Voucher,
  Vehicle,
  RecycleBinItem
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
  if (operationType === OperationType.LIST || operationType === OperationType.GET) {
    // Logging is sufficient for fetch and sync errors. Do not crash running UI or throw unhandled async exceptions.
    return;
  }
  throw new Error(JSON.stringify(errInfo));
};

// Test connection on boot
export const testConnection = async () => {
  // Firestore auto-connects when active listeners or queries are mounted.
  // Avoid aggressive cold-start getDocFromServer to prevent WebChannel target acknowledgement race conditions.
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

// Helper to prepare document for Firestore, compressing images and verifying 1MB limit constraint
export const prepareDocForFirestore = async (data: any): Promise<any> => {
  let cleaned = cleanData(data);
  try {
    cleaned = await compressAllImagesInDoc(cleaned);
  } catch (err) {
    console.warn('Image auto-compression warning:', err);
  }

  // Safety check against Firestore 1MB (1,048,576 bytes) document limit
  const jsonStr = JSON.stringify(cleaned);
  if (jsonStr.length > 950000) {
    console.warn(`Doc size (${jsonStr.length} bytes) exceeds 950KB safe limit. Trimming attachments if necessary.`);
    if (Array.isArray(cleaned.attachments) && cleaned.attachments.length > 1) {
      while (cleaned.attachments.length > 1 && JSON.stringify(cleaned).length > 950000) {
        cleaned.attachments.pop();
      }
      cleaned.attachment = cleaned.attachments[0] || '';
    }
  }
  return cleaned;
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
  hoursWorked?: number,
  checkInTime?: string,
  checkOutTime?: string
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
        checkInTime: checkInTime || (status === AttendanceStatus.PRESENT ? new Date().toISOString() : undefined),
        checkOutTime: checkOutTime,
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
      if (checkInTime !== undefined) updates.checkInTime = checkInTime;
      if (checkOutTime !== undefined) updates.checkOutTime = checkOutTime;
      if (status === AttendanceStatus.PRESENT && checkInTime === undefined && !snap.data().checkInTime) {
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

export const deleteLeaveRequest = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'leaves', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leaves/${id}`);
  }
};

export const updateLeaveRequest = async (request: LeaveRequest) => {
  try {
    await updateDoc(doc(db, 'leaves', request.id), cleanData(request));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leaves/${request.id}`);
  }
};

// --- Deductions ---
export const saveDeduction = async (deduction: any) => {
  const id = deduction.id || Math.random().toString(36).substr(2, 9);
  const newRecord = { ...deduction, id };
  try {
    await setDoc(doc(db, 'deductions', id), cleanData(newRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `deductions/${id}`);
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
export const addCompany = async (companyData: Partial<Company> & Omit<Company, 'id'>, currentCompaniesCount: number = 0) => {
  const parsedData = companyData as any;
  const id = parsedData.id || Math.random().toString(36).substr(2, 9);
  const newCompany: Company = {
    ...companyData,
    id,
    order: parsedData.order !== undefined ? parsedData.order : currentCompaniesCount
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
export const addSupplier = async (supplierData: Partial<Supplier> & Omit<Supplier, 'id'>, currentSuppliersCount: number = 0) => {
  const parsedData = supplierData as any;
  const id = parsedData.id || Math.random().toString(36).substr(2, 9);
  const newSupplier: Supplier = {
    ...supplierData,
    id,
    order: parsedData.order !== undefined ? parsedData.order : currentSuppliersCount
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
export const addProject = async (projectData: Partial<Project> & Omit<Project, 'id'>, currentProjectsCount: number = 0) => {
  const parsedData = projectData as any;
  const id = parsedData.id || Math.random().toString(36).substr(2, 9);
  const newProject: Project = {
    ...projectData,
    id,
    order: parsedData.order !== undefined ? parsedData.order : currentProjectsCount
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
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'accounts_payable', data.id), docData);
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
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'accounts_receivable', data.id), docData);
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
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'petty_cash', data.id), docData);
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
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'projected_expenses', data.id), docData);
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
export const uploadBase64ToStorage = async (base64Data: string, storagePath: string): Promise<string> => {
  if (!base64Data || !base64Data.startsWith('data:')) {
    return base64Data;
  }
  try {
    const uploadPromise = (async () => {
      const storageRef = ref(storage, storagePath);
      await uploadString(storageRef, base64Data, 'data_url');
      return await getDownloadURL(storageRef);
    })();
    const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Storage upload timeout')), 4000));
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.warn(`Firebase Storage upload skipped/fallback for ${storagePath}:`, err);
    return base64Data;
  }
};

export const uploadReceiptsForDoc = async (docData: any, collectionName: string = 'everyday_expenses'): Promise<any> => {
  if (!docData) return docData;
  const clone = { ...docData };

  if (clone.attachment && typeof clone.attachment === 'string' && clone.attachment.startsWith('data:')) {
    const path = `${collectionName}/${clone.id || Date.now()}_receipt_${Date.now()}`;
    const url = await uploadBase64ToStorage(clone.attachment, path);
    if (url && url !== clone.attachment) {
      clone.attachment = url;
      clone.receiptUrl = url;
    }
  }

  if (Array.isArray(clone.attachments) && clone.attachments.length > 0) {
    const updatedAttachments: string[] = [];
    for (let i = 0; i < clone.attachments.length; i++) {
      const att = clone.attachments[i];
      if (typeof att === 'string' && att.startsWith('data:')) {
        const path = `${collectionName}/${clone.id || Date.now()}_att_${i}_${Date.now()}`;
        const url = await uploadBase64ToStorage(att, path);
        updatedAttachments.push(url);
      } else {
        updatedAttachments.push(att);
      }
    }
    clone.attachments = updatedAttachments;
    if (updatedAttachments[0]) {
      clone.attachment = updatedAttachments[0];
      clone.receiptUrl = updatedAttachments[0];
    }
  }

  return clone;
};

export const fetchAllEverydayExpensesInBatches = async (): Promise<EverydayExpense[]> => {
  try {
    const expensesRef = collection(db, 'everyday_expenses');
    let allDocs: EverydayExpense[] = [];
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 100) {
      pageCount++;
      const q = lastDoc
        ? query(expensesRef, orderBy('__name__'), startAfter(lastDoc), limit(15))
        : query(expensesRef, orderBy('__name__'), limit(15));

      const snap = await getDocs(q);
      if (snap.empty) {
        hasMore = false;
        break;
      }

      const chunk = snap.docs.map(d => ({ ...d.data(), id: d.id }) as EverydayExpense);
      allDocs = [...allDocs, ...chunk];

      if (snap.docs.length < 15) {
        hasMore = false;
      } else {
        lastDoc = snap.docs[snap.docs.length - 1];
      }
    }

    allDocs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return allDocs;
  } catch (err) {
    console.error('Error fetching everyday expenses in batches:', err);
    return [];
  }
};

export const migrateBase64ReceiptsToStorage = async (): Promise<{ migrated: number; errors: number }> => {
  console.log('Starting migration of Base64 receipts to Firebase Storage in paginated chunks...');
  let migrated = 0;
  let errors = 0;

  try {
    const expensesRef = collection(db, 'everyday_expenses');
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 100) {
      pageCount++;
      const q = lastDoc
        ? query(expensesRef, orderBy('__name__'), startAfter(lastDoc), limit(10))
        : query(expensesRef, orderBy('__name__'), limit(10));

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      for (const documentDoc of snapshot.docs) {
        const data = documentDoc.data();
        const hasBase64Attachment = typeof data.attachment === 'string' && data.attachment.startsWith('data:');
        const hasBase64AttachmentsArray = Array.isArray(data.attachments) && data.attachments.some((att: any) => typeof att === 'string' && att.startsWith('data:'));

        if (hasBase64Attachment || hasBase64AttachmentsArray) {
          try {
            const updatedDoc = await uploadReceiptsForDoc({ ...data, id: documentDoc.id }, 'everyday_expenses');
            const cleaned = await prepareDocForFirestore(updatedDoc);
            await updateDoc(doc(db, 'everyday_expenses', documentDoc.id), cleaned);
            migrated++;
            console.log(`Migrated receipts for Everyday Expense ID: ${documentDoc.id}`);
          } catch (e) {
            console.error(`Error migrating expense document ${documentDoc.id}:`, e);
            errors++;
          }
        }
      }

      if (snapshot.docs.length < 10) {
        hasMore = false;
      } else {
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
    }
    console.log(`Receipt migration complete. Migrated: ${migrated}, Errors: ${errors}`);
  } catch (err) {
    console.error('Error during migrateBase64ReceiptsToStorage:', err);
  }

  return { migrated, errors };
};

export const saveEverydayExpense = async (data: EverydayExpense) => {
  try {
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'everyday_expenses', data.id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `everyday_expenses/${data.id}`);
  }
};

export const deleteEverydayExpense = async (id: string, attachmentUrl?: string) => {
  try {
    if (attachmentUrl && typeof attachmentUrl === 'string' && attachmentUrl.startsWith('http') && attachmentUrl.includes('firebasestorage')) {
      try {
        const fileRef = ref(storage, attachmentUrl);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn('Storage file deletion skipped or failed:', e);
      }
    }
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

// --- Holidays ---
export const saveHoliday = async (holiday: PublicHoliday, employees: Employee[]) => {
  try {
    const cleaned = cleanData(holiday);
    await setDoc(doc(db, 'holidays', holiday.id), cleaned);
    
    // For each active employee, log attendance as PUBLIC_HOLIDAY on that date
    const activeEmployees = employees.filter(e => e.status === 'Active' && e.active !== false);
    for (const e of activeEmployees) {
      await logAttendance(
        e.id,
        AttendanceStatus.PUBLIC_HOLIDAY,
        holiday.date,
        0,
        undefined,
        'Holiday Sync',
        `Holiday: ${holiday.name}`
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `holidays/${holiday.id}`);
  }
};

export const deleteHoliday = async (id: string, date: string, employees: Employee[]) => {
  try {
    await deleteDoc(doc(db, 'holidays', id));
    
    // For each active employee, delete or revert the holiday attendance record
    const activeEmployees = employees.filter(e => e.status === 'Active' && e.active !== false);
    for (const e of activeEmployees) {
      const recordId = `${e.id}_${date}`;
      const recordRef = doc(db, 'attendance', recordId);
      const snap = await getDoc(recordRef);
      if (snap.exists() && snap.data().status === AttendanceStatus.PUBLIC_HOLIDAY) {
        await deleteDoc(recordRef);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `holidays/${id}`);
  }
};

// --- Engineer Documents ---
export const saveEngineerDocument = async (data: EngineerDocument) => {
  try {
    await setDoc(doc(db, 'engineer_documents', data.id), cleanData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `engineer_documents/${data.id}`);
  }
};

export const deleteEngineerDocument = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'engineer_documents', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `engineer_documents/${id}`);
  }
};

// --- Camp Accommodation Expenses ---
export const saveCamp = async (data: CampExpense) => {
  try {
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'camps', data.id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `camps/${data.id}`);
  }
};

export const deleteCamp = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'camps', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `camps/${id}`);
  }
};

// --- Vouchers (Payment & Receipt Vouchers) ---
export const saveVoucher = async (data: Voucher) => {
  try {
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'vouchers', data.id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vouchers/${data.id}`);
  }
};

export const deleteVoucher = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'vouchers', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vouchers/${id}`);
  }
};

// --- Vehicles ---
export const saveVehicle = async (data: Vehicle) => {
  try {
    const docData = await prepareDocForFirestore(data);
    await setDoc(doc(db, 'vehicles', data.id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vehicles/${data.id}`);
  }
};

export const deleteVehicle = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'vehicles', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
  }
};

// --- Recycle Bin Services ---
export const moveToRecycleBin = async (
  section: 'Expenses' | 'Petty Cash' | 'Accounts Payable' | 'Accounts Receivable' | 'General',
  originalCollection: string,
  docId: string,
  itemData: any,
  deletedBy?: string
) => {
  const recycleId = `recycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const recycleDoc: RecycleBinItem = {
    id: recycleId,
    originalCollection,
    section,
    docId,
    data: itemData,
    deletedAt: new Date().toISOString(),
    deletedBy: deletedBy || auth.currentUser?.email || 'System User',
    description: itemData.itemName || itemData.description || itemData.title || itemData.invoiceNo || 'Transaction Record',
    amount: itemData.totalAmount ?? itemData.amount ?? itemData.credit ?? itemData.debit ?? 0,
    personName: itemData.uploadedBy || itemData.employeeName || itemData.contact || itemData.requestedBy || itemData.category || 'N/A',
    reference: itemData.invoiceNo || itemData.voucherNo || itemData.ref || itemData.reference || 'N/A'
  };

  try {
    const prepared = await prepareDocForFirestore(recycleDoc);
    await setDoc(doc(db, 'recycle_bin', recycleId), prepared);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recycle_bin/${recycleId}`);
  }

  try {
    await deleteDoc(doc(db, originalCollection, docId));
    return recycleId;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${originalCollection}/${docId}`);
  }
};

export const restoreFromRecycleBin = async (item: RecycleBinItem) => {
  try {
    const preparedData = await prepareDocForFirestore(item.data);
    await setDoc(doc(db, item.originalCollection, item.docId), preparedData);
    await deleteDoc(doc(db, 'recycle_bin', item.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recycle_bin/restore/${item.id}`);
  }
};

export const permanentlyDeleteFromRecycleBin = async (recycleBinItemId: string) => {
  try {
    await deleteDoc(doc(db, 'recycle_bin', recycleBinItemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `recycle_bin/${recycleBinItemId}`);
  }
};

export const emptyRecycleBin = async () => {
  try {
    const snap = await getDocs(collection(db, 'recycle_bin'));
    const batch = writeBatch(db);
    snap.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'recycle_bin/empty');
  }
};


