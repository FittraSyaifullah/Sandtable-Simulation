# Sandtable

A governed, map-first laboratory for exploring aggregate future-conflict scenarios.

## National AI agents

Each run calls the authenticated `conflict-agents` Supabase Edge Function. Two bounded national agents choose weekly aggregate stance and priorities across logistics, readiness, resilience, and diplomacy. Their choices affect deterministic movement, supply consumption, and resilience, and appear in the map timeline. The OpenAI key remains in Supabase Edge Function secrets; no live intelligence, targeting, weapons guidance, attack routes, or real-unit locations are used.

## Mapbox

The workspace uses Mapbox GL as its primary interactive map and retains a local globe if Mapbox cannot initialize. Each simulation automatically replays its weekly frames; aggregate formation layers transition between frame positions while the route and objective state update on the globe.

Set `VITE_MAPBOX_ACCESS_TOKEN` to a public Mapbox token (`pk.*`) in the deployment environment. For Vercel, add it to the Sandtable project's Production and Preview environments, then redeploy. Restrict the token to the approved production and preview domains in Mapbox.

## Production

The Vercel build uses `pnpm build`, outputs to `dist`, and uses the SPA rewrite in `vercel.json`.
