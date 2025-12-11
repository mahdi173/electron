
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
import { requireAuth } from './auth-middleware'

export const SERVER_PORT = Number(process.env.SERVER_PORT || 3900);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function startServer(dbRootDir: string) {
  const dbDir = path.resolve(dbRootDir);
  // resetDb(dbDir);
  const db = initDb(dbDir);
  const app = express();

  // In dev, this is okay. If you use cookies/credentials, configure { origin, credentials }.
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes(db, JWT_SECRET));
  app.use('/api/messages', messageRoutes(db, JWT_SECRET));
  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  app.get('/api/users', (req, res) => {
    const q = String(req.query?.q ?? '').trim()
    const where = q ? `WHERE display_name LIKE $q OR email LIKE $q` : ''
    const sql = `
      SELECT id, email, display_name, birth_date, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT 50
    `
    const params = q ? { $q: `%${q}%` } : {}

    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) return res.status(500).json({ error: err.message })
      res.status(200).json(rows ?? [])
    })
  })

  app.get('/api/messages', requireAuth(JWT_SECRET), (req, res) => {
    const room = String(req.query?.room ?? '').trim()
    if (!room) return res.status(400).json({ error: 'room required' })

    const sql = `
      SELECT m.id, m.room, m.sender_id, m.content, m.created_at,
            u.display_name, u.email
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.room = $room
      ORDER BY m.created_at ASC, m.id ASC
      LIMIT 200
    `
    db.all(sql, { $room: room }, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    })
  })

  const server = http.createServer(app);

  const io = new IOServer(server, {
    cors: { origin: '*' }, // dev-friendly; tighten for prod
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as any)?.token;
    if (!token) return next(new Error('no token'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded !== 'object' || decoded === null || typeof (decoded as any).id !== 'number') {
        return next(new Error('invalid token'));
      }
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const defaultRoom = 'general';
    socket.join(defaultRoom);

    socket.on('message:send', ({ room = defaultRoom, content }) => {
      const trimmed = String(content || '').trim();
      if (!trimmed || trimmed.length > 1000) return;

      const user = (socket as any).user as { id: number; displayName?: string; email?: string };
      db.run(
        'INSERT INTO messages (room, sender_id, content) VALUES (?, ?, ?)',
        [room, user.id, trimmed],
        function (err) {
          if (err) {
            socket.emit('error', { error: 'db error' });
            return;
          }
          const msg = {
            id: this.lastID,
            room,
            sender: {
              id: user.id,
              displayName: user.displayName || '',
              email: user.email || '',
            },
            content: trimmed,
            createdAt: new Date().toISOString(),
          };
          io.to(room).emit('message:new', msg);
        }
      );
    });

    socket.on('room:join', ({ room }) => { if (room) socket.join(room); });
    socket.on('room:leave', ({ room }) => { if (room) socket.leave(room); });
  });

  server.listen(SERVER_PORT, () => {
    console.log(`[server] listening on http://127.0.0.1:${SERVER_PORT}`);
    console.log(`[server] db at ${dbDir}`);
  });

  return { close: () => server.close() };
}
