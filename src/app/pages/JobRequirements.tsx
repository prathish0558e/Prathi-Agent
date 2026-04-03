import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { Briefcase, DollarSign, MapPin, Target, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { SearchableMultiSelect } from '../components/SearchableMultiSelect';
import { globalRoleCatalog, globalSkillCatalog } from '../data/jobTaxonomy';
import { BottomNav } from '../components/BottomNav';
import type { JobType, SalaryFrequency, JobRequirements } from '../types/profile';

interface SelectOption {
  value: string;
  label: string;
}

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
];

const SALARY_FREQUENCIES: { value: SalaryFrequency; label: string }[] = [
  { value: 'yearly', label: 'Per Year' },
  { value: 'monthly', label: 'Per Month' },
  { value: 'hourly', label: 'Per Hour' },
];

export function JobRequirements() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const requirements = profile?.jobRequirements;

  const [minSalary, setMinSalary] = useState<string>(requirements?.minSalary?.toString() ?? '');
  const [maxSalary, setMaxSalary] = useState<string>(requirements?.maxSalary?.toString() ?? '');
  const [salaryFrequency, setSalaryFrequency] = useState<SalaryFrequency>(requirements?.salaryFrequency ?? 'yearly');
  const [jobTypes, setJobTypes] = useState<JobType[]>(requirements?.jobTypes ?? ['full-time']);
  const [includeInternships, setIncludeInternships] = useState(requirements?.includeInternships ?? false);
  const [includeRemote, setIncludeRemote] = useState(requirements?.includeRemote ?? true);
  const [preferredLocation, setPreferredLocation] = useState(requirements?.preferredLocation ?? '');
  const [minExperienceYears, setMinExperienceYears] = useState<string>(requirements?.minExperienceYears?.toString() ?? '0');
  const [maxExperienceYears, setMaxExperienceYears] = useState<string>(requirements?.maxExperienceYears?.toString() ?? '50');
  const [targetCompanies, setTargetCompanies] = useState<string>(requirements?.targetCompanies?.join(', ') ?? '');
  const [excludeCompanies, setExcludeCompanies] = useState<string>(requirements?.excludeCompanies?.join(', ') ?? '');
  const [requiredSkills, setRequiredSkills] = useState<string[]>(requirements?.requiredSkills ?? []);
  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>(requirements?.niceToHaveSkills ?? []);
  const [noticeRequired, setNoticeRequired] = useState(requirements?.noticeRequired ?? false);
  const [availableFromDate, setAvailableFromDate] = useState<string>(requirements?.availableFromDate ?? '');
  const [error, setError] = useState('');

  const skillOptions: SelectOption[] = globalSkillCatalog.allSkills.map((skill) => ({
    value: skill,
    label: skill,
  }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!profile) {
      setError('Profile not loaded. Please try again.');
      return;
    }

    const minSalaryNum = minSalary ? parseInt(minSalary, 10) : null;
    const maxSalaryNum = maxSalary ? parseInt(maxSalary, 10) : null;

    if (minSalaryNum !== null && maxSalaryNum !== null && minSalaryNum > maxSalaryNum) {
      setError('Minimum salary cannot be greater than maximum salary.');
      return;
    }

    const minExpNum = parseInt(minExperienceYears, 10) || 0;
    const maxExpNum = parseInt(maxExperienceYears, 10) || 50;

    if (minExpNum > maxExpNum) {
      setError('Minimum experience cannot be greater than maximum experience.');
      return;
    }

    const finalJobTypes: JobType[] = includeInternships
      ? Array.from(new Set([...jobTypes, 'internship']))
      : jobTypes.filter((t) => t !== 'internship');

    const updatedProfile = {
      ...profile,
      jobRequirements: {
        minSalary: minSalaryNum,
        maxSalary: maxSalaryNum,
        salaryFrequency,
        jobTypes: finalJobTypes,
        includeInternships,
        includeRemote,
        preferredLocation,
        minExperienceYears: minExpNum,
        maxExperienceYears: maxExpNum,
        targetCompanies: targetCompanies
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        excludeCompanies: excludeCompanies
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        requiredSkills,
        niceToHaveSkills,
        noticeRequired,
        availableFromDate: availableFromDate || null,
      },
    };

    updateProfile(updatedProfile);
    navigate('/', { replace: true });
  };

  return (
    <div className="app-shell pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Briefcase className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide">JOB REQUIREMENTS</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">What You're Looking For</h1>
          <p className="text-sm text-muted-foreground mt-1">Define your ideal job criteria, salary expectations, and work preferences.</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Job Types Section */}
          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">Job Types</label>
            <div className="space-y-2">
              {JOB_TYPES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jobTypes.includes(value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setJobTypes([...jobTypes, value]);
                      } else {
                        setJobTypes(jobTypes.filter((t) => t !== value));
                      }
                    }}
                    className="w-4 h-4 rounded border-border bg-input-background text-primary cursor-pointer"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Internships */}
          <div className="app-surface p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInternships}
                onChange={(e) => setIncludeInternships(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-input-background text-primary cursor-pointer"
              />
              <span className="text-sm font-semibold text-foreground">Include Internship Opportunities</span>
            </label>
          </div>

          {/* Remote Work */}
          <div className="app-surface p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRemote}
                onChange={(e) => setIncludeRemote(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-input-background text-primary cursor-pointer"
              />
              <span className="text-sm font-semibold text-foreground">Include Remote Work</span>
            </label>
          </div>

          {/* Salary Range */}
          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 block">
              <DollarSign className="w-4 h-4 text-primary" />
              Salary Range
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min Salary"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max Salary"
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <select
                value={salaryFrequency}
                onChange={(e) => setSalaryFrequency(e.target.value as SalaryFrequency)}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
              >
                {SALARY_FREQUENCIES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Experience Level */}
          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 block">
              <Users className="w-4 h-4 text-primary" />
              Required Experience (Years)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={minExperienceYears}
                onChange={(e) => setMinExperienceYears(e.target.value)}
                className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
              />
              <input
                type="number"
                min="0"
                value={maxExperienceYears}
                onChange={(e) => setMaxExperienceYears(e.target.value)}
                className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Skills */}
          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">Required Skills</label>
            <SearchableMultiSelect
              options={skillOptions}
              selected={requiredSkills}
              onSelect={setRequiredSkills}
              placeholder="Select required skills..."
            />
          </div>

          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">Nice-to-Have Skills</label>
            <SearchableMultiSelect
              options={skillOptions}
              selected={niceToHaveSkills}
              onSelect={setNiceToHaveSkills}
              placeholder="Select nice-to-have skills..."
            />
          </div>

          {/* Companies */}
          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 block">
              <Target className="w-4 h-4 text-primary" />
              Target Companies
            </label>
            <textarea
              value={targetCompanies}
              onChange={(e) => setTargetCompanies(e.target.value)}
              placeholder="Enter company names, separated by commas (e.g., Google, Microsoft, Apple)"
              className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none resize-none min-h-16"
            />
          </div>

          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">Companies to Avoid</label>
            <textarea
              value={excludeCompanies}
              onChange={(e) => setExcludeCompanies(e.target.value)}
              placeholder="Enter company names to avoid, separated by commas"
              className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none resize-none min-h-16"
            />
          </div>

          {/* Location */}
          <div className="app-surface p-4">
            <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 block">
              <MapPin className="w-4 h-4 text-primary" />
              Preferred Location (for office visits)
            </label>
            <input
              type="text"
              value={preferredLocation}
              onChange={(e) => setPreferredLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA or Leave empty for no preference"
              className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Availability */}
          <div className="app-surface p-4 space-y-3">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Available From (Optional)</label>
              <input
                type="date"
                value={availableFromDate || ''}
                onChange={(e) => setAvailableFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={noticeRequired}
                onChange={(e) => setNoticeRequired(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-input-background text-primary cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">Notice required from current employer</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-95 transition-opacity"
          >
            Save Job Requirements
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
