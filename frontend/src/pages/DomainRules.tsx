import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Globe, Zap, RefreshCw, CheckCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { getDomains, createDomain, updateDomain, deleteDomain, createFromPreset, getPresets, autoDeploy } from "../api/client";

interface DomainRule {
  id: number;
  domain: string;
  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
  max_connections: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

type Presets = Record<string, { max_per_minute: number; max_per_hour: number; max_per_day: number; max_connections: number }>;

const emptyForm = {
  domain: "",
  max_per_minute: 10,
  max_per_hour: 200,
  max_per_day: 2000,
  max_connections: 10,
  notes: "",
  is_active: true,
};

const DOMAIN_ICONS: Record<string, string> = {
  "gmail.com": "🟥",
  "yahoo.com": "🟪",
  "outlook.com": "🟦",
  "hotmail.com": "🟦",
  "aol.com": "🟨",
};

export default function DomainRules() {
  const [rules, setRules] = useState<DomainRule[]>([]);
  const [presets, setPresets] = useState<Presets>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DomainRule | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([getDomains(), getPresets()]);
      setRules(r);
      setPresets(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ ...emptyForm }); setEditing(null); setError(""); setShowAdd(true); };
  const openEdit = (rule: DomainRule) => {
    setForm({
      domain: rule.domain,
      max_per_minute: rule.max_per_minute,
      max_per_hour: rule.max_per_hour,
      max_per_day: rule.max_per_day,
      max_connections: rule.max_connections,
      notes: rule.notes || "",
      is_active: rule.is_active,
    });
    setEditing(rule);
    setError("");
    setShowAdd(true);
  };

  const triggerDeploy = async () => {
    setDeploying(true);
    setDeployMsg("Applying to KumoMTA...");
    await autoDeploy();
    setDeployMsg("KumoMTA updated");
    setDeploying(false);
    setTimeout(() => setDeployMsg(""), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateDomain(editing.id, form);
      } else {
        await createDomain(form);
      }
      setShowAdd(false);
      await load();
      triggerDeploy();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = async (domain: string) => {
    try {
      await createFromPreset(domain);
      await load();
      triggerDeploy();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err?.response?.data?.detail || "Failed to add preset");
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDomain(id);
    setDeleteId(null);
    await load();
    triggerDeploy();
  };

  const missingPresets = Object.keys(presets).filter(
    (domain) => !rules.some((r) => r.domain === domain)
  );

  return (
    <div>
      <PageHeader
        title="Domain Rules"
        subtitle="Configure sending limits per destination domain"
        action={
          <div className="flex items-center gap-2">
            {deployMsg && (
              <span className={`flex items-center gap-1.5 text-xs ${deploying ? "text-yellow-400" : "text-green-400"}`}>
                {deploying ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {deployMsg}
              </span>
            )}
            <button onClick={openAdd} className="btn-primary">
              <Plus size={15} /> Add Domain Rule
            </button>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {/* Preset quick-add */}
        {missingPresets.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-yellow-400" />
              <h3 className="font-medium text-white text-sm">Quick Add Presets</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">One-click recommended limits for major providers</p>
            <div className="flex flex-wrap gap-2">
              {missingPresets.map((domain) => (
                <button
                  key={domain}
                  onClick={() => handlePreset(domain)}
                  className="btn-secondary text-xs py-1.5"
                >
                  {DOMAIN_ICONS[domain] || "🌐"} {domain}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="card text-center py-12">
            <Globe size={32} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium">No domain rules yet</p>
            <p className="text-sm text-gray-600 mt-1">Add rules to control sending limits per destination</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Per Minute</th>
                  <th>Per Hour</th>
                  <th>Per Day</th>
                  <th>Connections</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span className="font-medium text-white">
                        {DOMAIN_ICONS[rule.domain] || "🌐"} {rule.domain}
                      </span>
                    </td>
                    <td>
                      <RateCell value={rule.max_per_minute} label="msg/min" />
                    </td>
                    <td>
                      <RateCell value={rule.max_per_hour} label="msg/hr" />
                    </td>
                    <td>
                      <RateCell value={rule.max_per_day} label="msg/day" />
                    </td>
                    <td className="text-gray-300">{rule.max_connections}</td>
                    <td>
                      {rule.is_active ? (
                        <span className="badge-green">Active</span>
                      ) : (
                        <span className="badge-red">Disabled</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(rule)} className="btn-ghost p-1.5" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(rule.id)}
                          className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                          title="Delete"
                        >
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
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editing ? "Edit Domain Rule" : "Add Domain Rule"} size="lg">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="label">Domain</label>
            <input
              className="input"
              placeholder="e.g. gmail.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              disabled={!!editing}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <RateField
              label="Max per Minute"
              value={form.max_per_minute}
              onChange={(v) => setForm({ ...form, max_per_minute: v })}
            />
            <RateField
              label="Max per Hour"
              value={form.max_per_hour}
              onChange={(v) => setForm({ ...form, max_per_hour: v })}
            />
            <RateField
              label="Max per Day"
              value={form.max_per_day}
              onChange={(v) => setForm({ ...form, max_per_day: v })}
            />
            <RateField
              label="Max Connections"
              value={form.max_connections}
              onChange={(v) => setForm({ ...form, max_connections: v })}
            />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Internal notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="domain_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <label htmlFor="domain_active" className="text-sm text-gray-300">Active</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : editing ? "Update" : "Add Rule"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Domain Rule" size="sm">
        <p className="text-gray-400 text-sm mb-6">Are you sure? This will remove the sending limits for this domain.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteId && handleDelete(deleteId)} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}

function RateCell({ value, label }: { value: number; label: string }) {
  return (
    <span className="font-mono text-sm text-gray-200">
      {value.toLocaleString()} <span className="text-gray-600 text-xs">{label}</span>
    </span>
  );
}

function RateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      />
    </div>
  );
}
