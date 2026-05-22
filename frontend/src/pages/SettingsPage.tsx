import { useEffect, useState } from "react";
import { Save, Settings, Database } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getSettings, updateSettings, getDatabaseInfo } from "../api/client";

interface SettingsData {
  kumomta_host: string;
  kumomta_port: number;
  kumomta_api_port: number;
  config_dir: string;
  relay_hosts: string;
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsData>({
    kumomta_host: "127.0.0.1",
    kumomta_port: 25,
    kumomta_api_port: 8001,
    config_dir: "/opt/kumomta/etc/policy",
    relay_hosts: "127.0.0.1,::1",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dbInfo, setDbInfo] = useState<any>(null);

  useEffect(() => {
    getSettings()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => setForm(data))
      .finally(() => setLoading(false));
    getDatabaseInfo().then(setDbInfo).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof SettingsData, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" />
        <div className="px-8 py-6">
          <div className="card animate-pulse h-40" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure connection to your KumoMTA instance"
        action={
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={15} />
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        }
      />

      <div className="px-8 py-6 max-w-2xl space-y-6">
        <div className="card space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Settings size={16} className="text-blue-400" />
            <h2 className="font-semibold text-white">KumoMTA Connection</h2>
          </div>

          <div>
            <label className="label">KumoMTA Host / IP</label>
            <input
              className="input"
              value={form.kumomta_host}
              onChange={(e) => set("kumomta_host", e.target.value)}
              placeholder="127.0.0.1"
            />
            <p className="text-xs text-gray-600 mt-1">
              IP or hostname where KumoMTA is running (usually 127.0.0.1 if on the same server)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP Port</label>
              <input
                type="number"
                className="input"
                value={form.kumomta_port}
                onChange={(e) => set("kumomta_port", parseInt(e.target.value))}
                placeholder="25"
              />
            </div>
            <div>
              <label className="label">HTTP API Port</label>
              <input
                type="number"
                className="input"
                value={form.kumomta_api_port}
                onChange={(e) => set("kumomta_api_port", parseInt(e.target.value))}
                placeholder="8001"
              />
            </div>
          </div>

          <div>
            <label className="label">Config Directory</label>
            <input
              className="input font-mono text-sm"
              value={form.config_dir}
              onChange={(e) => set("config_dir", e.target.value)}
              placeholder="/opt/kumomta/etc/policy"
            />
            <p className="text-xs text-gray-600 mt-1">
              Path on the server where KumoMTA policy Lua files are stored
            </p>
          </div>

          <div>
            <label className="label">SMTP Relay Hosts</label>
            <input
              className="input font-mono text-sm"
              value={form.relay_hosts}
              onChange={(e) => set("relay_hosts", e.target.value)}
              placeholder="127.0.0.1,::1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated IPs allowed to relay through KumoMTA.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => set("relay_hosts", "127.0.0.1,::1")}
                className="btn-secondary text-xs py-1"
              >
                Localhost only
              </button>
              <button
                type="button"
                onClick={() => set("relay_hosts", "0.0.0.0/0")}
                className="btn-secondary text-xs py-1 border border-yellow-700 text-yellow-400"
              >
                ⚠ Allow from anywhere
              </button>
            </div>
            {form.relay_hosts === "0.0.0.0/0" && (
              <p className="text-xs text-yellow-400 mt-2 bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2">
                Warning: This makes KumoMTA an open relay. Only use this if you have firewall rules blocking port 25 from the internet, or if your app is on a different server.
              </p>
            )}
          </div>
        </div>

        {/* Database Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-purple-400" />
            <h2 className="font-semibold text-white">Database</h2>
            {dbInfo && (
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                dbInfo.db_type === "sqlite" ? "bg-gray-700 text-gray-300" :
                dbInfo.db_type === "mysql" ? "bg-orange-900/30 text-orange-400" :
                "bg-blue-900/30 text-blue-400"
              }`}>
                {dbInfo.db_type?.toUpperCase()}
              </span>
            )}
          </div>
          {dbInfo ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="label">Current Connection</p>
                <code className="block font-mono text-xs text-green-400 bg-gray-800 rounded-lg px-3 py-2 mt-1 break-all">
                  {dbInfo.url_display}
                </code>
              </div>
              <p className="text-gray-500 text-xs">
                To switch databases, set the <code className="text-gray-300">DATABASE_URL</code> environment
                variable in the systemd service and restart the backend.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">Switch to another database:</p>
                <div className="space-y-1.5 font-mono text-xs bg-gray-900 rounded-lg p-3">
                  <p className="text-gray-500"># MySQL / MariaDB</p>
                  <p className="text-green-400">DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/kumomta</p>
                  <p className="text-gray-600">pip install pymysql</p>
                  <p className="text-gray-500 mt-2"># PostgreSQL</p>
                  <p className="text-green-400">DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/kumomta</p>
                  <p className="text-gray-600">pip install psycopg2-binary</p>
                  <p className="text-gray-500 mt-2"># Edit service and restart</p>
                  <p className="text-blue-400">systemctl edit kumomta-panel-backend</p>
                  <p className="text-blue-400">systemctl restart kumomta-panel-backend</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Could not load database info.</p>
          )}
        </div>

        {/* Install guide */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">One-Command Install (Ubuntu/Debian VPS)</h2>
          <div className="space-y-3 text-sm text-gray-400">
            <Step n={1} title="Upload project to your server">
              <code className="block font-mono text-xs text-green-400 bg-gray-800 rounded-lg p-3 mt-2 whitespace-pre">
                {`git clone https://github.com/smsohagbd/kumomata.git /tmp/kumomata`}
              </code>
            </Step>
            <Step n={2} title="Run the install script as root">
              <code className="block font-mono text-xs text-green-400 bg-gray-800 rounded-lg p-3 mt-2 whitespace-pre">
                {`cd /tmp/kumomata\nsudo bash scripts/install.sh`}
              </code>
              <p className="mt-1 text-gray-500">
                This installs KumoMTA, the panel backend (port 8050), and the frontend (port 9000).
              </p>
            </Step>
            <Step n={3} title="Open the dashboard">
              <code className="block font-mono text-xs text-blue-400 bg-gray-800 rounded-lg p-3 mt-2">
                http://YOUR_SERVER_IP:9000
              </code>
            </Step>
            <Step n={4} title="Deploy config from the dashboard">
              Add IPs → set domain rules → generate DKIM → click <strong>Deploy Config</strong>.
              The panel writes the config files and reloads KumoMTA automatically.
            </Step>
            <Step n={5} title="Useful commands">
              <code className="block font-mono text-xs text-green-400 bg-gray-800 rounded-lg p-3 mt-2 whitespace-pre">
                {`sudo systemctl status kumomta\nsudo journalctl -u kumomta -f\nsudo journalctl -u kumomta-panel-backend -f`}
              </code>
            </Step>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="font-medium text-gray-200">{title}</p>
        {children}
      </div>
    </div>
  );
}
