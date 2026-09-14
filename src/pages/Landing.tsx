import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Database,
  Gauge,
  Globe2,
  LockKeyhole,
  MessageSquareText,
  Play,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type PublicStudy = {
  id: string;
  name: string;
  region_label: string;
  share_token: string;
  updated_at: string;
  latest_result: {
    advantage?: string;
    confidence?: string;
    modelVersion?: string;
  } | null;
};

const demoSteps = [
  {
    label: "Describe",
    icon: MessageSquareText,
    eyebrow: "Conversation-first setup",
    title: "Turn a question into reviewable assumptions.",
    body: "Describe a hypothetical scenario in plain language. Sandtable structures terrain, tempo, duration, and aggregate formations without hiding the inputs.",
  },
  {
    label: "Run",
    icon: Play,
    eyebrow: "Deterministic simulation",
    title: "Run the same model and get the same result.",
    body: "Every study preserves its seed, model version, dataset version, and event log so results can be reproduced and challenged.",
  },
  {
    label: "Inspect",
    icon: ScanSearch,
    eyebrow: "Transparent outputs",
    title: "See what changed—and why.",
    body: "Replay frames, compare sensitivity ranges, inspect assumptions, and share a read-only report instead of relying on a single opaque score.",
  },
];

const trustItems = [
  { icon: Database, title: "Governed evidence", text: "Versioned datasets and source manifests stay attached to every completed run." },
  { icon: Gauge, title: "Reproducible by design", text: "Fixed seeds and immutable run records make comparisons stable and auditable." },
  { icon: ShieldCheck, title: "Safety bounded", text: "Aggregate, educational analysis only—never targeting, strike planning, or operational advice." },
];

export default function Landing() {
  const [activeStep, setActiveStep] = useState(0);
  const [studies, setStudies] = useState<PublicStudy[]>([]);
  const [studiesLoading, setStudiesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("scenarios")
      .select("id,name,region_label,share_token,updated_at,latest_result")
      .eq("status", "completed")
      .not("share_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!active) return;
        setStudies((data ?? []) as PublicStudy[]);
        setStudiesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const step = demoSteps[activeStep];

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-stone-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#050505]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-yellow-400/30 bg-yellow-400/10"><Globe2 className="h-4.5 w-4.5 text-yellow-300" /></span>
            <span><span className="block text-sm font-semibold tracking-tight">Sandtable</span><span className="hidden text-[8px] uppercase tracking-[.19em] text-stone-600 sm:block">Scenario laboratory</span></span>
          </a>
          <nav className="ml-auto hidden items-center gap-7 md:flex" aria-label="Main navigation">
            <a href="#product" className="text-xs text-stone-500 transition-colors hover:text-stone-100">Product</a>
            <a href="#method" className="text-xs text-stone-500 transition-colors hover:text-stone-100">Method</a>
            <a href="#studies" className="text-xs text-stone-500 transition-colors hover:text-stone-100">Studies</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-8">
            <Button asChild variant="ghost" className="hidden h-10 rounded-xl px-4 text-xs text-stone-400 hover:bg-white/5 hover:text-white sm:inline-flex"><Link to="/login">Sign in</Link></Button>
            <Button asChild className="stable-action h-10 rounded-xl bg-yellow-400 px-4 text-xs font-semibold text-[#181500] hover:bg-yellow-300"><Link to="/login">Open Sandtable<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </header>

      <section id="top" className="relative isolate pt-16">
        <div className="atlas-grid absolute inset-0 -z-20 opacity-50" />
        <div className="absolute left-1/2 top-24 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-yellow-400/[.045] blur-3xl lg:left-[72%] lg:top-36" />
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:px-8">
          <div className="landing-rise max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/[.06] px-3 py-1.5 text-[10px] uppercase tracking-[.16em] text-yellow-200"><Sparkles className="h-3 w-3" />Transparent scenario exploration</div>
            <h1 className="mt-6 text-[clamp(2.8rem,8vw,5.8rem)] font-semibold leading-[.91] tracking-[-.055em]">Explore the forces<br />behind the <span className="text-yellow-300">outcome.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-stone-400 sm:text-lg">Sandtable is a governed laboratory for asking hypothetical questions, testing aggregate assumptions, and understanding how simplified scenarios evolve.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="stable-action h-13 rounded-2xl bg-yellow-400 px-6 text-sm font-semibold text-[#181500] hover:bg-yellow-300"><Link to="/login">Open Sandtable<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="stable-action h-13 rounded-2xl border-white/12 bg-white/[.025] px-6 text-sm text-stone-200 hover:bg-white/[.06] hover:text-white"><a href="#product"><Play className="mr-2 h-4 w-4 text-yellow-300" />See how it works</a></Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-stone-500">
              {["Review before running", "Repeatable results", "Read-only sharing"].map(item => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-yellow-300" />{item}</span>)}
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#080808]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          {[["240", "samples per run"], ["100%", "seed reproducible"], ["4", "traceability layers"], ["0", "hidden recommendations"]].map(([value, label]) => <div key={label} className="px-3 py-7 text-center sm:py-9"><p className="text-2xl font-semibold tracking-tight text-yellow-200 sm:text-3xl">{value}</p><p className="mt-1 text-[9px] uppercase tracking-[.14em] text-stone-600">{label}</p></div>)}
        </div>
      </section>

      <section id="product" className="scroll-mt-20 px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading label="Inside the laboratory" title="From question to evidence trail." copy="A focused workflow keeps human review between the prompt, the model, and every conclusion." />
          <div className="mt-12 grid overflow-hidden rounded-[28px] border border-white/10 bg-[#090909] lg:grid-cols-[.72fr_1.28fr]">
            <div className="border-b border-white/8 p-3 lg:border-b-0 lg:border-r lg:p-4">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                {demoSteps.map((item, index) => <button key={item.label} onClick={() => setActiveStep(index)} className={`group rounded-2xl p-3 text-left transition-colors sm:p-4 lg:p-5 ${activeStep === index ? "bg-yellow-400 text-[#181500]" : "text-stone-500 hover:bg-white/[.04] hover:text-stone-200"}`}><span className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${activeStep === index ? "bg-black/10" : "bg-white/[.04]"}`}><item.icon className="h-4 w-4" /></span><span className="hidden text-xs font-medium sm:inline">0{index + 1} · {item.label}</span><span className="text-xs font-medium sm:hidden">{item.label}</span></span><span className="mt-3 hidden text-xs leading-relaxed opacity-65 lg:block">{item.eyebrow}</span></button>)}
              </div>
            </div>
            <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:p-12">
              <div key={step.label} className="landing-rise">
                <p className="text-[10px] uppercase tracking-[.18em] text-yellow-300">{step.eyebrow}</p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{step.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-stone-500">{step.body}</p>
              </div>
              <DemoVisual step={activeStep} />
            </div>
          </div>
        </div>
      </section>

      <section id="method" className="scroll-mt-20 border-y border-white/8 bg-[#080808] px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
            <div><SectionHeading label="Method and trust" title="Built to be questioned." copy="Not a prediction engine. Not an operational tool. Sandtable makes uncertainty visible and keeps the evidence close." /><div className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-stone-500"><LockKeyhole className="h-3.5 w-3.5 text-yellow-300" />Illustrative analysis only</div></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {trustItems.map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-[24px] border border-white/8 bg-white/[.025] p-5 sm:p-6"><span className="grid h-10 w-10 place-items-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[.07]"><Icon className="h-4.5 w-4.5 text-yellow-300" /></span><p className="mt-8 text-[9px] font-mono text-stone-700">0{index + 1}</p><h3 className="mt-2 text-sm font-medium text-stone-200">{title}</h3><p className="mt-3 text-xs leading-relaxed text-stone-500">{text}</p></article>)}
            </div>
          </div>
        </div>
      </section>

      <section id="studies" className="scroll-mt-20 px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><SectionHeading label="Public studies" title="Inspect the output yourself." copy="Open preserved, read-only studies and see how assumptions, ranges, and provenance travel together." /><Button asChild variant="ghost" className="w-fit rounded-xl text-xs text-stone-400 hover:bg-white/5 hover:text-white"><Link to="/login">Create your own<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {studiesLoading ? [0, 1, 2].map(item => <div key={item} className="h-52 animate-pulse rounded-[24px] border border-white/8 bg-white/[.025]" />) : studies.length > 0 ? studies.map(study => <StudyCard key={study.id} study={study} />) : <EmptyStudies />}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 md:pb-28 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-yellow-400/20 bg-yellow-400 p-7 text-[#181500] sm:p-10 lg:p-14">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-black/10" /><div className="absolute -right-5 -top-7 h-44 w-44 rounded-full border border-black/10" />
          <div className="relative max-w-2xl"><p className="text-[10px] font-semibold uppercase tracking-[.18em] opacity-55">Start a scenario conversation</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Better questions begin with visible assumptions.</h2><p className="mt-4 max-w-xl text-sm leading-relaxed opacity-65">Enter the laboratory, review every input, and preserve every result.</p><Button asChild size="lg" className="mt-7 h-12 rounded-2xl bg-[#181500] px-6 text-sm text-yellow-100 hover:bg-[#292400]"><Link to="/login">Open Sandtable<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
        </div>
      </section>

      <footer className="border-t border-white/8 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-[10px] text-stone-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Globe2 className="h-3.5 w-3.5 text-yellow-300" /><span className="font-medium text-stone-400">Sandtable</span><span>· Governed scenario laboratory</span></div><p>Illustrative outputs are not forecasts or operational recommendations.</p></div></footer>
    </main>
  );
}

function SectionHeading({ label, title, copy }: { label: string; title: string; copy: string }) {
  return <div className="max-w-2xl"><p className="text-[10px] uppercase tracking-[.2em] text-yellow-300">{label}</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{title}</h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-500 sm:text-base">{copy}</p></div>;
}

function HeroVisual() {
  return <div className="landing-rise-delayed relative mx-auto w-full max-w-2xl lg:mx-0">
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090909] p-3 shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:p-4">
      <div className="flex items-center justify-between border-b border-white/8 px-2 pb-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(250,204,21,.7)]" /><span className="text-[9px] uppercase tracking-[.17em] text-stone-500">Model workspace</span></div><span className="rounded-lg bg-emerald-400/[.07] px-2 py-1 text-[8px] uppercase tracking-wider text-emerald-300">Review mode</span></div>
      <div className="grid gap-3 pt-3 sm:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-2"><div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><p className="text-[8px] uppercase tracking-widest text-stone-600">You</p><p className="mt-2 text-[11px] leading-relaxed text-stone-300">Explore how terrain and supply affect two balanced aggregate forces over 12 weeks.</p></div><div className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.04] p-3"><p className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-yellow-300"><Sparkles className="h-3 w-3" />Proposal ready</p><div className="mt-3 space-y-2">{["Temperate terrain", "Measured tempo", "12-week duration"].map(item => <div key={item} className="flex items-center justify-between rounded-lg bg-black/30 px-2 py-1.5 text-[9px] text-stone-400"><span>{item}</span><CheckCircle2 className="h-3 w-3 text-yellow-300" /></div>)}</div></div></div>
        <div className="relative min-h-[330px] overflow-hidden rounded-2xl border border-white/8 bg-[#060707] sm:min-h-[390px]"><div className="atlas-grid absolute inset-0 opacity-60" /><div className="absolute left-1/2 top-[44%] aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#090b0b] shadow-[0_0_60px_rgba(250,204,21,.08)]"><svg viewBox="0 0 100 100" className="h-full w-full"><defs><clipPath id="heroGlobe"><circle cx="50" cy="50" r="48" /></clipPath></defs><g clipPath="url(#heroGlobe)"><path d="M3 51h94M7 34h86M7 68h86M50 2v96" stroke="#273033" strokeWidth=".5" fill="none"/><ellipse cx="50" cy="50" rx="27" ry="48" stroke="#273033" strokeWidth=".5" fill="none"/><path d="M8 36l15-17 18 7-5 13-13 4-8 13-9-5zm38-17l21-9 19 12 8 18-14 7-12-5-10 9-17-12 3-10zm5 45l16-9 20 13-8 21-20 7-9-15z" fill="#202a2c" stroke="#657072" strokeWidth=".45"/><path d="M21 50Q48 31 77 54" fill="none" stroke="#facc15" strokeWidth=".7" strokeDasharray="2 2"/><circle cx="22" cy="50" r="2.2" fill="#facc15"/><circle cx="77" cy="54" r="2.2" fill="#d6d3d1"/></g><circle cx="50" cy="50" r="48" stroke="#4a5557" strokeWidth=".5" fill="none"/></svg></div><div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-1 rounded-xl border border-white/8 bg-[#090909]/90 p-2.5 backdrop-blur"><Metric value="56%" label="Side A" accent /><Metric value="W12" label="Frame" /><Metric value="44%" label="Side B" /></div><div className="absolute right-3 top-3 rounded-lg border border-white/8 bg-black/60 px-2 py-1.5 text-[8px] text-stone-500"><Waypoints className="mr-1 inline h-3 w-3 text-yellow-300" />Seed locked</div></div>
      </div>
    </div>
    <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-white/10 bg-[#101010] px-4 py-3 shadow-xl sm:block"><p className="text-[8px] uppercase tracking-wider text-stone-600">Confidence band</p><p className="mt-1 text-sm font-semibold text-yellow-200">Moderate · ±7%</p></div>
  </div>;
}

function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return <div className="text-center"><p className={`text-xs font-semibold ${accent ? "text-yellow-200" : "text-stone-300"}`}>{value}</p><p className="mt-0.5 text-[7px] uppercase tracking-wider text-stone-600">{label}</p></div>;
}

function DemoVisual({ step }: { step: number }) {
  if (step === 0) return <div className="rounded-[22px] border border-white/8 bg-black/30 p-4"><div className="rounded-2xl bg-white/[.04] p-3 text-[10px] leading-relaxed text-stone-400">Model a 12-week hypothetical with balanced aggregate forces and constrained supply.</div><div className="mt-3 ml-8 rounded-2xl border border-yellow-400/15 bg-yellow-400/[.05] p-3"><p className="text-[8px] uppercase tracking-wider text-yellow-300">Structured proposal</p><div className="mt-3 grid grid-cols-2 gap-2">{["Terrain · Temperate", "Tempo · Measured", "Duration · 12 weeks", "Uncertainty · Medium"].map(item => <span key={item} className="rounded-lg bg-black/30 px-2 py-2 text-[9px] text-stone-500">{item}</span>)}</div></div></div>;
  if (step === 1) return <div className="rounded-[22px] border border-white/8 bg-black/30 p-4"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-wider text-stone-600">Simulation progress</span><span className="text-xs font-medium text-yellow-200">W12 / 12</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-full rounded-full bg-yellow-400" /></div><div className="mt-5 grid grid-cols-3 gap-2">{[["240", "samples"], ["0.3", "model"], ["1", "fixed seed"]].map(([value, label]) => <div key={label} className="rounded-xl border border-white/8 p-3 text-center"><p className="text-base font-semibold text-stone-200">{value}</p><p className="mt-1 text-[7px] uppercase tracking-wider text-stone-600">{label}</p></div>)}</div></div>;
  return <div className="rounded-[22px] border border-white/8 bg-black/30 p-4"><div className="flex h-28 items-end gap-1.5">{[42, 55, 48, 63, 58, 70, 66, 76, 72, 81, 78, 86].map((height, index) => <div key={index} className="flex-1 rounded-t-md bg-yellow-400/70" style={{ height: `${height}%` }} />)}</div><div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3"><div><p className="text-[8px] uppercase tracking-wider text-stone-600">Modeled advantage</p><p className="mt-1 text-sm font-semibold text-yellow-200">Side A · moderate</p></div><BookOpen className="h-4 w-4 text-stone-600" /></div></div>;
}

function StudyCard({ study }: { study: PublicStudy }) {
  return <Link to={`/share/${study.share_token}`} className="group flex min-h-52 flex-col rounded-[24px] border border-white/8 bg-white/[.025] p-5 transition-colors hover:border-yellow-400/25 hover:bg-yellow-400/[.025] sm:p-6"><div className="flex items-center justify-between"><span className="rounded-lg border border-white/8 bg-black/30 px-2 py-1 text-[8px] uppercase tracking-wider text-stone-500">Read-only study</span><ChevronRight className="h-4 w-4 text-stone-700 transition-transform group-hover:translate-x-1 group-hover:text-yellow-300" /></div><h3 className="mt-7 text-lg font-medium tracking-tight text-stone-200">{study.name}</h3><p className="mt-2 text-xs text-stone-600">{study.region_label}</p><div className="mt-auto flex items-end justify-between pt-6"><div><p className="text-[8px] uppercase tracking-wider text-stone-700">Modeled advantage</p><p className="mt-1 text-xs text-yellow-200">Side {study.latest_result?.advantage ?? "—"}</p></div><p className="text-[9px] text-stone-700">{new Date(study.updated_at).toLocaleDateString()}</p></div></Link>;
}

function EmptyStudies() {
  return <div className="col-span-full flex min-h-52 flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[.015] p-8 text-center"><BookOpen className="h-6 w-6 text-yellow-300" /><p className="mt-4 text-sm text-stone-300">Public studies are being prepared.</p><p className="mt-2 max-w-sm text-xs leading-relaxed text-stone-600">Complete and share a study in the laboratory to make the first preserved report available here.</p></div>;
}
