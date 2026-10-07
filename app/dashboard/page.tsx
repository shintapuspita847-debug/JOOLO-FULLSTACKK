import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardHome from "./dashboard-home";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/?dashboard=login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, gender, age_group, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    redirect("/?dashboard=setup");
  }

  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  return (
    <DashboardHome
      email={user.email ?? ""}
      fullName={profile.full_name?.trim() || "friend"}
      onboardingCompletedAt={profile.onboarding_completed_at}
    />
  );
}
