import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getConfiguration } from "@/lib/actions/configuration";
import { getActiveCompanyContext } from "@/lib/company-context";
import { canAccess, getUserPermissions, visibleRoute } from "@/lib/rbac";
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

  const activeCompany = await getActiveCompanyContext();
  if (!activeCompany) redirect("/api/session/end");

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
      activeCompanyId: userRoles.activeCompanyId,
      activeCompanyName: userRoles.activeCompany.name,
    }
    : undefined;

  const configData = await getConfiguration();
  const configuration = configData
    ? {
      name: activeCompany.company.name || configData.name,
      logo: activeCompany.company.logo || configData.logo,
    }
    : undefined;

  return (
    <SidebarProvider
      defaultOpen={true}
      className="group/sidebar"
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "3.5rem",
          "--header-height": "4.75rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} configuration={configuration} />

      <SidebarInset
        className="min-w-0 bg-background transition-[margin] duration-300 ease-in-out"
      >
        <div className="sticky top-0 z-50 bg-background/95 px-3 py-2 backdrop-blur-xl sm:px-4 lg:px-6">
          <SiteHeader canViewNotifications={await canAccess("/admin/notifications", "view")} />
        </div>

        <div className="flex min-h-[calc(100svh-var(--header-height))] min-w-0 flex-1 flex-col">
          <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:gap-5 lg:p-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
