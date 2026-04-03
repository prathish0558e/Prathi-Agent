const googleApiBase = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const requiredMailScopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export const diagnoseTokenScopes = async (accessToken) => {
  const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unable to inspect token scopes: ${details}`);
  }

  const tokenInfo = await response.json();
  const scopes = String(tokenInfo.scope || '')
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);

  const missingScopes = requiredMailScopes.filter((scope) => !scopes.includes(scope));

  return {
    scopes,
    missingScopes,
    audience: tokenInfo.aud || '',
    expiresIn: Number(tokenInfo.expires_in || 0),
  };
};

export const fetchGmail = async (path, accessToken) => {
  const response = await fetch(`${googleApiBase}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Gmail API failed: ${details}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

export const sendGmailMessage = async ({ accessToken, to, subject, body, attachment }) => {
  const boundary = `career_agent_${Date.now()}`;

  const mimeParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
  ];

  if (attachment) {
    mimeParts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.fileName}"`,
      '',
      attachment.base64Content,
      '',
    );
  }

  mimeParts.push(`--${boundary}--`);

  const raw = toBase64Url(mimeParts.join('\r\n'));

  const gmailResponse = await fetch(`${googleApiBase}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!gmailResponse.ok) {
    const details = await gmailResponse.text();
    throw new Error(`Failed to send Gmail application: ${details}`);
  }

  return gmailResponse.json();
};
