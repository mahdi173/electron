
// src/server.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { initDb } from './db';
import { authRoutes } from './auth';
import { messageRoutes } from './messages';

export const SERVER_PORT = Number(process.env.SERVER_PORT || 3900);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function startServer(dbRootDir: string) {
  const dbDir = path.resolve(dbRootDir);
  const db = initDb(dbDir);

  const app = express();

  // In dev, this is okay. If you use cookies/credentials, configure { origin, credentials }.
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes(db, JWT_SECRET));
  app.use('/api/messages', messageRoutes(db, JWT_SECRET));
  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

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
