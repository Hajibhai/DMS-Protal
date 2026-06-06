import React, { useState } from 'react';
import { Video, Loader2, X, ExternalLink } from 'lucide-react';
import { createGoogleMeetSpace } from '../services/googleMeetService';
import { loginWithGoogle } from '../firebase';

interface GoogleMeetGeneratorProps {
  meetLink: string | undefined;
  onChange: (link: string | undefined) => void;
}

export const GoogleMeetGenerator: React.FC<GoogleMeetGeneratorProps> = ({ meetLink, onChange }) => {
  const [loading, setLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGenerate = async (token?: string) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const result = await createGoogleMeetSpace(token);
      onChange(result.meetingUri);
      setStatusMessage('Google Meet link generated successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_EXPIRED') {
        setShowConnectModal(true);
      } else {
        console.error(err);
        setStatusMessage(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAndGenerate = async () => {
    setShowConnectModal(false);
    setLoading(true);
    setStatusMessage('Connecting Google Account...');
    try {
      await loginWithGoogle();
      await handleGenerate();
    } catch (err: any) {
      console.error('Connection failed:', err);
      setStatusMessage(`Google connection failed: ${err.message || 'Cancelled'}`);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Google Meet Integration</h4>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">Video Sync Room</p>
          </div>
        </div>
        
        {meetLink && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-red-500 rounded-lg transition-all"
            title="Remove Meet Link"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {meetLink ? (
        <div className="flex items-center justify-between p-2 bg-emerald-50/50 border border-emerald-150 rounded-xl">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">Meeting Secured</span>
            <span className="text-xs font-bold text-slate-700 truncate block">{meetLink}</span>
          </div>
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Join Space
          </a>
        </div>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleGenerate()}
          className="w-full py-2.5 border border-dashed border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Generating Space...
            </>
          ) : (
            <>
              <Video className="w-4 h-4 text-emerald-600" />
              Generate Google Meet Space
            </>
          )}
        </button>
      )}

      {statusMessage && (
        <p className="text-[10px] font-bold text-slate-500 text-center animate-pulse">{statusMessage}</p>
      )}

      {showConnectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-center space-y-4 animate-in zoom-in-95 duration-200 text-slate-800">
            <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Video className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Authorize Google Meet</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Pioneer DMS Portal needs permission to create Google Meet links on behalf of your Google Account.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnectAndGenerate}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Connect & Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
