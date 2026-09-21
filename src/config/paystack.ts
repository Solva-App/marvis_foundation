import dotenv from 'dotenv';
dotenv.config();

if (!process.env.PAYSTACK_SECRET_KEY) {
  console.warn('⚠️ Warning: PAYSTACK_SECRET_KEY is missing in environment variables.');
}

export const PAYSTACK_CONFIG = {
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  baseUrl: 'https://api.paystack.co',
};