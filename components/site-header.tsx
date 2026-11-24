"use client";

import * as React from "react";
import { ChevronDown, Moon, Search, Sun } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "next-themes";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { RootState } from "@/store/store";
import { userLogoutRequest } from "@/store/actions/user-actions";
import { logoutUser } from "@/lib/actions/users";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getMyCompanies, switchActiveCompany } from "@/lib/actions/company-context";

type HeaderUser = {
  name?: string;
  role?: string;
  allowedRoutes?: string[];
  activeCompanyId?: string;
  activeCompanyName?: string;
};

const searchablePages = [
  ["Home", "/admin/home"], ["Dashboard", "/admin/dashboard"], ["Revenue", "/admin/revenue"], ["P&L", "/admin/pl"],
  ["Notifications", "/admin/notifications"], ["Billing Plan", "/admin/billing-plan"],
  ["Credit Note", "/admin/credit-note"], ["Contract Type", "/admin/contract-type"],
  ["Contract Duration", "/admin/contract-duration"], ["Service Type", "/admin/service-type"],
  ["Customer", "/admin/customer"], ["Company", "/admin/company"], ["Vendor", "/admin/vendor"],
  ["Users", "/admin/users"], ["Roles", "/admin/roles"], ["Module", "/admin/module"],
  ["Activity Log", "/admin/activity-log"], ["Email", "/admin/email"],
] as const;

export function SiteHeader({ canViewNotifications }: { canViewNotifications: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.user.user as HeaderUser | undefined);
  const { resolvedTheme, setTheme } = useTheme();
  const dispatch = useDispatch();
  const isMounted = React.useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );
  const userInitial = user?.name?.trim().charAt(0).toUpperCase() || "U";
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [companies, setCompanies] = React.useState<Array<{ id: string; name: string }>>([]);
  const [switching, setSwitching] = React.useState(false);
  const isAdmin = user?.role?.toLowerCase().includes("admin");
  const pages = searchablePages.filter(([, href]) => href === "/admin/home" || href === "/admin/notifications" || isAdmin || user?.allowedRoutes?.includes(href));
  const currentPage = [...searchablePages]
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, href]) => pathname === href || pathname.startsWith(`${href}/`))?.[0] ?? "Billing operations";
  const results = search.trim()
    ? pages.filter(([label, href]) => `${label} ${href}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 5)
    : [];
  const goToResult = (href: string) => {
    setSearch("");
    setSearchOpen(false);
    router.push(href);
  };

  React.useEffect(() => {
    getMyCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const switchCompany = async (companyId: string) => {
    if (companyId === user?.activeCompanyId || switching) return;
    setSwitching(true);
    const result = await switchActiveCompany(companyId);
    if ("success" in result && result.success) router.refresh();
    setSwitching(false);
  };

  const handleLogout = async () => {
    dispatch(userLogoutRequest());
    await logoutUser();
  };

  return (
    <header className="flex h-[calc(var(--header-height)-1rem)] shrink-0 items-center gap-2 rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex w-full items-center gap-3 px-3 sm:px-4 lg:px-6">
        <SidebarTrigger className="rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground" />

        <Separator orientation="vertical" className="h-4" />

        {companies.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={switching} className="h-9 max-w-48 rounded-xl border-border bg-card text-foreground">
                <span className="truncate">{user?.activeCompanyName || "Company"}</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl border-border bg-popover text-popover-foreground">
              {companies.map((company) => (
                <DropdownMenuItem key={company.id} disabled={company.id === user?.activeCompanyId || switching} onClick={() => void switchCompany(company.id)}>
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            {currentPage}
          </p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Manage billing operations, master data, and revenue workflows.
          </p>
        </div>

        <div className="relative hidden w-52 lg:block xl:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search admin pages"
            aria-controls="admin-page-search-results"
            aria-autocomplete="list"
            placeholder="Search pages…"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) goToResult(results[0][1]);
              if (event.key === "Escape") setSearchOpen(false);
            }}
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/15"
          />
          {searchOpen && results.length > 0 ? (
            <div id="admin-page-search-results" role="listbox" className="absolute right-0 top-11 z-[60] w-full overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl">
              {results.map(([label, href]) => (
                <button key={href} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => goToResult(href)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent">
                  <Search className="size-3.5 text-muted-foreground" />{label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {canViewNotifications ? <NotificationBell /> : null}

        {isMounted ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="size-9 rounded-xl border-border bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground"
          >
            {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        ) : (
          <span aria-hidden="true" className="size-9" />
        )}

        {isMounted ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 max-w-48 rounded-xl border-border bg-card px-2 text-foreground shadow-sm hover:bg-secondary sm:pl-1.5 sm:pr-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{userInitial}</span>
                <span className="truncate">{user?.name || "User"}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-border bg-popover text-popover-foreground">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            className="h-9 max-w-48 rounded-xl border-border bg-card px-2 text-foreground shadow-sm hover:bg-secondary sm:pl-1.5 sm:pr-3"
            type="button"
          >
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{userInitial}</span>
            <span className="truncate">{user?.name || "User"}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
