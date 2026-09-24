import React, { useState, useEffect } from 'react';
import {
  Payable,
  TamperAuditResponse,
  User,
} from '../types.ts';
import { ApiClient } from '../api.ts';
import {
  ShieldAlert,
  ShieldCheck,
  Database,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  Zap,
  Lock,
  Layers,
  FileText,
  Search,
  Hash,
} from 'lucide-react';

interface TamperAuditLabPageProps {
  currentUser: User | null;
  initialPayableId?: string;
  onNavigateToLedger: (entityId?: string) => void;
}

export const TamperAuditLabPage: React.FC<TamperAuditLabPageProps> = ({
  currentUser,
  initialPayableId,
  onNavigateToLedger,
}) => {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [tamperedInputAmount, setTamperedInputAmount] = useState('150000000.00');
  const [auditResult, setAuditResult] = useState<TamperAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPayables = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.getPayables({ limit: 50 });
      setPayables(res.items);

      if (initialPayableId) {
        const found = res.items.find((p) => p.id === initialPayableId);
        if (found) {
          setSelectedPayable(found);
          runAudit(found.id);
          return;
        }
      }

      if (res.items.length > 0 && !selectedPayable) {
        setSelectedPayable(res.items[0]);
        runAudit(res.items[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load payables for lab', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const runAudit = async (payableId: string) => {
    try {
      setActionLoading(true);
      const res = await ApiClient.auditPayableIntegrity(payableId);
      setAuditResult(res);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal menjalankan audit' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectPayable = (p: Payable) => {
    setSelectedPayable(p);
    runAudit(p.id);
  };

  const handleSimulateTamper = async () => {
    if (!selectedPayable) return;
    try {
      setActionLoading(true);
      const updated = await ApiClient.tamperPayableSimulate(selectedPayable.id, tamperedInputAmount);
      setSelectedPayable(updated);
      setFeedback({
        type: 'error',
        text: `Simulasi Manipulasi Berhasil: Nilai database diubah dari ${formatRupiah(updated.tampered_amount || 0)} menjadi ${formatRupiah(tamperedInputAmount)}. Blockchain ledger tetap tidak berubah!`,
      });
      await runAudit(selectedPayable.id);
      fetchPayables();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal mensimulasikan manipulasi' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreRecord = async () => {
    if (!selectedPayable) return;
    try {
      setActionLoading(true);
      const restored = await ApiClient.restorePayable(selectedPayable.id);
      setSelectedPayable(restored);
      setFeedback({
        type: 'success',
        text: 'Data database relasional berhasil dipulihkan ke nilai aslinya. Hash lokal kini identik dengan konsensus blockchain!',
      });
      await runAudit(selectedPayable.id);
      fetchPayables();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Gagal memulihkan record' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatRupiah = (val: string | number) => {
    const num = Number(val);
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Tamper-Evident Audit Trail Laboratory
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Laboratorium Audit Integritas & Deteksi Manipulasi
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Uji ketahanan blockchain sebagai bukti abadi anti-manipulasi. Simulasikan pengubahan ilegal data faktur di database relasional, dan saksikan bagaimana konsensus Hyperledger Fabric secara seketika mendeteksi ketidaksesuaian (Mismatch).
            </p>
          </div>

          <button
            onClick={() => selectedPayable && onNavigateToLedger(selectedPayable.id)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center gap-2 transition cursor-pointer self-start md:self-auto"
          >
            <Cpu className="w-4 h-4" />
            Buka di Fabric Explorer
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Interactive Selection Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
          Pilih Kewajiban / Tagihan untuk Diuji:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {payables.map((p) => {
            const isSelected = selectedPayable?.id === p.id;
            const isTampered = p.is_tampered;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPayable(p)}
                className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">{p.payable_number}</span>
                  {isTampered ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-2.5 h-2.5" /> TAMPERED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      GENUINE
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 truncate">{p.vendor_legal_name}</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{formatRupiah(p.amount)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Split Comparison: Database vs Hyperledger Fabric */}
      {selectedPayable && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Relational Database (Mutable) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Database Relasional Biasa</h3>
                    <p className="text-[11px] text-slate-500">PostgreSQL / MySQL (Data Operasional)</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                  Mutable (Dapat Diubah)
                </span>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nomor PO:</span>
                    <span className="font-semibold text-slate-900">{selectedPayable.po_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nomor Tagihan:</span>
                    <span className="font-semibold text-slate-900">{selectedPayable.invoice_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Nilai Tagihan di Database:</span>
                    <span
                      className={`text-base font-extrabold ${
                        selectedPayable.is_tampered ? 'text-rose-600 animate-pulse' : 'text-slate-900'
                      }`}
                    >
                      {formatRupiah(selectedPayable.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status Database:</span>
                    <span className="font-semibold text-slate-900">{selectedPayable.status}</span>
                  </div>
                </div>

                {/* Computed DB Hash */}
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-1.5">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-indigo-400" />
                    Computed Database Digest (SHA-256):
                  </div>
                  <div className="text-indigo-300 break-all select-all font-semibold">
                    {auditResult?.database_hash || 'Menghitung hash...'}
                  </div>
                </div>

                {/* Tamper Simulator Controls */}
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Simulasi Manipulasi Nilai Database:
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tamperedInputAmount}
                      onChange={(e) => setTamperedInputAmount(e.target.value)}
                      placeholder="Nilai manipulasi (cth: 150000000.00)"
                      className="text-xs px-3 py-2 border border-slate-300 rounded-lg flex-1 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSimulateTamper}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      Ubah Database
                    </button>
                  </div>

                  {selectedPayable.is_tampered && (
                    <button
                      onClick={handleRestoreRecord}
                      disabled={actionLoading}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Pulihkan Data Asli (Restore)
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 text-slate-500 text-[11px]">
              Tipe penyimpanan: PostgreSQL / MySQL data rows. Data dapat dimanipulasi oleh akses root atau SQL injection langsung.
            </div>
          </div>

          {/* Right Panel: Hyperledger Fabric Immutable Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Hyperledger Fabric Ledger</h3>
                    <p className="text-[11px] text-slate-500">Channel: procurementchannel</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Immutable (Abadi)
                </span>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chaincode ID:</span>
                    <span className="font-mono font-semibold text-slate-900">procurement-ledger</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Event Ledger:</span>
                    <span className="font-semibold text-indigo-700">PAYABLE_CREATED</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Nilai Sah Terdaftar di Chaincode:</span>
                    <span className="text-base font-extrabold text-indigo-700">
                      {formatRupiah(selectedPayable.tampered_amount || selectedPayable.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Konsensus Peers:</span>
                    <span className="font-semibold text-emerald-700">ENDORSED & COMMITTED</span>
                  </div>
                </div>

                {/* Stored Fabric Hash */}
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-1.5">
                  <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    Immutable Sealed Hash on Fabric Ledger:
                  </div>
                  <div className="text-emerald-300 break-all select-all font-semibold">
                    {auditResult?.ledger_hash || selectedPayable.document_hash}
                  </div>
                </div>

                {/* Audit Action Button */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={() => runAudit(selectedPayable.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                    Verifikasi Audit Kriptografis (DB vs Blockchain)
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 text-slate-500 text-[11px]">
              Tipe penyimpanan: Hyperledger Fabric World State & Blockchain Block DAG. Dilindungi kriptografi ECDSA/SHA-256.
            </div>
          </div>
        </div>
      )}

      {/* Live Tamper-Evident Diagnostic Box */}
      {auditResult && (
        <div
          className={`p-6 rounded-2xl border transition-all ${
            auditResult.is_match
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-sm'
              : 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-md ring-2 ring-rose-500/20'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                auditResult.is_match
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 animate-pulse'
              }`}
            >
              {auditResult.is_match ? (
                <ShieldCheck className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-bold tracking-tight">
                  {auditResult.is_match
                    ? 'VERIFIKASI INTEGRITAS LOLOS (100% MATCH)'
                    : 'PERINGATAN MANIPULASI TERDETEKSI (TAMPER MISMATCH)!'}
                </h3>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto ${
                    auditResult.is_match
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-rose-200 text-rose-900 animate-bounce'
                  }`}
                >
                  {auditResult.status}
                </span>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed max-w-3xl">
                {auditResult.message}
              </p>

              {/* Cryptographic Comparison formula */}
              <div className="mt-4 pt-3 border-t border-current/10 font-mono text-xs space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="opacity-75">DATABASE Hash:</span>
                  <span className="font-semibold break-all">{auditResult.database_hash}</span>
                </div>
                <div className="text-center font-bold text-sm my-0.5">
                  {auditResult.is_match ? '== IDENTIK DENGAN ==' : '≠ TIDAK COCOK (MISMATCH) ≠'}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="opacity-75">BLOCKCHAIN Hash:</span>
                  <span className="font-semibold break-all">{auditResult.ledger_hash}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Ledger Lifecycle Architecture Guide (Prompt Point 4) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Arsitektur Event Ledger Pengadaan & Kewajiban (Accounts Payable)
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Setiap tahapan bisnis tidak dicatat dalam satu transaksi raksasa, melainkan sebagai rantai peristiwa independen berurutan yang saling tertaut secara kriptografis:
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: 'PO CREATED', desc: 'Pembuatan Pesanan' },
            { label: 'GOODS RECEIVED', desc: 'Surat Jalan / BAST' },
            { label: 'GOODS VERIFIED', desc: 'Pemeriksaan Fisik' },
            { label: 'INVOICE SUBMITTED', desc: 'Pemasukan Tagihan' },
            { label: 'INVOICE VERIFIED', desc: 'Verifikasi Berkas' },
            { label: 'PAYABLE CREATED', desc: 'Pengakuan Utang' },
            { label: 'PAYMENT APPROVED', desc: 'Persetujuan Pejabat' },
            { label: 'PAYMENT INITIATED', desc: 'Penerbitan SP2D' },
            { label: 'SETTLED', desc: 'Pelunasan Permanen' },
          ].map((step, idx, arr) => (
            <React.Fragment key={step.label}>
              <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 transition">
                <div className="font-mono font-bold text-[11px] text-indigo-700">{step.label}</div>
                <div className="text-[10px] text-slate-500">{step.desc}</div>
              </div>
              {idx < arr.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
