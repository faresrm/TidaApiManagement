import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateApiKey, checkRateLimit } from "@/lib/api-utils"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // Valider la clé API
  const apiKeyValidation = await validateApiKey(request)

  if (!apiKeyValidation.valid) {
    return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
  }

  // Vérifier les limites de taux
  const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)

  if (!rateLimitCheck.allowed) {
    return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
  }

  const supabase = await createClient()
  const id = params.id

  try {
    // Enregistrer l'utilisation
    await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: `/api/users/${id}`,
      timestamp: new Date().toISOString(),
      status: "success",
    })

    // Récupérer l'utilisateur (simulé)
    const user = {
      id: Number.parseInt(id),
      name: `User ${id}`,
      email: `user${id}@example.com`,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({ user })
  } catch (error: any) {
    // Enregistrer l'erreur
    await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: `/api/users/${id}`,
      timestamp: new Date().toISOString(),
      status: "error",
    })

    return NextResponse.json(
      { error: error.message || "Erreur lors de la récupération de l'utilisateur" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  // Valider la clé API
  const apiKeyValidation = await validateApiKey(request)

  if (!apiKeyValidation.valid) {
    return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
  }

  // Vérifier les limites de taux
  const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)

  if (!rateLimitCheck.allowed) {
    return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
  }

  const supabase = await createClient()
  const id = params.id

  try {
    const userData = await request.json()

    // Enregistrer l'utilisation
    await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: `/api/users/${id}`,
      timestamp: new Date().toISOString(),
      status: "success",
    })

    // Mettre à jour l'utilisateur (simulé)
    const updatedUser = {
      id: Number.parseInt(id),
      ...userData,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error: any) {
    // Enregistrer l'erreur
    await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: `/api/users/${id}`,
      timestamp: new Date().toISOString(),
      status: "error",
    })

    return NextResponse.json(
      { error: error.message || "Erreur lors de la mise à jour de l'utilisateur" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // Valider la clé API
  const apiKeyValidation = await validateApiKey(request)

  if (!apiKeyValidation.valid) {
    return NextResponse.json({ error: apiKeyValidation.error }, { status: 401 })
  }

  // Vérifier les limites de taux
  const rateLimitCheck = await checkRateLimit(apiKeyValidation.userId)

  if (!rateLimitCheck.allowed) {
    return NextResponse.json({ error: rateLimitCheck.error }, { status: 429 })
  }

  const supabase = await createClient()
  const id = params.id

  try {
    // Enregistrer l'utilisation
    await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: `/api/users/${id}`,
      timestamp: new Date().toISOString(),
      status: "success",
    })

    // Supprimer l'utilisateur (simulé)
    return NextResponse.json({ success: true, message: `Utilisateur ${id} supprimé avec succès` })
  } catch (error: any) {
    // Enregistrer l'erreur
    await supabase.from("usage_logs").insert({
      user_id: apiKeyValidation.userId,
      api_key_id: apiKeyValidation.keyId,
      endpoint: `/api/users/${id}`,
      timestamp: new Date().toISOString(),
      status: "error",
    })

    return NextResponse.json(
      { error: error.message || "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 },
    )
  }
}
