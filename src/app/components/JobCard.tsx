import { Briefcase, MapPin, Clock } from 'lucide-react';

interface JobCardProps {
  company: string;
  role: string;
  location: string;
  type: string;
  logo: string;
  matchPercentage: number;
}

export function JobCard({ company, role, location, type, logo, matchPercentage }: JobCardProps) {
  return (
    <div className="relative app-surface p-4 transition-shadow duration-200 hover:shadow-lg">
      {/* Match percentage badge */}
      <div className="absolute -top-2 -right-2 rounded-full bg-emerald-200 text-emerald-900 text-xs font-semibold px-3 py-1 shadow">
        {matchPercentage}% Match
      </div>
      
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
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {type}
            </span>
          </div>
          
          {/* Apply Now button */}
          <button className="w-full bg-primary text-primary-foreground text-sm py-2 rounded-lg transition-all duration-200 shadow-[0_12px_24px_rgba(15,61,62,0.2)] hover:opacity-95 font-semibold">
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}