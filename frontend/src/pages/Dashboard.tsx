import { useEffect, useState } from "react";
import { Server, Globe, ShieldCheck, Activity, Wifi, WifiOff } from "lucide-react";
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";
import { getOverview } from "../api/client";

interface Overview {
  total_ips: number;
  active_ips: number;
  total_domain_rules: number;
  active_dkim_keys: number;
  kumomta_online: boolean;
  kumomta_metrics: unknown;
}

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await getOverview();
      setData(res);
      setError("");
    } catch {
      setError("Could not connect to backend API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your KumoMTA configuration and status"
        action={
          <button onClick={load} className="btn-secondary text-xs">
            Refresh
          </button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {/* KumoMTA status banner */}
        {!loading && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              data?.kumomta_online
                ? "bg-green-900/20 border-green-800 text-green-400"
                : "bg-red-900/20 border-red-800 text-red-400"
            }`}
          >
            {data?.kumomta_online ? <Wifi size={16} /> : <WifiOff size={16} />}
            {data?.kumomta_online
              ? "KumoMTA is online and reachable"
              : "KumoMTA is offline or not configured yet"}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse h-24 bg-gray-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total IPs"
              value={data?.total_ips ?? 0}
              icon={<Server size={20} />}
              color="blue"
              sub={`${data?.active_ips ?? 0} active`}
            />
            <StatCard
              label="Domain Rules"
              value={data?.total_domain_rules ?? 0}
              icon={<Globe size={20} />}
              color="green"
            />
            <StatCard
              label="DKIM Keys"
              value={data?.active_dkim_keys ?? 0}
              icon={<ShieldCheck size={20} />}
              color="purple"
              sub="Active keys"
            />
            <StatCard
              label="MTA Status"
              value={data?.kumomta_online ? "Online" : "Offline"}
              icon={<Activity size={20} />}
              color={data?.kumomta_online ? "green" : "red"}
            />
          </div>
        )}

        {/* Quick guide */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Quick Setup Guide</h2>
          <ol className="space-y-3">
            {[
              { step: 1, title: "Add your IP addresses", desc: "Go to IP Addresses and add the IPs assigned to your server.", link: "/ips" },
              { step: 2, title: "Set domain sending rules", desc: "Configure per-domain limits (Gmail, Yahoo, etc.) in Domain Rules.", link: "/domains" },
              { step: 3, title: "Generate DKIM keys", desc: "Create DKIM signing keys for each sending domain.", link: "/dkim" },
              { step: 4, title: "Deploy config with one click", desc: "Go to Config & Deploy and click 'Deploy Config' — the panel writes init.lua, shaping.toml and DKIM keys, then reloads KumoMTA.", link: "/config" },
            ].map(({ step, title, desc, link }) => (
              <li key={step} className="flex gap-4">
                <div className="w-7 h-7 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <a href={link} className="font-medium text-white hover:text-blue-400 transition-colors">
                    {title}
                  </a>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
