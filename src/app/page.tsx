import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Brush, Camera, Code2, Compass, MapPin, PenTool, Search, ShieldCheck, Sparkles, Star, Users, Wrench } from "lucide-react";
import { Header, Footer } from "@/components/site-shell";
import { ServiceCard, ProCard } from "@/components/marketplace";
import { categories, featuredPlaces } from "@/lib/data";
import { getPublicProfessionals, getPublishedServices } from "@/lib/marketplace-data";

const categoryIcons = [Code2, PenTool, Camera, BriefcaseBusiness, Brush, Wrench];

export default async function Home() {
  const [services, professionals] = await Promise.all([
    getPublishedServices(4),
    getPublicProfessionals(3),
  ]);
  return <><Header />
    <main>
      <section className="hero-wrap"><div className="hero container">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> Balochistan’s marketplace for getting things done</div>
          <h1>Find your people.<br/><span>Get things done.</span></h1>
          <p className="hero-lead">From a logo that feels like you to a plumber around the corner—find the right professional for what matters.</p>
          <form action="/explore" className="hero-search"><Search size={19}/><input name="q" placeholder="What are you looking for today?" aria-label="Search services"/><button className="button button-primary" type="submit">Explore services <ArrowRight size={16}/></button></form>
          <div className="hero-tags"><span>Popular:</span><Link href="/explore?q=logo">Logo design</Link><Link href="/explore?q=website">Website development</Link><Link href="/local-services">Home repair</Link></div>
          <div className="hero-trust"><div className="avatar-stack"><span>SA</span><span>MK</span><span>AH</span><span>+</span></div><p><strong>Good work starts with good people.</strong><br/>Meet Balochistan’s independent talent.</p></div>
        </div>
        <div className="hero-art" aria-label="Featured creative service"><div className="hero-image"/><div className="floating-note note-top"><span className="note-icon"><Sparkles size={17}/></span><div><b>Made for your brand</b><small>Thoughtful, original work</small></div></div><div className="floating-note note-bottom"><div className="mini-avatar">ZA</div><div><b>Zara Ahmed <BadgeCheck size={13} className="verified"/></b><small><Star size={12} fill="currentColor"/> 4.9 <span>·</span> Quetta, Balochistan</small></div><span className="online-indicator"/></div><div className="art-caption">Thoughtful work, by people who care.</div></div>
      </div></section>

      <section className="section container category-section"><div className="section-head"><div><p className="kicker">A good place to start</p><h2>What do you need done?</h2></div><Link className="text-link" href="/categories">Browse all categories <ArrowRight size={16}/></Link></div><div className="category-grid">{categories.slice(0,6).map((item,i)=>{const Icon=categoryIcons[i];return <Link href={`/categories/${item.slug}`} className="category-tile" key={item.slug}><span className="category-icon"><Icon size={20}/></span><span><b>{item.name}</b><small>{item.count} services</small></span><ArrowUpRight size={16} className="tile-arrow"/></Link>})}</div></section>

      <section className="section featured-section"><div className="container"><div className="section-head"><div><p className="kicker">A little inspiration</p><h2>Work worth a closer look</h2><p className="section-sub">A few ways our community can bring your next idea to life.</p></div><Link className="text-link" href="/explore">Explore all services <ArrowRight size={16}/></Link></div><div className="service-grid">{services.slice(0,4).map(s=><ServiceCard key={s.slug} service={s}/>)}</div></div></section>

      <section className="section container talent-section"><div className="section-head"><div><p className="kicker">People make the difference</p><h2>Good at what they do.<br className="desktop-break"/> Good to work with.</h2></div><Link className="text-link" href="/explore?type=people">Meet the community <ArrowRight size={16}/></Link></div><div className="pro-grid">{professionals.slice(0,3).map(p=><ProCard key={p.slug} person={p}/>)}</div></section>

      <section className="local-band"><div className="container local-inner"><div className="local-copy"><p className="kicker">Need a hand nearby?</p><h2>Great local work<br/>is closer than you think.</h2><p>Find trusted professionals for your home, your event, or your next big idea. Right here in your city.</p><Link href="/local-services" className="button button-primary">Find local services <ArrowRight size={16}/></Link><div className="cities"><MapPin size={15}/> Serving Quetta, Gwadar, Turbat &amp; more</div></div><div className="local-photo"><div className="local-card"><span className="local-pin"><MapPin size={17}/></span><div><b>Local, trusted, ready.</b><small>Professionals around your neighbourhood</small></div><ArrowUpRight size={17}/></div></div></div></section>

      <section className="places-section container"><div className="section-head"><div><p className="kicker">Rooted in Balochistan</p><h2>Find local help, place by place.</h2><p className="section-sub">From the provincial capital to the Makran coast and the highlands.</p></div><Link className="text-link" href="/local-services">Explore local services <ArrowRight size={16}/></Link></div><div className="places-grid">{featuredPlaces.map((place,i)=><Link className={`place-card place-tone-${i%6}`} href={`/local-services?q=${encodeURIComponent(place.serviceCity)}`} key={place.name}><span className="place-pin"><MapPin size={15}/></span><span className="place-label">{place.city}</span><b>{place.name}</b><small>{place.note}</small><span className="place-arrow"><ArrowUpRight size={15}/></span></Link>)}</div></section>

      <section className="section container how-section"><div className="section-head centered"><div><p className="kicker">Simple from the start</p><h2>Good work, without the runaround.</h2><p className="section-sub">Everything you need to find your fit and feel good about it.</p></div></div><div className="steps-grid"><div className="step"><span className="step-num">01</span><span className="step-icon"><Compass size={21}/></span><h3>Find your fit</h3><p>Explore services and people. Compare work, reviews, and pricing at your own pace.</p></div><div className="step"><span className="step-num">02</span><span className="step-icon"><Users size={21}/></span><h3>Talk it through</h3><p>Connect directly, share the details, and agree on what success looks like.</p></div><div className="step"><span className="step-num">03</span><span className="step-icon"><ShieldCheck size={21}/></span><h3>Get it done</h3><p>Keep things clear from first message to finished work, all in one place.</p></div></div></section>

      <section className="trust-band"><div className="container trust-inner"><span className="trust-icon"><ShieldCheck size={22}/></span><div><h3>Good people. Clear expectations.</h3><p>Verified profiles, honest reviews, and support when you need it. Kárgéj is built to make working together feel easy.</p></div><Link href="/how-it-works" className="text-link">How it works <ArrowRight size={16}/></Link></div></section>

      <section className="cta-section container"><div className="cta-card"><div><p className="kicker">Your next good thing starts here</p><h2>Ready to find your people?</h2><p>Tell us what you have in mind. There’s a good chance someone here can help.</p></div><div className="cta-actions"><Link href="/explore" className="button button-white">Explore services <ArrowRight size={16}/></Link><Link href="/register/role" className="button button-ghost">Join as a professional</Link></div><div className="cta-flower">✳</div></div></section>
    </main><Footer/></>
}




