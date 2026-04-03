import { Briefcase, MapPin, Clock, Shield, Star } from 'lucide-react';
import { JobApplicationEmail } from './JobApplicationEmail';

interface JobCardAdvancedProps {
  company: string;
  role: string;
  location: string;
  type: string;
  logo: string;
  source?: string;
  matchPercentage: number;
  interviewChance?: number;
  securityScore?: number;
  verified?: boolean;
  requiresResumeTailor?: boolean;
  applyUrl?: string | null;
  salary?: string | null;
  hrEmail?: string | null;
  hrEmailConfidence?: number;
  hrEmailSource?: 'job-posting' | 'domain-guess' | 'unavailable';
  hrEmailStatus?: 'verified' | 'unverified' | 'unavailable';
  hrEmailAvailable?: boolean;
  isNew?: boolean;
  userEmail?: string;
  userFullName?: string;
  getGoogleAccessToken?: () => Promise<string | null>;
  onTailorResume?: () => void;
  onRequestHrMail?: () => void;
  onApplicationSent?: () => void;
}

export function JobCardAdvanced({ 
  company, 
  role, 
  location, 
  type, 
  logo, 
  source = 'Company Career Page',
  matchPercentage, 
  interviewChance = 0,
  securityScore = 0,
  verified = false,
  requiresResumeTailor = false,
  applyUrl = null,
  salary = null,
  hrEmail = null,
  hrEmailConfidence = 0,
  hrEmailSource = 'unavailable',
  hrEmailStatus = 'unavailable',
  hrEmailAvailable = false,
  isNew = false,
  userEmail = '',
  userFullName = '',
  getGoogleAccessToken,
  onTailorResume,
  onRequestHrMail,
  onApplicationSent,
}: JobCardAdvancedProps) {
  return (
    <div className="relative app-surface p-4 transition-shadow duration-200 hover:shadow-lg">
      {/* NEW badge */}
      {isNew && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-200 text-amber-900 text-[10px] font-black px-3 py-0.5 rounded-full shadow animate-pulse z-10 tracking-widest">
          ✦ NEW
        </div>
      )}
      {/* Match percentage badge */}
      <div className="absolute -top-2 -right-2 bg-emerald-200 text-emerald-900 text-xs font-semibold px-3 py-1 rounded-full shadow">
        {matchPercentage}% Match
      </div>
      
      {/* Verified badge */}
      {verified && (
        <div className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow">
          <Shield className="w-3 h-3" />
          VERIFIED
        </div>
      )}
      
      <div className="flex items-start gap-4">
        {/* Company Logo */}
        <div className="w-14 h-14 rounded-lg bg-secondary border border-border flex items-center justify-center text-2xl text-foreground/70 flex-shrink-0">
          {logo}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Company name */}
          <h3 className="text-foreground font-semibold text-lg mb-0.5">{company}</h3>
          
          {/* Role */}
          <p className="text-primary text-sm mb-2 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            {role}
          </p>
          
          {/* Location and Type */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {type}
            </span>
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            Source: <span className="text-primary">{source}</span>
          </div>

          <div className="text-xs text-emerald-700 mb-2">
            Salary: {salary || 'Salary not disclosed'}
          </div>

          {/* HR Email Status */}
          <div className="mb-2">
            {hrEmailAvailable ? (
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-full px-2 py-0.5">
                ✓ Verified HR email ({Math.round(hrEmailConfidence)}%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] bg-muted border border-border text-muted-foreground rounded-full px-2 py-0.5">
                {hrEmailStatus === 'unverified' ? '△ HR email low confidence' : '✗ HR email not available'}
              </span>
            )}
          </div>

          {hrEmailSource === 'job-posting' ? (
            <div className="mb-2 text-[11px] text-primary">Source: extracted from exact job posting</div>
          ) : null}

          {interviewChance > 0 && (
            <div className="mb-2 text-xs text-emerald-700 font-semibold">
              Interview chance estimate: {interviewChance}%
            </div>
          )}

          {/* Security Score */}
          {securityScore > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Security Score:</span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < securityScore
                        ? 'text-emerald-500 fill-emerald-500'
                        : 'text-muted-foreground/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onTailorResume}
              className="bg-secondary border border-border text-secondary-foreground text-xs py-2 rounded-lg transition-all duration-200 font-semibold hover:shadow-sm"
            >
              Tailor Resume For This Job
            </button>
            <button
              className="bg-primary text-primary-foreground text-xs py-2 rounded-lg transition-all duration-200 shadow-[0_10px_24px_rgba(15,61,62,0.2)] hover:opacity-95 font-semibold"
              onClick={() => {
                if (applyUrl) {
                  window.open(applyUrl, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              {applyUrl ? 'Open Job Post' : 'No Link'}
            </button>
          </div>

          {/* Email Application Button */}
          {hrEmailAvailable && userEmail && userFullName && getGoogleAccessToken ? (
            <div className="mt-2">
              <JobApplicationEmail
                jobTitle={role}
                company={company}
                contactEmail={hrEmail}
                userEmail={userEmail}
                userFullName={userFullName}
                getGoogleAccessToken={getGoogleAccessToken}
                onSuccess={onApplicationSent}
              />
            </div>
          ) : (
            <button
              onClick={onRequestHrMail}
              disabled={!hrEmailAvailable}
              className={`w-full mt-2 text-xs py-2 rounded-lg transition-all duration-200 font-semibold ${
                hrEmailAvailable
                  ? 'bg-secondary border border-emerald-300/40 text-emerald-700 hover:border-emerald-300/70'
                  : 'bg-muted border border-border text-muted-foreground cursor-not-allowed'
              }`}
            >
              {hrEmailAvailable ? 'Send HR Mail' : 'HR Email Not Available'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
