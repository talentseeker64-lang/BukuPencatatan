import { WebhookCrypto } from './crypto-utils.ts';

export interface SignedGatewayHeaders {
  'x-api-key': string;
  'x-gateway-signature'?: string;
  'x-gateway-timestamp'?: string;
  'x-switching-signature'?: string;
  'x-switching-timestamp'?: string;
  'idempotency-key'?: string;
  'content-type': 'application/json';
  [key: string]: string | undefined;
}

export interface SignForGatewayOptions {
  /** Shared secret exchanged with Gateway team (bukan secret sepihak) */
  sharedSecret: string;
  /** API key statis untuk identifikasi klien Switching di sisi Gateway */
  apiKey: string;
  /** Raw request body (JSON string, JANGAN re-serialize object - byte precision matters) */
  rawBody: string;
  /** Idempotency key untuk mencegah submit ganda di sisi Gateway */
  idempotencyKey?: string;
  /**
   * Header naming convention.
   * - "gateway-prefixed": pakai X-Gateway-Signature / X-Gateway-Timestamp (mirip arah sebaliknya)
   * - "switching-prefixed": pakai X-Switching-Signature / X-Switching-Timestamp (lebih jelas arahnya)
   * Default "switching-prefixed" agar tidak bentrok dengan header arah Gateway -> Switching.
   * Sesuaikan dengan kesepakatan tim Gateway.
   */
  headerConvention?: 'gateway-prefixed' | 'switching-prefixed';
}

export function signOutgoingGatewayRequest(opts: SignForGatewayOptions): SignedGatewayHeaders {
  const {
    sharedSecret,
    apiKey,
    rawBody,
    idempotencyKey,
    headerConvention = 'switching-prefixed',
  } = opts;

  if (!sharedSecret) {
    throw new Error('Cannot sign outgoing gateway request: sharedSecret is empty');
  }
  if (!apiKey) {
    throw new Error('Cannot sign outgoing gateway request: apiKey is empty');
  }

  const { signature, timestamp } = WebhookCrypto.signOutgoingRequest(sharedSecret, rawBody);

  const headers: SignedGatewayHeaders = {
    'x-api-key': apiKey,
    'content-type': 'application/json',
  };

  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  if (headerConvention === 'gateway-prefixed') {
    headers['x-gateway-signature'] = signature;
    headers['x-gateway-timestamp'] = timestamp;
  } else {
    headers['x-switching-signature'] = signature;
    headers['x-switching-timestamp'] = timestamp;
  }

  return headers;
}

export interface GatewaySubmitResult<T = unknown> {
  ok: boolean;
  status: number;
  gateway_request_id?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CallGatewayEndpointOptions<TReqBody = unknown> {
  method: 'POST' | 'GET' | 'PATCH';
  url: string;
  body?: TReqBody;
  sharedSecret: string;
  apiKey: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  headerConvention?: 'gateway-prefixed' | 'switching-prefixed';
}

export async function callGatewayEndpoint<TReqBody = unknown, TResp = unknown>(
  opts: CallGatewayEndpointOptions<TReqBody>,
): Promise<GatewaySubmitResult<TResp>> {
  const {
    method,
    url,
    body,
    sharedSecret,
    apiKey,
    idempotencyKey,
    timeoutMs = Number(process.env.GATEWAY_TIMEOUT_MS) || 10000,
    headerConvention,
  } = opts;

  let rawBody = '';
  if (body !== undefined && method !== 'GET') {
    rawBody = JSON.stringify(body);
  }

  const signedHeaders = signOutgoingGatewayRequest({
    sharedSecret,
    apiKey,
    rawBody,
    idempotencyKey,
    headerConvention,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method,
      headers: signedHeaders as unknown as Record<string, string>,
      body: method !== 'GET' && rawBody.length > 0 ? rawBody : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await resp.text();
    let parsed: TResp | undefined;
    try {
      parsed = text ? (JSON.parse(text) as TResp) : undefined;
    } catch {
      parsed = undefined;
    }

    const ok = resp.status >= 200 && resp.status < 300;

    const asRecord = parsed as unknown as Record<string, unknown> | undefined;
    const gatewayRequestId =
      (asRecord?.gateway_request_id as string) ||
      (asRecord?.data && typeof asRecord.data === 'object'
        ? ((asRecord.data as Record<string, unknown>).gateway_request_id as string)
        : undefined) ||
      resp.headers.get('x-gateway-request-id') ||
      undefined;

    if (ok) {
      return {
        ok: true,
        status: resp.status,
        gateway_request_id: gatewayRequestId,
        data: parsed,
      };
    }

    const errRecord = asRecord;
    const errObj = errRecord?.error && typeof errRecord.error === 'object'
      ? (errRecord.error as Record<string, unknown>)
      : undefined;
    return {
      ok: false,
      status: resp.status,
      gateway_request_id: gatewayRequestId,
      error: {
        code: (errObj?.code as string) || `GATEWAY_HTTP_${resp.status}`,
        message: (errObj?.message as string) || `Gateway returned HTTP ${resp.status}`,
        details: errObj?.details ?? parsed,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      /abort|timeout/i.test(msg);
    return {
      ok: false,
      status: 0,
      error: {
        code: isAbort ? 'GATEWAY_TIMEOUT' : 'GATEWAY_NETWORK_ERROR',
        message: isAbort
          ? `Gateway call timed out after ${timeoutMs}ms: ${url}`
          : `Failed to reach gateway at ${url}: ${msg}`,
        details: { url, method },
      },
    };
  }
}
