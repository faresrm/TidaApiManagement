import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  // Vérifier l'authentification
  const {
    data: { session },
  } = await supabase.auth.getSession()
  console.log("Session utilisateur:", session)

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { planId, cardNumber, expiryDate, cvv } = await request.json()

    // Validation basique des données de carte
    if (!cardNumber || !expiryDate || !cvv) {
      return NextResponse.json({ error: "Informations de paiement incomplètes" }, { status: 400 })
    }

    if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber)) {
      return NextResponse.json({ error: "Numéro de carte invalide" }, { status: 400 })
    }

    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      return NextResponse.json({ error: "Date d'expiration invalide (format MM/YY attendu)" }, { status: 400 })
    }

    if (cvv.length !== 3 || !/^\d+$/.test(cvv)) {
      return NextResponse.json({ error: "CVV invalide" }, { status: 400 })
    }

    // Simuler un délai de traitement
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Simuler un paiement réussi (90% de chance)
    const isSuccessful = Math.random() < 0.9

    if (!isSuccessful) {
      return NextResponse.json(
        { error: "Paiement refusé. Veuillez vérifier vos informations de carte ou contacter votre banque." },
        { status: 400 },
      )
    }

    // Générer un ID de transaction fictif
    const transactionId = `txn_${Math.random().toString(36).substring(2, 15)}`

    return NextResponse.json({
      success: true,
      transaction: {
        id: transactionId,
        amount: planId === "basic" ? 9.99 : planId === "pro" ? 29.99 : 99.99,
        currency: "EUR",
        status: "completed",
        date: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur lors du traitement du paiement" }, { status: 500 })
  }
}
