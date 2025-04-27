import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils"

// Define the resource type for this endpoint
const RESOURCE_TYPE = "company information"

// Use Next.js 13+ route segment config for better caching control
export const dynamic = "force-dynamic" // Default is auto
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: Request, { params }: { params: { symbol: string } }) {
    const symbol = params.symbol.toUpperCase()
    const endpoint = `/api/companies/${symbol}`

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

        // Generate a cache tag based on the request parameters
        const cacheTag = `company-${symbol}`

        // Retrieve company by symbol
        const { data: company, error } = await supabase
            .from("companies")
            .select(
                `
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
      `,
            )
            .eq("symbol", symbol)
            .single()

        if (error) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            if (error.code === "PGRST116") {
                return NextResponse.json(
                    {
                        error: formatApiMessage(ApiResponse.NO_DATA_FOUND, { resourceType: RESOURCE_TYPE, symbol }),
                    },
                    { status: 404 },
                )
            }
            console.error("Error retrieving company information:", error)
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, { resourceType: RESOURCE_TYPE }),
                },
                { status: 500 },
            )
        }

        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success", false)

        const successMessage = formatApiMessage(ApiResponse.DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            symbol,
            page: 1,
            totalPages: 1,
            totalCount: 1,
        })

        // Create a response with improved cache headers
        const response = NextResponse.json({
            company,
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
