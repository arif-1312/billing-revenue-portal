"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconLogout,
  IconSettings,
  IconUserCircle,
} from "@tabler/icons-react"
import { ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { logoutUser } from "@/lib/actions/users"

export function NavUser({
  user,
}: {
  user?: {
    name?: string
    email?: string
  }
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const isMounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const handleLogout = async () => {
    await logoutUser()
    router.push("/login")
  }

  if (!isMounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Admin profile"
            className="h-auto rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar)] px-2.5 py-2.5 text-[var(--sidebar-navigation-text)] transition-colors duration-200 hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-user-icon-background)] text-[var(--sidebar-navigation-icon)]">
              <IconUserCircle className="size-5" />
            </div>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium text-[var(--sidebar-heading)]">{user?.name || "Admin User"}</span>
              <span className="truncate text-xs text-[var(--sidebar-settings-subtitle)]">
                {user?.email || "No email available"}
              </span>
            </div>
            <ChevronDown className="ml-auto size-4 text-[var(--sidebar-navigation-icon)] transition-transform group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip="Admin profile"
              className="h-auto rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar)] px-2.5 py-2.5 text-[var(--sidebar-navigation-text)] transition-colors duration-200 hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] data-[state=open]:bg-[var(--sidebar-hover-background)] data-[state=open]:text-[var(--sidebar-hover-foreground)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-user-icon-background)] text-[var(--sidebar-navigation-icon)]">
                <IconUserCircle className="size-5" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium text-[var(--sidebar-heading)]">{user?.name || "Admin User"}</span>
                <span className="truncate text-xs text-[var(--sidebar-settings-subtitle)]">
                  {user?.email || "No email available"}
                </span>
              </div>
              <ChevronDown className="ml-auto size-4 text-[var(--sidebar-navigation-icon)] transition-transform group-data-[state=open]:rotate-180 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60 rounded-xl border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-heading)] shadow-lg shadow-black/20"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={10}
          >
            <DropdownMenuLabel className="px-3 py-3 font-normal">
              <div className="space-y-1">
                <p className="truncate text-sm font-semibold text-[var(--sidebar-heading)]">
                  {user?.name || "Admin User"}
                </p>
                <p className="truncate text-xs text-[var(--sidebar-settings-subtitle)]">
                  {user?.email || "No email available"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--sidebar-border)]" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                asChild
                className="text-[var(--sidebar-navigation-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] focus:bg-[var(--sidebar-hover-background)] focus:text-[var(--sidebar-hover-foreground)]"
              >
                <Link href="/admin/profile" className="cursor-pointer">
                  <IconUserCircle className="size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem
                asChild
                className="text-[var(--sidebar-navigation-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] focus:bg-[var(--sidebar-hover-background)] focus:text-[var(--sidebar-hover-foreground)]"
              >
                <Link href="/admin/configuration" className="cursor-pointer">
                  <IconSettings className="size-4" />
                  Configuration
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-[var(--sidebar-border)]" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-[var(--sidebar-navigation-text)] hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] focus:bg-[var(--sidebar-hover-background)] focus:text-[var(--sidebar-hover-foreground)]"
            >
              <IconLogout className="size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
