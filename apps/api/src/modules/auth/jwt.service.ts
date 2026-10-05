import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '../../common/types.ts';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  organizationId: string;
  type: 'access' | 'refresh';
  jti?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_min32chars';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_in_production_min32chars';

export class JwtService {
  static generateTokens(payload: { id: string; email: string; role: Role; organizationId: string }) {
    const accessPayload: JwtPayload = {
      sub: payload.id,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
      type: 'access',
      jti: uuidv4(),
    };

    const refreshPayload: JwtPayload = {
      sub: payload.id,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
      type: 'refresh',
      jti: uuidv4(),
    };

    const accessOptions: SignOptions = { expiresIn: '15m' };
    const refreshOptions: SignOptions = { expiresIn: '7d' };

    const accessToken = jwt.sign(accessPayload, JWT_SECRET, accessOptions);
    const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, refreshOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  static verifyRefreshToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
