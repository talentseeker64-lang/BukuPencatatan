import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../modules/auth/jwt.service.ts';
import { DatabaseService } from '../database/db.service.ts';
import { Role, AuthenticatedUser, UserStatus } from './types.ts';
import { errorResponse } from './response.dto.ts';

// Extend Express Request type with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = JwtService.verifyAccessToken(token);
    const db = DatabaseService.getInstance();
    const user = db.users.get(payload.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'User not found or account is deactivated'));
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      status: user.status,
    };

    next();
  } catch {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired access token'));
  }
}

export function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
    }

    // ADMIN has universal administrative clearance
    if (req.user.role === Role.ADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(
        errorResponse('FORBIDDEN', `Role '${req.user.role}' is not authorized to perform this action`, {
          required_roles: allowedRoles,
          current_role: req.user.role,
        })
      );
    }

    next();
  };
}

export function checkOrgBoundary(user: AuthenticatedUser, resourceOrgId: string): boolean {
  if (user.role === Role.ADMIN) {
    return true; // Admin can inspect across organizations
  }
  return user.organizationId === resourceOrgId;
}
