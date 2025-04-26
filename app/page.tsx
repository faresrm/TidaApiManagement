import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Database, Key, Lock, RefreshCw } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
      <div className="flex min-h-screen flex-col p-4 ">
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="container flex h-16 items-center justify-between py-4">
            <div className="flex items-center gap-2 font-bold">
              <Database className="h-5 w-5" />
              <span>TidaTek API Platform</span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Connexion
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">S'inscrire</Button>
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <section className="container space-y-6 py-12 md:py-24 lg:py-32">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
              <h1 className="text-3xl font-bold leading-tight tracking-tighter sm:text-5xl md:text-6xl">
                Plateforme de gestion d'API avec limitations
              </h1>
              <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                Accédez à nos endpoints, gérez vos clés API et abonnez-vous à nos plans pour augmenter vos limites
                d'utilisation.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="gap-2">
                    Commencer <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button variant="outline" size="lg">
                    Documentation
                  </Button>
                </Link>
              </div>
            </div>
          </section>
          <section className="container py-12 md:py-24 lg:py-32">
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 text-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Gestion des clés API</h3>
                <p className="text-muted-foreground">Générez et gérez plusieurs clés API pour vos différents projets.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 text-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <RefreshCw className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Limitations personnalisées</h3>
                <p className="text-muted-foreground">
                  Chaque plan offre des limites d'appels quotidiens et des intervalles entre requêtes différents.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 text-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Sécurité avancée</h3>
                <p className="text-muted-foreground">
                  Authentification robuste et suivi détaillé de l'utilisation de vos API.
                </p>
              </div>
            </div>
          </section>
        </main>
        <footer className="border-t py-6 md:py-0">
          <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              &copy; {new Date().getFullYear()} TidaTek API Platform. Tous droits réservés.
            </p>
          </div>
        </footer>
      </div>
  )
}
