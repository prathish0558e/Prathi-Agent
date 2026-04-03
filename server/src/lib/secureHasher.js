import crypto from 'crypto';

export class SecureHasher {
  constructor(secretSalt = process.env.JOB_HASH_SECRET || 'career-agent-default-salt') {
    this.secretSalt = secretSalt;
  }

  sha256(value) {
    const payload = `${this.secretSalt}:${String(value || '')}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
