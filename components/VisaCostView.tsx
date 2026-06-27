import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit2, Trash2, Printer, Download, Copy, Check, X, 
  CreditCard, Coins, User, ArrowUpRight, FileSpreadsheet, Building, 
  HelpCircle, Sparkles, Filter, CheckCircle, Clock, Receipt, FileText
} from 'lucide-react';
import { collection, onSnapshot, query, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Employee } from '../types';
import * as XLSX from 'xlsx';

interface VisaCostRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  nationality: string;
  company: string;
  designation: string;
  
  // Fees fields
  initialAppFee: number;
  approvalFee: number;
  dicFee: number;
  iloeFee: number;
  lcFee: number;
  entryPermitFee: number;
  changeStatusFee: number;
  medicalFee: number;
  insuranceFee: number;
  biometricFee: number;
  visaEidFee: number;
  
  totalCost: number;
  status: 'Pending' | 'Paid' | 'Processing' | 'Completed';
  notes: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

interface VisaCostViewProps {
  user: any;
  employees: Employee[];
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export const VisaCostView: React.FC<VisaCostViewProps> = ({ user, employees, openConfirm }) => {
  const [records, setRecords] = useState<VisaCostRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VisaCostRecord | null>(null);

  // Employee Search & Autocomplete
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeName: '',
    employeeCode: '',
    nationality: '',
    company: '',
    designation: '',
    
    initialAppFee: '',
    approvalFee: '',
    dicFee: '',
    iloeFee: '',
    lcFee: '',
    entryPermitFee: '',
    changeStatusFee: '',
    medicalFee: '',
    insuranceFee: '',
    biometricFee: '',
    visaEidFee: '',
    
    status: 'Pending' as 'Pending' | 'Paid' | 'Processing' | 'Completed',
    notes: ''
  });

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load records on mount
  useEffect(() => {
    const q = query(collection(db, 'visa_costs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: VisaCostRecord[] = [];
      snapshot.forEach((docSnap) => {
        loaded.push({
          id: docSnap.id,
          ...docSnap.data()
        } as VisaCostRecord);
      });
      // Sort by creation date descending
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(loaded);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading visa cost records:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter existing employees for autocomplete search
  const filteredEmployees = useMemo(() => {
    if (!empSearchQuery.trim()) return [];
    const queryLower = empSearchQuery.toLowerCase();
    return employees.filter(emp => 
      (emp.name || '').toLowerCase().includes(queryLower) ||
      (emp.code || '').toLowerCase().includes(queryLower)
    ).slice(0, 5); // Limit to top 5 results for clarity
  }, [employees, empSearchQuery]);

  // Handle selecting an employee from autocomplete
  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmpSearchQuery(`${emp.name} (${emp.code})`);
    setFormData(prev => ({
      ...prev,
      employeeName: emp.name || '',
      employeeCode: emp.code || '',
      nationality: emp.nationality || '',
      company: emp.company || '',
      designation: emp.designation || ''
    }));
    setShowEmpDropdown(false);
  };

  // Auto-calculated total visa cost in real-time
  const calculatedTotal = useMemo(() => {
    const fields = [
      formData.initialAppFee,
      formData.approvalFee,
      formData.dicFee,
      formData.iloeFee,
      formData.lcFee,
      formData.entryPermitFee,
      formData.changeStatusFee,
      formData.medicalFee,
      formData.insuranceFee,
      formData.biometricFee,
      formData.visaEidFee
    ];
    return fields.reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [formData]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const matchesSearch = 
        (rec.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalRegistered = records.length;
    const grandTotalSpend = records.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const averageCost = totalRegistered > 0 ? grandTotalSpend / totalRegistered : 0;
    const completedCount = records.filter(r => r.status === 'Completed').length;
    const pendingCount = records.filter(r => r.status === 'Pending').length;
    
    return {
      totalRegistered,
      grandTotalSpend,
      averageCost,
      completedCount,
      pendingCount
    };
  }, [records]);

  // Add / Edit submission
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeName) {
      showToast('Please select or enter an employee name', 'error');
      return;
    }

    const initialAppFee = parseFloat(formData.initialAppFee) || 0;
    const approvalFee = parseFloat(formData.approvalFee) || 0;
    const dicFee = parseFloat(formData.dicFee) || 0;
    const iloeFee = parseFloat(formData.iloeFee) || 0;
    const lcFee = parseFloat(formData.lcFee) || 0;
    const entryPermitFee = parseFloat(formData.entryPermitFee) || 0;
    const changeStatusFee = parseFloat(formData.changeStatusFee) || 0;
    const medicalFee = parseFloat(formData.medicalFee) || 0;
    const insuranceFee = parseFloat(formData.insuranceFee) || 0;
    const biometricFee = parseFloat(formData.biometricFee) || 0;
    const visaEidFee = parseFloat(formData.visaEidFee) || 0;

    const dataPayload = {
      employeeId: selectedEmployee?.id || '',
      employeeCode: formData.employeeCode.trim(),
      employeeName: formData.employeeName.trim(),
      nationality: formData.nationality.trim(),
      company: formData.company.trim(),
      designation: formData.designation.trim(),
      
      initialAppFee,
      approvalFee,
      dicFee,
      iloeFee,
      lcFee,
      entryPermitFee,
      changeStatusFee,
      medicalFee,
      insuranceFee,
      biometricFee,
      visaEidFee,
      
      totalCost: calculatedTotal,
      status: formData.status,
      notes: formData.notes.trim()
    };

    try {
      if (editingRecord) {
        // Update
        const ref = doc(db, 'visa_costs', editingRecord.id);
        await updateDoc(ref, {
          ...dataPayload,
          updatedAt: new Date().toISOString()
        });
        showToast('Visa cost record updated successfully');
      } else {
        // Create
        await addDoc(collection(db, 'visa_costs'), {
          ...dataPayload,
          createdAt: new Date().toISOString(),
          createdBy: user.email || 'Admin'
        });
        showToast('Visa cost record saved successfully');
      }

      // Close and clear
      setIsFormOpen(false);
      setEditingRecord(null);
      setSelectedEmployee(null);
      setEmpSearchQuery('');
      setFormData({
        employeeName: '',
        employeeCode: '',
        nationality: '',
        company: '',
        designation: '',
        initialAppFee: '',
        approvalFee: '',
        dicFee: '',
        iloeFee: '',
        lcFee: '',
        entryPermitFee: '',
        changeStatusFee: '',
        medicalFee: '',
        insuranceFee: '',
        biometricFee: '',
        visaEidFee: '',
        status: 'Pending',
        notes: ''
      });
    } catch (err: any) {
      console.error("Error saving visa cost record:", err);
      showToast(`Failed to save record: ${err?.message || err}`, 'error');
    }
  };

  // Initiate Editing
  const handleEdit = (rec: VisaCostRecord) => {
    setEditingRecord(rec);
    const existingEmp = employees.find(e => e.id === rec.employeeId || e.code === rec.employeeCode);
    if (existingEmp) {
      setSelectedEmployee(existingEmp);
      setEmpSearchQuery(`${existingEmp.name} (${existingEmp.code})`);
    } else {
      setSelectedEmployee(null);
      setEmpSearchQuery(rec.employeeName);
    }

    setFormData({
      employeeName: rec.employeeName || '',
      employeeCode: rec.employeeCode || '',
      nationality: rec.nationality || '',
      company: rec.company || '',
      designation: rec.designation || '',
      
      initialAppFee: rec.initialAppFee ? rec.initialAppFee.toString() : '',
      approvalFee: rec.approvalFee ? rec.approvalFee.toString() : '',
      dicFee: rec.dicFee ? rec.dicFee.toString() : '',
      iloeFee: rec.iloeFee ? rec.iloeFee.toString() : '',
      lcFee: rec.lcFee ? rec.lcFee.toString() : '',
      entryPermitFee: rec.entryPermitFee ? rec.entryPermitFee.toString() : '',
      changeStatusFee: rec.changeStatusFee ? rec.changeStatusFee.toString() : '',
      medicalFee: rec.medicalFee ? rec.medicalFee.toString() : '',
      insuranceFee: rec.insuranceFee ? rec.insuranceFee.toString() : '',
      biometricFee: rec.biometricFee ? rec.biometricFee.toString() : '',
      visaEidFee: rec.visaEidFee ? rec.visaEidFee.toString() : '',
      
      status: rec.status || 'Pending',
      notes: rec.notes || ''
    });
    setIsFormOpen(true);
  };

  const executeDelete = (id: string) => {
    const rec = records.find(r => r.id === id);
    if (!rec) return;

    openConfirm(
      'Delete Visa Cost Record',
      `Are you sure you want to permanently delete the visa cost record for "${rec.employeeName}"? This action cannot be undone.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'visa_costs', id));
          showToast('Record deleted successfully');
        } catch (err: any) {
          console.error("Error deleting record:", err);
          showToast(`Failed to delete record: ${err?.message || err}`, 'error');
        }
      }
    );
  };

  // Copy Summary to clipboard
  const handleCopySummary = async (rec: VisaCostRecord) => {
    const textToCopy = `Visa Cost Summary:
Employee: ${rec.employeeName} (${rec.employeeCode || 'N/A'})
Company: ${rec.company || 'N/A'}
Designation: ${rec.designation || 'N/A'}
Nationality: ${rec.nationality || 'N/A'}

Cost breakdown (AED):
- Initial App Fee: ${rec.initialAppFee || 0}
- Approval Fee: ${rec.approvalFee || 0}
- DIC Fee: ${rec.dicFee || 0}
- ILOE Fee: ${rec.iloeFee || 0}
- LC Fee: ${rec.lcFee || 0}
- Entry Permit Fee: ${rec.entryPermitFee || 0}
- Change Status Fee: ${rec.changeStatusFee || 0}
- Medical Fee: ${rec.medicalFee || 0}
- Insurance Fee: ${rec.insuranceFee || 0}
- Biometric Fee: ${rec.biometricFee || 0}
- Visa & EID Fee: ${rec.visaEidFee || 0}

TOTAL VISA COST: AED ${rec.totalCost.toLocaleString()}
Status: ${rec.status}
Notes: ${rec.notes || 'None'}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(rec.id);
      showToast('Visa cost details copied!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Print voucher/details
  const handlePrint = (rec?: VisaCostRecord) => {
    const printContent = rec 
      ? `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; color: #1e293b; font-size: 26px; font-weight: 800;">Pioneer DMS</h1>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Visa Cost Audit Voucher</p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 6px 12px; font-weight: bold; font-size: 12px; border-radius: 9999px; background-color: ${
                rec.status === 'Completed' ? '#ecfdf5' : rec.status === 'Paid' ? '#f0fdf4' : '#fffbeb'
              }; color: ${
                rec.status === 'Completed' ? '#047857' : rec.status === 'Paid' ? '#15803d' : '#b45309'
              }; border: 1px solid currentColor;">${rec.status}</span>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 11px;">Date: ${new Date(rec.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background-color: #f8fafc; padding: 20px; border-radius: 16px;">
            <div>
              <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase;">Employee Details</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold; color: #0f172a;">${rec.employeeName}</p>
              <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px;">Code: <strong>${rec.employeeCode || '-'}</strong></p>
              <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px;">Designation: ${rec.designation || '-'}</p>
            </div>
            <div>
              <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase;">Visa Parameters</p>
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #0f172a;">${rec.company || '-'}</p>
              <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px;">Nationality: ${rec.nationality || '-'}</p>
            </div>
          </div>

          <h3 style="margin: 0 0 15px 0; color: #334155; font-size: 14px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Visa Fee breakdown</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; color: #334155;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; font-weight: bold; color: #475569;">
                <th style="padding: 10px 0;">Fee Description</th>
                <th style="padding: 10px 0; text-align: right;">Amount (AED)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Initial Application Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.initialAppFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Approval Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.approvalFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">DIC Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.dicFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">ILOE Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.iloeFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">LC Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.lcFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Entry Permit Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.entryPermitFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Change Status Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.changeStatusFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Medical Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.medicalFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Insurance Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.insuranceFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0;">Biometric Fee - New Employee (If Applicable)</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.biometricFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="border-bottom: 2px solid #e2e8f0;">
                <td style="padding: 10px 0;">Visa & EID Fee</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${(rec.visaEidFee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr style="font-size: 16px; font-weight: 800; color: #0f172a;">
                <td style="padding: 15px 0;">TOTAL VISA COST</td>
                <td style="padding: 15px 0; text-align: right; color: #6366f1;">AED ${(rec.totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>

          ${rec.notes ? `
            <div style="margin-bottom: 30px; border-left: 4px solid #cbd5e1; padding-left: 15px;">
              <p style="margin: 0 0 4px 0; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase;">Audit Remarks</p>
              <p style="margin: 0; font-size: 12.5px; color: #475569; white-space: pre-wrap; line-height: 1.5;">${rec.notes}</p>
            </div>
          ` : ''}

          <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            Pioneer Document Management System • Generated by ${rec.createdBy || 'Admin'} on ${new Date().toLocaleString()}
          </div>
        </div>
      `
      : `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 25px; font-size: 22px; font-weight: 800;">Pioneer DMS - Visa Cost Records</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; font-weight: bold; color: #475569;">
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Employee</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Code</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Company</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Nationality</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Designation</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1; text-align: right;">Total Cost (AED)</th>
                <th style="padding: 10px; border-bottom: 1px solid #cbd5e1; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: bold; color: #0f172a;">${r.employeeName}</td>
                  <td style="padding: 10px; color: #334155; font-family: monospace;">${r.employeeCode || '-'}</td>
                  <td style="padding: 10px; color: #334155;">${r.company || '-'}</td>
                  <td style="padding: 10px; color: #475569;">${r.nationality || '-'}</td>
                  <td style="padding: 10px; color: #475569;">${r.designation || '-'}</td>
                  <td style="padding: 10px; font-weight: bold; text-align: right; color: #4f46e5;">AED ${(r.totalCost || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style="padding: 10px; text-align: center;">
                    <span style="display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: bold; border-radius: 9999px; border: 1px solid #cbd5e1;">${r.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Confidential Visa Cost Audit Report generated on ${new Date().toLocaleString()}
          </div>
        </div>
      `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Visa Cost Data</title>
            <style>
              @page { size: auto; margin: 15mm; }
              body { margin: 0; background: #fff; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Export to Excel sheet
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((rec, idx) => ({
      'Sl No': idx + 1,
      'Employee Name': rec.employeeName,
      'Employee Code': rec.employeeCode || '-',
      'Company Name': rec.company || '-',
      'Nationality': rec.nationality || '-',
      'Designation': rec.designation || '-',
      'Initial App Fee (AED)': rec.initialAppFee || 0,
      'Approval Fee (AED)': rec.approvalFee || 0,
      'DIC Fee (AED)': rec.dicFee || 0,
      'ILOE Fee (AED)': rec.iloeFee || 0,
      'LC Fee (AED)': rec.lcFee || 0,
      'Entry Permit Fee (AED)': rec.entryPermitFee || 0,
      'Change Status Fee (AED)': rec.changeStatusFee || 0,
      'Medical Fee (AED)': rec.medicalFee || 0,
      'Insurance Fee (AED)': rec.insuranceFee || 0,
      'Biometric Fee (AED)': rec.biometricFee || 0,
      'Visa & EID Fee (AED)': rec.visaEidFee || 0,
      'TOTAL VISA COST (AED)': rec.totalCost || 0,
      'Processing Status': rec.status,
      'Audit Remarks / Notes': rec.notes || '-',
      'Registered Date': rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visa Cost Directory");
    XLSX.writeFile(wb, `Pioneer_Visa_Cost_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Exported successfully to Excel!');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 right-6 z-[200] px-6 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2.5 ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <X className="w-5 h-5 text-rose-600" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Visa Cost Manager</h2>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Employee Visa Fee Tracking & Audit</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Export to Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>

          <button
            onClick={() => handlePrint()}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Print entire directory"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print Table
          </button>

          <button
            onClick={() => {
              setEditingRecord(null);
              setSelectedEmployee(null);
              setEmpSearchQuery('');
              setFormData({
                employeeName: '',
                employeeCode: '',
                nationality: '',
                company: '',
                designation: '',
                initialAppFee: '',
                approvalFee: '',
                dicFee: '',
                iloeFee: '',
                lcFee: '',
                entryPermitFee: '',
                changeStatusFee: '',
                medicalFee: '',
                insuranceFee: '',
                biometricFee: '',
                visaEidFee: '',
                status: 'Pending',
                notes: ''
              });
              setIsFormOpen(true);
            }}
            className="px-5 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-brand-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Visa Cost
          </button>
        </div>
      </div>

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/60 rounded-[1.5rem] p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Registered</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{metrics.totalRegistered}</span>
            <span className="text-xs font-bold text-slate-500">vouchers</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-[1.5rem] p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total Spend</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-brand-600">AED {metrics.grandTotalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <div className="p-1 bg-brand-50 rounded text-brand-600">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-[1.5rem] p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Average Cost</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-600">AED {metrics.averageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="text-xs font-bold text-slate-500">per visa</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-[1.5rem] p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Authorization</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{metrics.pendingCount}</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">vouchers</span>
          </div>
        </div>
      </div>

      {/* Main Filter and Directory Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
        
        {/* Search & Filter bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/40">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, ID, company, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-400">Status:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {['All', 'Pending', 'Processing', 'Paid', 'Completed'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    statusFilter === tab 
                      ? 'bg-white text-slate-950 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of records */}
        {isLoading ? (
          <div className="p-20 text-center space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto"></div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading Visa Cost Directory...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-20 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 border border-dashed border-slate-200">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-800 text-base">No visa costs registered</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              {searchTerm ? 'No results matched your search term.' : 'Click "Add Visa Cost" to input fee details for an employee.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/55 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                  <th className="px-6 py-4.5">Employee Details</th>
                  <th className="px-6 py-4.5">Company Entity</th>
                  <th className="px-6 py-4.5">Designation</th>
                  <th className="px-6 py-4.5">Nationality</th>
                  <th className="px-6 py-4.5 text-right">Total Visa Cost</th>
                  <th className="px-6 py-4.5 text-center">Status</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const isCopied = copiedId === rec.id;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/30 transition-all text-xs text-slate-700">
                      
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-black text-slate-900 text-sm">{rec.employeeName}</p>
                          <p className="font-mono font-bold text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded inline-block">ID: {rec.employeeCode || 'N/A'}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {rec.company || <span className="text-slate-300 italic">-</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-600">{rec.designation || '-'}</td>
                      
                      <td className="px-6 py-4 font-medium text-slate-500">{rec.nationality || '-'}</td>

                      <td className="px-6 py-4 text-right">
                        <p className="font-black text-brand-600 text-sm">AED {rec.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Breakdown of 11 fees</p>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider ${
                          rec.status === 'Completed' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : rec.status === 'Paid'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : rec.status === 'Processing'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {rec.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopySummary(rec)}
                            className="p-1.5 hover:bg-slate-150 text-slate-500 hover:text-indigo-600 rounded-xl transition-all cursor-pointer"
                            title="Copy text summary"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handlePrint(rec)}
                            className="p-1.5 hover:bg-slate-150 text-slate-500 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
                            title="Print audit voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleEdit(rec)}
                            className="p-1.5 hover:bg-slate-150 text-indigo-600 hover:text-indigo-850 rounded-xl transition-all cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => executeDelete(rec.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-850 rounded-xl transition-all cursor-pointer"
                            title="Delete details"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog: Add / Edit Record */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-100 my-8 flex flex-col max-h-[90vh]"
            >
              {/* Form Header */}
              <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    {editingRecord ? 'Modify Visa Cost Profile' : 'Configure New Visa Cost Record'}
                  </h3>
                  <p className="text-slate-500 text-xs font-semibold">Define structural visa processing and service fees</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body - Scrollable */}
              <form onSubmit={handleSubmitRecord} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                
                {/* Employee search and parameters section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4" /> Step 1: Search & Fetch Employee Data
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Autocomplete Search Bar */}
                    <div className="relative">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Employee DB *</label>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Type Employee Name or Code to auto-fill..."
                          value={empSearchQuery}
                          onChange={(e) => {
                            setEmpSearchQuery(e.target.value);
                            setFormData(prev => ({ ...prev, employeeName: e.target.value }));
                            setShowEmpDropdown(true);
                          }}
                          onFocus={() => setShowEmpDropdown(true)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                        />
                      </div>
                      
                      {/* Autocomplete Dropdown */}
                      {showEmpDropdown && filteredEmployees.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-56">
                          {filteredEmployees.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => handleSelectEmployee(emp)}
                              className="w-full px-4 py-2.5 hover:bg-slate-50 text-left text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 last:border-0 cursor-pointer"
                            >
                              <span>{emp.name}</span>
                              <span className="font-mono text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded">Code: {emp.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Employee Code */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Employee Code</label>
                      <input
                        type="text"
                        placeholder="e.g., 10034"
                        value={formData.employeeCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, employeeCode: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Nationality */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nationality</label>
                      <input
                        type="text"
                        placeholder="e.g., Pakistan, India, Egypt"
                        value={formData.nationality}
                        onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Company */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Company Entity</label>
                      <input
                        type="text"
                        placeholder="e.g., Pioneer Cleaning Services"
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Designation */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Designation</label>
                      <input
                        type="text"
                        placeholder="e.g., Driver, Helper"
                        value={formData.designation}
                        onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Visa Cost detailed breakdown */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-brand-600 uppercase tracking-widest flex items-center gap-2">
                      <Coins className="w-4 h-4" /> Step 2: Input Visa Cost Details
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Numeric fields only (AED)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Initial application fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Application Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.initialAppFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, initialAppFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Approval fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Approval Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.approvalFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, approvalFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* DIC fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">DIC Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.dicFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, dicFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* ILOE fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ILOE Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.iloeFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, iloeFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* LC fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">LC Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.lcFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, lcFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Entry Permit fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Entry Permit Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.entryPermitFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, entryPermitFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Change Status fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Change Status Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.changeStatusFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, changeStatusFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Medical fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Medical Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.medicalFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, medicalFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Insurance fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Insurance Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.insuranceFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, insuranceFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Biometric fee - New Employee (If Applicable) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Biometric Fee (If Applicable)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.biometricFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, biometricFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>

                    {/* Visa & EID fee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Visa & EID Fee</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formData.visaEidFee}
                        onChange={(e) => setFormData(prev => ({ ...prev, visaEidFee: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculations, status and notes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                  {/* Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-800 cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Paid">Paid</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes / Audit Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="Enter specific audit remarks, warnings, or receipt details..."
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-none text-slate-800"
                    />
                  </div>
                </div>

                {/* Large visual badge displaying sum total */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase">Live Total Accumulator</h4>
                      <p className="text-slate-400 text-[10px] font-semibold">Auto-calculated sum of all designated fee structures</p>
                    </div>
                  </div>
                  
                  <div className="text-center sm:text-right">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">TOTAL VISA COST</p>
                    <p className="text-2xl md:text-3xl font-black text-brand-600">AED {calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

              </form>

              {/* Form Footer */}
              <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRecord}
                  type="submit"
                  className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-black text-xs hover:bg-brand-700 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {editingRecord ? 'Save Changes' : 'Record Visa Cost'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
