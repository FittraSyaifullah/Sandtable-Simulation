import { useState } from "react";
import { LogOut, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/SessionProvider";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export function UserMenu() {
  const { session, loading } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  if (loading || !session?.user) return null;

  const email = session.user.email ?? "Sandtable user";
  const signOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) toast.error("Could not sign out", { description: getAuthErrorMessage(error) });
  };

  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="stable-action h-11 max-w-[180px] rounded-xl border border-white/8 bg-white/[.025] px-2.5 text-stone-300 hover:bg-white/[.06]" aria-label="Open account menu"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-yellow-400/10 text-yellow-300"><UserRound className="h-3.5 w-3.5"/></span><span className="hidden min-w-0 truncate text-[10px] lg:block">{email}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 rounded-2xl border-white/10 bg-[#0c0c0c] p-2 text-stone-200"><DropdownMenuLabel className="p-3"><p className="text-[9px] uppercase tracking-[.16em] text-stone-600">Signed in</p><p className="mt-1 truncate text-xs font-normal text-stone-300">{email}</p></DropdownMenuLabel><DropdownMenuSeparator className="bg-white/8"/><DropdownMenuItem disabled className="h-10 rounded-xl text-xs text-stone-500"><Mail className="mr-3 h-4 w-4"/>Email account</DropdownMenuItem><DropdownMenuItem onSelect={signOut} disabled={signingOut} className="h-11 rounded-xl text-xs text-red-300 focus:bg-red-400/10 focus:text-red-200"><LogOut className="mr-3 h-4 w-4"/>{signingOut ? "Signing out…" : "Sign out"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
