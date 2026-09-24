import crypto from 'crypto';

let argon2Module: typeof import('argon2') | null = null;
try {
  // Dynamically require/import to prevent top-level fatal crashes if native binding differs
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  argon2Module = await import('argon2');
} catch {
  argon2Module = null;
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
      return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(testHash));
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
