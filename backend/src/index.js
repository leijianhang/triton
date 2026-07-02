import express from 'express';
import 'dotenv/config';
import marketRoutes from './routes/market.js';
import stockRoutes from './routes/stock.js';
import patternRoutes from './routes/pattern.js';
import { getBackendConfig } from './config/backendConfig.js';

const app = express();
const PORT = getBackendConfig().port || 3001;

app.use(express.json({ limit: '10mb' }));

app.use('/api/market', marketRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/pattern', patternRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
