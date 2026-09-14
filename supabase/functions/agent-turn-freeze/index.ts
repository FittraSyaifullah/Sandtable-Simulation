import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Frame = { week:number; aStrength:number; bStrength:number; aSupply:number; bSupply:number; aPosition:number; bPosition:number; control:"A"|"B"|"contested" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error:"Method not allowed." },405);
  try {
    const authHeader=req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error:"Authentication required." },401);
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl||!anonKey||!serviceRoleKey) return json({ error:"Turn-freeze service unavailable." },500);
    const authClient=createClient(supabaseUrl,anonKey);
    const {data:authData,error:authError}=await authClient.auth.getUser(authHeader.slice(7));
    if (authError||!authData.user) return json({ error:"Invalid session." },401);

    const body=await req.json();
    const sessionId=text(body?.sessionId,40);
    const turnId=text(body?.turnId,40);
    const frame=frameInput(body?.resultingFrame);
    if (!isUuid(sessionId)||!isUuid(turnId)||!frame) return json({ error:"A valid session, committed turn, and aggregate resulting frame are required." },400);

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});
    const {data:turn}=await admin.from("agent_turns").select("id,session_id,week").eq("id",turnId).maybeSingle();
    if (!turn||turn.session_id!==sessionId||turn.week!==frame.week) return json({ error:"The resulting frame does not match the committed turn." },409);
    const {data:session}=await admin.from("agent_run_sessions").select("id,user_id").eq("id",sessionId).maybeSingle();
    if (!session||session.user_id!==authData.user.id) return json({ error:"The adaptive session is unavailable or does not belong to this user." },403);

    const frameHash=await sha256(JSON.stringify(frame));
    const {data:existing}=await admin.from("agent_turn_outcomes").select("*").eq("turn_id",turnId).maybeSingle();
    if (existing) {
      if (existing.frame_hash!==frameHash) return json({ error:"This turn already has a different frozen adjudication." },409);
      console.info("[agent-turn-freeze] Returning previously frozen adjudication",{sessionId,turnId,week:frame.week,userId:authData.user.id});
      return json(responseBody(existing,true),200);
    }

    const {data:outcome,error:insertError}=await admin.from("agent_turn_outcomes").insert({turn_id:turnId,resulting_frame:frame,frame_hash:frameHash}).select("*").single();
    if (insertError) {
      if (insertError.code==="23505") {
        const {data:raced}=await admin.from("agent_turn_outcomes").select("*").eq("turn_id",turnId).maybeSingle();
        if (raced?.frame_hash===frameHash) return json(responseBody(raced,true),200);
      }
      throw insertError;
    }
    console.info("[agent-turn-freeze] Deterministic turn adjudication frozen",{sessionId,turnId,week:frame.week,userId:authData.user.id,frameHash});
    return json(responseBody(outcome,false),201);
  } catch (error) {
    console.error("[agent-turn-freeze] Adjudication freeze failed",{error:error instanceof Error?error.message:"Unknown error"});
    return json({error:"The deterministic turn adjudication could not be frozen."},500);
  }
});

function frameInput(value:unknown):Frame|null {
  if (!value||typeof value!=="object") return null;
  const item=value as Record<string,unknown>;
  const week=integer(item.week,1,24);
  const aStrength=number(item.aStrength,0,100); const bStrength=number(item.bStrength,0,100);
  const aSupply=number(item.aSupply,0,100); const bSupply=number(item.bSupply,0,100);
  const aPosition=number(item.aPosition,0,100); const bPosition=number(item.bPosition,0,100);
  const control=String(item.control) as Frame["control"];
  return !week||aStrength===null||bStrength===null||aSupply===null||bSupply===null||aPosition===null||bPosition===null||!["A","B","contested"].includes(control)?null:{week,aStrength,bStrength,aSupply,bSupply,aPosition,bPosition,control};
}
function responseBody(row:Record<string,unknown>,reused:boolean) { return {reused,outcome:{id:row.id,turnId:row.turn_id,resultingFrame:row.resulting_frame,frameHash:row.frame_hash,frozenAt:row.created_at}}; }
function integer(value:unknown,min:number,max:number) {const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:null;}
function number(value:unknown,min:number,max:number) {const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=min&&parsed<=max?parsed:null;}
function text(value:unknown,max:number) {return typeof value==="string"?value.trim().slice(0,max):"";}
function isUuid(value:string) {return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
async function sha256(value:string) {const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function json(body:unknown,status:number) {return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
