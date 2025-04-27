import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils"

// Define the resource type for this endpoint
const RESOURCE_TYPE = "historical prices"

// Use Next.js 13+ route segment config for better caching control
export const dynamic = "force-dynamic" // Default is auto
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase()
    const endpoint = `/api/v1/stock/historical-price/${symbol}`

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

        // Retrieve and validate date parameters
        const fromDate = url.searchParams.get("from")
        const toDate = url.searchParams.get("to")

        // Date validation
        if (!fromDate || !toDate) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json({ error: ApiResponse.MISSING_DATE_PARAMS }, { status: 400 })
        }

        const fromDateObj = new Date(fromDate)
        const toDateObj = new Date(toDate)

        if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json({ error: ApiResponse.INVALID_DATE_FORMAT }, { status: 400 })
        }

        if (fromDateObj > toDateObj) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json({ error: ApiResponse.INVALID_DATE_RANGE }, { status: 400 })
        }

        // Generate a cache tag based on the request parameters
        const cacheTag = `historical-price-${symbol}-${fromDate}-${toDate}`

        // Retrieve historical prices
        const { data: historicalPrices, error } = await supabase
            .from("historical_price")
            .select(
                `
        symbol,
        date,
        open,
        high,
        low,
        close,
        adj_close,
        volume,
        unadjusted_volume,
        change,
        change_percent,
        vwap,
        label,
        change_over_time
        `,
            )
            .eq("symbol", symbol)
            .gte("date", fromDate)
            .lte("date", toDate)
            .order("date", { ascending: false })

        if (error) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            console.error("Error retrieving historical prices:", error)
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, { resourceType: RESOURCE_TYPE }),
                },
                { status: 500 },
            )
        }

        if (!historicalPrices || historicalPrices.length === 0) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.NO_DATA_FOUND, { resourceType: RESOURCE_TYPE, symbol }),
                },
                { status: 404 },
            )
        }

        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success")

        const successMessage = formatApiMessage(ApiResponse.DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            symbol,
            page: 1,
            totalPages: 1,
            totalCount: historicalPrices.length,
        })

        // Create a response with improved cache headers
        const response = NextResponse.json({
            symbol,
            from_date: fromDate,
            to_date: toDate,
            count: historicalPrices.length,
            historical_prices: historicalPrices,
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
