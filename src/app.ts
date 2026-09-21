import express from 'express';
import 'express-async-errors';
import cors from 'cors';

import { errorHandler } from './middleware/errorHandler.middleware';
import { httpLogger } from './middleware/logger.middleware';

import needsRoutes from './routes/needs.routes';
import paymentRoutes from './routes/payment.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(httpLogger);

app.get('/', (req, res) => {
  res.status(200).json({ success: true, status: 'healthy' });
});

app.use('/api/v1/needs', needsRoutes);
app.use('/api/v1/payments', paymentRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use(errorHandler);

export default app;