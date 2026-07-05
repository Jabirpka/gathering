import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { config } from '../config';

// Augment Express.User so req.user has our shape everywhere
declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string | null;
      name: string;
      avatar?: string | null;
      phone?: string | null;
    }
  }
}

// Convenience alias — use when you need req.user guaranteed non-null
export interface AuthRequest extends Request {
  user: Express.User;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
}

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
