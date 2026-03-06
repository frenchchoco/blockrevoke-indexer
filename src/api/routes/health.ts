import type { FastifyInstance } from 'fastify';
import { getScanProgress } from '../../db/queries.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/health', async () => {
        const testnet = await getScanProgress('testnet');
        const mainnet = await getScanProgress('mainnet');

        return {
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            networks: {
                testnet: { lastIndexedBlock: testnet.lastBlock },
                mainnet: { lastIndexedBlock: mainnet.lastBlock },
            },
        };
    });
}
