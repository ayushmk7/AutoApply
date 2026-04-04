declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /** Raw body bytes for webhook HMAC (Phase 14). */
      rawBody?: Buffer;
      /** Set by `requireAuth` / `requireFirebaseAuth` */
      uid?: string;
      email?: string;
      authKind?: 'firebase' | 'demo';
    }
  }
}

export {};
