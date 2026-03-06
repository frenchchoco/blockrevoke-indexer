import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../shared/logger.js';

const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    max: env.pgPoolMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
});

pool.on('error', (err) => {
    logger.error('PostgreSQL pool error', { error: err.message });
});

export { pool };
