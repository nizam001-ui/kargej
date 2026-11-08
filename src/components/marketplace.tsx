"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Heart, MapPin, Star } from "lucide-react";
import type { Service } from "@/lib/data";
import { money } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

async function toggleSaved(event: React.MouseEvent<HTMLButtonElement>, professionalId: string, navigate: (url: string) => void) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const wasSaved = button.classList.contains("saved");
  if (!isSupabaseConfigured) {
    button.classList.toggle("saved");
    return;
  }
  const response = await fetch("/api/saved", {
    method: wasSaved ? "DELETE" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ professional_id: professionalId }),
  });
  if (response.status === 401) {
    navigate("/login?next=" + encodeURIComponent(window.location.pathname));
    return;
  }
  if (response.ok) button.classList.toggle("saved", !wasSaved);
}

export function ServiceCard({service,compact=false}:{service:Service;compact?:boolean}){const router=useRouter();return <article className={`service-card ${compact?"compact":""}`}><div className="service-image-link"><Link className="service-image-click" href={`/services/${service.slug}`}><div className="service-image" style={{backgroundImage:`url(https://images.unsplash.com/${service.image}?auto=format&fit=crop&w=900&q=85)`}}/></Link><span className={`service-kind ${service.kind.toLowerCase()}`}>{service.kind}</span><button aria-label="Save service provider" title="Save this professional" className="save-button" onClick={e=>void toggleSaved(e,service.sellerSlug,router.push)}><Heart size={17}/></button></div><div className="service-card-content"><div className="seller-line"><span className="seller-dot">{service.seller.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><Link href={`/${service.kind==="Online"?"freelancers":"providers"}/${service.sellerSlug}`}>{service.seller}</Link><BadgeCheck size={14} className="verified"/><span className="seller-city"><MapPin size={12}/>{service.location}</span></div><Link href={`/services/${service.slug}`} className="service-title">{service.title}</Link><div className="service-meta"><span><Star size={14} fill="currentColor"/> <b>{service.rating}</b> <i>({service.reviews})</i></span><span className="service-price">From <b>{money(service.price)}</b></span></div></div></article>}
export function ProCard({person}:{person:(typeof import("@/lib/data").professionals)[number]}){const router=useRouter();return <article className="pro-card"><div className="pro-top"><div className="pro-avatar" style={{backgroundImage:`url(https://images.unsplash.com/${person.image}?auto=format&fit=crop&w=200&q=80)`}}/><span className="pro-online"><i/> Available</span><button className="save-button" aria-label={`Save ${person.name}`} onClick={e=>void toggleSaved(e,person.slug,router.push)}><Heart size={17}/></button></div><Link href={`/freelancers/${person.slug}`} className="pro-name">{person.name} <BadgeCheck size={15} className="verified"/></Link><p className="pro-title">{person.title}</p><div className="pro-details"><span><MapPin size={13}/>{person.city}</span><span><Star size={14} fill="currentColor"/><b>{person.rating}</b> ({person.reviews})</span></div><div className="pro-tags">{person.tags.map(t=><span key={t}>{t}</span>)}</div><div className="pro-bottom"><span>{person.rate}</span><Link href={`/freelancers/${person.slug}`} aria-label={`View ${person.name}`}><ArrowUpRight size={17}/></Link></div></article>}


