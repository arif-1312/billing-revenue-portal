"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";

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

type HeaderUser = {
  name?: string;
};

export function SiteHeader() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.user.user as HeaderUser | undefined);
  const dispatch = useDispatch();
  const isMounted = React.useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  const handleLogout = async () => {
    dispatch(userLogoutRequest());
    await logoutUser();
    router.push("/login");
  };

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 bg-transparent">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 rounded-xl border border-sky-100 bg-white/90 shadow-sm hover:bg-sky-50" />

        <Separator orientation="vertical" className="h-4" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold tracking-[0.18em] text-sky-700">
            ADMIN PANEL
          </p>
          <p className="truncate text-sm text-slate-500">
            Manage billing operations, master data, and revenue workflows.
          </p>
        </div>

        <NotificationBell />

        {isMounted ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl border-sky-100 bg-white/90 shadow-sm hover:bg-sky-50">
                <span>{user?.name || "User"}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-sky-100">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            className="h-10 rounded-xl border-sky-100 bg-white/90 shadow-sm hover:bg-sky-50"
            type="button"
          >
            <span>{user?.name || "User"}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
