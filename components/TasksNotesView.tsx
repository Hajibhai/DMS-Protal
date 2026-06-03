import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Edit, Check, Clock, AlertCircle, 
  User, Calendar, Search, Pin, ClipboardList, 
  StickyNote, CheckSquare, Sparkles, Filter, MoreVertical, CheckCircle2, ChevronRight
} from 'lucide-react';
import { 
  collection, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, query, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Task, Note, SystemUser } from '../types';
import { cn } from '../utils';

interface TasksNotesViewProps {
  systemUser: SystemUser | null;
}

export default function TasksNotesView({ systemUser }: TasksNotesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'notes'>('tasks');
  const isEmployee = systemUser?.role?.toLowerCase() === 'employee';
  const isCurrentUserAdmin = systemUser?.role?.toLowerCase() === 'admin' || systemUser?.role?.toLowerCase() === 'creator';
  
  const getProgressDays = (startedAt?: string, completedAt?: string): string => {
    if (!startedAt) return "Not started yet";
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays < 1) {
      const diffHours = diffTime / (1000 * 60 * 60);
      if (diffHours < 1) {
        const diffMinutes = diffTime / (1000 * 60);
        return `${Math.round(diffMinutes)} mins`;
      }
      return `${diffHours.toFixed(1)} hours`;
    }
    return `${diffDays.toFixed(1)} days`;
  };
  
  // Real-time states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  
  // Filter & Search states
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [noteSearch, setNoteSearch] = useState('');
  
  // Modal / Form states
  const [showTaskForm, setShowTaskForm] = useState<Partial<Task> | null>(null);
  const [showNoteForm, setShowNoteForm] = useState<Partial<Note> | null>(null);

  // loading states
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // 1. Fetch System Users for assignment
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: SystemUser[] = [];
      snap.forEach((doc) => {
        const u = { id: doc.id, ...doc.data() } as any;
        const roleLower = (u.role || '').toLowerCase();
        const emailLower = (u.email || '').toLowerCase();
        const nameLower = (u.name || '').toLowerCase();
        
        // Filter out Creator details completely from the workspace lists
        if (
          roleLower !== 'creator' && 
          emailLower !== 'abdulkaderp3010@gmail.com' && 
          nameLower !== 'mohamed abdul kader'
        ) {
          list.push(u);
        }
      });
      setSystemUsers(list);
    });
    return unsub;
  }, []);

  // 2. Fetch Tasks with real-time sync
  useEffect(() => {
    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qTasks, (snap) => {
      const list: Task[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(list);
      setLoadingTasks(false);
    }, (err) => {
      console.error("Error reading tasks:", err);
      setLoadingTasks(false);
    });
    return unsub;
  }, []);

  // 3. Fetch Notes with real-time sync
  useEffect(() => {
    const qNotes = query(collection(db, 'notes'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qNotes, (snap) => {
      const list: Note[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Note);
      });
      setNotes(list);
      setLoadingNotes(false);
    }, (err) => {
      console.error("Error reading notes:", err);
      setLoadingNotes(false);
    });
    return unsub;
  }, []);

  const canManageTask = (t: Task | undefined) => {
    if (!t) return false;
    if (!systemUser) return false;

    // If the task has remarks, prevent regular users from editing or deleting it.
    const hasRemarks = t.remarks && t.remarks.length > 0;
    const isCurrentUserAdmin = systemUser.role?.toLowerCase() === 'admin' || systemUser.role?.toLowerCase() === 'creator';
    if (hasRemarks && !isCurrentUserAdmin) {
      return false;
    }
    
    // Original creator of the task can always manage it
    if (t.createdById === systemUser.uid) return true;

    // Determine task creator's role
    const creatorUser = systemUsers.find(u => u.uid === t.createdById);
    const creatorRole = creatorUser?.role || t.createdByRole || '';
    const isTaskCreatorAdmin = creatorRole.toLowerCase() === 'admin' || creatorRole.toLowerCase() === 'creator';

    // If an Admin or Creator created the task:
    // "other user not able to edit or delete the record. if admin created the task."
    if (isTaskCreatorAdmin) {
      const isCurrentUserAdmin = systemUser.role?.toLowerCase() === 'admin' || systemUser.role?.toLowerCase() === 'creator';
      return isCurrentUserAdmin;
    }

    // Default permission: Users with manager roles can edit/delete other people's standard tasks.
    const isCurrentUserManager = ['admin', 'creator', 'hr', 'supervisor'].includes(systemUser.role?.toLowerCase() || '');
    if (isCurrentUserManager) return true;

    return false;
  };

  const [taskRemarksInput, setTaskRemarksInput] = useState<Record<string, string>>({});

  // Handlers for Tasks
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTaskForm?.title) return;

    const assignedUser = systemUsers.find(u => u.uid === showTaskForm.assignedTo);
    const taskData: Partial<Task> = {
      title: showTaskForm.title,
      description: showTaskForm.description || '',
      status: showTaskForm.status || 'Pending',
      priority: showTaskForm.priority || 'Medium',
      dueDate: showTaskForm.dueDate || '',
      assignedTo: showTaskForm.assignedTo || '',
      assignedToName: assignedUser ? assignedUser.name : '',
      checklist: showTaskForm.checklist || [],
      updatedAt: new Date().toISOString()
    };

    if (showTaskForm.id) {
      // Edit mode
      const originalTask = tasks.find(t => t.id === showTaskForm.id);
      if (originalTask) {
        if (!canManageTask(originalTask)) {
          alert("Permission denied: You do not have permission to edit this task.");
          return;
        }

        // Validate state regression: "not able to undo"
        const currentStatus = originalTask.status;
        const requestedStatus = showTaskForm.status || 'Pending';
        if (!isCurrentUserAdmin) {
          if (currentStatus === 'Completed' && requestedStatus !== 'Completed') {
            alert("Cannot undo a completed task.");
            return;
          }
          if (currentStatus === 'In Progress' && requestedStatus === 'Pending') {
            alert("Cannot revert an 'In Progress' task back to 'Pending'.");
            return;
          }
        }

        // Logging if status changed via edit form
        if (currentStatus !== requestedStatus) {
          const nowStr = new Date().toISOString();
          const logs = [...(originalTask.progressLog || [])];
          if (requestedStatus === 'In Progress') {
            taskData.startedAt = originalTask.startedAt || nowStr;
            taskData.completedAt = ''; // Clear completedAt on rollback
            logs.push({
              status: currentStatus === 'Completed' ? 'Undo: Rolled back to In Progress by Admin' : 'In Progress',
              timestamp: nowStr,
              changedBy: systemUser?.name || 'Unknown',
              changedById: systemUser?.uid || 'Unknown'
            });
            taskData.progressLog = logs;
          } else if (requestedStatus === 'Completed') {
            taskData.completedAt = nowStr;
            if (!originalTask.startedAt) {
              taskData.startedAt = nowStr;
            }
            logs.push({
              status: 'Completed',
              timestamp: nowStr,
              changedBy: systemUser?.name || 'Unknown',
              changedById: systemUser?.uid || 'Unknown'
            });
            taskData.progressLog = logs;
          } else if (requestedStatus === 'Pending') {
            taskData.startedAt = '';
            taskData.completedAt = '';
            logs.push({
              status: 'Undo: Reverted to Pending by Admin',
              timestamp: nowStr,
              changedBy: systemUser?.name || 'Unknown',
              changedById: systemUser?.uid || 'Unknown'
            });
            taskData.progressLog = logs;
          }
        } else {
          // preserve logs and timestamps if status didn't change
          taskData.startedAt = originalTask.startedAt || '';
          taskData.completedAt = originalTask.completedAt || '';
          taskData.progressLog = originalTask.progressLog || [];
        }
        // preserve remarks
        taskData.remarks = originalTask.remarks || [];
      }
    }

    try {
      if (showTaskForm.id) {
        // Edit mode
        await updateDoc(doc(db, 'tasks', showTaskForm.id), taskData);
      } else {
        // Create mode
        const nowStr = new Date().toISOString();
        taskData.createdAt = nowStr;
        taskData.createdById = systemUser?.uid || 'unknown';
        taskData.createdBy = systemUser?.name || 'Unknown User';
        taskData.createdByRole = systemUser?.role || 'User';
        taskData.remarks = [];
        
        const logs = [];
        if (taskData.status === 'In Progress') {
          taskData.startedAt = nowStr;
          logs.push({
            status: 'In Progress',
            timestamp: nowStr,
            changedBy: systemUser?.name || 'Unknown',
            changedById: systemUser?.uid || 'Unknown'
          });
          taskData.progressLog = logs;
        } else if (taskData.status === 'Completed') {
          taskData.startedAt = nowStr;
          taskData.completedAt = nowStr;
          logs.push({
            status: 'Completed',
            timestamp: nowStr,
            changedBy: systemUser?.name || 'Unknown',
            changedById: systemUser?.uid || 'Unknown'
          });
          taskData.progressLog = logs;
        }
        
        await addDoc(collection(db, 'tasks'), taskData);
      }
      setShowTaskForm(null);
    } catch (err) {
      console.error("Error saving task:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    if (targetTask && !canManageTask(targetTask)) {
      alert("Permission denied: You do not have permission to delete this task.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await deleteDoc(doc(db, 'tasks', id));
      } catch (err) {
        console.error("Error deleting task:", err);
      }
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (task.status === 'Completed' && !isCurrentUserAdmin) {
      alert("This task is already completed and cannot be undone.");
      return;
    }

    let newStatus: Task['status'];
    if (task.status === 'Completed') {
      newStatus = 'In Progress';
    } else if (task.status === 'In Progress') {
      newStatus = 'Completed';
    } else {
      newStatus = 'In Progress';
    }

    const nowStr = new Date().toISOString();
    const logs = [...(task.progressLog || [])];
    const updates: Partial<Task> = {
      status: newStatus,
      updatedAt: nowStr
    };

    if (task.status === 'Pending' && newStatus === 'In Progress') {
      updates.startedAt = nowStr;
      logs.push({
        status: 'In Progress',
        timestamp: nowStr,
        changedBy: systemUser?.name || 'Unknown',
        changedById: systemUser?.uid || 'Unknown'
      });
      updates.progressLog = logs;
    } else if (task.status === 'In Progress' && newStatus === 'Completed') {
      updates.completedAt = nowStr;
      logs.push({
        status: 'Completed',
        timestamp: nowStr,
        changedBy: systemUser?.name || 'Unknown',
        changedById: systemUser?.uid || 'Unknown'
      });
      updates.progressLog = logs;
    } else if (task.status === 'Completed' && newStatus === 'In Progress') {
      updates.completedAt = ''; // Clear completed timestamp
      logs.push({
        status: 'Undo: Rolled back to In Progress by Admin',
        timestamp: nowStr,
        changedBy: systemUser?.name || 'Unknown',
        changedById: systemUser?.uid || 'Unknown'
      });
      updates.progressLog = logs;
    }

    try {
      await updateDoc(doc(db, 'tasks', task.id), updates);
    } catch (err) {
      console.error("Error toggling task status:", err);
    }
  };

  const handleToggleChecklistItem = async (task: Task, itemIndex: number) => {
    if (!task.checklist) return;
    const updatedChecklist = [...task.checklist];
    updatedChecklist[itemIndex] = {
      ...updatedChecklist[itemIndex],
      completed: !updatedChecklist[itemIndex].completed
    };
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        checklist: updatedChecklist,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error toggling checklist item:", err);
    }
  };

  const handleAddRemark = async (taskId: string, remarkText: string) => {
    if (!remarkText.trim()) return;
    const taskObj = tasks.find(t => t.id === taskId);
    if (!taskObj) return;

    const newRemark = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
      text: remarkText.trim(),
      createdAt: new Date().toISOString(),
      createdBy: systemUser?.name || 'Unknown User',
      createdById: systemUser?.uid || 'unknown'
    };

    const updatedRemarks = [...(taskObj.remarks || []), newRemark];

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        remarks: updatedRemarks,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding remark:", err);
    }
  };

  // Handlers for Notes
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showNoteForm?.title || !showNoteForm?.content) return;

    const noteData: Partial<Note> = {
      title: showNoteForm.title,
      content: showNoteForm.content,
      color: showNoteForm.color || 'yellow',
      pinned: showNoteForm.pinned || false,
      updatedAt: new Date().toISOString()
    };

    try {
      if (showNoteForm.id) {
        await updateDoc(doc(db, 'notes', showNoteForm.id), noteData);
      } else {
        noteData.createdAt = new Date().toISOString();
        noteData.createdById = systemUser?.uid || 'unknown';
        noteData.createdBy = systemUser?.name || 'Unknown User';
        await addDoc(collection(db, 'notes'), noteData);
      }
      setShowNoteForm(null);
    } catch (err) {
      console.error("Error saving note:", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this note?")) {
      try {
        await deleteDoc(doc(db, 'notes', id));
      } catch (err) {
        console.error("Error deleting note:", err);
      }
    }
  };

  const handleTogglePinNote = async (note: Note) => {
    try {
      await updateDoc(doc(db, 'notes', note.id), {
        pinned: !note.pinned,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error pinning/unpinning note:", err);
    }
  };

  // Filter computations
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(taskSearch.toLowerCase()) || 
                            (t.description || '').toLowerCase().includes(taskSearch.toLowerCase()) ||
                            (t.assignedToName || '').toLowerCase().includes(taskSearch.toLowerCase());
      const matchesStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
      const matchesPriority = taskPriorityFilter === 'all' || t.priority === taskPriorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, taskSearch, taskStatusFilter, taskPriorityFilter]);

  const sortedNotes = useMemo(() => {
    const list = notes.filter(n => 
      n.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
      n.content.toLowerCase().includes(noteSearch.toLowerCase())
    );
    // Pin at the top, rest order by createdAt desc
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, noteSearch]);

  const priorityColors = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Medium: 'bg-amber-50 text-amber-700 border-amber-100',
    High: 'bg-rose-50 text-rose-700 border-rose-100'
  };

  const statusColors = {
    'Pending': 'bg-slate-50 text-slate-700 border-slate-200',
    'In Progress': 'bg-brand-50 text-brand-700 border-brand-200',
    'Completed': 'bg-indigo-50 text-indigo-700 border-indigo-200'
  };

  const stickyColors = {
    yellow: 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-100/50',
    blue: 'bg-sky-50 border-sky-200 text-sky-900 shadow-sky-100/50',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100/50',
    rose: 'bg-rose-50 border-rose-200 text-rose-900 shadow-rose-100/50',
    slate: 'bg-slate-50 border-slate-200 text-slate-800 shadow-slate-200/50'
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Tab Switcher & Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-brand-600 animate-pulse stroke-[1.5]" />
            Collaborative Workspace
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage team priorities, track items, and capture reminders instantly.</p>
        </div>

        {/* Modular Workspace Selector */}
        <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center gap-1 self-start">
          <button
            onClick={() => setActiveSubTab('tasks')}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2",
              activeSubTab === 'tasks' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <CheckSquare className="w-4 h-4" /> Team Tasks
          </button>
          <button
            onClick={() => setActiveSubTab('notes')}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2",
              activeSubTab === 'notes' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <StickyNote className="w-4 h-4" /> Memo Board
          </button>
        </div>
      </div>

      {activeSubTab === 'tasks' ? (
        // ================= TASKS PANEL =================
        <div className="space-y-6">
          {/* Controls Header */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks or assignees..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-inner w-56 focus:w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Priority Filter */}
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Priorities</option>
                <option value="High">🔴 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </select>
            </div>

            <button
              onClick={() => setShowTaskForm({ status: 'Pending', priority: 'Medium' })}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all flex items-center gap-2 self-stretch md:self-auto justify-center"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Add New Task
            </button>
          </div>

          {/* Tasks List */}
          {loadingTasks ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
              <ClipboardList className="w-16 h-16 text-slate-300 stroke-[1.2] mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No tasks found</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-sm">No tasks match your filter criteria or have been created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredTasks.map((t) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-slate-200/50 transition-all relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Priority and Actions */}
                      <div className="flex items-center justify-between mb-3.5">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border", priorityColors[t.priority])}>
                          {t.priority} Priority
                        </span>

                        {canManageTask(t) && (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => setShowTaskForm(t)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all"
                              title="Edit task"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5">
                        <h4 className={cn("font-bold text-slate-900 text-sm leading-snug break-words", t.status === 'Completed' && "line-through text-slate-400")}>
                          {t.title}
                        </h4>
                        {t.description && (
                          <p className={cn("text-xs text-slate-500 leading-relaxed font-semibold break-words", t.status === 'Completed' && "line-through text-slate-300")}>
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata Bottom bar */}
                    <div className="mt-5 pt-3.5 border-t border-slate-50 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-1.5">
                        {/* Assignee */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">
                            {t.assignedToName || 'Unassigned'}
                          </span>
                        </div>

                        {/* Due Date */}
                        {t.dueDate && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold text-slate-500">
                              {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Toggle Status Button */}
                        <button
                          onClick={() => handleToggleTaskStatus(t)}
                          disabled={t.status === 'Completed' && !isCurrentUserAdmin}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-1 w-full justify-center shadow-sm",
                            t.status === 'Completed' 
                              ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-80 disabled:cursor-not-allowed" 
                              : t.status === 'In Progress'
                              ? "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {t.status === 'Completed' ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" /> {isCurrentUserAdmin ? "Completed (Click to Undo)" : "Completed"}
                            </>
                          ) : t.status === 'In Progress' ? (
                            <>
                              <Clock className="w-3.5 h-3.5" /> Complete Task
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" /> Start Task
                            </>
                          )}
                        </button>

                        {/* Checklist Section (Optional) */}
                        {t.checklist && t.checklist.length > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100/60 space-y-1.5 text-left">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">📋 Subtask Checklist</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                              {t.checklist.map((item, idx) => (
                                <label key={item.id || idx} className="flex items-start gap-2 cursor-pointer text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => handleToggleChecklistItem(t, idx)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 mt-0.5"
                                  />
                                  <span className={cn("break-words", item.completed && "line-through text-slate-300 font-normal")}>
                                    {item.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Remarks & Issues Section */}
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100/60 text-left space-y-2">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>📝 Issues & Remarks {t.remarks && t.remarks.length > 0 ? `(${t.remarks.length})` : ''}</span>
                          </div>
                          
                          {/* List of static Remarks */}
                          {t.remarks && t.remarks.length > 0 && (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {t.remarks.map((rem) => (
                                <div key={rem.id} className="p-2 bg-slate-50/80 border border-slate-100 rounded-xl text-[10px] font-semibold text-slate-700 flex flex-col gap-0.5 shadow-sm">
                                  <p className="break-words font-medium text-slate-800 leading-snug">{rem.text}</p>
                                  <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    <span>By: {rem.createdBy?.split(' ')[0]}</span>
                                    <span>{new Date(rem.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add a Remark Input block */}
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Mention delay or issue reason..."
                              value={taskRemarksInput[t.id] || ''}
                              onChange={(e) => setTaskRemarksInput({ ...taskRemarksInput, [t.id]: e.target.value })}
                              className="flex-1 p-2 border border-slate-200 rounded-xl text-[10px] font-semibold bg-white text-slate-800 outline-none focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddRemark(t.id, taskRemarksInput[t.id] || '');
                                  setTaskRemarksInput({ ...taskRemarksInput, [t.id]: '' });
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleAddRemark(t.id, taskRemarksInput[t.id] || '');
                                setTaskRemarksInput({ ...taskRemarksInput, [t.id]: '' });
                              }}
                              className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-[10px] font-bold transition-all shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Admin-only Timing Logs */}
                        {(systemUser?.role?.toLowerCase() === 'admin' || systemUser?.role?.toLowerCase() === 'creator') && (
                          <div className="mt-2.5 pt-2.5 border-t border-indigo-100 bg-indigo-50/40 p-2.5 rounded-2xl text-[10px] text-left space-y-1">
                            <div className="font-extrabold text-indigo-700 uppercase tracking-widest text-[8px] mb-1">🛠 Progression Analytics (Admin Only)</div>
                            {t.startedAt ? (
                              <div className="space-y-0.5 text-slate-600 font-semibold">
                                <div><span className="text-slate-400">Started:</span> {new Date(t.startedAt).toLocaleString()}</div>
                                {t.completedAt && (
                                  <div><span className="text-slate-400">Completed:</span> {new Date(t.completedAt).toLocaleString()}</div>
                                )}
                                <div>
                                  <span className="text-slate-400">Progress Days:</span>{" "}
                                  <span className="text-indigo-600 font-bold">{getProgressDays(t.startedAt, t.completedAt)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-400 italic">No progress started yet</div>
                            )}

                            {t.progressLog && t.progressLog.length > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-indigo-100/60 font-mono text-[8px] leading-relaxed text-slate-500 max-h-16 overflow-y-auto space-y-0.5">
                                {t.progressLog.map((log, index) => (
                                  <div key={index}>
                                    • [{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] {log.status} by {log.changedBy}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        // ================= NOTES BOARD =================
        <div className="space-y-6">
          {/* Controls Header */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search memos..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-inner w-56 focus:w-64"
              />
            </div>

            <button
              onClick={() => setShowNoteForm({ color: 'yellow', pinned: false })}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all flex items-center gap-2 self-stretch md:self-auto justify-center"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Add Memo / Note
            </button>
          </div>

          {loadingNotes ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>
          ) : sortedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
              <StickyNote className="w-16 h-16 text-slate-300 stroke-[1.2] mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No memos discovered</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-sm">Create sticky notes to pin procedures, phone extensions, or instant ideas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {sortedNotes.map((n) => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "group border rounded-3xl p-6 hover:shadow-xl transition-all relative flex flex-col justify-between h-56",
                      stickyColors[n.color || 'yellow']
                    )}
                  >
                    <div>
                      {/* Note Header Title */}
                      <div className="flex items-start justify-between gap-2.5">
                        <h4 className="font-bold text-sm leading-snug break-words pr-4 line-clamp-2">
                          {n.title}
                        </h4>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleTogglePinNote(n)}
                            className={cn(
                              "p-1 hover:bg-black/5 rounded",
                              n.pinned ? "text-slate-800" : "text-slate-400 opacity-20 group-hover:opacity-100"
                            )}
                            title={n.pinned ? "Unpin note" : "Pin note"}
                          >
                            <Pin className={cn("w-3.5 h-3.5", n.pinned && "fill-current")} />
                          </button>
                          
                          <button
                            onClick={() => setShowNoteForm(n)}
                            className="p-1 hover:bg-black/5 rounded text-slate-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content Description */}
                      <p className="text-xs mt-3 leading-relaxed font-medium break-words line-clamp-4 whitespace-pre-wrap">
                        {n.content}
                      </p>
                    </div>

                    {/* Meta Footer */}
                    <div className="text-[9px] font-bold text-black/40 mt-4 pt-2 border-t border-black/5 flex items-center justify-between">
                      <span>By: {n.createdBy?.split(' ')[0]}</span>
                      <span>
                        {new Date(n.updatedAt || n.createdAt).toLocaleString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ===================== ADD/EDIT TASK MODAL ===================== */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-900">{showTaskForm.id ? 'Edit Task Settings' : 'Create New Task'}</h2>
              <button 
                onClick={() => setShowTaskForm(null)} 
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-500 transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Review timesheets, submit audit records..."
                  value={showTaskForm.title || ''}
                  onChange={(e) => setShowTaskForm({ ...showTaskForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm font-semibold bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  placeholder="Add additional guidelines or team references here..."
                  rows={3}
                  value={showTaskForm.description || ''}
                  onChange={(e) => setShowTaskForm({ ...showTaskForm, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm font-semibold bg-white text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</label>
                  <select
                    value={showTaskForm.priority || 'Medium'}
                    onChange={(e) => setShowTaskForm({ ...showTaskForm, priority: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-xs font-semibold bg-white text-slate-700"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <select
                    value={showTaskForm.status || 'Pending'}
                    onChange={(e) => setShowTaskForm({ ...showTaskForm, status: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-xs font-semibold bg-white text-slate-700"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</label>
                  <input
                    type="date"
                    value={showTaskForm.dueDate || ''}
                    onChange={(e) => setShowTaskForm({ ...showTaskForm, dueDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-xs font-semibold bg-white text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignee</label>
                  <select
                    value={showTaskForm.assignedTo || ''}
                    onChange={(e) => setShowTaskForm({ ...showTaskForm, assignedTo: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-xs font-semibold bg-white text-slate-700"
                  >
                    <option value="">Unassigned</option>
                    {systemUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist / Tick boxes section */}
              <div className="space-y-2 pt-2 border-t border-slate-100/65">
                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Checklist (Optional Subtasks)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentChecklist = showTaskForm.checklist || [];
                      setShowTaskForm({
                        ...showTaskForm,
                        checklist: [...currentChecklist, { id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4), text: '', completed: false }]
                      });
                    }}
                    className="text-[10px] text-brand-600 hover:text-brand-800 font-extrabold flex items-center gap-0.5 uppercase tracking-wider"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(showTaskForm.checklist || []).map((item, index) => (
                    <div key={item.id || index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Verification step..."
                        value={item.text}
                        onChange={(e) => {
                          const updated = [...(showTaskForm.checklist || [])];
                          updated[index] = { ...updated[index], text: e.target.value };
                          setShowTaskForm({ ...showTaskForm, checklist: updated });
                        }}
                        className="flex-1 p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (showTaskForm.checklist || []).filter((_, idx) => idx !== index);
                          setShowTaskForm({ ...showTaskForm, checklist: updated });
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(showTaskForm.checklist || []).length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">No checklist tick boxes added yet.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowTaskForm(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-brand-500/20"
                >
                  {showTaskForm.id ? 'Save Updates' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== ADD/EDIT MEMO / NOTE MODAL ===================== */}
      {showNoteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-900">{showNoteForm.id ? 'Modify Memorandum' : 'Write New Sticky Memo'}</h2>
              <button 
                onClick={() => setShowNoteForm(null)} 
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-500 transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memo Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Office LAN Credentials, Key Deliverables..."
                  value={showNoteForm.title || ''}
                  onChange={(e) => setShowNoteForm({ ...showNoteForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm font-semibold bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memo Message / Content</label>
                <textarea
                  required
                  placeholder="Draft your memorandum details or quick guidelines here..."
                  rows={4}
                  value={showNoteForm.content || ''}
                  onChange={(e) => setShowNoteForm({ ...showNoteForm, content: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm font-semibold bg-white text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between">
                {/* Pin note toggle */}
                <button
                  type="button"
                  onClick={() => setShowNoteForm({ ...showNoteForm, pinned: !showNoteForm.pinned })}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wide transition-all",
                    showNoteForm.pinned 
                      ? "bg-amber-100 border-amber-300 text-amber-700" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  <Pin className="w-3 h-3" /> {showNoteForm.pinned ? 'Pinned to Top' : 'Pin to Top'}
                </button>

                {/* Color Selection pills */}
                <div className="flex items-center gap-2">
                  {(['yellow', 'blue', 'green', 'rose', 'slate'] as const).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setShowNoteForm({ ...showNoteForm, color: col })}
                      className={cn(
                        "w-5 h-5 rounded-full border border-black/10 hover:scale-110 active:scale-95 transition-all relative shrink-0",
                        col === 'yellow' && "bg-amber-100",
                        col === 'blue' && "bg-sky-100",
                        col === 'green' && "bg-emerald-100",
                        col === 'rose' && "bg-rose-100",
                        col === 'slate' && "bg-slate-100"
                      )}
                    >
                      {showNoteForm.color === col && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-extrabold text-[10px]">✓</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowNoteForm(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-brand-500/20"
                >
                  {showNoteForm.id ? 'Save Updates' : 'Publish Memo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
