import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const blocked = /target(?:ing)?|strike|weapon|munition|real[- ]?time|live unit|troop location|attack route|infiltrat|evad(?:e|ing)|air defense suppression|kill chain|operational recommendation|named facilit(?:y|ies)/i;
const stances = ["hold", "cautious", "balanced", "press"] as const;
const priorities = ["logistics", "readiness", "resilience", "diplomacy"] as const;
const objectiveStates = ["advantage", "disadvantage", "contested"] as const;
const model = "gpt-4o-mini";

type NationInput = { code:string; name:string; budget:number; gdp:number; population:number; personnel:number; readiness:number; datasetVersion:string; asOfDate:string };
type Observation = { week:number; ownStrength:number; ownSupply:number; objectiveState:typeof objectiveStates[number]; observedOpponentStrength:number; observedOpponentSupply:number; ownDomains:{land:number;air:number;maritime:number;support:number}; uncertainty:number; previousDecision?:{stance:typeof stances[number];priority:typeof priorities[number]} };
type Decision = { stance:typeof stances[number]; priority:typeof priorities[number]; rationale:string; expectedEffect:string; confidence:number };
type SideInput = { profile:NationInput; observation:Observation };
type ScenarioInput = { name:string; seed:string; modelVersion:string; datasetVersion:string; assetDatasetVersion:string; configuration:Record<string,unknown> };
type GeneratedDecision = { decision:Decision; mode:"openai"|"deterministic_fallback"; modelName:string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Agent service unavailable." }, 500);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(authHeader.slice(7));
    if (authError || !authData.user) return json({ error: "Invalid session." }, 401);

    const body = await req.json();
    const objective = text(body?.objective, 500);
    const duration = boundedInteger(body?.duration, 4, 24);
    const week = boundedInteger(body?.week, 1, 24);
    const sessionKey = text(body?.sessionKey, 40);
    const requestedSessionId = text(body?.sessionId, 40);
    const sideA = side(body?.sideA);
    const sideB = side(body?.sideB);
    const scenario = scenarioInput(body?.scenario);
    if (!objective || !duration || !week || week > duration || !isUuid(sessionKey) || (requestedSessionId && !isUuid(requestedSessionId)) || !sideA || !sideB || !scenario) {
      return json({ error: "A valid session, scenario, turn number, two national profiles, and two aggregate observations are required." }, 400);
    }
    if (!scenarioMatches(scenario, objective, duration, sideA.profile.code, sideB.profile.code)) return json({ error:"National profiles and turn settings must match the frozen scenario configuration." },409);
    if (sideA.observation.week !== week || sideB.observation.week !== week) return json({ error: "Observation weeks must match the requested turn." }, 400);
    if (blocked.test(objective)) return json({ error: "Use a strategic or resilience objective without targeting, weapons, live locations, or operational routes." }, 400);

    const configurationHash = await sha256(JSON.stringify(scenario));
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const grounded = await governedSides(admin, sideA, sideB, scenario.datasetVersion);
    if (!grounded) return json({ error: "Both sides must use profiles from the governed dataset version." }, 400);
    const session = await resolveSession(admin, { requestedSessionId, sessionKey, userId: authData.user.id, objective, scenario, configurationHash, firstTurn: week === 1 });
    if (!session) return json({ error: requestedSessionId ? "The adaptive run session is unavailable or does not belong to this user." : "A new adaptive session must begin with turn one." }, 403);
    if (session.objective !== objective || session.seed !== scenario.seed || session.configuration_hash !== configurationHash) return json({ error: "Turn metadata does not match the frozen adaptive session." }, 409);

    const inputHash = await sha256(JSON.stringify({ sessionId: session.id, week, objective, sideA:grounded.sideA, sideB:grounded.sideB }));
    const { data: existing } = await admin.from("agent_turns").select("*").eq("session_id", session.id).eq("week", week).maybeSingle();
    if (existing) {
      if (existing.input_hash !== inputHash) return json({ error: "This turn was already committed from a different observation." }, 409);
      console.info("[conflict-agents] Returning previously frozen adaptive turn", { sessionId: session.id, week, userId: authData.user.id });
      return json(responseBody(existing, session.id, true), 200);
    }
    if (week > 1) {
      const { data: prior } = await admin.from("agent_turns").select("id").eq("session_id", session.id).eq("week", week - 1).maybeSingle();
      if (!prior) return json({ error: "The previous adaptive turn must be committed before this turn can begin." }, 409);
      const { data: priorOutcome } = await admin.from("agent_turn_outcomes").select("id").eq("turn_id", prior.id).maybeSingle();
      if (!priorOutcome) return json({ error: "The previous deterministic adjudication must be frozen before this turn can begin." }, 409);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const [generatedA, generatedB] = await Promise.all([
      generateDecision("Side A", grounded.sideA, grounded.sideB.profile.name, objective, apiKey),
      generateDecision("Side B", grounded.sideB, grounded.sideA.profile.name, objective, apiKey),
    ]);
    const assessment = `Turn ${week} committed simultaneously from independent aggregate observations. ${grounded.sideA.profile.name} prioritized ${generatedA.decision.priority}; ${grounded.sideB.profile.name} prioritized ${generatedB.decision.priority}.`;
    const row = {
      session_id: session.id,
      week,
      observation_a: grounded.sideA.observation,
      observation_b: grounded.sideB.observation,
      decision_a: generatedA.decision,
      decision_b: generatedB.decision,
      assessment,
      input_hash: inputHash,
      model_a: generatedA.modelName,
      model_b: generatedB.modelName,
      mode_a: generatedA.mode,
      mode_b: generatedB.mode,
    };
    const { data: committed, error: insertError } = await admin.from("agent_turns").insert(row).select("*").single();
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: raced } = await admin.from("agent_turns").select("*").eq("session_id", session.id).eq("week", week).maybeSingle();
        if (raced?.input_hash === inputHash) return json(responseBody(raced, session.id, true), 200);
      }
      throw insertError;
    }

    console.info("[conflict-agents] Adaptive turn committed", { sessionId: session.id, week, userId: authData.user.id, modeA: generatedA.mode, modeB: generatedB.mode });
    return json(responseBody(committed, session.id, false), 201);
  } catch (error) {
    console.error("[conflict-agents] Adaptive turn failed", { error: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "The adaptive national-agent turn could not be committed." }, 500);
  }
});

async function governedSides(admin: ReturnType<typeof createClient>, requestedA:SideInput, requestedB:SideInput, datasetVersion:string) {
  const { data, error } = await admin.from("nations").select("code,name,budget_usd_bn,gdp_usd_bn,population_m,personnel_k,readiness_index,dataset_version,as_of_date").in("code", [requestedA.profile.code, requestedB.profile.code]);
  if (error || !data || data.length !== 2) return null;
  const profile = (code:string):NationInput|null => {
    const row = data.find(item=>item.code===code);
    if (!row || row.dataset_version !== datasetVersion) return null;
    return { code:row.code, name:row.name, budget:Number(row.budget_usd_bn), gdp:Number(row.gdp_usd_bn), population:Number(row.population_m), personnel:Number(row.personnel_k), readiness:Number(row.readiness_index), datasetVersion:row.dataset_version, asOfDate:row.as_of_date };
  };
  const profileA=profile(requestedA.profile.code); const profileB=profile(requestedB.profile.code);
  return profileA&&profileB?{ sideA:{profile:profileA,observation:requestedA.observation}, sideB:{profile:profileB,observation:requestedB.observation} }:null;
}

async function resolveSession(admin: ReturnType<typeof createClient>, input:{requestedSessionId:string;sessionKey:string;userId:string;objective:string;scenario:ScenarioInput;configurationHash:string;firstTurn:boolean}) {
  const fields = "id,user_id,session_key,objective,seed,configuration_hash";
  if (input.requestedSessionId) {
    const { data } = await admin.from("agent_run_sessions").select(fields).eq("id", input.requestedSessionId).maybeSingle();
    return data?.user_id === input.userId && data.session_key === input.sessionKey ? data : null;
  }
  const { data: existing } = await admin.from("agent_run_sessions").select(fields).eq("user_id", input.userId).eq("session_key", input.sessionKey).maybeSingle();
  if (existing) return existing;
  if (!input.firstTurn) return null;
  const { data, error } = await admin.from("agent_run_sessions").insert({ session_key:input.sessionKey, user_id:input.userId, scenario_name:input.scenario.name, objective:input.objective, seed:input.scenario.seed, model_version:input.scenario.modelVersion, dataset_version:input.scenario.datasetVersion, asset_dataset_version:input.scenario.assetDatasetVersion, configuration:input.scenario.configuration, configuration_hash:input.configurationHash }).select(fields).single();
  if (!error) return data;
  if (error.code === "23505") {
    const { data: raced } = await admin.from("agent_run_sessions").select(fields).eq("user_id", input.userId).eq("session_key", input.sessionKey).maybeSingle();
    return raced ?? null;
  }
  throw error;
}

async function generateDecision(role:string, self:SideInput, opponentName:string, objective:string, apiKey:string):Promise<GeneratedDecision> {
  const fallback = guidedDecision(self);
  if (!apiKey) return { decision:fallback, mode:"deterministic_fallback", modelName:"bounded-rule-v1" };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json" },
      body:JSON.stringify({
        model,
        temperature:.25,
        messages:[
          { role:"system", content:`You are ${role}, a bounded national-level decision agent in an educational future-conflict simulation. Make exactly one decision from only your supplied aggregate observation and governed public national profile. You cannot see the opposing agent's current decision. Choose one stance and one priority. Explain strategic trade-offs without inventing facts. Never provide targets, strikes, weapons employment, routes, live intelligence, real-unit locations, named facility vulnerabilities, evasion, or operational recommendations. Do not claim prediction. Return only the required JSON.` },
          { role:"user", content:JSON.stringify({ objective, self:self.profile, observedOpponentName:opponentName, observation:self.observation, instruction:"Choose a bounded aggregate decision for this turn only." }) },
        ],
        response_format:{ type:"json_schema", json_schema:{ name:"bounded_turn_decision", strict:true, schema:decisionSchema() } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    const decision = sanitizeDecision(parsed);
    if (!decision || blocked.test(`${decision.rationale} ${decision.expectedEffect}`)) throw new Error("Unsafe or invalid decision output");
    return { decision, mode:"openai", modelName:model };
  } catch (error) {
    console.warn("[conflict-agents] Independent agent used deterministic fallback", { role, error:error instanceof Error?error.message:"Unknown error" });
    return { decision:fallback, mode:"deterministic_fallback", modelName:"bounded-rule-v1" };
  }
}

function guidedDecision(input:SideInput):Decision {
  const observation = input.observation;
  const pressure = observation.ownSupply < 48 || observation.ownStrength < observation.observedOpponentStrength - 8;
  const stable = observation.ownSupply > 68 && observation.ownStrength >= observation.observedOpponentStrength;
  const priority:Decision["priority"] = observation.ownSupply < 52 ? "logistics" : observation.ownStrength < 62 ? "readiness" : observation.objectiveState === "disadvantage" ? "diplomacy" : "resilience";
  const stance:Decision["stance"] = pressure ? "cautious" : stable && observation.objectiveState !== "advantage" ? "press" : observation.objectiveState === "advantage" ? "hold" : "balanced";
  return { stance, priority, rationale:`${input.profile.name} balances its observed aggregate strength, supply, and objective position while limiting strategic risk.`, expectedEffect:`Preserve aggregate capacity while emphasizing ${priority} through the next strategic interval.`, confidence:Math.max(.35, Math.min(.82, 1 - observation.uncertainty / 140)) };
}

function decisionSchema() {
  return { type:"object", additionalProperties:false, required:["stance","priority","rationale","expectedEffect","confidence"], properties:{ stance:{type:"string",enum:[...stances]}, priority:{type:"string",enum:[...priorities]}, rationale:{type:"string",maxLength:220}, expectedEffect:{type:"string",maxLength:180}, confidence:{type:"number",minimum:0,maximum:1} } };
}

function sanitizeDecision(value:unknown):Decision|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const stance=String(item.stance) as Decision["stance"];
  const priority=String(item.priority) as Decision["priority"];
  const rationale=text(item.rationale,220);
  const expectedEffect=text(item.expectedEffect,180);
  const confidence=Number(item.confidence);
  return stances.includes(stance)&&priorities.includes(priority)&&rationale&&expectedEffect&&Number.isFinite(confidence)&&confidence>=0&&confidence<=1?{stance,priority,rationale,expectedEffect,confidence}:null;
}

function side(value:unknown):SideInput|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const profile=nation(item.profile);
  const observation=observationInput(item.observation);
  return profile&&observation?{profile,observation}:null;
}
function nation(value:unknown):NationInput|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const number=(key:string)=>Number.isFinite(Number(item[key]))?Number(item[key]):0;
  const result={ code:text(item.code,8), name:text(item.name,80), budget:number("budget"), gdp:number("gdp"), population:number("population"), personnel:number("personnel"), readiness:Math.max(0,Math.min(1,number("readiness"))), datasetVersion:text(item.datasetVersion,80), asOfDate:text(item.asOfDate,20) };
  return result.code&&result.name?result:null;
}
function observationInput(value:unknown):Observation|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const week=boundedInteger(item.week,1,24);
  const ownStrength=boundedNumber(item.ownStrength,0,100);
  const ownSupply=boundedNumber(item.ownSupply,0,100);
  const observedOpponentStrength=boundedNumber(item.observedOpponentStrength,0,100);
  const observedOpponentSupply=boundedNumber(item.observedOpponentSupply,0,100);
  const uncertainty=boundedNumber(item.uncertainty,0,100);
  const objectiveState=String(item.objectiveState) as Observation["objectiveState"];
  const ownDomains=domainScores(item.ownDomains);
  const previousDecision=previousDecisionInput(item.previousDecision);
  if (!week||ownStrength===null||ownSupply===null||observedOpponentStrength===null||observedOpponentSupply===null||uncertainty===null||!objectiveStates.includes(objectiveState)||!ownDomains) return null;
  return { week,ownStrength,ownSupply,objectiveState,observedOpponentStrength,observedOpponentSupply,ownDomains,uncertainty,...(previousDecision?{previousDecision}:{}) };
}
function domainScores(value:unknown) {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const land=boundedNumber(item.land,0,200); const air=boundedNumber(item.air,0,200); const maritime=boundedNumber(item.maritime,0,200); const support=boundedNumber(item.support,0,200);
  return land===null||air===null||maritime===null||support===null?null:{land,air,maritime,support};
}
function previousDecisionInput(value:unknown) {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>; const stance=String(item.stance) as Decision["stance"]; const priority=String(item.priority) as Decision["priority"];
  return stances.includes(stance)&&priorities.includes(priority)?{stance,priority}:null;
}
function scenarioInput(value:unknown):ScenarioInput|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const configuration=item.configuration&&typeof item.configuration==="object"?item.configuration as Record<string,unknown>:null;
  if (!configuration||JSON.stringify(configuration).length>20000) return null;
  const result={ name:text(item.name,120), seed:text(item.seed,120), modelVersion:text(item.modelVersion,80), datasetVersion:text(item.datasetVersion,80), assetDatasetVersion:text(item.assetDatasetVersion,120), configuration };
  return Object.values(result).every(Boolean)?result:null;
}
function scenarioMatches(scenario:ScenarioInput,objective:string,duration:number,sideACode:string,sideBCode:string) {
  const configuration=scenario.configuration;
  const sideA=configuration.sideA&&typeof configuration.sideA==="object"?configuration.sideA as Record<string,unknown>:null;
  const sideB=configuration.sideB&&typeof configuration.sideB==="object"?configuration.sideB as Record<string,unknown>:null;
  return configuration.objective===objective&&Number(configuration.duration)===duration&&sideA?.nationCode===sideACode&&sideB?.nationCode===sideBCode;
}

function responseBody(row:Record<string,unknown>,sessionId:string,reused:boolean) {
  return { sessionId, reused, turn:{ id:row.id, week:row.week, sideA:row.decision_a, sideB:row.decision_b, assessment:row.assessment, observationA:row.observation_a, observationB:row.observation_b, inputHash:row.input_hash, models:{sideA:row.model_a,sideB:row.model_b}, modes:{sideA:row.mode_a,sideB:row.mode_b}, committedAt:row.created_at }, safetyNotice:"Illustrative aggregate national-level behavior only—not a forecast or operational recommendation." };
}
function boundedInteger(value:unknown,min:number,max:number) { const number=Number(value); return Number.isInteger(number)&&number>=min&&number<=max?number:null; }
function boundedNumber(value:unknown,min:number,max:number) { const number=Number(value); return Number.isFinite(number)&&number>=min&&number<=max?number:null; }
function text(value:unknown,max:number) { return typeof value==="string"?value.trim().slice(0,max):""; }
function isUuid(value:string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
async function sha256(value:string) { const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join(""); }
function json(body:unknown,status:number) { return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
