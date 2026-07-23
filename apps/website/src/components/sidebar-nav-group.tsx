import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuAction,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export interface SidebarNavSubItem {
  isActive?: boolean;
  title: string;
  url: string;
}

export interface SidebarNavItem {
  icon?: LucideIcon;
  isActive?: boolean;
  items?: SidebarNavSubItem[];
  title: string;
  url?: string;
}

interface SidebarNavGroupProps {
  items: SidebarNavItem[];
  label: string;
}

export function SidebarNavGroup({ items, label }: SidebarNavGroupProps) {
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        items
          .filter((item) => item.items?.length && item.isActive)
          .map((item) => [item.title, true])
      )
  );

  React.useEffect(() => {
    setOpenItems((currentState) => {
      let hasChanged = false;
      const nextState = { ...currentState };

      for (const item of items) {
        if (item.items?.length && item.isActive && !nextState[item.title]) {
          nextState[item.title] = true;
          hasChanged = true;
        }
      }

      return hasChanged ? nextState : currentState;
    });
  }, [items]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (!item.items?.length) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.isActive}
                    tooltip={item.title}
                  >
                    <Link
                      to={item.url ?? "/"}
                      activeProps={{
                        className:
                          "text-purple-500 font-bold dark:text-purple-400",
                      }}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            const isOpen = openItems[item.title] ?? item.isActive ?? false;

            return (
              <Collapsible
                key={item.title}
                asChild
                className="group/collapsible"
                open={isOpen}
                onOpenChange={(open) => {
                  setOpenItems((currentState) => ({
                    ...currentState,
                    [item.title]: open,
                  }));
                }}
              >
                <SidebarMenuItem>
                  {item.url ? (
                    <SidebarMenuButton
                      asChild
                      className="pr-8"
                      isActive={item.isActive}
                      tooltip={item.title}
                    >
                      <Link
                        to={item.url}
                        activeProps={{
                          className:
                            "text-purple-500 font-bold dark:text-purple-400",
                        }}
                      >
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={item.isActive}
                        tooltip={item.title}
                      >
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  )}
                  {item.url ? (
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        aria-label={`Toggle ${item.title}`}
                        showOnHover={true}
                      >
                        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                  ) : null}
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={subItem.isActive}
                          >
                            <Link
                              to={subItem.url}
                              activeProps={{
                                className:
                                  "text-purple-500 font-bold dark:text-purple-400",
                              }}
                            >
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
