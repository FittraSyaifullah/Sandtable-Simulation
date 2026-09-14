import { useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, ChevronRight, FlaskConical, Globe2, Menu, Play, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScenarioPanel } from "@/components/ScenarioPanel";
import { ResultsSheet } from "@/components/ResultsSheet";
import { CalibrationCase, MethodDialog } from "@/components/MethodDialog";
import { HistoricalRun, SavedStudy, StudyLibrary } from "@/components/StudyLibrary";
import { WorldCanvas } from "@/components/WorldCanvas";
import { supabase } from "@/integrations/supabase/client";
import { defaultScenario, fallbackNations, Nation, ScenarioConfig, SimulationResult } from "@/lib/sandtable";
import { runSimulation } from "@/lib/simulation";

type Proposal = { title: string; summary: string; objective: string; terrain: ScenarioConfig["terrain"]; tempo: ScenarioConfig["tempo"]; duration: number; uncertainty: number; formations?: { sideA: ScenarioConfig["sideA"]["formations"]; sideB: ScenarioConfig["sideB"]["formations"] }; assumptions: string[]; alternatives: string[]; safetyNotice: string };

export default function Index() {
  const navigate = useNavigate();
  const [nations, setNations] = useState<Nation[]>(fallbackNations);
  const [config, setConfig] = useState<ScenarioConfig>(defaultScenario);
  const [result, setResult] = useState<SimulationResult>();
  const [week, setWeek] = useState(0);
  const [setupOpen, setSetupOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(() => sessionStorage.getItem("sandtable-intro") !== "dismissed");
  const [proposal, setProposal] = useState<Proposal>();
  const [proposalLoading, setProposalLoading] = useState(false);
  const [comparison, setComparison] = useState<{ label: string; result: SimulationResult }>();
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedStudy[]>([]);
  const [calibrationCases, setCalibrationCases] = useState<CalibrationCase[]>([]);
  const [scenarioId, setScenarioId] = useState<string>();
  const activeFrame = result?.frames[Math.min(week, result.frames.length - 1)];
  const activeDataset = useMemo(() => nations[0]?.dataset_version ?? "local fallback", [nations]);

  useEffect(() => {
    supabase.from("nations").select("*").order("name").then(({ data, error }) => {
      if (data?.length) setNations(data as Nation[]);
      if (error) toast.info("Using governed local reference data", { description: "The Supabase reference query was unavailable." });
    });
    supabase.from("calibration_cases").select("*").eq("lifecycle_status","active").then(({ data }) => setCalibrationCases((data ?? []) as CalibrationCase[]));
  }, []);

  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      const next = runSimulation(config, nations);
      setResult(next); setComparison(undefined); setWeek(config.duration); setRunning(false); setSetupOpen(false); setScenarioId(undefined);
      toast.success("Simulation resolved", { description: "Canonical replay and 240-sample range are ready." });
    }, 420);
  };

  const runSensitivity = (kind: "tempo" | "supply" | "uncertainty") => {
    const labels = { tempo: "Lower tempo", supply: "Supply stress", uncertainty: "Higher uncertainty" };
    const adjusted: ScenarioConfig = kind === "tempo"
      ? { ...config, tempo: "measured", seed: `${config.seed}-TEMPO` }
      : kind === "supply"
        ? { ...config, seed: `${config.seed}-SUPPLY`, sideA: { ...config.sideA, supply: Math.max(20, config.sideA.supply - 20) }, sideB: { ...config.sideB, supply: Math.max(20, config.sideB.supply - 20) } }
        : { ...config, uncertainty: Math.min(90, config.uncertainty + 20), seed: `${config.seed}-UNCERTAINTY` };
    setComparison({ label: labels[kind], result: runSimulation(adjusted, nations) });
  };

  const saveStudy = async () => {
    if (!result) return;
    setSaving(true);
    try {
      let row: SavedStudy;
      if (scenarioId) {
        const { data, error } = await supabase.from("scenarios").update({ name: config.name, region_label: config.regionLabel, configuration: config, latest_result: result, status: "completed", updated_at: new Date().toISOString() }).eq("id", scenarioId).select().single();
        if (error) throw error; row = data as SavedStudy;
      } else {
        const { data, error } = await supabase.from("scenarios").insert({ workspace_id: "shared-demo", name: config.name, region_label: config.regionLabel, configuration: config, latest_result: result, status: "completed" }).select().single();
        if (error) throw error; row = data as SavedStudy; setScenarioId(row.id);
      }
      const { data: existing } = await supabase.from("simulation_runs").select("id").eq("run_key", result.runKey).maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("simulation_runs").insert({ scenario_id: row.id, run_key: result.runKey, seed: result.seed, model_version: result.modelVersion, dataset_version: result.datasetVersion, configuration: config, result, event_log: result.events });
        if (error) throw error;
      }
      toast.success("Study saved", { description: "Configuration and immutable run record preserved." });
      return row;
    } catch (error) {
      toast.error("Study could not be saved", { description: error instanceof Error ? error.message : "Database unavailable." });
    } finally { setSaving(false); }
  };

  const share = async () => {
    const row = scenarioId ? (await supabase.from("scenarios").select("*").eq("id", scenarioId).single()).data as SavedStudy : await saveStudy();
    if (row?.share_token) navigate(`/share/${row.share_token}`);
  };

  const loadLibrary = async () => {
    const { data, error } = await supabase.from("scenarios").select("id,name,region_label,configuration,latest_result,share_token,updated_at,simulation_runs(*)").eq("workspace_id", "shared-demo").order("updated_at", { ascending: false });
    if (error) toast.error("Saved studies are unavailable");
    else setSaved((data ?? []).map(item => ({ ...item, simulation_runs: [...(item.simulation_runs ?? [])].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) })) as SavedStudy[]);
    setLibraryOpen(true);
  };

  const openSaved = (item: SavedStudy) => {
    setConfig(item.configuration); setResult(item.latest_result ?? undefined); setComparison(undefined); setWeek(item.latest_result?.frames.length ? item.latest_result.frames.length - 1 : 0); setScenarioId(item.id); setLibraryOpen(false); setSetupOpen(!item.latest_result);
  };

  const openHistoricalRun = (study: SavedStudy, run: HistoricalRun) => {
    setConfig(run.configuration); setResult(run.result); setComparison(undefined); setWeek(run.result.frames.length - 1); setScenarioId(study.id); setLibraryOpen(false); setSetupOpen(false);
    toast.info("Historical run reopened", { description: "The immutable configuration and result are now active." });
  };

  const compareHistoricalRun = (run: HistoricalRun) => {
    setComparison({ label: `Historical baseline · ${new Date(run.created_at).toLocaleDateString()}`, result: run.result });
    setLibraryOpen(false);
    toast.success("Historical baseline attached", { description: "Open Sensitivity to inspect the comparison." });
  };

  const removeSaved = async (item: SavedStudy) => {
    const { error } = await supabase.from("scenarios").delete().eq("id", item.id);
    if (error) toast.error("Study could not be deleted"); else { setSaved(current => current.filter(row => row.id !== item.id)); toast.success("Study deleted"); }
  };

  const requestProposal = async (prompt: string) => {
    setProposalLoading(true);
    const { data, error } = await supabase.functions.invoke("scenario-draft", { body: { prompt } });
    setProposalLoading(false);
    if (error || data?.error) toast.error("Proposal rejected", { description: data?.error ?? error?.message });
    else setProposal(data as Proposal);
  };

  const applyProposal = () => {
    if (!proposal) return;
    setConfig(current => ({ ...current, name: proposal.title, objective: proposal.objective, terrain: proposal.terrain, tempo: proposal.tempo, duration: proposal.duration, uncertainty: proposal.uncertainty, sideA: { ...current.sideA, formations: proposal.formations?.sideA ?? current.sideA.formations }, sideB: { ...current.sideB, formations: proposal.formations?.sideB ?? current.sideB.formations } }));
    setProposal(undefined); toast.success("Proposal applied for review", { description: "Settings and aggregate formations are ready for review; no simulation has run." });
  };

  return <main className="relative h-[100dvh] min-h-[620px] overflow-hidden bg-[#050505] text-stone-100">
    <WorldCanvas config={config} nations={nations} frame={activeFrame} events={result?.events} week={week}/>
    <header className="absolute inset-x-0 top-0 z-30 flex h-[72px] items-center gap-3 border-b border-white/8 bg-[#050505]/72 px-3 backdrop-blur-xl md:px-5">
      <button onClick={() => setSetupOpen(true)} className="flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"><span className="grid h-10 w-10 place-items-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10"><Globe2 className="h-5 w-5 text-yellow-300"/></span><span className="text-left"><span className="block text-[15px] font-semibold tracking-tight">Sandtable</span><span className="hidden text-[9px] uppercase tracking-[.2em] text-stone-500 sm:block">Scenario laboratory</span></span></button>
      <div className="mx-1 h-7 w-px bg-white/10"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-stone-300">{config.name}</p><p className="truncate text-[10px] text-stone-600">{config.regionLabel}</p></div>
      <div className="hidden items-center gap-1 md:flex"><NavButton icon={FlaskConical} label="Scenario" onClick={()=>setSetupOpen(true)}/><NavButton icon={Archive} label="Studies" onClick={loadLibrary}/><NavButton icon={BookOpen} label="Method" onClick={()=>setMethodOpen(true)}/></div>
      <div className="hidden rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] px-3 py-2 text-[10px] text-emerald-300 lg:block"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"/>Model ready · v0.3</div>
      <Button onClick={()=>setSetupOpen(true)} size="icon" variant="ghost" className="rounded-xl text-stone-400 md:hidden" aria-label="Open menu"><Menu className="h-5 w-5"/></Button>
    </header>

    {!result && !setupOpen && <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2"><Button onClick={()=>setSetupOpen(true)} className="h-12 rounded-2xl bg-yellow-400 px-5 text-[#181500] hover:bg-yellow-300"><Play className="mr-2 h-4 w-4"/>Configure study</Button></div>}
    <ScenarioPanel open={setupOpen} onClose={()=>setSetupOpen(false)} config={config} setConfig={setConfig} nations={nations} onRun={run} onAi={requestProposal} running={running}/>
    {result && <ResultsSheet result={result} config={config} week={week} setWeek={setWeek} onSave={saveStudy} onShare={share} onSensitivity={runSensitivity} comparison={comparison} saving={saving}/>}

    <Dialog open={introOpen} onOpenChange={setIntroOpen}><DialogContent className="max-w-xl overflow-hidden rounded-[28px] border-white/10 bg-[#0c0c0c] p-0 text-stone-100"><div className="relative h-48 overflow-hidden border-b border-white/8 bg-[#070707]"><div className="atlas-grid absolute inset-0 opacity-50"/><div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-yellow-400/30 bg-yellow-400/[.06]"><Globe2 className="h-10 w-10 text-yellow-300"/></div><div className="absolute bottom-4 left-5 rounded-full border border-white/10 bg-[#0b0b0b] px-3 py-1 text-[9px] uppercase tracking-[.18em] text-stone-400">Inputs → seeded frames → ranges</div></div><div className="p-6"><DialogHeader><DialogTitle className="text-2xl tracking-tight">Explore assumptions, not predictions.</DialogTitle><DialogDescription className="mt-2 leading-relaxed text-stone-400">Sandtable is an educational laboratory for inspecting how aggregate capabilities, terrain, tempo, supply, and uncertainty interact in a simplified deterministic model.</DialogDescription></DialogHeader><div className="mt-5 grid gap-2 sm:grid-cols-3">{[[ShieldCheck,"Non-operational"],[Save,"Reproducible"],[Sparkles,"Reviewable AI"]].map(([Icon,label])=><div key={label as string} className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><Icon className="h-4 w-4 text-yellow-300"/><p className="mt-2 text-xs text-stone-300">{label as string}</p></div>)}</div><Button onClick={()=>{sessionStorage.setItem("sandtable-intro","dismissed");setIntroOpen(false)}} className="mt-5 h-11 w-full rounded-2xl bg-yellow-400 text-[#181500] hover:bg-yellow-300">Enter the laboratory<ChevronRight className="ml-2 h-4 w-4"/></Button></div></DialogContent></Dialog>

    <Dialog open={!!proposal || proposalLoading} onOpenChange={open=>!open&&setProposal(undefined)}><DialogContent className="max-w-2xl rounded-[28px] border-white/10 bg-[#0c0c0c] text-stone-100"><DialogHeader><DialogTitle>{proposalLoading?"Drafting a constrained proposal…":proposal?.title}</DialogTitle><DialogDescription className="text-stone-400">AI output never runs automatically. Review and explicitly apply it.</DialogDescription></DialogHeader>{proposalLoading?<div className="h-44 animate-pulse rounded-2xl bg-white/[.04]"/>:proposal&&<div><p className="rounded-2xl border border-white/8 bg-white/[.025] p-4 text-sm leading-relaxed text-stone-300">{proposal.summary}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><ProposalCell label="Objective" value={proposal.objective}/><ProposalCell label="Configuration" value={`${proposal.terrain} terrain · ${proposal.tempo} tempo · ${proposal.duration} weeks`}/></div><div className="mt-4"><p className="text-[10px] uppercase tracking-[.18em] text-stone-500">Sensitivity alternatives</p><ul className="mt-2 space-y-1 text-xs text-stone-400">{proposal.alternatives.map(item=><li key={item}>• {item}</li>)}</ul></div><p className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/[.06] p-3 text-xs text-yellow-100">{proposal.safetyNotice}</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={()=>setProposal(undefined)} className="rounded-xl">Discard</Button><Button onClick={applyProposal} className="rounded-xl bg-yellow-400 text-[#181500] hover:bg-yellow-300">Apply for review</Button></div></div>}</DialogContent></Dialog>

    <StudyLibrary open={libraryOpen} onOpenChange={setLibraryOpen} studies={saved} hasActiveResult={!!result} onOpenStudy={openSaved} onOpenRun={openHistoricalRun} onCompareRun={compareHistoricalRun} onDelete={removeSaved}/>

    <MethodDialog open={methodOpen} onOpenChange={setMethodOpen} activeDataset={activeDataset} calibrationCases={calibrationCases}/>
  </main>;
}

function NavButton({icon:Icon,label,onClick}:{icon:typeof FlaskConical;label:string;onClick:()=>void}) { return <Button onClick={onClick} variant="ghost" className="h-10 rounded-xl px-3 text-xs text-stone-400 hover:bg-white/5 hover:text-stone-100"><Icon className="mr-2 h-4 w-4"/>{label}</Button> }
function ProposalCell({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="text-[10px] uppercase tracking-[.18em] text-stone-500">{label}</p><p className="mt-2 text-sm text-stone-200">{value}</p></div> }
