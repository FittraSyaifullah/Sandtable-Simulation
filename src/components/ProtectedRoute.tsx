import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Globe2 } from "lucide-react";
import { useSession } from "@/components/SessionProvider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#050505] text-stone-100"><div className="atlas-grid absolute inset-0 opacity-40"/><div className="relative flex flex-col items-center"><span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10"><Globe2 className="h-6 w-6 text-yellow-300"/></span><p className="mt-4 text-[10px] uppercase tracking-[.2em] text-stone-500">Restoring session</p></div></main>;
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
