import * as crypto from 'node:crypto';

let argon2Module: typeof import('argon2') | null = null;
try {
  argon2Module = await import('argon2');
} catch {
  argon2Module = null;
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(Buffer.alloc(aBuf.length, 0), Buffer.alloc(aBuf.length, 0));
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export class WebhookCrypto {
  static computeHmacSha256Hex(secret: string, payload: string): string {
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  }

  static buildSignedPayload(timestamp: string, rawBody: string): string {
    return `${timestamp}.${rawBody}`;
  }

  static verifyWebhookSignature(
    secret: string,
    timestamp: string,
    rawBody: string,
    signatureHex: string,
    toleranceMs: number = 5 * 60 * 1000,
  ): { valid: boolean; reason?: string } {
    if (!timestamp) {
      return { valid: false, reason: 'Missing X-Gateway-Timestamp header' };
    }
    if (!signatureHex) {
      return { valid: false, reason: 'Missing X-Gateway-Signature header' };
    }
    if (rawBody === undefined || rawBody === null) {
      return { valid: false, reason: 'Missing request body (raw body required for HMAC)' };
    }

    const tsNum = Number(timestamp);
    if (Number.isNaN(tsNum)) {
      return { valid: false, reason: 'Invalid X-Gateway-Timestamp format (must be numeric UNIX ms)' };
    }

    const now = Date.now();
    const age = Math.abs(now - tsNum);
    if (age > toleranceMs) {
      return {
        valid: false,
        reason: `Timestamp outside tolerance window (age=${age}ms, tolerance=${toleranceMs}ms)`,
      };
    }

    const signedPayload = WebhookCrypto.buildSignedPayload(timestamp, rawBody);
    const expected = WebhookCrypto.computeHmacSha256Hex(secret, signedPayload);

    if (!timingSafeStringEqual(expected, signatureHex.toLowerCase())) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    return { valid: true };
  }

  static signOutgoingRequest(
    secret: string,
    rawBody: string,
  ): { signature: string; timestamp: string; signedPayload: string } {
    const timestamp = String(Date.now());
    const signedPayload = WebhookCrypto.buildSignedPayload(timestamp, rawBody);
    const signature = WebhookCrypto.computeHmacSha256Hex(secret, signedPayload);
    return { signature, timestamp, signedPayload };
  }
}

export class CryptoUtils {
  /**
   * Hashes password using Argon2id or secure PBKDF2 fallback
   */
  static async hashPassword(password: string): Promise<string> {
    if (argon2Module && argon2Module.hash) {
      try {
        return await argon2Module.hash(password, {
          type: argon2Module.argon2id,
          memoryCost: 2 ** 16,
          timeCost: 3,
        });
      } catch {
        // Fallback to PBKDF2
      }
    }

    // High security PBKDF2 fallback (100,000 iterations, SHA-512)
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `pbkdf2$${salt}$${hash}`;
  }

  /**
   * Verifies password against hash
   */
  static async verifyPassword(hash: string, plainText: string): Promise<boolean> {
    if (hash.startsWith('$argon2') && argon2Module && argon2Module.verify) {
      try {
        return await argon2Module.verify(hash, plainText);
      } catch {
        return false;
      }
    }

    if (hash.startsWith('pbkdf2$')) {
      const parts = hash.split('$');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const originalHash = parts[2];
      const testHash = crypto.pbkdf2Sync(plainText, salt, 100000, 64, 'sha512').toString('hex');
      return timingSafeStringEqual(originalHash, testHash);
    }

    return false;
  }

  /**
   * Hashes a refresh token using SHA-256 for secure DB storage
   */
  static hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates SHA-256 hash of a file or string buffer
   */
  static sha256(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static sha256Hash(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
