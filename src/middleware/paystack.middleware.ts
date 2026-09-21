import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PAYSTACK_CONFIG } from '../config/paystack';

export const verifyPaystackSignature = (req: Request, res: Response, next: NextFunction) => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_CONFIG.secretKey)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash === req.headers['x-paystack-signature']) {
    return next();
  }
  return res.status(400).send('Invalid Paystack signature');
};