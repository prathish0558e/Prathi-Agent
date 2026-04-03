import { useMemo, useState } from 'react';
import { Search, Loader2, Globe, CalendarClock, Filter } from 'lucide-react';
import { runtimeConfig } from '../lib/runtimeConfig';

interface AdmissionResult {
  title: string;
  link: string;
  displayLink?: string;
  snippet?: string;
  deadline?: string | null;
  deadlineText?: string | null;
  deadlineStatus?: 'open' | 'closed' | 'unknown';
  program?: string | null;
  course?: string | null;
  country?: string | null;
  intake?: string | null;
  source?: string;
}

const PROGRAM_OPTIONS = [
  { value: 'masters', label: 'MS / Masters' },
  { value: 'bachelors', label: 'Bachelors' },
  { value: 'phd', label: 'PhD' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
  { value: 'all', label: 'All programs' },
];

const INTAKE_OPTIONS = ['Fall 2026', 'Spring 2026', 'Summer 2026', 'Fall 2027', 'Spring 2027'];

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Not found';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
};

export function AdmissionFinder() {
  const [course, setCourse] = useState('computer science');
  const [program, setProgram] = useState('masters');
  const [country, setCountry] = useState('');
  const [intake, setIntake] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [deepScan, setDeepScan] = useState(true);
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<AdmissionResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const statusCounts = useMemo(() => {
    const counts = { open: 0, closed: 0, unknown: 0 };
    results.forEach((item) => {
      const statusKey = item.deadlineStatus || 'unknown';
      counts[statusKey] += 1;
    });
    return counts;
  }, [results]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedCourse = course.trim();
    if (!trimmedCourse) {
      setError('Enter a course or keyword to search admissions.');
      return;
    }

    setIsSearching(true);
    setError('');
    setStatus('');
    setResults([]);

    try {
      const params = new URLSearchParams({
        course: trimmedCourse,
        program: program || 'masters',
        limit: String(limit),
        openOnly: String(openOnly),
        deep: String(deepScan),
      });

      const trimmedIntake = intake.trim();
      if (trimmedIntake) {
        params.set('intake', trimmedIntake);
      }

      if (country.trim()) {
        params.set('country', country.trim());
      }

      const response = await fetch(`${runtimeConfig.apiBaseUrl}/admissions/finder?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to load admissions right now.');
      }

      const payload = (await response.json()) as { results?: AdmissionResult[]; count?: number };
      const fetched = Array.isArray(payload.results) ? payload.results : [];
      setResults(fetched);
      setStatus(
        fetched.length > 0
          ? `Found ${payload.count ?? fetched.length} admissions.`
          : 'No admissions found. Try adjusting filters.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="app-surface p-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Search className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide">GLOBAL ADMISSIONS FINDER</span>
        </div>
        <h3 className="text-2xl font-semibold text-foreground">Find Open Admissions Worldwide</h3>
        <p className="text-sm text-muted-foreground mt-1">Search by course, program level, intake, and country.</p>
      </div>

      <form onSubmit={handleSearch} className="app-surface p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Course / Keyword</label>
            <input
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              placeholder="Computer Science, MBA, Data Science"
              className="mt-1 w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Program</label>
            <select
              value={program}
              onChange={(event) => setProgram(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg bg-input-background border border-border px-3 text-sm text-foreground"
            >
              {PROGRAM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Country (optional)</label>
            <input
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="USA, Canada, Germany"
              className="mt-1 w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Intake</label>
            <input
              list="intake-options"
              value={intake}
              onChange={(event) => setIntake(event.target.value)}
              placeholder="Fall 2026"
              className="mt-1 w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm"
            />
            <datalist id="intake-options">
              {INTAKE_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Results limit</label>
            <input
              type="number"
              min={3}
              max={20}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="mt-1 w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none transition-colors text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
              className="h-4 w-4 rounded border-border/70 bg-input-background text-primary"
            />
            Open admissions only
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deepScan}
              onChange={(event) => setDeepScan(event.target.checked)}
              className="h-4 w-4 rounded border-border/70 bg-input-background text-primary"
            />
            Deep scan deadlines
          </label>
        </div>

        <button
          type="submit"
          disabled={isSearching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-95 transition-opacity disabled:opacity-50"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search admissions
        </button>

        {error && (
          <div className="mt-2 p-3 bg-amber-100 border border-amber-200 rounded-lg text-sm text-amber-800">
            {error}
          </div>
        )}

        {status && !error && (
          <div className="mt-2 p-3 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <Filter className="w-4 h-4" />
              <span className="font-semibold">{status}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Open {statusCounts.open}</span>
              <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700">Closed {statusCounts.closed}</span>
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Unknown {statusCounts.unknown}</span>
            </div>
            {results.length === 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tip: In Programmable Search Engine settings, enable "Search the web" or remove site restrictions.
              </p>
            )}
          </div>
        )}
      </form>

      {isSearching && (
        <div className="text-center py-6">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Scanning admissions worldwide...</p>
        </div>
      )}

      {!isSearching && results.length === 0 && !error && status === '' && (
        <div className="text-center py-6 text-sm text-muted-foreground">Run a search to see admissions results.</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((item) => (
            <div key={`${item.link}-${item.title}`} className="app-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-foreground hover:underline"
                  >
                    {item.title}
                  </a>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    {item.displayLink || item.link}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    item.deadlineStatus === 'open'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.deadlineStatus === 'closed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {item.deadlineStatus === 'open'
                    ? 'Open'
                    : item.deadlineStatus === 'closed'
                      ? 'Closed'
                      : 'Unknown'}
                </span>
              </div>

              {item.snippet && <p className="text-sm text-muted-foreground mt-2">{item.snippet}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Deadline: {item.deadlineText || formatDate(item.deadline)}
                </span>
                {item.program && <span>Program: {item.program}</span>}
                {item.course && <span>Course: {item.course}</span>}
                {item.country && <span>Country: {item.country}</span>}
                {item.intake && <span>Intake: {item.intake}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
