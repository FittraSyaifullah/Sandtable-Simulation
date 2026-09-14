import { ArrowLeft, Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#050505] px-4 py-10 text-stone-100"><div className="atlas-grid absolute inset-0 opacity-40"/><section className="relative w-full max-w-md rounded-[24px] border border-white/10 bg-black/80 p-6 text-center shadow-2xl sm:rounded-[28px] sm:p-10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10"><Globe2 className="h-6 w-6 text-yellow-300"/></span><p className="mt-6 text-[10px] uppercase tracking-[.2em] text-yellow-300">404 · outside study bounds</p><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">This route is not mapped.</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-stone-500">Return to the Sandtable globe workspace to configure, replay, or reopen a scenario.</p><Button asChild className="mt-6 h-11 w-full rounded-xl bg-yellow-400 text-[#181500] hover:bg-yellow-300 sm:w-auto"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/>Return to laboratory</Link></Button></section></main>;
}
