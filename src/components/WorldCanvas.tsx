import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Layers3, LocateFixed, Minus, Plane, Plus, Ship, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapboxStatus, MapboxWorld, MapboxWorldHandle } from "@/components/MapboxWorld";
import { Nation, ScenarioConfig, SimulationEvent, WeeklyFrame } from "@/lib/sandtable";

type Props = { config: ScenarioConfig; nations: Nation[]; frame?: WeeklyFrame; events?: SimulationEvent[]; week: number };
type FormationKind = keyof ScenarioConfig["sideA"]["formations"];
type Selection = { side: "A" | "B"; kind: FormationKind };
const kindIcons = { land: LocateFixed, air: Plane, naval: Ship, support: Truck };

export function WorldCanvas({ config, nations, frame, events = [], week }: Props) {
  const [selected, setSelected] = useState<Selection>();
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [mapStatus, setMapStatus] = useState<MapboxStatus>("loading");
  const mapRef = useRef<MapboxWorldHandle>(null);
  const a = nations.find(n => n.code === config.sideA.nationCode);
  const b = nations.find(n => n.code === config.sideB.nationCode);
  const aX = frame ? 22 + frame.aPosition * .56 : 28;
  const bX = frame ? 78 - (100 - frame.bPosition) * .56 : 72;
  const selectedSide = selected?.side === "A" ? config.sideA : config.sideB;
  const selectedStrength = selected?.side === "A" ? frame?.aStrength : frame?.bStrength;
  const selectedSupply = selected?.side === "A" ? frame?.aSupply : frame?.bSupply;
  const relatedStatus = useMemo(() => {
    if (!selected || !frame) return "Awaiting a completed frame";
    if (selected.kind === "support" && (selectedSupply ?? 100) < 45) return "Supply pressure detected";
    if (Math.abs(frame.bPosition - frame.aPosition) <= 22) return "Adjacent to opposing effective formations";
    return "Moving under configured posture";
  }, [selected, frame, selectedSupply]);
  const relatedEvents = useMemo(() => selected ? events.filter(event => event.week <= week && (event.side === selected.side || event.side === "both") && (selected.kind === "support" ? event.type === "logistics" || event.type === "movement" : event.type !== "logistics")).slice(-2).reverse() : [], [events, selected, week]);

  const formations = (["land", "air", "naval", "support"] as const).flatMap((kind, index) => [
    { side: "A" as const, kind, count: config.sideA.formations[kind], left: aX + (index - 1.5) * 3.4, top: 54 + (index % 2) * 5 },
    { side: "B" as const, kind, count: config.sideB.formations[kind], left: bX + (index - 1.5) * 3.4, top: 54 + (index % 2) * 5 },
  ]).filter(item => item.count > 0);

  const zoomIn = () => mapStatus === "ready" ? mapRef.current?.zoomIn() : setZoom(value => Math.min(1.3, +(value + .1).toFixed(1)));
  const zoomOut = () => mapStatus === "ready" ? mapRef.current?.zoomOut() : setZoom(value => Math.max(.8, +(value - .1).toFixed(1)));
  const reset = () => { if (mapStatus === "ready") mapRef.current?.reset(); else setZoom(1); };

  return (
    <div className="absolute inset-0 overflow-hidden bg-atlas md:left-[480px] lg:left-[520px]">
      <MapboxWorld ref={mapRef} sideA={a} sideB={b} config={config} frame={frame} onSelect={setSelected} onStatusChange={setMapStatus} />
      {mapStatus !== "ready" && <FallbackGlobe zoom={zoom} aX={aX} bX={bX} formations={formations} selected={selected} onSelect={setSelected} />}
      {showGrid && <div className="atlas-grid pointer-events-none absolute inset-0 opacity-30" />}

      <div className="absolute left-4 top-24 hidden rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-2 shadow-2xl backdrop-blur md:flex md:flex-col md:gap-1">
        <Button onClick={zoomIn} disabled={mapStatus!=="ready"&&zoom>=1.3} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-stone-400 hover:bg-white/5 hover:text-white" aria-label="Zoom in"><Plus className="h-4 w-4"/></Button>
        <Button onClick={zoomOut} disabled={mapStatus!=="ready"&&zoom<=.8} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-stone-400 hover:bg-white/5 hover:text-white" aria-label="Zoom out"><Minus className="h-4 w-4"/></Button>
        <Button onClick={reset} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-stone-400 hover:bg-white/5 hover:text-white" aria-label="Fit scenario"><LocateFixed className="h-4 w-4"/></Button>
        <Button onClick={()=>setShowGrid(value=>!value)} aria-pressed={showGrid} variant="ghost" size="icon" className={`h-9 w-9 rounded-xl hover:bg-white/5 hover:text-white ${showGrid?"bg-yellow-400/10 text-yellow-300":"text-stone-400"}`} aria-label="Toggle map grid"><Layers3 className="h-4 w-4"/></Button>
      </div>

      <div className="absolute bottom-28 left-4 hidden max-w-[260px] rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-4 backdrop-blur md:block">
        <div className="mb-3 flex items-center justify-between gap-4 text-[9px] uppercase tracking-[.17em] text-stone-500"><span>Active frame</span><span className={mapStatus==="ready"?"text-emerald-300":"text-yellow-300"}>{mapStatus==="ready"?"Mapbox live":"Local fallback"}</span></div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[.18em] text-stone-600"><span>Scenario state</span><span>W{String(week).padStart(2,"0")}</span></div>
        <p className="mt-2 text-sm font-medium text-stone-100">{frame?.control === "contested" || !frame ? "Objective contested" : `Side ${frame.control} holds advantage`}</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">Illustrative aggregate anchors · no real unit locations</p>
      </div>

      {mapStatus==="unavailable"&&<div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full border border-yellow-400/20 bg-black/80 px-3 py-1.5 text-[9px] text-yellow-100 backdrop-blur">Add VITE_MAPBOX_ACCESS_TOKEN to enable Mapbox</div>}

      <div className="absolute right-4 top-24 hidden w-52 space-y-2 lg:block">{[{label:"SIDE A",nation:a,color:"#facc15"},{label:"SIDE B",nation:b,color:"#a3a3a3"}].map(side=><div key={side.label} className="rounded-2xl border border-white/10 bg-[#0b0b0b]/90 p-3 backdrop-blur"><div className="flex items-center gap-2 text-[10px] tracking-[.18em] text-stone-500"><span className="h-2 w-2 rounded-full" style={{background:side.color}}/>{side.label}</div><p className="mt-2 truncate text-sm font-medium text-stone-100">{side.nation?.name}</p><p className="mt-1 text-[11px] text-stone-500">Aggregate formations</p></div>)}</div>

      {selected && <motion.aside initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} className="absolute inset-x-2 top-[80px] z-30 max-h-[calc(100dvh-164px)] overflow-y-auto rounded-[22px] border border-yellow-400/25 bg-black/95 p-4 shadow-2xl sm:left-auto sm:right-3 sm:w-72 md:bottom-28 md:right-4 md:top-auto"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-yellow-300">Formation inspector</p><h3 className="mt-1 text-sm font-semibold capitalize">Side {selected.side} · {selected.kind}</h3></div><Button onClick={()=>setSelected(undefined)} variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-stone-500 md:h-9 md:w-9" aria-label="Close formation inspector"><X className="h-3.5 w-3.5"/></Button></div><div className="mt-4 grid grid-cols-3 gap-2"><InspectorStat label="Count" value={String(selectedSide.formations[selected.kind])}/><InspectorStat label="Strength" value={`${selectedStrength?.toFixed(0) ?? 100}%`}/><InspectorStat label="Supply" value={`${selectedSupply?.toFixed(0) ?? selectedSide.supply}%`}/></div><p className="mt-3 rounded-xl border border-white/8 bg-white/[.03] p-3 text-[11px] leading-relaxed text-stone-400">W{String(week).padStart(2,"0")} · {relatedStatus}. Position is illustrative and derived from an abstract replay coordinate.</p>{relatedEvents.length>0&&<div className="mt-2 space-y-1.5">{relatedEvents.map(event=><div key={event.id} className="rounded-xl border border-white/6 bg-white/[.02] px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-stone-600">W{event.week} · {event.type}</p><p className="mt-1 text-[10px] text-stone-300">{event.title}</p></div>)}</div>}</motion.aside>}
    </div>
  );
}

type FallbackFormation = { side:"A"|"B"; kind:FormationKind; count:number; left:number; top:number };
function FallbackGlobe({ zoom, aX, bX, formations, selected, onSelect }:{ zoom:number; aX:number; bX:number; formations:FallbackFormation[]; selected?:Selection; onSelect:(selection:Selection)=>void }) {
  return <div style={{ scale: zoom }} className="absolute left-1/2 top-[47%] aspect-square w-[min(76vw,76vh)] max-w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0a] shadow-[0_0_90px_rgba(250,204,21,.08)] transition-transform duration-300">
    <svg className="h-full w-full" viewBox="0 0 100 100" role="img" aria-label="Local fallback globe showing aggregate formations"><defs><clipPath id="globe"><circle cx="50" cy="50" r="49" /></clipPath></defs><circle cx="50" cy="50" r="49" fill="#070707" stroke="#3c4748" strokeWidth=".45" /><g clipPath="url(#globe)" opacity=".58" fill="none" stroke="#536062" strokeWidth=".25">{[20,35,50,65,80].map(v => <ellipse key={`lat-${v}`} cx="50" cy="50" rx="48" ry={Math.abs(50-v)*.62+5} />)}{[20,35,50,65,80].map(v => <ellipse key={`lon-${v}`} cx="50" cy="50" rx={Math.abs(50-v)*.72+7} ry="48" />)}</g><g clipPath="url(#globe)" fill="#202020" stroke="#555" strokeWidth=".35"><path d="M6 35l8-12 13-6 9 5-3 8 7 5-5 10-12 5-5 13-8-4-4-13z"/><path d="M37 18l12-8 17 3 8 9-4 7 9 6-5 9-12-2-8 8-13-5 4-9-9-7z"/><path d="M52 54l11-8 14 5 8 14-6 14-12 8-9-7 4-12-10-5z"/><path d="M23 59l12-5 9 9-3 17-9 12-7-7 2-13-8-6z"/></g><path d={`M${aX} 55 Q50 38 ${bX} 55`} fill="none" stroke="#facc15" strokeWidth=".55" strokeDasharray="1.8 1.8" opacity=".85" /><circle cx="50" cy="46" r="3.4" fill="#facc15" opacity=".12"/><circle cx="50" cy="46" r="1.15" fill="#facc15"/></svg>
    {formations.map(item => { const Icon=kindIcons[item.kind]; const active=selected?.side===item.side&&selected.kind===item.kind; return <motion.button key={`${item.side}-${item.kind}`} initial={{opacity:0,scale:.7}} animate={{opacity:1,scale:1,left:`${item.left}%`,top:`${item.top}%`}} onClick={()=>onSelect({side:item.side,kind:item.kind})} className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border shadow-lg md:h-9 md:w-9 ${active?"z-10 border-yellow-300 bg-yellow-400 text-black":"border-white/20 bg-black/90 text-stone-300 hover:border-yellow-400/60"}`} aria-label={`Inspect side ${item.side} ${item.kind} formation`}><Icon className="h-3.5 w-3.5"/><span className={`absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[8px] font-bold ${item.side==="A"?"bg-yellow-400 text-black":"bg-stone-200 text-black"}`}>{item.count}</span></motion.button>})}
  </div>;
}

function InspectorStat({label,value}:{label:string;value:string}) { return <div className="rounded-xl border border-white/8 bg-white/[.03] p-2"><p className="text-[8px] uppercase tracking-wider text-stone-600">{label}</p><p className="mt-1 font-mono text-xs text-stone-200">{value}</p></div> }
