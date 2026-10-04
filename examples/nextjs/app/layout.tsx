import type { ReactNode } from 'react'
import { CuesheetProvider } from '@/cuesheet/CuesheetProvider'
import './globals.css'

export const metadata = { title: 'Coupons — cuesheet Next.js example' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CuesheetProvider>{children}</CuesheetProvider>
      </body>
    </html>
  )
}
