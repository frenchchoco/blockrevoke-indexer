import type { JSONRpcProvider, Block } from 'opnet';
import { logger } from '../shared/logger.js';

const MAX_RETRIES = 3;
const MIN_BATCH_SIZE = 5;
const RETRY_DELAY_BASE = 2000; // 2s base, escalates to 4s, 6s

function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a range of blocks with adaptive retry and splitting.
 * On repeated failures, halves the range and retries sub-ranges SEQUENTIALLY
 * to avoid overwhelming the RPC.
 */
export async function fetchBlocksAdaptive(
    provider: JSONRpcProvider,
    from: number,
    to: number,
): Promise<Block[]> {
    const blockTags: bigint[] = [];
    for (let b = from; b <= to; b++) {
        blockTags.push(BigInt(b));
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const blocks = await provider.getBlocks(blockTags, true);

            // Brief cooldown after a successful RPC call to avoid rate-limiting
            await delay(300);

            return blocks;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`getBlocks ${from}-${to} attempt ${attempt + 1}/${MAX_RETRIES} failed`, { error: msg });

            if (attempt < MAX_RETRIES - 1) {
                const backoff = RETRY_DELAY_BASE * (attempt + 1);
                logger.info(`Waiting ${backoff}ms before retry...`);
                await delay(backoff);
            }
        }
    }

    // All retries failed — split into sub-ranges
    const rangeSize = to - from + 1;
    if (rangeSize > MIN_BATCH_SIZE) {
        const mid = from + Math.floor(rangeSize / 2);
        logger.info(`Splitting failed range ${from}-${to} into ${from}-${mid - 1} and ${mid}-${to}`);

        // Run sub-ranges SEQUENTIALLY to avoid doubling load on the RPC
        const left = await fetchBlocksAdaptive(provider, from, mid - 1);
        await delay(500); // breathing room between sub-ranges
        const right = await fetchBlocksAdaptive(provider, mid, to);

        return [...left, ...right];
    }

    // Give up on this range — throw so the scan loop does NOT advance the cursor
    throw new Error(`Failed to fetch blocks ${from}-${to} after all retries and splits`);
}
