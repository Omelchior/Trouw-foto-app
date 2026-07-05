"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Target, Images, Info, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { isAppOpen } from "@/lib/bruiloft"

const openItems = [
  { href: "/bingo", label: "Bingo", icon: Target },
  { href: "/selectie", label: "Galerij", icon: Images },
  { href: "/info", label: "Info", icon: Info },
]

// Vóór de trouwdag is alleen de info te zien.
const geslotenItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/info", label: "Info", icon: Info },
]

export function Navigation() {
  const pathname = usePathname()
  const navItems = isAppOpen() ? openItems : geslotenItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
