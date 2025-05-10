import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsageAsync } from "@/lib/api-utils"
import { withCache } from "@/lib/cache-middleware"

export async function GET(request: Request) {
    const endpoint = "/api/optimized-companies"
    console.log(`GET ${endpoint} - Début`)

    try {
        // Valider la clé API
        const apiKeyValidation = await validateApiKey(request)
        if (!apiKeyValidation.valid) {
            console.log(`GET ${endpoint} - Validation de la clé API échouée`)
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
        }

        // Vérifier les limites de taux
        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        if (!rateLimitCheck.allowed) {
            console.log(`GET ${endpoint} - Limite de taux atteinte`)
            const supabase = await createClient()
            logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
        }

        console.log(`GET ${endpoint} - Validation OK, userId: ${apiKeyValidation.userId}`)

        // Utiliser le middleware de cache
        return await withCache(
            request,
            async () => {
                console.log(`GET ${endpoint} - Exécution de la requête (cache miss)`)
                const supabase = await createClient()
                const url = new URL(request.url)

                // Paramètres de pagination
                const page = Number.parseInt(url.searchParams.get("page") || "1")
                const limit = Number.parseInt(url.searchParams.get("limit") || "20")
                const validatedLimit = Math.min(Math.max(limit, 1), 100)
                const validatedPage = Math.max(page, 1)
                const offset = (validatedPage - 1) * validatedLimit

                // Exécuter la requête
                const {
                    data: companies,
                    error,
                    count,
                } = await supabase
                    .from("companies")
                    .select("*", { count: "exact" })
                    .range(offset, offset + validatedLimit - 1)

                if (error) {
                    console.error(`GET ${endpoint} - Erreur de requête:`, error)
                    logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
                    throw error
                }

                // Enregistrer l'utilisation
                console.log(`GET ${endpoint} - Requête réussie, enregistrement du log`)
                logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success")

                // Préparer la réponse
                return NextResponse.json({
                    companies,
                    pagination: {
                        page: validatedPage,
                        limit: validatedLimit,
                        total: count || 0,
                        pages: count ? Math.ceil(count / validatedLimit) : 0,
                    },
                })
            },
            {
                duration: 300, // 5 minutes
                varyByQuery: ["page", "limit", "symbol", "search", "sector", "exchange", "minMarketCap", "maxMarketCap"],
                maxSize: 1000,
            },
            apiKeyValidation.userId,
            apiKeyValidation.keyId,
            endpoint,
        )
    } catch (error: any) {
        console.error(`GET ${endpoint} - Erreur:`, error)

        try {
            const apiKeyValidation = await validateApiKey(request)
            if (apiKeyValidation.valid) {
                const supabase = await createClient()
                logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            }
        } catch (logError) {
            console.error(`GET ${endpoint} - Erreur lors de l'enregistrement de l'erreur:`, logError)
        }

        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des entreprises" },
            { status: 500 },
        )
    }
}
