import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {validateApiKey, checkRateLimit, logUsage} from "@/lib/api-utils"

export async function GET(request: Request) {
    console.log("Requête GET /api/companies reçue")
    const endpoint = "/api/companies"

    try {
        // Valider la clé API
        const apiKeyValidation = await validateApiKey(request)
        console.log("Résultat de la validation de la clé API:", apiKeyValidation)

        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
        }

        // Vérifier les limites de taux
        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        console.log("Résultat de la vérification des limites:", rateLimitCheck)

        if (!rateLimitCheck.allowed) {
            const supabase = await createClient()
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
        }

        const supabase = await createClient()
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
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            console.error("Erreur lors de la récupération des entreprises:", error)
            throw error
        }

        // Récupérer le nombre total d'entreprises pour la pagination
        const { count: totalCount, error: countError } = await supabase
            .from("companies")
            .select("*", { count: "exact", head: true })

        if (countError) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            console.error("Erreur lors du comptage des entreprises:", countError)
        }

        // Enregistrer l'utilisation
        await logUsage(
            supabase,
            apiKeyValidation.userId,
            apiKeyValidation.keyId,
            endpoint,
            "success"
        )

        // Retourner les résultats avec les métadonnées de pagination
        return NextResponse.json({
            companies,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: totalCount || 0,
                pages: totalCount ? Math.ceil(totalCount / validatedLimit) : 0,
            },
        })
    } catch (error: any) {
        console.error("Erreur complète:", error)

        // Essayer d'enregistrer l'erreur si possible
        try {
            const apiKeyValidation = await validateApiKey(request)
            if (apiKeyValidation.valid) {
                const supabase = await createClient()
                await logUsage(
                    supabase,
                    apiKeyValidation.userId,
                    apiKeyValidation.keyId,
                    endpoint,
                    "error"
                )
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
