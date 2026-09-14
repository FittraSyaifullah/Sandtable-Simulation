import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const blocked = /target(?:ing)?|strike plan|weapon optimization|real unit|troop location|attack route|detection evasion|operational recommendation/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 1200) : "";
    if (!prompt) return json({ error: "A scenario description is required." }, 400);
    if (blocked.test(prompt)) return json({ error: "This request crosses Sandtable’s non-operational safety boundary. Use an abstract objective without targeting, routes, real locations, or weapons guidance." }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.info("[scenario-draft] OpenAI secret unavailable; returning constrained guided draft");
      return json(guidedDraft(prompt), 200);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: "You design abstract educational Sandtable scenarios. Never provide targeting, strike planning, weapons optimization, real-unit locations, attack routes, evasion, or operational recommendations. Return JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "scenario_proposal", strict: true, schema: { type: "object", additionalProperties: false, required: ["title","summary","objective","terrain","tempo","duration","uncertainty","assumptions","alternatives","safetyNotice"], properties: { title:{type:"string"}, summary:{type:"string"}, objective:{type:"string"}, terrain:{type:"string",enum:["open","mixed","restricted","maritime"]}, tempo:{type:"string",enum:["measured","standard","intense"]}, duration:{type:"integer",minimum:4,maximum:24}, uncertainty:{type:"integer",minimum:10,maximum:90}, assumptions:{type:"array",items:{type:"string"},minItems:2,maxItems:4}, alternatives:{type:"array",items:{type:"string"},minItems:2,maxItems:3}, safetyNotice:{type:"string"} } } } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const payload = await response.json();
    const proposal = JSON.parse(payload.choices[0].message.content);
    console.info("[scenario-draft] Structured proposal generated", { title: proposal.title });
    return json({ ...proposal, formations: defaultFormations() }, 200);
  } catch (error) {
    console.error("[scenario-draft] Request failed", { error: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "The proposal could not be generated." }, 500);
  }
});

function guidedDraft(prompt: string) {
  const lower = prompt.toLowerCase();
  const terrain = lower.includes("sea") || lower.includes("maritime") ? "maritime" : lower.includes("mountain") || lower.includes("urban") ? "restricted" : "mixed";
  const tempo = lower.includes("rapid") || lower.includes("intense") ? "intense" : lower.includes("slow") || lower.includes("measured") ? "measured" : "standard";
  return { title: "AI-assisted abstract access study", summary: prompt, objective: "Sustain aggregate control of a shared abstract access zone", terrain, tempo, duration: 12, uncertainty: 48, formations: defaultFormations(), assumptions: ["All locations and formations are abstract.", "Capability inputs remain aggregate and versioned.", "The deterministic seed is reviewable before running."], alternatives: ["Reduce tempo to test supply sensitivity.", "Increase uncertainty to inspect range stability."], safetyNotice: "Educational model output only—not a forecast or operational recommendation." };
}

function defaultFormations() {
  return { sideA: { land: 4, air: 3, naval: 2, support: 2 }, sideB: { land: 4, air: 3, naval: 2, support: 2 } };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
