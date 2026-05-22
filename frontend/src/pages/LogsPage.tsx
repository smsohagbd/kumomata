import { useState, useEffect, useRef } from "react";
import { RefreshCw, Terminal, Mail, CheckCircle, XCircle, Clock, AlertTriangle, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getKumoLogs, getBackendLogs, getEmailLogs, getEmailLogsRealtime, deleteEmailLog, deleteEmailLogsByType, clearQueueByDomain } from "../api/client";

// ─── Types ────────────────────────────────────────────────
type LogLevel = "info" | "warn" | "error" | "debug";
interface LogEntry { line: string; level: LogLevel; }

interface EmailRecord {
  type: string;
  timestamp: string;
  sender: string;
  recipient: string;
  queue: string;
  site: string;
  code: number;
  response: string;
  size: number;
  num_attempts: number;
  peer_ip: string;
  egress_pool: string;
  egress_source: string;
  bounce_class: string;
  id: string;
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

type FilterType = "all" | "delivered" | "failed" | "retry" | "received";

const FILTER_LABELS: Record<FilterType, string> = {
  all:       "All",
  received:  "Received",
  delivered: "Delivered",
  retry:     "Retry",
  failed:    "Failed",
};
const FILTER_COLORS: Record<FilterType, string> = {
  all:       "text-gray-300",
  received:  "text-blue-400",
  delivered: "text-green-400",
  retry:     "text-yellow-400",
  failed:    "text-red-400",
};
const DELETABLE: FilterType[] = ["retry", "failed", "received"];

// ─── Email Logs Tab ───────────────────────────────────────
function EmailLogs() {
  const [records, setRecords] = useState<EmailRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (p = page, f = filter) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = await getEmailLogsRealtime(PAGE_SIZE, p * PAGE_SIZE, f);
      if (data.records && (data.total > 0 || f !== "all")) {
        setRecords(data.records || []);
        setTotal(data.total || 0);
        setError("");
      } else {
        // Fall back to file reader only on first page with no filter
        data = await getEmailLogs(PAGE_SIZE);
        setRecords(data.records || []);
        setTotal(data.records?.length || 0);
        setError(data.error || "");
      }
    } catch {
      setError("Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(0); load(0, filter); }, [filter]);
  useEffect(() => { load(page, filter); }, [page]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(() => load(page, filter), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, page, filter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDeleteRow = async (dbId: number, queue: string) => {
    if (!confirm(`Cancel & delete this message?\nQueue: ${queue || "unknown"}`)) return;
    setDeleting(dbId);
    try {
      // Cancel in KumoMTA queue (by domain) + delete from log DB
      if (queue) await clearQueueByDomain(queue);
      await deleteEmailLog(dbId);
      await load(page, filter);
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ALL ${FILTER_LABELS[filter]} log entries? This also cancels queued messages.`)) return;
    setBulkDeleting(true);
    try {
      if (filter === "retry") await clearQueueByDomain(""); // clear all retrying
      await deleteEmailLogsByType(filter);
      setPage(0);
      await load(0, filter);
    } finally {
      setBulkDeleting(false);
    }
  };

  const canDelete = DELETABLE.includes(filter);

  return (
    <div className="space-y-4">
      {/* Filter radio buttons */}
      <div className="flex flex-wrap items-center gap-1 bg-gray-800/50 p-1.5 rounded-xl w-fit">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-gray-700 text-white shadow"
                : `text-gray-500 hover:text-gray-300 ${FILTER_COLORS[f]}`
            }`}
          >
            <span className={filter === f ? "text-white" : FILTER_COLORS[f]}>
              {FILTER_LABELS[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">
          {total > 0 ? `${total.toLocaleString()} records` : "No records"}
          {filter !== "all" && ` · filtered: ${FILTER_LABELS[filter]}`}
        </p>
        <div className="flex items-center gap-2">
          {canDelete && total > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="btn-danger text-xs py-1.5"
            >
              <Trash2 size={12} className={bulkDeleting ? "animate-spin" : ""} />
              {bulkDeleting ? "Deleting..." : `Delete All ${FILTER_LABELS[filter]}`}
            </button>
          )}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "btn-primary text-xs py-1.5" : "btn-secondary text-xs py-1.5"}
          >
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </button>
          <button onClick={() => load(page, filter)} disabled={loading} className="btn-secondary text-xs py-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
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
          <p className="text-gray-400 font-medium">No {filter !== "all" ? FILTER_LABELS[filter].toLowerCase() : ""} logs yet</p>
          <p className="text-sm text-gray-600 mt-1">Send an email — logs appear within ~10 seconds</p>
        </div>
      )}

      {records.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Code</th>
                <th>From</th>
                <th>To</th>
                <th>Server Response</th>
                <th>IP / Source</th>
                <th>Tries</th>
                <th>Size</th>
                {canDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td className="text-gray-500 text-xs whitespace-nowrap">{r.timestamp || "—"}</td>
                  <td><TypeBadge type={r.type} /></td>
                  <td>
                    <span className={`font-mono text-xs font-bold ${
                      r.code >= 200 && r.code < 300 ? "text-green-400" :
                      r.code >= 400 && r.code < 500 ? "text-yellow-400" :
                      r.code >= 500 ? "text-red-400" : "text-gray-400"
                    }`}>
                      {r.code || "—"}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-gray-300 max-w-[130px] truncate">{r.sender || "—"}</td>
                  <td className="font-mono text-xs text-gray-300 max-w-[130px] truncate">{r.recipient || "—"}</td>
                  <td className="text-xs text-gray-400 max-w-[200px]" title={r.response}>
                    <span className="truncate block">{r.response || "—"}</span>
                    {r.bounce_class && r.bounce_class !== "Uncategorized" && (
                      <span className="text-orange-400 text-xs">({r.bounce_class})</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-500">
                    <div>{r.peer_ip || "—"}</div>
                    {r.egress_source && <div className="text-purple-400">{r.egress_source}</div>}
                  </td>
                  <td className="text-center text-gray-400">{r.num_attempts}</td>
                  <td className="text-gray-500 text-xs">{r.size > 0 ? `${(r.size / 1024).toFixed(1)}k` : "—"}</td>
                  {canDelete && (
                    <td>
                      <button
                        onClick={() => handleDeleteRow((r as EmailRecord & { db_id: number }).db_id, r.queue)}
                        disabled={deleting === (r as EmailRecord & { db_id: number }).db_id}
                        className="btn-ghost p-1 text-red-400 hover:text-red-300"
                        title="Cancel & delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="btn-secondary text-xs py-1.5 px-2"
          >«</button>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary text-xs py-1.5 px-3"
          >Prev</button>
          <span className="text-xs text-gray-400 px-2">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-secondary text-xs py-1.5 px-3"
          >Next</button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="btn-secondary text-xs py-1.5 px-2"
          >»</button>
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
