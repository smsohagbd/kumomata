import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  Globe,
  ShieldCheck,
  FileCode,
  Settings,
  Mail,
  ScrollText,
} from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/ips", label: "IP Addresses", icon: Server },
  { to: "/domains", label: "Domain Rules", icon: Globe },
  { to: "/dkim", label: "DKIM Keys", icon: ShieldCheck },
  { to: "/config", label: "Config & Deploy", icon: FileCode },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Mail size={16} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">KumoMTA</p>
          <p className="text-xs text-gray-500 leading-tight">Control Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }: { isActive: boolean }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">v1.0.0 · Open Source</p>
      </div>
    </aside>
  );
}
