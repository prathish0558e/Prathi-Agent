export class Logger {
  constructor(scope = 'app') {
    this.scope = scope;
  }

  info(message, meta = {}) {
    console.info(this.#format('INFO', message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this.#format('WARN', message, meta));
  }

  error(message, meta = {}) {
    console.error(this.#format('ERROR', message, meta));
  }

  #format(level, message, meta) {
    const timestamp = new Date().toISOString();
    const serializedMeta = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.scope}] ${message}${serializedMeta}`;
  }
}
