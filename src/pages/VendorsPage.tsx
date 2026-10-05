import React, { useEffect, useState } from 'react';
import { Vendor, User } from '../types.ts';
import { ApiClient } from '../api.ts';
import { Users, Plus, Search, Building2, Mail, MapPin, FileCheck, AlertCircle, X } from 'lucide-react';

interface VendorsPageProps {
  currentUser: User;
}

export const VendorsPage: React.FC<VendorsPageProps> = ({ currentUser }) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [vendorCode, setVendorCode] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.getVendors({ search });
      setVendors(res.items || []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, [search]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await ApiClient.createVendor({
        vendor_code: vendorCode,
        legal_name: legalName,
        tax_id: taxId,
        address,
        contact_email: contactEmail,
      });
      setShowModal(false);
      setVendorCode('');
      setLegalName('');
      setTaxId('');
      setAddress('');
      setContactEmail('');
      await loadVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to create vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = currentUser.role === 'ADMIN' || currentUser.role === 'PROCUREMENT_OFFICER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            Vendor Directory & Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compliant suppliers registered under organization <span className="font-semibold text-slate-300">{currentUser.organization.code}</span>
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-teal-600/20 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Register Vendor
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by vendor code, legal name, tax ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading verified vendors...</div>
        ) : vendors.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No vendors found matching your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Vendor Code</th>
                  <th className="py-3 px-4 font-semibold">Legal Name</th>
                  <th className="py-3 px-4 font-semibold">Tax ID (NPWP)</th>
                  <th className="py-3 px-4 font-semibold">Contact Email</th>
                  <th className="py-3 px-4 font-semibold">Address</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-teal-400">{v.vendor_code}</td>
                    <td className="py-3.5 px-4 font-medium text-white">{v.legal_name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{v.tax_id}</td>
                    <td className="py-3.5 px-4 text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {v.contact_email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">{v.address}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          v.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-400" />
                Register New Vendor
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateVendor} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Vendor Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VEND-002"
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Legal Entity Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PT Mandiri Solusi Pratama"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tax Identification Number (NPWP)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 01.234.567.8-012.000"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="billing@mandirisolusi.co.id"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Registered Address
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Office address, city, province"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-teal-600/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
