import { pool } from './pool.js';
import type { IndexedEvent, NetworkId, ScanProgress } from '../shared/types.js';

export async function getScanProgress(network: NetworkId): Promise<ScanProgress> {
    const result = await pool.query(
        'SELECT network, last_block AS "lastBlock", updated_at AS "updatedAt" FROM scan_progress WHERE network = $1',
        [network],
    );
    const row = result.rows[0];
    if (!row) return { network, lastBlock: 0, updatedAt: new Date() };
    // PostgreSQL returns BIGINT as string — cast to number
    return { ...row, lastBlock: Number(row.lastBlock) };
}

export async function updateScanProgress(network: NetworkId, lastBlock: number): Promise<void> {
    await pool.query(
        'UPDATE scan_progress SET last_block = $1, updated_at = NOW() WHERE network = $2',
        [lastBlock, network],
    );
}

export async function insertEvents(network: NetworkId, events: IndexedEvent[]): Promise<number> {
    if (events.length === 0) return 0;

    let added = 0;
    // Use a single transaction for the batch
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const evt of events) {
            const result = await client.query(
                `INSERT INTO approved_events (network, token, spender, owner, allowance, block_number, tx_hash)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (network, token, spender, tx_hash) DO NOTHING`,
                [network, evt.token, evt.spender, evt.owner, evt.allowance, evt.block, evt.txHash],
            );
            if (result.rowCount && result.rowCount > 0) added++;
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return added;
}

export async function getEventsByOwner(network: NetworkId, owner: string): Promise<IndexedEvent[]> {
    const result = await pool.query(
        `SELECT token, spender, owner, allowance, block_number AS block, tx_hash AS "txHash"
         FROM approved_events
         WHERE network = $1 AND LOWER(owner) = LOWER($2)
         ORDER BY block_number ASC`,
        [network, owner],
    );
    return result.rows.map((row: Record<string, unknown>) => ({
        token: row.token as string,
        spender: row.spender as string,
        owner: row.owner as string,
        allowance: row.allowance as string,
        block: Number(row.block),
        txHash: row.txHash as string,
    }));
}
