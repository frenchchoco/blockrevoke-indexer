import { BinaryReader, type Address } from '@btc-vision/transaction';
import type { Block, ContractEvents } from 'opnet';
import type { IndexedEvent } from '../shared/types.js';
import { logger } from '../shared/logger.js';

/**
 * Extract all Approved events from a set of blocks.
 * Unlike the frontend scanner, this does NOT filter by owner —
 * it stores ALL events for ALL users.
 */
export function extractApprovedEvents(blocks: Block[]): IndexedEvent[] {
    const events: IndexedEvent[] = [];

    for (const block of blocks) {
        const blockNumber = Number(block.height);
        const txs = block.transactions;
        if (!txs || txs.length === 0) continue;

        for (const tx of txs) {
            const txEvents: ContractEvents = tx.events;
            if (!txEvents) continue;

            for (const [contractAddress, eventList] of Object.entries(txEvents)) {
                if (!Array.isArray(eventList)) continue;

                for (const event of eventList) {
                    if (event.type !== 'Approved') continue;

                    try {
                        const reader = new BinaryReader(event.data);
                        const owner: Address = reader.readAddress();
                        const spender: Address = reader.readAddress();
                        const amount: bigint = reader.readU256();

                        events.push({
                            token: contractAddress,
                            owner: owner.toHex(),
                            spender: spender.toHex(),
                            allowance: amount.toString(),
                            block: blockNumber,
                            txHash: tx.hash,
                        });
                    } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        logger.warn(`Failed to decode Approved event at block ${blockNumber}`, { error: msg });
                    }
                }
            }
        }
    }

    return events;
}
