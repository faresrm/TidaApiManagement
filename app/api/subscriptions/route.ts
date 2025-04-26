import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  console.log("Requête POST /api/subscriptions reçue")

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
    console.log("Utilisateur authentifié:", userId)

    const body = await request.json()
    const { planId } = body

    console.log("Données reçues:", { planId })

    if (!planId) {
      return NextResponse.json({ error: "ID de plan manquant" }, { status: 400 })
    }

    // Récupérer les détails du plan
    const { data: planData, error: planError } = await supabase.from("plans").select("*").eq("id", planId).single()

    if (planError) {
      console.error("Erreur lors de la récupération du plan:", planError)
      return NextResponse.json({ error: "Erreur lors de la récupération du plan" }, { status: 500 })
    }

    if (!planData) {
      console.error("Plan non trouvé:", planId)
      return NextResponse.json({ error: "Plan non trouvé" }, { status: 404 })
    }

    console.log("Plan trouvé:", planData)

    // Approche radicale : supprimer tous les abonnements existants de l'utilisateur
    console.log("Suppression de tous les abonnements existants pour l'utilisateur:", userId)
    const { error: deleteError } = await supabase.from("subscriptions").delete().eq("user_id", userId)

    if (deleteError) {
      console.error("Erreur lors de la suppression des abonnements:", deleteError)
      return NextResponse.json({ error: "Erreur lors de la suppression des abonnements existants" }, { status: 500 })
    }

    // Créer un nouvel abonnement
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1) // Abonnement d'un mois

    const newSubscription = {
      user_id: userId,
      plan_id: planId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: "active",
    }

    console.log("Nouvel abonnement à créer:", newSubscription)

    const { data, error } = await supabase.from("subscriptions").insert(newSubscription).select()

    if (error) {
      console.error("Erreur lors de la création de l'abonnement:", error)
      throw error
    }

    console.log("Abonnement créé avec succès:", data)

    // Vérifier que l'abonnement a bien été créé
    const { data: checkData, error: checkError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")

    if (checkError) {
      console.error("Erreur lors de la vérification de l'abonnement:", checkError)
    } else {
      console.log("Vérification des abonnements actifs:", checkData)
    }

    return NextResponse.json({ success: true, data, redirect: true })
  } catch (error: any) {
    console.error("Erreur complète:", error)
    return NextResponse.json(
        { error: error.message || "Erreur lors de la mise à jour de l'abonnement" },
        { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const userId = user.id

    // Récupérer l'abonnement actif
    const { data: subscription, error } = await supabase
        .from("subscriptions")
        .select("*, plans(*)")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 est l'erreur "No rows returned" de Supabase
      console.error("Erreur lors de la récupération de l'abonnement:", error)
      return NextResponse.json({ error: "Erreur lors de la récupération de l'abonnement" }, { status: 500 })
    }

    // Si aucun abonnement n'est trouvé, renvoyer le plan gratuit par défaut
    if (!subscription) {
      const { data: freePlan } = await supabase.from("plans").select("*").eq("id", "free").single()

      return NextResponse.json({
        subscription: {
          plan_id: "free",
          plans: freePlan,
        },
      })
    }

    return NextResponse.json({ subscription })
  } catch (error: any) {
    console.error("Erreur complète:", error)
    return NextResponse.json(
        { error: error.message || "Erreur lors de la récupération de l'abonnement" },
        { status: 500 },
    )
  }
}
