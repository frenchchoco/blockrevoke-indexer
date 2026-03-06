import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getEventsByOwner, getScanProgress, insertEvents } from '../../db/queries.js';
import type { IndexedEvent, NetworkId } from '../../shared/types.js';

interface GetQuery {
    network?: string;
    owner?: string;
}

interface PostBody {
    network?: string;
    events?: IndexedEvent[];
    fromBlock?: number;
    toBlock?: number;
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

    // POST /api/events (crowdsourced submissions)
    fastify.post('/api/events', async (request: FastifyRequest<{ Body: PostBody }>, reply: FastifyReply) => {
        const body = request.body;
        const network = body?.network ?? '';
        const events = body?.events;

        if (!VALID_NETWORKS.has(network)) {
            return reply.status(400).send({ error: 'Invalid network' });
        }
        if (!Array.isArray(events) || events.length === 0) {
            return reply.status(400).send({ error: 'Invalid events array' });
        }
        if (events.length > 500) {
            return reply.status(400).send({ error: 'Max 500 events per request' });
        }

        // Validate each event field to prevent garbage data
        const HEX_RE = /^[0-9a-fA-Fx]+$/;
        const validEvents: IndexedEvent[] = [];
        for (const evt of events) {
            if (
                typeof evt.token !== 'string' || evt.token.length > 66 || !HEX_RE.test(evt.token) ||
                typeof evt.spender !== 'string' || evt.spender.length > 66 || !HEX_RE.test(evt.spender) ||
                typeof evt.owner !== 'string' || evt.owner.length > 66 || !HEX_RE.test(evt.owner) ||
                typeof evt.allowance !== 'string' || evt.allowance.length > 78 ||
                typeof evt.block !== 'number' || !Number.isFinite(evt.block) || evt.block < 0 ||
                typeof evt.txHash !== 'string' || evt.txHash.length > 66 || !HEX_RE.test(evt.txHash)
            ) {
                continue; // Skip malformed events
            }
            validEvents.push(evt);
        }

        if (validEvents.length === 0) {
            return reply.status(400).send({ error: 'No valid events in payload' });
        }

        const added = await insertEvents(network as NetworkId, validEvents);
        const progress = await getScanProgress(network as NetworkId);

        return { added, lastIndexedBlock: progress.lastBlock };
    });
}
