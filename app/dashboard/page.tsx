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

  const { data: bonuses, error: bonusesError } = await supabase
    .from("joolo_bonus_resources")
    .select("id, name, description, file_type, image_url, drive_url")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  return (
    <DashboardHome
      email={user.email ?? ""}
      fullName={profile.full_name?.trim() || "friend"}
      onboardingCompletedAt={profile.onboarding_completed_at}
      bonuses={bonuses ?? []}
      bonusLoadError={
        bonusesError
          ? "Bonus tambahan belum dapat dimuat. Hubungi admin atau coba muat ulang halaman."
          : ""
      }
    />
  );
}
