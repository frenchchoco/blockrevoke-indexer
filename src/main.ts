import { startApiServer, stopApiServer } from './api/server.js';
import { startIndexer, requestShutdown } from './indexer/daemon.js';
import { initDatabase } from './db/migrate.js';
import { pool } from './db/pool.js';
import { logger } from './shared/logger.js';

async function main(): Promise<void> {
    logger.info('BlockRevoke Indexer starting...');

    // 1. Run database migrations
    await initDatabase();

    // 2. Start indexer daemons
    startIndexer('testnet');
    // TODO: Enable mainnet indexer on March 17 launch
    // startIndexer('mainnet');

    // 3. Start API server
    await startApiServer();

    logger.info('BlockRevoke Indexer fully started');
}

// Graceful shutdown
async function shutdown(): Promise<void> {
    logger.info('Shutting down...');

    // 1. Signal scan loops to stop
    requestShutdown();

    // 2. Close API server (finish in-flight requests)
    try {
        await stopApiServer();
    } catch {
        // Ignore close errors
    }

    // 3. Close PostgreSQL pool
    try {
        await pool.end();
        logger.info('PostgreSQL pool closed');
    } catch {
        // Ignore close errors
    }

    // 4. Give scan loops a moment to finish
    setTimeout(() => {
        logger.info('Goodbye');
        process.exit(0);
    }, 3000);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    logger.fatal('Failed to start', { error: msg });
    process.exit(1);
});
