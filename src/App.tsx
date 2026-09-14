import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Share from "./pages/Share";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function HomeRoute() {
  const { session, loading } = useSession();
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#050505] text-stone-100"><div className="flex flex-col items-center"><span className="h-3 w-3 animate-pulse rounded-full bg-yellow-300 shadow-[0_0_18px_rgba(250,204,21,.7)]"/><p className="mt-4 text-[10px] uppercase tracking-[.2em] text-stone-600">Opening Sandtable</p></div></main>;
  return session ? <Index /> : <Landing />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/share/:token" element={<Share />} />
            <Route path="/" element={<HomeRoute />} />
            <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
          </Routes>
        </SessionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
