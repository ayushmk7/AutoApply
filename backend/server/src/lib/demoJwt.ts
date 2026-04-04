import { SignJWT, jwtVerify } from 'jose';
import { config } from './config.js';

const DEMO_TYP = 'demo';

function getSecretKey(): Uint8Array {
  const s = config.demoJwtSecret;
  if (!s) {
    throw new Error('DEMO_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(s);
}

export async function signDemoToken(demoUid: string): Promise<string> {
  const key = getSecretKey();
  return new SignJWT({ typ: DEMO_TYP })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(demoUid)
    .setIssuedAt()
    .setExpirationTime(`${config.demoTokenTtlSeconds}s`)
    .sign(key);
}

/** @returns demo UID (subject) or null if invalid */
export async function verifyDemoToken(token: string): Promise<string | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (payload.typ !== DEMO_TYP) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
