export function PrivacyPolicy() {
  return (
    <div className="app-shell px-4 py-8">
      <div className="max-w-2xl mx-auto app-surface p-6">
        <h1 className="text-2xl font-semibold mb-4 text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-4">Effective date: March 16, 2026</p>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>We collect only the minimum data required to provide job discovery, profile personalization, and optional Gmail automation features.</p>
          <p>Profile inputs (name, email, skills, target roles, preferred locations) are used to improve relevance of suggestions and resume tailoring workflows.</p>
          <p>If you enable Google sign-in and Gmail features, access tokens are used only for authorized actions you trigger in the app.</p>
          <p>Uploaded resumes are stored for your account workflows such as preview, resume tailoring, and application mail attachment.</p>
          <p>You can stop using automation features at any time from app controls. You may request account data deletion from the app administrator.</p>
          <p>We do not sell your personal data. We may update this policy as features evolve; revised versions will be published on this page.</p>
        </div>
      </div>
    </div>
  );
}
