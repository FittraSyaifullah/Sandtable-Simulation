# Sandtable

A governed, map-first laboratory for exploring aggregate future-conflict scenarios.

## National AI agents

Each run calls the authenticated `conflict-agents` Supabase Edge Function. Two bounded national agents choose weekly aggregate stance and priorities across logistics, readiness, resilience, and diplomacy. Their choices affect deterministic movement, supply consumption, and resilience, and appear in the map timeline. The OpenAI key remains in Supabase Edge Function secrets; no live intelligence, targeting, weapons guidance, attack routes, or real-unit locations are used.

## Governed asset pools

Land, air, maritime, and support capability are calculated independently from approved records in the active `asset_pool_versions` dataset. Every `asset_pools` record preserves inventory uncertainty, availability, readiness, sustainment, repair, replacement, confidence, and source evidence. Approved records are immutable; corrections require a new version.

The authenticated `asset-research` Edge Function accepts supplied approved-source text and metadata. It never fetches arbitrary URLs, uses a strict aggregate-only extraction schema, hashes the supplied text for audit, and writes proposals as `pending_review`. Pending and rejected records cannot affect simulations.

## Mapbox

The workspace uses Mapbox GL as its primary interactive map and retains a local globe if Mapbox cannot initialize. Each simulation automatically replays its weekly frames; aggregate formation layers transition between frame positions while the route and objective state update on the globe.

Set `VITE_MAPBOX_ACCESS_TOKEN` to a public Mapbox token (`pk.*`) in the deployment environment. For Vercel, add it to the Sandtable project's Production and Preview environments, then redeploy. Restrict the token to the approved production and preview domains in Mapbox.

## Production

The Vercel build uses `pnpm build`, outputs to `dist`, and uses the SPA rewrite in `vercel.json`.
