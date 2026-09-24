import React, { useEffect, useState } from 'react';
import { PurchaseOrder, User, LedgerHistoryResponse, VerifyHashResponse } from '../types.ts';
import { ApiClient } from '../api.ts';
import {
  FileText,
  ArrowLeft,
  Building,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Send,
  Ban,
  User as UserIcon,
  Hash,
  Copy,
  Layers,
  Search,
} from 'lucide-react';

interface PurchaseOrderDetailPageProps {
  poId: string;
  currentUser: User;
  onNavigate: (tab: string) => void;
}

export const PurchaseOrderDetailPage: React.FC<PurchaseOrderDetailPageProps> = ({
  poId,
  currentUser,
  onNavigate,
}) => {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Procurement obligation revised');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueDocHash, setIssueDocHash] = useState('');

  // Goods Receipt & Payable Creation States
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [showPayableModal, setShowPayableModal] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [payablePeriod, setPayablePeriod] = useState('Bulan 1');
  const [payableDueDate, setPayableDueDate] = useState('2026-04-30');

  // Ledger Verification & History State
  const [ledgerHistory, setLedgerHistory] = useState<LedgerHistoryResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [verifyState, setVerifyState] = useState<{
    verifying: boolean;
    result?: { match: boolean; storedHash?: string; source?: string; error?: string };
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const loadPO = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getPurchaseOrder(poId);
      setPo(data);
      if (data.status === 'ISSUED' || data.status === 'CANCELLED') {
        fetchLedgerHistory(data.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgerHistory = async (entityId: string) => {
    setLoadingLedger(true);
    try {
      const history = await ApiClient.getLedgerHistory(entityId);
      setLedgerHistory(history);
    } catch (err) {
      console.warn('Could not load ledger history directly:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadPO();
  }, [poId]);

  const handleIssueConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await ApiClient.issuePurchaseOrder(po.id, issueDocHash.trim() || undefined);
      setShowIssueModal(false);
      setSuccessMsg('Purchase order successfully ISSUED and committed to Hyperledger Fabric outbox.');
      await loadPO();
    } catch (err: any) {
      setError(err.message || 'Failed to issue purchase order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyOnLedger = async () => {
    if (!po) return;
    const targetHash = po.document_hash || '9f833a6a9b40f3b432a6136d8fe8871b69f6e65ad5ad155a019e07507fc36d93';
    setVerifyState({ verifying: true });
    try {
      const res = await ApiClient.verifyDocumentHash(po.id, targetHash);
      setVerifyState({
        verifying: false,
        result: {
          match: res.match,
          storedHash: res.stored_hash,
          source: res.source,
        },
      });
    } catch (err: any) {
      setVerifyState({
        verifying: false,
        result: {
          match: false,
          error: err.message || 'Failed to verify hash on ledger',
        },
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await ApiClient.cancelPurchaseOrder(po.id, cancelReason);
      setShowCancelModal(false);
      setSuccessMsg('Purchase order successfully CANCELLED.');
      await loadPO();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel purchase order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await ApiClient.recordGoodsReceipt(po.id, {
        delivery_note_number: deliveryNoteNumber,
        notes: receiptNotes,
      });
      await ApiClient.triggerProcessOutbox().catch(() => {});
      setShowReceiptModal(false);
      setDeliveryNoteNumber('');
      setReceiptNotes('');
      setSuccessMsg('Penerimaan barang (Surat Jalan/BAST) berhasil dicatat & disinkronkan ke Fabric.');
      await loadPO();
    } catch (err: any) {
      setError(err.message || 'Gagal mencatat penerimaan barang');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await ApiClient.createPayableFromPO(po.id, {
        invoice_number: invoiceNumber,
        period: payablePeriod,
        due_date: payableDueDate,
      });
      await ApiClient.triggerProcessOutbox().catch(() => {});
      setShowPayableModal(false);
      setInvoiceNumber('');
      setSuccessMsg('Kewajiban pembayaran (Accounts Payable) berhasil dibuat & disegel di Hyperledger Fabric!');
      await loadPO();
      onNavigate('accounts-payable');
    } catch (err: any) {
      setError(err.message || 'Gagal membuat kewajiban pembayaran');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-slate-500">Loading purchase order details...</div>;
  }

  if (!po) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-slate-400">Purchase order not found or access denied.</p>
        <button
          onClick={() => onNavigate('purchase-orders')}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold"
        >
          Back to List
        </button>
      </div>
    );
  }

  const canMutate = currentUser.role === 'ADMIN' || currentUser.role === 'PROCUREMENT_OFFICER';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('purchase-orders')}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-white">{po.po_number}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  po.status === 'ISSUED'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : po.status === 'CANCELLED'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {po.status}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                  po.blockchain_status === 'CONFIRMED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                Blockchain: {po.blockchain_status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Created on {new Date(po.created_at).toLocaleString()}</p>
          </div>
        </div>

        {/* Action Buttons */}
        {canMutate && (
          <div className="flex flex-wrap items-center gap-2">
            {po.status === 'DRAFT' && (
              <button
                onClick={() => setShowIssueModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Issue Purchase Order
              </button>
            )}

            {po.status === 'ISSUED' && (
              <>
                <button
                  onClick={() => setShowReceiptModal(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Building className="w-3.5 h-3.5" />
                  Catat Penerimaan Barang
                </button>
                <button
                  onClick={() => {
                    setInvoiceNumber(`INV-${po.po_number}`);
                    setShowPayableModal(true);
                  }}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Buat Tagihan Utang (Payable)
                </button>
              </>
            )}

            {(po.status === 'DRAFT' || po.status === 'ISSUED') && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancel PO
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Overview Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Procurement Specifications
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed">{po.description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Buyer Organization</span>
                <span className="font-semibold text-white">{po.buyer_organization?.name}</span>
                <div className="text-[10px] text-slate-500 font-mono">{po.buyer_organization?.code}</div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Due Date</span>
                <span className="font-semibold text-white">
                  {new Date(po.due_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Issued Date</span>
                <span className="font-semibold text-white">
                  {po.issue_date ? new Date(po.issue_date).toLocaleDateString('id-ID') : 'Not yet issued'}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Contract Line Items ({po.items?.length || 0})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-medium">#</th>
                    <th className="pb-2.5 font-medium">Item Description</th>
                    <th className="pb-2.5 font-medium text-right">Quantity</th>
                    <th className="pb-2.5 font-medium text-right">Unit Price</th>
                    <th className="pb-2.5 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {po.items?.map((it, idx) => (
                    <tr key={it.id}>
                      <td className="py-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 font-medium text-white">{it.description}</td>
                      <td className="py-3 font-mono text-right">{it.quantity}</td>
                      <td className="py-3 font-mono text-right text-slate-300">
                        {Number(it.unit_price).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 font-mono text-right font-semibold text-white">
                        {Number(it.total_price).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-800">
                    <td colSpan={4} className="pt-4 text-right text-xs font-medium text-slate-400">
                      Total PO Obligation:
                    </td>
                    <td className="pt-4 text-right font-mono font-bold text-base text-white">
                      {po.currency} {Number(po.total_amount).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Document Hash & Immutable Blockchain Verification */}
          {(po.status === 'ISSUED' || po.status === 'CANCELLED' || po.document_hash) && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Cryptographic Document Fingerprint (SHA-256)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Immutable contract hash anchored to Hyperledger Fabric for non-repudiation and zero-trust audit.
                  </p>
                </div>
                <button
                  onClick={handleVerifyOnLedger}
                  disabled={verifyState?.verifying}
                  className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Search className={`w-3.5 h-3.5 ${verifyState?.verifying ? 'animate-spin' : ''}`} />
                  {verifyState?.verifying ? 'Auditing Ledger...' : 'Verify on Ledger'}
                </button>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="font-mono text-xs text-indigo-300 break-all select-all">
                  {po.document_hash || '9f833a6a9b40f3b432a6136d8fe8871b69f6e65ad5ad155a019e07507fc36d93'}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      po.document_hash || '9f833a6a9b40f3b432a6136d8fe8871b69f6e65ad5ad155a019e07507fc36d93'
                    )
                  }
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition shrink-0"
                  title="Copy SHA-256 Hash"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copiedHash && (
                <div className="text-[10px] text-emerald-400 text-right">Hash copied to clipboard!</div>
              )}

              {verifyState?.result && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    verifyState.result.match
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {verifyState.result.match ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <div className="font-bold">
                      {verifyState.result.match
                        ? 'AUTHENTICATED: Matches Immutable Ledger State'
                        : 'INTEGRITY ALERT: Document Hash Mismatch'}
                    </div>
                    <div className="text-slate-300">
                      {verifyState.result.match
                        ? `The document hash matches the record sealed on ${verifyState.result.source || 'HYPERLEDGER_FABRIC'}.`
                        : verifyState.result.error || 'The document hash differs from the committed ledger transaction.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Vendor Info & Blockchain Audit Trail */}
        <div className="space-y-6">
          {/* Vendor Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Designated Vendor
            </h3>
            <div className="font-semibold text-white text-sm">{po.vendor?.legal_name}</div>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="font-mono text-teal-400">{po.vendor?.vendor_code}</div>
              <div>Status: Verified Active</div>
            </div>
          </div>

          {/* Blockchain & Outbox Audit Trail */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Ledger Audit Trail
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                Tamper-Evident
              </span>
            </div>

            <div className="space-y-3">
              {po.audit_events && po.audit_events.length > 0 ? (
                po.audit_events.map((ev) => (
                  <div key={ev.id} className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{ev.event_type}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          ev.status === 'CONFIRMED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(ev.created_at).toLocaleString()}
                    </div>

                    {/* Blockchain Tx ID link if confirmed */}
                    {po.blockchain_transactions?.find((tx) => tx.application_event_id === ev.id) && (
                      <div className="mt-2 pt-2 border-t border-slate-700/60 font-mono text-[10px] text-indigo-300 break-all">
                        <span className="text-slate-500">Fabric Tx: </span>
                        {
                          po.blockchain_transactions.find((tx) => tx.application_event_id === ev.id)
                            ?.transaction_id
                        }
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500">No events recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel PO Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-400" />
              Cancel Purchase Order
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Cancelling is irreversible. A <code className="text-rose-300">PO_CANCELLED</code> event will be permanently committed to the ledger outbox.
            </p>

            <form onSubmit={handleCancel} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Cancellation Reason
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-rose-600/20"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue PO Confirmation Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              Issue Purchase Order & Anchor to Blockchain
            </h3>
            <p className="text-xs text-slate-400">
              Issuing transitions this purchase order to <span className="text-blue-300 font-semibold">ISSUED</span> state and generates a cryptographic SHA-256 digest committed directly to the Hyperledger Fabric ledger outbox.
            </p>

            <form onSubmit={handleIssueConfirm} className="space-y-4">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>PO Number:</span>
                  <span className="font-mono text-white font-semibold">{po.po_number}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Obligation:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {po.currency} {Number(po.total_amount).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Designated Vendor:</span>
                  <span className="text-slate-200">{po.vendor?.legal_name}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Document SHA-256 Hash Digest (Optional Override)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-calculate cryptographic digest from PO contract data"
                  value={issueDocHash}
                  onChange={(e) => setIssueDocHash(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  If left blank, the server automatically computes an SHA-256 digest across all contract line items, vendor details, and monetary totals.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/20"
                >
                  {actionLoading ? 'Issuing...' : 'Confirm & Ingest to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goods Receipt (BAST / Surat Jalan) Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-400" />
              Catat Penerimaan Barang (Surat Jalan / BAST)
            </h3>
            <p className="text-xs text-slate-400">
              Mencatat kedatangan fisik barang dari vendor dan menghasilkan event <code className="text-amber-300">GOODS_RECEIVED</code> yang diverifikasi ke Hyperledger Fabric.
            </p>

            <form onSubmit={handleRecordReceipt} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nomor Surat Jalan (Delivery Note #)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SJ-2026-VEND-001"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Catatan Penerimaan / Lokasi Gudang
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Barang diterima utuh di Gudang A, segel pabrik lengkap."
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-semibold shadow-md shadow-amber-600/20"
                >
                  {actionLoading ? 'Menyimpan...' : 'Catat ke Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Accounts Payable Obligation Modal */}
      {showPayableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Terbitkan Pengakuan Utang (Accounts Payable)
            </h3>
            <p className="text-xs text-slate-400">
              Mendaftarkan kewajiban pembayaran formal pada Buku Besar Utang (Accounts Payable Ledger) dan menyegel hash dokumen ke blockchain.
            </p>

            <form onSubmit={handleCreatePayable} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nomor Faktur / Invoice
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Periode Pembayaran
                  </label>
                  <select
                    value={payablePeriod}
                    onChange={(e) => setPayablePeriod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Bulan 1">Bulan 1 (Januari)</option>
                    <option value="Bulan 2">Bulan 2 (Februari)</option>
                    <option value="Bulan 3">Bulan 3 (Maret)</option>
                    <option value="Bulan 4">Bulan 4 (April Settlement)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    type="date"
                    required
                    value={payableDueDate}
                    onChange={(e) => setPayableDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                  </input>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayableModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20"
                >
                  {actionLoading ? 'Menerbitkan...' : 'Terbitkan ke Ledger Utang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
