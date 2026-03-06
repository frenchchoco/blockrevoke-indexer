import { pool } from './pool.js';
import { logger } from '../shared/logger.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS approved_events (
    id           BIGSERIAL       PRIMARY KEY,
    network      VARCHAR(10)     NOT NULL,
    token        VARCHAR(66)     NOT NULL,
    spender      VARCHAR(66)     NOT NULL,
    owner        VARCHAR(66)     NOT NULL,
    allowance    VARCHAR(78)     NOT NULL,
    block_number BIGINT          NOT NULL,
    tx_hash      VARCHAR(66)     NOT NULL,
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event UNIQUE (network, token, spender, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_events_owner
    ON approved_events (network, LOWER(owner));

CREATE INDEX IF NOT EXISTS idx_events_block
    ON approved_events (network, block_number DESC);

CREATE TABLE IF NOT EXISTS scan_progress (
    network    VARCHAR(10) PRIMARY KEY,
    last_block BIGINT      NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scan_progress (network, last_block)
VALUES ('testnet', 0), ('mainnet', 0)
ON CONFLICT (network) DO NOTHING;
`;

export async function initDatabase(): Promise<void> {
    logger.info('Running database migrations');
    await pool.query(SCHEMA);
    logger.info('Database migrations complete');
}
