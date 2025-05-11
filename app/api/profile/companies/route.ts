import { type NextRequest, NextResponse } from "next/server"
import { validateApiKey, checkRateLimit, ApiResponse } from "@/lib/api-test-utils"
import { createClient } from "@/lib/supabase/server"

// Set cache revalidation time to 24 hours (86400 seconds)
export const revalidate = 86400

export async function GET(request: NextRequest) {
    console.log("GET /api/profile/companies - Request received")

    try {
        // Validate API key
        const apiValidation = await validateApiKey(request)
        if (!apiValidation.valid) {
            console.error(`GET /api/profile/companies - API validation failed: ${apiValidation.error}`)
            return NextResponse.json({ success: false, message: apiValidation.error }, { status: 401 })
        }

        // Check rate limits
        const rateCheck = await checkRateLimit(apiValidation.userId)
        if (!rateCheck.allowed) {
            console.error(`GET /api/profile/companies - Rate limit check failed: ${rateCheck.error}`)
            return NextResponse.json({ success: false, message: rateCheck.error }, { status: 429 })
        }

        // Log the API call
        const supabase = await createClient()
        await supabase.from("usage_logs").insert({
            user_id: apiValidation.userId,
            api_key_id: apiValidation.keyId,
            endpoint: "/api/profile/companies",
            status: "success",
            timestamp: new Date().toISOString(),
        })

        // Fetch companies data
        const { data: companies, error } = await supabase.from("companies").select("*")

        if (error) {
            console.error(`GET /api/profile/companies - Error fetching companies: ${error.message}`)
            return NextResponse.json(
                { success: false, message: ApiResponse.DATA_RETRIEVAL_ERROR.replace("{resourceType}", "companies") },
                { status: 500 },
            )
        }

        if (!companies || companies.length === 0) {
            console.log("GET /api/profile/companies - No companies found")
            return NextResponse.json({ success: true, message: ApiResponse.NO_Company_DATA_FOUND, data: [] }, { status: 200 })
        }

        console.log(`GET /api/profile/companies - Success: Retrieved ${companies.length} companies`)
        return NextResponse.json(
            {
                success: true,
                message: `Companies retrieved successfully. Total: ${companies.length} entries.`,
                data: companies,
            },
            {
                status: 200,
                headers: {
                    // Set cache control headers for API clients
                    "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
                },
            },
        )
    } catch (error) {
        console.error(
            `GET /api/profile/companies - Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        )
        return NextResponse.json(
            {
                success: false,
                message: ApiResponse.PROCESSING_ERROR.replace(
                    "{details}",
                    error instanceof Error ? error.message : String(error),
                ),
            },
            { status: 500 },
        )
    }
}
