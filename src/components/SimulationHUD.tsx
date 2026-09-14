import { Gauge, Pause, Play, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { FormationSelection } from "@/components/MapboxWorld";
import { Nation, ScenarioConfig, SimulationResult } from "@/lib/sandtable";

type Props = {
  result: SimulationResult;
  config: ScenarioConfig;
  nationA?: Nation;
  nationB?: Nation;
  week: number;
  playing: boolean;
  speed: number;
  selected?: FormationSelection;
  onWeekChange: (week: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onCloseSelection: () => void;
  onNewScenario: () => void;
};

export function SimulationHUD({ result, config, nationA, nationB, week, playing, speed, selected, onWeekChange, onTogglePlay, onSpeedChange, onCloseSelection, onNewScenario }: Props) {
  const frame=result.frames[Math.min(week,result.frames.length-1)];
  const turn=[...(result.agentTurns??[])].reverse().find(item=>item.week<=week);
  const events=result.events.filter(event=>event.week<=week).slice(-4).reverse();
  return <>
    {selected&&<aside className="absolute right-3 top-[76px] z-30 w-[calc(100%-1.5rem)] max-w-xs rounded-[22px] border border-white/12 bg-[#0b1726]/96 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-yellow-300/12 text-yellow-200"><selected.Icon className="h-4 w-4"/></span><div className="min-w-0 flex-1"><p className="text-[9px] uppercase tracking-[.17em] text-cyan-300">Synthetic formation</p><h2 className="mt-1 truncate text-sm font-semibold text-stone-100">{selected.label}</h2><p className="mt-1 text-[10px] text-slate-500">{selected.domain} · Side {selected.side}</p></div><Button onClick={onCloseSelection} size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-slate-500"><X className="h-4 w-4"/></Button></div>
      <div className="mt-4 grid grid-cols-3 gap-2"><MiniStat label="Strength" value={`${selected.side==="A"?frame.aStrength:frame.bStrength}%`}/><MiniStat label="Supply" value={`${selected.side==="A"?frame.aSupply:frame.bSupply}%`}/><MiniStat label="Scale" value={selected.scale}/></div>
      <p className="mt-3 rounded-xl border border-white/8 bg-white/[.03] p-3 text-[10px] leading-relaxed text-slate-500">Fictional identifier and illustrative position derived from national aggregate pools. It does not represent a real named unit.</p>
    </aside>}

    <section className="absolute inset-x-2 bottom-2 z-30 overflow-hidden rounded-[26px] border border-white/12 bg-[#0a1625]/96 shadow-[0_-20px_70px_rgba(0,0,0,.45)] backdrop-blur-xl md:inset-x-4" aria-label="Simulation playback">
      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(240px,.7fr)_minmax(420px,1.5fr)_minmax(260px,.8fr)] lg:items-center">
        <div className="min-w-0"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-stone-100">{config.name}</p><p className="mt-1 truncate text-[9px] uppercase tracking-[.14em] text-slate-500">{nationA?.code} <span className="text-yellow-200">vs</span> {nationB?.code} · synthetic global theatre</p></div><Button onClick={onNewScenario} variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Start a new scenario"><RotateCcw className="h-4 w-4"/></Button></div><div className="mt-3 grid grid-cols-2 gap-2"><ForceBar label={nationA?.code??"A"} value={frame.aStrength} color="bg-yellow-300"/><ForceBar label={nationB?.code??"B"} value={frame.bStrength} color="bg-cyan-300"/></div></div>

        <div><div className="flex items-center gap-3"><Button onClick={onTogglePlay} size="icon" className="h-11 w-11 shrink-0 rounded-2xl bg-yellow-300 text-[#142033] hover:bg-yellow-200" aria-label={playing?"Pause simulation":"Play simulation"}>{playing?<Pause className="h-4 w-4 fill-current"/>:<Play className="ml-0.5 h-4 w-4 fill-current"/>}</Button><Slider value={[week]} min={0} max={config.duration} step={1} onValueChange={values=>onWeekChange(values[0])}/><span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-yellow-200">W{String(week).padStart(2,"0")}</span></div><div className="mt-2 flex items-center justify-between"><p className="truncate pr-3 text-[10px] text-slate-500">{turn?.assessment??"Initial aggregate positions established."}</p><div className="flex shrink-0 gap-1">{[1,2,4].map(value=><button key={value} onClick={()=>onSpeedChange(value)} className={`rounded-lg px-2 py-1 font-mono text-[9px] ${speed===value?"bg-white/10 text-yellow-200":"text-slate-600 hover:text-slate-300"}`}>{value}×</button>)}</div></div></div>

        <div className="hidden min-w-0 lg:block"><div className="mb-2 flex items-center justify-between"><p className="text-[9px] uppercase tracking-[.16em] text-slate-600">Latest events</p><p className="text-[9px] text-slate-700">{result.assetDatasetVersion}</p></div><div className="space-y-1.5">{events.length?events.slice(0,2).map(event=><div key={event.id} className="flex items-center gap-2 rounded-xl border border-white/7 bg-white/[.025] px-3 py-2"><span className="font-mono text-[8px] text-yellow-300">W{event.week}</span><p className="truncate text-[10px] text-slate-400">{event.title}</p></div>):<p className="text-[10px] text-slate-600">Awaiting the first strategic interval.</p>}</div></div>
      </div>
      <div className="flex items-center justify-between border-t border-white/7 px-4 py-2 text-[8px] uppercase tracking-[.15em] text-slate-600"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-cyan-300"/>Illustrative, non-operational simulation</span><span className="flex items-center gap-1.5"><Gauge className="h-3 w-3"/>{playing?`Running at ${speed}×`:"Paused"}</span></div>
    </section>
  </>;
}

function MiniStat({label,value}:{label:string;value:string}) {return <div className="rounded-xl border border-white/8 bg-white/[.025] p-2"><p className="text-[8px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 truncate font-mono text-[10px] text-stone-200">{value}</p></div>}
function ForceBar({label,value,color}:{label:string;value:number;color:string}) {return <div><div className="mb-1 flex justify-between font-mono text-[9px] text-slate-500"><span>{label}</span><span>{value.toFixed(0)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${color}`} style={{width:`${value}%`}}/></div></div>}
