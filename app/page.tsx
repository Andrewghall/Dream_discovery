import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Route to the right dashboard based on role
  const tenantRoles = ['TENANT_ADMIN', 'TENANT_USER'];
  if (tenantRoles.includes(session.role)) {
    redirect("/tenant/dashboard");
  }

  redirect("/admin");
}
