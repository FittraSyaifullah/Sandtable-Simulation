import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import mapboxgl, { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Nation, ScenarioConfig, WeeklyFrame } from "@/lib/sandtable";

export type MapboxStatus = "loading" | "ready" | "unavailable";
export type MapboxWorldHandle = { zoomIn: () => void; zoomOut: () => void; reset: () => void };
type FormationKind = keyof ScenarioConfig["sideA"]["formations"];
type Props = {
  sideA?: Nation;
  sideB?: Nation;
  config: ScenarioConfig;
  frame?: WeeklyFrame;
  onSelect: (selection: { side: "A" | "B"; kind: FormationKind }) => void;
  onStatusChange: (status: MapboxStatus) => void;
};

type Coordinates = [number, number];
const kinds: FormationKind[] = ["land", "air", "naval", "support"];

function adjustedPair(sideA?: Nation, sideB?: Nation): [Coordinates, Coordinates] {
  const a: Coordinates = [sideA?.longitude ?? -18, sideA?.latitude ?? 45];
  const b: Coordinates = [sideB?.longitude ?? 24, sideB?.latitude ?? 45];
  if (Math.abs(a[0] - b[0]) > 180) {
    if (a[0] < b[0]) a[0] += 360;
    else b[0] += 360;
  }
  return [a, b];
}

function interpolate(a: Coordinates, b: Coordinates, progress: number): Coordinates {
  return [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress];
}

function mapData(sideA: Nation | undefined, sideB: Nation | undefined, config: ScenarioConfig, frame?: WeeklyFrame) {
  const [a, b] = adjustedPair(sideA, sideB);
  const aProgress = frame ? .04 + (frame.aPosition / 100) * .7 : .2;
  const bProgress = frame ? .96 - ((100 - frame.bPosition) / 100) * .7 : .8;
  const anchors = { A: interpolate(a, b, aProgress), B: interpolate(a, b, bProgress) };
  const formations = (["A", "B"] as const).flatMap(side => kinds.map((kind, index) => {
    const values = side === "A" ? config.sideA.formations : config.sideB.formations;
    const anchor = anchors[side];
    const longitudeScale = Math.max(.45, Math.abs(b[0] - a[0]) * .018);
    const latitudeScale = Math.max(.35, Math.abs(b[1] - a[1]) * .025);
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [anchor[0] + (index - 1.5) * longitudeScale, anchor[1] + (index % 2 === 0 ? -latitudeScale : latitudeScale)] },
      properties: { side, kind, count: values[kind], label: `${kind.slice(0, 1).toUpperCase()}${values[kind]}` },
    };
  }).filter(feature => feature.properties.count > 0));
  return {
    endpoints: [a, b] as [Coordinates, Coordinates],
    route: { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [anchors.A, interpolate(anchors.A, anchors.B, .5), anchors.B] }, properties: {} }] },
    objective: { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: interpolate(anchors.A, anchors.B, .5) }, properties: {} }] },
    formations: { type: "FeatureCollection" as const, features: formations },
  };
}

export const MapboxWorld = forwardRef<MapboxWorldHandle, Props>(function MapboxWorld({ sideA, sideB, config, frame, onSelect, onStatusChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap>();
  const animationRef = useRef<number>();
  const displayedPositionsRef = useRef<Record<string, Coordinates>>();
  const latestDataRef = useRef(mapData(sideA, sideB, config, frame));
  latestDataRef.current = mapData(sideA, sideB, config, frame);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();

  const reset = () => {
    const map = mapRef.current;
    if (!map || !sideA || !sideB) return;
    const { endpoints } = mapData(sideA, sideB, config, frame);
    const bounds = new mapboxgl.LngLatBounds(endpoints[0], endpoints[0]).extend(endpoints[1]);
    map.fitBounds(bounds, { padding: 110, maxZoom: 4.2, duration: 700 });
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 240 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 240 }),
    reset,
  }));

  useEffect(() => {
    if (!containerRef.current || !token?.startsWith("pk.")) {
      onStatusChange("unavailable");
      return;
    }

    onStatusChange("loading");
    mapboxgl.accessToken = token;
    let loaded = false;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [4, 38],
      zoom: 1.8,
      projection: "globe",
      attributionControl: true,
      logoPosition: "bottom-right",
      antialias: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      loaded = true;
      map.setFog({ color: "#050505", "high-color": "#111827", "horizon-blend": .08, "space-color": "#050505", "star-intensity": .08 });
      const data = latestDataRef.current;
      map.addSource("scenario-route", { type: "geojson", data: data.route });
      map.addLayer({ id: "scenario-route-glow", type: "line", source: "scenario-route", paint: { "line-color": "#facc15", "line-width": 7, "line-opacity": .08, "line-blur": 5 } });
      map.addLayer({ id: "scenario-route", type: "line", source: "scenario-route", paint: { "line-color": "#facc15", "line-width": 2, "line-opacity": .82, "line-dasharray": [2, 2] } });
      map.addSource("scenario-objective", { type: "geojson", data: data.objective });
      map.addLayer({ id: "scenario-objective-glow", type: "circle", source: "scenario-objective", paint: { "circle-radius": 18, "circle-color": "#facc15", "circle-opacity": .13, "circle-blur": .2 } });
      map.addLayer({ id: "scenario-objective", type: "circle", source: "scenario-objective", paint: { "circle-radius": 6, "circle-color": "#facc15", "circle-stroke-color": "#181500", "circle-stroke-width": 3 } });
      map.addSource("scenario-formations", { type: "geojson", data: data.formations });
      displayedPositionsRef.current = Object.fromEntries(data.formations.features.map(feature => [`${feature.properties.side}-${feature.properties.kind}`, feature.geometry.coordinates as Coordinates]));
      map.addLayer({ id: "scenario-formations", type: "circle", source: "scenario-formations", paint: { "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 12, 6, 18], "circle-color": ["match", ["get", "side"], "A", "#facc15", "#e7e5e4"], "circle-stroke-color": "#090909", "circle-stroke-width": 3, "circle-opacity": .96 } });
      map.addLayer({ id: "scenario-formation-labels", type: "symbol", source: "scenario-formations", layout: { "text-field": ["get", "label"], "text-size": 10, "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"], "text-allow-overlap": true }, paint: { "text-color": "#121212" } });
      map.on("mouseenter", "scenario-formations", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "scenario-formations", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "scenario-formations", event => {
        const properties = event.features?.[0]?.properties as { side?: "A" | "B"; kind?: FormationKind } | undefined;
        if (properties?.side && properties.kind) onSelect({ side: properties.side, kind: properties.kind });
      });
      onStatusChange("ready");
      window.setTimeout(reset, 80);
    });
    map.on("error", () => { if (!loaded) onStatusChange("unavailable"); });

    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      map.remove();
      mapRef.current = undefined;
      displayedPositionsRef.current = undefined;
    };
  // Map creation is intentionally tied only to the public token.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const data = mapData(sideA, sideB, config, frame);
    (map.getSource("scenario-route") as GeoJSONSource | undefined)?.setData(data.route);
    (map.getSource("scenario-objective") as GeoJSONSource | undefined)?.setData(data.objective);

    const source = map.getSource("scenario-formations") as GeoJSONSource | undefined;
    if (!source) return;
    if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    const targetPositions = Object.fromEntries(data.formations.features.map(feature => [`${feature.properties.side}-${feature.properties.kind}`, feature.geometry.coordinates as Coordinates]));
    const startPositions = displayedPositionsRef.current ?? targetPositions;
    const startedAt = performance.now();
    const duration = 520;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const features = data.formations.features.map(feature => {
        const key = `${feature.properties.side}-${feature.properties.kind}`;
        const start = startPositions[key] ?? targetPositions[key];
        const target = targetPositions[key];
        return { ...feature, geometry: { ...feature.geometry, coordinates: interpolate(start, target, eased) } };
      });
      source.setData({ ...data.formations, features });
      if (progress < 1) animationRef.current = window.requestAnimationFrame(animate);
      else {
        displayedPositionsRef.current = targetPositions;
        animationRef.current = undefined;
      }
    };
    animationRef.current = window.requestAnimationFrame(animate);
  }, [config, frame, sideA, sideB]);

  useEffect(() => { if (mapRef.current?.isStyleLoaded()) reset(); }, [config.sideA.nationCode, config.sideB.nationCode]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="Interactive Mapbox scenario map" />;
});
