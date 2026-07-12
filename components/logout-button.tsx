"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const handleLogout = async () => {
    await createClient().auth.signOut()
    window.location.href = "/"
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Uitloggen"
    >
      <LogOut className="w-4 h-4 mr-2" />
      <span className="text-sm">Uitloggen</span>
    </Button>
  )
}
