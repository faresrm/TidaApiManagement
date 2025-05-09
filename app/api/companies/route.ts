import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, logUsage, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils"
import { getCachedCompanies } from "@/lib/data-cache"

const RESOURCE_TYPE = "companies"

export async function GET(request: Request) {
    const endpoint = `/api/companies`

    try {
        const url = new URL(request.url)
        const apiKeyValidation = await validateApiKey(request)

        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
        }

        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
        if (!rateLimitCheck.allowed) {
            await logUsage(apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
        }

        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "4"), 1), 100)
        const page = Math.max(parseInt(url.searchParams.get("page") || "0"), 0)
        const offset = page * limit

        const sector = url.searchParams.get("sector") || undefined
        const industry = url.searchParams.get("industry") || undefined
        const exchange = url.searchParams.get("exchange") || undefined

        const { data: companies, count, error } = await getCachedCompanies(offset, limit, { sector, industry, exchange })

        if (error) {
            await logUsage(apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                { error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, { resourceType: RESOURCE_TYPE }) },
                { status: 500 }
            )
        }

        if (!companies || companies.length === 0) {
            await logUsage(apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            return NextResponse.json(
                { error: formatApiMessage(ApiResponse.NO_Company_DATA_FOUND, { resourceType: RESOURCE_TYPE }) },
                { status: 404 }
            )
        }

        await logUsage(apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success")

        const totalPages = Math.ceil((count || 0) / limit)
        const message = formatApiMessage(ApiResponse.COLLECTION_DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            page: page + 1,
            totalPages,
            totalCount: count || 0,
        })

        return NextResponse.json({
            limit,
            page,
            total_count: count || 0,
            companies,
            message,
        })
    } catch (error: any) {
        console.error("Request error:", error)
        try {
            const apiKeyValidation = await validateApiKey(request)
            if (apiKeyValidation.valid) {
                await logUsage(apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error")
            }
        } catch {}
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
