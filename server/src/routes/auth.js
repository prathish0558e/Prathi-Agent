import { Router } from 'express';

export const authRouter = Router();

const MAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const NATIVE_CALLBACK_SCHEME = 'com.careersentinel.ai://';

const getOAuthConfig = () => ({
  clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
  clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  serverOrigin: String(process.env.SERVER_ORIGIN || 'https://api.prathi.tech').trim().replace(/\/$/, ''),
  defaultWebReturnTo: String(process.env.WEB_ORIGIN || 'https://prathi.tech').trim().replace(/\/$/, ''),
});

const encodeState = (payload) => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

const decodeState = (value = '') => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
};

const normalizeMode = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'login' || normalized === 'mail') {
    return normalized;
  }
  return 'mail';
};

const fetchGoogleProfile = async (accessToken) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
};

const normalizeReturnTo = (value = '', defaultReturnTo = 'https://prathi.tech') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return defaultReturnTo;
  }

  if (trimmed.toLowerCase().startsWith(NATIVE_CALLBACK_SCHEME)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return defaultReturnTo;
    }

    return `${parsed.origin}`;
  } catch {
    return defaultReturnTo;
  }
};

const getRedirectBase = (returnTo = '') => {
  if (String(returnTo).toLowerCase().startsWith(NATIVE_CALLBACK_SCHEME)) {
    const cleaned = String(returnTo).replace(/[?#].*$/, '').replace(/\/$/, '');
    return cleaned.includes('/auth/callback') ? cleaned : `${cleaned}/auth/callback`;
  }

  return `${returnTo}/#/auth/callback`;
};

authRouter.get('/google/config', (_request, response) => {
  const oauthConfig = getOAuthConfig();
  const redirectUri = `${oauthConfig.serverOrigin}/auth/google/callback`;
  const warnings = [];

  if (!oauthConfig.clientId) {
    warnings.push('GOOGLE_CLIENT_ID is missing on backend.');
  }

  if (!oauthConfig.clientSecret) {
    warnings.push('GOOGLE_CLIENT_SECRET is missing on backend.');
  }

  response.json({
    configured: Boolean(oauthConfig.clientId && oauthConfig.clientSecret),
    clientIdPreview: oauthConfig.clientId ? `${oauthConfig.clientId.slice(0, 18)}...` : '',
    redirectUri,
    defaultReturnTo: oauthConfig.defaultWebReturnTo,
    requiredScopes: MAIL_SCOPES,
    warnings,
  });
});

authRouter.get('/google/start', (_request, response) => {
  const oauthConfig = getOAuthConfig();

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    response.status(503).json({
      enabled: false,
      message: 'Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the backend before enabling direct Gmail consent.',
    });
    return;
  }

  const returnTo = normalizeReturnTo(_request.query.returnTo || '', oauthConfig.defaultWebReturnTo);
  const redirectUri = `${oauthConfig.serverOrigin}/auth/google/callback`;
  const mode = normalizeMode(_request.query.mode || '');
  const state = encodeState({ returnTo, mode });

  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: MAIL_SCOPES.join(' '),
    state,
  });

  response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRouter.get('/google/callback', async (request, response) => {
  const oauthConfig = getOAuthConfig();
  const { code = '', error = '', state = '' } = request.query;
  const statePayload = decodeState(String(state || ''));
  const returnTo = normalizeReturnTo(statePayload.returnTo || '', oauthConfig.defaultWebReturnTo);
  const mode = normalizeMode(statePayload.mode || '');
  const redirectBase = getRedirectBase(returnTo);

  if (error) {
    response.redirect(`${redirectBase}?mail_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    response.redirect(`${redirectBase}?mail_error=${encodeURIComponent('Google OAuth backend credentials missing')}`);
    return;
  }

  try {
    const redirectUri = `${oauthConfig.serverOrigin}/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: String(code || ''),
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      const message = tokenPayload.error_description || tokenPayload.error || 'Unable to exchange Google authorization code.';
      response.redirect(`${redirectBase}?mail_error=${encodeURIComponent(String(message))}`);
      return;
    }

    let userProfile = null;
    if (mode === 'login') {
      userProfile = await fetchGoogleProfile(tokenPayload.access_token);
    }

    const params = new URLSearchParams({
      mail_connected: 'true',
      mail_access_token: String(tokenPayload.access_token),
      mail_expires_in: String(tokenPayload.expires_in || 0),
      mail_scope: String(tokenPayload.scope || ''),
    });

    if (mode === 'login') {
      params.set('app_login', 'true');
      if (userProfile?.email) {
        params.set('app_email', String(userProfile.email));
      }
      if (userProfile?.name) {
        params.set('app_name', String(userProfile.name));
      }
    }

    response.redirect(`${redirectBase}?${params.toString()}`);
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : 'Google callback failed.';
    response.redirect(`${redirectBase}?mail_error=${encodeURIComponent(message)}`);
  }
});
