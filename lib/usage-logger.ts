import { createClient } from "@/lib/supabase/server"

export async function logApiUsage(userId: string, apiKeyId: string, endpoint: string, status = "success") {
    const supabase = await createClient()

    try {
        await supabase.from("usage_logs").insert({
            user_id: userId,
            api_key_id: apiKeyId,
            endpoint,
            timestamp: new Date().toISOString(),
            status,
        })

        return true
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'utilisation de l'API:", error)
        return false
    }
}
