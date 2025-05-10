import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logUsageAsync } from "@/lib/api-utils"

// Type pour les options de cache
interface CacheOptions {
    duration: number // Durée en secondes
    varyByQuery?: string[] // Paramètres de requête à inclure dans la clé de cache
    varyByHeader?: string[] // En-têtes à inclure dans la clé de cache
    maxSize?: number // Taille maximale du cache
}

// Cache en mémoire global
const MEMORY_CACHE = new Map()

// Fonction pour générer une clé de cache
function generateCacheKey(request: Request, options: CacheOptions): string {
    const url = new URL(request.url)
    const path = url.pathname

    // Inclure les paramètres de requête spécifiés
    const queryParams: Record<string, string> = {}
    if (options.varyByQuery) {
        for (const param of options.varyByQuery) {
            const value = url.searchParams.get(param)
            if (value) {
                queryParams[param] = value
            }
        }
    }

    // Inclure les en-têtes spécifiés
    const headers: Record<string, string> = {}
    if (options.varyByHeader) {
        for (const header of options.varyByHeader) {
            const value = request.headers.get(header)
            if (value) {
                headers[header] = value
            }
        }
    }

    // Générer la clé de cache
    return `${path}:${JSON.stringify(queryParams)}:${JSON.stringify(headers)}`
}

// Middleware de cache
export async function withCache(
    request: Request,
    handler: () => Promise<NextResponse>,
    options: CacheOptions,
    userId?: string,
    keyId?: string,
    endpoint?: string,
): Promise<NextResponse> {
    const cacheKey = generateCacheKey(request, options)

    // Vérifier si la réponse est dans le cache
    if (MEMORY_CACHE.has(cacheKey)) {
        const cachedEntry = MEMORY_CACHE.get(cacheKey)
        const cacheAge = Date.now() - cachedEntry.timestamp

        // Si le cache est encore valide
        if (cacheAge < options.duration * 1000) {
            // Enregistrer l'utilisation de manière asynchrone si les identifiants sont fournis
            if (userId && keyId && endpoint) {
                const supabase = await createClient()
                logUsageAsync(supabase, userId, keyId, endpoint, "success")
            }

            // Reconstruire la réponse à partir du cache
            const response = NextResponse.json(cachedEntry.data)
            response.headers.set("X-Cache", "HIT")
            response.headers.set("Cache-Control", `public, max-age=${options.duration}`)
            response.headers.set("ETag", cachedEntry.etag)

            return response
        } else {
            // Supprimer l'entrée expirée
            MEMORY_CACHE.delete(cacheKey)
        }
    }

    // Exécuter le gestionnaire pour obtenir la réponse
    const response = await handler()

    // Extraire les données de la réponse
    const data = await response.clone().json()

    // Générer un ETag
    const etag = `"${Buffer.from(JSON.stringify(data)).toString("base64").substring(0, 27)}"`

    // Stocker dans le cache
    MEMORY_CACHE.set(cacheKey, {
        data,
        timestamp: Date.now(),
        etag,
    })

    // Nettoyer le cache si nécessaire
    if (options.maxSize && MEMORY_CACHE.size > options.maxSize) {
        const entries = [...MEMORY_CACHE.entries()].sort((a, b) => {
            return a[1].timestamp - b[1].timestamp
        })

        for (let i = 0; i < Math.floor(options.maxSize * 0.2) && i < entries.length; i++) {
            MEMORY_CACHE.delete(entries[i][0])
        }
    }

    // Ajouter les en-têtes de cache à la réponse
    response.headers.set("X-Cache", "MISS")
    response.headers.set("Cache-Control", `public, max-age=${options.duration}`)
    response.headers.set("ETag", etag)

    return response
}
