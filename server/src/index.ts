import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import router from './routes';

app.use(cors());
app.use(express.json());

app.use('/api', router);

app.get('/', (req, res) => {
    res.send('Chicago Planner API is running. Check /health or /api/locations');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { ctaService } from './services/ctaService';
import { gtfsService } from './services/gtfsService';

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    ctaService.startPolling(); // Starts background polling
    gtfsService.initialize(); // Starts data download/parse
});
