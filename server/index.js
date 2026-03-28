import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import auth from './routes/auth.js';
import preference from './routes/preference.js';

const app = new Hono();

// CORS — allow any origin (embeddable widget) with credentials
app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Routes
app.route('/api/auth', auth);
app.route('/api/preference', preference);

// JWKS at top level (client metadata points to /api/jwks)
import { getPublicJwks } from './oauth.js';
app.get('/api/jwks', async (c) => c.json(await getPublicJwks()));

// Health check
app.get('/api/health', (c) => c.json({ ok: true }));

// Start
const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, () => {
  console.log(`atShare API server running on port ${port}`);
});
