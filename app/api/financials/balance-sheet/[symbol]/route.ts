import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils"

// Define the resource type for this endpoint
const RESOURCE_TYPE = "balance sheet statements"

// Use Next.js 13+ route segment config for better caching control
export const dynamic = "force-dynamic" // Default is auto
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase()
    const endpoint = `/api/financials/balance-sheet/${symbol}`

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
        const limit = Number.parseInt(url.searchParams.get("limit") || "4")
        const page = Number.parseInt(url.searchParams.get("page") || "0")
        const validatedLimit = Math.min(Math.max(limit, 1), 100)
        const validatedPage = Math.max(page, 0)
        const offset = validatedPage * validatedLimit

        // Generate a cache tag based on the request parameters
        const cacheTag = `balance-sheet-${symbol}-${validatedLimit}-${validatedPage}`

        console.log(
            `GET request received for balance sheet statement of ${symbol}. Limit: ${validatedLimit}, Page: ${validatedPage}, Offset: ${offset}`,
        )

        // Retrieve data directly here
        const {
            data: balanceSheets,
            error,
            count,
        } = await supabase
            .from("balance_sheet_statements")
            .select(
                `
        *
        `,
                { count: "exact" },
            )
            .eq("symbol", symbol)
            .order("date", { ascending: false })
            .range(offset, offset + validatedLimit - 1)

        if (error) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            console.error("Error retrieving balance sheet statements:", error)
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, { resourceType: RESOURCE_TYPE }),
                },
                { status: 500 },
            )
        }

        if (!balanceSheets || balanceSheets.length === 0) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.NO_DATA_FOUND, { resourceType: RESOURCE_TYPE, symbol }),
                },
                { status: 404 },
            )
        }

        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success", false)

        const totalPages = Math.ceil((count || 0) / validatedLimit)
        const successMessage = formatApiMessage(ApiResponse.DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            symbol,
            page: validatedPage + 1,
            totalPages,
            totalCount: count || 0,
        })

        // Create a response with improved cache headers
        const response = NextResponse.json({
            symbol,
            limit: validatedLimit,
            page: validatedPage,
            total_count: count || 0,
            balance_sheets: balanceSheets,
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
