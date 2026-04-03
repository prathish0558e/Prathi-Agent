import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Building2, Loader2, Radar, Trash2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { SearchableSingleSelect } from '../components/SearchableSingleSelect';
import { runtimeConfig } from '../lib/runtimeConfig';

interface WatchTarget {
  id: string;
  companies: string[];
  roleTitle: string;
  stateCode: string;
  city: string;
  enabled: boolean;
  lastCheckedAt: string | null;
}

interface WatchAlert {
  id: string;
  targetId: string;
  message: string;
  createdAt: string;
}

interface WatchJob {
  id: string | number;
  company: string;
  role: string;
  location: string;
  source: string;
  applyUrl?: string | null;
  matchPercentage: number;
}

interface SelectOption {
  value: string;
  label: string;
}

type GeoModule = typeof import('country-state-city');

const TARGETS_STORAGE_KEY = 'career_agent_watch_targets_v1';
const ALERTS_STORAGE_KEY = 'career_agent_watch_alerts_v1';
const SEEN_IDS_STORAGE_KEY = 'career_agent_watch_seen_ids_v1';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export function AIJobWatch() {
  const [geoModule, setGeoModule] = useState<GeoModule | null>(null);
  const [stateOptions, setStateOptions] = useState<SelectOption[]>([]);
  const [cityOptions, setCityOptions] = useState<SelectOption[]>([]);

  const [stateCode, setStateCode] = useState('TN');
  const [city, setCity] = useState('Chennai');
  const [companiesInput, setCompaniesInput] = useState('Deloitte, TCS');
  const [roleTitle, setRoleTitle] = useState('Software Engineer');

  const [targets, setTargets] = useState<WatchTarget[]>(() => readJson<WatchTarget[]>(TARGETS_STORAGE_KEY, []));
  const [alerts, setAlerts] = useState<WatchAlert[]>(() => readJson<WatchAlert[]>(ALERTS_STORAGE_KEY, []));
  const [openingsByTarget, setOpeningsByTarget] = useState<Record<string, WatchJob[]>>({});
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('Add your target companies and start AI watch.');

  useEffect(() => {
    saveJson(TARGETS_STORAGE_KEY, targets);
  }, [targets]);

  useEffect(() => {
    saveJson(ALERTS_STORAGE_KEY, alerts.slice(0, 60));
  }, [alerts]);

  useEffect(() => {
    let isMounted = true;

    import('country-state-city').then((module) => {
      if (!isMounted) {
        return;
      }

      setGeoModule(module);
      setStateOptions(
        module.State.getStatesOfCountry('IN').map((stateItem) => ({
          value: stateItem.isoCode,
          label: stateItem.name,
        })),
      );
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
    const uniqueCities = Array.from(new Set((rawCities || []).map((item) => item.name)));
    const options = uniqueCities.map((name) => ({ value: name, label: name }));
    setCityOptions(options);

    if (options.some((item) => item.value === city)) {
      return;
    }

    setCity(options[0]?.value || 'Chennai');
  }, [geoModule, stateCode, city]);

  const totalLiveOpenings = useMemo(
    () => Object.values(openingsByTarget).reduce((total, jobs) => total + jobs.length, 0),
    [openingsByTarget],
  );

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setStatus('Browser notification not supported in this device.');
      return;
    }

    const result = await Notification.requestPermission();
    setStatus(result === 'granted' ? 'Notifications enabled for AI watch.' : 'Notification permission denied.');
  };

  const runScanForTarget = async (target: WatchTarget, fromAutoScan = false) => {
    const response = await fetch(`${runtimeConfig.apiBaseUrl}/jobs/watch/openings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        companies: target.companies,
        roleTitle: target.roleTitle,
        city: target.city,
        limit: 30,
      }),
    });

    if (!response.ok) {
      throw new Error('Unable to scan watch target right now.');
    }

    const payload = (await response.json()) as { jobs?: WatchJob[] };
    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    setOpeningsByTarget((current) => ({
      ...current,
      [target.id]: jobs,
    }));

    const seenMap = readJson<Record<string, Array<string | number>>>(SEEN_IDS_STORAGE_KEY, {});
    const targetSeen = new Set((seenMap[target.id] || []).map((entry) => String(entry)));
    const freshJobs = jobs.filter((job) => !targetSeen.has(String(job.id)));

    if (freshJobs.length > 0) {
      const nextAlerts: WatchAlert[] = freshJobs.slice(0, 6).map((job) => ({
        id: `${target.id}-${String(job.id)}-${Date.now()}`,
        targetId: target.id,
        message: `${job.company} opened ${job.role} in ${job.location}`,
        createdAt: new Date().toISOString(),
      }));

      setAlerts((current) => [...nextAlerts, ...current].slice(0, 60));

      if ('Notification' in window && Notification.permission === 'granted') {
        freshJobs.slice(0, 2).forEach((job) => {
          const title = `New opening: ${job.company}`;
          const body = `${job.role} • ${job.location}`;
          new Notification(title, { body });
        });
      }
    }

    seenMap[target.id] = Array.from(new Set([...(seenMap[target.id] || []), ...jobs.map((job) => String(job.id))])).slice(-500);
    saveJson(SEEN_IDS_STORAGE_KEY, seenMap);

    setTargets((current) =>
      current.map((item) =>
        item.id === target.id
          ? {
              ...item,
              lastCheckedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    if (!fromAutoScan) {
      setStatus(`Scan complete for ${target.companies.join(', ')}. Found ${jobs.length} openings.`);
    }
  };

  const runFullScan = async (fromAutoScan = false) => {
    const activeTargets = targets.filter((item) => item.enabled);
    if (activeTargets.length === 0) {
      if (!fromAutoScan) {
        setStatus('No active watch targets.');
      }
      return;
    }

    try {
      setIsScanning(true);
      if (!fromAutoScan) {
        setStatus('AI scanning all active targets...');
      }

      for (const target of activeTargets) {
        await runScanForTarget(target, true);
      }

      if (!fromAutoScan) {
        setStatus(`AI watch scan done. Active targets: ${activeTargets.length}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Watch scan failed.';
      setStatus(message);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!monitorEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void runFullScan(true);
    }, 120000);

    return () => {
      window.clearInterval(timer);
    };
  }, [monitorEnabled, targets]);

  const addTarget = () => {
    const companies = companiesInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (companies.length === 0) {
      setStatus('Enter at least one company name.');
      return;
    }

    const nextTarget: WatchTarget = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      companies,
      roleTitle: roleTitle.trim(),
      stateCode,
      city,
      enabled: true,
      lastCheckedAt: null,
    };

    setTargets((current) => [nextTarget, ...current]);
    setStatus(`Target added: ${companies.join(', ')} (${city}).`);
  };

  return (
    <div className="app-shell pb-24">
      <div className="relative max-w-md mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-primary text-sm font-semibold tracking-wide mb-2">
            <Radar className="w-4 h-4" />
            AI TARGET WATCH
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            Company Job Radar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Target company, role, city select pannunga. New opening vandha udane app notification and watch feed update aagum.
          </p>
        </div>

        <div className="app-surface p-4 space-y-3 mb-4">
          <label className="text-xs text-muted-foreground block">Target companies (comma separated)</label>
          <input
            value={companiesInput}
            onChange={(event) => setCompaniesInput(event.target.value)}
            placeholder="Deloitte, Zoho, TCS"
            className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />

          <label className="text-xs text-muted-foreground block">Role title</label>
          <input
            value={roleTitle}
            onChange={(event) => setRoleTitle(event.target.value)}
            placeholder="Frontend Developer"
            className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />

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

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={addTarget}
              className="rounded-xl border border-border bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground"
            >
              Add Target
            </button>
            <button
              type="button"
              onClick={() => {
                void runFullScan(false);
              }}
              disabled={isScanning}
              className="rounded-xl border border-border bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
              Scan Now
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMonitorEnabled((value) => !value)}
            className={`w-full rounded-xl border py-2.5 text-sm font-semibold ${
              monitorEnabled
                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                : 'border-border bg-secondary text-muted-foreground'
            }`}
          >
            Auto Watch: {monitorEnabled ? 'ON (every 2 mins)' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => {
              void requestNotificationPermission();
            }}
            className="w-full rounded-xl border border-border bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            Enable Notifications
          </button>

          <p className="text-xs text-muted-foreground">{status}</p>
          <p className="text-xs text-amber-700">Live openings tracked: {totalLiveOpenings}</p>
        </div>

        <section className="space-y-3 mb-5">
          {targets.map((target) => {
            const jobs = openingsByTarget[target.id] || [];
            return (
              <div key={target.id} className="app-surface p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{target.companies.join(', ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {target.roleTitle || 'Any role'} • {target.city}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Last checked: {target.lastCheckedAt ? new Date(target.lastCheckedAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargets((current) =>
                          current.map((item) => (item.id === target.id ? { ...item, enabled: !item.enabled } : item)),
                        );
                      }}
                      className={`text-[11px] px-2 py-1 rounded-lg border ${
                        target.enabled ? 'border-emerald-200 text-emerald-700' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {target.enabled ? 'Watching' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargets((current) => current.filter((item) => item.id !== target.id));
                        setOpeningsByTarget((current) => {
                          const next = { ...current };
                          delete next[target.id];
                          return next;
                        });
                      }}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void runScanForTarget(target, false);
                  }}
                  className="w-full mb-2 rounded-lg border border-amber-200 bg-amber-100 text-amber-700 text-xs font-semibold py-2"
                >
                  Scan This Target
                </button>

                <div className="space-y-2">
                  {jobs.slice(0, 4).map((job) => (
                    <a
                      key={String(job.id)}
                      href={job.applyUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-border bg-secondary p-2.5"
                    >
                      <p className="text-xs font-semibold text-foreground">{job.role}</p>
                      <p className="text-[11px] text-muted-foreground">{job.company} • {job.location}</p>
                      <p className="text-[11px] text-primary">Source: {job.source} • Match {job.matchPercentage}%</p>
                    </a>
                  ))}
                  {jobs.length === 0 ? <p className="text-[11px] text-muted-foreground">No openings captured yet.</p> : null}
                </div>
              </div>
            );
          })}
        </section>

        <section className="app-surface p-3">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notification Feed</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border bg-secondary px-2.5 py-2">
                <p className="text-xs text-foreground flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  {alert.message}
                </p>
                <p className="text-[11px] text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {alerts.length === 0 ? <p className="text-[11px] text-muted-foreground">No alerts yet.</p> : null}
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
