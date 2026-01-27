import React from "react"
import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Lato } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _playfair = Playfair_Display({ subsets: ["latin"], variable: '--font-serif' });
const _lato = Lato({ subsets: ["latin"], weight: ["300", "400", "700"], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Bruiloft Foto App',
  description: 'Deel je mooiste momenten van de bruiloft',
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: '#b08968',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl">
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
