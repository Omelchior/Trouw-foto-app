"use client"

import { User } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function AdminAccessButton() {
  return (
    <Link href="/profiel">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Profiel"
      >
        <User className="w-4 h-4 mr-2" />
        <span className="text-sm">Profiel</span>
      </Button>
    </Link>
  )
}
