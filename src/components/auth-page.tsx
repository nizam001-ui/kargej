"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/site-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const roleMap: Record<string, "client" | "freelancer" | "provider" | "agency"> = {
  Client: "client",
  Freelancer: "freelancer",
  "Local service provider": "provider",
  Agency: "agency",
};

export function AuthPage({ slug }: { slug: string[] }) {
  const path = slug.at(-1) ?? "login";
  const isRegister = path === "register";
  const isRoleSelect = path === "role";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState(() => ({ client: "Client", freelancer: "Freelancer", provider: "Local service provider", agency: "Agency" }[searchParams.get("role") || ""] || "Client"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phone, setPhone] = useState("");

  const title = path === "forgot-password" ? "Forgot your password?"
    : path === "reset-password" ? "Choose a new password"
      : path === "verify-email" ? "Verify your email"
        : path === "verify-phone" ? "Verify your phone"
          : isRoleSelect ? "How will you use Kárgéj?"
            : isRegister ? "Join a community built on good work" : "Welcome back";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      if (!isSupabaseConfigured) {
        setError("Supabase is not connected yet. Add the project URL and publishable key to .env.local, then restart the app.");
        return;
      }
      const supabase = createClient();
      if (isRegister) {
        const fullName = String(form.get("fullName") || "").trim();
        const role = roleMap[selectedRole];
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/${role}/overview`,
          },
        });
        if (authError) throw authError;
        if (data.session) router.push(`/dashboard/${role}/overview`);
        else setNotice("Account created. Check your email to confirm the address, then sign in.");
      } else if (path === "login") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        if (!data.user) throw new Error("Sign in did not return a user.");
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
        if (profileError) throw new Error("Your account was signed in, but the profile is missing. Apply the Supabase database migration first.");
        const role = profile?.role === "agency" ? "freelancer" : profile?.role || "client";
        router.push(`/dashboard/${role}/overview`);
      } else if (path === "forgot-password") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (authError) throw authError;
        setNotice("If an account uses that email, a password reset link is on its way.");
      } else if (path === "reset-password") {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice("Password updated. You can now sign in with your new password.");
      } else if (path === "verify-email") {
        const { error: authError } = await supabase.auth.resend({ type: "signup", email });
        if (authError) throw authError;
        setNotice("A new verification email has been sent.");
      } else if (path === "verify-phone") {
        const token = String(form.get("token") || "").trim();
        if (!phoneSent) {
          const { error: authError } = await supabase.auth.updateUser({ phone });
          if (authError) throw authError;
          setPhoneSent(true);
          setNotice("Enter the SMS code we sent to your phone.");
        } else {
          const { error: authError } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
          if (authError) throw authError;
          setNotice("Phone number verified.");
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <Link href="/" className="auth-back"><ArrowLeft size={16}/> Back to Kárgéj</Link>
    <div className="auth-card">
      <Logo/>
      <div className="auth-heading"><h1>{title}</h1><p>{isRoleSelect ? "Choose the option that best describes you. You can add another role later." : isRegister ? "Create your account to get started." : "Enter your details to continue."}</p></div>
      {isRoleSelect ? <>
        <div className="role-options">{Object.keys(roleMap).map((role) => <button type="button" key={role} className={`role-option ${selectedRole === role ? "selected" : ""}`} onClick={() => setSelectedRole(role)}><span className="role-radio">{selectedRole === role && <i/>}</span><span><b>{role}</b><small>{role === "Client" ? "Find and hire talented people" : role === "Freelancer" ? "Offer online services" : role === "Local service provider" ? "Serve customers in your city" : "Manage a team and projects"}</small></span><ArrowRight size={16}/></button>)}</div>
        <Link href={`/register?role=${roleMap[selectedRole]}`} className="button button-primary auth-submit">Continue as {selectedRole}<ArrowRight size={16}/></Link>
      </> : <form className="auth-form" onSubmit={submit}>
        {isRegister && <label>Full name<input name="fullName" required minLength={2} placeholder="Your name"/></label>}
        {(path === "login" || isRegister || path === "forgot-password" || path === "verify-email") && <label>Email address<input name="email" required type="email" autoComplete="email" placeholder="you@example.com"/></label>}
        {path === "verify-phone" && <label>Pakistan phone number<input name="phone" required type="tel" autoComplete="tel" placeholder="+92 3XX XXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)}/></label>}
        {path === "verify-phone" && phoneSent && <label>SMS verification code<input name="token" required inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the code"/></label>}
        {path === "login" && <label>Password<div className="password-field"><input name="password" required type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Your password"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>}
        {(isRegister || path === "reset-password") && <label>{path === "reset-password" ? "New password" : "Password"}<div className="password-field"><input name="password" required minLength={8} type={showPassword ? "text" : "password"} autoComplete={path === "reset-password" ? "new-password" : "new-password"} placeholder="At least 8 characters"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>{isRegister&&<small className="field-hint">Use 8 or more characters.</small>}</label>}
        {isRegister && <div className="register-role"><span>Account type</span><select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>{Object.keys(roleMap).map((role) => <option key={role}>{role}</option>)}</select></div>}
        {isRegister && <label className="check-label"><input name="terms" required type="checkbox"/>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link></label>}
        {path === "login" && <div className="auth-between"><label className="check-label"><input type="checkbox"/>Remember me</label><Link href="/forgot-password">Forgot password?</Link></div>}
        <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : path === "forgot-password" ? "Send reset link" : path === "verify-email" ? "Resend verification email" : path === "verify-phone" ? phoneSent ? "Verify phone" : "Send SMS code" : path === "reset-password" ? "Update password" : isRegister ? "Create account" : "Log in"}<ArrowRight size={16}/></button>
        {error && <p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="form-success"><Check size={14}/>{notice}</p>}
      </form>}
      {!isRoleSelect&&<p className="auth-switch">{isRegister ? "Already have an account?" : "New to Kárgéj?"} <Link href={isRegister ? "/login" : "/register/role"}>{isRegister ? "Log in" : "Create an account"}</Link></p>}
      <p className="auth-terms">By continuing, you agree to Kárgéj’s <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </div>
    <div className="auth-foot">© 2026 Kárgéj Marketplace <span>·</span> Made for good work</div>
  </main>;
}

