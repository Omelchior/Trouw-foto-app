"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Target, Images, Info, Home, Shield, MonitorPlay } from "lucide-react"
import { cn } from "@/lib/utils"
import { effectiveOpen, OPDRACHTEN_OPEN } from "@/lib/bruiloft"
import { useOpenModus } from "@/lib/app-status"
import { getGuestSession, heeftBeheerToegang } from "@/lib/guest"

const openItems = [
  { href: "/", label: "Home", icon: Home },
  // Na de bruiloft staan de opdracht-foto's in de galerij (tabblad Opdrachten).
  ...(OPDRACHTEN_OPEN ? [{ href: "/opdracht", label: "Opdrachten", icon: Target }] : []),
  { href: "/selectie", label: "Galerij", icon: Images },
  // Info (programma, route, dresscode) is na de bruiloft niet meer nodig.
  { href: "/diavoorstelling", label: "Dia's", icon: MonitorPlay },
]

// Vóór de trouwdag is alleen de info te zien.
const geslotenItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/info", label: "Info", icon: Info },
]

const beheerItem = { href: "/admin", label: "Beheer", icon: Shield }

export function Navigation() {
  const pathname = usePathname()
  // Beheer en ceremoniemeesters zien het volledige menu ook vóór de trouwdag
  // (de middleware laat ze daar al doorheen); beheer/cm/fotograaf krijgen
  // bovendien een Beheer-knop in het menu.
  const [privileged, setPrivileged] = useState(false)
  const [beheerKnop, setBeheerKnop] = useState(false)
  const modus = useOpenModus()

  useEffect(() => {
    let active = true
    getGuestSession().then((s) => {
      if (!active || !s) return
      setPrivileged(s.is_privileged)
      setBeheerKnop(heeftBeheerToegang(s.role))
    })
    return () => {
      active = false
    }
  }, [])

  const basisItems = effectiveOpen(modus) || privileged ? openItems : geslotenItems
  const navItems = beheerKnop ? [...basisItems, beheerItem] : basisItems

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
