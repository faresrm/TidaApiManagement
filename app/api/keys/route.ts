import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification avec getUser pour plus de sécurité
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const userId = user.id

    // Vérifier le nombre de clés API actives de l'utilisateur
    const { count, error: countError } = await supabase
        .from("api_keys")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true)

    if (countError) {
      console.error("Erreur lors du comptage des clés API:", countError)
      throw countError
    }

    // Limiter à 5 clés API actives par utilisateur
    if (count && count >= 5) {
      return NextResponse.json(
          {
            error: "Limite de clés API atteinte",
            message:
                "Vous avez atteint la limite de 5 clés API actives. Veuillez révoquer une clé existante avant d'en créer une nouvelle.",
          },
          { status: 400 },
      )
    }

    const { name } = await request.json()

    // Générer une clé API unique
    const apiKey = `apk_${randomUUID().replace(/-/g, "")}`

    console.log("Création d'une nouvelle clé API:", { userId, name, apiKey })

    // Insérer la nouvelle clé API
    const { data, error } = await supabase
        .from("api_keys")
        .insert({
          user_id: userId,
          key: apiKey,
          name: name || `Clé API ${new Date().toLocaleDateString()}`,
          created_at: new Date().toISOString(),
          is_active: true,
        })
        .select()

    if (error) {
      console.error("Erreur lors de la création de la clé API:", error)
      throw error
    }

    console.log("Clé API créée avec succès:", data)

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Erreur complète:", error)
    return NextResponse.json({ error: error.message || "Erreur lors de la création de la clé API" }, { status: 500 })
  }
}

// La fonction DELETE reste inchangée

// Ajouter une nouvelle route pour faire tourner (renouveler) une clé API
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification avec getUser pour plus de sécurité
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const userId = user.id
    const { keyId } = await request.json()

    if (!keyId) {
      return NextResponse.json({ error: "ID de clé API manquant" }, { status: 400 })
    }

    // Vérifier que la clé appartient à l'utilisateur
    const { data: keyData, error: keyError } = await supabase
        .from("api_keys")
        .select("*")
        .eq("id", keyId)
        .eq("user_id", userId)
        .eq("is_active", true)

    if (keyError) {
      console.error("Erreur lors de la recherche de la clé API:", keyError)
      throw keyError
    }

    if (!keyData || keyData.length === 0) {
      return NextResponse.json({ error: "Clé API non trouvée ou non autorisée" }, { status: 404 })
    }

    // Générer une nouvelle clé API
    const newApiKey = `apk_${randomUUID().replace(/-/g, "")}`

    // Mettre à jour la clé API
    const { data, error } = await supabase
        .from("api_keys")
        .update({ key: newApiKey })
        .eq("id", keyId)
        .eq("user_id", userId)
        .select()

    if (error) {
      console.error("Erreur lors du renouvellement de la clé API:", error)
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Erreur complète:", error)
    return NextResponse.json({ error: error.message || "Erreur lors du renouvellement de la clé API" }, { status: 500 })
  }
}
