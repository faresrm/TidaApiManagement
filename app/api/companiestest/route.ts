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

    // Fonction pour enregistrer l'usage de manière robuste
    const recordUsage = async (status: "success" | "error") => {
        try {
            if (!apiKeyValidation.valid) return

            console.log(`Enregistrement de l'utilisation (${cacheStatus}, ${status})`)
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                "/api/companies",
                status
            )
        } catch (logError) {
            console.error("Échec de l'enregistrement du log:", logError)
            // On ne relance pas l'erreur pour ne pas perturber le flux principal
        }
    }

    try {
        // Créer le client Supabase une seule fois
        supabase = await createClient()

        // Valider la clé API
        apiKeyValidation = await validateApiKey(request)
        console.log("Résultat de la validation de la clé API:", apiKeyValidation)

        if (!apiKeyValidation.valid) {
            await recordUsage("error")
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
        }

        // Vérifier les limites de taux
        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        console.log("Résultat de la vérification des limites:", rateLimitCheck)

        if (!rateLimitCheck.allowed) {
            await recordUsage("error")
            return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
        }

        const url = new URL(request.url)

        // Paramètres de pagination
        const page = Number.parseInt(url.searchParams.get("page") || "1")
        const limit = Number.parseInt(url.searchParams.get("limit") || "20")

        // Valider et limiter les paramètres de pagination
        const validatedLimit = Math.min(Math.max(limit, 1), 100)
        const validatedPage = Math.max(page, 1)
        const offset = (validatedPage - 1) * validatedLimit

        // Paramètres de filtrage
        const symbol = url.searchParams.get("symbol")
        const search = url.searchParams.get("search")
        const sector = url.searchParams.get("sector")
        const exchange = url.searchParams.get("exchange")
        const minMarketCap = url.searchParams.get("minMarketCap")
        const maxMarketCap = url.searchParams.get("maxMarketCap")

        // Clé de cache
        const cacheKey = `companies:${validatedPage}:${validatedLimit}:${symbol || ""}:${search || ""}:${sector || ""}:${exchange || ""}:${minMarketCap || ""}:${maxMarketCap || ""}`

        // Vérification du cache
        if (MEMORY_CACHE.has(cacheKey)) {
            const cachedEntry = MEMORY_CACHE.get(cacheKey)
            const cacheAge = Date.now() - cachedEntry.timestamp

            if (cacheAge < CACHE_DURATION * 1000) {
                cacheStatus = "HIT"
                await recordUsage("success")

                const ifNoneMatch = request.headers.get("If-None-Match")
                if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
                    const response = new Response(null, { status: 304 })
                    response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`)
                    response.headers.set("ETag", ifNoneMatch)
                    response.headers.set("X-Cache", "HIT-304")
                    return response
                }

                const response = NextResponse.json(cachedEntry.data)
                response.headers.set("X-Cache", "HIT")
                response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`)
                response.headers.set("ETag", cachedEntry.etag)
                return response
            } else {
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

        // Appliquer les filtres
        if (symbol) query = query.eq("symbol", symbol.toUpperCase())
        if (search) query = query.or(`symbol.ilike.%${search}%,company_name.ilike.%${search}%`)
        if (sector) query = query.eq("sector", sector)
        if (exchange) query = query.eq("exchange", exchange)
        if (minMarketCap) query = query.gte("market_cap", Number.parseFloat(minMarketCap))
        if (maxMarketCap) query = query.lte("market_cap", Number.parseFloat(maxMarketCap))

        // Pagination
        query = query.range(offset, offset + validatedLimit - 1)

        // Exécution de la requête
        const { data: companies, error, count } = await query

        if (error) {
            console.error("Erreur lors de la récupération des entreprises:", error)
            await recordUsage("error")
            throw error
        }

        // Récupération du nombre total
        const { count: totalCount, error: countError } = await supabase
            .from("companies")
            .select("*", { count: "exact", head: true })

        if (countError) {
            console.error("Erreur lors du comptage des entreprises:", countError)
        }

        // Préparation de la réponse
        const responseData = {
            companies,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: totalCount || 0,
                pages: totalCount ? Math.ceil(totalCount / validatedLimit) : 0,
            },
        }

        // Génération ETag
        const etag = `"${Buffer.from(JSON.stringify(responseData)).toString("base64").substring(0, 27)}"`

        // Mise en cache
        MEMORY_CACHE.set(cacheKey, {
            data: responseData,
            timestamp: Date.now(),
            etag: etag,
        })

        // Nettoyage du cache si nécessaire
        if (MEMORY_CACHE.size > 1000) {
            const entries = [...MEMORY_CACHE.entries()].sort((a, b) => {
                if (!a[1].timestamp) return -1
                if (!b[1].timestamp) return 1
                return a[1].timestamp - b[1].timestamp
            })

            for (let i = 0; i < 200 && i < entries.length; i++) {
                MEMORY_CACHE.delete(entries[i][0])
            }
        }

        await recordUsage("success")

        const response = NextResponse.json(responseData)
        response.headers.set("X-Cache", cacheStatus)
        response.headers.set("Cache-Control", `public, max-age=${CACHE_DURATION}`)
        response.headers.set("ETag", etag)

        return response

    } catch (error: any) {
        console.error("Erreur complète:", error)
        await recordUsage("error")

        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des entreprises" },
            { status: 500 },
        )
    }
}