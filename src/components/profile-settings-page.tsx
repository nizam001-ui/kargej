"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { cities } from "@/lib/data";

type Profile = { full_name: string; username: string | null; bio: string | null; city: string | null; area: string | null; phone: string | null; is_public: boolean };

export function ProfileSettingsPage({ role }: { role: string }) {
  const [profile, setProfile] = useState<Profile>({ full_name: "", username: "", bio: "", city: "", area: "", phone: "", is_public: true });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void fetch("/api/profile").then(async (response) => {
      const result = await response.json() as { data?: Profile; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load your profile.");
      if (result.data) setProfile(result.data);
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load your profile.")).finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const result = await response.json() as { data?: Profile; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save your profile.");
      if (result.data) setProfile(result.data);
      setSuccess("Your profile changes are saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally { setBusy(false); }
  }

  const change = (key: keyof Profile, value: string | boolean) => setProfile((current) => ({ ...current, [key]: value }));
  return <main className="settings-page"><header className="settings-top"><Link href={`/dashboard/${role}/overview`}><ArrowLeft size={16}/> Dashboard</Link><span>Kárgéj account</span></header><div className="settings-content"><p className="kicker">Your account</p><h1>Profile settings</h1><p>Keep your professional profile current so people in Balochistan can find the right fit.</p><form onSubmit={save} className="settings-form">{loading?<div className="settings-loading"><LoaderCircle size={18}/>Loading your profile…</div>:<><label>Full name<input required minLength={2} value={profile.full_name} onChange={(event)=>change("full_name",event.target.value)}/></label><label>Username<input value={profile.username||""} onChange={(event)=>change("username",event.target.value)} placeholder="A public profile URL"/></label><label>About you<textarea rows={5} maxLength={1200} value={profile.bio||""} onChange={(event)=>change("bio",event.target.value)} placeholder="What do you do, and how do you like to work?"/></label><div className="settings-row"><label>City<select value={profile.city||""} onChange={(event)=>change("city",event.target.value)}><option value="">Choose a Balochistan city</option>{cities.map((city)=><option key={city}>{city}</option>)}</select></label><label>Area<input value={profile.area||""} onChange={(event)=>change("area",event.target.value)} placeholder="Neighbourhood or area"/></label></div><label>Phone<input type="tel" value={profile.phone||""} onChange={(event)=>change("phone",event.target.value)} placeholder="+92 300 1234567"/></label><label className="check-label"><input type="checkbox" checked={profile.is_public} onChange={(event)=>change("is_public",event.target.checked)}/>Show my profile in marketplace search</label><div className="settings-actions"><button disabled={busy} className="button button-primary">{busy?"Saving…":"Save changes"}<Check size={15}/></button>{success&&<span className="form-success">{success}</span>}</div></>}{error&&<p className="form-error" role="alert">{error}</p>}</form><p className="settings-note">Your role and verification status can only be changed by marketplace administration.</p></div></main>;
}
