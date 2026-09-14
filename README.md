# Sandtable

A governed, map-first laboratory for exploring aggregate future-conflict scenarios.

## National AI agents

Each strategic interval follows an authenticated observe → decide → validate → adjudicate → freeze loop. The two bounded national agents receive separate aggregate observation packets and are invoked independently, so neither can see its opponent's current decision. Their structured stance and priority decisions are committed together in one immutable `agent_turns` record before the deterministic engine produces the next frame. That resulting frame is hashed and frozen one-to-one in `agent_turn_outcomes` before another turn can begin. Session configuration, observations, decisions, adjudications, model/fallback mode, hashes, and timestamps remain auditable through owner-only records.

The OpenAI key remains in Supabase Edge Function secrets. If either model call fails validation, that side uses a bounded deterministic rule fallback. No live intelligence, targeting, weapons guidance, attack routes, named facilities, or real-unit locations are used.

## Governed asset pools

Land, air, maritime, and support capability are calculated independently from approved records in the active `asset_pool_versions` dataset. Every `asset_pools` record preserves inventory uncertainty, availability, readiness, sustainment, repair, replacement, confidence, and source evidence. Approved records are immutable; corrections require a new version.

The authenticated `asset-research` Edge Function accepts supplied approved-source text and metadata. It never fetches arbitrary URLs, uses a strict aggregate-only extraction schema, hashes the supplied text for audit, and writes proposals as `pending_review`. Pending and rejected records cannot affect simulations.

## Mapbox

The workspace uses Mapbox GL as its primary interactive map and retains a local globe if Mapbox cannot initialize. Each simulation automatically replays its weekly frames; aggregate formation layers transition between frame positions while the route and objective state update on the globe.

Set `VITE_MAPBOX_ACCESS_TOKEN` to a public Mapbox token (`pk.*`) in the deployment environment. For Vercel, add it to the Sandtable project's Production and Preview environments, then redeploy. Restrict the token to the approved production and preview domains in Mapbox.

## Production

The Vercel build uses `pnpm build`, outputs to `dist`, and uses the SPA rewrite in `vercel.json`.
