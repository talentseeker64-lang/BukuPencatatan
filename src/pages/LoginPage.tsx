import React, { useState } from 'react';
import { ApiClient } from '../api.ts';
import { User } from '../types.ts';
import { ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('procurement@example.local');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await ApiClient.login(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Blockchain Procurement & AP Ledger
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Core Phase 2 &bull; Tamper-Evident Outbox Architecture
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-6 shadow-xl border border-slate-800 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Corporate Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="name@example.local"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Ledger Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Development Quick Role Credentials */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Development Test Accounts
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('procurement@example.local')}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-left transition"
              >
                <div className="font-semibold text-blue-400">Procurement</div>
                <div className="text-[11px] text-slate-400 truncate">procurement@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@example.local')}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-left transition"
              >
                <div className="font-semibold text-purple-400">Admin</div>
                <div className="text-[11px] text-slate-400 truncate">admin@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('auditor@example.local')}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-left transition"
              >
                <div className="font-semibold text-rose-400">Auditor</div>
                <div className="text-[11px] text-slate-400 truncate">auditor@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('finance@example.local')}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-left transition"
              >
                <div className="font-semibold text-amber-400">Finance</div>
                <div className="text-[11px] text-slate-400 truncate">finance@...</div>
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 text-center">
              All test accounts use password: <code className="text-slate-400">Password123!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
