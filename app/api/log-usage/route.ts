import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    const { userId, keyId, endpoint, status } = await request.json();
    const supabase = await createClient();

    try {
        console.log(`logUsage - Début - userId: ${userId}, keyId: ${keyId}, endpoint: ${endpoint}, status: ${status}`);

        const { error } = await supabase
            .from("usage_logs")
            .insert({
                user_id: userId,
                api_key_id: keyId,
                endpoint,
                timestamp: new Date().toISOString(),
                status,
            });

        if (error) {
            console.error("logUsage - Erreur d'insertion:", error);
            throw error;
        }

        console.log(`logUsage - Insertion réussie pour userId: ${userId}, endpoint: ${endpoint}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur lors de l'insertion du log:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}