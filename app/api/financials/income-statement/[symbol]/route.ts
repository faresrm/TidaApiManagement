// route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateApiKey, checkRateLimit, logUsage, ApiError } from "@/lib/api-utils";

export const revalidate = 3600; // Revalidate data every hour

export enum ApiResponse {
    NO_DATA_FOUND = "No income statements found for the stock symbol '{symbol}'. Please verify the entered symbol.",
    DATA_RETRIEVAL_SUCCESS = "Income statement for symbol '{symbol}' retrieved successfully. Displaying page {page} of {totalPages} (Total: {totalCount} entries).",
    DATA_RETRIEVAL_ERROR = "Error retrieving income statements",
    PROCESSING_ERROR = "An error occurred... Details: {details}",
}

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase();
    const endpoint = `/api/financials/income-statement/${symbol}`;

    try {
        const supabase = await createClient();

        const apiKeyValidation = await validateApiKey(request);
        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: ApiError.INVALID_API_KEY }, { status: 401 });
        }

        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId);
        if (!rateLimitCheck.allowed) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error");
            return NextResponse.json({
                error: ApiError.RATE_LIMIT_REACHED.replace(
                    "{limit}",
                    rateLimitCheck.error!.split("(")[1].split(" ")[0] // Extract the limit value
                ),
            }, { status: 429 });
        }

        const url = new URL(request.url);
        const limit = Number.parseInt(url.searchParams.get("limit") || "4");
        const page = Number.parseInt(url.searchParams.get("page") || "0");
        const validatedLimit = Math.min(Math.max(limit, 1), 100);
        const validatedPage = Math.max(page, 0);
        const offset = validatedPage * validatedLimit;
        console.log(
            `GET request received for income statement of ${symbol}. Limit: ${validatedLimit}, Page: ${validatedPage}, Offset: ${offset}`
        );
        // Retrieve data directly here
        const { data: incomeStatements, error, count } = await supabase
            .from("income_statement")
            .select(
                `
            *
        `,
                { count: "exact" }
            )
            .eq("symbol", symbol)
            .order("date", { ascending: false })
            .range(offset, offset + validatedLimit - 1);

        if (error) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error");
            console.error("Error retrieving income statements:", error);
            return NextResponse.json({ error: ApiResponse.DATA_RETRIEVAL_ERROR }, { status: 500 });
        }

        if (!incomeStatements || incomeStatements.length === 0) {
            await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error");
            return NextResponse.json({
                error: ApiResponse.NO_DATA_FOUND.replace("{symbol}", symbol),
            }, { status: 404 });
        }

        await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success");

        const totalPages = Math.ceil((count || 0) / validatedLimit);
        const successMessage = ApiResponse.DATA_RETRIEVAL_SUCCESS
            .replace("{symbol}", symbol)
            .replace("{page}", (validatedPage + 1).toString())
            .replace("{totalPages}", totalPages.toString())
            .replace("{totalCount}", (count || 0).toString());

        return NextResponse.json(
            {
                symbol,
                limit: validatedLimit,
                page: validatedPage,
                total_count: count || 0,
                income_statements: incomeStatements,
                message: successMessage,
            },
            {
                headers: {
                    "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
                },
            }
        );
    } catch (error: any) {
        console.error("Error processing the request:", error);
        try {
            const apiKeyValidation = await validateApiKey(request);
            if (apiKeyValidation.valid) {
                const supabase = await createClient();
                await logUsage(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error");
            }
        } catch (logError) {
            console.error("Error logging the error:", logError);
        }
        return NextResponse.json(
            { error: ApiResponse.PROCESSING_ERROR.replace("{details}", error.message || "N/A") },
            { status: 500 }
        );
    }
}