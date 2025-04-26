import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {validateApiKey, checkRateLimit, logUsage} from "@/lib/api-utils";

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase();
    const endpoint = `/api/ownership/form13/${symbol}`;
    console.log(`GET request received for Form 13F filings of ${symbol}.`);

    try {
        // Validate API Key
        const apiKeyValidation = await validateApiKey(request);
        //console.log("API Key validation result:", apiKeyValidation);

        if (!apiKeyValidation.valid) {

            return NextResponse.json(
                { error: `Invalid API Key. Please verify your access key.` },
                { status: 401 }
            );
        }

        // Check Rate Limits
        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId);
        console.log("Rate limit check result:", rateLimitCheck);

        if (!rateLimitCheck.allowed) {
            const supabase = await createClient();
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                {
                    error: `Rate limit exceeded. Please wait before making further requests. (Current limit: ${rateLimitCheck.limit}, Remaining attempts: ${rateLimitCheck.remaining})`,
                },
                { status: 429 }
            );
        }

        const supabase = await createClient();
        const url = new URL(request.url);

        // Pagination parameters
        const limit = Number.parseInt(url.searchParams.get("limit") || "4");
        const page = Number.parseInt(url.searchParams.get("page") || "0");

        // Parameter validation
        const validatedLimit = Math.min(Math.max(limit, 1), 100); // Between 1 and 100
        const validatedPage = Math.max(page, 0); // Page >= 0

        // Calculate offset
        const offset = validatedPage * validatedLimit;
        const from = offset;
        const to = offset + validatedLimit - 1;

        // Retrieve Form 13F filings with pagination
        const { data: form13, error, count } = await supabase
            .from("form13")
            .select(
                `
                *
            `,
                { count: "exact" }
            )
            .eq("stocksymbol", symbol)
            .order("datereported", { ascending: false })
            .range(from, to);

        if (error) {
            console.error("Error retrieving Form 13F filings:", error);
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            throw error;
        }

        if (!form13 || form13.length === 0) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                {
                    error: `No Form 13F filings found for the stock symbol '${symbol}'. Please verify the entered symbol.`,
                },
                { status: 404 }
            );

        }

        // Record usage in usage_logs for success
        await logUsage(
            supabase,
            apiKeyValidation.userId,
            apiKeyValidation.keyId,
            endpoint,
            "success"
        );


        return NextResponse.json({
            symbol,
            limit: validatedLimit,
            page: validatedPage,
            total_count: count || 0,
            form13: form13,
            message: `Form 13F filings for symbol '${symbol}' retrieved successfully. Displaying page ${validatedPage + 1} of ${Math.ceil((count || 0) / validatedLimit)} (Total: ${count || 0} filings).`,
        });
    } catch (error: any) {
        console.error("Error processing the request:", error);

        try {
            const apiKeyValidation = await validateApiKey(request);
            if (apiKeyValidation.valid) {
                const supabase = await createClient();
                await logUsage(
                    supabase,
                    apiKeyValidation.userId,
                    apiKeyValidation.keyId,
                    endpoint,
                    "error"
                );

            }
        } catch (logError) {
            console.error("Error logging the error:", logError);
        }

        return NextResponse.json(
            { error: `An error occurred while retrieving the Form 13F filings for symbol '${symbol}'. Please try again later. Details: ${error.message || "N/A"}` },
            { status: 500 }
        );
    }
}