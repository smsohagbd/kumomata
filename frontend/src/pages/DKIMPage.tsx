import { useEffect, useState } from "react";
import { Plus, Trash2, ShieldCheck, Copy, Check, RefreshCw, CheckCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { getDKIMKeys, generateDKIM, deleteDKIM, autoDeploy } from "../api/client";

interface DKIMKey {
  id: number;
  domain: string;
  selector: string;
  public_key: string;
  dns_record: string | null;
  is_active: boolean;
  created_at: string;
}

export default function DKIMPage() {
  const [keys, setKeys] = useState<DKIMKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ domain: "", selector: "kumomta" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewKey, setViewKey] = useState<DKIMKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState("");

  const triggerDeploy = async () => {
    setDeploying(true);
    setDeployMsg("Applying to KumoMTA...");
    await autoDeploy();
    setDeployMsg("KumoMTA updated");
    setDeploying(false);
    setTimeout(() => setDeployMsg(""), 3000);
  };

  const load = async () => {
    setLoading(true);
    try { setKeys(await getDKIMKeys()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setSaving(true);
    setError("");
    try {
      await generateDKIM(form);
      setShowAdd(false);
      setForm({ domain: "", selector: "kumomta" });
      await load();
      triggerDeploy();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Failed to generate key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDKIM(id);
    setDeleteId(null);
    await load();
    triggerDeploy();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="DKIM Keys"
        subtitle="Generate and manage DKIM signing keys for your domains"
        action={
          <div className="flex items-center gap-2">
            {deployMsg && (
              <span className={`flex items-center gap-1.5 text-xs ${deploying ? "text-yellow-400" : "text-green-400"}`}>
                {deploying ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {deployMsg}
              </span>
            )}
            <button onClick={() => { setShowAdd(true); setError(""); }} className="btn-primary">
              <Plus size={15} /> Generate Key
            </button>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-4">
        <div className="card bg-blue-900/10 border-blue-800">
          <div className="flex gap-3">
            <ShieldCheck size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium">After generating a key, add the DNS TXT record to your domain registrar.</p>
              <p className="text-blue-400/70 mt-0.5">Click on any key to view the full DNS record to copy.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="card text-center py-12">
            <ShieldCheck size={32} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium">No DKIM keys generated yet</p>
            <p className="text-sm text-gray-600 mt-1">Generate a key to enable DKIM signing for a domain</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Selector</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td className="font-medium text-white">{key.domain}</td>
                    <td className="font-mono text-purple-400">{key.selector}</td>
                    <td>
                      {key.is_active ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}
                    </td>
                    <td className="text-gray-500 text-xs">{new Date(key.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewKey(key)}
                          className="btn-ghost p-1.5 text-xs"
                          title="View DNS record"
                        >
                          DNS Record
                        </button>
                        <button
                          onClick={() => setDeleteId(key.id)}
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

      {/* Generate modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Generate DKIM Key" size="sm">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="label">Domain</label>
            <input
              className="input"
              placeholder="e.g. yourdomain.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Selector</label>
            <input
              className="input"
              placeholder="e.g. kumomta"
              value={form.selector}
              onChange={(e) => setForm({ ...form, selector: e.target.value })}
            />
            <p className="text-xs text-gray-600 mt-1">Used in the DNS record name: {form.selector}._domainkey.{form.domain || "yourdomain.com"}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleGenerate} disabled={saving || !form.domain} className="btn-primary">
              {saving ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </Modal>

      {/* View DNS record modal */}
      <Modal open={!!viewKey} onClose={() => setViewKey(null)} title="DNS Record" size="lg">
        {viewKey && (
          <div className="space-y-4">
            <div>
              <p className="label">Record Name</p>
              <p className="font-mono text-sm text-purple-400 bg-gray-800 rounded-lg px-3 py-2">
                {viewKey.selector}._domainkey.{viewKey.domain}
              </p>
            </div>
            <div>
              <p className="label">Record Type</p>
              <p className="font-mono text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2">TXT</p>
            </div>
            <div>
              <p className="label">Record Value</p>
              <p className="font-mono text-xs text-green-400 bg-gray-800 rounded-lg px-3 py-2 break-all">
                v=DKIM1; k=rsa; p={viewKey.public_key}
              </p>
            </div>
            {viewKey.dns_record && (
              <div>
                <p className="label">Full DNS Entry</p>
                <p className="font-mono text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-2 break-all">
                  {viewKey.dns_record}
                </p>
              </div>
            )}
            <button
              onClick={() => copy(`v=DKIM1; k=rsa; p=${viewKey.public_key}`)}
              className="btn-primary w-full"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied!" : "Copy DNS Value"}
            </button>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete DKIM Key" size="sm">
        <p className="text-gray-400 text-sm mb-6">Deleting this key will break DKIM signing for this domain. Make sure to remove the DNS record too.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteId && handleDelete(deleteId)} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
