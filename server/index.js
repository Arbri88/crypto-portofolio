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

// 1. SECURITY: Helmet adds secure HTTP headers
app.use(helmet());

// 2. SECURITY: Rate Limiting (Max 100 requests per 15 mins)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// 3. Body Parsers
app.use(express.json({ limit: '30mb', extended: true }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// 4. SECURITY: Strict CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Only allow localhost:3000
    credentials: true,
  }),
);

app.use('/posts', postRoutes);
app.use('/user', userRoutes);
app.use('/external', externalRoutes);

// 5. Global Error Handler (Prevents server crashes)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.CONNECTION_URL)
  .then(() => app.listen(PORT, () => console.log(`Server running securely on port: ${PORT}`)))
  .catch((error) => console.log(error.message));
