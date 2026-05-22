import { useState, useEffect, useRef } from "react";
import { RefreshCw, Terminal, Mail, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getKumoLogs, getBackendLogs, getEmailLogs } from "../api/client";

// ─── Types ────────────────────────────────────────────────
type LogLevel = "info" | "warn" | "error" | "debug";
interface LogEntry { line: string; level: LogLevel; }

interface EmailRecord {
  type: string;
  timestamp: string;
  sender: string;
  recipient: string;
  queue: string;
  response: string;
  size: number;
  num_attempts: number;
  disposition: string;
}

type MainTab = "email" | "system";
type SystemTab = "kumomta" | "backend";

// ─── Helpers ──────────────────────────────────────────────
const levelColor: Record<LogLevel, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-green-300",
  debug: "text-gray-400",
};

const typeIcon: Record<string, { icon: typeof CheckCircle; color: string }> = {
  Delivery:  { icon: CheckCircle,   color: "text-green-400" },
  Reception: { icon: Mail,          color: "text-blue-400"  },
  Bounce:    { icon: XCircle,       color: "text-red-400"   },
  Deferred:  { icon: Clock,         color: "text-yellow-400"},
  Expiry:    { icon: AlertTriangle, color: "text-orange-400"},
};

function TypeBadge({ type }: { type: string }) {
  const t = typeIcon[type] || { icon: Mail, color: "text-gray-400" };
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.color}`}>
      <Icon size={12} /> {type}
    </span>
  );
}

// ─── Email Logs Tab ───────────────────────────────────────
function EmailLogs() {
  const [records, setRecords] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await getEmailLogs(lines);
      setRecords(data.records || []);
      setError(data.error || "");
    } catch {
      setError("Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [lines]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(load, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, lines]);

  const counts = records.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(counts).map(([type, count]) => (
            <span key={type} className="badge-blue text-xs">
              {type}: {count}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input py-1.5 text-xs w-28"
            value={lines}
            onChange={(e) => setLines(parseInt(e.target.value))}
          >
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
            <option value={500}>500 rows</option>
            <option value={1000}>1000 rows</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "btn-primary text-xs py-1.5" : "btn-secondary text-xs py-1.5"}
          >
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary text-xs py-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-900/20 border border-yellow-800 text-yellow-300 rounded-xl px-4 py-3 text-sm">
          {error}
          {error.includes("Deploy config") && (
            <a href="/config" className="ml-2 underline text-blue-400">Go to Config & Deploy →</a>
          )}
        </div>
      )}

      {records.length === 0 && !error && !loading && (
        <div className="card text-center py-12">
          <Mail size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 font-medium">No email logs yet</p>
          <p className="text-sm text-gray-600 mt-1">Logs appear here after emails are sent through KumoMTA</p>
        </div>
      )}

      {records.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Response</th>
                <th>Attempts</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td className="text-gray-500 text-xs whitespace-nowrap">
                    {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "—"}
                  </td>
                  <td><TypeBadge type={r.type} /></td>
                  <td className="font-mono text-xs text-gray-300 max-w-[160px] truncate">{r.sender || "—"}</td>
                  <td className="font-mono text-xs text-gray-300 max-w-[160px] truncate">{r.recipient || "—"}</td>
                  <td className="text-xs text-gray-400 max-w-[200px] truncate" title={r.response}>{r.response || "—"}</td>
                  <td className="text-center text-gray-400">{r.num_attempts}</td>
                  <td className="text-gray-500 text-xs">{r.size > 0 ? `${(r.size / 1024).toFixed(1)}k` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── System Logs Tab ──────────────────────────────────────
const systemFetchers: Record<SystemTab, (n: number) => Promise<{ logs: LogEntry[] }>> = {
  kumomta: getKumoLogs,
  backend: getBackendLogs,
};

function SystemLogs() {
  const [tab, setTab] = useState<SystemTab>("kumomta");
  const [logs, setLogs] = useState<Record<SystemTab, LogEntry[]>>({ kumomta: [], backend: [] });
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async (t: SystemTab = tab) => {
    setLoading(true);
    try {
      const data = await systemFetchers[t](lines);
      setLogs((prev) => ({ ...prev, [t]: data.logs || [] }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab, lines]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(() => load(tab), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, tab]);

  const current = logs[tab];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg w-fit">
          {(["kumomta", "backend"] as SystemTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                tab === t ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "kumomta" ? "KumoMTA" : "Panel Backend"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input py-1.5 text-xs w-28"
            value={lines}
            onChange={(e) => setLines(parseInt(e.target.value))}
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "btn-primary text-xs py-1.5" : "btn-secondary text-xs py-1.5"}
          >
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </button>
          <button onClick={() => load()} disabled={loading} className="btn-secondary text-xs py-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-800/40">
          <Terminal size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500 font-mono">{current.length} lines</span>
        </div>
        <div className="bg-gray-950 h-[60vh] overflow-auto font-mono text-xs leading-relaxed p-4">
          {current.length === 0 ? (
            <p className="text-gray-600">No logs — click Refresh</p>
          ) : (
            current.map((entry, i) => (
              <div key={i} className={`py-0.5 ${levelColor[entry.level]}`}>
                {entry.line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function LogsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("email");

  return (
    <div>
      <PageHeader
        title="Logs"
        subtitle="Email delivery logs and system logs"
      />

      <div className="px-8 py-6 space-y-5">
        {/* Main tab switcher */}
        <div className="flex gap-2 border-b border-gray-800 pb-0">
          <button
            onClick={() => setMainTab("email")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mainTab === "email"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Mail size={15} /> Email Sending Logs
          </button>
          <button
            onClick={() => setMainTab("system")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mainTab === "system"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Terminal size={15} /> System Logs
          </button>
        </div>

        {mainTab === "email" ? <EmailLogs /> : <SystemLogs />}
      </div>
    </div>
  );
}
