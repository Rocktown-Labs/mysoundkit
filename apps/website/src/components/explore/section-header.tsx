import type React from "react"
import { ChevronRight } from "lucide-react"
import { Link } from "@tanstack/react-router"

interface SectionHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  viewAllHref?: string
}

export function SectionHeader({ title, description, icon, viewAllHref }: SectionHeaderProps) {
  const content = (
    <div className="flex items-center justify-between group cursor-pointer">
      <div>
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {description && <p className="text-muted-foreground text-xs md:text-sm mt-1">{description}</p>}
      </div>
      {viewAllHref && (
        <ChevronRight className="size-5 md:size-6 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      )}
    </div>
  )

  if (viewAllHref) {
    return (
      <Link to={viewAllHref} className="block mb-3 md:mb-4 lg:mb-6">
        {content}
      </Link>
    )
  }

  return <div className="mb-3 md:mb-4 lg:mb-6">{content}</div>
}
