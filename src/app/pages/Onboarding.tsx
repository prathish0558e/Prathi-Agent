import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles, UserRoundSearch, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PhoneNumberField } from '../components/PhoneNumberField';
import { SearchableMultiSelect } from '../components/SearchableMultiSelect';
import { SearchableSingleSelect } from '../components/SearchableSingleSelect';
import { globalRoleCatalog, globalSkillCatalog } from '../data/jobTaxonomy';

interface SelectOption {
  value: string;
  label: string;
}

type GeoModule = typeof import('country-state-city');

export function Onboarding() {
  const { email, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [phoneCountryCode, setPhoneCountryCode] = useState(profile?.phoneCountryCode ?? '+91');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [experienceLevel, setExperienceLevel] = useState(profile?.experienceLevel ?? 'Fresher');
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(profile?.yearsOfExperience ?? 0);
  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.targetRoles ?? []);
  const [primarySkills, setPrimarySkills] = useState<string[]>(profile?.primarySkills ?? []);
  const [preferredCountryCode, setPreferredCountryCode] = useState(profile?.preferredCountryCode ?? '');
  const [preferredStateCode, setPreferredStateCode] = useState(profile?.preferredStateCode ?? '');
  const [preferredCityName, setPreferredCityName] = useState(profile?.preferredCityName ?? '');
  const [resumeFileName, setResumeFileName] = useState(profile?.resumeFileName ?? 'Resume not uploaded yet');
  const [resumeLastUpdated, setResumeLastUpdated] = useState(profile?.resumeLastUpdated ?? null);
  const [wantsAutoApply, setWantsAutoApply] = useState(profile?.wantsAutoApply ?? false);
  const [wantsMailAutomation, setWantsMailAutomation] = useState(profile?.wantsMailAutomation ?? false);
  const [error, setError] = useState('');
  const [geoModule, setGeoModule] = useState<GeoModule | null>(null);
  const [countries, setCountries] = useState<SelectOption[]>([]);
  const [states, setStates] = useState<SelectOption[]>([]);
  const [cities, setCities] = useState<SelectOption[]>([]);

  useEffect(() => {
    let isMounted = true;

    import('country-state-city').then((module) => {
      if (!isMounted) {
        return;
      }

      setGeoModule(module);
      setCountries(
        module.Country.getAllCountries().map((country) => ({ value: country.isoCode, label: country.name })),
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!geoModule || !preferredCountryCode) {
      setStates([]);
      setCities([]);
      return;
    }

    const nextStates = geoModule.State.getStatesOfCountry(preferredCountryCode).map((state) => ({
      value: state.isoCode,
      label: state.name,
    }));
    setStates(nextStates);

    const rawCities = preferredStateCode
      ? geoModule.City.getCitiesOfState(preferredCountryCode, preferredStateCode)
      : geoModule.City.getCitiesOfCountry(preferredCountryCode);

    const cityList = rawCities ?? [];
    const uniqueNames = Array.from(new Set(cityList.map((city) => city.name)));
    setCities(uniqueNames.map((name) => ({ value: name, label: name })));
  }, [geoModule, preferredCountryCode, preferredStateCode]);

  const selectedCountryName = countries.find((country) => country.value === preferredCountryCode)?.label ?? '';
  const selectedStateName = states.find((state) => state.value === preferredStateCode)?.label ?? '';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email) {
      return;
    }

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (phone.length < 7) {
      setError('Enter a valid phone number.');
      return;
    }

    if ((experienceLevel === 'Junior' || experienceLevel === 'Mid-Level') && yearsOfExperience < 1) {
      setError('For experienced profile, enter at least 1 year of experience.');
      return;
    }

    if (!targetRoles.length || !primarySkills.length) {
      setError('Select at least one role and one skill.');
      return;
    }

    if (!preferredCountryCode || !preferredCityName) {
      setError('Select country and city/district to continue.');
      return;
    }

    const locationLabel = [preferredCityName, selectedStateName, selectedCountryName]
      .filter(Boolean)
      .join(', ');

    updateProfile({
      fullName: fullName.trim(),
      email,
      phoneCountryCode,
      phone,
      experienceLevel,
      yearsOfExperience: experienceLevel === 'Fresher' || experienceLevel === 'Intern' ? 0 : yearsOfExperience,
      targetRoles,
      primarySkills,
      preferredLocations: locationLabel ? [locationLabel] : [],
      preferredCountryCode,
      preferredCountryName: selectedCountryName,
      preferredStateCode,
      preferredStateName: selectedStateName,
      preferredCityName,
      wantsAutoApply,
      wantsMailAutomation,
      resumeFileName,
      resumeLastUpdated,
      onboardingCompleted: true,
    });

    navigate('/', { replace: true });
  };

  return (
    <div className="app-shell px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <UserRoundSearch className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide">FIRST-TIME PROFILE SETUP</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Build Your Prathi Agent Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We collect your target roles, skills, and location once so login stays simple next time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="app-surface p-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Full name</label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full bg-input-background border border-border/70 rounded-lg px-3 py-2.5 outline-none focus:border-ring/70 focus:ring-2 focus:ring-ring/20 text-foreground"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Google account</label>
              <input
                value={email ?? ''}
                readOnly
                className="w-full bg-input-background border border-border/60 rounded-lg px-3 py-2.5 text-muted-foreground"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Phone number</label>
              <PhoneNumberField
                countryCode={phoneCountryCode}
                phoneNumber={phone}
                onCountryCodeChange={setPhoneCountryCode}
                onPhoneNumberChange={setPhone}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Experience level</label>
              <select
                value={experienceLevel}
                onChange={(event) => {
                  const nextLevel = event.target.value as typeof experienceLevel;
                  setExperienceLevel(nextLevel);
                  if (nextLevel === 'Fresher' || nextLevel === 'Intern') {
                    setYearsOfExperience(0);
                  }
                }}
                className="w-full bg-input-background border border-border/70 rounded-lg px-3 py-2.5 outline-none focus:border-ring/70 focus:ring-2 focus:ring-ring/20 text-foreground"
              >
                <option>Fresher</option>
                <option>Intern</option>
                <option>Junior</option>
                <option>Mid-Level</option>
              </select>
            </div>

            {experienceLevel === 'Junior' || experienceLevel === 'Mid-Level' ? (
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Years of experience</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={yearsOfExperience}
                  onChange={(event) => setYearsOfExperience(Number(event.target.value))}
                  className="w-full bg-input-background border border-border/70 rounded-lg px-3 py-2.5 outline-none focus:border-ring/70 focus:ring-2 focus:ring-ring/20 text-foreground"
                  placeholder="Example: 2"
                />
              </div>
            ) : null}
          </div>

          <div className="app-surface p-4 space-y-4">
            <SearchableMultiSelect
              label="Target roles"
              placeholder="Select target roles"
              options={globalRoleCatalog}
              selected={targetRoles}
              onChange={setTargetRoles}
            />

            <SearchableMultiSelect
              label="Primary skills"
              placeholder="Select key skills"
              options={globalSkillCatalog}
              selected={primarySkills}
              onChange={setPrimarySkills}
            />

            <SearchableSingleSelect
              label="Country"
              placeholder="Select country"
              options={countries}
              value={preferredCountryCode}
              onChange={(countryCode) => {
                setPreferredCountryCode(countryCode);
                setPreferredStateCode('');
                setPreferredCityName('');
              }}
            />

            <SearchableSingleSelect
              label="State / Region"
              placeholder={preferredCountryCode ? 'Select state/region' : 'Select country first'}
              options={states}
              value={preferredStateCode}
              onChange={(stateCode) => {
                setPreferredStateCode(stateCode);
                setPreferredCityName('');
              }}
            />

            <SearchableSingleSelect
              label="City / District"
              placeholder={preferredCountryCode ? 'Select city or district' : 'Select country first'}
              options={cities}
              value={preferredCityName}
              onChange={setPreferredCityName}
            />

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Resume vault</label>
              <label className="block border border-dashed border-border/70 rounded-lg p-4 bg-secondary/60 cursor-pointer hover:border-ring/50 transition-all">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    setResumeFileName(file.name);
                    setResumeLastUpdated(new Date().toLocaleString());
                  }}
                />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary border border-border/60 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Upload Resume</p>
                    <p className="text-xs text-muted-foreground">PDF or DOCX. File name is stored; secure cloud upload comes from backend.</p>
                  </div>
                </div>
              </label>
              <div className="mt-2 rounded-lg bg-secondary/70 border border-border/60 px-3 py-2 text-xs text-secondary-foreground">
                <p>
                  Current file: <span className="text-foreground font-semibold">{resumeFileName}</span>
                </p>
                <p>
                  Last updated: <span className="text-foreground">{resumeLastUpdated ?? 'Not uploaded yet'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="app-surface p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Automation preferences</p>
                <p className="text-xs text-muted-foreground">These are stored with your profile and later move to the secure server.</p>
              </div>
            </div>

            <label className="flex items-center justify-between text-sm">
              <span>Enable auto apply for high-match verified jobs</span>
              <input type="checkbox" checked={wantsAutoApply} onChange={(event) => setWantsAutoApply(event.target.checked)} />
            </label>

            <label className="flex items-center justify-between text-sm">
              <span>Enable interview mail automation</span>
              <input type="checkbox" checked={wantsMailAutomation} onChange={(event) => setWantsMailAutomation(event.target.checked)} />
            </label>

            <div className="rounded-lg bg-secondary/70 border border-border/60 p-3 text-xs text-secondary-foreground flex gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Production version should store this data in a secure server database so uninstall/reinstall does not lose your profile.</span>
            </div>
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button type="submit" className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3 shadow-[0_14px_28px_rgba(15,61,62,0.2)]">
            Save Profile and Continue
          </button>
        </form>
      </div>
    </div>
  );
}
