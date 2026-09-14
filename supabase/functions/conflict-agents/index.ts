import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const blocked = /target(?:ing)?|strike|weapon|munition|real[- ]?time|live unit|troop location|attack route|infiltrat|evad(?:e|ing)|air defense suppression|kill chain|operational recommendation/i;
const stances = ["hold", "cautious", "balanced", "press"] as const;
const priorities = ["logistics", "readiness", "resilience", "diplomacy"] as const;

type NationInput = { code:string; name:string; budget:number; gdp:number; population:number; personnel:number; readiness:number; datasetVersion:string; asOfDate:string };
type Decision = { stance:typeof stances[number]; priority:typeof priorities[number]; rationale:string };
type Turn = { week:number; sideA:Decision; sideB:Decision; assessment:string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "Authentication service unavailable." }, 500);
    const authClient = createClient(supabaseUrl, anonKey);
    const { data, error: authError } = await authClient.auth.getUser(authHeader.slice(7));
    if (authError || !data.user) return json({ error: "Invalid session." }, 401);

    const body = await req.json();
    const objective = typeof body?.objective === "string" ? body.objective.trim().slice(0, 500) : "";
    const duration = Math.max(4, Math.min(24, Number(body?.duration) || 12));
    const sideA = nation(body?.sideA);
    const sideB = nation(body?.sideB);
    if (!objective || !sideA || !sideB) return json({ error: "Two valid national profiles and an abstract objective are required." }, 400);
    if (blocked.test(objective)) return json({ error: "Use a strategic or resilience objective without targeting, weapons, live locations, or operational routes." }, 400);

    const fallback = guidedTurns(sideA, sideB, duration);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.info("[conflict-agents] OpenAI secret unavailable; using bounded deterministic agents", { userId: data.user.id, duration });
      return json(responseBody(fallback, sideA, sideB, "Deterministic fallback agents"), 200);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: .35,
        messages: [
          { role: "system", content: `You operate two opposing national-level agents in an educational future-conflict simulation. Use only the provided aggregate public macro indicators. For every week, each agent may choose only a stance (hold, cautious, balanced, press) and priority (logistics, readiness, resilience, diplomacy). Rationale must remain political-strategic and aggregate. Never provide targets, strikes, weapons employment, routes, live intelligence, real-unit locations, vulnerabilities of named facilities, evasion, or operational recommendations. Do not claim prediction. Return JSON only with exactly ${duration + 1} turns covering weeks 0 through ${duration}.` },
          { role: "user", content: JSON.stringify({ objective, duration, sideA, sideB, instruction: "Represent each country's competing strategic incentives using only these versioned public aggregates." }) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "bounded_agent_plan", strict: true, schema: { type:"object", additionalProperties:false, required:["turns"], properties:{ turns:{ type:"array", minItems:duration+1, maxItems:duration+1, items:{ type:"object", additionalProperties:false, required:["week","sideA","sideB","assessment"], properties:{ week:{type:"integer",minimum:0,maximum:duration}, sideA:decisionSchema(), sideB:decisionSchema(), assessment:{type:"string",maxLength:240} } } } } } } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    const turns = sanitizeTurns(parsed.turns, duration, fallback);
    console.info("[conflict-agents] Bounded national agent plan generated", { userId: data.user.id, duration, sideA: sideA.code, sideB: sideB.code });
    return json(responseBody(turns, sideA, sideB, "OpenAI bounded strategic agents"), 200);
  } catch (error) {
    console.error("[conflict-agents] Agent generation failed", { error: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "The national agents could not be generated." }, 500);
  }
});

function nation(value: unknown): NationInput | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const text = (key:string, max:number) => typeof item[key] === "string" ? String(item[key]).slice(0,max) : "";
  const number = (key:string) => Number.isFinite(Number(item[key])) ? Number(item[key]) : 0;
  const result = { code:text("code",8), name:text("name",80), budget:number("budget"), gdp:number("gdp"), population:number("population"), personnel:number("personnel"), readiness:Math.max(0,Math.min(1,number("readiness"))), datasetVersion:text("datasetVersion",80), asOfDate:text("asOfDate",20) };
  return result.code && result.name ? result : null;
}

function decisionSchema() {
  return { type:"object", additionalProperties:false, required:["stance","priority","rationale"], properties:{ stance:{type:"string",enum:[...stances]}, priority:{type:"string",enum:[...priorities]}, rationale:{type:"string",maxLength:220} } };
}

function guidedTurns(a:NationInput,b:NationInput,duration:number):Turn[] {
  return Array.from({ length:duration+1 },(_,week) => {
    const late = week > duration*.6;
    const aPressure = a.readiness < b.readiness || a.budget < b.budget;
    const bPressure = b.readiness < a.readiness || b.budget < a.budget;
    return { week, sideA:{ stance:late&&aPressure?"cautious":week===0?"hold":"balanced", priority:aPressure?(late?"diplomacy":"readiness"):late?"logistics":"resilience", rationale:`${a.name} balances aggregate readiness, sustainment, and escalation risk at the strategic level.` }, sideB:{ stance:late&&bPressure?"cautious":week===0?"hold":"balanced", priority:bPressure?(late?"diplomacy":"readiness"):late?"logistics":"resilience", rationale:`${b.name} balances aggregate readiness, sustainment, and escalation risk at the strategic level.` }, assessment:"Both agents revise national-level posture against modeled supply, readiness, and uncertainty; no operational actions are generated." };
  });
}

function sanitizeTurns(value:unknown,duration:number,fallback:Turn[]):Turn[] {
  if (!Array.isArray(value)) return fallback;
  const byWeek = new Map<number,Turn>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item=raw as Record<string,unknown>; const week=Number(item.week);
    if (!Number.isInteger(week)||week<0||week>duration) continue;
    const sideA=sanitizeDecision(item.sideA); const sideB=sanitizeDecision(item.sideB);
    const assessment=typeof item.assessment==="string"?item.assessment.slice(0,240):"";
    if (sideA&&sideB&&assessment&&!blocked.test(`${sideA.rationale} ${sideB.rationale} ${assessment}`)) byWeek.set(week,{week,sideA,sideB,assessment});
  }
  return fallback.map(turn=>byWeek.get(turn.week)??turn);
}
function sanitizeDecision(value:unknown):Decision|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>; const stance=String(item.stance) as Decision["stance"]; const priority=String(item.priority) as Decision["priority"]; const rationale=typeof item.rationale==="string"?item.rationale.slice(0,220):"";
  return stances.includes(stance)&&priorities.includes(priority)&&rationale?{stance,priority,rationale}:null;
}
function responseBody(turns:Turn[],a:NationInput,b:NationInput,mode:string) { return { turns, mode, evidence:{ datasetVersion:a.datasetVersion||b.datasetVersion||"capability-reference", asOfDate:[a.asOfDate,b.asOfDate].filter(Boolean).sort().at(-1)??"unknown", scope:"Versioned public macro indicators supplied by Sandtable; no live intelligence or unit-level data." }, safetyNotice:"Illustrative national-level agent behavior only—not a forecast or operational recommendation." }; }
function json(body:unknown,status:number) { return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
