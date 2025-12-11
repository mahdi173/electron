
// src/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type sqlite3 from 'sqlite3';

interface JwtUserPayload {
  id: number;
  email: string;
  displayName: string;
}

export function authRoutes(db: sqlite3.Database, jwtSecret: string) {
  const router = Router();

  router.post('/signup', (req, res) => {
    const { email, password, displayName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const name = String(displayName || '').trim();
    const hash = bcrypt.hashSync(String(password), 10);

    db.run(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
      [normalizedEmail, hash, name],
      function (err) {
        if (err) {
          // SQLite UNIQUE constraint for the email column
          if (String(err.message).toUpperCase().includes('UNIQUE')) {
            return res.status(409).json({ error: 'email already exists' });
          }
          return res.status(500).json({ error: 'db error' });
        }
        const user: JwtUserPayload = { id: this.lastID, email: normalizedEmail, displayName: name };
        const token = jwt.sign(user, jwtSecret, { expiresIn: '1d' });
        return res.json({ token, user });
      }
    );
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], (err, row: any) => {
      if (err) return res.status(500).json({ error: 'db error' });
      if (!row) return res.status(401).json({ error: 'invalid credentials' });

      const ok = bcrypt.compareSync(String(password), row.password_hash);
      if (!ok) return res.status(401).json({ error: 'invalid credentials' });

      const user: JwtUserPayload = { id: row.id, email: row.email, displayName: row.display_name || '' };
      const token = jwt.sign(user, jwtSecret, { expiresIn: '1d' });
      return res.json({ token, user });
    });
  });

  return router;
}
