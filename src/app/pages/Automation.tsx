import { Bot, Mail, Send, Shield, Server } from 'lucide-react';
import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../auth/AuthContext';

export function Automation() {
  const { profile, updateProfile } = useAuth();
  const [mailAutopilot, setMailAutopilot] = useState(profile?.wantsMailAutomation ?? false);
  const [autoApply, setAutoApply] = useState(profile?.wantsAutoApply ?? false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (profile) {
      updateProfile({
        ...profile,
        wantsAutoApply: autoApply,
        wantsMailAutomation: mailAutopilot,
      });
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="app-shell pb-24">
      <div className="relative max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Bot className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide">AUTOMATION CONTROL</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Autopilot</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure approval-based automation behavior. AI and OAuth secrets stay on the backend.</p>
        </div>

        <div className="app-surface p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Backend Secret Vault</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gemini keys, Google client secrets, and mail tokens must be configured on the server only. They are intentionally not shown in the app UI.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMailAutopilot((value) => !value)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
              mailAutopilot ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-border bg-secondary text-secondary-foreground'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Auto Reply for Interview Emails</span>
              <span className="text-xs">{mailAutopilot ? 'ON' : 'OFF'}</span>
            </div>
          </button>

          <button
            onClick={() => setAutoApply((value) => !value)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
              autoApply ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-border bg-secondary text-secondary-foreground'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Auto Apply for 85%+ Match Jobs</span>
              <span className="text-xs">{autoApply ? 'ON' : 'OFF'}</span>
            </div>
          </button>

          <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-primary" /> Safety Guard</p>
            <p>Automation will run only on verified jobs, approved templates, and backend-controlled secrets.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-4 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg"
        >
          Save Automation Settings
        </button>
        {saved ? <p className="text-xs text-emerald-700 mt-2">Automation preferences updated.</p> : null}
      </div>
      <BottomNav />
    </div>
  );
}
