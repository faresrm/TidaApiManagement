import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
    validateApiKey,
    checkRateLimit,
    logUsage,
    ApiError,
    ApiResponse,
    formatApiMessage,
} from "@/lib/api-utils"
import { apiCache } from "@/lib/cache" // 🔥 Import du cache

const RESOURCE_TYPE = "companies"

export async function GET(request: Request) {
    const endpoint = `/api/companies`

    try {
        const supabase = await createClient()

        const apiKeyValidation = await validateApiKey(request)
        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
        }

        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        if (!rateLimitCheck.allowed) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                {
                    error: rateLimitCheck.error,
                },
                { status: 429 },
            )
        }

        const url = new URL(request.url)
        const limit = Number.parseInt(url.searchParams.get("limit") || "4")
        const page = Number.parseInt(url.searchParams.get("page") || "0")
        const validatedLimit = Math.min(Math.max(limit, 1), 100)
        const validatedPage = Math.max(page, 0)
        const offset = validatedPage * validatedLimit

        const sector = url.searchParams.get("sector")
        const industry = url.searchParams.get("industry")
        const exchange = url.searchParams.get("exchange")

        // 🔥 Génère une clé unique pour ce cache
        const cacheKey = `companies_${sector || "all"}_${industry || "all"}_${exchange || "all"}_${validatedPage}_${validatedLimit}`
        const cachedData = apiCache.get(cacheKey)

        if (cachedData) {
            // 🔥 Log même les requêtes en cache
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success")

            return NextResponse.json({
                ...cachedData,
                message: `[CACHED] ${cachedData.message}`,
            })
        }

        let query = supabase
            .from("companies")
            .select(
                `
                symbol,
                price,
                market_cap,
                beta,
                company_name,
                currency,
                exchange,
                industry,
                sector,
                country,
                is_etf,
                is_actively_trading
                `,
                { count: "exact" },
            )
            .order("market_cap", { ascending: false })
            .range(offset, offset + validatedLimit - 1)

        if (sector) query = query.eq("sector", sector)
        if (industry) query = query.eq("industry", industry)
        if (exchange) query = query.eq("exchange", exchange)

        const { data: companies, error, count } = await query

        if (error) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            console.error("Error retrieving companies:", error)
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, { resourceType: RESOURCE_TYPE }),
                },
                { status: 500 },
            )
        }

        if (!companies || companies.length === 0) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.NO_Company_DATA_FOUND, { resourceType: RESOURCE_TYPE }),
                },
                { status: 404 },
            )
        }

        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success")

        const totalPages = Math.ceil((count || 0) / validatedLimit)
        const successMessage = formatApiMessage(ApiResponse.COLLECTION_DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            page: validatedPage + 1,
            totalPages,
            totalCount: count || 0,
        })

        const responsePayload = {
            limit: validatedLimit,
            page: validatedPage,
            total_count: count || 0,
            companies,
            message: successMessage,
        }

        // 🔥 Met en cache pour les prochaines requêtes
        apiCache.set(cacheKey, responsePayload)

        return NextResponse.json(responsePayload)
    } catch (error: any) {
        console.error("Error processing the request:", error)
        try {
            const apiKeyValidation = await validateApiKey(request)
            if (apiKeyValidation.valid) {
                const supabase = await createClient()
                await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            }
        } catch (logError) {
            console.error("Error logging the error:", logError)
        }
        return NextResponse.json(
            {
                error: formatApiMessage(ApiResponse.PROCESSING_ERROR, {
                    resourceType: RESOURCE_TYPE,
                    details: error.message || "N/A",
                }),
            },
            { status: 500 },
        )
    }
}
