"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconChevronUp } from "@tabler/icons-react"
import { SettingsIcon } from "lucide-react"

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

type SettingsItem = {
  title: string
  url: string
  icon?: React.ElementType
}

export function NavSettings({
  items,
}: {
  items: SettingsItem[]
}) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()

  if (!items.length) {
    return null
  }

  const activeItem = items.find((item) => pathname === item.url)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip="Settings"
              className="h-auto rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar)] px-3 py-3 text-[var(--sidebar-navigation-text)] transition-colors hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] data-[state=open]:bg-[var(--sidebar-hover-background)] data-[state=open]:text-[var(--sidebar-hover-foreground)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sidebar-settings-icon-background)] text-[var(--sidebar-active-foreground)]">
                <SettingsIcon className="size-5" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">Settings</span>
                <span className="truncate text-xs text-[var(--sidebar-settings-subtitle)]">
                  {activeItem?.title || `${items.length} options available`}
                </span>
              </div>
              <IconChevronUp className="ml-auto size-4 text-[var(--sidebar-navigation-icon)] group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60 rounded-xl border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-heading)] shadow-xl shadow-black/20"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={10}
          >
            <DropdownMenuLabel className="px-3 py-3 font-normal">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--sidebar-heading)]">Settings</p>
                <p className="text-xs text-[var(--sidebar-settings-subtitle)]">
                  Manage master data and access options
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {items.map((item) => (
                <DropdownMenuItem
                  key={item.title}
                  asChild
                  className={pathname === item.url
                    ? "bg-[var(--sidebar-active-background)] text-[var(--sidebar-active-foreground)] focus:bg-[var(--sidebar-active-background)] focus:text-[var(--sidebar-active-foreground)]"
                    : "text-[var(--sidebar-navigation-text)] focus:bg-[var(--sidebar-hover-background)] focus:text-[var(--sidebar-hover-foreground)]"}
                >
                  <Link href={item.url} className="cursor-pointer">
                    {item.icon && <item.icon className="size-4" />}
                    {item.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

    </SidebarMenu>
  )
}
