"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatItem {
  title: string;
  value: string | number;
  description: string;
  icon?: LucideIcon;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: number;
}

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-${columns}`}>
      {stats.map((stat, index) => (
        <Card key={index} className="bg-card/50 backdrop-blur-sm border-border/40 overflow-hidden relative group transition-all hover:border-primary/30">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/10 group-hover:bg-primary/40 transition-colors" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {stat.title}
            </CardTitle>
            {stat.icon && <stat.icon className="size-4 text-muted-foreground/50" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-[family-name:var(--font-playfair)]">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
