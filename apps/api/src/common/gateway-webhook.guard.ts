import { Request, Response, NextFunction } from 'express';
import { timingSafeStringEqual, WebhookCrypto } from './crypto-utils.ts';
import { errorResponse } from './response.dto.ts';

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export function gatewayWebhookGuard(req: Request, res: Response, next: NextFunction) {
  const sharedSecret = process.env.GATEWAY_WEBHOOK_SHARED_SECRET;
  const expectedApiKey = process.env.GATEWAY_WEBHOOK_API_KEY;

  if (!sharedSecret) {
    return res
      .status(500)
      .json(errorResponse('INTERNAL_SERVER_ERROR', 'GATEWAY_WEBHOOK_SHARED_SECRET is not configured', undefined, req.requestId));
  }
  if (!expectedApiKey) {
    return res
      .status(500)
      .json(errorResponse('INTERNAL_SERVER_ERROR', 'GATEWAY_WEBHOOK_API_KEY is not configured', undefined, req.requestId));
  }

  const apiKey = req.header('x-api-key');
  const signature = req.header('x-gateway-signature');
  const timestamp = req.header('x-gateway-timestamp');
  const rawBody = req.rawBody;

  if (!apiKey || !timingSafeStringEqual(apiKey, expectedApiKey)) {
    return res
      .status(401)
      .json(errorResponse('UNAUTHORIZED', 'Invalid or missing x-api-key header', undefined, req.requestId));
  }

  const toleranceConfig = process.env.GATEWAY_WEBHOOK_TOLERANCE_MS;
  const toleranceMs = toleranceConfig ? Number(toleranceConfig) : DEFAULT_TOLERANCE_MS;
  if (Number.isNaN(toleranceMs) || toleranceMs <= 0) {
    return res
      .status(500)
      .json(errorResponse('INTERNAL_SERVER_ERROR', 'Invalid GATEWAY_WEBHOOK_TOLERANCE_MS configuration', undefined, req.requestId));
  }

  const bodyStr = typeof rawBody === 'string' ? rawBody : (rawBody != null ? String(rawBody) : '');

  const result = WebhookCrypto.verifyWebhookSignature(
    sharedSecret,
    timestamp || '',
    bodyStr,
    signature || '',
    toleranceMs,
  );

  if (!result.valid) {
    return res
      .status(401)
      .json(
        errorResponse(
          'WEBHOOK_SIGNATURE_INVALID',
          `Webhook signature verification failed: ${result.reason}`,
          { reason: result.reason },
          req.requestId,
        ),
      );
  }

  next();
}
