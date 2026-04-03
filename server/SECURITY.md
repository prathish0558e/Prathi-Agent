# Security Hardening Guide

## Correct Rule: Hash vs Encrypt
- Passwords, PINs, recovery codes: hash with Argon2id.
- Searchable identifiers like email and phone: store encrypted value plus an HMAC-SHA256 blind index for lookup.
- OAuth access tokens and refresh tokens: encrypt with AES-256-GCM.
- Resume extracted text and sensitive mail content: encrypt at rest.

## Why Not Hash Everything
- If all user data is hashed, the app cannot restore profile details after reinstall.
- So the safe design is:
  - irreversible hash for secrets
  - reversible encryption for data that must be shown back to the user
  - blind indexes for fast secure search

## Recommended Crypto
- Password hashing: Argon2id with per-user salt and server-side pepper.
- Blind index: HMAC-SHA256 using a separate HMAC key.
- Field encryption: AES-256-GCM with random nonce per record.
- Key storage: environment variables or cloud secret manager only.

## SQL Injection Defense
- Never build SQL with string concatenation.
- Use parameterized queries only.
- Restrict DB permissions to the smallest needed role.
- Use Row Level Security for user-owned tables.
- Validate and allowlist sort fields, filters, and pagination inputs.

## Backend Rules
- Gemini key must stay on backend only.
- Google OAuth secret must stay on backend only.
- Decrypt only inside backend service memory, never in frontend.
- Log all outbound email actions to audit tables.
- Add rate limits to login, sync, and apply endpoints.

## Recommended Secret Names
- ARGON2_PEPPER
- FIELD_ENCRYPTION_KEY
- BLIND_INDEX_KEY
- JWT_SIGNING_KEY
- GEMINI_API_KEY
- GOOGLE_CLIENT_SECRET

## Example Query Pattern
```python
query = "select * from career_profiles where email_hash = %s"
cursor.execute(query, (email_hash,))
```

Never do this:
```python
query = f"select * from career_profiles where email = '{email}'"
```