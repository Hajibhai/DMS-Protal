import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, BookOpen, FileText, Megaphone, Users, Plus, 
  Send, HelpCircle, ShieldAlert, CheckCircle, ExternalLink, 
  UserPlus, Loader2, RefreshCw, Key, LogIn, Award, Calendar, ChevronRight
} from 'lucide-react';
import { loginWithGoogle, getGoogleAccessToken } from '../firebase';

interface GoogleClassroomViewProps {
  employees: any[];
  companies: any[];
  projects: any[];
  user: any;
}

export const GoogleClassroomView: React.FC<GoogleClassroomViewProps> = ({ 
  employees = [], 
  companies = [], 
  projects = [], 
  user 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'academy-guide' | 'interactive-classroom'>('academy-guide');
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  
  // Create Course form
  const [newCourseName, setNewCourseName] = useState<string>('');
  const [newCourseSection, setNewCourseSection] = useState<string>('Pioneer Training');
  const [newCourseDesc, setNewCourseDesc] = useState<string>('');

  // Coursework / Assignment form
  const [assignmentTitle, setAssignmentTitle] = useState<string>('');
  const [assignmentDesc, setAssignmentDesc] = useState<string>('');
  const [assignmentPoints, setAssignmentPoints] = useState<number>(100);

  // Announcement form
  const [announcementText, setAnnouncementText] = useState<string>('');

  // Invitation form
  const [studentEmail, setStudentEmail] = useState<string>('');

  // Selected Course details
  const [courseWorkList, setCourseWorkList] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [rosterStudents, setRosterStudents] = useState<any[]>([]);
  const [rosterTeachers, setRosterTeachers] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [apiLogs, setApiLogs] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check token status on mount
  useEffect(() => {
    const token = getGoogleAccessToken();
    setIsAuthenticated(!!token);
  }, []);

  const addLog = (message: string) => {
    setApiLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  const handleConnectGoogle = async () => {
    setLoading(true);
    addLog('Initiating Google authentication flow with Classroom scopes...');
    try {
      await loginWithGoogle();
      setIsAuthenticated(true);
      addLog('Google account successfully connected! Google Classroom API scopes authorized.');
      await fetchCourses();
    } catch (err: any) {
      console.error(err);
      addLog(`Authentication failed: ${err.message || 'Cancelled'}`);
    } finally {
      setLoading(false);
    }
  };

  // 1. Fetch Courses
  const fetchCourses = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Authentication token not found. Please connect your Google Account.');
      return;
    }

    setLoading(true);
    addLog('Fetching Google Classroom courses...');
    try {
      const res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          throw new Error('Your session expired. Please reconnect Google Account.');
        }
        const errText = await res.text();
        throw new Error(`Google Classroom API error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      const loadedCourses = data.courses || [];
      setCourses(loadedCourses);
      addLog(`Successfully loaded ${loadedCourses.length} Classroom courses.`);
      if (loadedCourses.length > 0) {
        setSelectedCourseId(loadedCourses[0].id);
      } else {
        setSelectedCourseId('');
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Error loading courses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Selected Course Details (Work, Announcements, Rosters)
  const fetchCourseDetails = async (courseId: string) => {
    if (!courseId) return;
    const token = getGoogleAccessToken();
    if (!token) return;

    setLoadingDetails(true);
    addLog(`Loading details for Course ID: ${courseId}...`);
    try {
      // Fetch Coursework (assignments)
      const cwRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const cwData = await cwRes.json();
      setCourseWorkList(cwData.courseWork || []);

      // Fetch Announcements
      const annRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/announcements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const annData = await annRes.json();
      setAnnouncements(annData.announcements || []);

      // Fetch Students
      const stdRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const stdData = await stdRes.json();
      setRosterStudents(stdData.students || []);

      // Fetch Teachers
      const tchRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/teachers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tchData = await tchRes.json();
      setRosterTeachers(tchData.teachers || []);

      addLog(`Course details updated! Loaded ${cwData.courseWork?.length || 0} assignments, ${annData.announcements?.length || 0} announcements, ${stdData.students?.length || 0} students.`);
    } catch (err: any) {
      console.error(err);
      addLog(`Error loading course details: ${err.message}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Trigger loading when selected course changes
  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseDetails(selectedCourseId);
    } else {
      setCourseWorkList([]);
      setAnnouncements([]);
      setRosterStudents([]);
      setRosterTeachers([]);
    }
  }, [selectedCourseId]);

  // 3. Create a New Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    const confirmed = window.confirm(`Create a new Google Classroom course named "${newCourseName}"?`);
    if (!confirmed) return;

    setLoading(true);
    addLog(`Attempting to create course: "${newCourseName}"...`);
    try {
      const res = await fetch('https://classroom.googleapis.com/v1/courses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newCourseName,
          section: newCourseSection,
          descriptionHeading: 'Pioneer LMS Course',
          description: newCourseDesc,
          ownerId: 'me',
          courseState: 'ACTIVE'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const createdCourse = await res.json();
      addLog(`Successfully created Google Classroom Course! Course ID: ${createdCourse.id}`);
      setNewCourseName('');
      setNewCourseDesc('');
      await fetchCourses();
      setSelectedCourseId(createdCourse.id);
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to create course: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. Create an Assignment (CourseWork)
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !assignmentTitle.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    setLoading(true);
    addLog(`Posting assignment: "${assignmentTitle}"...`);
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${selectedCourseId}/courseWork`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: assignmentTitle,
          description: assignmentDesc,
          maxPoints: Number(assignmentPoints),
          workType: 'ASSIGNMENT',
          state: 'PUBLISHED'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      addLog(`Assignment successfully published to Google Classroom!`);
      setAssignmentTitle('');
      setAssignmentDesc('');
      await fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to publish assignment: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 5. Create an Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !announcementText.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    setLoading(true);
    addLog(`Posting announcement to Classroom...`);
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${selectedCourseId}/announcements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: announcementText,
          state: 'PUBLISHED'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      addLog(`Announcement successfully published!`);
      setAnnouncementText('');
      await fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to post announcement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 6. Invite Student / Add Member
  const handleInviteStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !studentEmail.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    const confirmed = window.confirm(`Send a Google Classroom Student Invitation to "${studentEmail}"?`);
    if (!confirmed) return;

    setLoading(true);
    addLog(`Creating student invitation for email "${studentEmail}"...`);
    try {
      const res = await fetch('https://classroom.googleapis.com/v1/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: studentEmail,
          courseId: selectedCourseId,
          role: 'STUDENT'
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      addLog(`Successfully sent Classroom Student Invitation to ${studentEmail}! They will see it in their Google Classroom dashboard.`);
      setStudentEmail('');
      await fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to invite student: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Visual Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900 to-slate-900 opacity-60 pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Pioneer Training Academy
              </h2>
              <p className="text-slate-400 text-sm font-semibold">Coordinate compliance courses, assignments, and onboarding syllabi in Google Classroom</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 relative z-10">
          <button
            onClick={() => setActiveSubTab('academy-guide')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeSubTab === 'academy-guide' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'bg-white/10 hover:bg-white/20 text-slate-300'
            }`}
          >
            <HelpCircle className="w-4 h-4 inline-block mr-1.5" />
            Academy & Training Guide
          </button>
          <button
            onClick={() => setActiveSubTab('interactive-classroom')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeSubTab === 'interactive-classroom' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'bg-white/10 hover:bg-white/20 text-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4 inline-block mr-1.5" />
            Classroom Manager
          </button>
        </div>
      </div>

      {activeSubTab === 'academy-guide' ? (
        /* ==================== ACADEMY GUIDE ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Informational Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Guide Card 1: Visual explanation */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Training Portal & LMS Syllabi</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Pioneer DMS Portal leverages the official Google Classroom API to coordinate training workflows for shift, office, and rotational staff. Managing required compliance courses, heavy machinery licenses, safety checklists, and driver education can be managed programmatically.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Courses & Syllabus</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    Set up individual classrooms for safety protocols, warehouse rules, and dispatch software tutorials. Each course receives a distinct Google Classroom invite code and group email roster automatically.
                  </p>
                </div>

                <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-black uppercase text-blue-800 tracking-wider">Task Assignment Logs</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    Send reading logs, safety drills, or shift sign-offs as Coursework. Employees can log into Google Classroom from any mobile device, complete tasks, and have grades or completion statuses tracked.
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Card 2: Step-by-Step setup */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Setting Up Google Classroom Integrations</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-800 shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Verify Your Google Workspace Licenses</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                      Ensure your enterprise account has Google Classroom enabled in the Google Workspace Admin console. Most corporate and school environments have this turned on automatically.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-800 shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Connect & Authenticate Above</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                      Click the **Classroom Manager** tab at the top-right. Authenticate your account to link our Pioneer DMS Portal with Google Classroom's secure API scopes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-800 shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Assign Training Modules</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                      Create compliance coursework directly from our interactive panel. Students/staff receive email notifications instantly when assignments are created, allowing them to upload and submit certifications.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-6">
            
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Launch Google Classroom</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Open the official Google Classroom application to view complete grade-books, track submission timelines, or configure customized student rubrics manually.
              </p>
              
              <div className="space-y-2">
                <a 
                  href="https://classroom.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    Open Google Classroom Web
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <a 
                  href="https://admin.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    Open Workspace Console
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl flex gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black uppercase text-emerald-900 tracking-wider">Dynamic Enrollment</h4>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    By linking employee records here, you can seamlessly push training invitations to their Google Classroom accounts with a single click.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Typical Pioneer DMS Syllabus</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Suggested training classrooms to maintain safe and efficient workplace compliance:
              </p>
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>Warehouse Safe-Stacking 101</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>rotational Worker Shift Handover Manual</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>First-Aid & Emergency Evacuation</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* ==================== INTERACTIVE CLASSROOM API MANAGER ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: API Controls & Forms */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Connection State Bar */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  isAuthenticated ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                }`}>
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Google Classroom Connection Status
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    {isAuthenticated 
                      ? 'Authorized: Connected to the Google Classroom API.' 
                      : 'Not connected. Link your Google account to manage courses, assignments, and rosters.'}
                  </p>
                </div>
              </div>

              {!isAuthenticated ? (
                <button
                  onClick={handleConnectGoogle}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Connect Google Classroom
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={fetchCourses}
                    disabled={loading}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    title="Reload Courses List"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Courses
                  </button>
                  <button
                    onClick={handleConnectGoogle}
                    className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    title="Switch or reconnect account"
                  >
                    Switch Account
                  </button>
                </div>
              )}
            </div>

            {/* Authenticated Manager Workspaces */}
            {isAuthenticated && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Course Selection & Details Browser */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-black text-slate-900">Selected Training Syllabus</h4>
                    </div>

                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="px-4 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs font-bold outline-none max-w-xs focus:ring-2 focus:ring-emerald-500"
                      disabled={loading || courses.length === 0}
                    >
                      {courses.length === 0 ? (
                        <option>No active courses. Create one below!</option>
                      ) : (
                        courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section ? `(${c.section})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Course Details Split */}
                  {selectedCourseId ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      
                      {/* Assignments in Classroom */}
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-emerald-600" /> Coursework Assignments
                          </h5>
                          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-150 px-2 py-0.5 rounded-full">
                            {courseWorkList.length} total
                          </span>
                        </div>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {courseWorkList.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic py-2">No assignments found in this training course yet.</p>
                          ) : (
                            courseWorkList.map((cw, cwIdx) => (
                              <div key={cwIdx} className="bg-white p-3 rounded-xl border border-slate-150 text-xs font-semibold shadow-2xs space-y-1">
                                <div className="flex justify-between items-start">
                                  <span className="text-slate-800 font-bold leading-tight">{cw.title}</span>
                                  {cw.maxPoints && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-lg shrink-0 font-bold">
                                      {cw.maxPoints} pts
                                    </span>
                                  )}
                                </div>
                                {cw.description && <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{cw.description}</p>}
                                {cw.alternateLink && (
                                  <a 
                                    href={cw.alternateLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-bold pt-1 cursor-pointer"
                                  >
                                    View on Classroom <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Announcements in Classroom */}
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                            <Megaphone className="w-4 h-4 text-blue-600" /> Live Announcements
                          </h5>
                          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-150 px-2 py-0.5 rounded-full">
                            {announcements.length} total
                          </span>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {announcements.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic py-2">No active announcements posted for this class.</p>
                          ) : (
                            announcements.map((ann, annIdx) => (
                              <div key={annIdx} className="bg-white p-3 rounded-xl border border-slate-150 text-xs font-semibold shadow-2xs space-y-1">
                                <p className="text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap">{ann.text}</p>
                                <span className="text-[9px] text-slate-400 font-bold">{ann.creationTime ? new Date(ann.creationTime).toLocaleString() : ''}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Students & Rosters */}
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3 md:col-span-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-emerald-600" /> Class Roster
                          </h5>
                          <div className="flex gap-2 text-[10px] font-bold text-slate-500">
                            <span>Teachers: {rosterTeachers.length}</span>
                            <span>•</span>
                            <span>Students: {rosterStudents.length}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-40 overflow-y-auto pt-1">
                          {/* Teacher group */}
                          <div className="space-y-2">
                            <h6 className="text-[10px] font-black uppercase text-slate-400">Instructors / Admins</h6>
                            {rosterTeachers.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">No instructor roster loaded.</p>
                            ) : (
                              rosterTeachers.map((tc, tcIdx) => (
                                <div key={tcIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                                  {tc.profile?.photoUrl ? (
                                    <img src={tc.profile.photoUrl} alt="" className="w-6 h-6 rounded-full" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] uppercase">
                                      {tc.profile?.name?.fullName?.[0] || 'I'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate leading-none">{tc.profile?.name?.fullName || 'Instructor'}</p>
                                    <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">{tc.profile?.emailAddress}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Students group */}
                          <div className="space-y-2">
                            <h6 className="text-[10px] font-black uppercase text-slate-400">Enrolled Workers / Staff</h6>
                            {rosterStudents.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">No staff enrolled yet. Invite workers below!</p>
                            ) : (
                              rosterStudents.map((st, stIdx) => (
                                <div key={stIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                                  {st.profile?.photoUrl ? (
                                    <img src={st.profile.photoUrl} alt="" className="w-6 h-6 rounded-full" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] uppercase">
                                      {st.profile?.name?.fullName?.[0] || 'W'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate leading-none">{st.profile?.name?.fullName || 'Enrolled Worker'}</p>
                                    <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">{st.profile?.emailAddress}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 italic text-xs">
                      No course selected. Please select a training course or build one below.
                    </div>
                  )}
                </div>

                {/* Sub-panels for Classroom Operations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Operation 1: Create a Course */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-black text-slate-900">Create Compliance Course</h4>
                    </div>

                    <form onSubmit={handleCreateCourse} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Course Name</label>
                        <input 
                          type="text"
                          value={newCourseName}
                          onChange={(e) => setNewCourseName(e.target.value)}
                          placeholder="e.g., Forklift Compliance Training"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Course Code / Section</label>
                        <input 
                          type="text"
                          value={newCourseSection}
                          onChange={(e) => setNewCourseSection(e.target.value)}
                          placeholder="e.g., Pioneer Logistics v2"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Description Summary</label>
                        <textarea
                          value={newCourseDesc}
                          onChange={(e) => setNewCourseDesc(e.target.value)}
                          placeholder="What will employees learn..."
                          rows={2}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                          disabled={loading}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !newCourseName.trim()}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4.5 h-4.5" />}
                        Create Training Course
                      </button>
                    </form>
                  </div>

                  {/* Operation 2: Create Coursework (Assignment) */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-black text-slate-900">Post Training Coursework</h4>
                    </div>

                    <form onSubmit={handleCreateAssignment} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Assignment Title</label>
                        <input 
                          type="text"
                          value={assignmentTitle}
                          onChange={(e) => setAssignmentTitle(e.target.value)}
                          placeholder="e.g., Complete Safety Checklist"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                          disabled={loading || !selectedCourseId}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Max Grade Points</label>
                          <input 
                            type="number"
                            value={assignmentPoints}
                            onChange={(e) => setAssignmentPoints(Number(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                            disabled={loading || !selectedCourseId}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Task Type</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" disabled>
                            <option>ASSIGNMENT</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Instructions / Description</label>
                        <textarea
                          value={assignmentDesc}
                          onChange={(e) => setAssignmentDesc(e.target.value)}
                          placeholder="Read compliance page 10-15 and submit confirmation doc..."
                          rows={2}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                          disabled={loading || !selectedCourseId}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !selectedCourseId || !assignmentTitle.trim()}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Publish Assignment
                      </button>
                    </form>
                  </div>

                  {/* Operation 3: Post Announcement */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                      <Megaphone className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-black text-slate-900">Publish Class Announcement</h4>
                    </div>

                    <form onSubmit={handleCreateAnnouncement} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Announcement Text</label>
                        <textarea 
                          value={announcementText}
                          onChange={(e) => setAnnouncementText(e.target.value)}
                          placeholder="Important: Compliance audit is scheduled for Monday at 9:00 AM..."
                          rows={4}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          required
                          disabled={loading || !selectedCourseId}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !selectedCourseId || !announcementText.trim()}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Post Announcement
                      </button>
                    </form>
                  </div>

                  {/* Operation 4: Invite Student */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-black text-slate-900">Enroll Staff / Rotational Workers</h4>
                    </div>

                    <form onSubmit={handleInviteStudent} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Worker Email Address</label>
                        <input 
                          type="email"
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          placeholder="worker@pioneerdms.com"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                          disabled={loading || !selectedCourseId}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !selectedCourseId || !studentEmail.trim()}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4.5 h-4.5" />}
                        Send Course Invitation
                      </button>
                    </form>

                    {/* Quick Staff email presets */}
                    <div className="pt-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block font-bold mb-1.5">Or choose an internal worker:</label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                        {employees.filter(e => e.email).slice(0, 15).map((emp, empIdx) => (
                          <button
                            key={empIdx}
                            type="button"
                            onClick={() => setStudentEmail(emp.email)}
                            className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg text-[9px] font-bold transition-all shrink-0 cursor-pointer"
                          >
                            {emp.name} ({emp.email})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* Right Column: Console & Troubleshooting Logs */}
          <div className="space-y-6">
            
            {/* Live API Console logs */}
            <div className="bg-slate-950 text-slate-350 rounded-3xl p-6 font-mono space-y-4 border border-slate-800 shadow-lg min-h-[350px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-200">Google Classroom Console</span>
                  </div>
                  <button 
                    onClick={() => setApiLogs([])}
                    className="text-[10px] text-slate-500 hover:text-slate-350 underline cursor-pointer"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="space-y-2 text-[11px] max-h-[300px] overflow-y-auto">
                  {apiLogs.length === 0 ? (
                    <p className="text-slate-600 italic">No events or requests logged yet. Authenticate or select a training course to view live logs.</p>
                  ) : (
                    apiLogs.map((log, idx) => (
                      <p key={idx} className="leading-relaxed break-all">
                        {log}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-slate-900 pt-3 text-[10px] text-slate-500 flex items-center justify-between">
                <span>API version: v1</span>
                <span>Active</span>
              </div>
            </div>

            {/* API Notice / Guidelines */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Troubleshooting Connections</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                To create, read, and write Google Classroom items successfully, verify that your Workspace user has teacher/admin rights or that Classroom is enabled for your domain. Standard personal Gmail accounts (<code className="bg-slate-100 px-1 font-mono rounded text-slate-800">@gmail.com</code>) also support standard Classroom operations completely.
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
