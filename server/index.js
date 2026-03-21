// ─── Bloom — server/index.js ─────────────────────────────────────────────────
// Express server for local development

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
import tilopayRoutes from './routes/tilopay.js';

app.use('/api/tilopay', tilopayRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Bloom API', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Bloom API running on http://localhost:${PORT}`);
});
