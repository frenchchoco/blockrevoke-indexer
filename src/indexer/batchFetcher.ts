import type { JSONRpcProvider, Block } from 'opnet';
import { logger } from '../shared/logger.js';

const MAX_RETRIES = 3;
const MIN_BATCH_SIZE = 10;
const RETRY_DELAY_BASE = 500;

function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a range of blocks with adaptive retry and splitting.
 * On repeated failures, halves the range and retries sub-ranges.
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
            return await provider.getBlocks(blockTags, true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`getBlocks ${from}-${to} attempt ${attempt + 1} failed`, { error: msg });

            if (attempt < MAX_RETRIES - 1) {
                await delay(RETRY_DELAY_BASE * (attempt + 1));
            }
        }
    }

    // All retries failed — split into sub-ranges
    const rangeSize = to - from + 1;
    if (rangeSize > MIN_BATCH_SIZE) {
        const mid = from + Math.floor(rangeSize / 2);
        logger.info(`Splitting failed range ${from}-${to} into ${from}-${mid - 1} and ${mid}-${to}`);

        const [left, right] = await Promise.all([
            fetchBlocksAdaptive(provider, from, mid - 1),
            fetchBlocksAdaptive(provider, mid, to),
        ]);

        return [...left, ...right];
    }

    // Give up on this range — throw so the scan loop does NOT advance the cursor
    throw new Error(`Failed to fetch blocks ${from}-${to} after all retries and splits`);
}
