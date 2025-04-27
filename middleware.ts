import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/api-utils"

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
    // Clone the request headers
    const requestHeaders = new Headers(request.headers)

    // Add a unique request ID to help with debugging cache issues
    const requestId = crypto.randomUUID()
    requestHeaders.set("x-request-id", requestId)

    // Log API usage for all API requests, even cached ones
    if (request.nextUrl.pathname.startsWith("/api/")) {
        try {
            // Extract API key from request
            const url = new URL(request.url)
            const apiKey = url.searchParams.get("apikey")
            let authHeader = null

            if (!apiKey) {
                authHeader = request.headers.get("authorization")
                if (!authHeader || !authHeader.startsWith("Bearer ")) {
                    // No valid API key, don't log usage
                    return NextResponse.next({
                        request: {
                            headers: requestHeaders,
                        },
                    })
                }
            }

            const keyToValidate = apiKey || authHeader!.split(" ")[1]

            // Validate the API key
            const apiKeyValidation = await validateApiKey(request)
            if (apiKeyValidation.valid) {
                const supabase = await createClient()

                // Extract endpoint from URL
                const endpoint = request.nextUrl.pathname

                // Log the usage
                await supabase.from("usage_logs").insert({
                    user_id: apiKeyValidation.userId,
                    api_key_id: apiKeyValidation.keyId,
                    endpoint,
                    timestamp: new Date().toISOString(),
                    status: "success", // Assume success for cached responses
                    cached: true, // Mark as potentially cached
                    request_id: requestId,
                })
            }
        } catch (error) {
            console.error("Error logging API usage in middleware:", error)
            // Continue with the request even if logging fails
        }
    }

    // Return the response with the modified headers
    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: "/api/:path*",
}
