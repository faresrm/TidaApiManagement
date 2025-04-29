// app/api/financials/balance-sheet/[symbol]/route.ts

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
    validateApiKey,
    checkRateLimit,
    logUsage,
    ApiError,
    ApiResponse,
    formatApiMessage,
} from "@/lib/api-utils";

const RESOURCE_TYPE = "balance sheet statements";

// Vous pouvez déployer en Edge pour des cold-starts plus rapides
export const runtime = "edge";

export async function GET(
    request: Request,
    { params: { symbol } }: { params: { symbol: string } }
) {
    const sym = symbol.toUpperCase();
    const endpoint = `/api/financials/balance-sheet/${sym}`;

    try {
        const supabase = await createClient();

        // 1️⃣ Validation de la clé API
        const apiKeyValidation = await validateApiKey(request);
        if (!apiKeyValidation.valid) {
            return NextResponse.json(
                { error: apiKeyValidation.error ?? ApiError.INVALID_API_KEY },
                { status: 401 }
            );
        }

        // 2️⃣ Vérification du rate limit
        const rateLimit = await checkRateLimit(apiKeyValidation.userId);
        if (!rateLimit.allowed) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                { error: rateLimit.error ?? ApiError.RATE_LIMIT_REACHED },
                { status: 429 }
            );
        }

        // 3️⃣ Lecture des paramètres de pagination
        const url = new URL(request.url);
        const limit = Math.min(
            Math.max(Number(url.searchParams.get("limit") ?? "4"), 1),
            100
        );
        const page = Math.max(Number(url.searchParams.get("page") ?? "0"), 0);
        const offset = page * limit;

        console.log(
            `Fetch balance sheets for ${sym} – limit=${limit}, page=${page}, offset=${offset}`
        );

        // 4️⃣ Récupération des données paginées (sans count)
        const { data: balanceSheets, error: dataError } = await supabase
            .from("balance_sheet_statements")
            .select("*")
            .eq("symbol", sym)
            .order("date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (dataError) {
            console.error("Error fetching balance sheet data:", dataError);
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.DATA_RETRIEVAL_ERROR, {
                        resourceType: RESOURCE_TYPE,
                    }),
                },
                { status: 500 }
            );
        }

        if (!balanceSheets || balanceSheets.length === 0) {
            await logUsage(
                supabase,
                apiKeyValidation.userId,
                apiKeyValidation.keyId,
                endpoint,
                "error"
            );
            return NextResponse.json(
                {
                    error: formatApiMessage(ApiResponse.NO_DATA_FOUND, {
                        resourceType: RESOURCE_TYPE,
                        symbol: sym,
                    }),
                },
                { status: 404 }
            );
        }

        // 5️⃣ Récupération du count pré-calculé
        const {
            data: countData,
            error: countError,
        } = await supabase
            .from("balance_sheet_counts")
            .select("row_count")
            .eq("symbol", sym)
            .limit(1)
            .single();

        const totalCount = !countError && countData ? countData.row_count : 0;
        const totalPages = Math.ceil(totalCount / limit);

        // 6️⃣ Logging succès
        await logUsage(
            supabase,
            apiKeyValidation.userId,
            apiKeyValidation.keyId,
            endpoint,
            "success"
        );

        // 7️⃣ Réponse
        const message = formatApiMessage(ApiResponse.DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            symbol: sym,
            page: page + 1,
            totalPages,
            totalCount,
        });

        return NextResponse.json(
            {
                symbol: sym,
                limit,
                page,
                total_count: totalCount,
                total_pages: totalPages,
                balance_sheets: balanceSheets,
                message,
            },
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error processing request:", err);
        try {
            const supabase = await createClient();
            const apiKeyValidation = await validateApiKey(request);
            if (apiKeyValidation.valid) {
                await logUsage(
                    supabase,
                    apiKeyValidation.userId,
                    apiKeyValidation.keyId,
                    endpoint,
                    "error"
                );
            }
        } catch (logErr) {
            console.error("Error logging failure:", logErr);
        }
        return NextResponse.json(
            {
                error: formatApiMessage(ApiResponse.PROCESSING_ERROR, {
                    resourceType: RESOURCE_TYPE,
                    details: err.message || "N/A",
                }),
            },
            { status: 500 }
        );
    }
}
