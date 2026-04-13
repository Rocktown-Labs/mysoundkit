
import { Home, Zap, DollarSign, Compass } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"

export function LandingMobileNav() {
  const [activeSection, setActiveSection] = useState("home")

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "features", "pricing"]
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = section === "home" ? document.body : document.getElementById(section)
        if (element) {
          const offsetTop = section === "home" ? 0 : element.offsetTop
          const offsetBottom = offsetTop + (section === "home" ? 500 : element.offsetHeight)

          if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (sectionId: string) => {
    if (sectionId === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      const element = document.getElementById(sectionId)
      if (element) {
        const offsetTop = element.offsetTop - 80
        window.scrollTo({ top: offsetTop, behavior: "smooth" })
      }
    }
  }

  const navItems = [
    { id: "home", label: "Home", icon: Home, isScroll: true },
    { id: "features", label: "Features", icon: Zap, isScroll: true },
    { id: "explore", label: "Explore", icon: Compass, isScroll: false, href: "/" },
    { id: "pricing", label: "Pricing", icon: DollarSign, isScroll: true },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          if (!item.isScroll && item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors",
                  "text-muted-foreground hover:text-primary",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          }

          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
