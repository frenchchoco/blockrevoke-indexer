import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { logger } from '../shared/logger.js';

let fastifyInstance: FastifyInstance | null = null;

export async function startApiServer(): Promise<void> {
    const fastify = Fastify({
        logger: true,
    });

    fastifyInstance = fastify;

    // CORS
    await fastify.register(cors, {
        origin: env.corsOrigins,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Accept'],
        maxAge: 86400,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    // Routes
    await fastify.register(eventsRoutes);
    await fastify.register(healthRoutes);

    // Start
    await fastify.listen({ port: env.port, host: env.host });
    logger.info(`API server listening on ${env.host}:${env.port}`);
}

export async function stopApiServer(): Promise<void> {
    if (fastifyInstance) {
        await fastifyInstance.close();
        fastifyInstance = null;
        logger.info('API server closed');
    }
}
