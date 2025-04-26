import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateApiKey, checkRateLimit, logUsage} from "@/lib/api-utils";




export async function GET(
    request: Request,
    context: { params: { symbol: string } }
) {
    const symbol = context.params.symbol.toUpperCase();
    const endpoint = `/api/v1/stock/historical-price/${symbol}`;
    console.log(`GET request received for ${endpoint}`);

    try {
        // Validate API Key
        const apiKeyValidation = await validateApiKey(request);
        //console.log("API Key validation result:", apiKeyValidation);

        if (!apiKeyValidation.valid) {
            return NextResponse.json(
                { error: apiKeyValidation.error },
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
                { error: rateLimitCheck.error },
                { status: 429 }
            );
        }

        const supabase = await createClient();
        const url = new URL(request.url);

        // Retrieve and validate date parameters
        const fromDate = url.searchParams.get("from");
        const toDate = url.searchParams.get("to");

        // Date validation
        if (!fromDate || !toDate) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                { error: "The 'from' and 'to' parameters are required" },
                { status: 400 }
            );
        }

        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);

        if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                { error: "Invalid date format. Please use YYYY-MM-DD" },
                { status: 400 }
            );
        }

        if (fromDateObj > toDateObj) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                { error: "'from' date must be before the 'to' date" },
                { status: 400 }
            );
        }

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
        `
            )
            .eq("symbol", symbol)
            .gte("date", fromDate)
            .lte("date", toDate)
            .order("date", { ascending: false });

        if (error) {
            console.error("Error retrieving historical prices:", error);
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            throw error;
        }

        if (!historicalPrices || historicalPrices.length === 0) {
            return NextResponse.json(
                {
                    error: `No historical prices found for the symbol ${symbol} within the specified period`,
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

        return NextResponse.json(historicalPrices);
    } catch (error: any) {
        console.error("Full error:", error);

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
            console.error("Error recording the error:", logError);
        }

        return NextResponse.json(
            { error: error.message || "Error retrieving historical prices" },
            { status: 500 }
        );
    }
}