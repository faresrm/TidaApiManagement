import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logUsage } from "@/lib/api-utils"

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
    console.log(`withCache - Clé de cache: ${cacheKey}`)

    const supabase = await createClient()

    if (MEMORY_CACHE.has(cacheKey)) {
        const cachedEntry = MEMORY_CACHE.get(cacheKey)
        const cacheAge = Date.now() - cachedEntry.timestamp

        if (cacheAge < options.duration * 1000) {
            console.log(`withCache - Cache HIT pour ${cacheKey}, âge: ${cacheAge / 1000}s`)

            if (userId && keyId && endpoint) {
                console.log(`withCache - Logging pour cache HIT: userId=${userId}, endpoint=${endpoint}`)
                await logUsage(supabase, userId, keyId, endpoint, "success")
            }

            const response = NextResponse.json(cachedEntry.data)
            response.headers.set("X-Cache", "HIT")
            response.headers.set("Cache-Control", `public, max-age=${options.duration}`)
            response.headers.set("ETag", cachedEntry.etag)

            return response
        } else {
            MEMORY_CACHE.delete(cacheKey)
        }
    }

    console.log(`withCache - Cache MISS pour ${cacheKey}`)

    const response = await handler()

    const data = await response.clone().json()

    const etag = `"${Buffer.from(JSON.stringify(data)).toString("base64").substring(0, 27)}"`

    MEMORY_CACHE.set(cacheKey, {
        data,
        timestamp: Date.now(),
        etag,
    })

    if (options.maxSize && MEMORY_CACHE.size > options.maxSize) {
        console.log(`withCache - Nettoyage du cache, taille actuelle: ${MEMORY_CACHE.size}`)
        const entries = [...MEMORY_CACHE.entries()].sort((a, b) => {
            return a[1].timestamp - b[1].timestamp
        })

        for (let i = 0; i < Math.floor(options.maxSize * 0.2) && i < entries.length; i++) {
            MEMORY_CACHE.delete(entries[i][0])
        }
    }

    response.headers.set("X-Cache", "MISS")
    response.headers.set("Cache-Control", `public, max-age=${options.duration}`)
    response.headers.set("ETag", etag)

    return response
}