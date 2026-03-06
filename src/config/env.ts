import 'dotenv/config';

export const env = {
    // Database
    databaseUrl: (() => {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL environment variable is required');
        return url;
    })(),
    pgPoolMax: parseInt(process.env.PG_POOL_MAX ?? '5', 10),

    // API
    port: parseInt(process.env.PORT ?? '3000', 10),
    host: process.env.HOST ?? '0.0.0.0',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),

    // OPNet RPC
    testnetRpcUrl: process.env.TESTNET_RPC_URL ?? 'https://testnet.opnet.org',
    mainnetRpcUrl: process.env.MAINNET_RPC_URL ?? 'https://mainnet.opnet.org',

    // Indexer tuning
    batchSize: parseInt(process.env.BATCH_SIZE ?? '25', 10),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '10000', 10),
} as const;
