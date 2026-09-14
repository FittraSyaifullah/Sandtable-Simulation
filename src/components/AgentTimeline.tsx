import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenarioConfig, SimulationResult } from "@/lib/sandtable";

type Props = { result:SimulationResult; config:ScenarioConfig; week:number; onWeekChange:(week:number)=>void };

export function AgentTimeline({ result, config, week, onWeekChange }:Props) {
  const turns = result.agentTurns ?? [];
  const turn = turns.find(item=>item.week===week) ?? turns[Math.min(week,turns.length-1)];
  if (!turn) return null;
  const a = config.sideA.nationCode;
  const b = config.sideB.nationCode;
  return <section className="absolute inset-x-2 bottom-[92px] z-30 rounded-[24px] border border-white/10 bg-[#090909]/94 p-3 shadow-[0_-18px_60px_rgba(0,0,0,.32)] backdrop-blur-xl md:left-auto md:right-3 md:w-[min(760px,calc(100vw-2rem))]" aria-label="National agent timeline">
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-yellow-400/10 text-yellow-300"><Bot className="h-4 w-4"/></span>
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><p className="text-[9px] uppercase tracking-[.16em] text-stone-500">National agent turn</p><p className="font-mono text-[10px] text-yellow-200">W{String(week).padStart(2,"0")}</p></div><div className="mt-2 flex gap-1 overflow-x-auto pb-1">{turns.map(item=><button key={item.week} onClick={()=>onWeekChange(item.week)} className={`h-1.5 min-w-5 flex-1 rounded-full transition-colors ${item.week<=week?"bg-yellow-400":"bg-white/10"}`} aria-label={`Open agent turn ${item.week}`}/>)}</div></div>
      <div className="flex gap-1"><Button onClick={()=>onWeekChange(Math.max(0,week-1))} disabled={week===0} size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-stone-500" aria-label="Previous turn"><ChevronLeft className="h-4 w-4"/></Button><Button onClick={()=>onWeekChange(Math.min(result.frames.length-1,week+1))} disabled={week>=result.frames.length-1} size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-stone-500" aria-label="Next turn"><ChevronRight className="h-4 w-4"/></Button></div>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <AgentDecision name={a} side="A" stance={turn.sideA.stance} priority={turn.sideA.priority} rationale={turn.sideA.rationale}/>
      <AgentDecision name={b} side="B" stance={turn.sideB.stance} priority={turn.sideB.priority} rationale={turn.sideB.rationale}/>
    </div>
  </section>;
}

function AgentDecision({name,side,stance,priority,rationale}:{name:string;side:"A"|"B";stance:string;priority:string;rationale:string}) {
  return <article className="min-w-0 rounded-2xl border border-white/8 bg-black/35 px-3 py-2.5"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${side==="A"?"bg-yellow-400":"bg-stone-300"}`}/><p className="min-w-0 flex-1 truncate text-xs font-medium text-stone-200">{name}</p><span className="rounded-full bg-white/[.05] px-2 py-1 text-[8px] uppercase tracking-wider text-stone-500">{stance} · {priority}</span></div><p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-stone-500">{rationale}</p></article>;
}
