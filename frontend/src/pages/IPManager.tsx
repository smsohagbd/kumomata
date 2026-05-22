import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Server, ToggleLeft, ToggleRight } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { getIPs, createIP, updateIP, deleteIP } from "../api/client";

interface IP {
  id: number;
  ip: string;
  label: string | null;
  pool_name: string;
  is_active: boolean;
  created_at: string;
}

const empty = { ip: "", label: "", pool_name: "default", is_active: true };

export default function IPManager() {
  const [ips, setIPs] = useState<IP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<IP | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { setIPs(await getIPs()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...empty }); setEditing(null); setError(""); setShowAdd(true); };
  const openEdit = (ip: IP) => {
    setForm({ ip: ip.ip, label: ip.label || "", pool_name: ip.pool_name, is_active: ip.is_active });
    setEditing(ip);
    setError("");
    setShowAdd(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateIP(editing.id, { label: form.label, pool_name: form.pool_name, is_active: form.is_active });
      } else {
        await createIP(form);
      }
      setShowAdd(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Failed to save IP");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteIP(id);
    setDeleteId(null);
    await load();
  };

  const handleToggle = async (ip: IP) => {
    await updateIP(ip.id, { is_active: !ip.is_active });
    await load();
  };

  const pools = [...new Set(ips.map((ip) => ip.pool_name))];

  return (
    <div>
      <PageHeader
        title="IP Addresses"
        subtitle="Manage your sending IPs and egress pools"
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus size={15} /> Add IP
          </button>
        }
      />

      <div className="px-8 py-6 space-y-4">
        {/* Pool summary */}
        {pools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pools.map((pool) => {
              const count = ips.filter((ip) => ip.pool_name === pool).length;
              return (
                <span key={pool} className="badge-blue">
                  <Server size={11} className="mr-1" /> {pool} ({count} IPs)
                </span>
              );
            })}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : ips.length === 0 ? (
          <div className="card text-center py-12">
            <Server size={32} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium">No IP addresses added yet</p>
            <p className="text-sm text-gray-600 mt-1">Click "Add IP" to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Label</th>
                  <th>Pool</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ips.map((ip) => (
                  <tr key={ip.id}>
                    <td className="font-mono text-blue-400">{ip.ip}</td>
                    <td className="text-gray-400">{ip.label || "—"}</td>
                    <td>
                      <span className="badge-blue">{ip.pool_name}</span>
                    </td>
                    <td>
                      {ip.is_active ? (
                        <span className="badge-green">Active</span>
                      ) : (
                        <span className="badge-red">Disabled</span>
                      )}
                    </td>
                    <td className="text-gray-500 text-xs">
                      {new Date(ip.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(ip)}
                          className="btn-ghost p-1.5"
                          title={ip.is_active ? "Disable" : "Enable"}
                        >
                          {ip.is_active ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} className="text-gray-500" />}
                        </button>
                        <button onClick={() => openEdit(ip)} className="btn-ghost p-1.5" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(ip.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editing ? "Edit IP Address" : "Add IP Address"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="label">IP Address</label>
            <input
              className="input"
              placeholder="e.g. 192.168.1.10"
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.target.value })}
              disabled={!!editing}
            />
          </div>
          <div>
            <label className="label">Label (optional)</label>
            <input
              className="input"
              placeholder="e.g. Main sender"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Pool Name</label>
            <input
              className="input"
              placeholder="e.g. default"
              value={form.pool_name}
              onChange={(e) => setForm({ ...form, pool_name: e.target.value })}
            />
            <p className="text-xs text-gray-600 mt-1">IPs in the same pool share load for outbound delivery</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-300">Active (enabled for sending)</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : editing ? "Update" : "Add IP"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete IP Address" size="sm">
        <p className="text-gray-400 text-sm mb-6">Are you sure you want to delete this IP? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteId && handleDelete(deleteId)} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
