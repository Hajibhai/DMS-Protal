import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, ShieldAlert } from 'lucide-react';
import { PublicHoliday, Employee } from '../types';
import { saveHoliday, deleteHoliday } from '../services/storageService';

interface HolidayManagementModalProps {
  onClose: () => void;
  holidays: PublicHoliday[];
  employees: Employee[];
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  onLog: (action: string, details: string, type: 'create' | 'update' | 'delete' | 'system') => void;
  canManageSettings: boolean;
}

export const HolidayManagementModal: React.FC<HolidayManagementModalProps> = ({
  onClose,
  holidays,
  employees,
  openConfirm,
  onLog,
  canManageSettings
}) => {
  const [formData, setFormData] = useState({
    date: '',
    name: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) {
      setError("You do not have permission to manage holidays.");
      return;
    }

    if (!formData.date || !formData.name.trim()) {
      setError("Please fill in both the holiday date and description.");
      return;
    }

    // Check if holiday already exists for this date
    const dateExists = holidays.some(h => h.date === formData.date);
    if (dateExists) {
      setError("A holiday already exists for this date.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const holidayId = `holiday_${Date.now()}`;
    const newHoliday: PublicHoliday = {
      id: holidayId,
      date: formData.date,
      name: formData.name.trim()
    };

    try {
      await saveHoliday(newHoliday, employees);
      onLog('Holiday Created', `Holiday '${newHoliday.name}' on ${newHoliday.date} was added to the company calendar. All active employee attendance records were updated.`, 'create');
      setFormData({ date: '', name: '' });
    } catch (err) {
      console.error(err);
      setError("Failed to save holiday. Please check your credentials.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (holiday: PublicHoliday) => {
    if (!canManageSettings) {
      setError("You do not have permission to delete holidays.");
      return;
    }

    openConfirm(
      "Remove Corporate Holiday",
      `Are you sure you want to delete '${holiday.name}' on ${holiday.date}? Note: This will also remove the 'Public Holiday' attendance status logs for this date from the system.`,
      async () => {
        setError(null);
        try {
          await deleteHoliday(holiday.id, holiday.date, employees);
          onLog('Holiday Deleted', `Holiday '${holiday.name}' on ${holiday.date} was removed from the system. Attendance records were reverted.`, 'delete');
        } catch (err) {
          console.error(err);
          setError("Failed to delete holiday from database.");
        }
      },
      'danger'
    );
  };

  // Sort holidays by date: ascending order
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Holiday & Calendar Management</h3>
              <p className="text-xs text-slate-500 font-bold">Configure corporate and public holiday dates</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form & List Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-xs font-bold animate-in fade-in duration-300">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {canManageSettings ? (
            <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
              <div className="text-xs font-black text-slate-700 uppercase tracking-wider">Add Calendar Holiday</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Holiday Date</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Holiday Name</label>
                  <input 
                    type="text"
                    value={formData.name}
                    placeholder="e.g., National Day / Private Holiday"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-400 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-brand-600/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSaving ? "Saving Holiday..." : "Configure New Holiday"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs font-bold">
              Read-Only: You do not have permissions to add or remove corporate holidays. Contact an administrator for changes.
            </div>
          )}

          {/* Holiday List */}
          <div className="space-y-3">
            <div className="text-xs font-black text-slate-600 uppercase tracking-wider">Configured Corporate Holidays ({sortedHolidays.length})</div>
            {sortedHolidays.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                <Calendar className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No holidays have been configured yet.</p>
                <p className="text-xs">Add holiday dates above to automatically synchronize state with active timesheets.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[35vh] overflow-y-auto border border-slate-100 rounded-2xl">
                {sortedHolidays.map((holiday) => {
                  const holidayFormattedDate = new Date(holiday.date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                  return (
                    <div key={holiday.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-violet-50 text-violet-600 rounded-xl flex flex-col items-center justify-center text-[10px] font-black uppercase">
                          <span>{new Date(holiday.date).toLocaleString(undefined, { day: '2-digit' })}</span>
                          <span className="text-[8px] tracking-tighter">{new Date(holiday.date).toLocaleString(undefined, { month: 'short' })}</span>
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">{holiday.name}</div>
                          <div className="text-xs text-slate-500 font-bold">{holidayFormattedDate}</div>
                        </div>
                      </div>
                      {canManageSettings && (
                        <button
                          onClick={() => handleDelete(holiday)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            Close / Done
          </button>
        </div>
      </div>
    </div>
  );
};
