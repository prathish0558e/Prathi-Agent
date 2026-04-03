import { useEffect, useMemo, useState } from 'react';
import { Compass, ExternalLink, Loader2, LocateFixed, MapPin, Phone, Search, ShieldCheck, Zap, Clock, Building2, Briefcase } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { QuickProfileMenu } from '../components/QuickProfileMenu';
import { SearchableSingleSelect } from '../components/SearchableSingleSelect';
import { useAuth } from '../auth/AuthContext';
import { runtimeConfig } from '../lib/runtimeConfig';
import type { JobOpportunity } from '../types/careerAgent';

interface LocalJobResult extends JobOpportunity {
  estimatedDistanceKm: number | null;
}

interface Coordinates {
  lat: number;
  lon: number;
}

interface NearbyCompanySpot {
  company: string;
  category: string;
  address: string;
  distanceKm: number;
  website: string | null;
  phone: string | null;
  mapsUrl: string;
  searchUrl: string;
}

type GeoModule = typeof import('country-state-city');

interface SelectOption {
  value: string;
  label: string;
}

type TrackerTab = 'companies' | 'part-time';

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (from: Coordinates, to: Coordinates) => {
  const earthRadiusKm = 6371;
  const latDiff = toRadians(to.lat - from.lat);
  const lonDiff = toRadians(to.lon - from.lon);

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lonDiff / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const geocodePlace = async (query: string): Promise<Coordinates | null> => {
  const normalized = query.trim();
  if (!normalized) {
    return null;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(normalized)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    const first = payload[0];
    return {
      lat: Number(first.lat),
      lon: Number(first.lon),
    };
  } catch {
    return null;
  }
};

export function LocalTracker() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TrackerTab>('companies');
  const [city, setCity] = useState('Chennai');
  const [stateCode, setStateCode] = useState('TN');
  const [radiusKm, setRadiusKm] = useState(75);
  const [keyword, setKeyword] = useState('part time');
  const [usePremiumMode, setUsePremiumMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<LocalJobResult[]>([]);
  const [nearbyCompanies, setNearbyCompanies] = useState<NearbyCompanySpot[]>([]);
  const [companyStatus, setCompanyStatus] = useState('');
  const [providerNote, setProviderNote] = useState('');
  const [originCoordinates, setOriginCoordinates] = useState<Coordinates | null>(null);
  const [geoModule, setGeoModule] = useState<GeoModule | null>(null);
  const [stateOptions, setStateOptions] = useState<SelectOption[]>([]);
  const [cityOptions, setCityOptions] = useState<SelectOption[]>([]);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState(60);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [nextScanCountdown, setNextScanCountdown] = useState(0);
  const [hasAutoBootstrapped, setHasAutoBootstrapped] = useState(false);
  const [hrScanResults, setHrScanResults] = useState<Map<string, { hrEmail: string | null; confidence: number; phone: string | null; found: boolean }>>(new Map());
  const [isHrScanning, setIsHrScanning] = useState(false);
  const [hrScanStatus, setHrScanStatus] = useState('');

  useEffect(() => {
    let isMounted = true;

    import('country-state-city').then((module) => {
      if (!isMounted) {
        return;
      }

      const states = module.State.getStatesOfCountry('IN').map((stateItem) => ({
        value: stateItem.isoCode,
        label: stateItem.name,
      }));

      setGeoModule(module);
      setStateOptions(states);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!geoModule) {
      return;
    }

    const rawCities = stateCode
      ? geoModule.City.getCitiesOfState('IN', stateCode)
      : geoModule.City.getCitiesOfCountry('IN');

    const uniqueCityNames = Array.from(new Set((rawCities || []).map((item) => item.name)));
    const nextCityOptions = uniqueCityNames.map((item) => ({ value: item, label: item }));
    setCityOptions(nextCityOptions);

    if (city && nextCityOptions.some((item) => item.value === city)) {
      return;
    }

    const fallbackCity = nextCityOptions[0]?.value || 'Chennai';
    setCity(fallbackCity);
  }, [geoModule, stateCode, city]);

  // Auto-scan effect
  useEffect(() => {
    if (!autoScanEnabled) {
      return;
    }

    const scanInterval = setInterval(() => {
      void searchLocalJobs();
      setLastScanTime(new Date());
    }, scanIntervalSeconds * 1000);

    return () => clearInterval(scanInterval);
  }, [autoScanEnabled, scanIntervalSeconds, city, keyword, radiusKm, usePremiumMode, activeTab]);

  // Countdown timer effect
  useEffect(() => {
    if (!autoScanEnabled || !lastScanTime) {
      return;
    }

    const countdownInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastScanTime.getTime()) / 1000);
      const remaining = Math.max(0, scanIntervalSeconds - elapsed);
      setNextScanCountdown(remaining);
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [autoScanEnabled, lastScanTime, scanIntervalSeconds]);

  useEffect(() => {
    if (hasAutoBootstrapped || activeTab !== 'companies' || !city.trim()) {
      return;
    }

    setHasAutoBootstrapped(true);
    void searchLocalJobs();
  }, [activeTab, city, hasAutoBootstrapped]);

  const searchLocalJobs = async () => {
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setStatus('City is required.');
      return;
    }

    try {
      setIsLoading(true);
      setStatus(activeTab === 'part-time' ? 'Scanning part-time jobs around your city...' : 'Scanning nearby IT companies around your location...');
      setCompanyStatus(activeTab === 'companies' ? 'Loading nearby IT companies...' : '');
      setLastScanTime(new Date());

      const origin = originCoordinates || (await geocodePlace(trimmedCity));
      setOriginCoordinates(origin);

      const query = keyword.trim();
      const effectiveKeyword = activeTab === 'part-time' ? query || 'part time' : query || 'IT';
      const shouldLoadJobs = activeTab === 'part-time';
      const shouldLoadCompanies = activeTab === 'companies';

      const jobsRequest = shouldLoadJobs
        ? fetch(
            `${runtimeConfig.apiBaseUrl}/jobs/local-feed?${new URLSearchParams({
              city: trimmedCity,
              keyword: effectiveKeyword,
              mode: 'part-time',
              radiusKm: String(radiusKm),
              limit: '80',
              experienceLevel: profile?.experienceLevel || '',
              experienceYears:
                typeof profile?.yearsOfExperience === 'number' ? String(profile.yearsOfExperience) : '',
            }).toString()}`,
          )
        : Promise.resolve(null);

      const nearbyQuery = new URLSearchParams({
        city: trimmedCity,
        keyword: 'IT',
        radiusKm: String(radiusKm),
        limit: '18',
        mode: usePremiumMode ? 'premium' : 'standard',
      });
      if (origin) {
        nearbyQuery.set('lat', String(origin.lat));
        nearbyQuery.set('lon', String(origin.lon));
      }

      const nearbyRequest = shouldLoadCompanies
        ? fetch(`${runtimeConfig.apiBaseUrl}/jobs/nearby-companies?${nearbyQuery.toString()}`)
        : Promise.resolve(null);

      const [response, nearbyResponse] = await Promise.all([jobsRequest, nearbyRequest]);

      const candidates: JobOpportunity[] = [];
      if (response) {
        if (!response.ok) {
          throw new Error('Unable to load part-time jobs from live feed.');
        }

        const payload = (await response.json()) as {
          jobs: JobOpportunity[];
          providerSummary?: Record<string, unknown>;
        };
        const fetchedJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
        candidates.push(...fetchedJobs);

        const summary = payload.providerSummary || {};
        setProviderNote(
          `Part-time sources: Adzuna ${summary.adzuna || 0}, Arbeitnow ${summary.arbeitnow || 0}, TheMuse ${summary.themuse || 0}, Remotive ${summary.remotive || 0}, RemoteOK ${summary.remoteok || 0}.`,
        );
      } else {
        setProviderNote(`Nearby mode: ${usePremiumMode ? 'Google Premium' : 'Standard'}`);
      }

      if (nearbyResponse?.ok) {
        const nearbyPayload = (await nearbyResponse.json()) as { companies?: NearbyCompanySpot[] };
        const companies = Array.isArray(nearbyPayload.companies) ? nearbyPayload.companies : [];
        setNearbyCompanies(companies);
        setCompanyStatus(
          companies.length > 0
            ? `Found ${companies.length} nearby IT companies in ${radiusKm} km radius.`
            : `No nearby IT company details found in ${radiusKm} km.`,
        );
      } else if (shouldLoadCompanies) {
        setNearbyCompanies([]);
        setCompanyStatus('Nearby company lookup failed right now. Try again in a few seconds.');
      }

      const mapped = await Promise.all(
        candidates.slice(0, 40).map(async (job) => {
          let estimatedDistanceKm: number | null = null;
          if (origin) {
            const jobLocation = job.location || '';
            const target = await geocodePlace(jobLocation);
            if (target) {
              estimatedDistanceKm = Math.round(haversineKm(origin, target));
            }
          }

          return {
            ...job,
            estimatedDistanceKm,
          } satisfies LocalJobResult;
        }),
      );

      const filtered = mapped
        .filter((job) => {
          const cityMatch = job.location.toLowerCase().includes(trimmedCity.toLowerCase());
          const radiusMatch = job.estimatedDistanceKm === null ? cityMatch || /remote/i.test(job.location) : job.estimatedDistanceKm <= radiusKm;
          const partTimeBias =
            /part|contract|intern|temporary|shift|weekend|freelance|hourly|flexible|wfh|work from home/i.test(
              `${job.role} ${job.type} ${(job.tags || []).join(' ')}`,
            ) ||
            cityMatch;
          return radiusMatch && partTimeBias;
        })
        .sort((a, b) => {
          const da = a.estimatedDistanceKm ?? 9999;
          const db = b.estimatedDistanceKm ?? 9999;
          if (da !== db) {
            return da - db;
          }

          return b.matchPercentage - a.matchPercentage;
        })
        .slice(0, 30);

      setResults(filtered);
      if (activeTab === 'part-time') {
        setStatus(filtered.length > 0 ? `Found ${filtered.length} part-time jobs near ${trimmedCity}.` : `No part-time jobs found in ${trimmedCity} right now.`);
      } else {
        setStatus(nearbyResponse?.ok ? 'Nearby IT company scan completed.' : 'No nearby IT company data found right now.');
        setResults([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to search local jobs right now.';
      setStatus(message);
      setCompanyStatus('');
      setNearbyCompanies([]);
      setProviderNote('');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const scanHrEmails = async () => {
    const companiesWithWebsites = nearbyCompanies.filter((c) => c.website && /^https?:\/\//i.test(c.website));
    if (companiesWithWebsites.length === 0) {
      setHrScanStatus('No company websites found to scan. Try re-loading nearby companies first.');
      return;
    }

    setIsHrScanning(true);
    setHrScanStatus(`Scanning ${Math.min(10, companiesWithWebsites.length)} company career pages...`);
    setHrScanResults(new Map());

    try {
      const payload = companiesWithWebsites.slice(0, 10).map((c) => ({ name: c.company, website: c.website! }));
      const res = await fetch(`${runtimeConfig.apiBaseUrl}/jobs/scrape/career-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: payload }),
      });

      if (!res.ok) {
        setHrScanStatus('Career email scan failed. Server returned an error.');
        return;
      }

      const data = (await res.json()) as {
        scannedCount: number;
        foundCount: number;
        results: Array<{ company: string; hrEmail: string | null; hrEmailConfidence: number; contactPhone: string | null; found: boolean }>;
      };

      const newMap = new Map<string, { hrEmail: string | null; confidence: number; phone: string | null; found: boolean }>();
      data.results.forEach((r) => {
        newMap.set(r.company.toLowerCase(), { hrEmail: r.hrEmail, confidence: r.hrEmailConfidence, phone: r.contactPhone, found: r.found });
      });
      setHrScanResults(newMap);
      setHrScanStatus(`Scan complete — ${data.foundCount} of ${data.scannedCount} companies have direct HR email.`);
    } catch {
      setHrScanStatus('Career email scan failed. Check server connection.');
    } finally {
      setIsHrScanning(false);
    }
  };

  const detectCityFromCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location is not supported in this browser.');
      return;
    }

    setStatus('Detecting your current city...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const current = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setOriginCoordinates(current);

        try {
          const reverseResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${current.lat}&lon=${current.lon}`,
          );
          if (!reverseResponse.ok) {
            setStatus('Location captured. Pick city from selector and run search.');
            return;
          }

          const reversePayload = (await reverseResponse.json()) as {
            address?: {
              city?: string;
              town?: string;
              village?: string;
              state_district?: string;
            };
          };

          const guessedCity =
            reversePayload.address?.city ||
            reversePayload.address?.town ||
            reversePayload.address?.village ||
            reversePayload.address?.state_district ||
            '';

          if (guessedCity) {
            setCity(guessedCity);
            setStatus(`Location locked: ${guessedCity}. Now tap Search Jobs.`);
          } else {
            setStatus('Location captured. City name unavailable, choose city from selector.');
          }
        } catch {
          setStatus('Location captured. Could not resolve city name.');
        }
      },
      () => {
        setStatus('Unable to access your location. Allow permission and retry.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const radarRings = useMemo(() => [1, 2, 3, 4], []);

  return (
    <div className="app-shell pb-24">
      <QuickProfileMenu />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-8 -left-6 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -right-8 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-primary text-sm font-semibold tracking-wide mb-2">
            <Compass className="w-4 h-4" />
            LOCAL JOB TRACKER
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            City Radar Search
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track jobs in your city radius and open exact postings quickly.</p>
        </div>

        <div className="mb-6 app-surface p-4">
          <div className="relative mx-auto w-56 h-56 rounded-full border border-border bg-secondary/60 flex items-center justify-center overflow-hidden">
            {radarRings.map((ring) => (
              <div
                key={ring}
                className="absolute rounded-full border border-border/40"
                style={{ width: `${ring * 42}px`, height: `${ring * 42}px` }}
              />
            ))}
            <div className="absolute w-1 h-24 origin-bottom bg-gradient-to-t from-primary/0 via-primary/60 to-primary rounded-full animate-[spin_3s_linear_infinite]" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center mb-2">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Radius</p>
              <p className="text-lg font-semibold text-primary">{radiusKm} km</p>
            </div>
          </div>
        </div>

        {providerNote ? <p className="text-[11px] text-primary mb-3">{providerNote}</p> : null}

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2">
          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className={`rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 ${
              activeTab === 'companies'
                ? 'bg-primary/10 border border-primary/30 text-primary'
                : 'border border-transparent text-muted-foreground'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Nearby IT Companies
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('part-time')}
            className={`rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 ${
              activeTab === 'part-time'
                ? 'bg-emerald-100 border border-emerald-200 text-emerald-700'
                : 'border border-transparent text-muted-foreground'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Part-time Jobs
          </button>
        </div>

        {/* Real-Time Scanner Control */}
        <div className="mb-6 app-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Real-Time Scanner</span>
            </div>
            {lastScanTime && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastScanTime.toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAutoScanEnabled((val) => !val)}
              className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                autoScanEnabled
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-lg shadow-black/5'
                  : 'border-border bg-secondary text-muted-foreground'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${autoScanEnabled ? 'bg-primary animate-pulse' : 'bg-primary/40'}`} />
              {autoScanEnabled ? `Live Scanning • Next in ${nextScanCountdown}s` : `Enable Live Scanning (${activeTab === 'companies' ? 'Companies' : 'Part-time'})`}
            </button>

            {autoScanEnabled && (
              <div>
                <label className="text-[11px] text-muted-foreground block mb-2">Scan interval: {scanIntervalSeconds}s</label>
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={15}
                  value={scanIntervalSeconds}
                  onChange={(e) => setScanIntervalSeconds(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>30s</span>
                  <span>5 min</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <SearchableSingleSelect
            label="State"
            placeholder="Select state"
            options={stateOptions}
            value={stateCode}
            onChange={setStateCode}
          />

          <SearchableSingleSelect
            label="City"
            placeholder="Select city"
            options={cityOptions}
            value={city}
            onChange={setCity}
          />

          {activeTab === 'part-time' ? (
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Part-time keyword (eg: support, retail, shift, weekend)"
              className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          ) : null}

          <div className="rounded-xl border border-border bg-secondary px-3 py-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Search radius</span>
              <span>{radiusKm} km</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={detectCityFromCurrentLocation}
              className="rounded-xl border border-border bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground flex items-center justify-center gap-2"
            >
              <LocateFixed className="w-4 h-4" />
              Use My Location
            </button>

            <button
              type="button"
              onClick={() => {
                void searchLocalJobs();
              }}
              disabled={isLoading}
              className="rounded-xl border border-emerald-200 bg-emerald-100 py-2.5 text-sm font-semibold text-emerald-700 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {activeTab === 'companies' ? 'Find IT Companies' : 'Search Part-time Jobs'}
            </button>
          </div>

          {activeTab === 'companies' ? (
            <button
              type="button"
              onClick={() => setUsePremiumMode((value) => !value)}
              className={`w-full rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                usePremiumMode
                  ? 'border-amber-200 bg-amber-100 text-amber-700'
                  : 'border-border bg-secondary text-muted-foreground'
              }`}
            >
              Nearby Accuracy Mode: {usePremiumMode ? 'Google Premium' : 'Standard'}
            </button>
          ) : null}

          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
          {companyStatus ? <p className="text-xs text-emerald-700">{companyStatus}</p> : null}
        </div>

        {originCoordinates ? (
          <div className="mb-4 text-xs text-primary bg-secondary border border-border rounded-xl p-2.5">
            Tracker anchor: {originCoordinates.lat.toFixed(3)}, {originCoordinates.lon.toFixed(3)}
          </div>
        ) : null}

        {activeTab === 'companies' && nearbyCompanies.length > 0 ? (
          <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Nearby Companies ({nearbyCompanies.length})</p>
                <h2 className="text-lg font-semibold text-foreground">Open in Google Maps</h2>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>

            {/* HR Email Deep Scan */}
            <div className="mb-4">
              <button
                type="button"
                disabled={isHrScanning}
                onClick={scanHrEmails}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-100 py-2.5 text-xs font-bold text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
              >
                {isHrScanning ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning Career Pages...</>
                ) : (
                  <><Search className="w-3.5 h-3.5" /> Deep Scan HR Emails (Career Pages)</>
                )}
              </button>
              {hrScanStatus ? (
                <p className={`mt-2 text-[11px] text-center ${hrScanResults.size > 0 ? 'text-emerald-700' : 'text-amber-700/80'}`}>{hrScanStatus}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              {nearbyCompanies.map((company) => {
                const jobsForCompany = results.filter((job) => job.company.toLowerCase() === company.company.toLowerCase());
                const hasJobs = jobsForCompany.length > 0;

                return (
                  <div key={`${company.company}-${company.address}`} className={`rounded-2xl border p-3 transition-all ${
                    hasJobs
                      ? 'border-emerald-200 bg-emerald-50 shadow-lg shadow-emerald-500/10'
                      : 'border-border bg-secondary'
                  }`}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">{company.company}</p>
                          {hasJobs && (
                            <div className="flex items-center gap-1 text-emerald-700">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-semibold">Live • {jobsForCompany.length}x jobs</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{company.category} • {company.address}</p>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-semibold">{company.distanceKm} km</span>
                    </div>

                    <div className="mb-2 text-[11px] text-muted-foreground space-y-0.5">
                      <p>Phone: {company.phone || 'Not listed'}</p>
                      <p>Website: {company.website || 'Not listed'}</p>
                      {(() => {
                        const scan = hrScanResults.get(company.company.toLowerCase());
                        if (!scan) return null;
                        return scan.found ? (
                          <p className="text-emerald-700 font-semibold">
                            ✓ HR Email: <a href={`mailto:${scan.hrEmail}`} className="underline">{scan.hrEmail}</a>
                            {' '}({scan.confidence}% confidence)
                          </p>
                        ) : (
                          <p className="text-amber-700/80">✗ No HR email found on career page</p>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={company.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-2 text-xs font-semibold text-primary"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Maps Search
                      </a>
                      <a
                        href={company.website || company.searchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-100 py-2 text-xs font-semibold text-emerald-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Details
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="space-y-3">
          {activeTab === 'part-time' && results.length > 0 && (
            <div className="mb-4 rounded-2xl border border-border bg-secondary p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Live Job Feed</p>
                  <p className="text-[11px] text-muted-foreground">{results.length} openings found • Auto-refresh {autoScanEnabled ? `every ${scanIntervalSeconds}s` : 'disabled'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'part-time'
            ? results.map((job, index) => {
            const linkedInQuery = encodeURIComponent(`${job.role} ${job.company} ${job.location}`);
            const linkedInSearchUrl = `https://www.linkedin.com/jobs/search/?keywords=${linkedInQuery}`;

            return (
              <article
                key={String(job.id)}
                className="glass-card reveal-up rounded-2xl p-4 transition-transform duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{job.role}</h3>
                    <p className="text-xs text-muted-foreground">{job.company} • {job.location}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700">
                    {job.matchPercentage}% match
                  </span>
                </div>

                <div className="text-xs text-muted-foreground space-y-1.5 mb-3">
                  <p>Type: {job.type}</p>
                  <p>Estimated distance: {job.estimatedDistanceKm === null ? 'Unknown' : `${job.estimatedDistanceKm} km`}</p>
                  <p>HR email: {job.hrEmail || 'Not available'}</p>
                  <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> Contact: {job.contactPhone || 'Not listed in posting'}</p>
                  <p>Poster: {job.posterName || 'Not available'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={job.applyUrl || linkedInSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-center rounded-lg bg-secondary border border-border text-primary text-xs font-semibold py-2 transition-all duration-200 hover:opacity-90"
                  >
                    Open Job Post
                  </a>
                  <a
                    href={linkedInSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-center rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold py-2 transition-all duration-200 hover:opacity-90"
                  >
                    LinkedIn Search
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.company} ${job.location}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-2 text-center rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-semibold py-2 transition-all duration-200 hover:opacity-90"
                  >
                    Find Company on Google Maps
                  </a>
                </div>
              </article>
            );
              })
            : null}

          {activeTab === 'part-time' && results.length === 0 && !isLoading ? (
            <div className="app-surface p-4 text-xs text-muted-foreground flex gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>No local jobs loaded yet. Set city + radius and run search. This page avoids direct LinkedIn scraping and opens compliant LinkedIn search links instead.</span>
            </div>
          ) : null}

          {activeTab === 'companies' && nearbyCompanies.length === 0 && !isLoading ? (
            <div className="app-surface p-4 text-xs text-muted-foreground flex gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>No nearby IT company spots loaded yet. Tap Use My Location and run Find IT Companies.</span>
            </div>
          ) : null}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
