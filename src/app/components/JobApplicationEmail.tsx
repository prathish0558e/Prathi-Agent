import { Mail, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { runtimeConfig } from '../lib/runtimeConfig';

interface JobApplicationEmailProps {
  jobTitle: string;
  company: string;
  contactEmail: string | null;
  userEmail: string;
  userFullName: string;
  onSuccess?: () => void;
  getGoogleAccessToken: () => Promise<string | null>;
}

interface ApplicationEmailTemplate {
  subject: string;
  body: string;
}

export function JobApplicationEmail({
  jobTitle,
  company,
  contactEmail,
  userEmail,
  userFullName,
  onSuccess,
  getGoogleAccessToken,
}: JobApplicationEmailProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customEmail, setCustomEmail] = useState(contactEmail || '');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');

  if (!contactEmail && !customEmail) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        No contact email available
      </div>
    );
  }

  const generateTemplate = (): ApplicationEmailTemplate => {
    const greeting = `Dear Hiring Team at ${company}`;
    const subject = `Application for ${jobTitle} Position`;
    const body = `${greeting},

I am writing to express my strong interest in the ${jobTitle} position at ${company}. With my skills and experience, I am confident that I can make a valuable contribution to your team.

I have attached my resume for your review. Please feel free to reach out if you need any additional information.

Looking forward to hearing from you.

Best regards,
${userFullName}
${userEmail}`;

    return { subject, body };
  };

  const handleSendApplication = async () => {
    if (!customEmail) {
      setError('Please enter a contact email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        setError('Google authentication required. Please connect Gmail access in Settings.');
        setIsLoading(false);
        return;
      }

      const template = generateTemplate();
      const response = await fetch(`${runtimeConfig.apiBaseUrl}/email/send-job-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          to: customEmail,
          subject: customSubject || template.subject,
          body: customBody || template.body,
          userEmail,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to send application email');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send application email');
    } finally {
      setIsLoading(false);
    }
  };

  const template = generateTemplate();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={isLoading || success}
        className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-all disabled:opacity-50"
      >
        <Mail className="w-4 h-4" />
        <span>Send Application</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="app-surface text-foreground rounded-2xl max-w-md w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/70 p-4 flex justify-between items-center">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Send Application Email
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {success && (
                <div className="bg-emerald-100 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Application sent successfully!</span>
                </div>
              )}

              {error && (
                <div className="bg-red-100 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="hr@company.com"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Subject</label>
                <input
                  type="text"
                  value={customSubject || template.subject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder={template.subject}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Message</label>
                <textarea
                  value={customBody || template.body}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder={template.body}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none min-h-24"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground mt-1">Your resume will be attached automatically.</p>
              </div>

              <button
                onClick={handleSendApplication}
                disabled={isLoading || !customEmail}
                className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send with Resume</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
