import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
    // Clone the request headers
    const requestHeaders = new Headers(request.headers)

    // Add a unique request ID to help with debugging cache issues
    requestHeaders.set("x-request-id", crypto.randomUUID())

    // You can add other headers here if needed

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
