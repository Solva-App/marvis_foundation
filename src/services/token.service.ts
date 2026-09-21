import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export interface ModerationTokenPayload {
  needId: string;
  action: 'accept' | 'reject';
}

export const generateModerationToken = (needId: string, action: 'accept' | 'reject'): string => {
  return jwt.sign({ needId, action }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyModerationToken = (token: string): ModerationTokenPayload => {
  return jwt.verify(token, JWT_SECRET) as ModerationTokenPayload;
};