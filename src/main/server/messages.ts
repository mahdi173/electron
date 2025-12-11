
// src/messages.ts
import { Router, Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import type sqlite3 from 'sqlite3';

interface AuthPayload extends JwtPayload {
  id: number;
  email: string;
  displayName: string;
}

function authMiddleware(jwtSecret: string) {
  return (req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'no token' });

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (typeof decoded !== 'object' || decoded === null || typeof (decoded as any).id !== 'number') {
        return res.status(401).json({ error: 'invalid token' });
      }
      req.user = decoded as AuthPayload;
      next();
    } catch {
      return res.status(401).json({ error: 'invalid token' });
    }
  };
}

export function messageRoutes(db: sqlite3.Database, jwtSecret: string) {
  const router = Router();
  const guard = authMiddleware(jwtSecret);

  router.get('/', guard, (req, res) => {
    const room = String(req.query.room || 'general').trim();
    const rawLimit = Number(String(req.query.limit || '50'));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    db.all(
      `SELECT m.id, m.room, m.content, m.created_at as createdAt,
              u.id as senderId, u.display_name as displayName, u.email as email
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.room = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [room, limit],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'db error' });
        // return ascending by createdAt
        return res.json((rows || []).reverse());
      }
    );
  });

  return router;
}
