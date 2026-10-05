import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, DbPayable } from '../../database/db.service.ts';
import { AppError } from '../../common/response.dto.ts';
import { OutboxStatus, BlockchainTxStatus, Role } from '../../common/types.ts';

/**
 * Status enum that matches the EXACT Switching backend GatewayStatus from the switching-main
 * repository (dto/gateway-webhook.dto.ts GatewayWebhookDto.status). Used for
 * callbacks coming from the Switching integration hub directly.
 */
export type SwitchingGatewayStatus =
  | 'submitted'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'timeout';

/**
 * Shape 1 — CamelCase DTO, exact 1:1 mirror of switching-main backend's GatewayWebhookDto.
 * Switching calls us after it has already correlated the webhook to a transaction on its
 * side and forwards the status downstream to BukuPencatatan (Accounts Payable
 * Ledger) so we can advance the payable lifecycle.
 */
export interface SwitchingGatewayStatusDto {
  gatewayRequestId: string;
  correlationId?: string;
  status: SwitchingGatewayStatus;
  blockchainTxHash?: string | null;
  errorMessage?: string | null;
  /**
   * Optional extended fields forwarded through the routing/field-mapping pipeline.
   * Switching injects these from the original payload so we can locate our payable.
   */
  payableId?: string;
  payableNumber?: string;
  gatewayPaymentRef?: string;
  finalSettlementRef?: string | null;
  settledAmountMinor?: string;
  currency?: string;
  applicationEventId?: string;
  entityId?: string;
  entityType?: string;
  occurredAt?: string;
}

export type LegacyGatewayEventType =
  | 'transaction.submitted'
  | 'transaction.confirmed'
  | 'transaction.failed'
  | 'payment.gateway_ack'
  | 'payment.settled'
  | 'payment.failed';

/**
 * Shape 2 — dotted event_type schema (direct Gateway → BukuPencatatan, no Switching
 * in the middle). Kept for direct-Gateway topologies and backwards compat with
 * earlier drafts of the integration contract.
 */
export interface LegacyGatewayEventPayload {
  gateway_request_id: string;
  idempotency_key?: string | null;
  event_type: LegacyGatewayEventType;
  occurred_at: string;
  entity_id?: string;
  entity_type?: string;
  application_event_id?: string;
  blockchain_tx_id?: string;
  block_height?: number | string | null;
  network?: string;
  error_message?: string | null;
  payable_id?: string;
  payable_number?: string;
  gateway_payment_ref?: string;
  final_settlement_ref?: string | null;
  settled_amount_minor?: string;
  currency?: string;
}

export type InboundWebhookPayload = SwitchingGatewayStatusDto | LegacyGatewayEventPayload;

export interface InboundWebhookResult {
  received: true;
  applied: boolean;
  eventId: string;
  gatewayRequestId: string;
  updatedEntity?: {
    type: string;
    id: string;
    status?: string;
  };
}

/** Guard helpers for normalizing either DTO shape into a single normalized view so the rest of
 *  the handler doesn't have to branch on casing every field access. */
interface NormalizedWebhook {
  gatewayRequestId: string;
  statusCategory:
    | 'transaction.submitted'
    | 'transaction.confirmed'
    | 'transaction.failed'
    | 'payment.gateway_ack'
    | 'payment.settled'
    | 'payment.failed'
    | 'unknown';
  blockchainTxHash?: string | null;
  errorMessage?: string | null;
  payableId?: string;
  payableNumber?: string;
  gatewayPaymentRef?: string;
  finalSettlementRef?: string | null;
  settledAmountMinor?: string;
  currency?: string;
  applicationEventId?: string;
  entityId?: string;
  entityType?: string;
  occurredAt?: string;
  correlationId?: string;
  raw: InboundWebhookPayload;
}

function isSwitchingDto(p: InboundWebhookPayload): p is SwitchingGatewayStatusDto {
  return (p as SwitchingGatewayStatusDto).gatewayRequestId !== undefined &&
    typeof (p as SwitchingGatewayStatusDto).status !== undefined;
}

function normalizePayload(p: InboundWebhookPayload): NormalizedWebhook {
  if (isSwitchingDto(p)) {
    let statusCategory: NormalizedWebhook['statusCategory'];
    switch (p.status) {
      case 'submitted':
      case 'pending':
        statusCategory = 'transaction.submitted';
        break;
      case 'confirmed':
        statusCategory =
          (p.finalSettlementRef || p.payableId || p.payableNumber)
            ? 'payment.settled'
            : 'transaction.confirmed';
        break;
      case 'failed':
        statusCategory =
          (p.payableId || p.payableNumber) ? 'payment.failed' : 'transaction.failed';
      case 'timeout':
        statusCategory = 'transaction.failed';
        break;
      default:
        statusCategory = 'unknown';
    }
    return {
      gatewayRequestId: p.gatewayRequestId,
      statusCategory,
      blockchainTxHash: p.blockchainTxHash ?? null,
      errorMessage: p.errorMessage ?? null,
      payableId: p.payableId,
      payableNumber: p.payableNumber,
      gatewayPaymentRef: p.gatewayPaymentRef,
      finalSettlementRef: p.finalSettlementRef,
      settledAmountMinor: p.settledAmountMinor,
      currency: p.currency,
      applicationEventId: p.applicationEventId,
      entityId: p.entityId,
      entityType: p.entityType,
      occurredAt: p.occurredAt,
      correlationId: p.correlationId,
      raw: p,
    };
  }

  // Legacy dotted schema
  return {
    gatewayRequestId: p.gateway_request_id,
    statusCategory: p.event_type,
    blockchainTxHash: p.blockchain_tx_id ?? null,
    errorMessage: p.error_message ?? null,
    payableId: p.payable_id,
    payableNumber: p.payable_number,
    gatewayPaymentRef: p.gateway_payment_ref,
    finalSettlementRef: p.final_settlement_ref,
    settledAmountMinor: p.settled_amount_minor,
    currency: p.currency,
    applicationEventId: p.application_event_id,
    entityId: p.entity_id,
    entityType: p.entity_type,
    occurredAt: p.occurred_at,
    raw: p,
  };
}

export class GatewayWebhookService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async handleGatewayWebhook(payload: InboundWebhookPayload): Promise<InboundWebhookResult> {
    const n = this.validateAndNormalize(payload);
    const eventId = uuidv4();

    this.recordInboundEvent(eventId, n);

    let updatedEntity: InboundWebhookResult['updatedEntity'];

    switch (n.statusCategory) {
      case 'transaction.submitted':
        updatedEntity = this.handleTransactionSubmitted(n);
        break;
      case 'transaction.confirmed':
        updatedEntity = this.handleTransactionConfirmed(n);
        break;
      case 'transaction.failed':
        updatedEntity = this.handleTransactionFailed(n);
        break;
      case 'payment.gateway_ack':
        updatedEntity = this.handlePaymentGatewayAck(n);
        break;
      case 'payment.settled':
        updatedEntity = this.handlePaymentSettled(n);
        break;
      case 'payment.failed':
        updatedEntity = this.handlePaymentFailed(n);
        break;
      default:
        return {
          received: true,
          applied: false,
          eventId,
          gatewayRequestId: n.gatewayRequestId,
        };
    }

    return {
      received: true,
      applied: true,
      eventId,
      gatewayRequestId: n.gatewayRequestId,
      updatedEntity,
    };
  }

  private validateAndNormalize(p: InboundWebhookPayload): NormalizedWebhook {
    if (!p) {
      throw new AppError('VALIDATION_ERROR', 'Webhook payload is required', 400);
    }
    const n = normalizePayload(p);
    if (!n.gatewayRequestId) {
      throw new AppError(
      'VALIDATION_ERROR',
      'gatewayRequestId / gateway_request_id is required in webhook payload',
      400,
    );
    }
    if (n.statusCategory === 'unknown') {
      throw new AppError(
      'VALIDATION_ERROR',
      'Unrecognized webhook status/event_type — cannot map to a handler',
      400,
    );
    }
    return n;
  }

  private recordInboundEvent(eventId: string, n: NormalizedWebhook): void {
    try {
      const entityId = n.payableId ?? n.entityId ?? n.gatewayRequestId;
      const entityType = n.payableId ? 'PAYABLE' : n.entityType ?? 'GATEWAY_CALLBACK';
      this.db.application_events.set(eventId, {
        id: eventId,
        event_type: `INBOUND_HOOK::${n.statusCategory}`,
        entity_id: entityId,
        entity_type: entityType,
        actor_id: null,
        organization_id: null,
        payload: {
          ...(n.raw as unknown as Record<string, unknown>),
          received_at: new Date().toISOString(),
        },
        status: OutboxStatus.CONFIRMED,
        attempt_count: 1,
        last_error: null,
        created_at: new Date(),
        processed_at: new Date(),
      });
    } catch {
      // Non-fatal: audit trail is nice-to-have; webhook must always ack 2xx regardless.
    }
  }

  private handleTransactionSubmitted(
    n: NormalizedWebhook,
  ): InboundWebhookResult['updatedEntity'] {
    if (n.blockchainTxHash) {
      const existingTx = Array.from(this.db.blockchain_transactions.values()).find(
        (tx) => tx.transaction_id === n.blockchainTxHash,
      );
      if (!existingTx) {
        const txId = uuidv4();
        this.db.blockchain_transactions.set(txId, {
          id: txId,
          application_event_id: n.applicationEventId ?? 'webhook-only',
          transaction_id: n.blockchainTxHash,
          event_type: n.entityType && n.entityType.length > 0
            ? `${n.entityType}_SUBMITTED`
            : 'UNKNOWN_SUBMITTED',
          entity_id: n.entityId ?? n.gatewayRequestId,
          entity_type: n.entityType ?? 'UNKNOWN',
          status: BlockchainTxStatus.SUBMITTED,
          error_message: null,
          submitted_at: n.occurredAt ? new Date(n.occurredAt) : new Date(),
          confirmed_at: null,
        });
        return { type: 'blockchain_transaction', id: txId, status: BlockchainTxStatus.SUBMITTED };
      }
      existingTx.status = BlockchainTxStatus.SUBMITTED;
      return {
        type: 'blockchain_transaction',
        id: existingTx.id,
        status: BlockchainTxStatus.SUBMITTED,
      };
    }
    if (n.applicationEventId) {
      const ev = this.db.application_events.get(n.applicationEventId);
      if (ev) {
        ev.status = OutboxStatus.PROCESSING;
        ev.last_error = null;
        return { type: 'application_event', id: ev.id, status: OutboxStatus.PROCESSING };
      }
    }
    return undefined;
  }

  private handleTransactionConfirmed(
    n: NormalizedWebhook,
  ): InboundWebhookResult['updatedEntity'] {
    if (n.blockchainTxHash) {
      const tx = Array.from(this.db.blockchain_transactions.values()).find(
        (t) => t.transaction_id === n.blockchainTxHash,
      );
      if (tx) {
        tx.status = BlockchainTxStatus.CONFIRMED;
        tx.confirmed_at = n.occurredAt ? new Date(n.occurredAt) : new Date();
        tx.error_message = null;
      }
    }
    if (n.applicationEventId) {
      const ev = this.db.application_events.get(n.applicationEventId);
      if (ev) {
        ev.status = OutboxStatus.CONFIRMED;
        ev.processed_at = n.occurredAt ? new Date(n.occurredAt) : new Date();
        ev.last_error = null;
        return { type: 'application_event', id: ev.id, status: OutboxStatus.CONFIRMED };
      }
    }
    return undefined;
  }

  private handleTransactionFailed(
    n: NormalizedWebhook,
  ): InboundWebhookResult['updatedEntity'] {
    if (n.blockchainTxHash) {
      const tx = Array.from(this.db.blockchain_transactions.values()).find(
        (t) => t.transaction_id === n.blockchainTxHash,
      );
      if (tx) {
        tx.status = BlockchainTxStatus.FAILED;
        tx.error_message = n.errorMessage ?? 'Transaction failed (no details from upstream)';
      }
    }
    if (n.applicationEventId) {
      const ev = this.db.application_events.get(n.applicationEventId);
      if (ev) {
        ev.status = OutboxStatus.FAILED;
        ev.last_error = n.errorMessage ?? 'Transaction failed (no details from upstream)';
        return { type: 'application_event', id: ev.id, status: OutboxStatus.FAILED };
      }
    }
    return undefined;
  }

  private resolvePayable(n: NormalizedWebhook): DbPayable | null {
    if (n.payableId && this.db.payables.has(n.payableId)) {
      return this.db.payables.get(n.payableId) ?? null;
    }
    if (n.payableNumber) {
      const byNum = Array.from(this.db.payables.values()).find(
        (pay) => pay.payable_number === n.payableNumber,
      );
      if (byNum) return byNum;
    }
    return null;
  }

  private handlePaymentGatewayAck(
    n: NormalizedWebhook,
  ): InboundWebhookResult['updatedEntity'] {
    const payable = this.resolvePayable(n);
    if (!payable) return undefined;
    if (payable.status === 'PAYABLE' || payable.status === 'APPROVED') {
      payable.status = 'PAYMENT_INITIATED';
    }
    if (n.gatewayPaymentRef && !payable.payment_reference) {
      payable.payment_reference = n.gatewayPaymentRef;
    }
    payable.updated_at = new Date();
    return { type: 'payable', id: payable.id, status: payable.status };
  }

  private handlePaymentSettled(
    n: NormalizedWebhook,
  ): InboundWebhookResult['updatedEntity'] {
    const payable = this.resolvePayable(n);
    if (!payable) return undefined;

    payable.status = 'SETTLED';
    payable.updated_at = new Date();
    if (n.finalSettlementRef) {
      payable.payment_reference = n.finalSettlementRef;
    } else if (n.gatewayPaymentRef && !payable.payment_reference) {
      payable.payment_reference = n.gatewayPaymentRef;
    }

    const po = payable.po_id ? this.db.purchase_orders.get(payable.po_id) : null;
    if (po) {
      po.updated_at = new Date();
    }

    this.emitSettlementOutbox(payable, n);

    return { type: 'payable', id: payable.id, status: payable.status };
  }

  private handlePaymentFailed(
    n: NormalizedWebhook,
  ): InboundWebhookResult['updatedEntity'] {
    const payable = this.resolvePayable(n);
    if (!payable) return undefined;
    if (n.gatewayPaymentRef && !payable.payment_reference) {
      payable.payment_reference = n.gatewayPaymentRef;
    }
    payable.updated_at = new Date();
    return { type: 'payable', id: payable.id, status: payable.status };
  }

  private emitSettlementOutbox(payable: DbPayable, n: NormalizedWebhook): void {
    try {
      const existingSettlement = Array.from(this.db.application_events.values()).find(
        (ev) =>
          ev.event_type === 'SETTLED' &&
          ev.entity_id === payable.id &&
          ev.status === OutboxStatus.CONFIRMED,
      );
      if (existingSettlement) return;

      const eventId = uuidv4();
      this.db.application_events.set(eventId, {
        id: eventId,
        event_type: 'SETTLED',
        entity_id: payable.id,
        entity_type: 'SETTLEMENT',
        actor_id: null,
        organization_id: payable.buyer_organization_id,
        payload: {
          payable_id: payable.id,
          payable_number: payable.payable_number,
          po_id: payable.po_id,
          po_number: payable.po_number,
          vendor_id: payable.vendor_id,
          vendor_legal_name: payable.vendor_legal_name,
          amount: payable.amount,
          amount_minor: n.settledAmountMinor ?? payable.amount_minor,
          currency: n.currency ?? payable.currency,
          payment_reference: n.finalSettlementRef ?? payable.payment_reference,
          gateway_request_id: n.gatewayRequestId,
          document_hash: payable.document_hash,
          settled_at: n.occurredAt ?? new Date().toISOString(),
          source: 'gateway_webhook',
        },
        status: OutboxStatus.CONFIRMED,
        attempt_count: 1,
        last_error: null,
        created_at: new Date(),
        processed_at: new Date(),
      });
    } catch {
      // Non-fatal: settlement audit is secondary; the primary contract for a webhook is
      // simply acknowledging the message.
    }
  }
}
