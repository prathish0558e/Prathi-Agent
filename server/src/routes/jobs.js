import { Router } from 'express';
import { JobRepository } from '../lib/jobRepository.js';
import { JobScraperService } from '../lib/jobScraperService.js';
import { Logger } from '../lib/logger.js';

export const jobsRouter = Router();

const jobsLogger = new Logger('jobs-route');
const jobScraperService = new JobScraperService();
const jobRepository = new JobRepository({ tableName: process.env.SUPABASE_JOBS_TABLE || 'job_opportunities' });

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_LIMIT = 300;
const cache = new Map();
const ADZUNA_COUNTRY = String(process.env.ADZUNA_COUNTRY || 'in').trim().toLowerCase();
const ADZUNA_APP_ID = String(process.env.ADZUNA_APP_ID || '').trim();
const ADZUNA_APP_KEY = String(process.env.ADZUNA_APP_KEY || '').trim();
const FINDWORK_API_KEY = String(process.env.FINDWORK_API_KEY || '').trim();
const GOOGLE_PLACES_API_KEY = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
const GOOGLE_PLACES_PREMIUM_ENABLED = String(process.env.GOOGLE_PLACES_PREMIUM_ENABLED || '').trim().toLowerCase() === 'true';
const SUPPORTED_ADZUNA_COUNTRIES = new Set(['in', 'gb', 'us', 'au', 'ca', 'nz', 'za', 'de', 'fr', 'nl', 'be', 'sg', 'pl', 'br', 'mx']);

const COUNTRY_ALIAS_TO_ADZUNA = {
  india: 'in',
  uk: 'gb',
  'united kingdom': 'gb',
  britain: 'gb',
  england: 'gb',
  usa: 'us',
  'united states': 'us',
  america: 'us',
  australia: 'au',
  canada: 'ca',
  'new zealand': 'nz',
  singapore: 'sg',
  germany: 'de',
  france: 'fr',
  netherlands: 'nl',
  belgium: 'be',
  poland: 'pl',
  brazil: 'br',
  mexico: 'mx',
  'south africa': 'za',
};

const resolveAdzunaCountry = (countryInput = '') => {
  const raw = cleanString(countryInput).toLowerCase();
  if (!raw) {
    return ADZUNA_COUNTRY;
  }

  if (raw.length === 2 && SUPPORTED_ADZUNA_COUNTRIES.has(raw)) {
    return raw;
  }

  const mapped = COUNTRY_ALIAS_TO_ADZUNA[raw];
  if (mapped && SUPPORTED_ADZUNA_COUNTRIES.has(mapped)) {
    return mapped;
  }

  return ADZUNA_COUNTRY;
};

const buildHunterQueries = ({ query = '', country = '', experienceLevel = '', yearsExperience = null, deepSearchEnabled = true }) => {
  const baseQuery = cleanString(query) || 'software developer';
  const countryToken = cleanString(country);
  const level = cleanString(experienceLevel).toLowerCase();
  const years = Number.isFinite(Number(yearsExperience)) ? Math.max(0, Number(yearsExperience)) : null;
  const fresherMode = level === 'fresher' || level === 'intern' || years === 0;

  const freshnessKeywords = fresherMode
    ? ['fresher', 'entry level', 'junior', 'internship', 'graduate trainee', 'apprentice']
    : years !== null
      ? [`${years} years`, 'mid level', 'experienced', 'specialist']
      : ['software engineer', 'developer', 'technology'];

  const coreQueries = [
    baseQuery,
    `${baseQuery} developer`,
    `${baseQuery} engineer`,
    `${baseQuery} ${freshnessKeywords[0] || ''}`.trim(),
    `${baseQuery} ${freshnessKeywords[1] || ''}`.trim(),
    `${baseQuery} remote`,
    `${baseQuery} worldwide`,
    ...freshnessKeywords.map((kw) => `${baseQuery} ${kw}`.trim()),
    'react developer remote',
    'security intern remote',
    'part time it',
  ];

  const geoQueries = countryToken
    ? [
        ...coreQueries.map((q) => `${q} ${countryToken}`.trim()),
        `${baseQuery} jobs in ${countryToken}`,
      ]
    : coreQueries;

  const unique = [...new Set(geoQueries.map((item) => cleanString(item)).filter(Boolean))];
  if (!deepSearchEnabled) {
    return unique.slice(0, 3);
  }

  return unique.slice(0, 20);
};

const CITY_COORDINATE_FALLBACKS = {
  chennai: { lat: 13.0827, lon: 80.2707, label: 'Chennai, Tamil Nadu, India' },
  bengaluru: { lat: 12.9716, lon: 77.5946, label: 'Bengaluru, Karnataka, India' },
  bangalore: { lat: 12.9716, lon: 77.5946, label: 'Bengaluru, Karnataka, India' },
  hyderabad: { lat: 17.385, lon: 78.4867, label: 'Hyderabad, Telangana, India' },
  mumbai: { lat: 19.076, lon: 72.8777, label: 'Mumbai, Maharashtra, India' },
  pune: { lat: 18.5204, lon: 73.8567, label: 'Pune, Maharashtra, India' },
  delhi: { lat: 28.6139, lon: 77.209, label: 'Delhi, India' },
};

const TAMIL_NADU_CITY_TOKENS = new Set([
  'chennai',
  'coimbatore',
  'madurai',
  'trichy',
  'tiruchirappalli',
  'salem',
  'erode',
  'tirunelveli',
  'vellore',
  'hosur',
  'thanjavur',
  'thoothukudi',
  'tuticorin',
  'nagercoil',
  'dindigul',
  'karur',
  'namakkal',
  'kanchipuram',
  'thiruvallur',
  'tiruppur',
  'kanyakumari',
]);

const normalizeCityToken = (value = '') =>
  cleanString(value)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const isTamilNaduCity = (city = '') => {
  const token = normalizeCityToken(city);
  if (!token) {
    return false;
  }

  return TAMIL_NADU_CITY_TOKENS.has(token);
};

const getTamilNaduBoostQueries = ({ city = '', keyword = '', isPartTimeMode = false }) => {
  const baseKeyword = cleanString(keyword);
  if (isPartTimeMode) {
    return [
      [baseKeyword || 'part time', city, 'entry level'].filter(Boolean).join(' '),
      [baseKeyword || 'part time', city, 'internship'].filter(Boolean).join(' '),
      [baseKeyword || 'part time', city, 'shift'].filter(Boolean).join(' '),
    ];
  }

  return [
    [baseKeyword || 'software developer', city, 'fresher'].filter(Boolean).join(' '),
    [baseKeyword || 'it support', city, 'junior'].filter(Boolean).join(' '),
    [baseKeyword || 'entry level developer', city].filter(Boolean).join(' '),
  ];
};

const getJobType = (jobTypeText = '') => {
  const normalized = String(jobTypeText || '').toLowerCase();
  if (normalized.includes('intern')) {
    return 'Internship';
  }

  if (normalized.includes('contract') || normalized.includes('freelance')) {
    return 'Contract';
  }

  if (normalized.includes('remote')) {
    return 'Remote';
  }

  return 'Full-time';
};

const getLogo = (companyName = '') => {
  const firstLetter = String(companyName || '').trim().charAt(0).toUpperCase();
  return firstLetter ? firstLetter : '🏢';
};

const sanitizeEmailPart = (value = '') => value.toLowerCase().replace(/[^a-z0-9.-]/g, '');
const cleanString = (value = '') => String(value || '').trim();
const normalizeCompanyToken = (value = '') => cleanString(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const isLikelyUrl = (value = '') => /^https?:\/\//i.test(cleanString(value));

// Known job board and ATS domains — emails derived from these URLs are not real HR contacts
const JOB_BOARD_HOSTS = new Set([
  'remotive.com',
  'arbeitnow.com',
  'remoteok.com',
  'remoteok.io',
  'remote.co',
  'weworkremotely.com',
  'flexjobs.com',
  'indeed.com',
  'linkedin.com',
  'glassdoor.com',
  'monster.com',
  'ziprecruiter.com',
  'careerbuilder.com',
  'simplyhired.com',
  'adzuna.com',
  'boards.greenhouse.io',
  'jobs.lever.co',
  'apply.workable.com',
  'jobs.ashbyhq.com',
  'job-boards.eu.greenhouse.io',
  'job-boards.greenhouse.io',
  'themuse.com',
  'www.themuse.com',
]);

const SOCIAL_HOSTS = new Set([
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'github.com',
  'crunchbase.com',
  'medium.com',
  'glassdoor.com',
]);

const COMMON_PUBLIC_SUFFIXES = [
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'co.in',
  'org.in',
  'net.in',
  'ac.in',
  'co.jp',
  'co.kr',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'com.sg',
  'com.br',
  'com.mx',
  'co.za',
  'com.tr',
  'com.cn',
  'com.hk',
  'com.tw',
  'com.my',
];

const HR_LOCAL_PART_HINTS = ['hr', 'hiring', 'recruit', 'recruitment', 'talent', 'career', 'jobs', 'people'];
const BAD_LOCAL_PART_HINTS = ['noreply', 'no-reply', 'donotreply', 'support', 'help', 'notification', 'mailer-daemon'];

const isJobBoardHost = (hostname = '') => {
  const host = cleanString(hostname).toLowerCase().replace(/^www\./, '');
  if (!host) {
    return false;
  }

  if (JOB_BOARD_HOSTS.has(host)) {
    return true;
  }

  return [...JOB_BOARD_HOSTS].some((blockedHost) => host.endsWith(`.${blockedHost}`));
};

const getHostname = (url = '') => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const getDomainFromEmail = (email = '') => cleanString(email).split('@')[1]?.toLowerCase() || '';

const isSocialHost = (hostname = '') => {
  const host = cleanString(hostname).toLowerCase().replace(/^www\./, '');
  if (!host) {
    return false;
  }

  if (SOCIAL_HOSTS.has(host)) {
    return true;
  }

  return [...SOCIAL_HOSTS].some((blockedHost) => host.endsWith(`.${blockedHost}`));
};

const getRootDomain = (hostname = '') => {
  const host = cleanString(hostname).toLowerCase().replace(/^www\./, '');
  if (!host) {
    return '';
  }

  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }

  const lastTwo = parts.slice(-2).join('.');
  const lastThree = parts.slice(-3).join('.');

  if (COMMON_PUBLIC_SUFFIXES.includes(lastTwo)) {
    return lastThree;
  }

  return lastTwo;
};

const guessHrEmailFromDomain = (domain = '') => {
  const root = getRootDomain(domain);
  if (!root) {
    return null;
  }

  return {
    email: `careers@${root}`,
    confidence: 38,
    source: 'domain-guess',
  };
};

const toAbsoluteUrl = (rawUrl = '', baseUrl = '') => {
  const candidate = cleanString(rawUrl);
  if (!candidate) {
    return null;
  }

  if (isLikelyUrl(candidate)) {
    return candidate;
  }

  if (candidate.startsWith('/') && isLikelyUrl(baseUrl)) {
    try {
      return new URL(candidate, baseUrl).toString();
    } catch {
      return null;
    }
  }

  return null;
};

const extractEmailsFromText = (text = '') => {
  const normalizedText = cleanString(text)
    .replace(/&#64;|&commat;/gi, '@')
    .replace(/\(at\)|\[at\]/gi, '@')
    .replace(/\(dot\)|\[dot\]/gi, '.');

  const matches = normalizedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const unique = new Set();

  matches.forEach((email) => {
    unique.add(email.toLowerCase());
  });

  return [...unique];
};

const stripHtmlNoise = (html = '') =>
  String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isLikelyEpoch = (digits = '') => {
  if (digits.length < 10 || digits.length > 13) {
    return false;
  }

  const num = Number(digits);
  return Number.isFinite(num) && num > 1_500_000_000 && num < 2_500_000_000_000;
};

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '');

const toRadians = (value = 0) => (value * Math.PI) / 180;
const haversineKm = (from = { lat: 0, lon: 0 }, to = { lat: 0, lon: 0 }) => {
  const earthRadiusKm = 6371;
  const latDiff = toRadians((to.lat || 0) - (from.lat || 0));
  const lonDiff = toRadians((to.lon || 0) - (from.lon || 0));

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRadians(from.lat || 0)) * Math.cos(toRadians(to.lat || 0)) * Math.sin(lonDiff / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const geocodeCity = async (city = '') => {
  const normalizedCity = cleanString(city);
  if (!normalizedCity) {
    return null;
  }

  const endpoint = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    format: 'jsonv2',
    q: normalizedCity,
    limit: '1',
    addressdetails: '1',
  }).toString()}`;

  const payload = await fetchJson(endpoint, 9000, {
    accept: 'application/json',
    'user-agent': 'career-agent-bot',
  });

  if (!Array.isArray(payload) || payload.length === 0) {
    return CITY_COORDINATE_FALLBACKS[normalizedCity.toLowerCase()] || null;
  }

  const [first] = payload;
  return {
    lat: Number(first?.lat),
    lon: Number(first?.lon),
    label: cleanString(first?.display_name) || normalizedCity,
  };
};

const fetchNearbyFromVariants = async ({ useGooglePremium, anchor, radiusKm, limit, keyword }) => {
  const variants = [
    cleanString(keyword) || 'IT',
    'IT park',
    'software company',
    'technology park',
    'tech park',
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  const seen = new Set();
  const merged = [];

  for (const variant of variants) {
    const items = useGooglePremium
      ? await fetchGooglePlacesNearby({
          lat: anchor.lat,
          lon: anchor.lon,
          radiusKm,
          limit,
          keyword: variant,
        })
      : await fetchNearbyCompanyPlaces({
          lat: anchor.lat,
          lon: anchor.lon,
          radiusKm,
          limit,
          keyword: variant,
        });

    items.forEach((item) => {
      const key = `${cleanString(item.company).toLowerCase()}|${Number(item.lat || 0).toFixed(4)}|${Number(item.lon || 0).toFixed(4)}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(item);
    });

    if (merged.length >= limit) {
      break;
    }
  }

  return merged
    .sort((a, b) => Number(a.distanceKm || 0) - Number(b.distanceKm || 0))
    .slice(0, limit);
};

const fetchNominatimCompanies = async ({ city = '', keyword = '', anchor = { lat: 0, lon: 0 }, limit = 20 }) => {
  const searchTerm = cleanString(keyword) || 'IT';
  const queryVariants = [
    `${searchTerm} park ${city}`,
    `technology park ${city}`,
    `IT park ${city}`,
    `${searchTerm} company ${city}`,
  ];

  const payloads = await Promise.all(
    queryVariants.map((q) => {
      const endpoint = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        format: 'jsonv2',
        q,
        limit: String(Math.min(25, Math.max(5, limit))),
        addressdetails: '1',
      }).toString()}`;

      return fetchJson(endpoint, 9000, {
        accept: 'application/json',
        'user-agent': 'career-agent-bot',
      }).catch(() => []);
    }),
  );

  const entries = payloads.flatMap((payload) => (Array.isArray(payload) ? payload : []));
  const excludedTypePattern = /(hospital|clinic|school|college|university|religion|restaurant|hotel)/i;
  const seen = new Set();

  return entries
    .map((entry) => {
      const name = cleanString(entry?.name || String(entry?.display_name || '').split(',')[0]);
      const address = cleanString(entry?.display_name);
      const itemLat = Number(entry?.lat);
      const itemLon = Number(entry?.lon);

      if (!name || !address || !Number.isFinite(itemLat) || !Number.isFinite(itemLon)) {
        return null;
      }

      const mapsQuery = encodeURIComponent(`${name} ${address}`);
      return {
        company: name,
        category: cleanString(entry?.type || entry?.class || 'it-company'),
        address,
        lat: itemLat,
        lon: itemLon,
        distanceKm: Math.round(haversineKm({ lat: anchor.lat, lon: anchor.lon }, { lat: itemLat, lon: itemLon })),
        phone: null,
        website: null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
        searchUrl: `https://www.google.com/search?q=${mapsQuery}`,
      };
    })
    .filter(Boolean)
    .filter((entry) => !excludedTypePattern.test(entry.category))
    .filter((entry) => {
      const key = `${entry.company}|${entry.address}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const fetchGooglePlacesNearby = async ({ lat, lon, radiusKm = 50, limit = 20, keyword = '' }) => {
  if (!GOOGLE_PLACES_API_KEY) {
    return [];
  }

  const radiusMeters = Math.min(100, Math.max(5, Number(radiusKm) || 50)) * 1000;
  const query = cleanString(keyword || 'IT company');
  const endpoint = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${new URLSearchParams({
    key: GOOGLE_PLACES_API_KEY,
    location: `${Number(lat)},${Number(lon)}`,
    radius: String(radiusMeters),
    keyword: query,
    language: 'en',
  }).toString()}`;

  const payload = await fetchJson(endpoint, 9000);
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const topResults = results.slice(0, Math.max(1, Math.min(limit, 20)));

  const details = await Promise.all(
    topResults.map(async (place) => {
      const placeId = cleanString(place?.place_id);
      if (!placeId) {
        return {
          phone: null,
          website: null,
        };
      }

      const detailsEndpoint = `https://maps.googleapis.com/maps/api/place/details/json?${new URLSearchParams({
        key: GOOGLE_PLACES_API_KEY,
        place_id: placeId,
        fields: 'formatted_phone_number,international_phone_number,website',
      }).toString()}`;

      const detailsPayload = await fetchJson(detailsEndpoint, 9000).catch(() => ({}));
      const result = detailsPayload?.result || {};
      return {
        phone: cleanString(result.formatted_phone_number || result.international_phone_number) || null,
        website: cleanString(result.website) || null,
      };
    }),
  );

  return topResults.map((place, index) => {
    const placeLat = Number(place?.geometry?.location?.lat);
    const placeLon = Number(place?.geometry?.location?.lng);
    const placeName = cleanString(place?.name) || 'IT Company';
    const placeAddress = cleanString(place?.vicinity || place?.formatted_address) || 'Address not listed';
    const mapsQuery = encodeURIComponent(`${placeName} ${placeAddress}`);
    const placeId = cleanString(place?.place_id);

    return {
      company: placeName,
      category: cleanString(Array.isArray(place?.types) ? place.types[0] : 'it-company') || 'it-company',
      address: placeAddress,
      lat: Number.isFinite(placeLat) ? placeLat : Number(lat),
      lon: Number.isFinite(placeLon) ? placeLon : Number(lon),
      distanceKm: Number.isFinite(placeLat) && Number.isFinite(placeLon)
        ? Math.round(haversineKm({ lat: Number(lat), lon: Number(lon) }, { lat: placeLat, lon: placeLon }))
        : null,
      phone: details[index]?.phone || null,
      website: details[index]?.website || null,
      mapsUrl: placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
      searchUrl: `https://www.google.com/search?q=${mapsQuery}`,
    };
  });
};

const fetchNearbyCompanyPlaces = async ({ lat, lon, radiusKm = 75, limit = 50, keyword = '' }) => {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return [];
  }

  const radiusMeters = Math.min(100, Math.max(5, Number(radiusKm) || 75)) * 1000;
  const keywordRegex = cleanString(keyword).replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const normalizedKeyword = keywordRegex.toLowerCase();
  const safeKeywordPattern = normalizedKeyword && normalizedKeyword !== 'it' ? `${normalizedKeyword}|` : '';
  const nameFilter = `nwr[\"name\"~\"(${safeKeywordPattern}software|technology|technologies|tech|digital|solutions|systems|infotech)\",i]`;

  const query = `[out:json][timeout:25];\n(\n  nwr[\"office\"](around:${radiusMeters},${latitude},${longitude});\n  ${nameFilter}(around:${radiusMeters},${latitude},${longitude});\n  nwr[\"shop\"=\"computer\"](around:${radiusMeters},${latitude},${longitude});\n);\nout center tags;`;

  const rawPayload = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': 'career-agent-bot',
    },
    body: `data=${encodeURIComponent(query)}`,
  })
    .then((response) => (response.ok ? response.json() : { elements: [] }))
    .catch(() => ({ elements: [] }));

  const elements = Array.isArray(rawPayload?.elements) ? rawPayload.elements : [];
  const seen = new Set();
  const itNamePattern = /(software|technology|technologies|tech|digital|solutions|systems|infotech|it park)/i;
  const excludedCategoryPattern = /(hospital|clinic|school|college|university|government|temple|church|mosque|restaurant|hotel)/i;

  return elements
    .map((item) => {
      const tags = item?.tags || {};
      const rawName = cleanString(tags.name || tags.operator || tags.brand);
      if (!rawName) {
        return null;
      }

      const itemLat = Number(item?.lat ?? item?.center?.lat);
      const itemLon = Number(item?.lon ?? item?.center?.lon);
      if (!Number.isFinite(itemLat) || !Number.isFinite(itemLon)) {
        return null;
      }

      const key = `${rawName.toLowerCase()}|${itemLat.toFixed(4)}|${itemLon.toFixed(4)}`;
      if (seen.has(key)) {
        return null;
      }

      seen.add(key);

      const address = [
        cleanString(tags['addr:street']),
        cleanString(tags['addr:suburb']),
        cleanString(tags['addr:city']),
        cleanString(tags['addr:state']),
      ]
        .filter(Boolean)
        .join(', ');
      const mapsQuery = encodeURIComponent(`${rawName} ${address}`.trim());
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
      const searchUrl = `https://www.google.com/search?q=${mapsQuery}`;

      return {
        company: rawName,
        category: cleanString(tags.office || tags.shop || tags.amenity || 'it-company'),
        address: address || cleanString(tags['addr:full']) || 'Address not listed',
        lat: itemLat,
        lon: itemLon,
        distanceKm: Math.round(haversineKm({ lat: latitude, lon: longitude }, { lat: itemLat, lon: itemLon })),
        phone: cleanString(tags.phone || tags['contact:phone']) || null,
        website: toAbsoluteUrl(tags.website || tags['contact:website'] || '', '') || null,
        hasOfficeTag: Boolean(tags.office),
        mapsUrl,
        searchUrl,
      };
    })
    .filter(Boolean)
    .filter((entry) => {
      const normalizedCategory = cleanString(entry.category).toLowerCase();
      if (excludedCategoryPattern.test(normalizedCategory)) {
        return false;
      }

      const looksLikeOffice = entry.hasOfficeTag && normalizedCategory !== 'government';
      return looksLikeOffice || itNamePattern.test(entry.company);
    })
    .map(({ hasOfficeTag, ...entry }) => entry)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(1, Math.min(limit, 80)));
};

const extractPhoneNumbersFromText = (text = '') => {
  const matches = String(text || '').match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g) || [];
  const cleaned = matches
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 14) {
        return false;
      }

      if (isLikelyEpoch(digits)) {
        return false;
      }

      return !/(\d)\1{7,}/.test(digits);
    });
  return [...new Set(cleaned)].slice(0, 2);
};

const extractPosterNameFromText = (text = '') => {
  const normalized = String(text || '');
  const byLine = normalized.match(/(?:contact|posted by|recruiter)\s*[:\-]\s*([A-Za-z][A-Za-z\s.'-]{2,60})/i);
  if (byLine?.[1]) {
    return byLine[1].trim();
  }

  return null;
};

const extractContactSignalsFromHtml = (html = '') => {
  const visibleText = stripHtmlNoise(html);
  const mailtoMatches = String(html || '').match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
  const telMatches = String(html || '').match(/tel:([+\d][\d\-\s().]{7,})/gi) || [];

  const emails = [
    ...extractEmailsFromText(visibleText),
    ...mailtoMatches.map((entry) => entry.replace(/^mailto:/i, '').trim().toLowerCase()),
  ];

  const phones = [
    ...telMatches.map((entry) => entry.replace(/^tel:/i, '').trim()),
    ...extractPhoneNumbersFromText(visibleText),
  ]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const uniquePhones = [];
  const seenPhoneKeys = new Set();
  phones.forEach((phone) => {
    const key = normalizePhone(phone);
    if (!key || seenPhoneKeys.has(key)) {
      return;
    }

    seenPhoneKeys.add(key);
    uniquePhones.push(phone);
  });

  const posterName = extractPosterNameFromText(visibleText);

  return {
    emails: [...new Set(emails)],
    phones: uniquePhones.slice(0, 2),
    posterName,
  };
};

const extractCompanyWebsiteFromHtml = (html = '', companyName = '') => {
  const links = String(html || '').match(/href=["'](https?:\/\/[^"'\s>]+)["']/gi) || [];
  const companyToken = normalizeCompanyToken(companyName);

  const candidates = links
    .map((entry) => entry.replace(/href=["']/i, '').replace(/["']$/, '').trim())
    .map((url) => ({ url, host: getHostname(url) }))
    .filter((item) => item.host && !isJobBoardHost(item.host) && !isSocialHost(item.host))
    .map((item) => {
      let score = 10;
      const hostToken = item.host.replace(/[^a-z0-9]/g, '');
      if (companyToken && hostToken.includes(companyToken.slice(0, 6))) {
        score += 20;
      }
      if (/(careers|jobs|about|contact|team|people|work-with-us|join-us)/i.test(item.url)) {
        score += 12;
      }
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.url || null;
};

const scoreHrEmail = ({ email, companyName = '', url = '' }) => {
  const normalizedEmail = cleanString(email).toLowerCase();
  if (!normalizedEmail.includes('@')) {
    return 0;
  }

  const localPart = normalizedEmail.split('@')[0] || '';
  const domain = getDomainFromEmail(normalizedEmail);
  if (!domain || isJobBoardHost(domain)) {
    return 0;
  }

  let score = 48;
  if (HR_LOCAL_PART_HINTS.some((hint) => localPart.includes(hint))) {
    score += 24;
  }
  if (BAD_LOCAL_PART_HINTS.some((hint) => localPart.includes(hint))) {
    score -= 35;
  }

  if (localPart.length <= 1 || domain.length < 4) {
    score -= 15;
  }

  const host = getHostname(url);
  if (host && (domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`))) {
    score += 10;
  }

  const companyToken = normalizeCompanyToken(companyName);
  if (companyToken && domain.replace(/[^a-z0-9]/g, '').includes(companyToken.slice(0, 7))) {
    score += 8;
  }

  return Math.max(0, Math.min(98, score));
};

const fetchText = async (url, timeoutMs = 8500) => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'user-agent': 'career-agent-bot',
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      return '';
    }

    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

const extractHrEmailFromPage = async ({ companyName = '', applyUrl = '' }) => {
  const resolvedApplyUrl = toAbsoluteUrl(applyUrl, applyUrl);
  if (!resolvedApplyUrl) {
    return null;
  }

  const html = await fetchText(resolvedApplyUrl);
  if (!html) {
    return null;
  }

  const parsedSignals = extractContactSignalsFromHtml(html);
  const companyWebsite = extractCompanyWebsiteFromHtml(html, companyName);

  const emailCandidates = parsedSignals.emails
    .map((email) => ({
      email,
      score: scoreHrEmail({ email, companyName, url: resolvedApplyUrl }),
    }))
    .filter((candidate) => candidate.score >= 45)
    .sort((a, b) => b.score - a.score);

  const phoneCandidates = parsedSignals.phones;
  const posterName = parsedSignals.posterName;

  if (!emailCandidates.length) {
    return {
      hrEmail: null,
      hrEmailConfidence: 0,
      hrEmailSource: 'unavailable',
      hrEmailStatus: 'unavailable',
      contactPhone: phoneCandidates[0] || null,
      posterName,
      companyWebsite,
    };
  }

  const best = emailCandidates[0];
  return {
    hrEmail: best.email,
    hrEmailConfidence: best.score,
    hrEmailSource: 'job-posting',
    hrEmailStatus: 'verified',
    contactPhone: phoneCandidates[0] || null,
    posterName,
    companyWebsite,
  };
};

const fetchAdzunaJobs = async ({ query = '', city = '', resultsPerPage = 50, page = 1, country = ADZUNA_COUNTRY }) => {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    return [];
  }

  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    results_per_page: String(Math.min(50, Math.max(5, resultsPerPage))),
    'content-type': 'application/json',
  });

  if (query.trim()) {
    params.set('what', query.trim());
  }

  if (city.trim()) {
    params.set('where', city.trim());
  }

  const safePage = Math.max(1, Number(page) || 1);
  const adzunaCountry = resolveAdzunaCountry(country);
  const endpoint = `https://api.adzuna.com/v1/api/jobs/${adzunaCountry}/search/${safePage}?${params.toString()}`;
  const payload = await fetchJson(endpoint, 9500);
  return Array.isArray(payload?.results) ? payload.results : [];
};

const fetchMuseJobsAcrossPages = async ({ category = '', pages = 2 }) => {
  const totalPages = Math.min(6, Math.max(1, Number(pages) || 2));
  const pageRequests = Array.from({ length: totalPages }).map((_, index) => {
    const page = index + 1;
    const museUrl = `https://www.themuse.com/api/public/jobs?page=${page}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
    return fetchJson(museUrl);
  });

  const pagePayloads = await Promise.all(pageRequests);
  return pagePayloads.flatMap((payload) => (Array.isArray(payload?.results) ? payload.results : []));
};

const fetchRemotiveBySearches = async (searches = []) => {
  const normalizedSearches = [...new Set(searches.map((item) => cleanString(item)).filter(Boolean))];
  if (!normalizedSearches.length) {
    const payload = await fetchJson('https://remotive.com/api/remote-jobs?');
    return Array.isArray(payload?.jobs) ? payload.jobs : [];
  }

  const payloads = await Promise.all(
    normalizedSearches.map((search) => {
      const remotiveUrl = `https://remotive.com/api/remote-jobs?${new URLSearchParams({ search }).toString()}`;
      return fetchJson(remotiveUrl);
    }),
  );

  const seen = new Set();
  const merged = [];
  payloads.forEach((payload) => {
    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    jobs.forEach((job, index) => {
      const key = `${job?.id || ''}|${job?.url || ''}|${job?.title || ''}|${job?.company_name || ''}|${index}`.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(job);
    });
  });

  return merged;
};

const fetchAdzunaByQueries = async ({ queries = [], city = '', resultsPerPage = 50, pages = 1, country = ADZUNA_COUNTRY }) => {
  const uniqueQueries = [...new Set(queries.map((item) => cleanString(item)).filter(Boolean))];
  if (!uniqueQueries.length) {
    return [];
  }

  // Keep Adzuna calls conservative for free-tier API keys to reduce 429/rate-limit drops.
  const cappedQueries = uniqueQueries.slice(0, 4);
  const pageCount = Math.min(2, Math.max(1, Number(pages) || 1));
  const tasks = [];
  cappedQueries.forEach((query) => {
    for (let page = 1; page <= pageCount; page += 1) {
      tasks.push(fetchAdzunaJobs({ query, city, resultsPerPage, page, country }));
    }
  });

  const results = await Promise.all(tasks);
  const flattened = results.flat();

  if (flattened.length > 0) {
    return flattened;
  }

  // Retry once with broad fallback query if all capped lookups returned empty.
  const fallbackQuery = cleanString(cappedQueries[0] || uniqueQueries[0] || 'software developer');
  return fetchAdzunaJobs({ query: fallbackQuery, city, resultsPerPage, page: 1, country });
};

const fetchStackOverflowJobs = async ({ query = '', limit = 50 } = {}) => {
  try {
    const endpoint = 'https://stackoverflow.com/jobs/feed?searchTerm=' + encodeURIComponent(query || 'developer');
    const response = await fetch(endpoint, {
      headers: { 'user-agent': 'career-agent-bot' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const text = await response.text();
    const jobs = [];
    const itemRegex = /<item>[\s\S]*?<\/item>/g;
    const matches = text.match(itemRegex) || [];
    
    matches.slice(0, limit).forEach((item) => {
      const titleMatch = item.match(/<title>([^<]+)<\/title>/);
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      const descMatch = item.match(/<description>([^<]+)<\/description>/);
      const companyMatch = item.match(/at\s+<b>([^<]+)<\/b>/) || item.match(/at\s+([^<,]+)/);
      
      if (titleMatch?.[1]) {
        jobs.push({
          id: `stackoverflow-${Math.random().toString(36).slice(2)}`,
          title: titleMatch[1].trim(),
          url: linkMatch?.[1]?.trim() || null,
          company_name: companyMatch?.[1]?.trim() || 'Hiring Company',
          description: descMatch?.[1]?.trim() || '',
          job_type: 'Full-time',
          candidate_required_location: 'Worldwide',
          tags: ['fullstack'],
          source: 'stackoverflow',
        });
      }
    });
    return jobs;
  } catch {
    return [];
  }
};

const fetchJustjoinedJobs = async ({ query = '', limit = 50 } = {}) => {
  try {
    // JustJoined.it API provides job listings
    const endpoint = `https://justjoined.it/api/offers?pageSize=${Math.min(limit, 100)}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    const payload = await fetchJson(endpoint, 8000);
    
    if (!Array.isArray(payload?.data)) return [];
    
    return payload.data.slice(0, limit).map((job, index) => ({
      id: `justjoined-${job.id || index}`,
      title: job.title || 'Developer Position',
      url: job.url || null,
      company_name: job.company || 'Hiring Company',
      description: job.description || '',
      job_type: 'Full-time',
      candidate_required_location: job.location || 'Worldwide',
      tags: job.skills || [],
      source: 'justjoined',
    }));
  } catch {
    return [];
  }
};

const fetchHumanBrainJobs = async ({ query = '', limit = 50 } = {}) => {
  try {
    const endpoint = `https://humanbrain.ai/api/jobs?limit=${limit}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    const payload = await fetchJson(endpoint, 8000);
    
    if (!Array.isArray(payload?.jobs)) return [];
    
    return payload.jobs.slice(0, limit).map((job, index) => ({
      id: `humanbrain-${job.id || index}`,
      title: job.title || 'Position',
      url: job.link || null,
      company_name: job.company || 'Hiring Company',
      description: job.description || '',
      job_type: job.type || 'Full-time',
      candidate_required_location: job.location || 'Worldwide',
      tags: job.tags || [],
      source: 'humanbrain',
    }));
  } catch {
    return [];
  }
};

const fetchWorkableJobs = async ({ query = '', limit = 40 } = {}) => {
  try {
    const endpoint = `https://api.workable.com/v1/jobs?limit=${Math.min(limit, 50)}${query ? `&query=${encodeURIComponent(query)}` : ''}`;
    const payload = await fetchJson(endpoint, 8000);
    
    if (!Array.isArray(payload?.jobs)) return [];
    
    return payload.jobs.slice(0, limit).map((job, index) => ({
      id: `workable-${job.id || index}`,
      title: job.title || 'Position',
      url: job.url || null,
      company_name: job.company?.name || 'Hiring Company',
      description: job.description || '',
      job_type: job.employment_type || 'Full-time',
      candidate_required_location: job.location?.name || 'Worldwide',
      tags: (job.tags || []).map((t) => t.name || String(t)),
      source: 'workable',
    }));
  } catch {
    return [];
  }
};

const fetchFunctionalWorksJobs = async ({ query = '', limit = 50 } = {}) => {
  try {
    const endpoint = `https://api.functionalworks.com/api/jobs/search?limit=${limit}${query ? `&keyword=${encodeURIComponent(query)}` : ''}`;
    const payload = await fetchJson(endpoint, 8000);
    
    if (!Array.isArray(payload?.data)) return [];
    
    return payload.data.slice(0, limit).map((job, index) => ({
      id: `functionalworks-${job.id || index}`,
      title: job.title || 'Position',
      url: job.url || null,
      company_name: job.company || 'Hiring Company',
      description: job.description || '',
      job_type: job.type || 'Full-time',
      candidate_required_location: job.location || 'Worldwide',
      tags: ['functional', 'programming'],
      source: 'functionalworks',
    }));
  } catch {
    return [];
  }
};

const fetchJobicyJobs = async ({ query = '', limit = 50 } = {}) => {
  try {
    const endpoint = `https://jobicy.com/api/v2/remote-jobs?count=${Math.min(limit, 50)}${query ? `&tag=${encodeURIComponent(query)}` : ''}`;
    const payload = await fetchJson(endpoint, 8000);
    if (!Array.isArray(payload?.jobs)) return [];

    return payload.jobs.slice(0, limit).map((job, index) => ({
      id: `jobicy-${job.id || index}`,
      title: job.jobTitle || 'Remote Position',
      url: job.url || null,
      company_name: job.companyName || 'Hiring Company',
      description: job.jobDescription || '',
      job_type: job.jobType || 'Remote',
      candidate_required_location: job.jobGeo || 'Remote',
      tags: Array.isArray(job.jobTags) ? job.jobTags : [],
      source: 'jobicy',
    }));
  } catch {
    return [];
  }
};

const fetchFindWorkJobs = async ({ query = '', limit = 50 } = {}) => {
  if (!FINDWORK_API_KEY) {
    return [];
  }

  try {
    const endpoint = `https://findwork.dev/api/jobs/?sort_by=relevance${query ? `&search=${encodeURIComponent(query)}` : ''}`;
    const payload = await fetchJson(endpoint, 8000, {
      Authorization: `Token ${FINDWORK_API_KEY}`,
    });
    if (!Array.isArray(payload?.results)) return [];

    return payload.results.slice(0, limit).map((job, index) => ({
      id: `findwork-${job.id || index}`,
      title: job.role || 'Software Engineer',
      url: job.url || null,
      company_name: job.company_name || 'Hiring Company',
      description: job.text || '',
      job_type: job.employment_type || 'Full-time',
      candidate_required_location: job.location || 'Remote',
      tags: Array.isArray(job.keywords) ? job.keywords : [],
      source: 'findwork',
    }));
  } catch {
    return [];
  }
};

const normalizeStackOverflow = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `stackoverflow-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Worldwide',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'StackOverflow',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 68,
    securityScore: 5,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 24,
    hrEmailSource: 'domain-guess',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: null,
    tags: job.tags || [],
  }));

const normalizeJustjoined = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `justjoined-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Worldwide',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'JustJoined',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 62,
    securityScore: 4,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 28,
    hrEmailSource: 'domain-guess',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: null,
    tags: job.tags || [],
  }));

const normalizeWorkable = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `workable-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Worldwide',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'Workable',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 70,
    securityScore: 5,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 32,
    hrEmailSource: 'workable-platform',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: null,
    tags: job.tags || [],
  }));

const normalizeHumanbrain = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `humanbrain-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Worldwide',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'HumanBrain',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 61,
    securityScore: 4,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 24,
    hrEmailSource: 'domain-guess',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: null,
    tags: job.tags || [],
  }));

const normalizeFunctionalworks = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `functionalworks-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Worldwide',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'FunctionalWorks',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 59,
    securityScore: 4,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 22,
    hrEmailSource: 'domain-guess',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: null,
    tags: job.tags || [],
  }));

const normalizeJobicy = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `jobicy-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Remote',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'Jobicy',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 60,
    securityScore: 4,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 26,
    hrEmailSource: 'domain-guess',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: job.publishedAt || null,
    tags: job.tags || [],
  }));

const normalizeFindWork = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => ({
    id: `findwork-${job.id || index}`,
    company: job.company_name || 'Hiring Company',
    role: job.title || 'Software Engineer',
    location: job.candidate_required_location || 'Remote',
    type: getJobType(job.job_type),
    logo: getLogo(job.company_name || ''),
    source: 'FindWork',
    matchPercentage: scoreFromText(`${job.title} ${job.company_name}`, queryTerms),
    interviewChance: 60,
    securityScore: 4,
    verified: true,
    requiresResumeTailor: true,
    applyUrl: job.url || null,
    salary: 'Salary not disclosed',
    hrEmail: getHrEmail(job.company_name || '', job.url || ''),
    hrEmailConfidence: 26,
    hrEmailSource: 'domain-guess',
    hrEmailStatus: 'unverified',
    contactPhone: null,
    posterName: null,
    publishedAt: job.publishedAt || null,
    tags: job.tags || [],
  }));

const getHrEmail = (companyName = '', applyUrl = '') => {
  // Keep this synchronous helper for payload-level values only. Real extraction happens later.
  const hostname = getHostname(applyUrl);
  if (!hostname || isJobBoardHost(hostname)) {
    return null;
  }

  const rootDomain = sanitizeEmailPart(getRootDomain(hostname));
  if (!rootDomain) {
    return null;
  }

  return `careers@${rootDomain}`;
};

const scoreFromText = (text, queryTerms) => {
  if (!queryTerms.length) {
    return 72;
  }

  const normalizedText = String(text || '').toLowerCase();
  const matchedTerms = queryTerms.filter((term) => normalizedText.includes(term));
  return Math.min(96, 60 + matchedTerms.length * 12);
};

const normalizeRemotive = (jobs = [], queryTerms = []) =>
  jobs.map((job) => {
    const role = job.title || 'Software Engineer';
    const company = job.company_name || 'Hiring Company';
    const location = job.candidate_required_location || 'Worldwide';
    const tags = Array.isArray(job.tags) ? job.tags : [];
    const scoreSeed = `${role} ${company} ${location} ${tags.join(' ')}`;
    const matchPercentage = scoreFromText(scoreSeed, queryTerms);

    return {
      id: `remotive-${job.id || Math.floor(Math.random() * 100000000)}`,
      company,
      role,
      location,
      type: getJobType(job.job_type),
      logo: getLogo(company),
      source: 'Remotive',
      matchPercentage,
      interviewChance: Math.max(40, matchPercentage - 14),
      securityScore: 4,
      verified: true,
      requiresResumeTailor: matchPercentage < 85,
      applyUrl: job.url || null,
      salary: typeof job.salary === 'string' && job.salary.trim() ? job.salary.trim() : 'Salary not disclosed',
      hrEmail: getHrEmail(company, job.url || ''),
      hrEmailConfidence: 28,
      hrEmailSource: 'domain-guess',
      hrEmailStatus: 'unverified',
      contactPhone: null,
      posterName: null,
      publishedAt: job.publication_date || null,
      tags,
    };
  });

const normalizeArbeitnow = (jobs = [], queryTerms = []) =>
  jobs.map((job, index) => {
    const role = job.title || 'Software Engineer';
    const company = job.company_name || 'Hiring Company';
    const location = job.location || 'Worldwide';
    const tags = Array.isArray(job.tags) ? job.tags : [];
    const scoreSeed = `${role} ${company} ${location} ${tags.join(' ')}`;
    const matchPercentage = scoreFromText(scoreSeed, queryTerms);

    return {
      id: `arbeitnow-${job.slug || job.id || index}`,
      company,
      role,
      location,
      type: getJobType(Array.isArray(job.job_types) ? job.job_types.join(' ') : ''),
      logo: getLogo(company),
      source: 'Arbeitnow',
      matchPercentage,
      interviewChance: Math.max(40, matchPercentage - 12),
      securityScore: 4,
      verified: true,
      requiresResumeTailor: matchPercentage < 85,
      applyUrl: job.url || null,
      salary: 'Salary not disclosed',
      hrEmail: getHrEmail(company, job.url || ''),
      hrEmailConfidence: 28,
      hrEmailSource: 'domain-guess',
      hrEmailStatus: 'unverified',
      contactPhone: null,
      posterName: null,
      publishedAt: job.created_at || null,
      tags,
    };
  });

const normalizeRemoteOk = (jobs = [], queryTerms = []) =>
  jobs
    .filter((job) => job && typeof job === 'object' && job.position)
    .map((job, index) => {
      const role = job.position || 'Software Engineer';
      const company = job.company || 'Hiring Company';
      const location = job.location || 'Worldwide';
      const tags = Array.isArray(job.tags) ? job.tags : [];
      const scoreSeed = `${role} ${company} ${location} ${tags.join(' ')}`;
      const matchPercentage = scoreFromText(scoreSeed, queryTerms);

      return {
        id: `remoteok-${job.id || index}`,
        company,
        role,
        location,
        type: getJobType(job.tags?.join(' ') || ''),
        logo: getLogo(company),
        source: 'RemoteOK',
        matchPercentage,
        interviewChance: Math.max(40, matchPercentage - 10),
        securityScore: 4,
        verified: true,
        requiresResumeTailor: matchPercentage < 85,
        applyUrl: job.url || null,
        salary: typeof job.salary === 'string' && job.salary.trim() ? job.salary.trim() : 'Salary not disclosed',
        hrEmail: getHrEmail(company, job.url || ''),
        hrEmailConfidence: 28,
        hrEmailSource: 'domain-guess',
        hrEmailStatus: 'unverified',
        contactPhone: null,
        posterName: null,
        publishedAt: job.date || null,
        tags,
      };
    });

const normalizeMuse = (jobs = [], queryTerms = []) =>
  jobs
    .filter((job) => job && typeof job === 'object')
    .map((job, index) => {
      const role = job.name || 'Software Engineer';
      const company = job.company?.name || 'Hiring Company';
      const location = Array.isArray(job.locations) && job.locations.length ? job.locations[0]?.name || 'Worldwide' : 'Worldwide';
      const levels = Array.isArray(job.levels) ? job.levels.map((item) => item?.name).filter(Boolean) : [];
      const categories = Array.isArray(job.categories) ? job.categories.map((item) => item?.name).filter(Boolean) : [];
      const tags = [...levels, ...categories].filter(Boolean);
      const scoreSeed = `${role} ${company} ${location} ${tags.join(' ')}`;
      const matchPercentage = scoreFromText(scoreSeed, queryTerms);
      const applyUrl = job.refs?.landing_page || null;

      return {
        id: `themuse-${job.id || index}`,
        company,
        role,
        location,
        type: getJobType(tags.join(' ')),
        logo: getLogo(company),
        source: 'TheMuse',
        matchPercentage,
        interviewChance: Math.max(40, matchPercentage - 11),
        securityScore: 4,
        verified: true,
        requiresResumeTailor: matchPercentage < 85,
        applyUrl,
        salary: 'Salary not disclosed',
        hrEmail: getHrEmail(company, applyUrl || ''),
        hrEmailConfidence: 28,
        hrEmailSource: 'domain-guess',
        hrEmailStatus: 'unverified',
        contactPhone: null,
        posterName: null,
        publishedAt: job.publication_date || null,
        tags,
      };
    });

const normalizeAdzuna = (jobs = [], queryTerms = []) =>
  jobs
    .filter((job) => job && typeof job === 'object')
    .map((job, index) => {
      const role = job.title || 'Software Engineer';
      const company = job.company?.display_name || 'Hiring Company';
      const location = job.location?.display_name || 'Unknown';
      const tagCandidates = [job.category?.label, job.contract_time, job.contract_type].filter(Boolean);
      const tags = tagCandidates.map((tag) => String(tag));
      const scoreSeed = `${role} ${company} ${location} ${tags.join(' ')}`;
      const matchPercentage = scoreFromText(scoreSeed, queryTerms);

      const minSalary = Number(job.salary_min || 0);
      const maxSalary = Number(job.salary_max || 0);
      const salary = minSalary > 0 || maxSalary > 0 ? `${minSalary || 0} - ${maxSalary || 0}` : 'Salary not disclosed';

      return {
        id: `adzuna-${job.id || index}`,
        company,
        role,
        location,
        type: getJobType(`${job.contract_time || ''} ${job.contract_type || ''}`),
        logo: getLogo(company),
        source: 'Adzuna',
        matchPercentage,
        interviewChance: Math.max(42, matchPercentage - 10),
        securityScore: 4,
        verified: true,
        requiresResumeTailor: matchPercentage < 85,
        applyUrl: job.redirect_url || null,
        salary,
        hrEmail: getHrEmail(company, job.redirect_url || ''),
        hrEmailConfidence: 30,
        hrEmailSource: 'domain-guess',
        hrEmailStatus: 'unverified',
        contactPhone: null,
        posterName: null,
        publishedAt: job.created || null,
        tags,
      };
    });

const filterByQueryTerms = (jobs, queryTerms) => {
  if (!queryTerms.length) {
    return jobs;
  }

  return jobs.filter((job) => {
    const searchableText = `${job.role} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`.toLowerCase();
    const matchedCount = queryTerms.filter((term) => searchableText.includes(term)).length;
    return matchedCount >= 1;
  });
};

const hasPartTimeSignals = (job = {}) => {
  const text = `${job.role || ''} ${job.type || ''} ${job.location || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  const signals = [
    'part time',
    'part-time',
    'contract',
    'intern',
    'internship',
    'temporary',
    'freelance',
    'shift',
    'weekend',
    'hourly',
    'flexible',
    'wfh',
    'work from home',
  ];
  return signals.some((signal) => text.includes(signal));
};

const parseExperienceYearsHint = (job = {}) => {
  const text = `${job.role || ''} ${job.location || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  const rangeMatch = text.match(/(\d{1,2})\s*(?:\+|\-|to)\s*(\d{1,2})\s*(?:years|yrs|year|yr)/i);
  if (rangeMatch) {
    return {
      minYears: Number(rangeMatch[1]) || 0,
      maxYears: Number(rangeMatch[2]) || null,
    };
  }

  const singleMatch = text.match(/(\d{1,2})\s*\+?\s*(?:years|yrs|year|yr)/i);
  if (singleMatch) {
    return {
      minYears: Number(singleMatch[1]) || 0,
      maxYears: null,
    };
  }

  return {
    minYears: null,
    maxYears: null,
  };
};

const getExperienceBand = (job = {}) => {
  const text = `${job.role || ''} ${(job.tags || []).join(' ')} ${job.type || ''}`.toLowerCase();
  if (/\b(senior|sr\.?|lead|principal|staff|manager|architect|head|chief|director|vp|vice president|officer|cxo|cto|ceo|cfo|coo)\b/.test(text)) {
    return 'senior';
  }

  if (/\b(fresher|entry|entry-level|junior|jr\.?|graduate|trainee|intern|internship|apprentice)\b/.test(text)) {
    return 'entry';
  }

  return 'general';
};

const isRelevantPartTimeRole = (job = {}) => {
  const text = `${job.role || ''} ${job.type || ''} ${job.location || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  const allowSignals = [
    'part time',
    'part-time',
    'contract',
    'intern',
    'internship',
    'temporary',
    'freelance',
    'shift',
    'weekend',
    'hourly',
    'work from home',
    'wfh',
    'customer support',
    'sales associate',
    'data entry',
  ];
  const blockSignals = [
    'chief',
    'director',
    'vp',
    'vice president',
    'officer',
    'ceo',
    'cto',
    'cfo',
    'coo',
    'head of',
    'ehrenamtlich',
    'volunteer',
  ];

  const hasAllow = allowSignals.some((signal) => text.includes(signal));
  const hasBlock = blockSignals.some((signal) => text.includes(signal));
  return hasAllow && !hasBlock;
};

const filterByExperiencePreference = ({ jobs = [], experienceLevel = '', yearsExperience = null }) => {
  const normalizedLevel = cleanString(experienceLevel).toLowerCase();
  const years = Number.isFinite(Number(yearsExperience)) ? Number(yearsExperience) : null;

  if (!normalizedLevel && years === null) {
    return jobs;
  }

  const fresherMode = normalizedLevel === 'fresher' || normalizedLevel === 'intern';
  const fresherAllowRegex = /\b(entry|entry-level|entry level|intern|internship|junior|jr\.?|fresher|trainee|graduate|apprentice)\b/;

  return jobs.filter((job) => {
    const band = getExperienceBand(job);
    const text = `${job.role || ''} ${job.type || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
    const parsedYears = parseExperienceYearsHint(job);

    if (fresherMode) {
      if (band === 'senior') {
        return false;
      }

      if (typeof parsedYears.minYears === 'number' && parsedYears.minYears > 1) {
        return false;
      }

      const hasFresherSignal = fresherAllowRegex.test(text);
      const explicitZeroToOneYears = typeof parsedYears.minYears === 'number' && parsedYears.minYears <= 1;
      if (!hasFresherSignal && !explicitZeroToOneYears) {
        return false;
      }

      return true;
    }

    if (years !== null) {
      if (typeof parsedYears.minYears === 'number' && parsedYears.minYears > years) {
        return false;
      }

      if (years >= 2 && band === 'entry') {
        return false;
      }
    }

    return true;
  });
};

const dedupeJobs = (jobs) => {
  const seen = new Set();
  const deduped = [];

  jobs.forEach((job) => {
    const key = `${(job.applyUrl || '').toLowerCase()}|${job.company.toLowerCase()}|${job.role.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(job);
  });

  return deduped;
};

const enrichHrEmails = async (jobs = []) => {
  const MAX_ENRICH = 40;
  const CONCURRENCY = 6;
  const enrichedJobs = [...jobs];

  const candidateIndexes = enrichedJobs
    .map((job, index) => ({
      index,
      hasApplyUrl: Boolean(job.applyUrl),
    }))
    .filter((entry) => entry.hasApplyUrl)
    .slice(0, MAX_ENRICH)
    .map((entry) => entry.index);

  let pointer = 0;
  const worker = async () => {
    while (pointer < candidateIndexes.length) {
      const currentPointer = pointer;
      pointer += 1;

      const jobIndex = candidateIndexes[currentPointer];
      const job = enrichedJobs[jobIndex];
      if (!job) {
        continue;
      }

      const extracted = await extractHrEmailFromPage({
        companyName: job.company,
        applyUrl: job.applyUrl || '',
      });

      let resolved = extracted;
      if (resolved && !resolved.hrEmail && resolved.companyWebsite) {
        const siteExtracted = await extractHrEmailFromPage({
          companyName: job.company,
          applyUrl: resolved.companyWebsite,
        });
        if (siteExtracted?.hrEmail) {
          resolved = {
            ...siteExtracted,
            hrEmailSource: 'company-website',
            hrEmailStatus: 'verified',
          };
        }
      }

      if (resolved && !resolved.hrEmail) {
        const domainCandidate = resolved.companyWebsite
          ? getHostname(resolved.companyWebsite)
          : getHostname(job.applyUrl || '');
        if (domainCandidate && !isJobBoardHost(domainCandidate) && !isSocialHost(domainCandidate)) {
          const guess = guessHrEmailFromDomain(domainCandidate);
          if (guess) {
            resolved = {
              ...resolved,
              hrEmail: guess.email,
              hrEmailConfidence: guess.confidence,
              hrEmailSource: guess.source,
              hrEmailStatus: 'unverified',
            };
          }
        }
      }

      if (resolved) {
        enrichedJobs[jobIndex] = {
          ...job,
          hrEmail: resolved.hrEmail,
          hrEmailConfidence: resolved.hrEmailConfidence,
          hrEmailSource: resolved.hrEmailSource,
          hrEmailStatus: resolved.hrEmailStatus,
          contactPhone: resolved.contactPhone,
          posterName: resolved.posterName,
        };
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker()));

  return enrichedJobs.map((job) => {
    if (!job.hrEmail) {
      return {
        ...job,
        hrEmail: null,
        hrEmailConfidence: 0,
        hrEmailSource: 'unavailable',
        hrEmailStatus: 'unavailable',
        contactPhone: job.contactPhone || null,
        posterName: job.posterName || null,
      };
    }

    if (isJobBoardHost(getDomainFromEmail(job.hrEmail))) {
      return {
        ...job,
        hrEmail: null,
        hrEmailConfidence: 0,
        hrEmailSource: 'unavailable',
        hrEmailStatus: 'unavailable',
      };
    }

    return job;
  });
};

const fetchJson = async (url, timeoutMs = 9000, headers = {}) => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...headers,
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const localizeJobs = (jobs = [], city = '', radiusKm = 75) => {
  const normalizedCity = cleanString(city).toLowerCase();
  if (!normalizedCity) {
    return jobs;
  }

  const radiusHint = Number(radiusKm || 75);
  const radiusTight = radiusHint <= 60;

  return jobs.filter((job) => {
    const location = cleanString(job.location).toLowerCase();
    if (!location) {
      return false;
    }

    if (location.includes(normalizedCity)) {
      return true;
    }

    // Accept nearby broad variants for wider radius searches.
    if (!radiusTight && (location.includes('hybrid') || location.includes('on-site') || location.includes('onsite'))) {
      return true;
    }

    return false;
  });
};

jobsRouter.get('/local-feed', async (request, response, next) => {
  try {
    const city = String(request.query.city || '').trim();
    const keyword = String(request.query.keyword || '').trim();
    const mode = String(request.query.mode || 'default').trim().toLowerCase();
    const experienceLevel = String(request.query.experienceLevel || '').trim();
    const experienceYearsRaw = request.query.experienceYears;
    const experienceYears =
      experienceYearsRaw === undefined || experienceYearsRaw === null || experienceYearsRaw === ''
        ? null
        : Math.max(0, Number(experienceYearsRaw));
    const isPartTimeMode = mode === 'part-time' || mode === 'parttime';
    const tamilNaduBoostEnabled = isTamilNaduCity(city);
    const radiusKm = Math.min(100, Math.max(50, Number(request.query.radiusKm) || 75));
    const limit = Math.min(MAX_LIMIT, Math.max(20, Number(request.query.limit) || 30));

    if (!city) {
      response.status(400).json({ message: 'city query is required for local-feed.' });
      return;
    }

    const fallbackKeyword = isPartTimeMode ? 'part time' : '';
    const effectiveKeyword = keyword || fallbackKeyword;
    const query = [effectiveKeyword, city].filter(Boolean).join(' ');
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    const deepSearchEnabled = String(request.query.deep || 'true').trim().toLowerCase() !== 'false';
    const partTimeSearchTerms = [effectiveKeyword, 'part-time', 'hourly', 'shift', 'weekend', city].filter(Boolean);
    const arbeitnowSearch = isPartTimeMode ? [effectiveKeyword, 'contract', 'internship', city].filter(Boolean).join(' ') : query;
    const museSearch = isPartTimeMode ? [effectiveKeyword, 'internship', 'contract', 'entry level'].filter(Boolean).join(' ') : query;
    const remotiveSearch = isPartTimeMode ? [effectiveKeyword, 'contract', 'internship', 'part-time'].filter(Boolean).join(' ') : query;

    const arbeitnowUrl = `https://www.arbeitnow.com/api/job-board-api${arbeitnowSearch ? `?search=${encodeURIComponent(arbeitnowSearch)}` : ''}`;
    const musePages = deepSearchEnabled ? 4 : 2;
    const remotiveSearches = deepSearchEnabled
      ? [
          remotiveSearch,
          [effectiveKeyword, city, 'entry level'].filter(Boolean).join(' '),
          [effectiveKeyword, city, 'junior'].filter(Boolean).join(' '),
          [effectiveKeyword, city, 'internship'].filter(Boolean).join(' '),
        ]
      : [remotiveSearch];

    const adzunaQueries = [effectiveKeyword || query];
    if (tamilNaduBoostEnabled) {
      adzunaQueries.push(...getTamilNaduBoostQueries({ city, keyword: effectiveKeyword, isPartTimeMode }));
    }
    if (deepSearchEnabled) {
      adzunaQueries.push(
        [effectiveKeyword || keyword, city, isPartTimeMode ? 'entry level part time' : 'junior developer'].filter(Boolean).join(' '),
        [effectiveKeyword || keyword, city, isPartTimeMode ? 'internship' : 'fresher'].filter(Boolean).join(' '),
      );
    }

    const [arbeitnowPayload, museRawJobs, adzunaRawJobs, remotiveRawJobs, remoteOkPayload] = await Promise.all([
      fetchJson(arbeitnowUrl),
      fetchMuseJobsAcrossPages({ category: museSearch, pages: musePages }),
      fetchAdzunaByQueries({
        queries: adzunaQueries,
        city,
        resultsPerPage: tamilNaduBoostEnabled ? 50 : 40,
        pages: deepSearchEnabled ? 2 : 1,
      }),
      fetchRemotiveBySearches(remotiveSearches),
      fetchJson('https://remoteok.com/api', 9000, { 'user-agent': 'career-agent-bot' }),
    ]);

    const arbeitnowJobs = normalizeArbeitnow(arbeitnowPayload?.data || [], queryTerms);
    const museJobs = normalizeMuse(museRawJobs || [], queryTerms);
    const adzunaJobs = normalizeAdzuna(adzunaRawJobs || [], queryTerms);
    const remotiveJobs = normalizeRemotive(remotiveRawJobs || [], queryTerms);
    const remoteOkJobs = normalizeRemoteOk(Array.isArray(remoteOkPayload) ? remoteOkPayload : [], queryTerms);

    const combined = dedupeJobs([...adzunaJobs, ...arbeitnowJobs, ...museJobs, ...remotiveJobs, ...remoteOkJobs]);
    const modeFiltered = isPartTimeMode
      ? combined.filter((job) => {
          const searchable = `${job.role} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`.toLowerCase();
          const loosePartTimeMatch = partTimeSearchTerms.some((term) => searchable.includes(String(term).toLowerCase()));
          return isRelevantPartTimeRole(job) || hasPartTimeSignals(job) || loosePartTimeMatch || filterByQueryTerms([job], queryTerms).length > 0;
        })
      : combined;

    const experienceFiltered = filterByExperiencePreference({
      jobs: modeFiltered,
      experienceLevel,
      yearsExperience: experienceYears,
    });

    const strictLocal = localizeJobs(experienceFiltered, city, radiusKm)
      .filter((job) => (isPartTimeMode ? true : job.type !== 'Remote'))
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, limit);

    const fallbackLocal = experienceFiltered
      .filter((job) => {
        const location = cleanString(job.location).toLowerCase();
        const role = cleanString(job.role).toLowerCase();
        const company = cleanString(job.company).toLowerCase();
        const cityMatch = location.includes(city.toLowerCase());
        const keywordMatch = effectiveKeyword
          ? `${role} ${company} ${location}`.includes(effectiveKeyword.toLowerCase()) ||
            (isPartTimeMode && `${role} ${company} ${location}`.includes(effectiveKeyword.toLowerCase().replace(/\s+/g, '-')))
          : true;
        const partTimeMatch = isPartTimeMode ? hasPartTimeSignals(job) : true;
        return (cityMatch || keywordMatch) && partTimeMatch;
      })
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, limit);

    const emergencyFallback = experienceFiltered
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, limit);

    const localOnly = strictLocal.length > 0 ? strictLocal : fallbackLocal.length > 0 ? fallbackLocal : emergencyFallback;

    const enriched = await enrichHrEmails(localOnly);

    response.json({
      source: 'local-provider-mix',
      city,
      mode,
      experienceLevel,
      experienceYears,
      tamilNaduBoostEnabled,
      deepSearchEnabled,
      radiusKm,
      fetchedAt: new Date().toISOString(),
      providerSummary: {
        adzuna: adzunaJobs.length,
        arbeitnow: arbeitnowJobs.length,
        themuse: museJobs.length,
        remotive: remotiveJobs.length,
        remoteok: remoteOkJobs.length,
        totalMerged: combined.length,
        totalAfterLocalFilter: strictLocal.length,
        fallbackApplied: strictLocal.length === 0,
        totalAfterFallback: localOnly.length,
        emergencyFallbackApplied: strictLocal.length === 0 && fallbackLocal.length === 0,
      },
      jobs: enriched,
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.post('/watch/openings', async (request, response, next) => {
  try {
    const roleTitle = cleanString(request.body?.roleTitle || request.query?.roleTitle || '');
    const city = cleanString(request.body?.city || request.query?.city || '');
    const rawCompanies = Array.isArray(request.body?.companies)
      ? request.body.companies
      : String(request.body?.companies || request.query?.companies || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    const companies = rawCompanies.map((item) => cleanString(item)).filter(Boolean);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(request.body?.limit || request.query?.limit) || 30));

    if (!companies.length) {
      response.status(400).json({ message: 'At least one target company is required.' });
      return;
    }

    const query = [roleTitle, city, ...companies].filter(Boolean).join(' ').trim();
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    const remotiveUrl = `https://remotive.com/api/remote-jobs?${new URLSearchParams(query ? { search: query } : {}).toString()}`;
    const arbeitnowUrl = `https://www.arbeitnow.com/api/job-board-api${query ? `?search=${encodeURIComponent(query)}` : ''}`;
    const museUrlPage1 = `https://www.themuse.com/api/public/jobs?page=1${query ? `&category=${encodeURIComponent(query)}` : ''}`;
    const museUrlPage2 = `https://www.themuse.com/api/public/jobs?page=2${query ? `&category=${encodeURIComponent(query)}` : ''}`;

    const [remotivePayload, arbeitnowPayload, remoteOkPayload, musePayloadOne, musePayloadTwo, adzunaRawJobs] = await Promise.all([
      fetchJson(remotiveUrl),
      fetchJson(arbeitnowUrl),
      fetchJson('https://remoteok.com/api', 9000, { 'user-agent': 'career-agent-bot' }),
      fetchJson(museUrlPage1),
      fetchJson(museUrlPage2),
      fetchAdzunaJobs({ query, city, resultsPerPage: 50 }),
    ]);

    const remotiveJobs = normalizeRemotive(remotivePayload?.jobs || [], queryTerms);
    const arbeitnowJobs = normalizeArbeitnow(arbeitnowPayload?.data || [], queryTerms);
    const remoteOkJobs = normalizeRemoteOk(Array.isArray(remoteOkPayload) ? remoteOkPayload : [], queryTerms);
    const museJobs = normalizeMuse([...(musePayloadOne?.results || []), ...(musePayloadTwo?.results || [])], queryTerms);
    const adzunaJobs = normalizeAdzuna(adzunaRawJobs, queryTerms);

    const combined = dedupeJobs([...remotiveJobs, ...arbeitnowJobs, ...remoteOkJobs, ...museJobs, ...adzunaJobs]);
    const companyTokens = companies.map((item) => item.toLowerCase());
    const roleToken = roleTitle.toLowerCase();
    const cityToken = city.toLowerCase();

    const filtered = combined
      .filter((job) => {
        const companyName = cleanString(job.company).toLowerCase();
        const role = cleanString(job.role).toLowerCase();
        const location = cleanString(job.location).toLowerCase();

        const companyMatch = companyTokens.some((token) => companyName.includes(token));
        const cityMatch = cityToken ? location.includes(cityToken) : true;
        const roleMatch = roleToken ? role.includes(roleToken) : true;

        return companyMatch && cityMatch && roleMatch;
      })
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, limit);

    response.json({
      source: 'company-watch-mix',
      watch: {
        companies,
        city,
        roleTitle,
      },
      providerSummary: {
        remotive: remotiveJobs.length,
        arbeitnow: arbeitnowJobs.length,
        remoteok: remoteOkJobs.length,
        themuse: museJobs.length,
        adzuna: adzunaJobs.length,
        totalMerged: combined.length,
        totalMatched: filtered.length,
      },
      jobs: filtered,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.get('/nearby-companies', async (request, response, next) => {
  try {
    const city = cleanString(request.query.city || '');
    const radiusKm = Math.min(100, Math.max(5, Number(request.query.radiusKm) || 50));
    const limit = Math.min(80, Math.max(1, Number(request.query.limit) || 24));
    const keyword = cleanString(request.query.keyword || 'IT');
    const mode = cleanString(request.query.mode || 'auto').toLowerCase();

    const hasLatLon = request.query.lat !== undefined && request.query.lon !== undefined;
    const lat = hasLatLon ? Number(request.query.lat) : null;
    const lon = hasLatLon ? Number(request.query.lon) : null;

    let anchor = null;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      anchor = {
        lat: Number(lat),
        lon: Number(lon),
        label: city || 'Current location',
      };
    }

    if (!anchor && city) {
      anchor = await geocodeCity(city);
    }

    if (!anchor) {
      response.status(400).json({ message: 'Provide either city or lat/lon to find nearby companies.' });
      return;
    }

    const useGooglePremium = GOOGLE_PLACES_API_KEY && (mode === 'premium' || (mode === 'auto' && GOOGLE_PLACES_PREMIUM_ENABLED));
    let source = useGooglePremium ? 'google-places-premium' : 'openstreetmap-overpass';

    let companies = await fetchNearbyFromVariants({
      useGooglePremium,
      anchor,
      radiusKm,
      limit,
      keyword,
    });

    if (companies.length === 0 && city) {
      source = `${source}+nominatim`;
      companies = await fetchNominatimCompanies({
        city,
        keyword,
        anchor,
        limit,
      });
    }

    if (companies.length === 0 && city) {
      source = `${source}+job-feed`;
      const query = [keyword, city].filter(Boolean).join(' ').trim();
      const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean);

      const arbeitnowUrl = `https://www.arbeitnow.com/api/job-board-api${query ? `?search=${encodeURIComponent(query)}` : ''}`;
      const museUrlPage1 = `https://www.themuse.com/api/public/jobs?page=1${query ? `&category=${encodeURIComponent(query)}` : ''}`;
      const museUrlPage2 = `https://www.themuse.com/api/public/jobs?page=2${query ? `&category=${encodeURIComponent(query)}` : ''}`;
      const remotiveUrl = `https://remotive.com/api/remote-jobs?${new URLSearchParams(query ? { search: query } : {}).toString()}`;

      const [arbeitnowPayload, musePayloadOne, musePayloadTwo, adzunaRawJobs, remotivePayload, remoteOkPayload] = await Promise.all([
        fetchJson(arbeitnowUrl),
        fetchJson(museUrlPage1),
        fetchJson(museUrlPage2),
        fetchAdzunaJobs({ query: keyword || query, city, resultsPerPage: 40 }),
        fetchJson(remotiveUrl),
        fetchJson('https://remoteok.com/api', 9000, { 'user-agent': 'career-agent-bot' }),
      ]);

      const arbeitnowJobs = normalizeArbeitnow(arbeitnowPayload?.data || [], queryTerms);
      const museJobs = normalizeMuse([...(musePayloadOne?.results || []), ...(musePayloadTwo?.results || [])], queryTerms);
      const adzunaJobs = normalizeAdzuna(adzunaRawJobs, queryTerms);
      const remotiveJobs = normalizeRemotive(remotivePayload?.jobs || [], queryTerms);
      const remoteOkJobs = normalizeRemoteOk(Array.isArray(remoteOkPayload) ? remoteOkPayload : [], queryTerms);

      const combined = dedupeJobs([...adzunaJobs, ...arbeitnowJobs, ...museJobs, ...remotiveJobs, ...remoteOkJobs]);
      const countryToken = cleanString(anchor.label || '')
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .slice(-1)[0] || '';
      const strictLocal = localizeJobs(combined, city, radiusKm)
        .filter((job) => job.type !== 'Remote')
        .slice(0, limit * 2);
      const fallbackLocal = combined
        .filter((job) => {
          const location = cleanString(job.location).toLowerCase();
          const cityMatch = location.includes(city.toLowerCase());
          const countryMatch = countryToken ? location.includes(countryToken) : false;
          return cityMatch || countryMatch;
        })
        .slice(0, limit * 2);
      const localMatches = strictLocal.length > 0 ? strictLocal : fallbackLocal;

      const seen = new Set();
      companies = localMatches
        .map((job) => {
          const normalizedKey = `${job.company}|${job.location}`.toLowerCase();
          if (seen.has(normalizedKey)) {
            return null;
          }

          seen.add(normalizedKey);
          const mapsQuery = encodeURIComponent(`${job.company} ${job.location}`);
          return {
            company: job.company,
            category: 'job-feed-company',
            address: job.location || city,
            lat: anchor.lat,
            lon: anchor.lon,
            distanceKm: cleanString(job.location).toLowerCase().includes(city.toLowerCase()) ? 5 : radiusKm,
            phone: job.contactPhone || null,
            website: job.applyUrl || null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
            searchUrl: `https://www.google.com/search?q=${mapsQuery}`,
          };
        })
        .filter(Boolean)
        .slice(0, limit);
    }

    response.json({
      source,
      anchor,
      radiusKm,
      keyword,
      mode: useGooglePremium ? 'premium' : 'standard',
      count: companies.length,
      companies,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.post('/scrape/store', async (request, response, next) => {
  try {
    const authHeader = String(request.headers['x-job-scraper-key'] || '');
    const requiredKey = String(process.env.JOB_SCRAPER_API_KEY || '').trim();
    if (requiredKey && authHeader !== requiredKey) {
      response.status(401).json({ message: 'Unauthorized scraper trigger.' });
      return;
    }

    const city = String(request.body?.city || request.query?.city || '').trim();
    const keyword = String(request.body?.keyword || request.query?.keyword || '').trim();
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(request.body?.limit || request.query?.limit) || 40));

    if (!city) {
      response.status(400).json({ message: 'city is required for scrape/store.' });
      return;
    }

    const scraped = await jobScraperService.scrapeLocalJobs({ city, keyword, limit });
    const rows = jobScraperService.toSupabaseRows(scraped.jobs);

    const dbResult = await jobRepository.upsertJobs(rows);
    jobsLogger.info('Scrape/store completed', {
      city,
      keyword,
      scraped: scraped.jobs.length,
      inserted: dbResult.inserted,
      supabaseEnabled: dbResult.enabled,
    });

    response.json({
      message: 'Scrape and store completed.',
      city,
      keyword,
      fetchedAt: scraped.fetchedAt,
      scrapedCount: scraped.jobs.length,
      providerErrors: scraped.errors,
      storage: dbResult,
      preview: scraped.jobs.slice(0, 5),
    });
  } catch (error) {
    jobsLogger.error('Scrape/store failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /jobs/scrape/career-emails
// Deep-crawls each company's /careers, /jobs, /contact pages to find HR emails.
// Body: { companies: [{name: string, website: string}] }  (max 10 per call)
// ---------------------------------------------------------------------------
const CAREER_PAGE_SUFFIXES = [
  '/careers',
  '/careers/',
  '/careers/jobs',
  '/careers/positions',
  '/jobs',
  '/jobs/',
  '/about/careers',
  '/about/jobs',
  '/about-us',
  '/work-with-us',
  '/join-us',
  '/join',
  '/team',
  '/people',
  '/contact',
  '/contact-us',
  '/support',
  '/hiring',
];

jobsRouter.post('/scrape/career-emails', async (request, response, next) => {
  try {
    const raw = Array.isArray(request.body?.companies) ? request.body.companies : [];
    const validCompanies = raw
      .filter(
        (c) =>
          c &&
          typeof c.name === 'string' &&
          c.name.trim() &&
          typeof c.website === 'string' &&
          /^https?:\/\//i.test(c.website.trim()),
      )
      .slice(0, 10);

    if (validCompanies.length === 0) {
      response.status(400).json({
        message: 'Provide companies array with {name, website} entries (max 10, website must start with http/https).',
      });
      return;
    }

    const results = await Promise.all(
      validCompanies.map(async (company) => {
        const baseUrl = company.website.trim().replace(/\/+$/, '');
        const companyName = company.name.trim();

        // Try each known career page suffix first
        for (const suffix of CAREER_PAGE_SUFFIXES) {
          const pageUrl = `${baseUrl}${suffix}`;
          const extracted = await extractHrEmailFromPage({ companyName, applyUrl: pageUrl });
          if (extracted && extracted.hrEmail) {
            return {
              company: companyName,
              website: company.website,
              careersPageUrl: pageUrl,
              hrEmail: extracted.hrEmail,
              hrEmailConfidence: extracted.hrEmailConfidence,
              contactPhone: extracted.contactPhone || null,
              posterName: extracted.posterName || null,
              found: true,
            };
          }
        }

        // Fallback: scrape root page for mailto / contact links
        const homeExtracted = await extractHrEmailFromPage({ companyName, applyUrl: baseUrl });
        const domainCandidate = getHostname(baseUrl);
        const guessed = homeExtracted?.hrEmail
          ? null
          : domainCandidate && !isJobBoardHost(domainCandidate) && !isSocialHost(domainCandidate)
            ? guessHrEmailFromDomain(domainCandidate)
            : null;
        return {
          company: companyName,
          website: company.website,
          careersPageUrl: null,
          hrEmail: homeExtracted?.hrEmail || guessed?.email || null,
          hrEmailConfidence: homeExtracted?.hrEmailConfidence || guessed?.confidence || 0,
          contactPhone: homeExtracted?.contactPhone || null,
          posterName: homeExtracted?.posterName || null,
          found: Boolean(homeExtracted?.hrEmail || guessed?.email),
        };
      }),
    );

    const foundCount = results.filter((r) => r.found).length;
    response.json({
      scannedCount: results.length,
      foundCount,
      results,
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.get('/feed', async (request, response, next) => {
  try {
    const query = String(request.query.query || '').trim();
    const country = String(request.query.country || '').trim();
    const experienceLevel = String(request.query.experienceLevel || '').trim();
    const experienceYearsRaw = request.query.experienceYears;
    const experienceYears =
      experienceYearsRaw === undefined || experienceYearsRaw === null || experienceYearsRaw === ''
        ? null
        : Math.max(0, Number(experienceYearsRaw));
    const limit = Math.min(MAX_LIMIT, Math.max(20, Number(request.query.limit) || 30));
    const deepSearchEnabled = String(request.query.deep || 'true').trim().toLowerCase() !== 'false';
    const cacheKey = `${query.toLowerCase()}|country:${country.toLowerCase()}|${limit}|${experienceLevel.toLowerCase()}|${experienceYears === null ? 'na' : experienceYears}|deep:${deepSearchEnabled}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      response.json({
        source: 'multi-provider',
        fetchedAt: cached.fetchedAt,
        fromCache: true,
        providerSummary: cached.providerSummary,
        jobs: cached.jobs,
      });
      return;
    }

    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    const hunterQueries = buildHunterQueries({
      query,
      country,
      experienceLevel,
      yearsExperience: experienceYears,
      deepSearchEnabled,
    });

    const primaryQuery = hunterQueries[0] || query || 'software developer';
    const arbeitnowUrl = `https://www.arbeitnow.com/api/job-board-api${primaryQuery ? `?search=${encodeURIComponent(primaryQuery)}` : ''}`;
    const remotiveSearches = hunterQueries;

    const [
      remotiveRawJobs,
      arbeitnowPayload,
      remoteOkPayload,
      museRawJobs,
      adzunaRawJobs,
      stackoverflowRawJobs,
      justjoinedRawJobs,
      workableRawJobs,
      humanbrainRawJobs,
      functionalworksRawJobs,
      jobicyRawJobs,
      findworkRawJobs,
    ] = await Promise.all([
      fetchRemotiveBySearches(remotiveSearches),
      fetchJson(arbeitnowUrl),
      fetchJson('https://remoteok.com/api', 9000, { 'user-agent': 'career-agent-bot' }),
      fetchMuseJobsAcrossPages({ category: primaryQuery, pages: deepSearchEnabled ? 6 : 3 }),
      fetchAdzunaByQueries({
        queries: hunterQueries,
        resultsPerPage: 50,
        pages: deepSearchEnabled ? 2 : 1,
        country,
      }),
      fetchStackOverflowJobs({ query: primaryQuery, limit: 60 }),
      fetchJustjoinedJobs({ query: primaryQuery, limit: 80 }),
      fetchWorkableJobs({ query: primaryQuery, limit: 50 }),
      fetchHumanBrainJobs({ query: primaryQuery, limit: 80 }),
      fetchFunctionalWorksJobs({ query: primaryQuery, limit: 80 }),
      fetchJobicyJobs({ query: primaryQuery, limit: 50 }),
      fetchFindWorkJobs({ query: primaryQuery, limit: 80 }),
    ]);

    const remotiveJobs = normalizeRemotive(remotiveRawJobs || [], queryTerms);
    const arbeitnowJobs = normalizeArbeitnow(arbeitnowPayload?.data || [], queryTerms);
    const remoteOkJobs = normalizeRemoteOk(Array.isArray(remoteOkPayload) ? remoteOkPayload : [], queryTerms);
    const museJobs = normalizeMuse(museRawJobs || [], queryTerms);
    const adzunaJobs = normalizeAdzuna(adzunaRawJobs || [], queryTerms);
    const stackoverflowJobs = normalizeStackOverflow(stackoverflowRawJobs || [], queryTerms);
    const justjoinedJobs = normalizeJustjoined(justjoinedRawJobs || [], queryTerms);
    const workableJobs = normalizeWorkable(workableRawJobs || [], queryTerms);
    const humanbrainJobs = normalizeHumanbrain(humanbrainRawJobs || [], queryTerms);
    const functionalworksJobs = normalizeFunctionalworks(functionalworksRawJobs || [], queryTerms);
    const jobicyJobs = normalizeJobicy(jobicyRawJobs || [], queryTerms);
    const findworkJobs = normalizeFindWork(findworkRawJobs || [], queryTerms);

    const combined = dedupeJobs([
      ...remotiveJobs,
      ...arbeitnowJobs,
      ...remoteOkJobs,
      ...museJobs,
      ...adzunaJobs,
      ...stackoverflowJobs,
      ...justjoinedJobs,
      ...workableJobs,
      ...humanbrainJobs,
      ...functionalworksJobs,
      ...jobicyJobs,
      ...findworkJobs,
    ]);
    const strictQueryMatches = filterByExperiencePreference({
      jobs: filterByQueryTerms(combined, queryTerms),
      experienceLevel,
      yearsExperience: experienceYears,
    });

    const relaxedQueryMatches = filterByExperiencePreference({
      jobs: combined.filter((job) => {
        if (!queryTerms.length) {
          return true;
        }

        const searchableText = `${job.role} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`.toLowerCase();
        return queryTerms.some((term) => searchableText.includes(term));
      }),
      experienceLevel,
      yearsExperience: experienceYears,
    });

    const normalizedExperience = cleanString(experienceLevel).toLowerCase();
    const isFresherMode = normalizedExperience === 'fresher' || normalizedExperience === 'intern' || Number(experienceYears) === 0;
    const fresherSafeFallback = !strictQueryMatches.length && !relaxedQueryMatches.length && isFresherMode
      ? combined.filter((job) => {
          const band = getExperienceBand(job);
          if (band === 'senior') {
            return false;
          }

          const parsedYears = parseExperienceYearsHint(job);
          if (typeof parsedYears.minYears === 'number' && parsedYears.minYears > 2) {
            return false;
          }

          if (!queryTerms.length) {
            return true;
          }

          const text = `${job.role} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`.toLowerCase();
          return queryTerms.some((term) => text.includes(term));
        })
      : [];

    const experienceWidePool = filterByExperiencePreference({
      jobs: combined,
      experienceLevel,
      yearsExperience: experienceYears,
    });

    const candidatePool = strictQueryMatches.length > 0
      ? strictQueryMatches
      : relaxedQueryMatches.length > 0
        ? relaxedQueryMatches
        : fresherSafeFallback;

    const supplementedCandidatePool = candidatePool.length >= Math.min(20, limit)
      ? candidatePool
      : dedupeJobs([
          ...candidatePool,
          ...experienceWidePool.filter((job) => {
            const text = `${job.role} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`.toLowerCase();
            if (!queryTerms.length) {
              return true;
            }

            return queryTerms.some((term) => text.includes(term)) || text.includes('remote') || text.includes('worldwide');
          }),
        ]);

    const finalCandidatePool = supplementedCandidatePool.length >= Math.min(10, limit)
      ? supplementedCandidatePool
      : dedupeJobs([
          ...supplementedCandidatePool,
          ...experienceWidePool.filter((job) => {
            const band = getExperienceBand(job);
            if (isFresherMode) {
              return band !== 'senior';
            }

            return true;
          }),
        ]);

    const rankedCandidatePool = [...finalCandidatePool].sort((a, b) => {
      const scoreA = (a.matchPercentage || 0) + (a.hrEmailConfidence || 0) * 0.2;
      const scoreB = (b.matchPercentage || 0) + (b.hrEmailConfidence || 0) * 0.2;
      return scoreB - scoreA;
    });

    const filteredBeforeEmail = rankedCandidatePool.slice(0, limit);
    const filtered = await enrichHrEmails(filteredBeforeEmail);
    const verifiedHrCount = filtered.filter((job) => job.hrEmailStatus === 'verified').length;

    const providerSummary = {
      remotive: remotiveJobs.length,
      arbeitnow: arbeitnowJobs.length,
      remoteok: remoteOkJobs.length,
      themuse: museJobs.length,
      adzuna: adzunaJobs.length,
      stackoverflow: stackoverflowJobs.length,
      justjoined: justjoinedJobs.length,
      workable: workableJobs.length,
      humanbrain: humanbrainJobs.length,
      functionalworks: functionalworksJobs.length,
      jobicy: jobicyJobs.length,
      findwork: findworkJobs.length,
      totalMerged: combined.length,
      totalAfterFilter: filtered.length,
      verifiedHrEmails: verifiedHrCount,
      note:
        'Fetching from 12 job sources: Remotive, ArbeitNow, RemoteOK, TheMuse, Adzuna, StackOverflow, JustJoined, Workable, HumanBrain, FunctionalWorks, Jobicy, FindWork. LinkedIn scraping intentionally excluded for policy compliance.',
    };

    const fetchedAt = new Date().toISOString();

    cache.set(cacheKey, {
      createdAt: Date.now(),
      fetchedAt,
      providerSummary,
      jobs: filtered,
    });

    response.json({
      source: 'multi-provider',
      fetchedAt,
      fromCache: false,
      providerSummary,
      experienceLevel,
      experienceYears,
      deepSearchEnabled,
      country,
      hunterQueriesUsed: hunterQueries.length,
      jobs: filtered,
    });
  } catch (error) {
    next(error);
  }
});
