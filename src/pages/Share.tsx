import { useEffect, useState } from "react";
import { ArrowLeft, Database, Globe2, ShieldAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ScenarioConfig, SimulationResult } from "@/lib/sandtable";

type Shared = { name: string; region_label: string; configuration: ScenarioConfig; latest_result: SimulationResult; updated_at: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Share() {
  const { token = "" } = useParams();
  const [study, setStudy] = useState<Shared>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uuid.test(token)) { setLoading(false); return; }
    supabase.from("scenarios").select("name,region_label,configuration,latest_result,updated_at").eq("share_token", token).eq("status", "completed").maybeSingle().then(({ data }) => { setStudy(data as Shared | undefined); setLoading(false); });
  }, [token]);
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0b1113] text-sm text-stone-500">Opening preserved run…</div>;
  if (!study) return <div className="grid min-h-screen place-items-center bg-[#0b1113] p-6 text-center text-stone-100"><div><ShieldAlert className="mx-auto h-8 w-8 text-orange-400"/><h1 className="mt-4 text-2xl font-semibold">Report unavailable</h1><p className="mt-2 text-sm text-stone-500">This token is invalid, or the study has not been completed.</p><Button asChild className="mt-5 rounded-xl bg-orange-500 text-[#251306]"><Link to="/">Return to Sandtable</Link></Button></div></div>;
  const r = study.latest_result;
  const final = r.frames[r.frames.length - 1];
  return <main className="min-h-screen bg-[#0b1113] text-stone-100">
    <header className="border-b border-white/8 bg-[#0e1517] px-4 py-4"><div className="mx-auto flex max-w-6xl items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl border border-orange-500/30 bg-orange-500/10"><Globe2 className="h-5 w-5 text-orange-400"/></span><div className="flex-1"><p className="text-sm font-semibold">Sandtable</p><p className="text-[9px] uppercase tracking-[.2em] text-stone-500">Read-only report</p></div><Button asChild variant="ghost" className="rounded-xl text-stone-400"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/>Laboratory</Link></Button></div></header>
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="flex flex-col gap-5 border-b border-white/8 pb-8 md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-orange-400">Completed scenario</p><h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{study.name}</h1><p className="mt-3 text-stone-500">{study.region_label} · updated {new Date(study.updated_at).toLocaleDateString()}</p></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.05] px-4 py-3 text-xs text-amber-200">Illustrative output · not a forecast</div></div>
      <div className="mt-6 grid gap-4 md:grid-cols-[1.35fr_.65fr]">
        <div className="relative min-h-[380px] overflow-hidden rounded-[28px] border border-white/10 bg-[#10191b]"><div className="atlas-grid absolute inset-0 opacity-50"/><div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#0d1618] shadow-[0_0_70px_rgba(249,115,22,.08)]"><svg viewBox="0 0 100 100" className="h-full w-full"><circle cx="50" cy="50" r="48" fill="none" stroke="#556062" strokeWidth=".4"/><g fill="none" stroke="#455052" strokeWidth=".25">{[25,40,60,75].map(y=><ellipse key={y} cx="50" cy="50" rx="47" ry={Math.abs(50-y)/2+5}/>)}</g><path d="M12 37l14-17 13 8-7 15-14 8zm31-18l22-8 20 18-9 15-21-3-10 12-12-13zm10 43l18-14 17 19-10 19-20-7z" fill="#283436" stroke="#596568" strokeWidth=".4"/><circle cx="50" cy="48" r="2" fill="#f97316"/></svg></div><div className="absolute bottom-4 left-4 right-4 flex justify-between rounded-2xl border border-white/8 bg-[#101719]/90 p-3 text-xs"><span className="text-orange-300">A · strength {final.aStrength}%</span><span className="text-stone-500">Final frame W{final.week}</span><span className="text-cyan-200">B · strength {final.bStrength}%</span></div></div>
        <div className="grid grid-cols-2 gap-3"><Stat label="Modeled advantage" value={`Side ${r.advantage}`} accent/><Stat label="Confidence" value={r.confidence}/><Stat label="Side A range" value={`${r.outcomeA}%`} note={`loss ${r.lossRangeA[0]}–${r.lossRangeA[1]}%`}/><Stat label="Side B range" value={`${r.outcomeB}%`} note={`loss ${r.lossRangeB[0]}–${r.lossRangeB[1]}%`}/><div className="col-span-2 rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="flex items-center gap-2 text-xs text-stone-300"><Database className="h-4 w-4 text-orange-400"/>Preserved provenance</p><div className="mt-3 space-y-2 font-mono text-[10px] text-stone-500"><p>{r.modelVersion}</p><p>{r.datasetVersion}</p><p>seed · {r.seed}</p><p className="break-all">{r.runKey}</p></div></div></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2"><TextBlock title="Assumptions" items={r.assumptions}/><TextBlock title="Limitations" items={r.limitations}/></div>
    </div>
  </main>;
}
function Stat({label,value,note,accent=false}:{label:string;value:string;note?:string;accent?:boolean}) { return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="text-[9px] uppercase tracking-[.16em] text-stone-500">{label}</p><p className={`mt-2 text-xl font-semibold capitalize ${accent?"text-orange-300":"text-stone-100"}`}>{value}</p>{note&&<p className="mt-1 text-[10px] text-stone-500">{note}</p>}</div> }
function TextBlock({title,items}:{title:string;items:string[]}) { return <section className="rounded-[24px] border border-white/8 bg-white/[.025] p-5"><h2 className="text-sm font-medium">{title}</h2><ul className="mt-3 space-y-2 text-xs leading-relaxed text-stone-500">{items.map(item=><li key={item} className="flex gap-2"><span className="text-orange-400">•</span>{item}</li>)}</ul></section> }
