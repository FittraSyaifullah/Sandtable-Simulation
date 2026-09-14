import { useEffect, useRef, useState } from "react";
import { Boxes, LandPlot, LucideIcon, Plane, Ship } from "lucide-react";
import mapboxgl, { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DomainScores, Nation, ScenarioConfig, WeeklyFrame } from "@/lib/sandtable";

export type MapboxStatus = "loading" | "ready" | "unavailable";
export type FormationSelection = { id:string; label:string; side:"A"|"B"; domain:"land"|"air"|"maritime"|"support"; scale:string; Icon:LucideIcon };
type Props = {
  sideA?: Nation;
  sideB?: Nation;
  config: ScenarioConfig;
  frame?: WeeklyFrame;
  capabilities?: {sideA:DomainScores;sideB:DomainScores};
  onSelect: (selection: FormationSelection) => void;
  onStatusChange: (status: MapboxStatus) => void;
};
type Coordinates=[number,number];
type Domain="land"|"air"|"maritime"|"support";
const domains:Domain[]=["land","air","maritime","support"];
const icons:Record<Domain,LucideIcon>={land:LandPlot,air:Plane,maritime:Ship,support:Boxes};
const short={land:"L",air:"A",maritime:"M",support:"S"};
const domainOffset={land:-2.4,air:2.2,maritime:-5.4,support:5};

function adjustedPair(sideA?:Nation,sideB?:Nation):[Coordinates,Coordinates] {
  const a:Coordinates=[sideA?.longitude??-18,sideA?.latitude??42];
  const b:Coordinates=[sideB?.longitude??24,sideB?.latitude??42];
  if(Math.abs(a[0]-b[0])>180){if(a[0]<b[0])a[0]+=360;else b[0]+=360;}
  return [a,b];
}
function interpolate(a:Coordinates,b:Coordinates,progress:number):Coordinates{return[a[0]+(b[0]-a[0])*progress,a[1]+(b[1]-a[1])*progress];}
function commandScale(domain:Domain){if(domain==="land")return"Army group";if(domain==="air")return"Air command";if(domain==="maritime")return"Fleet command";return"Theatre support";}
function detailScale(domain:Domain,index:number){if(domain==="land")return index%2===0?"Division group":"Battalion group";if(domain==="air")return"Fighter squadron";if(domain==="maritime")return"Fleet group";return"Support command";}
function detailCount(score:number|undefined,configured:number){return Math.max(1,Math.min(6,Math.round((score??configured*14)/18)));}

function mapData(sideA:Nation|undefined,sideB:Nation|undefined,config:ScenarioConfig,frame?:WeeklyFrame,capabilities?:Props["capabilities"]){
  const [originA,originB]=adjustedPair(sideA,sideB);
  const progressA=frame?.aPosition!==undefined ? .08+frame.aPosition/100*.72 : .18;
  const progressB=frame?.bPosition!==undefined ? .92-(100-frame.bPosition)/100*.72 : .82;
  const anchorA=interpolate(originA,originB,progressA);
  const anchorB=interpolate(originA,originB,progressB);
  const features:any[]=[];
  const routes:any[]=[];
  (["A","B"] as const).forEach(side=>{
    const anchor=side==="A"?anchorA:anchorB;
    const origin=side==="A"?originA:originB;
    const scores=side==="A"?capabilities?.sideA:capabilities?.sideB;
    const configured=side==="A"?config.sideA.formations:config.sideB.formations;
    domains.forEach((domain,domainIndex)=>{
      const count=detailCount(scores?.[domain],configured[domain==="maritime"?"naval":domain]);
      const offset=domainOffset[domain];
      const commandCoordinate:Coordinates=[anchor[0]+domainIndex*.15,anchor[1]+offset*.32];
      const commandId=`${side}-${domain}-command`;
      const scale=commandScale(domain);
      features.push({type:"Feature",id:commandId,geometry:{type:"Point",coordinates:commandCoordinate},properties:{id:commandId,side,domain,scale,detail:false,count,label:`SYN ${side} · ${scale.toUpperCase()}`,short:`${short[domain]}${count}`}});
      for(let index=0;index<count;index+=1){
        const spread=(index-(count-1)/2)*.62;
        const id=`${side}-${domain}-${String(index+1).padStart(2,"0")}`;
        const scale=detailScale(domain,index);
        features.push({type:"Feature",id,geometry:{type:"Point",coordinates:[commandCoordinate[0]+spread,commandCoordinate[1]+(index%2?-.48:.48)]},properties:{id,side,domain,scale,detail:true,count:1,label:`SYN ${side}-${short[domain]}${String(index+1).padStart(2,"0")} · ${scale.toUpperCase()}`,short:`${short[domain]}${index+1}`}});
      }
      const routeEnd=commandCoordinate;
      const midpoint=interpolate(origin,routeEnd,.52);
      routes.push({type:"Feature",geometry:{type:"LineString",coordinates:[origin,[midpoint[0],midpoint[1]+offset*.18],routeEnd]},properties:{side,domain}});
    });
  });
  return {
    endpoints:[originA,originB] as [Coordinates,Coordinates],
    routes:{type:"FeatureCollection" as const,features:routes},
    formations:{type:"FeatureCollection" as const,features},
    objective:{type:"FeatureCollection" as const,features:[{type:"Feature" as const,geometry:{type:"Point" as const,coordinates:interpolate(anchorA,anchorB,.5)},properties:{}}]},
  };
}

export function MapboxWorld({sideA,sideB,config,frame,capabilities,onSelect,onStatusChange}:Props){
  const containerRef=useRef<HTMLDivElement>(null);
  const mapRef=useRef<MapboxMap>();
  const animationRef=useRef<number>();
  const displayedRef=useRef<Record<string,Coordinates>>();
  const latestRef=useRef(mapData(sideA,sideB,config,frame,capabilities));
  latestRef.current=mapData(sideA,sideB,config,frame,capabilities);
  const token=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  const [showFallback,setShowFallback]=useState(!token?.startsWith("pk."));

  useEffect(()=>{
    if(!containerRef.current||!token?.startsWith("pk.")){setShowFallback(true);onStatusChange("unavailable");return;}
    setShowFallback(false);onStatusChange("loading");
    mapboxgl.accessToken=token;
    let loaded=false;
    const map=new mapboxgl.Map({container:containerRef.current,style:"mapbox://styles/mapbox/dark-v11",center:[6,35],zoom:1.55,projection:"globe",attributionControl:true,logoPosition:"bottom-right",antialias:true});
    mapRef.current=map;
    map.addControl(new mapboxgl.NavigationControl({showCompass:false}),"top-right");
    map.on("load",()=>{
      loaded=true;
      map.setFog({color:"#07111f","high-color":"#10243a","horizon-blend":.1,"space-color":"#030914","star-intensity":.06});
      const data=latestRef.current;
      map.addSource("synthetic-routes",{type:"geojson",data:data.routes});
      map.addLayer({id:"synthetic-route-glow",type:"line",source:"synthetic-routes",paint:{"line-color":["match",["get","side"],"A","#fde047","#67e8f9"],"line-width":6,"line-opacity":.06,"line-blur":5}});
      map.addLayer({id:"synthetic-routes",type:"line",source:"synthetic-routes",paint:{"line-color":["match",["get","side"],"A","#fde047","#67e8f9"],"line-width":1.4,"line-opacity":.52,"line-dasharray":[2,2]}});
      map.addSource("synthetic-objective",{type:"geojson",data:data.objective});
      map.addLayer({id:"synthetic-objective-glow",type:"circle",source:"synthetic-objective",paint:{"circle-radius":28,"circle-color":"#fb923c","circle-opacity":.1,"circle-blur":.45}});
      map.addLayer({id:"synthetic-objective",type:"circle",source:"synthetic-objective",paint:{"circle-radius":5,"circle-color":"#fb923c","circle-stroke-color":"#fff7ed","circle-stroke-width":1.5}});
      map.addSource("synthetic-formations",{type:"geojson",data:data.formations});
      displayedRef.current=Object.fromEntries(data.formations.features.map((feature:any)=>[feature.properties.id,feature.geometry.coordinates]));
      map.addLayer({id:"formation-command",type:"circle",source:"synthetic-formations",maxzoom:3.65,filter:["==",["get","detail"],false],paint:{"circle-radius":["interpolate",["linear"],["get","count"],1,12,6,19],"circle-color":["match",["get","side"],"A","#fde047","#67e8f9"],"circle-stroke-color":"#07111f","circle-stroke-width":3,"circle-opacity":.95}});
      map.addLayer({id:"formation-command-label",type:"symbol",source:"synthetic-formations",maxzoom:3.65,filter:["==",["get","detail"],false],layout:{"text-field":["get","short"],"text-size":10,"text-font":["DIN Offc Pro Bold","Arial Unicode MS Bold"],"text-allow-overlap":true},paint:{"text-color":"#0b1726"}});
      map.addLayer({id:"formation-detail",type:"circle",source:"synthetic-formations",minzoom:2.8,filter:["==",["get","detail"],true],paint:{"circle-radius":7,"circle-color":["match",["get","side"],"A","#fde047","#67e8f9"],"circle-stroke-color":"#07111f","circle-stroke-width":2,"circle-opacity":.95}});
      map.addLayer({id:"formation-detail-label",type:"symbol",source:"synthetic-formations",minzoom:3.5,filter:["==",["get","detail"],true],layout:{"text-field":["get","label"],"text-size":9,"text-offset":[0,1.45],"text-anchor":"top","text-font":["DIN Offc Pro Medium","Arial Unicode MS Regular"],"text-allow-overlap":false},paint:{"text-color":"#e2e8f0","text-halo-color":"#07111f","text-halo-width":1.2}});
      const choose=(event:mapboxgl.MapLayerMouseEvent)=>{const properties=event.features?.[0]?.properties as Record<string,unknown>|undefined;if(!properties)return;const domain=String(properties.domain) as Domain;onSelect({id:String(properties.id),label:String(properties.label),side:String(properties.side) as "A"|"B",domain,scale:String(properties.scale),Icon:icons[domain]});};
      ["formation-command","formation-detail"].forEach(layer=>{map.on("mouseenter",layer,()=>{map.getCanvas().style.cursor="pointer";});map.on("mouseleave",layer,()=>{map.getCanvas().style.cursor="";});map.on("click",layer,choose);});
      const bounds=new mapboxgl.LngLatBounds(data.endpoints[0],data.endpoints[0]).extend(data.endpoints[1]);
      map.fitBounds(bounds,{padding:{top:110,bottom:240,left:80,right:80},maxZoom:3.6,duration:900});
      setShowFallback(false);onStatusChange("ready");
    });
    map.on("error",()=>{if(!loaded){setShowFallback(true);onStatusChange("unavailable");}});
    return()=>{if(animationRef.current)cancelAnimationFrame(animationRef.current);map.remove();mapRef.current=undefined;displayedRef.current=undefined;};
  // Map lifecycle only follows the public token; live data is updated below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  useEffect(()=>{
    const map=mapRef.current;if(!map?.isStyleLoaded())return;
    const data=mapData(sideA,sideB,config,frame,capabilities);
    (map.getSource("synthetic-routes") as GeoJSONSource|undefined)?.setData(data.routes);
    (map.getSource("synthetic-objective") as GeoJSONSource|undefined)?.setData(data.objective);
    const source=map.getSource("synthetic-formations") as GeoJSONSource|undefined;if(!source)return;
    if(animationRef.current)cancelAnimationFrame(animationRef.current);
    const targets=Object.fromEntries(data.formations.features.map((feature:any)=>[feature.properties.id,feature.geometry.coordinates as Coordinates]));
    const starts=displayedRef.current??targets;const startTime=performance.now();
    const animate=(now:number)=>{const progress=Math.min(1,(now-startTime)/520);const eased=1-Math.pow(1-progress,3);const features=data.formations.features.map((feature:any)=>{const id=feature.properties.id;const start=starts[id]??targets[id];const target=targets[id];return{...feature,geometry:{...feature.geometry,coordinates:interpolate(start,target,eased)}};});source.setData({...data.formations,features});if(progress<1)animationRef.current=requestAnimationFrame(animate);else{displayedRef.current=targets;animationRef.current=undefined;}};
    animationRef.current=requestAnimationFrame(animate);
  },[sideA,sideB,config,frame,capabilities]);

  useEffect(()=>{
    const map=mapRef.current;if(!map?.isStyleLoaded()||!sideA||!sideB)return;
    const data=mapData(sideA,sideB,config,frame,capabilities);
    const bounds=new mapboxgl.LngLatBounds(data.endpoints[0],data.endpoints[0]).extend(data.endpoints[1]);
    map.fitBounds(bounds,{padding:{top:100,bottom:230,left:70,right:70},maxZoom:3.6,duration:850});
  // Fit only when the selected countries change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sideA?.code,sideB?.code]);

  const fallbackData=mapData(sideA,sideB,config,frame,capabilities);
  return <div className="absolute inset-0 bg-[#07111f]">
    <div ref={containerRef} className="absolute inset-0" aria-label="Mapbox globe showing synthetic aggregate formations"/>
    {showFallback&&<FallbackWorld data={fallbackData} onSelect={onSelect}/>}
  </div>;
}

function FallbackWorld({data,onSelect}:{data:ReturnType<typeof mapData>;onSelect:(selection:FormationSelection)=>void}){
  const commands=data.formations.features.filter((feature:any)=>!feature.properties.detail);
  return <div className="absolute inset-0 overflow-hidden bg-[#07111f]"><div className="atlas-grid absolute inset-0 opacity-40"/><div className="absolute left-1/2 top-[44%] aspect-square w-[min(80vw,74vh)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/15 bg-[#0a1929] shadow-[0_0_100px_rgba(103,232,249,.08)]"><svg viewBox="0 0 100 100" className="h-full w-full"><circle cx="50" cy="50" r="48" fill="none" stroke="#31506a" strokeWidth=".4"/><g fill="none" stroke="#28445b" strokeWidth=".25">{[24,38,50,62,76].map(value=><ellipse key={value} cx="50" cy="50" rx="47" ry={Math.abs(50-value)*.55+4}/>)}</g><path d="M7 36l16-17 18 7-5 14-13 4-8 14-9-6zm39-17l21-9 19 12 8 18-14 7-12-5-10 9-17-12 3-10zm5 45l16-9 20 13-8 21-20 7-9-15z" fill="#173149" stroke="#3e6079" strokeWidth=".45"/><circle cx="50" cy="48" r="2" fill="#fb923c"/></svg>{commands.map((feature:any,index:number)=>{const domain=feature.properties.domain as Domain;const Icon=icons[domain];return <button key={feature.properties.id} onClick={()=>onSelect({id:feature.properties.id,label:feature.properties.label,side:feature.properties.side,domain,scale:feature.properties.scale,Icon})} className={`absolute grid h-10 w-10 place-items-center rounded-xl border-2 text-[#07111f] shadow-xl ${feature.properties.side==="A"?"border-yellow-100 bg-yellow-300":"border-cyan-100 bg-cyan-300"}`} style={{left:`${feature.properties.side==="A"?28+index%4*4:66+index%4*4}%`,top:`${44+index%4*6}%`}}><Icon className="h-4 w-4"/></button>})}</div><p className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-yellow-300/20 bg-[#0b1726]/90 px-4 py-2 text-[9px] uppercase tracking-[.16em] text-yellow-200">Mapbox token unavailable · local strategic view</p></div>;
}
