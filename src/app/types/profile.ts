export type JobType = 'all' | 'full-time' | 'part-time' | 'contract' | 'internship' | 'temporary';
export type SalaryFrequency = 'yearly' | 'monthly' | 'hourly';

export interface JobRequirements {
  minSalary: number | null;
  maxSalary: number | null;
  salaryFrequency: SalaryFrequency;
  jobTypes: JobType[];
  includeInternships: boolean;
  includeRemote: boolean;
  preferredLocation: string;
  minExperienceYears: number;
  maxExperienceYears: number;
  targetCompanies: string[];
  excludeCompanies: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  noticeRequired: boolean;
  availableFromDate: string | null;
}

export interface CareerProfile {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  experienceLevel: 'Fresher' | 'Intern' | 'Junior' | 'Mid-Level';
  yearsOfExperience: number;
  targetRoles: string[];
  primarySkills: string[];
  preferredLocations: string[];
  preferredCountryCode: string;
  preferredCountryName: string;
  preferredStateCode: string;
  preferredStateName: string;
  preferredCityName: string;
  wantsAutoApply: boolean;
  wantsMailAutomation: boolean;
  resumeFileName: string;
  resumeLastUpdated: string | null;
  onboardingCompleted: boolean;
  jobRequirements?: JobRequirements;
  gmailConfigured?: boolean;
  gmailScopes?: string[];
}

export const emptyJobRequirements: JobRequirements = {
  minSalary: null,
  maxSalary: null,
  salaryFrequency: 'yearly',
  jobTypes: ['full-time'],
  includeInternships: false,
  includeRemote: true,
  preferredLocation: '',
  minExperienceYears: 0,
  maxExperienceYears: 50,
  targetCompanies: [],
  excludeCompanies: [],
  requiredSkills: [],
  niceToHaveSkills: [],
  noticeRequired: false,
  availableFromDate: null,
};

export const emptyCareerProfile: CareerProfile = {
  fullName: '',
  email: '',
  phoneCountryCode: '+91',
  phone: '',
  experienceLevel: 'Fresher',
  yearsOfExperience: 0,
  targetRoles: [],
  primarySkills: [],
  preferredLocations: [],
  preferredCountryCode: '',
  preferredCountryName: '',
  preferredStateCode: '',
  preferredStateName: '',
  preferredCityName: '',
  wantsAutoApply: false,
  wantsMailAutomation: false,
  resumeFileName: 'Resume not uploaded yet',
  resumeLastUpdated: null,
  onboardingCompleted: false,
  jobRequirements: emptyJobRequirements,
  gmailConfigured: false,
  gmailScopes: [],
};