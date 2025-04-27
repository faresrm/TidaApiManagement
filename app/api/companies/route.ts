import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils"

// Define the resource type for this endpoint
const RESOURCE_TYPE = "companies"

// Use Next.js 13+ route segment config for better caching control
export const dynamic = "force-dynamic" // Default is auto
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: Request) {
    const endpoint = `/api/companies`

    try {
        const supabase = await createClient()

        const apiKeyValidation = await validateApiKey(request)
        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: ApiError.INVALID_API_KEY }, { status: 401 })
        }

        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        if (!rateLimitCheck.allowed) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                {
                    error: ApiError.RATE_LIMIT_REACHED.replace(
                        "{limit}",
                        rateLimitCheck.error!.split("(")[1].split(" ")[0], // Extract the limit value
                    ),
                },
                { status: 429 },
            )
        }

        const url = new URL(request.url)
        const limit = Number.parseInt(url.searchParams.get("limit") || "20")
        const page = Number.parseInt(url.searchParams.get("page") || "0")
        const validatedLimit = Math.min(Math.max(limit, 1), 100)
        const validatedPage = Math.max(page, 0)
        const offset = validatedPage * validatedLimit

        // Optional filters
        const sector = url.searchParams.get("sector")
        const industry = url.searchParams.get("industry")
        const exchange = url.searchParams.get("exchange")

        // Generate a cache tag based on the request parameters
        const cacheTag = `companies-list-${validatedLimit}-${validatedPage}-${sector || ""}-${industry || ""}-${exchange || ""}`

        // Retrieve all companies with pagination
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

        // Apply filters if provided
        if (sector) {
            query = query.eq("sector", sector)
        }

        if (industry) {
            query = query.eq("industry", industry)
        }

        if (exchange) {
            query = query.eq("exchange", exchange)
        }

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
                    error: formatApiMessage(ApiResponse.NO_DATA_FOUND, { resourceType: RESOURCE_TYPE }),
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

        // Create a response with improved cache headers
        const response = NextResponse.json({
            limit: validatedLimit,
            page: validatedPage,
            total_count: count || 0,
            companies,
            message: successMessage,
            cached: true, // Add this to help with debugging
            cache_tag: cacheTag, // Add this to help with debugging
        })

        // Set more specific cache headers
        response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400")
        response.headers.set("CDN-Cache-Control", "public, max-age=3600")
        response.headers.set("Vercel-CDN-Cache-Control", "public, max-age=3600")
        response.headers.set("X-Cache-Tag", cacheTag)

        return response
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
