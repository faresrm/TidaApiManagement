import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateApiKey, checkRateLimit, logUsageAsync, ApiError, ApiResponse, formatApiMessage } from "@/lib/api-utils";
import { cache } from 'react';

const RESOURCE_TYPE = "Form 13F filings";

// Fonction cachée pour récupérer les dépôts Form 13F
const getForm13Cached = cache(async (symbol: string, limit: number, offset: number) => {
    const supabase = await createClient();
    const { data, error, count } = await supabase
        .from("form13")
        .select("*", { count: "exact" })
        .eq("symbol", symbol)
        .order("date_reported", { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;
    return { data, count };
});

export async function GET(request: Request, context: { params: { symbol: string } }) {
    const symbol = context.params.symbol.toUpperCase();
    const endpoint = `/api/ownership/form13/${symbol}`;
    const supabase = await createClient();

    try {
        // Validation de la clé API
        const apiKeyValidation = await validateApiKey(request);
        if (!apiKeyValidation.valid) {
            return NextResponse.json({ error: ApiError.INVALID_API_KEY }, { status: 401 });
        }

        // Vérification des limites de taux
        const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId);
        if (!rateLimitCheck.allowed) {
            logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error");
            return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 });
        }

        // Récupération des paramètres de la requête
        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "4"), 1), 100);
        const page = Math.max(Number.parseInt(url.searchParams.get("page") || "0"), 0);
        const offset = page * limit;

        // Récupération des données mises en cache
        const { data: form13, count } = await getForm13Cached(symbol, limit, offset);

        if (!form13 || form13.length === 0) {
            logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "error");
            return NextResponse.json(
                { error: formatApiMessage(ApiResponse.NO_DATA_FOUND, { resourceType: RESOURCE_TYPE, symbol }) },
                { status: 404 }
            );
        }

        // Logging asynchrone de l'utilisation
        logUsageAsync(supabase, apiKeyValidation.userId, apiKeyValidation.keyId, endpoint, "success");

        const totalPages = Math.ceil((count || 0) / limit);
        const successMessage = formatApiMessage(ApiResponse.DATA_RETRIEVAL_SUCCESS, {
            resourceType: RESOURCE_TYPE,
            symbol,
            page: page + 1,
            totalPages,
            totalCount: count || 0,
        });

        return NextResponse.json({
            symbol,
            limit,
            page,
            total_count: count || 0,
            form13,
            message: successMessage,
        });
    } catch (error: any) {
        console.error("Error processing request:", error);
        logUsageAsync(supabase, apiKeyValidation?.userId || "", apiKeyValidation?.keyId || "", endpoint, "error");
        return NextResponse.json(
            { error: formatApiMessage(ApiResponse.PROCESSING_ERROR, { resourceType: RESOURCE_TYPE, details: error.message }) },
            { status: 500 }
        );
    }
}