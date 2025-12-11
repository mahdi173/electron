
// src/server/auth-middleware.ts
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export function requireAuth(JWT_SECRET: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const hdr = req.headers['authorization'] || ''
    const m = /^Bearer\s+(.+)$/i.exec(Array.isArray(hdr) ? hdr[0] : hdr)
    if (!m) return res.status(401).json({ error: 'no token' })
    try {
      const decoded = jwt.verify(m[1], JWT_SECRET)
      ;(req as any).user = decoded
      next()
    } catch {
      return res.status(401).json({ error: 'invalid token' })
    }
  }
}
