import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getConfiguration } from "@/lib/actions/configuration";
import { getUserPermissions, visibleRoute } from "@/lib/rbac";
import { isSignedInSession } from "@/lib/session-decision";
import { redirect } from "next/navigation";

type SessionUser = {
  user?: {
    email?: string | null;
  } | null;
} | null;

type RoleModule = {
  module: {
    route: string;
  };
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth() as SessionUser;

  if (!isSignedInSession(session)) {
    redirect(session ? "/api/session/end" : "/login");
  }

  const userRoles = await getUserPermissions();

  if (!userRoles) {
    redirect("/api/session/end");
  }

  const allowedRoutes = (userRoles.role?.roleModules || []).map(
    (roleModule: RoleModule) => visibleRoute(userRoles, roleModule.module.route),
  );

  const user = userRoles
    ? {
      name: userRoles.firstName || undefined,
      email: userRoles.email || undefined,
      allowedRoutes,
      role: userRoles.role?.name || undefined,
    }
    : undefined;

  const configData = await getConfiguration();
  const configuration = configData
    ? {
      name: configData.name,
      logo: configData.logo,
    }
    : undefined;

  return (
    <SidebarProvider
      defaultOpen={false}
      className="group/sidebar"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 76)",
          "--sidebar-width-icon": "calc(var(--spacing) * 14)", // ✅ important for icon mode
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} configuration={configuration} />

      <SidebarInset
        className="
          transition-[margin] duration-300 ease-in-out
          bg-[radial-gradient(circle_at_top,_rgba(186,230,253,0.28),_transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_50%,#f1f5f9_100%)]
        "
      >
        <div className="sticky top-0 z-50 border-b border-sky-100/80 bg-white/80 backdrop-blur-xl">
          <SiteHeader />
        </div>

        <div className="flex min-h-[calc(100svh-var(--header-height))] min-w-0 flex-1 flex-col">
          <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
