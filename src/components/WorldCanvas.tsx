import { AnimatePresence, motion } from "framer-motion";
import { Layers3, LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nation, ScenarioConfig, WeeklyFrame } from "@/lib/sandtable";

type Props = { config: ScenarioConfig; nations: Nation[]; frame?: WeeklyFrame; week: number };

export function WorldCanvas({ config, nations, frame, week }: Props) {
  const a = nations.find(n => n.code === config.sideA.nationCode);
  const b = nations.find(n => n.code === config.sideB.nationCode);
  const aX = frame ? 22 + frame.aPosition * .56 : 28;
  const bX = frame ? 78 - (100 - frame.bPosition) * .56 : 72;
  return (
    <div className="absolute inset-0 overflow-hidden bg-atlas">
      <div className="absolute inset-0 atlas-grid opacity-50" />
      <div className="absolute left-1/2 top-[47%] h-[min(76vw,76vh)] w-[min(76vw,76vh)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0a] shadow-[0_0_90px_rgba(250,204,21,.08)]">
        <svg className="h-full w-full" viewBox="0 0 100 100" role="img" aria-label="Abstract globe showing aggregate formations">
          <defs><clipPath id="globe"><circle cx="50" cy="50" r="49" /></clipPath></defs>
          <circle cx="50" cy="50" r="49" fill="#070707" stroke="#3c4748" strokeWidth=".45" />
          <g clipPath="url(#globe)" opacity=".58" fill="none" stroke="#536062" strokeWidth=".25">
            {[20,35,50,65,80].map(v => <ellipse key={`lat-${v}`} cx="50" cy="50" rx="48" ry={Math.abs(50-v)*.62+5} />)}
            {[20,35,50,65,80].map(v => <ellipse key={`lon-${v}`} cx="50" cy="50" rx={Math.abs(50-v)*.72+7} ry="48" />)}
          </g>
          <g clipPath="url(#globe)" fill="#273334" stroke="#586465" strokeWidth=".35">
            <path d="M6 35l8-12 13-6 9 5-3 8 7 5-5 10-12 5-5 13-8-4-4-13z" />
            <path d="M37 18l12-8 17 3 8 9-4 7 9 6-5 9-12-2-8 8-13-5 4-9-9-7z" />
            <path d="M52 54l11-8 14 5 8 14-6 14-12 8-9-7 4-12-10-5z" />
            <path d="M23 59l12-5 9 9-3 17-9 12-7-7 2-13-8-6z" />
          </g>
          <path d={`M${aX} 55 Q50 38 ${bX} 55`} fill="none" stroke="#facc15" strokeWidth=".55" strokeDasharray="1.8 1.8" opacity=".85" />
          <circle cx="50" cy="46" r="3.4" fill="#facc15" opacity=".12" />
          <circle cx="50" cy="46" r="1.15" fill="#facc15" />
          <g transform={`translate(${aX} 55)`}><circle r="3.8" fill="#101010" stroke="#facc15" strokeWidth=".7" /><text y="1.2" textAnchor="middle" fill="#fffde8" fontSize="3.2" fontWeight="700">A</text></g>
          <g transform={`translate(${bX} 55)`}><circle r="3.8" fill="#101010" stroke="#a3a3a3" strokeWidth=".7" /><text y="1.2" textAnchor="middle" fill="#f5f5f4" fontSize="3.2" fontWeight="700">B</text></g>
        </svg>
      </div>
      <div className="absolute left-4 top-24 hidden rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-2 shadow-2xl backdrop-blur md:flex md:flex-col md:gap-1">
        {[Plus, Minus, LocateFixed, Layers3].map((Icon, i) => <Button key={i} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-stone-400 hover:bg-white/5 hover:text-white" aria-label={["Zoom in","Zoom out","Center globe","Map layers"][i]}><Icon className="h-4 w-4" /></Button>)}
      </div>
      <div className="absolute bottom-28 left-4 hidden max-w-[250px] rounded-2xl border border-white/10 bg-[#0b0b0b]/88 p-4 backdrop-blur md:block">
        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[.18em] text-stone-500"><span>Active frame</span><span>W{String(week).padStart(2,"0")}</span></div>
        <AnimatePresence mode="wait"><motion.div key={week} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <p className="text-sm font-medium text-stone-100">{frame?.control === "contested" || !frame ? "Objective contested" : `Side ${frame.control} holds advantage`}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">Abstract positions only · no real unit locations</p>
        </motion.div></AnimatePresence>
      </div>
      <div className="absolute right-4 top-24 hidden w-52 space-y-2 lg:block">
        {[{ label: "SIDE A", nation: a, color: "#facc15" }, { label: "SIDE B", nation: b, color: "#a3a3a3" }].map(side => <div key={side.label} className="rounded-2xl border border-white/10 bg-[#0b0b0b]/88 p-3 backdrop-blur"><div className="flex items-center gap-2 text-[10px] tracking-[.18em] text-stone-500"><span className="h-2 w-2 rounded-full" style={{ background: side.color }} />{side.label}</div><p className="mt-2 truncate text-sm font-medium text-stone-100">{side.nation?.name}</p><p className="mt-1 text-[11px] text-stone-500">Aggregate formations</p></div>)}
      </div>
    </div>
  );
}
