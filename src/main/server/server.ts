
// src/server.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { initDb, resetDb } from './db';
import { authRoutes } from './auth';
import { messageRoutes } from './messages';
import { attachRealtime } from './realtime';

export const SERVER_PORT = Number(process.env.SERVER_PORT || 3900);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function startServer(dbRootDir: string) {
  const dbDir = path.resolve(dbRootDir);
  // resetDb(dbDir);
  const db = initDb(dbDir);
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes(db, JWT_SECRET));
  app.use('/api/messages', messageRoutes(db, JWT_SECRET));
  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  app.get('/api/users', (req, res) => {
    const q = String(req.query?.q ?? '').trim();
    const where = q ? `WHERE display_name LIKE $q OR email LIKE $q` : '';
    const sql = `
      SELECT id, email, display_name, birth_date, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const params = q ? { $q: `%${q}%` } : {};

    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows ?? []);
    });
  });

  const server = http.createServer(app);

  const io = new IOServer(server, {
    cors: { origin: '*' },
  });

  // Socket auth
  io.use((socket, next) => {
    const token = (socket.handshake.auth as any)?.token;
    if (!token) return next(new Error('no token'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (
        typeof decoded !== 'object' ||
        decoded === null ||
        typeof (decoded as any).id !== 'number'
      ) {
        return next(new Error('invalid token'));
      }
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  // Attach improved realtime handlers (extracted)
  attachRealtime(io, db);

  server.listen(SERVER_PORT, () => {
    console.log(`[server] listening on http://127.0.0.1:${SERVER_PORT}`);
    console.log(`[server] db at ${dbDir}`);
  });

  return { close: () => server.close() };
}