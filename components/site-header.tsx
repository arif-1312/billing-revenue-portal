"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
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
  };

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 bg-white">
      <div className="flex w-full items-center gap-3 px-3 sm:px-4 lg:px-6">
        <SidebarTrigger className="rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50" />

        <Separator orientation="vertical" className="h-4" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-slate-900">
            Admin panel
          </p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            Manage billing operations, master data, and revenue workflows.
          </p>
        </div>

        <NotificationBell />

        {isMounted ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 max-w-44 rounded-lg border-slate-200 bg-white px-2.5 shadow-sm hover:bg-slate-50 sm:px-3">
                <span className="truncate">{user?.name || "User"}</span>
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
            className="h-9 max-w-44 rounded-lg border-slate-200 bg-white px-2.5 shadow-sm hover:bg-slate-50 sm:px-3"
            type="button"
          >
            <span className="truncate">{user?.name || "User"}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
