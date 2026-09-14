import { Check, Globe2, LoaderCircle, Play, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Nation } from "@/lib/sandtable";

type Props = {
  visible: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  nations: Nation[];
  selectedCodes: string[];
  onToggleNation: (code: string) => void;
  onStart: () => void;
  running: boolean;
  progress: { current: number; total: number };
};

const sample = "A twelve-week hypothetical competition over access to a remote international shipping corridor.";

export function ScenarioLauncher({ visible, prompt, onPromptChange, nations, selectedCodes, onToggleNation, onStart, running, progress }: Props) {
  if (!visible) return null;
  const ready = prompt.trim().length >= 24 && selectedCodes.length === 2;
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-[#07111f]/92 px-4 py-20 backdrop-blur-md sm:px-6">
    <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
      <section className="w-full rounded-[30px] border border-white/10 bg-[#0b1726]/98 p-5 shadow-[0_30px_100px_rgba(0,0,0,.5)] sm:p-8 md:p-10" aria-label="Start a hypothetical simulation">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-yellow-300/25 bg-yellow-300/10"><Globe2 className="h-5 w-5 text-yellow-300"/></span>
          <div><p className="text-[10px] uppercase tracking-[.2em] text-yellow-300">New simulation</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-stone-50 sm:text-4xl">Describe the conflict.</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Choose two countries and describe one hypothetical strategic scenario. Sandtable handles the rest.</p></div>
        </div>

        <label className="mt-8 block"><span className="mb-2 block text-[10px] uppercase tracking-[.16em] text-slate-500">Scenario</span><Textarea autoFocus value={prompt} onChange={event=>onPromptChange(event.target.value)} disabled={running} placeholder="What hypothetical modern conflict should Sandtable explore?" className="min-h-32 resize-none rounded-[22px] border-white/10 bg-[#07111f] p-4 text-base leading-relaxed text-stone-100 shadow-inner placeholder:text-slate-600 focus-visible:ring-yellow-300/35"/></label>
        {!prompt&&<button onClick={()=>onPromptChange(sample)} className="mt-2 text-left text-[11px] text-slate-500 transition-colors hover:text-yellow-200"><Sparkles className="mr-1.5 inline h-3 w-3"/>Use a safe example</button>}

        <div className="mt-7"><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-[.16em] text-slate-500">Countries involved</p><p className="text-[10px] text-slate-600">Choose exactly two</p></div><div className="mt-3 flex flex-wrap gap-2">{nations.map(nation=>{const selected=selectedCodes.includes(nation.code);const order=selectedCodes.indexOf(nation.code);return <button key={nation.code} type="button" disabled={running} onClick={()=>onToggleNation(nation.code)} className={`flex h-11 items-center gap-2 rounded-2xl border px-3 text-xs transition-all ${selected?"border-yellow-300/45 bg-yellow-300 text-[#142033]":"border-white/10 bg-white/[.035] text-slate-300 hover:border-white/20 hover:bg-white/[.06]"}`}><span className={`grid h-6 min-w-6 place-items-center rounded-lg px-1 font-mono text-[9px] font-bold ${selected?"bg-[#142033]/12":"bg-white/[.06] text-slate-400"}`}>{selected?<Check className="h-3 w-3"/>:nation.code}</span><span>{nation.name}</span>{selected&&<span className="ml-1 text-[9px] font-semibold opacity-60">SIDE {order===0?"A":"B"}</span>}</button>})}</div></div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2 text-[10px] leading-relaxed text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300"/><span>Synthetic aggregate formations only. No real unit locations, deployment routes, targeting, or operational recommendations.</span></div>
          <Button onClick={onStart} disabled={!ready||running} className="stable-action h-12 rounded-2xl bg-yellow-300 px-6 font-semibold text-[#142033] hover:bg-yellow-200 disabled:bg-slate-700 disabled:text-slate-500">{running?<LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>:<Play className="mr-2 h-4 w-4 fill-current"/>}{running?`Simulating ${progress.current}/${progress.total}`:"Start simulation"}</Button>
        </div>
        {running&&<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-yellow-300 transition-[width] duration-300" style={{width:`${progress.total?progress.current/progress.total*100:0}%`}}/></div>}
      </section>
    </div>
  </div>;
}
