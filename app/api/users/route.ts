import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit } from "@/lib/api-utils"

export async function GET(request: Request) {
  console.log("Requête GET /api/users reçue")

  try {
    // Valider la clé API
    const apiKeyValidation = await validateApiKey(request)
    console.log("Résultat de la validation de la clé API:", apiKeyValidation)

    if (!apiKeyValidation.valid) {
      return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
    }

    // Vérifier les limites de taux
    const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)
    console.log("Résultat de la vérification des limites:", rateLimitCheck)

    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
    }

    const supabase = await createClient()

    // Enregistrer l'utilisation
    const { error: logError } = await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: "/api/users",
      timestamp: new Date().toISOString(),
      status: "success",
    })

    if (logError) {
      console.error("Erreur lors de l'enregistrement de l'utilisation:", logError)
    }

    // Récupérer les utilisateurs depuis la table users
    const { data: users, error: usersError } = await supabase.from("users").select("*")

    if (usersError) {
      console.error("Erreur lors de la récupération des utilisateurs:", usersError)
      throw usersError
    }

    return NextResponse.json({ users: users || [] })
  } catch (error: any) {
    console.error("Erreur complète:", error)

    // Essayer d'enregistrer l'erreur si possible
    try {
      const apiKeyValidation = await validateApiKey(request)
      if (apiKeyValidation.valid) {
        const supabase = await createClient()
        await supabase.from("usage_logs").insert({
          user_id: apiKeyValidation.userId,
          api_key_id: apiKeyValidation.keyId,
          endpoint: "/api/users",
          timestamp: new Date().toISOString(),
          status: "error",
        })
      }
    } catch (logError) {
      console.error("Erreur lors de l'enregistrement de l'erreur:", logError)
    }

    return NextResponse.json(
        { error: error.message || "Erreur lors de la récupération des utilisateurs" },
        { status: 500 },
    )
  }
}

// Le reste du fichier reste inchangé
