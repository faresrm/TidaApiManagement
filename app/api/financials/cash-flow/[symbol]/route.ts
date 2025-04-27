import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils"

export const revalidate = 3600 // Revalidate data every hour

// Define the resource type for this endpoint
const RESOURCE_TYPE = "Form 13F filings"

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase()
    const endpoint = `/api/ownership/form13/${symbol}`

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
        console.log(
            `GET request received for Form 13F filings of ${symbol}. Limit: ${validatedLimit}, Page: ${validatedPage}, Offset: ${offset}`,
        )

        // Retrieve Form 13F filings with pagination
        const {
            data: form13,
            error,
            count,
        } = await supabase
            .from("form13")
            .select(
                `
        *
        `,
                { count: "exact" },
            )
            .eq("stocksymbol", symbol)
            .order("datereported", { ascending: false })
            .range(offset, offset + validatedLimit - 1)

        if (error) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            console.error("Error retrieving Form 13F filings:", error)
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, { resourceType: RESOURCE_TYPE }),
                },
                { status: 500 },
            )
        }

        if (!form13 || form13.length === 0) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.NO_DATA_FOUND, { resourceType: RESOURCE_TYPE, symbol }),
                },
                { status: 404 },
            )
        }

        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success")

        const totalPages = Math.ceil((count || 0) / validatedLimit)
        const successMessage = formatApiMessage(ApiResponse.DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            symbol,
            page: validatedPage + 1,
            totalPages,
            totalCount: count || 0,
        })

        return NextResponse.json(
            {
                symbol,
                limit: validatedLimit,
                page: validatedPage,
                total_count: count || 0,
                form13: form13,
                message: successMessage,
            },
            {
                headers: {
                    "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
                },
            },
        )
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
