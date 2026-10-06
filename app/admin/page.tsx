import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "./admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/?admin=login");
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_joolo_admin",
  );

  if (adminError) {
    redirect("/?admin=setup");
  }

  if (!isAdmin) {
    redirect("/?admin=required");
  }

  return <AdminDashboard email={user.email ?? ""} />;
}
