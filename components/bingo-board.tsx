"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHALLENGES } from "@/lib/guest"

interface BingoBoardProps {
  completed: number[]
}

export function BingoBoard({ completed }: BingoBoardProps) {
  const completedSet = new Set(completed)

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {CHALLENGES.map((c) => {
        const done = completedSet.has(c.id)
        return (
          <Link
            key={c.id}
            href={done ? "/bingo" : `/?challenge=${c.id}`}
            aria-label={`Opdracht ${c.id}: ${c.text}`}
            className={cn(
              "relative aspect-square rounded-lg border-2 p-1.5 sm:p-2 text-[10px] sm:text-xs leading-tight flex flex-col items-stretch justify-between transition-all overflow-hidden",
              done
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            <div className="flex items-start justify-between">
              <span className="font-bold text-primary/80 text-[10px] sm:text-xs">
                #{c.id}
              </span>
              {done && (
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </div>
            <p className={cn(
              "line-clamp-4 sm:line-clamp-5",
              done ? "text-foreground/80" : "text-foreground"
            )}>
              {c.text}
            </p>
          </Link>
        )
      })}
    </div>
  )
}
