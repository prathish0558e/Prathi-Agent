import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger.js';

export class JobRepository {
  constructor({ supabaseUrl, supabaseServiceRoleKey, tableName = 'job_opportunities' } = {}) {
    this.logger = new Logger('job-repository');
    this.tableName = tableName;

    const resolvedUrl = supabaseUrl || process.env.SUPABASE_URL || '';
    const resolvedKey = supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    this.enabled = Boolean(resolvedUrl && resolvedKey);
    this.client = this.enabled ? createClient(resolvedUrl, resolvedKey) : null;
  }

  async upsertJobs(jobs = []) {
    if (!this.enabled || !this.client) {
      return {
        inserted: 0,
        skipped: jobs.length,
        enabled: false,
        reason: 'Supabase credentials missing',
      };
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return {
        inserted: 0,
        skipped: 0,
        enabled: true,
      };
    }

    const { error } = await this.client.from(this.tableName).upsert(jobs, { onConflict: 'external_id' });

    if (error) {
      this.logger.error('Supabase upsert failed', { message: error.message, table: this.tableName });
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    return {
      inserted: jobs.length,
      skipped: 0,
      enabled: true,
    };
  }
}
