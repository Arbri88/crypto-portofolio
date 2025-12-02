import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import postRoutes from './routes/posts.js';
import userRoutes from './routes/users.js';
import externalRoutes from './routes/external.js';

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// Global rate limiter (generous)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                // 1000 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Auth-specific limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '30mb', extended: true }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// Strict CORS: only allow configured frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

// Routes
app.use('/posts', postRoutes);
app.use('/user', authLimiter, userRoutes);
app.use('/external', externalRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  return res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.CONNECTION_URL)
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server running securely on port: ${PORT}`),
    );
  })
  .catch((error) => console.log(error.message));
