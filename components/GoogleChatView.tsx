import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Users, Sparkles, LogIn, Plus, 
  Send, HelpCircle, ShieldAlert, CheckCircle, ExternalLink, 
  Globe, UserPlus, Server, Loader2, ArrowRight, RefreshCw, Key
} from 'lucide-react';
import { loginWithGoogle, getGoogleAccessToken } from '../firebase';

interface GoogleChatViewProps {
  employees: any[];
  companies: any[];
  projects: any[];
  user: any;
}

export const GoogleChatView: React.FC<GoogleChatViewProps> = ({ 
  employees = [], 
  companies = [], 
  projects = [], 
  user 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'connector' | 'api-sandbox'>('connector');
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [newSpaceName, setNewSpaceName] = useState<string>('');
  const [memberEmail, setMemberEmail] = useState<string>('');
  const [welcomeMessage, setWelcomeMessage] = useState<string>('Hello! Welcome to our Pioneer DMS collaborative channel.');
  const [loading, setLoading] = useState<boolean>(false);
  const [apiLogs, setApiLogs] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showGcpChatAppNotice, setShowGcpChatAppNotice] = useState<boolean>(false);

  // Check token status on mount
  useEffect(() => {
    const token = getGoogleAccessToken();
    setIsAuthenticated(!!token);
  }, []);

  const addLog = (message: string) => {
    setApiLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    if (
      message.includes('Chat app not found') || 
      message.includes('404') || 
      message.includes('configure') || 
      message.includes('turn on the Chat API')
    ) {
      setShowGcpChatAppNotice(true);
    }
  };

  const handleConnectGoogle = async () => {
    setLoading(true);
    addLog('Initiating Google authentication flow...');
    try {
      await loginWithGoogle();
      setIsAuthenticated(true);
      addLog('Google account successfully connected! Google Chat API scopes authorized.');
      // Fetch spaces automatically
      await fetchSpaces();
    } catch (err: any) {
      console.error(err);
      addLog(`Authentication failed: ${err.message || 'Cancelled'}`);
    } finally {
      setLoading(false);
    }
  };

  // 1. List spaces
  const fetchSpaces = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Authentication token not found. Please connect your Google Account.');
      return;
    }

    setLoading(true);
    addLog('Fetching your Google Chat spaces...');
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
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
        throw new Error(`Google Chat API error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      const loadedSpaces = data.spaces || [];
      setSpaces(loadedSpaces);
      addLog(`Successfully loaded ${loadedSpaces.length} Google Chat spaces.`);
      if (loadedSpaces.length > 0) {
        setSelectedSpaceId(loadedSpaces[0].name);
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Error loading spaces: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Create space
  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    // Confirm operation
    const confirmed = window.confirm(`Create a new Google Chat Space named "${newSpaceName}"?`);
    if (!confirmed) return;

    setLoading(true);
    addLog(`Attempting to create space: "${newSpaceName}"...`);
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spaceType: 'SPACE',
          displayName: newSpaceName
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const createdSpace = await res.json();
      addLog(`Successfully created Google Chat Space! Space ID: ${createdSpace.name}`);
      setNewSpaceName('');
      // Reload spaces list
      await fetchSpaces();
      setSelectedSpaceId(createdSpace.name);
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to create space: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !memberEmail.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    // Confirm operation
    const confirmed = window.confirm(`Invite "${memberEmail}" to the selected Google Chat Space?`);
    if (!confirmed) return;

    setLoading(true);
    addLog(`Attempting to add user "${memberEmail}" to space...`);
    try {
      // API endpoints format: https://chat.googleapis.com/v1/spaces/{spaceId}/memberships
      // We send the membership body to add a member
      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpaceId}/memberships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member: {
            name: `users/${encodeURIComponent(memberEmail)}`,
            type: 'HUMAN'
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        // Check for specific external user errors
        if (errText.includes('external') || res.status === 400 || res.status === 403) {
          addLog(`API Notice: If adding external user fails directly, please verify that "External Spaces" and "External Members" are enabled in your Workspace Admin console.`);
        }
        throw new Error(errText);
      }

      const addedMember = await res.json();
      addLog(`Successfully connected user! Membership confirmed.`);
      setMemberEmail('');
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to add member: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !welcomeMessage.trim()) return;

    const token = getGoogleAccessToken();
    if (!token) {
      addLog('Please connect your Google Account first.');
      return;
    }

    setLoading(true);
    addLog(`Sending message to space...`);
    try {
      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpaceId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: welcomeMessage
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      addLog(`Message successfully posted to Space!`);
      setWelcomeMessage('');
    } catch (err: any) {
      console.error(err);
      addLog(`Failed to send message: ${err.message}`);
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
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Google Chat Integration Manager
              </h2>
              <p className="text-slate-400 text-sm font-semibold">Connect internal employees and external users seamlessly in Google Workspace</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 relative z-10">
          <button
            onClick={() => setActiveSubTab('connector')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeSubTab === 'connector' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'bg-white/10 hover:bg-white/20 text-slate-300'
            }`}
          >
            <HelpCircle className="w-4 h-4 inline-block mr-1.5" />
            User Connection Guide
          </button>
          <button
            onClick={() => setActiveSubTab('api-sandbox')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeSubTab === 'api-sandbox' 
                ? 'bg-white text-slate-950 shadow-sm' 
                : 'bg-white/10 hover:bg-white/20 text-slate-300'
            }`}
          >
            <Server className="w-4 h-4 inline-block mr-1.5" />
            Interactive Workspace API
          </button>
        </div>
      </div>

      {activeSubTab === 'connector' ? (
        /* ==================== CONNECTOR USER GUIDE ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Informational Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Guide Card 1: How Google Chat Connects Users */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Connecting Your Domain & External Users</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Google Chat lets you coordinate with anyone—both inside your organization's directory and external partners or clients outside your system. Understanding how memberships are governed makes communication seamless.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Internal Users (Your Staff)</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    Employees who share your company's domain are fully integrated. You can immediately search, direct-message, or add them to team spaces by typing their name or official business email.
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-blue-600 text-[11px] font-bold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Auto-resolves names and profiles
                  </div>
                </div>

                <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                  <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider">External Users (Out of Domain)</h4>
                  <p className="text-xs text-amber-900/80 leading-relaxed font-semibold">
                    Anyone with a personal Google Account (<code className="bg-amber-100/50 text-amber-900 px-1 rounded">@gmail.com</code>) or an external Workspace account can be invited directly to spaces or direct messages.
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-amber-800 text-[11px] font-bold">
                    <Globe className="w-3.5 h-3.5 text-amber-600" /> Displays an "External" badge in Chat
                  </div>
                </div>
              </div>
            </div>

            {/* Guide Card 2: Concrete Checklist */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Step-by-Step Connection Checklist</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-800 shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Enable External Collaboration (Google Workspace Admin)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      To connect external users, your company's Google Workspace Administrator must configure settings in the **Google Admin Console**:
                      <br />
                      <span className="font-semibold text-slate-700">Apps &gt; Google Workspace &gt; Google Chat &gt; External Chat Settings &gt; On (Allow people outside your organization)</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-800 shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Create a New Space allowing External Members</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      When creating a room/space in Google Chat, ensure the **"Allow people outside your organization to join"** toggle is checked. (Note: Google prevents changing this setting after the space is created).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-800 shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Invite Members using their Full Emails</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      In the newly created Space, click **Manage Members &gt; Add People**. Type the external user's full Gmail address (e.g., <code className="bg-slate-100 px-1 rounded text-slate-800 font-mono">partner@gmail.com</code>). They will receive an invitation in their personal Google Chat inbox.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Shortcuts & Workspace Controls */}
          <div className="space-y-6">
            
            {/* Quick Actions Panel */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Launch Google Chat</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                You can also open Google Chat directly in the official client to instantly configure spaces, coordinate channels, or launch DMs manually.
              </p>
              
              <div className="space-y-2">
                <a 
                  href="https://chat.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    Open Google Chat Web Client
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <a 
                  href="https://admin.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-600" />
                    Open Workspace Admin Console
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>

              {/* Quick Suggestion info */}
              <div className="p-4 bg-blue-50/50 border border-blue-100/60 rounded-2xl flex gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black uppercase text-blue-900 tracking-wider">Admin Permissions Required</h4>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    By default, Google Workspace restricts chat with non-domain users for safety. Following Step 1 on the left will lift this restriction for secure client operations.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct External Invites Help */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Quick Copy Workspace Template</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Send this email or chat message draft to help users outside your Workspace connect with you on Google Chat:
              </p>
              <div className="bg-slate-50 p-3.5 rounded-xl text-[11px] font-mono text-slate-600 leading-relaxed border border-slate-100 whitespace-pre-wrap select-all cursor-pointer" title="Click to copy template">
{`Subject: Invite to Pioneer Chat Space

Hello, 

We are using Google Chat for real-time collaboration. Since you are outside our internal domain, we've invited your email address to our shared Google Chat Space.

How to Join:
1. Go to chat.google.com
2. Log in with your email address
3. Look for the "Spaces" section and click "Join Space"
4. Accept the invitation to join our team channel.

Thank you!`}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* ==================== INTERACTIVE API SANDBOX ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: API Client Form Operations */}
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
                    Google API Connection Status
                  </h3>
                  <div className="text-xs text-slate-400 font-semibold flex flex-col gap-1">
                    <span>
                      {isAuthenticated 
                        ? 'Authorized: Ready to execute live Google Chat requests.' 
                        : 'Not connected. Connect your Google account to authorize the Google Chat API.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGcpChatAppNotice(!showGcpChatAppNotice)}
                      className="text-left text-blue-600 hover:text-blue-800 underline text-[11px] font-bold cursor-pointer inline-block mt-0.5"
                    >
                      {showGcpChatAppNotice ? 'Hide GCP Setup & 404 Guide' : 'Need help with GCP setup or 404 errors? View Guide'}
                    </button>
                  </div>
                </div>
              </div>

              {!isAuthenticated ? (
                <button
                  onClick={handleConnectGoogle}
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Connect Google Account
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={fetchSpaces}
                    disabled={loading}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    title="Reload Spaces"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Spaces
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

            {/* GCP Chat App 404 Guide Box */}
            {showGcpChatAppNotice && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <ShieldAlert className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                      Google Cloud Chat App Setup Required (Fixes 404 Error)
                    </h3>
                    <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                      Your Google API connection is authenticated, but the Google Chat API returned a <strong>404 Not Found (Chat app not found)</strong> error. This is a standard Google security requirement: you must register your app in your Google Cloud Console.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-amber-100 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Follow these 6 steps in your Google Cloud project to activate it:
                  </h4>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex gap-2.5 items-start text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                        1
                      </div>
                      <p className="leading-relaxed font-semibold">
                        Open the{' '}
                        <a 
                          href="https://console.cloud.google.com/marketplace/product/google/chat.googleapis.com" 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5"
                        >
                          Google Cloud Console Chat API Marketplace <ExternalLink className="w-3 h-3" />
                        </a>{' '}
                        and select your project. Click <strong>Enable</strong> if not already enabled.
                      </p>
                    </div>

                    <div className="flex gap-2.5 items-start text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                        2
                      </div>
                      <p className="leading-relaxed font-semibold">
                        Go to the{' '}
                        <a 
                          href="https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat" 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5"
                        >
                          Google Chat API Configuration Page <ExternalLink className="w-3 h-3" />
                        </a>{' '}
                        in your Google Cloud Console.
                      </p>
                    </div>

                    <div className="flex gap-2.5 items-start text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                        3
                      </div>
                      <div className="space-y-1">
                        <p className="leading-relaxed font-semibold">
                          Fill in the <strong>App Info</strong> fields:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <li>App name: <span className="text-slate-800 font-bold">Pioneer DMS</span></li>
                          <li>Avatar URL: <span className="text-slate-500 italic">(leave blank or any image URL)</span></li>
                          <li>Description: <span className="text-slate-800 font-bold">Pioneer Workspace Chat integration</span></li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-2.5 items-start text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                        4
                      </div>
                      <p className="leading-relaxed font-semibold">
                        Under <strong>Interactive features</strong>, enable the toggle if it's there. Under <strong>Functionality</strong>, check the boxes for <strong>"Receive 1:1 messages"</strong> and <strong>"Join spaces"</strong>.
                      </p>
                    </div>

                    <div className="flex gap-2.5 items-start text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                        5
                      </div>
                      <div className="space-y-1">
                        <p className="leading-relaxed font-semibold">
                          Under <strong>Connection settings</strong>, select <strong>App URL</strong> and enter a temporary placeholder (e.g., <code className="bg-slate-100 px-1 font-mono rounded text-slate-800">https://example.com/</code>). Google requires this to save.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2.5 items-start text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                        6
                      </div>
                      <p className="leading-relaxed font-semibold">
                        Click <strong>Save</strong> at the bottom. Once saved, click <strong>Reload Spaces</strong> in our app above to fetch your active channels!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGcpChatAppNotice(false)}
                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all"
                  >
                    Dismiss Guide
                  </button>
                  <a
                    href="https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    Open GCP Configuration
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Main Interactive Workspaces */}
            {isAuthenticated && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Panel 1: Create a New Shared Space */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">Create Live Chat Space</h4>
                  </div>
                  
                  <form onSubmit={handleCreateSpace} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Space Display Name</label>
                      <input 
                        type="text"
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        placeholder="e.g., Pioneer Logistics & Procurement"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={loading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !newSpaceName.trim()}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4.5 h-4.5" />}
                      Create Space
                    </button>
                  </form>
                </div>

                {/* Panel 2: Send Message to Selected Space */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                    <Send className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">Post Message</h4>
                  </div>
                  
                  <form onSubmit={handleSendMessage} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-bold block">Target Space</label>
                      <select
                        value={selectedSpaceId}
                        onChange={(e) => setSelectedSpaceId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading || spaces.length === 0}
                      >
                        {spaces.length === 0 ? (
                          <option>No spaces available. Create one first!</option>
                        ) : (
                          spaces.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.displayName || s.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Message Text</label>
                      <input 
                        type="text"
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        placeholder="Say hello to everyone..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={loading || !selectedSpaceId}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !selectedSpaceId || !welcomeMessage.trim()}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Message
                    </button>
                  </form>
                </div>

                {/* Panel 3: Invite Users & Connect Collaborators */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4 md:col-span-2">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">Connect & Add Users (Both Internal & External)</h4>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Add members directly via email. Select any of your internal system users, or type any personal Google email address (<code className="bg-slate-50 px-1 text-slate-800">@gmail.com</code>) to invite others outside your portal!
                  </p>

                  <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block font-bold">Target Space</label>
                      <select
                        value={selectedSpaceId}
                        onChange={(e) => setSelectedSpaceId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                        disabled={loading || spaces.length === 0}
                      >
                        {spaces.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.displayName || s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block font-bold">Member Email</label>
                      <div className="relative">
                        <input 
                          type="email"
                          value={memberEmail}
                          onChange={(e) => setMemberEmail(e.target.value)}
                          placeholder="partner@gmail.com or coworker@yourdomain.com"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          disabled={loading || !selectedSpaceId}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !selectedSpaceId || !memberEmail.trim()}
                      className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Add Member
                    </button>
                  </form>

                  {/* List of shortcut system employee email selection */}
                  <div className="pt-2">
                    <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block font-bold mb-2">Or select from internal employees:</label>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1.5 border border-slate-100 rounded-xl bg-slate-50/50">
                      {employees.filter(e => e.email).slice(0, 15).map((emp, empIdx) => (
                        <button
                          key={empIdx}
                          type="button"
                          onClick={() => setMemberEmail(emp.email)}
                          className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          {emp.name} ({emp.email})
                        </button>
                      ))}
                      {employees.filter(e => e.email).length === 0 && (
                        <span className="text-[10px] text-slate-400 font-semibold italic p-1">No employee records contain email addresses currently.</span>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* Right Column: Live Console & Logs */}
          <div className="space-y-6">
            
            {/* Live API Console logs */}
            <div className="bg-slate-950 text-slate-350 rounded-3xl p-6 font-mono space-y-4 border border-slate-800 shadow-lg min-h-[350px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-200">Google Chat API Console</span>
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
                    <p className="text-slate-600 italic">No events or requests logged yet. Authenticate or create a space to view live logs.</p>
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

            {/* Quick deep link instructions */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Troubleshooting Connections</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                If the Google Workspace API denies direct programmatic member additions due to high-security policies (which restrict apps from auto-adding external guests), use the <strong>User Connection Guide</strong> to manually input invite emails directly inside the Google Chat client.
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
