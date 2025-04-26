"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Key, Database, CreditCard, Settings, type LucideIcon } from "lucide-react"

// Mapper les noms d'icônes aux composants d'icônes
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Key,
  Database,
  CreditCard,
  Settings,
}

interface NavItem {
  title: string
  href: string
  icon: string // Maintenant c'est une chaîne de caractères
}

interface DashboardNavProps {
  items: NavItem[]
}

export function DashboardNav({ items }: DashboardNavProps) {
  const pathname = usePathname()

  return (
      <nav className="grid items-start gap-2">
        {items.map((item) => {
          // Obtenir le composant d'icône à partir du nom
          const Icon = iconMap[item.icon] || Database // Utiliser Database comme fallback
          return (
              <Link key={item.href} href={item.href}>
                <Button variant={pathname === item.href ? "secondary" : "ghost"} className="w-full justify-start">
                  <Icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
          )
        })}
      </nav>
  )
}
