"use client"

import { Shield } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function AdminAccessButton() {
  return (
    <Link href="/admin/login">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Admin login toegang"
      >
        <Shield className="w-4 h-4 mr-2" />
        <span className="text-sm">Admin</span>
      </Button>
    </Link>
  )
}
