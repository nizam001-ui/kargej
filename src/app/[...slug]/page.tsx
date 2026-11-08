import { redirect } from "next/navigation";
import { Dashboard, ExplorePage } from "@/components/route-page";
import { AuthPage } from "@/components/auth-page";
import { CategoryPage, InfoPage, ProfilePage } from "@/components/secondary-pages";
import { MessagesPage } from "@/components/messages-page";
import { ProfileSettingsPage } from "@/components/profile-settings-page";
import { getDashboardRows, getDashboardStats, getPublicProfileBySlug, getPublishedServices } from "@/lib/marketplace-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function Page({params,searchParams}:{params:Promise<{slug:string[]}>;searchParams:Promise<{q?:string;type?:string;conversation_id?:string}>}) {
  const [{slug},query]=await Promise.all([params,searchParams]);
  const path=slug.join("/");
  if(path.startsWith("dashboard/")){
    if(isSupabaseConfigured){
      const supabase=await createClient();
      const {data:claims}=await supabase.auth.getClaims();
      const userId=claims?.claims?.sub;
      if(typeof userId!=="string") redirect(`/login?next=${encodeURIComponent(`/${path}`)}`);
      const {data:profile}=await supabase.from("profiles").select("role").eq("id",userId).maybeSingle();
      if(!profile) redirect("/register/role");
      const targetRole=profile.role==="agency"?"freelancer":profile.role;
      if(slug[1]!==targetRole) redirect(`/dashboard/${targetRole}/overview`);
      if(slug.at(-1)==="messages"||slug.at(-1)==="customer-messages") return <MessagesPage role={targetRole} conversationId={query.conversation_id}/>;
      if(slug.at(-1)==="profile-settings") return <ProfileSettingsPage role={targetRole}/>;
      const liveRows=await getDashboardRows(userId,profile.role);
      const liveStats=await getDashboardStats(userId,profile.role);
      return <Dashboard slug={slug} liveRows={liveRows} liveStats={liveStats}/>;
    }
    return <Dashboard slug={slug}/>;
  }
  if(["login","register","register/role","forgot-password","reset-password","verify-email","verify-phone"].includes(path))return <AuthPage slug={slug}/>;
  if(["explore","online-services","local-services"].includes(path)){
    const initialServices=await getPublishedServices();
    return <ExplorePage title={path==="explore"?"Explore services":path==="online-services"?"Online services":"Local services near you"} kind={path==="online-services"?"Online":path==="local-services"?"Local":undefined} query={query.q||""} initialServices={initialServices}/>;
  }
  if(path==="categories"||path.startsWith("categories/"))return <CategoryPage slug={slug.at(-1)||""}/>;
  if(["about","how-it-works","pricing","contact","help","terms","privacy"].includes(path))return <InfoPage path={path}/>;
  if(["services","freelancers","providers","agencies"].includes(slug[0])){
    if(isSupabaseConfigured){
      const published=await getPublishedServices();
      const liveService=slug[0]==="services"?published.find((service)=>service.slug===slug.at(-1))||null:null;
      const livePerson=slug[0]==="freelancers"||slug[0]==="providers"||slug[0]==="agencies"?await getPublicProfileBySlug(slug.at(-1)||""):null;
      return <ProfilePage slug={slug} liveService={liveService} livePerson={livePerson}/>;
    }
    return <ProfilePage slug={slug}/>;
  }
  return <InfoPage path="about"/>;
}

