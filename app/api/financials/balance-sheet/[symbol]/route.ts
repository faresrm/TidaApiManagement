import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {validateApiKey, checkRateLimit, logUsage} from "@/lib/api-utils"

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase()
    console.log(`Requête GET /api/financials/balance-sheet/${symbol} reçue`)
    const endpoint = `/api/financials/balance-sheet/${symbol}`

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
        const limit = Number.parseInt(url.searchParams.get("limit") || "4")
        const page = Number.parseInt(url.searchParams.get("page") || "0")

        // Validation des paramètres
        const validatedLimit = Math.min(Math.max(limit, 1), 100) // Entre 1 et 100
        const validatedPage = Math.max(page, 0) // Page >= 0

        // Calcul de l'offset
        const offset = validatedPage * validatedLimit
        const from = offset
        const to = offset + validatedLimit - 1

        // Récupérer les bilans financiers avec pagination
        const { data: balanceSheets, error, count } = await supabase
            .from("balance_sheet_statements")
            .select(`
                *
            `, { count: 'exact' })
            .eq("symbol", symbol)
            .order("date", { ascending: false })
            .range(from, to)

        if (error) {
            console.error("Erreur lors de la récupération des bilans financiers:", error)
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            )
            throw error
        }

        if (!balanceSheets || balanceSheets.length === 0) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                { error: `Aucun bilan financier trouvé pour le symbole ${symbol}` },
                { status: 404 }
            )
        }

        // Record usage in usage_logs for success
        await logUsage(
            supabase,
            apiKeyValidation.userId,
            apiKeyValidation.keyId,
            endpoint,
            "success"
        );


        return NextResponse.json({
            symbol,
            limit: validatedLimit,
            page: validatedPage,
            total_count: count || 0,
            balance_sheets: balanceSheets,
        })
    } catch (error: any) {
        console.error("Erreur complète:", error)

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
                );
            }
        } catch (logError) {
            console.error("Erreur lors de l'enregistrement de l'erreur:", logError)
        }

        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des bilans financiers" },
            { status: 500 }
        )
    }
}