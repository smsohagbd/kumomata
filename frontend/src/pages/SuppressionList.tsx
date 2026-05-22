import { useEffect, useState } from "react";
import { Trash2, Plus, ShieldOff, RefreshCw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { getSuppressions, addSuppression, deleteSuppression } from "../api/client";

interface Suppression {
  id: number;
  email: string;
  reason: string | null;
  bounce_code: number | null;
  source: string;
  created_at: string;
}

export default function SuppressionList() {
  const [list, setList] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { setList(await getSuppressions()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setSaving(true);
    setError("");
    try {
      await addSuppression(form.email, form.reason || "Manually added");
      setShowAdd(false);
      setForm({ email: "", reason: "" });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteSuppression(id);
    setDeleteId(null);
    await load();
  };

  const codeColor = (code: number | null) => {
    if (!code) return "text-gray-500";
    if (code >= 500) return "text-red-400";
    if (code >= 400) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div>
      <PageHeader
        title="Suppression List"
        subtitle="Blocked email addresses — KumoMTA rejects delivery to these immediately"
        action={
          <button onClick={() => { setShowAdd(true); setError(""); }} className="btn-primary">
            <Plus size={15} /> Add Address
          </button>
        }
      />

      <div className="px-8 py-6 space-y-4">
        <div className="card bg-blue-900/10 border-blue-800">
          <div className="flex gap-3">
            <ShieldOff size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium">Addresses are automatically added when a permanent bounce (5xx) occurs.</p>
              <p className="text-blue-400/70 mt-0.5">
                KumoMTA checks this list before accepting each message — if the recipient is suppressed, 
                it rejects with <code className="text-blue-300">550 5.1.1</code> immediately (no delivery attempt).
                Deploy config after adding/removing addresses.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={load} disabled={loading} className="btn-secondary text-xs py-1.5">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="card text-center py-12">
            <ShieldOff size={32} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium">No suppressed addresses</p>
            <p className="text-sm text-gray-600 mt-1">Addresses with permanent bounces (550) appear here automatically</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Email Address</th>
                  <th>Code</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm text-red-300">{s.email}</td>
                    <td>
                      <span className={`font-mono text-sm font-bold ${codeColor(s.bounce_code)}`}>
                        {s.bounce_code || "—"}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400 max-w-[280px] truncate" title={s.reason || ""}>
                      {s.reason || "—"}
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.source === "bounce" ? "bg-red-900/30 text-red-400" : "bg-gray-800 text-gray-400"}`}>
                        {s.source}
                      </span>
                    </td>
                    <td className="text-gray-500 text-xs whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <button
                        onClick={() => setDeleteId(s.id)}
                        className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                        title="Remove from suppression list"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add to Suppression List" size="sm">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="label">Email Address</label>
            <input
              className="input"
              placeholder="e.g. invalid@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <input
              className="input"
              placeholder="e.g. Unsubscribed"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.email} className="btn-primary">
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Remove from Suppression List" size="sm">
        <p className="text-gray-400 text-sm mb-6">Remove this address? KumoMTA will attempt delivery to it again after next config deploy.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteId && handleDelete(deleteId)} className="btn-primary">Remove</button>
        </div>
      </Modal>
    </div>
  );
}
