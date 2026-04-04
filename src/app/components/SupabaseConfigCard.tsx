import { FormEvent, useState } from 'react';
import { AlertCircle, Check, Copy } from 'lucide-react';
import { saveSupabaseRuntimeConfig, getSupabaseRuntimeConfig } from '../lib/runtimeConfig';

interface SupabaseConfigCardProps {
  onSaved?: () => void;
}

export function SupabaseConfigCard({ onSaved }: SupabaseConfigCardProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const currentConfig = getSupabaseRuntimeConfig();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);

    const trimmedUrl = supabaseUrl.trim();
    const trimmedAnonKey = supabaseAnonKey.trim();

    if (!trimmedUrl.startsWith('https://')) {
      setError('Supabase URL must start with https://');
      return;
    }

    if (!trimmedAnonKey) {
      setError('Supabase anon key is required.');
      return;
    }

    saveSupabaseRuntimeConfig(trimmedUrl, trimmedAnonKey);
    setSaved(true);
    setTimeout(() => onSaved?.(), 500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const extractProjectRef = (url: string) => {
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match?.[1] || 'unknown';
  };

  const projectRef = extractProjectRef(currentConfig.supabaseUrl || supabaseUrl);

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/70 p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          Supabase setup required for Google login
        </p>
        <p className="text-xs text-amber-700/80">Enter your Supabase project URL and anon key below, or follow the setup guide.</p>
      </div>

      <input
        type="url"
        value={supabaseUrl || currentConfig.supabaseUrl}
        onChange={(event) => setSupabaseUrl(event.target.value)}
        placeholder="https://your-project-ref.supabase.co"
        className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 text-sm text-foreground placeholder:text-muted-foreground"
      />

      <input
        type="text"
        value={supabaseAnonKey || currentConfig.supabaseAnonKey}
        onChange={(event) => setSupabaseAnonKey(event.target.value)}
        placeholder="Supabase anon public key"
        className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 text-sm font-mono text-xs text-foreground placeholder:text-muted-foreground"
      />

      {error && <p className="text-xs text-red-700 bg-red-100 border border-red-200 rounded px-2 py-1">{error}</p>}
      {saved && <p className="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-2 py-1 flex items-center gap-1"><Check className="w-3 h-3" /> Saved! Reload to apply changes.</p>}

      <div className="space-y-2">
        <button type="submit" className="w-full bg-primary text-primary-foreground font-semibold rounded-lg py-2 text-sm hover:opacity-95 transition-opacity">
          Save Supabase Config
        </button>

        <details className="bg-secondary/70 border border-border rounded-lg p-3 text-xs">
          <summary className="cursor-pointer text-foreground font-semibold mb-2">📋 Setup Verification Checklist</summary>
          
          <div className="space-y-3 mt-3 text-muted-foreground">
            <div className="bg-card rounded p-2 border border-border/70">
              <p className="font-semibold text-foreground mb-2">Your Supabase Project Info:</p>
              <p className="text-xs mb-1">
                Project Ref: <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground">{projectRef}</code>
                <button onClick={() => copyToClipboard(projectRef)} className="ml-2 text-primary hover:text-foreground text-xs">
                  {' '}<Copy className="w-2.5 h-2.5 inline" /> Copy
                </button>
              </p>
              <p className="text-xs">
                Project URL: <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground break-all text-[10px]">https://{projectRef}.supabase.co</code>
              </p>
            </div>

            <ol className="space-y-2">
              <li className="bg-card p-2 rounded border border-border/60">
                <p className="font-semibold text-foreground">1. Go to Supabase Google Provider</p>
                <p className="text-xs mt-1">Visit: <code className="bg-secondary px-1 py-0.5 rounded text-foreground">https://{projectRef}.supabase.co/project/settings/auth-providers</code></p>
                <button onClick={() => copyToClipboard(`https://${projectRef}.supabase.co/project/settings/auth-providers`)} className="mt-1 text-xs text-primary hover:text-foreground">
                  📋 Copy URL
                </button>
              </li>

              <li className="bg-card p-2 rounded border border-border/60">
                <p className="font-semibold text-foreground">2. Enable Google Provider</p>
                <p className="text-xs mt-1">Toggle "Enabled" to ON (green)</p>
              </li>

              <li className="bg-card p-2 rounded border border-border/60">
                <p className="font-semibold text-foreground">3. Add Redirect URLs</p>
                <p className="text-xs mt-1">In "Additional Redirect URLs", add:</p>
                <div className="mt-1 space-y-1 text-xs">
                  <code className="block bg-secondary px-1.5 py-1 rounded text-emerald-700 break-all">https://prathi.tech/#/auth/callback</code>
                  <code className="block bg-secondary px-1.5 py-1 rounded text-emerald-700 break-all">com.careersentinel.ai://auth/callback</code>
                </div>
                <p className="text-xs mt-2 text-muted-foreground">
                  Google Cloud "Authorized redirect URIs" should include only the Supabase callback: <code className="bg-secondary px-1 py-0.5 rounded text-foreground break-all">https://{projectRef}.supabase.co/auth/v1/callback</code>.
                </p>
              </li>

              <li className="bg-card p-2 rounded border border-border/60">
                <p className="font-semibold text-foreground">4. Add Google Credentials</p>
                <p className="text-xs mt-1">Get from Google Cloud Console and paste:</p>
                <p className="text-xs mt-2">- Client ID (should end with .apps.googleusercontent.com)</p>
                <p className="text-xs">- Client Secret (should start with goo_...)</p>
              </li>

              <li className="bg-card p-2 rounded border border-border/60">
                <p className="font-semibold text-foreground">5. Save and Wait</p>
                <p className="text-xs mt-1">Click Save, then wait 1-2 minutes for changes to propagate</p>
              </li>
            </ol>

            <div className="bg-blue-100 border border-blue-200 p-2 rounded">
              <p className="text-xs text-blue-800">
                📚 <strong>Need more help?</strong> Open <code className="bg-secondary px-1 py-0.5 rounded text-blue-800 text-[10px]">guidelines/OAuth_Setup_Verification.md</code> for complete setup guide
              </p>
            </div>
          </div>
        </details>
      </div>
    </form>
  );
}
