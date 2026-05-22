import { useState, useEffect, useRef } from "react";
import { RefreshCw, Terminal } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getKumoLogs, getBackendLogs, getFrontendLogs } from "../api/client";

type LogLevel = "info" | "warn" | "error" | "debug";
interface LogEntry { line: string; level: LogLevel; }

type TabKey = "kumomta" | "backend" | "frontend";

const TABS: { key: TabKey; label: string }[] = [
  { key: "kumomta", label: "KumoMTA" },
  { key: "backend", label: "Panel Backend" },
  { key: "frontend", label: "Panel Frontend" },
];

const levelColor: Record<LogLevel, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-green-300",
  debug: "text-gray-400",
};

const fetchers: Record<TabKey, (n: number) => Promise<{ logs: LogEntry[] }>> = {
  kumomta: getKumoLogs,
  backend: getBackendLogs,
  frontend: getFrontendLogs,
};

export default function LogsPage() {
  const [tab, setTab] = useState<TabKey>("kumomta");
  const [logs, setLogs] = useState<Record<TabKey, LogEntry[]>>({ kumomta: [], backend: [], frontend: [] });
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (t: TabKey = tab) => {
    setLoading(true);
    try {
      const data = await fetchers[t](lines);
      setLogs((prev) => ({ ...prev, [t]: data.logs || [] }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab, lines]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(tab), 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, tab]);

  const current = logs[tab];

  return (
    <div>
      <PageHeader
        title="Logs"
        subtitle="Live logs from KumoMTA and the control panel"
        action={
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
        }
      />

      <div className="px-8 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Log viewer */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-800/40">
            <Terminal size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500 font-mono">
              {current.length} lines · {autoRefresh ? "auto-refresh every 5s" : "manual refresh"}
            </span>
          </div>
          <div className="bg-gray-950 h-[65vh] overflow-auto font-mono text-xs leading-relaxed p-4">
            {current.length === 0 ? (
              <p className="text-gray-600">No logs yet — click Refresh</p>
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
    </div>
  );
}
