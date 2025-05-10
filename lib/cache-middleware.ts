import { NextRequest, NextResponse } from "next/server";

export function withCache(request: NextRequest, handler: (req: NextRequest) => Promise<NextResponse>, p0: {
    duration: number;
    varyByQuery: string[];
}, userId: any, keyId: any, p1: string) {
    const cache = new Map();

    return async (request: NextRequest) => {
        const endpoint = request.nextUrl.pathname;

        const cacheKey = `${userId}-${endpoint}`;
        const cachedResponse = cache.get(cacheKey);

        if (cachedResponse) {
            console.log(`Cache HIT pour ${cacheKey}`);
            // Appeler la fonction edge pour logger l’utilisation
            fetch(new URL("/api/log-usage-edge", request.url).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, keyId, endpoint, status: "success" }),
            }).catch((error) => console.error("Erreur lors de l'appel à /api/log-usage-edge:", error));

            return cachedResponse; // Renvoie la réponse mise en cache
        }

        console.log(`Cache MISS pour ${cacheKey}`);
        const response = await handler(request);
        cache.set(cacheKey, response);

        // Logger aussi pour le cache MISS
        fetch(new URL("/api/log-usage-edge", request.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, keyId, endpoint, status: "success" }),
        }).catch((error) => console.error("Erreur lors de l'appel à /api/log-usage-edge:", error));

        return response;
    };
}