import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Copy, Check, Wifi } from "lucide-react";
import { getSmtpUsers, createSmtpUser, deleteSmtpUser } from "../api/client";

interface SmtpUser {
  id: number;
  username: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface NewUserForm {
  username: string;
  password: string;
  description: string;
}

const emptyForm: NewUserForm = { username: "", password: "", description: "" };

export default function SmtpUsers() {
  const [users, setUsers] = useState<SmtpUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewUserForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState("");

  const serverHost = window.location.hostname;

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await getSmtpUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      setError("Username and password are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createSmtpUser(form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Delete SMTP user "${username}"?`)) return;
    await deleteSmtpUser(id);
    load();
  };

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copy(text, field)}
      className="ml-2 p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
      title="Copy"
    >
      {copiedField === field ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SMTP Users</h1>
          <p className="text-gray-400 text-sm mt-1">
            Create credentials to send email from external applications (PHPMailer, Nodemailer, etc.)
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Connection Info Card */}
      <div className="card bg-gradient-to-br from-blue-900/30 to-blue-800/10 border border-blue-700/40">
        <div className="flex items-center gap-2 mb-4">
          <Wifi size={18} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">SMTP Connection Settings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-center">
              <span className="text-gray-400 w-28">Server / Host</span>
              <code className="text-green-300 font-mono">{serverHost}</code>
              <CopyBtn text={serverHost} field="host" />
            </div>
            <div className="flex items-center">
              <span className="text-gray-400 w-28">Port</span>
              <code className="text-green-300 font-mono">587</code>
              <CopyBtn text="587" field="port" />
            </div>
            <div className="flex items-center">
              <span className="text-gray-400 w-28">Encryption</span>
              <code className="text-green-300 font-mono">STARTTLS</code>
            </div>
            <div className="flex items-center">
              <span className="text-gray-400 w-28">Auth</span>
              <code className="text-green-300 font-mono">PLAIN / LOGIN</code>
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <p className="text-gray-400 text-xs font-semibold uppercase mb-2">Example (PHP)</p>
            <pre className="text-xs text-gray-300 overflow-x-auto">{`$mail->Host     = '${serverHost}';
$mail->SMTPAuth = true;
$mail->Username = 'your-username';
$mail->Password = 'your-password';
$mail->Port     = 587;`}</pre>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30 text-xs text-yellow-300">
          <strong>Note:</strong> After adding a user, go to{" "}
          <strong>Config &amp; Deploy → Deploy Config</strong> to activate the SMTP AUTH handler in KumoMTA.
          Port 587 will then accept authenticated connections from anywhere.
        </div>
      </div>

      {/* Add User Form */}
      {showForm && (
        <div className="card border border-blue-700/40">
          <h3 className="text-lg font-semibold text-white mb-4">New SMTP User</h3>
          {error && <div className="alert-error mb-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="e.g. myapp"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? "text" : "password"}
                  placeholder="Strong password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Description (optional)</label>
              <input
                className="input"
                placeholder="e.g. PHP app on web server"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setError(""); setForm(emptyForm); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">
          Active Users
          <span className="ml-2 text-sm text-gray-400 font-normal">({users.length})</span>
        </h2>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>No SMTP users yet.</p>
            <p className="text-xs mt-1">Create a user to enable sending from external software.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <code className="text-green-300 text-sm font-mono">{u.username}</code>
                      <CopyBtn text={u.username} field={`user-${u.id}`} />
                    </div>
                  </td>
                  <td className="text-gray-400 text-sm">{u.description || "—"}</td>
                  <td>
                    <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="text-gray-400 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      className="btn-icon-danger"
                      title="Delete user"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
