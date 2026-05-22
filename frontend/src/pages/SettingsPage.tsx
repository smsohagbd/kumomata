import { useEffect, useState } from "react";
import { Save, Settings } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getSettings, updateSettings } from "../api/client";

interface SettingsData {
  kumomta_host: string;
  kumomta_port: number;
  kumomta_api_port: number;
  config_dir: string;
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsData>({
    kumomta_host: "127.0.0.1",
    kumomta_port: 25,
    kumomta_api_port: 8001,
    config_dir: "/opt/kumomta/etc/policy",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => setForm(data))
      .finally(() => setLoading(false));
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
