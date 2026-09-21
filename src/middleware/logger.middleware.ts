import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms - IP: ${ip}`;

    if (statusCode >= 500) {
      logger.error(logMessage, { body: req.body, query: req.query });
    } else if (statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }
  });

  next();
};