import { type ReactNode } from "react";

interface Props {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  sub?: string;
}

const colorMap = {
  blue: "bg-blue-600/20 text-blue-400",
  green: "bg-green-600/20 text-green-400",
  yellow: "bg-yellow-600/20 text-yellow-400",
  red: "bg-red-600/20 text-red-400",
  purple: "bg-purple-600/20 text-purple-400",
};

export default function StatCard({ label, value, icon, color = "blue", sub }: Props) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
