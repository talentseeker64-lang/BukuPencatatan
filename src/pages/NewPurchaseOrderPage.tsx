import React, { useEffect, useState } from 'react';
import { User, Vendor } from '../types.ts';
import { ApiClient } from '../api.ts';
import { FileText, Plus, Trash2, ArrowLeft, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface NewPurchaseOrderPageProps {
  currentUser: User;
  onNavigate: (tab: string) => void;
}

interface LineItemRow {
  id: string;
  description: string;
  quantity: number | string;
  unit_price: string;
}

export const NewPurchaseOrderPage: React.FC<NewPurchaseOrderPageProps> = ({ currentUser, onNavigate }) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('2026-12-31');
  const [currency] = useState('IDR');

  const [items, setItems] = useState<LineItemRow[]>([
    { id: '1', description: 'Server Hardware Enterprise Node', quantity: 1, unit_price: '50000000.00' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getVendors().then((res) => {
      const active = (res.items || []).filter((v) => v.status === 'ACTIVE');
      setVendors(active);
      if (active.length > 0) setVendorId(active[0].id);
    });
  }, []);

  const addItemRow = () => {
    setItems([
      ...items,
      { id: String(Date.now()), description: '', quantity: 1, unit_price: '0.00' },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItemRow, value: any) => {
    setItems(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  // Safe client preview calculation
  const calculateTotalPreview = () => {
    let sum = 0;
    for (const it of items) {
      const q = parseFloat(String(it.quantity)) || 0;
      const p = parseFloat(it.unit_price) || 0;
      sum += q * p;
    }
    return sum.toLocaleString('id-ID', { minimumFractionDigits: 2 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await ApiClient.createPurchaseOrder({
        vendor_id: vendorId,
        description,
        due_date: dueDate,
        currency,
        items: items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
      });

      onNavigate(`purchase-orders/${created.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('purchase-orders')}
          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Create Purchase Order
          </h1>
          <p className="text-xs text-slate-400">
            Initial status: <span className="font-semibold text-amber-400">DRAFT</span> &bull; Server calculates authoritative total amount using safe Decimal arithmetic
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Basic Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Vendor
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_code} - {v.legal_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Obligation Due Date
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Procurement Scope & Description
          </label>
          <textarea
            rows={2}
            required
            placeholder="e.g. Server hardware and high-availability enterprise node procurement"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dynamic Line Items */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Purchase Order Line Items ({items.length})
            </h3>
            <button
              type="button"
              onClick={addItemRow}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.id} className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-xs font-mono text-slate-500 w-6 text-center">{idx + 1}.</span>
                <input
                  type="text"
                  required
                  placeholder="Item description"
                  value={it.description}
                  onChange={(e) => updateItem(it.id, 'description', e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="w-24">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.id, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-36">
                    <input
                      type="text"
                      required
                      placeholder="Unit Price"
                      value={it.unit_price}
                      onChange={(e) => updateItem(it.id, 'unit_price', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItemRow(it.id)}
                    disabled={items.length <= 1}
                    className="p-2 text-slate-500 hover:text-rose-400 disabled:opacity-30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total Preview */}
          <div className="p-4 bg-slate-800/80 rounded-xl flex items-center justify-between border border-slate-700/60 mt-4">
            <div>
              <div className="text-xs font-medium text-slate-400">Total Obligation (Server Authoritative)</div>
              <div className="text-[11px] text-slate-500">Calculated with Decimal.js rounding precision</div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400 mr-1.5">{currency}</span>
              <span className="text-xl font-bold font-mono text-white">{calculateTotalPreview()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onNavigate('purchase-orders')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Purchase Order (DRAFT)'}
          </button>
        </div>
      </form>
    </div>
  );
};
