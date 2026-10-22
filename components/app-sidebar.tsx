"use client";

import * as React from "react";
import {
  IconBriefcase,
  IconBuilding,
  IconContract,
  IconHome,
  IconHistory,
  IconPackage,
  IconReceipt,
  IconTrendingUp,
  IconTypeface,
  IconUser,
  IconUserCircle,
  IconUserCog,
} from "@tabler/icons-react";

import { Handshake, SettingsIcon } from "lucide-react";
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
      if (item.url === "/admin/home") {
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
      className="!border-r-0"
    >
      {/* HEADER */}
      <SidebarHeader className="bg-[linear-gradient(180deg,rgba(8,47,73,0.98),rgba(14,116,144,0.94),rgba(12,74,110,0.98))] px-3 py-3 text-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="
                h-auto rounded-2xl
                bg-white/6
                p-3
                text-white
                shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
                hover:bg-sky-500/15
                hover:text-white
                focus:bg-sky-500/15
                focus:text-white
                active:bg-sky-500/20
                data-[active=true]:bg-sky-500/20
                data-[active=true]:text-white
                outline-none
                border border-white/10
                group-data-[collapsible=icon]:justify-center
                group-data-[collapsible=icon]:rounded-xl
                group-data-[collapsible=icon]:p-2
              "
            >
              <Link href="/admin/home">
                <div className="flex w-full items-center gap-3">
                  <Image
                    src={configuration?.logo || "/sy.png"}
                    alt="logo"
                    width={44}
                    height={44}
                    className="rounded-xl bg-white/95 object-cover p-1 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.6)]"
                  />

                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100/65">
                      Operations Hub
                    </p>

                    <p className="truncate text-base font-semibold text-white">
                      {configuration?.name?.toUpperCase() ||
                        "SY ASSOCIATES"}
                    </p>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent className="sidebar-scrollbar overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.12),_transparent_20%),linear-gradient(180deg,#082f49_0%,#0f172a_100%)]">
        <NavMain items={filteredNav} />

        <NavSecondary
          items={data.navSecondary}
          className="mt-auto"
        />
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="bg-[#0f172a] px-3 py-3 text-white">
        <NavSettings items={filteredSettings} />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
