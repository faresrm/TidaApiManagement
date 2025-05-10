import { NextRequest, NextResponse } from "next/server";

export function withCache(handler: (req: NextRequest) => Promise<NextResponse>) {
    const cache = new Map();

    return async (request: NextRequest) => {
        const userId = request.headers.get("x-user-id"); // Exemple, adaptez selon votre cas
        const keyId = request.headers.get("x-key-id");
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