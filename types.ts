
export enum StaffType {
  PART_TIME = 'Part-time',
  OFFICE = 'Office Staff',
  BRANCH = 'Branch Staff',
  WORKER = 'Worker',
  DRIVER = 'Driver',
}

export enum ShiftType {
  FIXED_9_5 = 'Fixed (9:00 - 17:00)',
  MORNING_A = 'Morning A (6:00 - 14:00)',
  EVENING_B = 'Evening B (14:00 - 22:00)',
  NIGHT_C = 'Night C (22:00 - 6:00)',
}

export interface SalaryStructure {
  basic: number;
  housing: number;
  transport: number;
  other: number;
  airTicket: number;
  leaveSalary: number;
  hourlyRate?: number;
}

export interface OffboardingDetails {
  type: 'Resignation' | 'Termination' | 'End of Contract' | 'Absconding';
  exitDate: string;
  reason: string;
  gratuity: number;
  leaveEncashment: number;
  salaryDues: number;
  otherDues: number;
  deductions: number;
  netSettlement: number;
  assetsReturned: boolean;
  notes: string;
  documents?: { name: string; data: string }[]; // Array of Base64 files
  settlementLink?: string; // Google Drive link for signed document
}

export interface EmployeeDocuments {
    emiratesId?: string;
    emiratesIdIssue?: string;
    emiratesIdExpiry?: string;
    passportNumber?: string;
    passportIssue?: string;
    passportExpiry?: string;
    visaExpiry?: string;
    labourCardNumber?: string;
    labourCardIssue?: string;
    labourCardExpiry?: string;
    temporaryCompanyName?: string;
    temporaryLabourCardNumber?: string;
    temporaryLabourCardIssue?: string;
    temporaryLabourCardExpiry?: string;
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    iconLink?: string;
    expiryDate?: string; // YYYY-MM-DD
}

export interface Employee {
  id: string;
  code: string; // e.g., 10001
  name: string;
  nickName?: string;
  employeeNickName?: string;
  nationality?: string;
  designation: string; // e.g., Helper, Driver
  department: string; // e.g., Cleaning, Maintenance
  joiningDate: string;
  type: StaffType | string; // Staff / Worker
  company: string; // Specific entity name
  status: 'Active' | 'Inactive';
  team: 'Internal Team' | 'External Team' | 'Office Staff';
  workLocation: string;
  leaveBalance: number;
  bankName?: string;
  iban?: string;
  mobileNumber?: string;
  salary: SalaryStructure;
  active: boolean;
  offboardingDetails?: OffboardingDetails;
  rejoiningDate?: string;
  rejoiningReason?: string;
  profileImage?: string;
  projectName?: string;
  email?: string;
  
  // New Document Fields
  documents?: EmployeeDocuments;
  vacationScheduledDate?: string;
  driveFiles?: DriveFile[];
  driveFolderId?: string;
}

export enum AttendanceStatus {
  PRESENT = 'P',
  ABSENT = 'A',
  WEEK_OFF = 'W',
  PUBLIC_HOLIDAY = 'PH',
  SICK_LEAVE = 'SL',
  ANNUAL_LEAVE = 'AL',
  UNPAID_LEAVE = 'UL',
  EMERGENCY_LEAVE = 'EL',
}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: AttendanceStatus; // Restricted to SL, AL, UL usually
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  createdBy?: string; // Username of creator
  approvedBy?: string; // Username of approver
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  hoursWorked: number; // Default 8 for P, 0 for others usually
  overtimeHours: number;
  checkInTime?: string;
  checkOutTime?: string;
  otAttachment?: string; // Base64 string or file path
  updatedBy?: string; // Username of who made the change
  note?: string; // Optional note for the status change
}

export interface DeductionRecord {
    id: string;
    employeeId: string;
    date: string;
    type: 'Salary Advance' | 'Loan Amount' | 'Damage Material/Asset' | 'Fine Amount' | 'Penalty' | 'Other';
    amount: number;
    note?: string;
    attachment?: string;
    attachmentName?: string;
    googleDriveLink?: string;
}

export interface Company {
    id: string;
    code: string;
    name: string;
    address: string;
    email: string;
    phone?: string;
    logo?: string; // Base64
    driveFiles?: DriveFile[];
    driveFolderId?: string;
    order?: number;
    trn?: string;
    establishmentId?: string; // 13-digit UAE MOHRE Establishment ID
    bankRoutingCode?: string; // 9-digit UAE Central Bank Routing Code
}

export interface Supplier {
    id: string;
    code: string;
    name: string;
    contactPerson: string;
    address: string;
    email: string;
    phone?: string;
    category?: string;
    notes?: string;
    logo?: string; // Base64
    driveFiles?: DriveFile[];
    driveFolderId?: string;
    order?: number;
    trn?: string;
}

export interface Project {
    id: string;
    code: string;
    name: string;
    clientName: string;
    location: string;
    startDate: string;
    endDate?: string;
    status: 'Active' | 'Completed' | 'On Hold';
    description?: string;
    estimationValue?: number;
    income?: number;
    overallExpenses?: number;
    assignedStaffCount?: number;
    driveFiles?: DriveFile[];
    driveFolderId?: string;
    order?: number;
    trn?: string;
}

export interface Vendor {
    id: string;
    code: string;
    name: string;
    contactPerson: string;
    address: string;
    email: string;
    phone?: string;
    category?: string;
    notes?: string;
    logo?: string; // Base64
    driveFiles?: DriveFile[];
    driveFolderId?: string;
    order?: number;
    trn?: string;
}

export interface AccountsPayable {
    id: string;
    companyId?: string; // Buying Corporate Identity
    date: string;
    vendorId: string; // Linked to Supplier or Vendor
    vendorType: 'Supplier' | 'Vendor';
    projectId?: string; // Optional link to project
    invoiceNumber: string;
    amount: number; // Taxable Amount
    vatAmount: number; // 5% VAT
    totalAmount: number; // Amount + VAT
    description: string;
    status: 'Pending' | 'Paid' | 'Partially Paid';
    dueDate?: string;
    paymentDate?: string;
    attachment?: string;
    hours?: number;
    actualAmount?: number;
    advance?: number;
    deduction?: number;
    paid?: number;
    payableAmount?: number;
    supplierName?: string;
    supplierCode?: string;
    excelBatchId?: string;
    excelFileName?: string;
}

export interface AccountsReceivable {
    id: string;
    date: string;
    entityId: string; // Linked to Project, Supplier, or Vendor
    entityType: 'Project' | 'Supplier' | 'Vendor';
    invoiceNumber: string;
    amount: number; // Taxable Amount
    vatAmount: number; // 5% VAT
    totalAmount: number; // Amount + VAT
    description: string;
    status: 'Pending' | 'Received' | 'Partially Received';
    dueDate?: string;
    receivedDate?: string;
    attachment?: string;
    companyId?: string;
    companyName?: string;
    companyTrn?: string;
    clientTrn?: string;
    items?: { id: string; name: string; description: string; quantity: number; rate: number; total: number }[];
}

export interface PettyCash {
    id: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    type: 'Income' | 'Expense';
    requestedBy: string;
    approvedBy?: string;
    projectId?: string; // Optional link to project
    attachment?: string;
    mode?: string; // e.g. 'Cash', 'Online', 'Bank Transfer', 'Cheque', 'Card'
    contact?: string; // contact name (customer/vendor/contact)
    uploadedBy?: string;
    updatedBy?: string;
    employeeId?: string;
    signedAttachment?: string;
    signedAttachmentName?: string;
}

export interface ProjectedExpense {
    id: string;
    siNo: string;
    date: string;
    invoiceNumber: string;
    billDescription: string;
    clientName: string;
    siteLocation: string;
    workDescription: string;
    actualAmount: number;
    vatAmount: number; // 5%
    totalAmount: number;
    projectId?: string; // Optional link to project
    uploadedBy?: string;
    uploadedByUid?: string;
    updatedBy?: string;
    updatedByUid?: string;
}

export interface EverydayExpense {
    id: string;
    siNo: string;
    date: string;
    invoiceNo: string;
    trnNo: string;
    clientName: string;
    supplierName: string;
    shopName: string;
    billAmount: number;
    vatAmount: number;
    totalAmount: number;
    description: string;
    category?: string;
    projectId?: string; // Optional link to project
    uploadedBy?: string;
    updatedBy?: string;
    uploadedByUid?: string;
    updatedByUid?: string;
    uploadedDate?: string;
    attachment?: string;
    employeeId?: string; // Associated employee for petty cash tallying
    isVehicleFuel?: boolean;
    vehicleNumber?: string;
    kmStart?: number;
    kmEnd?: number;
    kmRun?: number;
    startTime?: string;
    endDate?: string;
    endTime?: string;
}

export interface DashboardStats {
  totalStaff: number;
  present: number;
  leave: number;
  absent: number;
}

export interface PublicHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type?: string; // 'Public Holiday' | 'Site Holiday' | custom text
}

export interface AboutData {
    name: string;
    title: string;
    bio: string;
    profileImage: string; // Base64
    email: string;
    contactInfo: string;
}

// --- User / Auth Types ---

export enum UserRole {
    CREATOR = 'Creator', // Special Super Admin
    ADMIN = 'Admin',
    HR = 'HR',
    SUPERVISOR = 'Supervisor',
    ENGINEER = 'Engineer',
    ACCOUNTANT = 'Accountant',
    EMPLOYEE = 'Employee'
}

export interface UserPermissions {
    canViewDashboard: boolean;
    canViewCompanyDashboard: boolean;
    canManageEmployees: boolean; // Add, Edit, Onboard, Offboard
    canViewDirectory: boolean;
    canManageAttendance: boolean; // Edit Timesheet
    canViewTimesheet: boolean;
    canManageLeaves: boolean; // Approve/Reject
    canViewPayroll: boolean;
    canManagePayroll: boolean; // Print, view salary details
    canViewReports: boolean;
    canManageUsers: boolean; // Create other users
    canManageSettings: boolean; // Companies, Holidays
    canManageSuppliers: boolean;
    canManageProjects: boolean;
    canManageFinance: boolean;
}

export interface SystemUser {
    uid: string;
    email: string;
    username?: string;
    password?: string;
    name: string;
    role: UserRole;
    active: boolean;
    permissions: UserPermissions;
    theme?: 'light' | 'dark';
    photoURL?: string; // Base64 or URL
}

export interface CICPARecord {
    id: string;
    employeeId?: string;
    emailId: string;
    emiratesId: string;
    mobileNumber: string;
    permissionNumber: string;
    dob: string;
    uidNumber: string;
    nameEnglish: string;
    nameArabic: string;
    nationality: string;
    religion: string;
    passportNo: string;
    passportExpireDate: string;
    visaResidenceNumber: string;
    visaExpireDate: string;
    designationCode?: string;
    designationOccupation?: string;
    tempLabourCardNumber?: string;
    tempLcApprovedDate?: string;
    tempLcExpireDate?: string;
    proNumber?: string;
    cicpaApplicationDate?: string;
    cicpaApprovedDate?: string;
    cicpaExpireDate?: string;
    siteLocation?: string;
    projectName?: string;
    applicationStatus: string;
    remarks?: string;
    profilePicture?: string;
    cicpaCardFront?: string;
    cicpaCardBack?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  type: 'create' | 'update' | 'delete' | 'system';
  isCreator: boolean;
}

export interface SafetyRecord {
    id: string;
    employeeImage?: string; // base64 representation or URL
    safetyCardFront?: string; // base64 or URL
    employeeName: string;
    emiratesIdNumber: string;
    safetyProviderName: string;
    safetyProviderContact: string; // contact number / email id
    certificateName: string;
    safetyCertificateNumber: string;
    certificateIssueDate: string;
    certificateExpireDate: string;
    employeeCompanyName: string;
    createdAt: string;
    updatedAt: string;
}

export interface JobApplicant {
  id: string;
  name: string;
  email: string;
  mobileNumber: string;
  position: string;
  passportNumber: string;
  emiratesIdNumber?: string;
  status: 'Applied' | 'Interview Scheduled' | 'Interview Conducted' | 'Offered' | 'Hired' | 'Rejected';
  appliedDate: string;
  interviewDate?: string;
  notes?: string;
  salaryExpectation?: number;
  interviewType?: 'F2F' | 'Online';
  interviewMeetLink?: string;
}

export interface JobOffer {
  id: string;
  applicantId?: string; // Opt linked applicant
  employeeName: string;
  position: string;
  salary: number; // monthly basic salary
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  passportNumber: string;
  mobileNumber: string;
  email?: string;
  emiratesIdNumber?: string;
  joiningDate: string;
  offerDate: string;
  expiryDate?: string;
  status: 'Offered' | 'Accepted' | 'Declined';
  additionalDetails?: string;
  company?: string;
  signedOfferUrl?: string;
  signedOfferName?: string;
  signedOfferChunksCount?: number;
  signedAcceptanceUrl?: string;
  signedAcceptanceName?: string;
  signedAcceptanceChunksCount?: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface DocumentPayment {
  id: string;
  date: string;
  amount: number;
  mode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Deposit' | 'Other';
  reference?: string;
  notes?: string;
}

export interface EngineerDocument {
  id: string;
  type: 'Quotation' | 'LPO';
  docNumber: string;
  date: string;
  companyId?: string; // Link to a Company if type is Quotation
  companyName: string; // Client/Supplier name
  supplierId?: string; // Link to a Supplier if type is LPO
  subject: string;
  items: DocumentItem[];
  subTotal: number;
  vatAmount: number;
  totalAmount: number;
  preparedBy: string; // Engineer user name
  preparedById?: string; // Engineer uid
  status: 'Pending' | 'Approved' | 'Rejected' | 'Issued' | 'Cancelled';
  payments: DocumentPayment[];
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  terms?: string;
  attention?: string;
  designation?: string;
  email?: string;
  contact?: string;
  contactT?: string;
  address?: string;
  yourRef?: string;
  ourRef?: string;
  mobilizationValue?: number;
  constructionValue?: number;
  scopeOfWork?: string;
  offerValidity?: string;
  timeSchedule?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  assignedTo?: string; // system user uid
  assignedToName?: string; // system user name
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy: string;
  createdByRole?: string;
  startedAt?: string;
  completedAt?: string;
  progressLog?: Array<{
    status: string;
    timestamp: string;
    changedBy: string;
    changedById: string;
  }>;
  remarks?: Array<{
    id: string;
    text: string;
    createdAt: string;
    createdBy: string;
    createdById: string;
  }>;
  checklist?: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  audioUrl?: string;
  audioName?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaName?: string;
  assignedToMultiple?: Array<{ uid: string; name: string }>;
  documents?: Array<{ url: string; name: string; type: string; size?: string }>;
  meetLink?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color?: 'yellow' | 'blue' | 'green' | 'rose' | 'slate';
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy: string;
  createdByRole?: string;
  audioUrl?: string;
  audioName?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaName?: string;
  documents?: Array<{ url: string; name: string; type: string; size?: string }>;
  meetLink?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  dateTime: string; // ISO string format preferred
  duration: number; // in minutes, default 30
  meetLink?: string;
  createdAt: string;
  updatedAt?: string;
  createdById: string;
  createdBy: string;
  createdByRole?: string;
  assignedToMultiple?: Array<{ uid: string; name: string }>;
  assignedTo?: string; // fallback or single person id
  assignedToName?: string; // fallback or single person name
}

export interface CorporateBankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  currency: string;
  isDefault: boolean;
}

export interface CampExpense {
  id: string;
  campName: string;
  depositAmount: number;
  rent: number;
  rentMonth: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface Voucher {
    id: string;
    voucherType: 'payment' | 'receipt';
    voucherNo: string;
    date: string; // YYYY-MM-DD
    payeeOrReceiver: string; // Paid To / Received From
    amount: number;
    vatRate?: number; // e.g. 5
    vatAmount?: number;
    totalAmount: number;
    paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Credit Card' | 'Other';
    chequeOrRefNo?: string;
    description: string;
    preparedBy: string;
    preparedByUid: string;
    approvedBy?: string;
    approvedByUid?: string;
    receivedBy?: string;
    projectId?: string; // associated project
    companyId?: string; // buyer/seller company ID matching corporate accounts
    attachment?: string; // Base64 document attachment
    uploadedDate?: string;
}



