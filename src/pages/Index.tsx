import { useEffect, useState } from "react";
import { Globe2, Radio, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormationSelection, MapboxStatus, MapboxWorld } from "@/components/MapboxWorld";
import { ScenarioLauncher } from "@/components/ScenarioLauncher";
import { SimulationHUD } from "@/components/SimulationHUD";
import { UserMenu } from "@/components/UserMenu";
import { supabase } from "@/integrations/supabase/client";
import { buildTurnObservations } from "@/lib/agents";
import { AgentTurn, AssetPool, DATASET_VERSION, defaultScenario, fallbackNations, MODEL_VERSION, Nation, ScenarioConfig, SimulationResult } from "@/lib/sandtable";
import { runSimulation } from "@/lib/simulation";

const RUN_DURATION=12;

function scenarioName(prompt:string){const words=prompt.trim().replace(/[^a-zA-Z0-9\s-]/g,"").split(/\s+/).slice(0,7).join(" ");return words||"Untitled simulation";}
function seedFor(prompt:string,codes:string[]){let hash=2166136261;for(const character of `${prompt}:${codes.join(":")}`){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}return `ST-${(hash>>>0).toString(16).toUpperCase().padStart(8,"0")}`;}
function terrainFor(prompt:string):ScenarioConfig["terrain"]{if(/sea|ocean|maritime|island|shipping|strait/i.test(prompt))return"maritime";if(/mountain|urban|city|forest|restricted/i.test(prompt))return"restricted";return"mixed";}

export default function Index(){
  const [nations,setNations]=useState<Nation[]>(fallbackNations);
  const [assetPools,setAssetPools]=useState<AssetPool[]>([]);
  const [prompt,setPrompt]=useState("");
  const [selectedCodes,setSelectedCodes]=useState<string[]>([]);
  const [config,setConfig]=useState<ScenarioConfig>(defaultScenario);
  const [result,setResult]=useState<SimulationResult>();
  const [week,setWeek]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [launcherOpen,setLauncherOpen]=useState(true);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState({current:0,total:RUN_DURATION});
  const [mapStatus,setMapStatus]=useState<MapboxStatus>("loading");
  const [selectedFormation,setSelectedFormation]=useState<FormationSelection>();

  useEffect(()=>{
    supabase.from("nations").select("*").order("name").then(({data})=>{if(data?.length)setNations(data as Nation[]);});
    supabase.from("asset_pools").select("*").eq("review_status","approved").then(({data})=>{if(data?.length)setAssetPools(data as AssetPool[]);});
  },[]);

  useEffect(()=>{
    if(!playing||!result)return;
    if(week>=result.frames.length-1){setPlaying(false);return;}
    const timer=window.setTimeout(()=>setWeek(current=>Math.min(current+1,result.frames.length-1)),Math.max(180,850/speed));
    return()=>window.clearTimeout(timer);
  },[playing,result,speed,week]);

  const toggleNation=(code:string)=>setSelectedCodes(current=>current.includes(code)?current.filter(item=>item!==code):current.length<2?[...current,code]:[current[1],code]);

  const start=async()=>{
    const nationA=nations.find(nation=>nation.code===selectedCodes[0]);
    const nationB=nations.find(nation=>nation.code===selectedCodes[1]);
    if(!nationA||!nationB||prompt.trim().length<24){toast.error("Describe a scenario and choose two countries");return;}
    const nextConfig:ScenarioConfig={
      ...defaultScenario,
      name:scenarioName(prompt),
      regionLabel:"Synthetic global theatre",
      objective:prompt.trim(),
      terrain:terrainFor(prompt),
      duration:RUN_DURATION,
      uncertainty:45,
      seed:seedFor(prompt,selectedCodes),
      sideA:{...defaultScenario.sideA,nationCode:nationA.code,posture:"balanced"},
      sideB:{...defaultScenario.sideB,nationCode:nationB.code,posture:"balanced"},
    };
    setConfig(nextConfig);setRunning(true);setProgress({current:0,total:RUN_DURATION});setPlaying(false);setSelectedFormation(undefined);
    const profile=(nation:Nation)=>({code:nation.code,name:nation.name,budget:nation.budget_usd_bn,gdp:nation.gdp_usd_bn,population:nation.population_m,personnel:nation.personnel_k,readiness:nation.readiness_index,datasetVersion:nation.dataset_version,asOfDate:nation.as_of_date});
    try{
      const poolResponse=await supabase.from("asset_pools").select("*").eq("review_status","approved").in("nation_code",[nationA.code,nationB.code]);
      const runPools=poolResponse.data?.length?poolResponse.data as AssetPool[]:assetPools;
      if(poolResponse.data?.length)setAssetPools(current=>[...current.filter(pool=>pool.nation_code!==nationA.code&&pool.nation_code!==nationB.code),...(poolResponse.data as AssetPool[])]);
      if(poolResponse.error)toast.warning("Using governed fallback pools",{description:"The approved asset query was unavailable."});

      const sessionKey=crypto.randomUUID();
      let sessionId:string|undefined;
      let turns:AgentTurn[]=[];
      let adjudicated=runSimulation(nextConfig,nations,turns,runPools);
      const scenario={name:nextConfig.name,seed:nextConfig.seed,modelVersion:MODEL_VERSION,datasetVersion:DATASET_VERSION,assetDatasetVersion:adjudicated.assetDatasetVersion??"asset-pools-unavailable",configuration:nextConfig};

      for(let turnWeek=1;turnWeek<=RUN_DURATION;turnWeek+=1){
        setProgress({current:turnWeek,total:RUN_DURATION});
        const observations=buildTurnObservations(adjudicated,turnWeek,nextConfig.uncertainty,turns.at(-1));
        const decision=await supabase.functions.invoke("conflict-agents",{body:{sessionKey,sessionId,week:turnWeek,duration:RUN_DURATION,objective:nextConfig.objective,scenario,sideA:{profile:profile(nationA),observation:observations.observationA},sideB:{profile:profile(nationB),observation:observations.observationB}}});
        if(decision.error||decision.data?.error||!decision.data?.turn?.id||!decision.data?.sessionId)throw new Error(decision.data?.error??decision.error?.message??`Turn ${turnWeek} could not be committed.`);
        sessionId=decision.data.sessionId as string;
        const committed=decision.data.turn as AgentTurn;
        adjudicated=runSimulation(nextConfig,nations,[...turns,committed],runPools);
        const resultingFrame=adjudicated.frames[turnWeek];
        const freeze=await supabase.functions.invoke("agent-turn-freeze",{body:{sessionId,turnId:committed.id,resultingFrame}});
        if(freeze.error||freeze.data?.error||!freeze.data?.outcome)throw new Error(freeze.data?.error??freeze.error?.message??`Turn ${turnWeek} could not be frozen.`);
        turns=[...turns,{...committed,resultingFrame,outcomeHash:freeze.data.outcome.frameHash,frozenAt:freeze.data.outcome.frozenAt}];
      }

      const completed=runSimulation(nextConfig,nations,turns,runPools);
      setResult({...completed,agentSessionId:sessionId});setWeek(0);setLauncherOpen(false);setPlaying(true);
      toast.success("Simulation ready",{description:"Press pause or scrub the timeline at any time."});
    }catch(error){toast.error("Simulation stopped",{description:error instanceof Error?error.message:"The adaptive agents could not finish."});}
    finally{setRunning(false);setProgress({current:0,total:RUN_DURATION});}
  };

  const newScenario=()=>{setPlaying(false);setWeek(0);setResult(undefined);setPrompt("");setSelectedCodes([]);setLauncherOpen(true);setSelectedFormation(undefined);};
  const nationA=nations.find(nation=>nation.code===config.sideA.nationCode);
  const nationB=nations.find(nation=>nation.code===config.sideB.nationCode);
  const frame=result?.frames[Math.min(week,result.frames.length-1)];

  return <main className="relative h-[100dvh] overflow-hidden bg-[#07111f] text-stone-100">
    <MapboxWorld sideA={nationA} sideB={nationB} config={config} frame={frame} capabilities={result?.domainCapabilities} onSelect={setSelectedFormation} onStatusChange={setMapStatus}/>
    <div className="pointer-events-none absolute inset-0 atlas-grid opacity-15"/>

    <header className="absolute inset-x-0 top-0 z-50 flex h-16 items-center gap-3 border-b border-white/8 bg-[#07111f]/88 px-3 backdrop-blur-xl sm:px-5">
      <button onClick={result?newScenario:()=>setLauncherOpen(true)} className="flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-300"><span className="grid h-10 w-10 place-items-center rounded-2xl border border-yellow-300/25 bg-yellow-300/10"><Globe2 className="h-5 w-5 text-yellow-300"/></span><span className="hidden text-left sm:block"><span className="block text-sm font-semibold tracking-tight">Sandtable</span><span className="block text-[8px] uppercase tracking-[.2em] text-slate-600">AI conflict simulation</span></span></button>
      {result&&<div className="min-w-0 flex-1 border-l border-white/8 pl-3"><p className="truncate text-xs font-medium text-slate-200">{config.name}</p><p className="mt-0.5 truncate text-[9px] uppercase tracking-[.14em] text-slate-600">{nationA?.name} · {nationB?.name}</p></div>}
      {!result&&<div className="flex-1"/>}
      <div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] sm:flex ${mapStatus==="ready"?"border-cyan-300/20 bg-cyan-300/[.06] text-cyan-200":"border-yellow-300/20 bg-yellow-300/[.06] text-yellow-200"}`}><Radio className="h-3 w-3"/>{mapStatus==="ready"?"MAPBOX ONLINE":"LOCAL MAP"}</div>
      {result&&<Button onClick={newScenario} variant="ghost" className="h-10 rounded-xl px-3 text-xs text-slate-400 hover:bg-white/5 hover:text-white"><RotateCcw className="h-4 w-4 sm:mr-2"/><span className="hidden sm:inline">New scenario</span></Button>}
      <UserMenu/>
    </header>

    <ScenarioLauncher visible={launcherOpen} prompt={prompt} onPromptChange={setPrompt} nations={nations} selectedCodes={selectedCodes} onToggleNation={toggleNation} onStart={start} running={running} progress={progress}/>
    {result&&<SimulationHUD result={result} config={config} nationA={nationA} nationB={nationB} week={week} playing={playing} speed={speed} selected={selectedFormation} onWeekChange={value=>{setPlaying(false);setWeek(value);}} onTogglePlay={()=>setPlaying(value=>!value)} onSpeedChange={setSpeed} onCloseSelection={()=>setSelectedFormation(undefined)} onNewScenario={newScenario}/>} 
  </main>;
}
