import { useEffect, useState } from "react";
import { FileCode, Download, RefreshCw, Copy, Check, Rocket, ServerCrash, Server } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { exportConfig, deployConfig, getDeployStatus } from "../api/client";

interface DeployStatus {
  policy_dir: string;
  policy_dir_exists: boolean;
  policy_dir_writable: boolean;
  kumomta_running: boolean;
  dkim_dir: string;
}

interface DeployResult {
  ok: boolean;
  files_written: {
    init_lua: string;
    shaping_toml: string;
    dkim_keys: string[];
  };
  kumomta_reloaded: boolean;
  reload_error?: string;
}

export default function ConfigPreview() {
  const [config, setConfig] = useState<{ init_lua: string; shaping_toml: string } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState("");
  const [tab, setTab] = useState<"init_lua" | "shaping_toml">("init_lua");
  const [copied, setCopied] = useState(false);

  const [deployStatus, setDeployStatus] = useState<DeployStatus | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [deployError, setDeployError] = useState("");

  useEffect(() => {
    getDeployStatus()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((s: any) => setDeployStatus(s))
      .catch(() => setDeployStatus(null));
  }, []);

  const loadConfig = async () => {
    setLoadingConfig(true);
    setConfigError("");
    try {
      const data = await exportConfig();
      setConfig(data);
    } catch {
      setConfigError("Failed to generate config. Make sure the backend is running.");
    } finally {
      setLoadingConfig(false);
    }
  };

  const copy = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    if (!config) return;
    const filename = tab === "init_lua" ? "init.lua" : "shaping.toml";
    const blob = new Blob([config[tab]], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError("");
    setDeployResult(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await deployConfig();
      setDeployResult(result);
      // Refresh deploy status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = await getDeployStatus();
      setDeployStatus(s);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: { errors?: string[] } | string } } };
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.errors) {
        setDeployError(detail.errors.join("\n"));
      } else {
        setDeployError(String(detail || "Deploy failed"));
      }
    } finally {
      setDeploying(false);
    }
  };

  const canDeploy = deployStatus?.policy_dir_writable && deployStatus?.policy_dir_exists;

  return (
    <div>
      <PageHeader
        title="Config & Deploy"
        subtitle="Preview generated KumoMTA config and deploy it to your server"
        action={
          <button onClick={loadConfig} disabled={loadingConfig} className="btn-secondary">
            <RefreshCw size={15} className={loadingConfig ? "animate-spin" : ""} />
            Generate Preview
          </button>
        }
      />

      <div className="px-8 py-6 space-y-5">
        {/* Deploy status card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-blue-400" />
              <h2 className="font-semibold text-white">Deploy to KumoMTA</h2>
            </div>
            <button
              onClick={handleDeploy}
              disabled={deploying || !canDeploy}
              className="btn-primary"
              title={!canDeploy ? "Policy directory not writable. Panel must run on the same server as KumoMTA." : ""}
            >
              <Rocket size={15} className={deploying ? "animate-bounce" : ""} />
              {deploying ? "Deploying..." : "Deploy Config"}
            </button>
          </div>

          {/* Status indicators */}
          {deployStatus ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatusRow
                label="Policy directory"
                value={deployStatus.policy_dir}
                ok={deployStatus.policy_dir_exists}
                okLabel="exists"
                failLabel="not found"
              />
              <StatusRow
                label="Write access"
                value={deployStatus.policy_dir}
                ok={deployStatus.policy_dir_writable}
                okLabel="writable"
                failLabel="no permission"
              />
              <StatusRow
                label="KumoMTA service"
                value="systemctl"
                ok={deployStatus.kumomta_running}
                okLabel="running"
                failLabel="stopped / not found"
              />
              <StatusRow
                label="DKIM key dir"
                value={deployStatus.dkim_dir}
                ok={true}
                okLabel={deployStatus.dkim_dir}
                failLabel=""
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Could not reach backend to check deploy status.</p>
          )}

          {!canDeploy && deployStatus && (
            <div className="mt-3 bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2 text-xs text-yellow-300">
              The panel must be running <strong>on the same Linux server as KumoMTA</strong> to deploy directly.
              Use "Generate Preview" below to download the files and copy them manually.
            </div>
          )}
        </div>

        {/* Deploy result */}
        {deployResult && (
          <div className="bg-green-900/20 border border-green-800 rounded-xl px-4 py-3 text-sm text-green-300 space-y-1">
            <p className="font-medium">Config deployed successfully!</p>
            <p>init.lua → <code className="text-green-400">{deployResult.files_written.init_lua}</code></p>
            <p>shaping.toml → <code className="text-green-400">{deployResult.files_written.shaping_toml}</code></p>
            {deployResult.files_written.dkim_keys.length > 0 && (
              <p>DKIM keys → {deployResult.files_written.dkim_keys.join(", ")}</p>
            )}
            {deployResult.kumomta_reloaded ? (
              <p className="text-green-400 font-medium">KumoMTA reloaded successfully.</p>
            ) : (
              <p className="text-yellow-400">KumoMTA reload failed: {deployResult.reload_error}</p>
            )}
          </div>
        )}

        {deployError && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-400 whitespace-pre-wrap">
            <div className="flex gap-2 mb-1">
              <ServerCrash size={15} className="flex-shrink-0 mt-0.5" />
              <span className="font-medium">Deploy failed</span>
            </div>
            {deployError}
          </div>
        )}

        {/* Manual copy fallback */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">Manual Config Files</h2>
              <p className="text-xs text-gray-500 mt-0.5">Preview, copy, or download the generated files</p>
            </div>
            {config && (
              <div className="flex gap-2">
                <button onClick={copy} className="btn-ghost text-xs">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={download} className="btn-ghost text-xs">
                  <Download size={13} /> Download
                </button>
              </div>
            )}
          </div>

          {configError && (
            <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
              {configError}
            </div>
          )}

          {!config && !loadingConfig && (
            <div className="text-center py-10">
              <FileCode size={36} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Click "Generate Preview" to see your config files</p>
            </div>
          )}

          {loadingConfig && (
            <div className="text-center py-10">
              <RefreshCw size={28} className="mx-auto text-gray-600 mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Generating...</p>
            </div>
          )}

          {config && (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-0 border-b border-gray-800 mb-0">
                {(["init_lua", "shaping_toml"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      tab === t
                        ? "text-blue-400 border-b-2 border-blue-500"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {t === "init_lua" ? "init.lua" : "shaping.toml"}
                  </button>
                ))}
              </div>
              <pre className="p-4 text-xs font-mono text-green-300 bg-gray-950 rounded-b-xl overflow-auto max-h-[55vh] leading-relaxed">
                {config[tab]}
              </pre>
            </>
          )}
        </div>

        {/* Copy instructions for manual deploy */}
        <div className="card bg-gray-800/40">
          <h3 className="font-medium text-white mb-3 text-sm">Manual Deploy Commands</h3>
          <div className="space-y-2 font-mono text-xs text-gray-300">
            <p className="text-gray-500"># Copy config files to KumoMTA policy directory</p>
            <p>sudo cp init.lua /opt/kumomta/etc/policy/init.lua</p>
            <p>sudo cp shaping.toml /opt/kumomta/etc/policy/shaping.toml</p>
            <p className="text-gray-500 mt-2"># Reload KumoMTA (picks up new config without dropping connections)</p>
            <p>sudo systemctl reload kumomta</p>
            <p className="text-gray-500 mt-2"># Check KumoMTA status</p>
            <p>sudo systemctl status kumomta</p>
            <p className="text-gray-500 mt-2"># View live logs</p>
            <p>sudo journalctl -u kumomta -f</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  okLabel,
  failLabel,
}: {
  label: string;
  value: string;
  ok: boolean;
  okLabel: string;
  failLabel: string;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium text-xs ${ok ? "text-green-400" : "text-red-400"}`}>
        {ok ? okLabel : failLabel}
      </span>
    </div>
  );
}
