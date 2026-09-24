import React, { useEffect, useState } from 'react';
import { User, ApplicationEvent, BlockchainTransaction, BlockchainStatusResponse, LedgerHistoryEvent } from '../types.ts';
import { ApiClient } from '../api.ts';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileCheck2,
  Hash,
  Database,
  ArrowRight,
  ExternalLink,
  Lock,
  ChevronRight,
  Sliders,
} from 'lucide-react';

interface BlockchainLedgerPageProps {
  currentUser: User;
  onNavigate: (tab: string) => void;
  initialEntityId?: string;
}

export const BlockchainLedgerPage: React.FC<BlockchainLedgerPageProps> = ({ currentUser, onNavigate, initialEntityId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'outbox' | 'verify' | 'history'>('transactions');
  const [status, setStatus] = useState<BlockchainStatusResponse | null>(null);
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [flushingOutbox, setFlushingOutbox] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Document Verification State
  const [verifyEntityId, setVerifyEntityId] = useState('');
  const [verifyDocHash, setVerifyDocHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    tested: boolean;
    match: boolean;
    storedHash?: string;
    source?: string;
    errorMessage?: string;
  } | null>(null);

  // Entity History Query State
  const [queryEntityId, setQueryEntityId] = useState('');
  const [queryingHistory, setQueryingHistory] = useState(false);
  const [historyResult, setHistoryResult] = useState<{
    entityId: string;
    entityType: string;
    events: LedgerHistoryEvent[];
    source: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, txsRes, eventsRes] = await Promise.all([
        ApiClient.getBlockchainStatus(),
        ApiClient.getBlockchainTransactions(),
        ApiClient.getAuditEvents(),
      ]);
      setStatus(statusRes);
      setTransactions(txsRes || []);
      setEvents(eventsRes || []);

      // If verifyEntityId not set, pick the first PO transaction entityId if available
      if (!verifyEntityId && txsRes.length > 0) {
        setVerifyEntityId(txsRes[0].entity_id);
      }
      if (!queryEntityId && txsRes.length > 0) {
        setQueryEntityId(txsRes[0].entity_id);
      }
    } catch (err: any) {
      console.error('Failed to load blockchain ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (initialEntityId) {
      setQueryEntityId(initialEntityId);
      setVerifyEntityId(initialEntityId);
      setActiveSubTab('history');
      handleQueryHistory(initialEntityId);
    }
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [initialEntityId]);

  const handleSwitchProvider = async (targetProvider: 'fabric' | 'mock') => {
    if (status?.provider === targetProvider) return;
    setSwitchingProvider(true);
    setActionMsg(null);
    try {
      const res = await ApiClient.switchBlockchainProvider(targetProvider);
      setStatus(res);
      setActionMsg({
        type: 'success',
        text: `Active blockchain provider switched to ${res.provider_name} successfully.`,
      });
      await loadData();
    } catch (err: any) {
      setActionMsg({
        type: 'error',
        text: err.message || 'Failed to switch blockchain provider',
      });
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleFlushOutbox = async () => {
    setFlushingOutbox(true);
    setActionMsg(null);
    try {
      const result: any = await ApiClient.triggerProcessOutbox();
      setActionMsg({
        type: 'success',
        text: `Outbox batch executed: ${result.processed} processed, ${result.confirmed} confirmed on ledger.`,
      });
      await loadData();
    } catch (err: any) {
      setActionMsg({
        type: 'error',
        text: err.message || 'Failed to process outbox events',
      });
    } finally {
      setFlushingOutbox(false);
    }
  };

  const handleVerifyHash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEntityId || !verifyDocHash) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await ApiClient.verifyDocumentHash(verifyEntityId.trim(), verifyDocHash.trim());
      setVerifyResult({
        tested: true,
        match: res.match,
        storedHash: res.stored_hash,
        source: res.source,
      });
    } catch (err: any) {
      setVerifyResult({
        tested: true,
        match: false,
        errorMessage: err.message || 'Verification failed to query blockchain node',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleQueryHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryEntityId) return;
    setQueryingHistory(true);
    setHistoryResult(null);
    try {
      const res = await ApiClient.getLedgerHistory(queryEntityId.trim());
      setHistoryResult({
        entityId: res.entity_id,
        entityType: res.entity_type,
        events: res.events,
        source: res.source,
      });
    } catch (err: any) {
      setActionMsg({
        type: 'error',
        text: err.message || 'Failed to query ledger history for entity',
      });
    } finally {
      setQueryingHistory(false);
    }
  };

  const pendingEventsCount = events.filter((e) => e.status === 'PENDING').length;
  const confirmedEventsCount = events.filter((e) => e.status === 'CONFIRMED').length;
  const failedEventsCount = events.filter((e) => e.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/80 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Cpu className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Enterprise Blockchain Audit Layer
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Node Connected
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Hyperledger Fabric Gateway & Ledger Explorer
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Provides cryptographic immutability, transactional outbox batching, and zero-trust document hash verification for the Indonesian public & enterprise procurement ecosystem.
            </p>
          </div>

          {/* Network Controls & Live Switcher */}
          <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-3 rounded-xl space-y-2.5 min-w-[280px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Active Provider:</span>
              <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
                {status?.provider_name || 'HYPERLEDGER_FABRIC'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Channel</span>
                <span className="text-blue-300 truncate block">{status?.channel || 'procurementchannel'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Chaincode</span>
                <span className="text-purple-300 truncate block">{status?.chaincode || 'procurement-ledger'}</span>
              </div>
            </div>

            {currentUser.role === 'ADMIN' ? (
              <div className="pt-1 flex items-center gap-1.5">
                <button
                  onClick={() => handleSwitchProvider('fabric')}
                  disabled={switchingProvider || status?.provider === 'fabric'}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
                    status?.provider === 'fabric'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Fabric Gateway
                </button>
                <button
                  onClick={() => handleSwitchProvider('mock')}
                  disabled={switchingProvider || status?.provider === 'mock'}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
                    status?.provider === 'mock'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Mock Ledger
                </button>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 text-center italic">
                Only System Administrators can toggle blockchain providers.
              </div>
            )}
          </div>
        </div>

        {actionMsg && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center justify-between border ${
              actionMsg.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
            }`}
          >
            <span>{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white">
              &times;
            </button>
          </div>
        )}
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Committed On-Chain</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">{confirmedEventsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Immutable blocks verified</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Outbox</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{pendingEventsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting gateway batch</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Failed Ingestions</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{failedEventsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Requires retry or review</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Outbox Worker</span>
            <RefreshCw className="w-4 h-4 text-blue-400" />
          </div>
          <div className="pt-2">
            <button
              onClick={handleFlushOutbox}
              disabled={flushingOutbox}
              className="w-full py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${flushingOutbox ? 'animate-spin' : ''}`} />
              Process Outbox Now
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'transactions'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          On-Chain Transactions ({transactions.length})
        </button>

        <button
          onClick={() => setActiveSubTab('outbox')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'outbox'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Transactional Outbox Stream ({events.length})
        </button>

        <button
          onClick={() => setActiveSubTab('verify')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'verify'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          Document Hash Verifier
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          Ledger History Explorer
        </button>
      </div>

      {/* Tab 1: On-Chain Transactions */}
      {activeSubTab === 'transactions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Hyperledger Fabric Transaction Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Synchronized record of endorsed and committed transactions anchored to the distributed orderer.
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No confirmed transactions yet. Create or issue a purchase order to submit events.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Fabric Tx ID</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Target Entity</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Submitted At</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <span className="text-indigo-300 font-semibold break-all text-[11px] block">
                          {tx.transaction_id}
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans block">
                          MSP: ProcurementMSP
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                          {tx.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <div className="text-slate-200 text-xs font-medium">{tx.entity_type}</div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">
                          {tx.entity_id}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold flex items-center gap-1 w-fit ${
                            tx.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {tx.status === 'CONFIRMED' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          )}
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400 font-sans">
                        {new Date(tx.submitted_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <button
                          onClick={() => {
                            setQueryEntityId(tx.entity_id);
                            setActiveSubTab('history');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] font-medium transition flex items-center gap-1"
                        >
                          Query History <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Transactional Outbox Stream */}
      {activeSubTab === 'outbox' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                Transactional Outbox Ingestion Buffer
              </h2>
              <p className="text-xs text-slate-400">
                Guarantees at-least-once delivery from relational state to the blockchain ledger without two-phase commit locks.
              </p>
            </div>
            <button
              onClick={handleFlushOutbox}
              disabled={flushingOutbox}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${flushingOutbox ? 'animate-spin' : ''}`} />
              Process Pending Events
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Event ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Outbox Status</th>
                  <th className="py-2.5 px-3">Retries</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 text-[11px] text-slate-400 truncate max-w-[120px]">
                      {ev.id}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="font-semibold text-slate-200">{ev.event_type}</span>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <div className="text-slate-300">{ev.entity_type}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                        {ev.entity_id}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          ev.status === 'CONFIRMED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ev.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300'
                            : ev.status === 'PROCESSING'
                            ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-sans">{ev.attempt_count}</td>
                    <td className="py-3 px-3 text-[11px] text-slate-400 font-sans">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3 text-[10px] text-slate-400 max-w-[200px] truncate">
                      {JSON.stringify(ev.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Document Hash Verifier */}
      {activeSubTab === 'verify' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              Zero-Trust Document Hash Verification
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Inspect any Purchase Order or legal contract digest against the on-chain SHA-256 fingerprint registered in Hyperledger Fabric. Detects any unauthorized modification or database tampering.
            </p>
          </div>

          <form onSubmit={handleVerifyHash} className="space-y-4 max-w-2xl bg-slate-950/60 p-5 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Entity ID (Purchase Order ID)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. po-001-default-uuid"
                value={verifyEntityId}
                onChange={(e) => setVerifyEntityId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Document SHA-256 Hash Digest
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setVerifyDocHash('9f833a6a9b40f3b432a6136d8fe8871b69f6e65ad5ad155a019e07507fc36d93')
                  }
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline font-mono"
                >
                  Use Seed PO-2026-001 Genuine Hash
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. 9f833a6a9b40f3b432a6136d8fe8871b69f6e65ad5ad155a019e07507fc36d93"
                value={verifyDocHash}
                onChange={(e) => setVerifyDocHash(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={verifying}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {verifying ? 'Verifying with Fabric Node...' : 'Verify on Ledger'}
              </button>

              <button
                type="button"
                onClick={() => setVerifyDocHash('tampered_checksum_abcdef1234567890')}
                className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 rounded-lg text-xs font-medium transition"
              >
                Simulate Tampered Hash
              </button>
            </div>
          </form>

          {verifyResult && (
            <div
              className={`p-5 rounded-xl border space-y-3 ${
                verifyResult.match
                  ? 'bg-emerald-950/40 border-emerald-500/50'
                  : 'bg-rose-950/40 border-rose-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {verifyResult.match ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                )}
                <div>
                  <h3
                    className={`text-sm font-bold ${
                      verifyResult.match ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {verifyResult.match
                      ? 'INTEGRITY VERIFIED: Ledger Match Confirmed'
                      : 'TAMPER DETECTED / HASH MISMATCH'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {verifyResult.match
                      ? 'The submitted document hash exactly matches the immutable state verified on Hyperledger Fabric.'
                      : 'The document digest does not match the on-chain committed record, indicating possible tampering or unauthorized amendment.'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 font-mono text-xs space-y-2">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Submitted Hash:</span>
                  <span className="text-slate-200 break-all">{verifyDocHash}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Ledger Stored Hash:</span>
                  <span className="text-indigo-300 break-all">{verifyResult.storedHash || '(None found on ledger)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Verified Provider:</span>
                  <span className="text-emerald-400">{verifyResult.source || 'HYPERLEDGER_FABRIC'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Ledger History Explorer */}
      {activeSubTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-400" />
              Direct Entity Audit History Query
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Directly evaluates the chaincode function <code className="text-indigo-300">getEntityHistory(entityId)</code> to retrieve the complete chronological sequence of states.
            </p>
          </div>

          <form onSubmit={handleQueryHistory} className="flex gap-2 max-w-xl">
            <input
              type="text"
              required
              placeholder="Enter Entity ID (e.g. po-001-default-uuid)"
              value={queryEntityId}
              onChange={(e) => setQueryEntityId(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={queryingHistory}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Search className="w-3.5 h-3.5" />
              {queryingHistory ? 'Querying...' : 'Query Ledger'}
            </button>
          </form>

          {historyResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  Entity: <span className="font-mono text-slate-200">{historyResult.entityId}</span> ({historyResult.entityType})
                </div>
                <div>
                  Source: <span className="text-emerald-400 font-semibold">{historyResult.source}</span> &bull; Total Events: <span className="text-white font-bold">{historyResult.events.length}</span>
                </div>
              </div>

              {historyResult.events.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No chronological events recorded on the ledger for this entity ID yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                  {historyResult.events.map((ev, index) => (
                    <div key={ev.event_id || index} className="relative bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2">
                      <span className="absolute -left-6 top-4 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-900"></span>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{ev.event_type}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          Seq #{index + 1}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-300 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Actor Role</span>
                          <span>{ev.actor_role} ({ev.actor_id})</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Amount Minor</span>
                          <span>{ev.currency} {ev.amount_minor}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Recorded Timestamp</span>
                          <span>{new Date(ev.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      {ev.blockchain_transaction_id && (
                        <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-indigo-300">
                          <span className="text-slate-500">Fabric Transaction: </span>
                          {ev.blockchain_transaction_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
