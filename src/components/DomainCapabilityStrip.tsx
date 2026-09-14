import { Boxes, LandPlot, Plane, ShipWheel } from "lucide-react";
import { DomainScores } from "@/lib/sandtable";

type Props = { sideA: DomainScores; sideB: DomainScores; version?: string };

const domains = [
  { key: "land", label: "Land", Icon: LandPlot },
  { key: "air", label: "Air", Icon: Plane },
  { key: "maritime", label: "Maritime", Icon: ShipWheel },
  { key: "support", label: "Support", Icon: Boxes },
] as const;

export function DomainCapabilityStrip({ sideA, sideB, version }: Props) {
  return <div className="mb-4 rounded-2xl border border-white/8 bg-white/[.025] p-3 sm:p-4">
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><p className="text-xs font-medium text-stone-200">Separate domain capability</p><p className="mt-0.5 text-[10px] text-stone-500">Approved inventory ranges × availability × readiness × sustainment</p><p className="mt-1 truncate font-mono text-[9px] text-stone-600 sm:hidden">{version ?? "asset dataset unavailable"} · A / B</p></div>
      <span className="hidden max-w-[45%] truncate font-mono text-[9px] text-stone-600 sm:block">{version ?? "asset dataset unavailable"} · A / B</span>
    </div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {domains.map(({ key, label, Icon }) => <div key={key} className="rounded-xl border border-white/7 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.13em] text-stone-500"><Icon className="h-3.5 w-3.5 text-yellow-300"/>{label}</div>
        <div className="mt-2 flex items-baseline gap-1.5"><span className="font-mono text-lg font-semibold text-yellow-200">{sideA[key]}</span><span className="text-stone-700">/</span><span className="font-mono text-sm text-stone-300">{sideB[key]}</span></div>
      </div>)}
    </div>
  </div>;
}
