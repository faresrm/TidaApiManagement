import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage } from "@/lib/api-utils"

// Cache en mémoire simple
const MEMORY_CACHE = new Map()
const CACHE_DURATION = 300 // 5 minutes en secondes

export async function GET(request: Request) {
    console.log("Requête GET /api/companies reçue")
    let cacheStatus = "MISS"
    let supabase: any
    let apiKeyValidation: any = { valid: false }

    try {
        // Créer le client Supabase une seule fois
        supabase = await createClient()

        // Valider la clé API
        apiKeyValidation = await validateApiKey(request)
        console.log("Résultat de la validation de la clé API:", apiKeyValidation)

        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
        }

        // Vérifier les limites de taux
        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        console.log("Résultat de la vérification des limites:", rateLimitCheck)

        if (!rateLimitCheck.allowed) {
            return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
        }

        const url = new URL(request.url)

        // Paramètres de pagination
        const page = Number.parseInt(url.searchParams.get("page") || "1")
        const limit = Number.parseInt(url.searchParams.get("limit") || "20")

        // Valider et limiter les paramètres de pagination pour éviter les abus
        const validatedLimit = Math.min(Math.max(limit, 1), 100) // Entre 1 et 100
        const validatedPage = Math.max(page, 1)
        const offset = (validatedPage - 1) * validatedLimit

        // Paramètres de filtrage et recherche
        const symbol = url.searchParams.get("symbol")
        const search = url.searchParams.get("search")
        const sector = url.searchParams.get("sector")
        const exchange = url.searchParams.get("exchange")
        const minMarketCap = url.searchParams.get("minMarketCap")
        const maxMarketCap = url.searchParams.get("maxMarketCap")

        // Générer une clé de cache basée sur les paramètres de la requête
        const cacheKey = `companies:${validatedPage}:${validatedLimit}:${symbol || ""}:${search || ""}:${sector || ""}:${exchange || ""}:${minMarketCap || ""}:${maxMarketCap || ""}`

        // Vérifier si nous avons une version mise en cache de cette requête
        if (MEMORY_CACHE.has(cacheKey)) {
            const cachedEntry = MEMORY_CACHE.get(cacheKey)
            const cacheAge = Date.now() - cachedEntry.timestamp

            // Si le cache est encore valide (moins de CACHE_DURATION secondes)
            if (cacheAge < CACHE_DURATION * 1000) {
                console.log(`Utilisation du cache pour ${cacheKey}, âge: ${cacheAge / 1000}s`)
                cacheStatus = "HIT"

                // IMPORTANT: Enregistrer l'utilisation AVANT de retourner la réponse
                console.log("Enregistrement de l'utilisation (cache hit)")
                // Utiliser await pour s'assurer que l'enregistrement est terminé
                await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, "/api/companies", "success")

                // Vérifier si le client a envoyé un en-tête If-None-Match (ETag)
                const ifNoneMatch = request.headers.get("If-None-Match")
                if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
                    // Le client a déjà la dernière version
                    const response = new Response(null, { status: 304 }) // Not Modified
                    response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`)
                    response.headers.set("ETag", ifNoneMatch)
                    response.headers.set("X-Cache", "HIT-304")
                    return response
                }

                // Retourner les données mises en cache avec les en-têtes de cache appropriés
                const response = NextResponse.json(cachedEntry.data)
                response.headers.set("X-Cache", "HIT")
                response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`)
                response.headers.set("ETag", cachedEntry.etag)
                return response
            } else {
                // Supprimer l'entrée expirée
                MEMORY_CACHE.delete(cacheKey)
            }
        }

        // Construire la requête de base
        let query = supabase.from("companies").select(`
        symbol,
        price,
        market_cap,
        beta,
        last_dividend,
        range,
        change,
        change_percentage,
        volume,
        average_volume,
        company_name,
        currency,
        cik,
        isin,
        cusip,
        exchange_full_name,
        exchange,
        industry,
        website,
        description,
        ceo,
        sector,
        country,
        full_time_employees,
        phone,
        address,
        city,
        state,
        zip,
        image,
        ipo_date,
        default_image,
        is_etf,
        is_actively_trading,
        is_adr,
        is_fund,
        altman_z_score,
        piotroski_score,
        working_capital,
        total_assets,
        retained_earnings,
        ebit,
        total_liabilities,
        revenue,
        type
      `)

        // Ajouter les filtres si présents
        if (symbol) {
            query = query.eq("symbol", symbol.toUpperCase())
        }

        if (search) {
            query = query.or(`symbol.ilike.%${search}%,company_name.ilike.%${search}%`)
        }

        if (sector) {
            query = query.eq("sector", sector)
        }

        if (exchange) {
            query = query.eq("exchange", exchange)
        }

        if (minMarketCap) {
            query = query.gte("market_cap", Number.parseFloat(minMarketCap))
        }

        if (maxMarketCap) {
            query = query.lte("market_cap", Number.parseFloat(maxMarketCap))
        }

        // Ajouter la pagination
        query = query.range(offset, offset + validatedLimit - 1)

        // Exécuter la requête
        const { data: companies, error, count } = await query

        if (error) {
            console.error("Erreur lors de la récupération des entreprises:", error)

            // Enregistrer l'erreur
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, "/api/companies", "error")

            throw error
        }

        // Récupérer le nombre total d'entreprises pour la pagination
        const { count: totalCount, error: countError } = await supabase
            .from("companies")
            .select("*", { count: "exact", head: true })

        if (countError) {
            console.error("Erreur lors du comptage des entreprises:", countError)
        }

        // Préparer la réponse
        const responseData = {
            companies,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: totalCount || 0,
                pages: totalCount ? Math.ceil(totalCount / validatedLimit) : 0,
            },
        }

        // Générer un ETag pour cette réponse
        const etag = `"${Buffer.from(JSON.stringify(responseData)).toString("base64").substring(0, 27)}"`

        // Stocker dans le cache en mémoire
        MEMORY_CACHE.set(cacheKey, {
            data: responseData,
            timestamp: Date.now(),
            etag: etag,
        })

        // Nettoyer le cache si nécessaire (simple gestion de la taille)
        if (MEMORY_CACHE.size > 1000) {
            // Supprimer les entrées les plus anciennes
            const entries = [...MEMORY_CACHE.entries()].sort((a, b) => {
                if (!a[1].timestamp) return -1
                if (!b[1].timestamp) return 1
                return a[1].timestamp - b[1].timestamp
            })

            // Supprimer les 200 entrées les plus anciennes
            for (let i = 0; i < 200 && i < entries.length; i++) {
                MEMORY_CACHE.delete(entries[i][0])
            }
        }

        // IMPORTANT: Enregistrer l'utilisation (cache miss) AVANT de retourner la réponse
        console.log("Enregistrement de l'utilisation (cache miss)")
        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, "/api/companies", "success")

        // Retourner les résultats avec les métadonnées de pagination et les en-têtes de cache
        const response = NextResponse.json(responseData)
        response.headers.set("X-Cache", cacheStatus)
        response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`)
        response.headers.set("ETag", etag)

        return response
    } catch (error: any) {
        console.error("Erreur complète:", error)

        // Enregistrer l'erreur
        try {
            if (apiKeyValidation.valid && supabase) {
                await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, "/api/companies", "error")
            }
        } catch (logError) {
            console.error("Erreur lors de l'enregistrement de l'erreur:", logError)
        }

        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des entreprises" },
            { status: 500 },
        )
    }
}
