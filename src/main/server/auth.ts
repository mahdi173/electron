
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
    const { email, password, displayName, birthDate } = req.body || {};

    // Basic checks
    console.log(email, password, displayName, birthDate);
    if (!email || !password || !displayName || !birthDate) {
      return res.status(400).json({ error: 'email, password, displayName, and birthDate are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const name = String(displayName).trim();
    const birth = new Date(birthDate);

    // Validate email format
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate display name
    if (!/^[A-Za-z0-9_]{3,30}$/.test(name)) {
      return res.status(400).json({ error: 'Display name must be 3–30 chars (letters, numbers, underscores)' });
    }

    // Validate birth date and age ≥ 13
    if (isNaN(birth.getTime())) {
      return res.status(400).json({ error: 'Invalid birth date' });
    }
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 13) {
      return res.status(400).json({ error: 'You must be at least 13 years old' });
    }

    const hash = bcrypt.hashSync(String(password), 10);

    db.run(
      'INSERT INTO users (email, password_hash, display_name, birth_date) VALUES (?, ?, ?, ?)',
      [normalizedEmail, hash, name, birthDate],
      function (err) {
        if (err) {
          if (String(err.message).toUpperCase().includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email or display name already exists' });
          }
          return res.status(500).json({ error: err.message });
        }

        const user: JwtUserPayload = {
          id: this.lastID,
          email: normalizedEmail,
          displayName: name,
        };
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
