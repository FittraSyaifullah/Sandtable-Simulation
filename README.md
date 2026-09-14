# Sandtable

A governed, conversation-first laboratory for exploring aggregate hypothetical scenarios.

## Mapbox

The workspace uses Mapbox GL as its primary interactive map and retains a local globe if Mapbox cannot initialize. Each simulation automatically replays its weekly frames; aggregate formation layers transition between frame positions while the route and objective state update on the globe.

Set `VITE_MAPBOX_ACCESS_TOKEN` to a public Mapbox token (`pk.*`) in the deployment environment. For Vercel, add it to the Sandtable project's Production and Preview environments, then redeploy. Restrict the token to the approved production and preview domains in Mapbox.

## Production

The Vercel build uses `pnpm build`, outputs to `dist`, and uses the SPA rewrite in `vercel.json`.
