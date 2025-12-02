import express from 'express';
import { getCryptoNews, getCryptoTickers } from '../controllers/externalData.js';

const router = express.Router();

router.get('/tickers', getCryptoTickers);
router.get('/news', getCryptoNews);

export default router;
