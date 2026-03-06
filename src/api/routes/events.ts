import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getEventsByOwner, getScanProgress } from '../../db/queries.js';
import type { NetworkId } from '../../shared/types.js';

interface GetQuery {
    network?: string;
    owner?: string;
}

const VALID_NETWORKS = new Set<string>(['testnet', 'mainnet']);

export async function eventsRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /api/events?network=testnet&owner=0x...
    fastify.get('/api/events', async (request: FastifyRequest<{ Querystring: GetQuery }>, reply: FastifyReply) => {
        const network = request.query.network ?? '';
        const owner = request.query.owner ?? '';

        if (!VALID_NETWORKS.has(network)) {
            return reply.status(400).send({ error: 'Invalid network (testnet or mainnet)' });
        }
        if (!owner || owner.length < 10) {
            return reply.status(400).send({ error: 'Invalid owner address' });
        }

        const events = await getEventsByOwner(network as NetworkId, owner);
        const progress = await getScanProgress(network as NetworkId);

        void reply.header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        return {
            events,
            lastIndexedBlock: progress.lastBlock,
            scanFrom: progress.lastBlock + 1,
        };
    });
}
