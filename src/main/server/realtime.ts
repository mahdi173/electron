
// src/realtime.ts
import type { Server } from 'socket.io';
import type sqlite3 from 'sqlite3';

export function attachRealtime(io: Server, db: sqlite3.Database) {
  io.on('connection', (socket) => {
    const DEFAULT_ROOM = 'general';
    socket.join(DEFAULT_ROOM);

    // Tell the client who they are (so UI can set currentUserId immediately)
    const self = (socket as any).user as {
      id: number;
      displayName?: string;
      email?: string;
    };
    socket.emit('session:user', {
      id: Number(self?.id ?? 0),
      displayName: self?.displayName ?? '',
      email: self?.email ?? '',
    });

    const normalizeRoom = (room?: string) => {
      const r = String(room || '').trim();
      if (!r) return DEFAULT_ROOM;
      // allow letters, digits, underscore, colon, dash
      if (!/^[\w:\-]{1,128}$/.test(r)) return DEFAULT_ROOM;
      return r;
    };

    socket.on('message:send', ({ room, content, tempId }: any) => {
      try {
        const user = (socket as any).user as { id: number; displayName?: string; email?: string };
        if (!user?.id) {
          socket.emit('error', { error: 'unauthorized' });
          return;
        }

        const targetRoom = normalizeRoom(room);
        const trimmed = String(content ?? '').trim();
        if (!trimmed) return;
        if (trimmed.length > 1000) {
          socket.emit('error', { error: 'message too long' });
          return;
        }

        db.run(
          'INSERT INTO messages (room, sender_id, content) VALUES (?, ?, ?)',
          [targetRoom, user.id, trimmed],
          function (err: any) {
            if (err) {
              socket.emit('error', { error: 'db error' });
              return;
            }
            const insertedId = this.lastID;

            db.get(
              'SELECT created_at FROM messages WHERE id = ?',
              [insertedId],
              function (selErr: any, row: any) {
                const createdAt =
                  selErr || !row?.created_at
                    ? new Date().toISOString()
                    : new Date(row.created_at).toISOString();

                const msg = {
                  id: insertedId,
                  room: targetRoom,
                  sender: {
                    id: Number(user.id),
                    displayName: user.displayName || '',
                    email: user.email || '',
                  },
                  content: trimmed,
                  createdAt,
                  clientId: tempId, // IMPORTANT so client upgrades optimistic bubble
                };

                io.to(targetRoom).emit('message:new', msg);
                socket.emit('message:sent:ack', { room: targetRoom, id: insertedId, tempId });
              }
            );
          }
        );
      } catch {
        socket.emit('error', { error: 'unexpected server error' });
      }
    });

    socket.on('room:join', ({ room }) => {
      const r = normalizeRoom(room);
      if (r) socket.join(r);
    });

    socket.on('room:leave', ({ room }) => {
      const r = normalizeRoom(room);
      if (r) socket.leave(r);
    });
  });
}
