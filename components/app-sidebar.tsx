"use client";

import * as React from "react";
import {
  IconBriefcase,
  IconBuilding,
  IconContract,
  IconHome,
  IconBell,
  IconHistory,
  IconMail,
  IconPackage,
  IconReceipt,
  IconReceiptRefund,
  IconTrendingUp,
  IconTypeface,
  IconUser,
  IconUserCircle,
  IconUserCog,
} from "@tabler/icons-react";

import { Handshake } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";

import { NavMain } from "@/components/nav-main";
import { NavSettings } from "@/components/nav-settings";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { userLoginRequest } from "@/store/actions/user-actions";

const data = {
  navMain: [
    {
      title: "Home",
      url: "/admin/home",
      icon: IconHome,
    },

    {
      title: "Revenue",
      url: "/admin/revenue",
      icon: IconTrendingUp,
    },

    {
      title: "P&L",
      url: "/admin/pl",
      icon: IconBriefcase,
    },
  ],
  settings: [
    {
      title: "Notifications",
      url: "/admin/notifications",
      icon: IconBell,
    },

    {
      title: "Contract Type",
      url: "/admin/contract-type",
      icon: IconContract,
    },

    {
      title: "Service Type",
      url: "/admin/service-type",
      icon: IconTypeface,
    },

    {
      title: "Billing Plan",
      url: "/admin/billing-plan",
      icon: IconReceipt,
    },

    {
      title: "Credit Note",
      url: "/admin/credit-note",
      icon: IconReceiptRefund,
    },

    {
      title: "Contract Duration",
      url: "/admin/contract-duration",
      icon: IconContract,
    },

    {
      title: "Customer",
      url: "/admin/customer",
      icon: IconUserCircle,
    },

    {
      title: "Vendor",
      url: "/admin/vendor",
      icon: Handshake,
    },

    {
      title: "Company",
      url: "/admin/company",
      icon: IconBuilding,
    },

    {
      title: "Users",
      url: "/admin/users",
      icon: IconUser,
    },

    {
      title: "Roles",
      url: "/admin/roles",
      icon: IconUserCog,
    },

    {
      title: "Module",
      url: "/admin/module",
      icon: IconPackage,
    },

    {
      title: "Activity Log",
      url: "/admin/activity-log",
      icon: IconHistory,
    },

    {
      title: "Email",
      url: "/admin/email",
      icon: IconMail,
    },
  ],

  navSecondary: [],
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name?: string;
    email?: string;
    image?: string;
    allowedRoutes?: string[];
    role?: string;
  };

  configuration?: {
    name?: string | null;
    logo?: string | null;
  };
};

function filterNav<
  T extends { url?: string; permissionUrl?: string; items?: { url: string }[] },
>(navMain: T[], allowedRoutes: string[], role?: string): T[] {
  const isAdmin = role?.toLowerCase().includes("admin");
  const normalizedAllowedRoutes = allowedRoutes.filter(Boolean);

  if (isAdmin) {
    return navMain;
  }

  return navMain
    .map((item) => {
      if (!item.items) {
        return item;
      }

      return {
        ...item,
        items: item.items.filter((subItem) =>
          normalizedAllowedRoutes.includes(subItem.url),
        ),
      };
    })
    .filter((item) => {
      if (item.url === "/admin/home" || item.url === "/admin/notifications") {
        return true;
      }

      if (item.items) {
        return item.items.length > 0;
      }

      return normalizedAllowedRoutes.includes(item.permissionUrl ?? item.url!);
    });
}

export function AppSidebar({
  user,
  configuration,
  ...props
}: AppSidebarProps) {
  const dispatch = useDispatch();

  const allowedRoutes = user?.allowedRoutes || [];

  const filteredNav = filterNav(data.navMain, allowedRoutes, user?.role);
  const filteredSettings = filterNav(data.settings, allowedRoutes, user?.role);

  React.useEffect(() => {
    dispatch(userLoginRequest(user));
  }, [dispatch, user]);

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      {...props}
      className="!border-r !border-[var(--sidebar-border)] !bg-[var(--sidebar)]"
    >
      <SidebarHeader className="border-b border-[var(--sidebar-border)] !bg-[var(--sidebar-logo-background)] px-3 py-3 text-[var(--sidebar-heading)] group-data-[collapsible=icon]:px-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto rounded-xl !bg-[var(--sidebar-logo-background)] p-2 !text-[var(--sidebar-heading)] transition-colors duration-200 hover:!bg-[var(--sidebar-hover-background)] hover:!text-[var(--sidebar-heading)] focus:!bg-[var(--sidebar-hover-background)] active:!bg-[var(--sidebar-hover-background)] data-[active=true]:!bg-[var(--sidebar-logo-background)] data-[active=true]:!text-[var(--sidebar-heading)] outline-none border border-transparent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl"
            >
              <Link href="/admin/home">
                <div className="flex w-full items-center gap-3 group-data-[collapsible=icon]:justify-center">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--sidebar-logo-background)] p-1">
                    <Image
                      src={configuration?.logo || "/sy.png"}
                      alt="Company logo"
                      width={32}
                      height={32}
                      className="size-8 rounded-lg object-contain brightness-0 invert"
                    />
                  </span>

                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-[10px] font-semibold tracking-[0.16em] text-[var(--sidebar-brand-kicker)]">
                      BILLING OPERATIONS
                    </p>
                    <p className="truncate text-sm font-bold text-[var(--sidebar-heading)]">
                      {configuration?.name?.toUpperCase() || "SY ASSOCIATES"}
                    </p>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="sidebar-scrollbar !bg-[var(--sidebar)] overflow-y-auto px-2 py-3 group-data-[collapsible=icon]:px-1">
        <NavMain items={filteredNav} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--sidebar-border)] !bg-[var(--sidebar)] px-2 py-3 group-data-[collapsible=icon]:px-1">
        <NavSettings items={filteredSettings} />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
