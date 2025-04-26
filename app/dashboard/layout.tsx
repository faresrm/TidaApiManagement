import type React from "react"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { UserNav } from "@/components/user-nav"
import { Database } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ThemeToggle } from "@/components/theme-toggle"
import { Toaster } from "@/components/ui/toaster"; // importe le composant

// Utiliser des chaînes de caractères pour les icônes
const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    title: "API Keys",
    href: "/dashboard/api-keys",
    icon: "Key",
  },
  {
    title: "Endpoints",
    href: "/dashboard/endpoints",
    icon: "Database",
  },
  {
    title: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: "CreditCard",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: "Settings",
  },
]

export default async function DashboardLayout({
                                                children,
                                              }: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  return (
      <div className="flex min-h-screen flex-col p-4">
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="container flex h-16 items-center justify-between py-4">
            <div className="flex items-center gap-2 font-bold">
              <Database className="h-5 w-5"/>
              <span>API Platform</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle/>
              <UserNav user={session.user}/>
            </div>
          </div>
        </header>
        <div className="container grid flex-1 gap-12 md:grid-cols-[200px_1fr]">
          <aside className="hidden w-[200px] flex-col md:flex">
            <DashboardNav items={navItems}/>
          </aside>
          <main className="flex w-full flex-1 flex-col overflow-hidden py-6">
            {children}
          </main>
        </div>

        {/* 👉 ajoute ce composant ici */}
        <Toaster/>
      </div>
  )
}
