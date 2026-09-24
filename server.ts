import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { createApiRouter } from './apps/api/src/routes.ts';
import { OutboxService } from './apps/api/src/modules/outbox/outbox.service.ts';
import { DatabaseService } from './apps/api/src/database/db.service.ts';
import { errorResponse } from './apps/api/src/common/response.dto.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB and Seed data
  const db = DatabaseService.getInstance();
  await db.seedDefaultData();

  // Basic security and request parsing
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Attach unique Request ID & security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || uuidv4();
    req.requestId = reqId;
    res.setHeader('X-Request-Id', reqId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // CORS middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Mount API Router
  app.use('/api', createApiRouter());

  // Health check endpoint with infrastructure and blockchain provider status
  app.get('/api/health', async (_req: Request, res: Response) => {
    const outbox = OutboxService.getInstance();
    const bcHealth = await outbox.getBlockchainService().isHealthy();
    res.status(200).json({
      status: 'healthy',
      api: 'ok',
      database: 'ok',
      blockchain: bcHealth,
      timestamp: new Date().toISOString(),
    });
  });

  // Global API 404 handler
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json(errorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found`, undefined, req.requestId));
  });

  // Start Outbox Background Polling Worker
  const outboxService = OutboxService.getInstance();
  outboxService.startPolling(2500);

  // In development, hook into Vite middlewares
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Enterprise AP Ledger] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Enterprise AP Ledger] Fatal startup error:', err);
  process.exit(1);
});
