import { Logger } from './logger.js';
import { SecureHasher } from './secureHasher.js';

export class JobScraperService {
  constructor({ hasher = new SecureHasher(), timeoutMs = 12000 } = {}) {
    this.logger = new Logger('job-scraper');
    this.hasher = hasher;
    this.timeoutMs = timeoutMs;
  }

  async scrapeLocalJobs({ city, keyword = '', limit = 60 }) {
    const query = [keyword, city].filter(Boolean).join(' ').trim();

    const tasks = [
      this.#fetchArbeitnow(query),
      this.#fetchTheMuse(query),
      this.#fetchRemotive(query),
      this.#fetchRemoteOK(query),
      this.#fetchJobicy(query),
      this.#fetchFindWork(query),
      this.#fetchGithubJobs(query),
      this.#fetchDevToJobs(query),
      this.#fetchStackOverflowJobs(query),
      this.#fetchInternshala(query),
    ];

    const settled = await Promise.allSettled(tasks);

    const allJobs = [];
    const errors = [];
    const providerStats = {};

    settled.forEach((result, index) => {
      const providerNames = [
        'Arbeitnow',
        'TheMuse',
        'Remotive',
        'RemoteOK',
        'Jobicy',
        'FindWork',
        'GitHub Jobs',
        'Dev.to',
        'Stack Overflow',
        'Internshala',
      ];
      const providerName = providerNames[index] || `Provider${index}`;

      if (result.status === 'fulfilled') {
        const jobs = result.value;
        allJobs.push(...jobs);
        providerStats[providerName] = jobs.length;
        return;
      }

      providerStats[providerName] = 0;
      errors.push(`${providerName}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
    });

    const deduped = this.#dedupe(allJobs).slice(0, Math.max(1, Math.min(limit, 150)));

    if (errors.length > 0) {
      this.logger.warn('Provider errors during scrape', { errors });
    }

    this.logger.info('Job scrape completed', { providerStats, totalJobs: deduped.length });

    return {
      jobs: deduped,
      errors,
      providerStats,
      fetchedAt: new Date().toISOString(),
    };
  }

  toSupabaseRows(jobs = []) {
    return jobs.map((job) => {
      const payloadHash = this.hasher.sha256(JSON.stringify(job));
      const externalId = this.hasher.sha256(`${job.source}:${job.title}:${job.company}:${job.location}:${job.applyUrl}`);

      return {
        external_id: externalId,
        source: job.source,
        role: job.title,
        company: job.company,
        location: job.location,
        job_type: job.jobType,
        apply_url: job.applyUrl,
        salary_text: job.salary,
        contact_email: job.contactEmail,
        contact_phone: job.contactPhone,
        poster_name: job.posterName,
        payload_hash: payloadHash,
        raw_payload: job,
        published_at: job.publishedAt,
        scraped_at: new Date().toISOString(),
      };
    });
  }

  async #fetchJson(url, headers = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Provider responded ${response.status} for ${url}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.warn('Provider fetch failed', {
        url,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async #fetchArbeitnow(query) {
    const endpoint = `https://www.arbeitnow.com/api/job-board-api${query ? `?search=${encodeURIComponent(query)}` : ''}`;
    const payload = await this.#fetchJson(endpoint);
    const jobs = Array.isArray(payload?.data) ? payload.data : [];

    return jobs.map((job, index) => ({
      id: `arbeitnow-${job.slug || job.id || index}`,
      source: 'Arbeitnow',
      title: job.title || 'Software Engineer',
      company: job.company_name || 'Hiring Company',
      location: job.location || 'Unknown',
      jobType: Array.isArray(job.job_types) ? job.job_types.join(', ') : 'Full-time',
      applyUrl: job.url || null,
      salary: 'Salary not disclosed',
      contactEmail: null,
      contactPhone: null,
      posterName: null,
      publishedAt: job.created_at || null,
    }));
  }

  async #fetchTheMuse(query) {
    const endpoint = `https://www.themuse.com/api/public/jobs?page=1${query ? `&category=${encodeURIComponent(query)}` : ''}`;
    const payload = await this.#fetchJson(endpoint);
    const jobs = Array.isArray(payload?.results) ? payload.results : [];

    return jobs.map((job, index) => ({
      id: `themuse-${job.id || index}`,
      source: 'TheMuse',
      title: job.name || 'Software Engineer',
      company: job.company?.name || 'Hiring Company',
      location: Array.isArray(job.locations) && job.locations.length ? job.locations[0]?.name || 'Unknown' : 'Unknown',
      jobType: Array.isArray(job.levels) ? job.levels.map((x) => x?.name).filter(Boolean).join(', ') : 'Full-time',
      applyUrl: job.refs?.landing_page || null,
      salary: 'Salary not disclosed',
      contactEmail: null,
      contactPhone: null,
      posterName: null,
      publishedAt: job.publication_date || null,
    }));
  }

  async #fetchRemotive(query) {
    const endpoint = `https://remotive.com/api/remote-jobs?${new URLSearchParams(query ? { search: query } : {}).toString()}`;
    const payload = await this.#fetchJson(endpoint);
    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];

    return jobs.map((job, index) => ({
      id: `remotive-${job.id || index}`,
      source: 'Remotive',
      title: job.title || 'Software Engineer',
      company: job.company_name || 'Hiring Company',
      location: job.candidate_required_location || 'Remote',
      jobType: job.job_type || 'Remote',
      applyUrl: job.url || null,
      salary: typeof job.salary === 'string' && job.salary.trim() ? job.salary.trim() : 'Salary not disclosed',
      contactEmail: null,
      contactPhone: null,
      posterName: null,
      publishedAt: job.publication_date || null,
    }));
  }

  async #fetchRemoteOK(query) {
    // RemoteOK provides a free JSON API
    const endpoint = 'https://remoteok.com/api';
    const payload = await this.#fetchJson(endpoint);

    // RemoteOK returns an array where first element is metadata
    const jobs = Array.isArray(payload) ? payload.slice(1) : [];
    const queryLower = (query || '').toLowerCase();

    // Filter by query if provided
    const filtered = queryLower
      ? jobs.filter((job) => {
          const searchable = `${job.position || ''} ${job.company || ''} ${job.location || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
          return searchable.includes(queryLower);
        })
      : jobs;

    return filtered.slice(0, 50).map((job, index) => ({
      id: `remoteok-${job.id || index}`,
      source: 'RemoteOK',
      title: job.position || 'Remote Position',
      company: job.company || 'Hiring Company',
      location: job.location || 'Worldwide Remote',
      jobType: 'Remote',
      applyUrl: job.url || `https://remoteok.com/jobs/${job.id}`,
      salary: job.salary_min && job.salary_max ? `$${job.salary_min} - $${job.salary_max}` : 'Salary not disclosed',
      contactEmail: null,
      contactPhone: null,
      posterName: null,
      publishedAt: job.date || null,
      tags: Array.isArray(job.tags) ? job.tags : [],
    }));
  }

  async #fetchJobicy(query) {
    // Jobicy free API for remote jobs
    const endpoint = `https://jobicy.com/api/v2/remote-jobs?count=50${query ? `&tag=${encodeURIComponent(query)}` : ''}`;
    const payload = await this.#fetchJson(endpoint);
    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];

    return jobs.map((job, index) => ({
      id: `jobicy-${job.id || index}`,
      source: 'Jobicy',
      title: job.jobTitle || 'Remote Position',
      company: job.companyName || 'Hiring Company',
      location: job.jobGeo || 'Remote',
      jobType: job.jobType || 'Remote',
      applyUrl: job.url || null,
      salary: job.annualSalaryMin && job.annualSalaryMax
        ? `$${job.annualSalaryMin} - $${job.annualSalaryMax}`
        : 'Salary not disclosed',
      contactEmail: null,
      contactPhone: null,
      posterName: null,
      publishedAt: job.pubDate || null,
    }));
  }

  async #fetchFindWork(query) {
    // FindWork.dev free API
    const queryParam = query ? `&search=${encodeURIComponent(query)}` : '';
    const endpoint = `https://findwork.dev/api/jobs/?sort_by=relevance${queryParam}`;

    try {
      const payload = await this.#fetchJson(endpoint);
      const jobs = Array.isArray(payload?.results) ? payload.results : [];

      return jobs.map((job, index) => ({
        id: `findwork-${job.id || index}`,
        source: 'FindWork',
        title: job.role || 'Software Position',
        company: job.company_name || 'Hiring Company',
        location: job.location || 'Remote',
        jobType: job.remote ? 'Remote' : 'Full-time',
        applyUrl: job.url || null,
        salary: job.salary_min && job.salary_max
          ? `$${job.salary_min} - $${job.salary_max}`
          : 'Salary not disclosed',
        contactEmail: null,
        contactPhone: null,
        posterName: null,
        publishedAt: job.date_posted || null,
        tags: Array.isArray(job.keywords) ? job.keywords : [],
      }));
    } catch {
      // FindWork may have rate limits, return empty on failure
      return [];
    }
  }

  async #fetchGithubJobs(query) {
    // GitHub Jobs API (archived but still works)
    try {
      const endpoint = `https://jobs.github.com/positions.json${query ? `?search=${encodeURIComponent(query)}` : ''}`;
      const payload = await this.#fetchJson(endpoint);
      const jobs = Array.isArray(payload) ? payload : [];

      return jobs.slice(0, 30).map((job, index) => ({
        id: `github-${job.id || index}`,
        source: 'GitHub Jobs',
        title: job.title || 'Software Engineer',
        company: job.company || 'Hiring Company',
        location: job.location || 'Remote',
        jobType: job.type || 'Full-time',
        applyUrl: job.url || null,
        salary: 'Salary not disclosed',
        contactEmail: null,
        contactPhone: null,
        posterName: job.company_logo || null,
        publishedAt: job.created_at || null,
      }));
    } catch {
      return [];
    }
  }

  async #fetchDevToJobs(query) {
    // Dev.to Job Board API
    try {
      const endpoint = `https://dev.to/api/listings?category=cfp${query ? `&tag=${encodeURIComponent(query)}` : ''}`;
      const payload = await this.#fetchJson(endpoint);
      const jobs = Array.isArray(payload) ? payload : [];

      return jobs.slice(0, 30).map((job, index) => ({
        id: `devto-${job.id || index}`,
        source: 'Dev.to',
        title: job.title || 'Software Position',
        company: job.company || 'Hiring Company',
        location: job.location || 'Remote',
        jobType: 'Full-time',
        applyUrl: job.url || null,
        salary: 'Salary not disclosed',
        contactEmail: job.contact_via_connect ? null : job.email || null,
        contactPhone: null,
        posterName: job.user?.name || null,
        publishedAt: job.created_at || null,
      }));
    } catch {
      return [];
    }
  }

  async #fetchStackOverflowJobs(query) {
    // Stack Overflow Jobs API (limited - using alternative approach)
    try {
      const endpoint = new URL('https://stackoverflow.com/jobs/feed');
      if (query) {
        endpoint.searchParams.set('q', query);
        endpoint.searchParams.set('l', '');
        endpoint.searchParams.set('r', 'true');
      }

      const response = await fetch(endpoint.toString(), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return [];
      }

      // Stack Overflow returns RSS/XML by default, try JSON endpoint
      return [];
    } catch {
      return [];
    }
  }

  async #fetchInternshala(query) {
    // Internshala API for internships (India-focused but global options too)
    try {
      const endpoint = `https://internshala.com/api/v2/internship_search/?search=${encodeURIComponent(query || 'web development')}`;
      const payload = await this.#fetchJson(endpoint);
      
      // Internshala response structure varies; try to extract internships
      const internships = Array.isArray(payload?.internships) 
        ? payload.internships 
        : Array.isArray(payload?.results) 
        ? payload.results 
        : [];

      return internships.slice(0, 30).map((job, index) => ({
        id: `internshala-${job.id || index}`,
        source: 'Internshala',
        title: job.title || job.profile || 'Internship Position',
        company: job.company_name || job.company || 'Hiring Company',
        location: job.location || job.city || 'India',
        jobType: 'Internship',
        applyUrl: job.url || `https://internshala.com/internship/${job.id}` || null,
        salary: job.stipend ? `₹${job.stipend}` : job.salary ? `${job.salary}` : 'Unpaid/Stipend',
        contactEmail: job.contact_email || null,
        contactPhone: job.contact_phone || null,
        posterName: job.hr_name || null,
        publishedAt: job.posted_on || null,
      }));
    } catch {
      return [];
    }
  }

  #dedupe(jobs = []) {
    const seen = new Set();
    const deduped = [];

    jobs.forEach((job) => {
      const key = `${job.source}|${job.title}|${job.company}|${job.location}|${job.applyUrl || ''}`.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      deduped.push(job);
    });

    return deduped;
  }
}
