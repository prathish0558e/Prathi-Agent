import { Search, Loader2, Link2, MapPin, Globe, LocateFixed, Phone } from 'lucide-react';
import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { runtimeConfig } from '../lib/runtimeConfig';

interface Company {
  company: string;
  category?: string;
  address?: string;
  distanceKm?: number;
  website?: string | null;
  phone?: string | null;
  mapsUrl?: string | null;
  searchUrl?: string | null;
}

export function CompanyFinder() {
  const [searchQuery, setSearchQuery] = useState('');
  const [keyword, setKeyword] = useState('IT');
  const [radiusKm, setRadiusKm] = useState(50);
  const [limit, setLimit] = useState(24);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState('');

  const normalizeUrl = (value: string | null) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location access is not supported in this browser.');
      return;
    }

    setLocationStatus('Detecting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLocationStatus('Using your current location for this search.');
      },
      () => {
        setCoords(null);
        setLocationStatus('Unable to access your location. Enter a city instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCity = searchQuery.trim();
    if (!trimmedCity && !coords) {
      setError('Enter a city/area or use your current location to search.');
      return;
    }

    setIsSearching(true);
    setError('');
    setStatus('');
    setSourceNote('');
    setCompanies([]);

    try {
      const params = new URLSearchParams({
        radiusKm: String(radiusKm),
        limit: String(limit),
        mode: 'auto',
      });

      if (trimmedCity) {
        params.set('city', trimmedCity);
      }

      const trimmedKeyword = keyword.trim();
      if (trimmedKeyword) {
        params.set('keyword', trimmedKeyword);
      }

      if (coords) {
        params.set('lat', String(coords.lat));
        params.set('lon', String(coords.lon));
      }

      const response = await fetch(`${runtimeConfig.apiBaseUrl}/jobs/nearby-companies?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message || 'Unable to fetch nearby companies right now.';
        throw new Error(message);
      }

      const payload = (await response.json()) as {
        companies?: Company[];
        source?: string;
        anchor?: { label?: string };
        radiusKm?: number;
        mode?: string;
        count?: number;
      };

      const fetched = Array.isArray(payload.companies) ? payload.companies : [];
      setCompanies(fetched);

      const anchorLabel = payload.anchor?.label || trimmedCity || 'your area';
      setStatus(
        fetched.length > 0
          ? `Found ${fetched.length} nearby companies around ${anchorLabel}.`
          : `No companies found around ${anchorLabel}. Try another keyword or radius.`,
      );

      if (payload.source) {
        setSourceNote(`Source: ${payload.source} • Mode: ${payload.mode ?? 'standard'} • Radius: ${payload.radiusKm ?? radiusKm} km`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToTarget = (company: Company) => {
    // This would integrate with profile storage to add to target companies
    alert(`Added "${company.company}" to your target companies list`);
  };

  return (
    <div className="app-shell pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Search className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide">COMPANY DISCOVERY</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Find Nearby Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">Search by city or use your location to discover nearby companies and career links.</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (coords) {
                  setCoords(null);
                  setLocationStatus('');
                }
              }}
              placeholder="City or area (optional if using GPS)"
              className="flex-1 px-4 py-3 bg-input-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={isSearching}
              className="px-3 py-3 bg-secondary border border-border text-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              title="Use current location"
            >
              <LocateFixed className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Keyword</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="IT, fintech, health"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Radius (km)</label>
              <input
                type="number"
                min={5}
                max={100}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none transition-colors text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Limit</label>
              <input
                type="number"
                min={1}
                max={80}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none transition-colors text-sm"
              />
            </div>
          </div>
          {locationStatus && <p className="text-xs text-muted-foreground">{locationStatus}</p>}
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-amber-100 border border-amber-200 rounded-lg text-sm text-amber-800">
            <p className="font-semibold mb-1">Unable to load companies</p>
            <p>{error}</p>
          </div>
        )}

        {(status || sourceNote) && !error && (
          <div className="mb-4 p-3 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
            {status && <p className="text-foreground font-semibold">{status}</p>}
            {sourceNote && <p className="mt-1">{sourceNote}</p>}
          </div>
        )}

        {/* Companies List */}
        {companies.length > 0 && (
          <div className="space-y-3">
            {companies.map((company) => (
              <div
                key={`${company.company}-${company.address || ''}-${company.phone || ''}`}
                className="app-surface p-4 transition-all"
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="text-foreground font-semibold text-lg">{company.company}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{company.address || 'Address unavailable'}</span>
                      {typeof company.distanceKm === 'number' && (
                        <span>• {Math.round(company.distanceKm)} km</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddToTarget(company)}
                    className="px-3 py-1 bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs rounded font-semibold hover:opacity-90 transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* Company Details */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-muted-foreground">
                  <div>
                    <p className="text-muted-foreground text-[11px]">Category</p>
                    <p>{company.category || 'Company'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px]">Distance</p>
                    <p>{typeof company.distanceKm === 'number' ? `${Math.round(company.distanceKm)} km` : '—'}</p>
                  </div>
                </div>

                {/* Contact Links */}
                <div className="space-y-2">
                  {normalizeUrl(company.website || null) && (
                    <a
                      href={normalizeUrl(company.website || null)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-secondary border border-border rounded text-muted-foreground hover:text-primary transition-colors text-xs"
                    >
                      <Globe className="w-3 h-3" />
                      <span>Visit website</span>
                    </a>
                  )}

                  {company.mapsUrl && (
                    <a
                      href={company.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-secondary border border-border rounded text-muted-foreground hover:text-primary transition-colors text-xs"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Open in Maps</span>
                    </a>
                  )}

                  {company.searchUrl && (
                    <a
                      href={company.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-secondary border border-border rounded text-muted-foreground hover:text-emerald-700 transition-colors text-xs"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Search career page</span>
                    </a>
                  )}

                  {company.phone && (
                    <div className="flex items-center gap-2 p-2 bg-secondary border border-border rounded text-muted-foreground text-xs">
                      <Phone className="w-3 h-3" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {companies.length === 0 && !isSearching && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">Enter a city or use your location to get started</p>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm mt-2">Searching nearby companies...</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
