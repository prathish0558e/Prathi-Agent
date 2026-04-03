import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, MapPin, TrendingUp, BriefcaseBusiness, Sparkles, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { useAuth } from '../auth/AuthContext';
import { getUniversities, deleteUniversity, createUniversity, updateUniversity } from '../lib/universityDb';
import type { University } from '../types/university';
import AddUniversityModal from './AddUniversityModal';
import { UNIVERSITY_STARTER_CATALOG } from '../data/universityStarterCatalog';

const ADMISSION_ALERTS_ENABLED_KEY = 'career_agent_admission_alerts_enabled';

const canNotifyAdmissions = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  return localStorage.getItem(ADMISSION_ALERTS_ENABLED_KEY) === 'true';
};

const buildAdmissionNotification = (university: University) => {
  const deadline = university.admission_deadline
    ? ` Deadline: ${new Date(university.admission_deadline).toLocaleDateString()}.`
    : '';
  return `Admission added - ${university.name} (${university.country}).${deadline}`.trim();
};

export default function UniversityTracker() {
  const navigate = useNavigate();
  const { email } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingStarter, setIsImportingStarter] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [admissionFilter, setAdmissionFilter] = useState<'all' | 'open' | 'closed' | 'unknown'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<University | null>(null);

  const availableCountries = useMemo(() => {
    const items = new Set<string>();
    universities.forEach((uni) => {
      if (uni.country) {
        items.add(uni.country);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [universities]);

  useEffect(() => {
    if (!email) return;

    const loadUniversities = async () => {
      try {
        setIsLoading(true);
        const userId = email; // In production, get actual user ID from auth
        const data = await getUniversities(email);
        setUniversities(data);
      } catch (error) {
        console.error('Failed to load universities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUniversities();
  }, [email]);

  const parseDeadline = (value?: string | null) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getAdmissionStatus = (university: University) => {
    const deadline = parseDeadline(university.admission_deadline);
    if (!deadline) {
      return 'unknown' as const;
    }

    const endOfDay = new Date(deadline);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay >= new Date() ? 'open' : 'closed';
  };

  const getAdmissionPriority = (status: 'open' | 'closed' | 'unknown') => {
    if (status === 'open') {
      return 0;
    }

    if (status === 'unknown') {
      return 1;
    }

    return 2;
  };

  const baseFilteredUniversities = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedCourse = courseFilter.trim().toLowerCase();

    return universities.filter((uni) => {
      const matchesSearch =
        !normalizedSearch ||
        uni.name.toLowerCase().includes(normalizedSearch) ||
        uni.country.toLowerCase().includes(normalizedSearch) ||
        (uni.state ?? '').toLowerCase().includes(normalizedSearch);

      const matchesCountry = selectedCountry === 'all' || uni.country === selectedCountry;

      const courseText = (uni.courses ?? []).join(' ').toLowerCase();
      const matchesCourse = !normalizedCourse || courseText.includes(normalizedCourse);

      const matchesProgram = programFilter === 'all' || (uni.program_level ?? '') === programFilter;

      return matchesSearch && matchesCountry && matchesCourse && matchesProgram;
    });
  }, [searchTerm, universities, selectedCountry, courseFilter, programFilter]);

  const admissionCounts = useMemo(() => {
    const counts = { open: 0, closed: 0, unknown: 0 };

    baseFilteredUniversities.forEach((uni) => {
      const status = getAdmissionStatus(uni);
      counts[status] += 1;
    });

    return counts;
  }, [baseFilteredUniversities]);

  const filteredUniversities = useMemo(() => {
    const filtered = baseFilteredUniversities.filter((uni) => {
      const admissionStatus = getAdmissionStatus(uni);
      return admissionFilter === 'all' || admissionStatus === admissionFilter;
    });

    return [...filtered].sort((a, b) => {
      const statusA = getAdmissionStatus(a);
      const statusB = getAdmissionStatus(b);
      const priorityDiff = getAdmissionPriority(statusA) - getAdmissionPriority(statusB);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const deadlineA = parseDeadline(a.admission_deadline);
      const deadlineB = parseDeadline(b.admission_deadline);
      if (deadlineA && deadlineB) {
        return deadlineA.getTime() - deadlineB.getTime();
      }
      if (deadlineA) {
        return -1;
      }
      if (deadlineB) {
        return 1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [baseFilteredUniversities, admissionFilter]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this university?')) {
      try {
        await deleteUniversity(id);
        setUniversities(universities.filter((uni) => uni.id !== id));
      } catch (error) {
        console.error('Failed to delete university:', error);
      }
    }
  };

  const handleAddSuccess = (newUniversity: University) => {
    setUniversities([newUniversity, ...universities]);
    setShowAddModal(false);
    setEditingUniversity(null);

    if (!editingUniversity && !isImportingStarter && canNotifyAdmissions()) {
      new Notification('New admission added', {
        body: buildAdmissionNotification(newUniversity),
      });
    }
  };

  const handleFindJobsForUniversity = (university: University) => {
    const courseHint = (university.courses?.[0] || courseFilter || '').trim();
    const query = `${university.name} ${courseHint} admissions internship`;
    navigate(`/jobs?q=${encodeURIComponent(query)}`);
  };

  const handleToggleApplyIntent = async (university: University, nextValue: boolean) => {
    try {
      const updated = await updateUniversity(university.id, { apply_intent: nextValue });
      setUniversities((prev) => prev.map((item) => (item.id === university.id ? updated : item)));
    } catch (error) {
      console.error('Failed to update apply intent:', error);
    }
  };

  const handleLoadStarterUniversities = async () => {
    if (!email || isImportingStarter) {
      return;
    }

    try {
      setIsImportingStarter(true);
      setImportStatus('Importing top university starter list...');

      const existingNames = new Set(universities.map((item) => item.name.trim().toLowerCase()));
      const toCreate = UNIVERSITY_STARTER_CATALOG.filter((item) => !existingNames.has(item.name.trim().toLowerCase()));

      if (toCreate.length === 0) {
        setImportStatus('Starter universities already added.');
        return;
      }

      const created: University[] = [];
      const defaultProgramLevel = programFilter !== 'all' ? programFilter : undefined;
      for (const uni of toCreate) {
        const next = await createUniversity({
          user_id: email,
          name: uni.name,
          country: uni.country,
          state: uni.state,
          ranking: uni.ranking,
          acceptance_rate: uni.acceptanceRate,
          website: uni.website,
          program_level: defaultProgramLevel,
        });
        created.push(next);
      }

      setUniversities((prev) => [...created, ...prev]);
      setImportStatus(`Imported ${created.length} top universities. You can search/add more up to top 1000 progressively.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Failed to import starter universities.');
    } finally {
      setIsImportingStarter(false);
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">University Tracker</h2>
          <p className="text-muted-foreground mt-1">Filter by country + course, then mark where you want to apply</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleLoadStarterUniversities} disabled={isImportingStarter} variant="outline" className="gap-2">
            <Sparkles size={18} />
            {isImportingStarter ? 'Importing...' : 'Load Top Universities'}
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus size={20} />
            Add University
          </Button>
        </div>
      </div>

      {importStatus ? (
        <p className="text-sm text-primary bg-secondary/70 border border-border/60 rounded-md px-3 py-2">{importStatus}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5 mb-6">
        <Input
          placeholder="Search universities or states..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-input-background border-border/70 text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="h-10 rounded-md bg-input-background border border-border/70 px-3 text-sm text-foreground"
        >
          <option value="all">All countries</option>
          {availableCountries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
        <Input
          placeholder="Course / specialization"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="bg-input-background border-border/70 text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="h-10 rounded-md bg-input-background border border-border/70 px-3 text-sm text-foreground"
        >
          <option value="all">All programs</option>
          <option value="bachelors">Bachelors</option>
          <option value="masters">Masters</option>
          <option value="phd">PhD</option>
          <option value="diploma">Diploma</option>
          <option value="certificate">Certificate</option>
          <option value="other">Other</option>
        </select>
        <select
          value={admissionFilter}
          onChange={(e) => setAdmissionFilter(e.target.value as 'all' | 'open' | 'closed' | 'unknown')}
          className="h-10 rounded-md bg-input-background border border-border/70 px-3 text-sm text-foreground"
        >
          <option value="all">All admission status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="unknown">Deadline not set</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
        <span className="text-muted-foreground">Admissions:</span>
        <button
          type="button"
          onClick={() => setAdmissionFilter('all')}
          className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
            admissionFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All {baseFilteredUniversities.length}
        </button>
        <button
          type="button"
          onClick={() => setAdmissionFilter('open')}
          className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
            admissionFilter === 'open'
              ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
              : 'bg-secondary border-border text-muted-foreground hover:text-emerald-700'
          }`}
        >
          Open {admissionCounts.open}
        </button>
        <button
          type="button"
          onClick={() => setAdmissionFilter('closed')}
          className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
            admissionFilter === 'closed'
              ? 'bg-rose-100 border-rose-200 text-rose-700'
              : 'bg-secondary border-border text-muted-foreground hover:text-rose-700'
          }`}
        >
          Closed {admissionCounts.closed}
        </button>
        <button
          type="button"
          onClick={() => setAdmissionFilter('unknown')}
          className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
            admissionFilter === 'unknown'
              ? 'bg-amber-100 border-amber-200 text-amber-700'
              : 'bg-secondary border-border text-muted-foreground hover:text-amber-700'
          }`}
        >
          Deadline not set {admissionCounts.unknown}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredUniversities.length === 0 ? (
        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No universities added yet</p>
            <Button onClick={() => setShowAddModal(true)} variant="outline">
              Add Your First University
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUniversities.map((university) => (
            <Card key={university.id} className="border-border/70 bg-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-foreground">{university.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-2 text-muted-foreground">
                      <MapPin size={16} />
                      {university.country}
                      {university.state && `, ${university.state}`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingUniversity(university);
                        setShowAddModal(true);
                      }}
                      className="p-2 hover:bg-secondary/60 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} className="text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(university.id)}
                      className="p-2 hover:bg-secondary/60 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {university.ranking && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <TrendingUp size={16} />
                        Ranking
                      </span>
                      <span className="font-semibold text-foreground">#{university.ranking}</span>
                    </div>
                  )}
                  {university.acceptance_rate !== null && university.acceptance_rate !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Acceptance Rate</span>
                      <span className="font-semibold text-foreground">{university.acceptance_rate.toFixed(1)}%</span>
                    </div>
                  )}
                  {university.program_level ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Program</span>
                      <span className="font-semibold text-foreground">{university.program_level}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Admission</span>
                    {(() => {
                      const status = getAdmissionStatus(university);
                      const label = status === 'open' ? 'Open' : status === 'closed' ? 'Closed' : 'Deadline not set';
                      const color = status === 'open' ? 'text-emerald-600' : status === 'closed' ? 'text-rose-600' : 'text-amber-600';
                      return <span className={`font-semibold ${color}`}>{label}</span>;
                    })()}
                  </div>
                  {university.admission_deadline ? (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Deadline</span>
                      <span>{new Date(university.admission_deadline).toLocaleDateString()}</span>
                    </div>
                  ) : null}
                  {university.courses && university.courses.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Courses: <span className="text-foreground">{university.courses.join(', ')}</span>
                    </div>
                  ) : null}
                  {university.website && (
                    <div className="pt-2">
                      <a
                        href={university.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm hover:underline"
                      >
                        Visit Website →
                      </a>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleFindJobsForUniversity(university)}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                    >
                      <BriefcaseBusiness size={16} />
                      Find Jobs Related to {university.name}
                    </button>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(university.apply_intent)}
                        onChange={(event) => handleToggleApplyIntent(university, event.target.checked)}
                        className="h-4 w-4 rounded border-border/70 bg-input-background text-primary"
                      />
                      I want to apply
                    </label>
                    {university.apply_intent ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 size={14} /> Ready
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddUniversityModal
          university={editingUniversity}
          onSuccess={handleAddSuccess}
          onClose={() => {
            setShowAddModal(false);
            setEditingUniversity(null);
          }}
        />
      )}
    </div>
  );
}
