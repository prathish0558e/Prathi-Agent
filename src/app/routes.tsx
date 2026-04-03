import { createHashRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { AIResume } from "./pages/AIResume";
import { EmailLogs } from "./pages/EmailLogs";
import { Login } from './pages/Login';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Onboarding } from './pages/Onboarding';
import { CreateAccount } from './pages/CreateAccount';
import { AuthCallback } from './pages/AuthCallback';
import { LocalTracker } from './pages/LocalTracker';
import { AIJobWatch } from './pages/AIJobWatch';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsAndConditions } from './pages/TermsAndConditions';
import { Settings } from './pages/Settings';
import { JobRequirements } from './pages/JobRequirements';
import { Automation } from './pages/Automation';
import { CompanyFinder } from './pages/CompanyFinder';
import { UniversityAdmission } from './pages/UniversityAdmission';

export const router = createHashRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/create-account',
    Component: CreateAccount,
  },
  {
    path: '/auth/callback',
    Component: AuthCallback,
  },
  {
    path: '/privacy-policy',
    Component: PrivacyPolicy,
  },
  {
    path: '/terms-and-conditions',
    Component: TermsAndConditions,
  },
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <Onboarding />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/local-tracker',
    element: (
      <ProtectedRoute>
        <LocalTracker />
      </ProtectedRoute>
    ),
  },
  {
    path: '/ai-job-watch',
    element: (
      <ProtectedRoute>
        <AIJobWatch />
      </ProtectedRoute>
    ),
  },
  {
    path: "/jobs",
    element: (
      <ProtectedRoute>
        <Jobs />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ai-resume",
    element: (
      <ProtectedRoute>
        <AIResume />
      </ProtectedRoute>
    ),
  },
  {
    path: "/email-logs",
    element: (
      <ProtectedRoute>
        <EmailLogs />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/job-requirements",
    element: (
      <ProtectedRoute>
        <JobRequirements />
      </ProtectedRoute>
    ),
  },
  {
    path: "/automation",
    element: (
      <ProtectedRoute>
        <Automation />
      </ProtectedRoute>
    ),
  },
  {
    path: "/company-finder",
    element: (
      <ProtectedRoute>
        <CompanyFinder />
      </ProtectedRoute>
    ),
  },
  {
    path: "/university-admission",
    element: (
      <ProtectedRoute>
        <UniversityAdmission />
      </ProtectedRoute>
    ),
  },
]);
