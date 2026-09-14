import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Check, Globe2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/SessionProvider";
import { supabase } from "@/integrations/supabase/client";
import "./Login.css";

type AuthView = "sign_in" | "sign_up";

export default function Login() {
  const [view, setView] = useState<AuthView>("sign_in");
  const { session, loading, authError, clearAuthError } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (!loading && session) navigate(destination, { replace: true });
  }, [destination, loading, navigate, session]);

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#050505] text-stone-100">
    <div className="atlas-grid absolute inset-0 opacity-50"/>
    <div className="relative grid min-h-[100dvh] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/8 p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10"><Globe2 className="h-5 w-5 text-yellow-300"/></span><div><p className="text-sm font-semibold">Sandtable</p><p className="text-[9px] uppercase tracking-[.2em] text-stone-600">Scenario laboratory</p></div></div>
        <div className="relative mx-auto grid aspect-square w-full max-w-[520px] place-items-center rounded-full border border-white/10 bg-[#090909] shadow-[0_0_100px_rgba(250,204,21,.07)]"><div className="absolute inset-[12%] rounded-full border border-white/8"/><div className="absolute inset-[25%] rounded-full border border-yellow-400/15"/><Globe2 className="h-[42%] w-[42%] stroke-[.7] text-stone-600"/><span className="absolute left-[18%] top-[38%] h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_18px_rgba(250,204,21,.75)]"/><span className="absolute bottom-[28%] right-[22%] h-2 w-2 rounded-full bg-stone-300"/></div>
        <div><p className="max-w-xl text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">Transparent scenario exploration, with every assumption preserved.</p><div className="mt-6 flex flex-wrap gap-2">{["Deterministic seeds","Governed evidence","Read-only reports"].map(item=><span key={item} className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] text-stone-400">{item}</span>)}</div></div>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10"><Globe2 className="h-5 w-5 text-yellow-300"/></span><div><p className="text-sm font-semibold">Sandtable</p><p className="text-[9px] uppercase tracking-[.2em] text-stone-600">Scenario laboratory</p></div></div>
          <div className="rounded-[28px] border border-white/10 bg-[#0b0b0b]/95 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
            <div className="mb-6"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-yellow-300"><LockKeyhole className="h-3.5 w-3.5"/>Secure workspace</div><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{view === "sign_in" ? "Welcome back." : "Create your account."}</h1><p className="mt-2 text-sm leading-relaxed text-stone-500">{view === "sign_in" ? "Sign in to continue your scenario conversation." : "Use email and password to access the shared demonstration workspace."}</p></div>
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-black/40 p-1"><Button type="button" onClick={()=>{setView("sign_in");clearAuthError();}} variant="ghost" className={`h-10 rounded-lg text-xs ${view==="sign_in"?"bg-yellow-400 text-black hover:bg-yellow-300":"text-stone-500 hover:bg-white/5"}`}>Sign in</Button><Button type="button" onClick={()=>{setView("sign_up");clearAuthError();}} variant="ghost" className={`h-10 rounded-lg text-xs ${view==="sign_up"?"bg-yellow-400 text-black hover:bg-yellow-300":"text-stone-500 hover:bg-white/5"}`}>Sign up</Button></div>
            {authError&&<div role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/[.06] p-3 text-xs text-red-200">{authError}</div>}
            <div className="sandtable-auth-form">
              <Auth key={view} supabaseClient={supabase} view={view} providers={[]} showLinks={false} redirectTo={`${window.location.origin}/`} appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: "#facc15", brandAccent: "#fde047", brandButtonText: "#181500", defaultButtonBackground: "#141414", defaultButtonBackgroundHover: "#1f1f1f", defaultButtonBorder: "#333333", defaultButtonText: "#e7e5e4", dividerBackground: "#292929", inputBackground: "#080808", inputBorder: "#303030", inputBorderHover: "#525252", inputBorderFocus: "#facc15", inputText: "#f5f5f4", inputLabelText: "#a8a29e", inputPlaceholder: "#57534e", messageText: "#fca5a5", messageTextDanger: "#fca5a5", anchorTextColor: "#d6d3d1", anchorTextHoverColor: "#facc15" }, space: { inputPadding: "12px", buttonPadding: "12px" }, radii: { borderRadiusButton: "12px", buttonBorderRadius: "12px", inputBorderRadius: "12px" }, fonts: { bodyFontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", buttonFontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", inputFontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", labelFontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" } } }, className: { container: "auth-container", button: "auth-button", input: "auth-input", label: "auth-label", message: "auth-message" } }} theme="dark" localization={{ variables: view === "sign_in" ? { sign_in: { email_label: "Email address", password_label: "Password", button_label: "Sign in securely", loading_button_label: "Signing in…" } } : { sign_up: { email_label: "Email address", password_label: "Create password", button_label: "Create account", loading_button_label: "Creating account…" } } }}/>
            </div>
            <div className="mt-5 flex items-start gap-2 border-t border-white/8 pt-5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300"/><p className="text-[10px] leading-relaxed text-stone-600">Authentication protects access to the laboratory. Shared studies remain part of the current controlled demonstration workspace.</p></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">{[[Check,"Reviewable"],[Sparkles,"Reproducible"],[ShieldCheck,"Protected"]].map(([Icon,label])=><div key={label as string} className="flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-wider text-stone-600"><Icon className="h-3 w-3 text-yellow-300"/>{label as string}</div>)}</div>
        </div>
      </section>
    </div>
  </main>;
}
