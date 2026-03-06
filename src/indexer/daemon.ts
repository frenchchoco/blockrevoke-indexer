import { JSONRpcProvider } from 'opnet';
import { NETWORK_CONFIGS } from '../config/networks.js';
import { env } from '../config/env.js';
import { getScanProgress, updateScanProgress, insertEvents } from '../db/queries.js';
import { fetchBlocksAdaptive } from './batchFetcher.js';
import { extractApprovedEvents } from './blockProcessor.js';
import { logger } from '../shared/logger.js';
import type { NetworkId } from '../shared/types.js';

function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

let shuttingDown = false;

export function requestShutdown(): void {
    shuttingDown = true;
}

/**
 * Start the indexer daemon for a specific network.
 * Runs an infinite loop that:
 * 1. Reads the scan cursor from PostgreSQL
 * 2. Fetches blocks from the OPNet RPC
 * 3. Extracts Approved events
 * 4. Stores them in PostgreSQL
 * 5. Updates the scan cursor
 */
export function startIndexer(networkId: NetworkId): void {
    const config = NETWORK_CONFIGS[networkId];
    const provider = new JSONRpcProvider({ url: config.rpcUrl, network: config.network });

    logger.info(`Indexer started for ${config.name}`, { rpcUrl: config.rpcUrl });

    (async (): Promise<void> => {
        while (!shuttingDown) {
            try {
                await scanLoop(networkId, provider);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.fatal(`[${networkId}] Scan loop crashed, restarting in 30s`, { error: msg });
                await delay(30_000);
            }
        }
    })().catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.fatal(`[${networkId}] Fatal crash in self-healing wrapper`, { error: msg });
    });
}

async function scanLoop(networkId: NetworkId, provider: JSONRpcProvider): Promise<void> {
    const config = NETWORK_CONFIGS[networkId];
    const batchSize = env.batchSize;

    while (!shuttingDown) {
        try {
            const progress = await getScanProgress(networkId);
            const chainHead = Number(await provider.getBlockNumber());

            const from = Math.max(progress.lastBlock + 1, config.startBlock);

            if (from > chainHead) {
                // Caught up — wait and poll again
                await delay(env.pollIntervalMs);
                continue;
            }

            const to = Math.min(from + batchSize - 1, chainHead);
            const blocksToScan = to - from + 1;

            logger.info(`[${networkId}] Scanning blocks ${from}..${to} (${blocksToScan} blocks, head=${chainHead})`);

            const blocks = await fetchBlocksAdaptive(provider, from, to);
            const events = extractApprovedEvents(blocks);

            if (events.length > 0) {
                const added = await insertEvents(networkId, events);
                logger.info(`[${networkId}] Stored ${added} new events from blocks ${from}..${to}`);
            }

            await updateScanProgress(networkId, to);

            // Cooldown between batches to avoid rate-limiting the RPC
            await delay(1000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[${networkId}] Scan loop error`, { error: msg });
            await delay(15000); // 15s backoff on error
        }
    }

    logger.info(`[${networkId}] Indexer stopped`);
}
