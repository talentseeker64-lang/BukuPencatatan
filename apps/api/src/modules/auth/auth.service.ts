import { DatabaseService, DbUser } from '../../database/db.service.ts';
import { CryptoUtils } from '../../common/crypto-utils.ts';
import { JwtService } from './jwt.service.ts';
import { AppError } from '../../common/response.dto.ts';
import { UserStatus } from '../../common/types.ts';

export class AuthService {
  private db = DatabaseService.getInstance();

  async login(email: string, plainTextPassword: string) {
    if (!email || !plainTextPassword) {
      throw new AppError('INVALID_CREDENTIALS', 'Email and password are required', 400);
    }

    let foundUser: DbUser | undefined;
    for (const u of this.db.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    if (foundUser.status !== UserStatus.ACTIVE) {
      throw new AppError('ACCOUNT_DISABLED', 'User account is inactive or suspended', 403);
    }

    const isPasswordValid = await CryptoUtils.verifyPassword(foundUser.password_hash, plainTextPassword);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const tokens = JwtService.generateTokens({
      id: foundUser.id,
      email: foundUser.email,
      role: foundUser.role,
      organizationId: foundUser.organization_id,
    });

    // Securely hash refresh token for token rotation & family tracking
    const refreshTokenHash = CryptoUtils.hashRefreshToken(tokens.refreshToken);
    foundUser.refresh_token_hash = refreshTokenHash;
    foundUser.updated_at = new Date();

    const org = this.db.organizations.get(foundUser.organization_id);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        organization: {
          id: org?.id,
          name: org?.name,
          code: org?.code,
        },
      },
    };
  }

  async refreshToken(refreshTokenStr: string) {
    if (!refreshTokenStr) {
      throw new AppError('INVALID_TOKEN', 'Refresh token is required', 400);
    }

    let payload;
    try {
      payload = JwtService.verifyRefreshToken(refreshTokenStr);
    } catch {
      throw new AppError('INVALID_TOKEN', 'Refresh token is expired or invalid', 401);
    }

    const user = this.db.users.get(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AppError('ACCOUNT_DISABLED', 'User not found or account is inactive', 403);
    }

    // Verify stored refresh token hash (Token Family Rotation & Reuse Detection)
    const incomingTokenHash = CryptoUtils.hashRefreshToken(refreshTokenStr);
    if (user.refresh_token_hash !== incomingTokenHash) {
      // Possible token reuse attack detected: invalidate all sessions
      user.refresh_token_hash = null;
      user.updated_at = new Date();
      throw new AppError('TOKEN_REUSE_DETECTED', 'Invalid refresh token. Please log in again.', 401);
    }

    // Generate rotated tokens
    const tokens = JwtService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    });

    // Update with newly rotated refresh token hash
    user.refresh_token_hash = CryptoUtils.hashRefreshToken(tokens.refreshToken);
    user.updated_at = new Date();

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
    };
  }

  async logout(userId: string) {
    const user = this.db.users.get(userId);
    if (user) {
      user.refresh_token_hash = null;
      user.updated_at = new Date();
    }
    return { logged_out: true };
  }

  async getCurrentUser(userId: string) {
    const user = this.db.users.get(userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User does not exist', 404);
    }

    const org = this.db.organizations.get(user.organization_id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      organization: {
        id: org?.id,
        name: org?.name,
        code: org?.code,
        address: org?.address,
      },
      created_at: user.created_at,
    };
  }
}
