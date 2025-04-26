import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {validateApiKey, checkRateLimit, logUsage} from "@/lib/api-utils"

export async function GET(request: Request, { params }: { params: { symbol: string } }) {
    const symbol = params.symbol.toUpperCase()
    console.log(`Requête GET /api/companies/${params.symbol} reçue`)
    const endpoint = `/api/v1/stock/historical-price/${symbol}`;

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
            const supabase = await createClient();
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
        const symbol = params.symbol.toUpperCase()

        // Récupérer l'entreprise par symbole
        const { data: company, error } = await supabase
            .from("companies")
            .select(`
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
            .eq("symbol", symbol)
            .single()

        if (error) {
            if (error.code === "PGRST116") {
                return NextResponse.json({ error: `Entreprise avec le symbole ${symbol} non trouvée` }, { status: 404 })
            }
            console.error("Erreur lors de la récupération de l'entreprise:", error)
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            throw error
        }

        // Enregistrer l'utilisation
        // Record usage in usage_logs for success
        await logUsage(
            supabase,
            apiKeyValidation.userId,
            apiKeyValidation.keyId,
            endpoint,
            "success"
        );


        return NextResponse.json({ company })
    } catch (error: any) {
        console.error("Erreur complète:", error)

        // Essayer d'enregistrer l'erreur si possible
        try {
            const apiKeyValidation = await validateApiKey(request)
            if (apiKeyValidation.valid) {
                const supabase = await createClient();
                await logUsage(
                    supabase,
                    apiKeyValidation.userId,
                    apiKeyValidation.keyId,
                    endpoint,
                    "error"
                );
            }
        } catch (logError) {
            console.error("Erreur lors de l'enregistrement de l'erreur:", logError)
        }

        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération de l'entreprise" },
            { status: 500 },
        )
    }
}
