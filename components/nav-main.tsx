"use client"

import Link from "next/link"
import type * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url?: string
  icon?: React.ElementType
  items?: {
    title: string
    url: string
    icon?: React.ElementType
  }[]
}

function isNavActive(url: string | undefined, pathname: string, search: string) {
  if (!url) return false
  const [path, query] = url.split("?")
  if (pathname !== path) return false
  if (!query) return !search.includes("tab=")
  return query.split("&").every((part) => search.split("&").includes(part))
}

const primaryButtonClass =
  "relative h-10 rounded-[11px] text-[var(--sidebar-navigation-text)] [&>svg]:text-[var(--sidebar-navigation-icon)] transition-colors duration-200 hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] hover:[&>svg]:text-[var(--sidebar-hover-foreground)] active:bg-[var(--sidebar-hover-background)] active:text-[var(--sidebar-hover-foreground)] group-data-[collapsible=icon]:rounded-[11px]"

const primaryActiveButtonClass =
  "relative h-10 rounded-[11px] bg-[var(--sidebar-active-background)] font-semibold text-[var(--sidebar-active-foreground)] [&>svg]:text-[var(--sidebar-active-foreground)] shadow-none before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-[var(--sidebar-active-indicator)] transition-colors duration-200 hover:bg-[var(--sidebar-active-background)] hover:text-[var(--sidebar-active-foreground)] active:bg-[var(--sidebar-active-background)] active:text-[var(--sidebar-active-foreground)] group-data-[collapsible=icon]:rounded-[11px]"

const subMenuButtonClass =
  "h-9 rounded-lg text-[var(--sidebar-navigation-text)] [&>svg]:text-[var(--sidebar-navigation-icon)] transition-colors duration-200 hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)] active:bg-[var(--sidebar-hover-background)] active:text-[var(--sidebar-hover-foreground)]"

const subMenuActiveButtonClass =
  "h-9 rounded-lg bg-[var(--sidebar-active-background)] font-medium text-[var(--sidebar-active-foreground)] [&>svg]:text-[var(--sidebar-active-foreground)] shadow-none transition-colors duration-200 hover:bg-[var(--sidebar-active-background)] hover:text-[var(--sidebar-active-foreground)]"

export function NavMain({
  items,
}: {
  items: NavItem[]
}) {
  const pathname = usePathname()
  const search = useSearchParams().toString()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:p-0">
      <SidebarGroupContent className="flex flex-col">
        <SidebarMenu className="gap-1.5">
          {items.map((item) => {
            if (item.items) {
              const isActive = item.items.some(
                (subItem) => pathname === subItem.url
              )

              return (
                <Collapsible
                  key={item.title}
                  defaultOpen={isActive}
                  className="w-full"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        className={
                          isActive
                            ? primaryActiveButtonClass
                            : primaryButtonClass
                        }
                      >
                        <div className="flex w-full items-center justify-between px-1 group-data-[collapsible=icon]:justify-center">
                          <div className="flex items-center gap-2 group-data-[collapsible=icon]:gap-0">
                            {item.icon && <item.icon />}
                            <span className="group-data-[collapsible=icon]:hidden">
                              {item.title}
                            </span>
                          </div>

                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[collapsible=icon]:hidden" />
                        </div>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-1 space-y-1 group-data-[collapsible=icon]:hidden">
                      {item.items.map((subItem) => (
                        <SidebarMenuButton
                          key={subItem.title}
                          asChild
                          className={
                            pathname === subItem.url
                              ? subMenuActiveButtonClass
                              : subMenuButtonClass
                          }
                        >
                          <Link
                            href={subItem.url}
                            className="flex w-full items-center gap-2 pl-10 pr-3"
                          >
                            {subItem.icon && <subItem.icon />}
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      ))}
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            // NORMAL MENU ITEMS
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={
                    isNavActive(item.url, pathname, search)
                      ? primaryActiveButtonClass
                      : primaryButtonClass
                  }
                >
                  <Link
                    href={item.url!}
                    className="flex w-full items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                  >
                    {item.icon && <item.icon />}
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
