import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "week" // day, week, month

    const supabase = await createClient()

    // Vérifier l'authentification
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const userId = session.user.id

    // Calculer la date de début en fonction de la période
    const startDate = new Date()
    if (period === "day") {
        startDate.setHours(0, 0, 0, 0)
    } else if (period === "week") {
        startDate.setDate(startDate.getDate() - 7)
    } else if (period === "month") {
        startDate.setMonth(startDate.getMonth() - 1)
    } else if (period === "year") {
        startDate.setFullYear(startDate.getFullYear() - 1)
    }

    // Récupérer les données d'utilisation
    const { data, error } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("timestamp", startDate.toISOString())
        .order("timestamp", { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Agréger les données par jour
    const aggregatedData = aggregateDataByPeriod(data || [], period)

    return NextResponse.json(aggregatedData)
}

function aggregateDataByPeriod(data: any[], period: string) {
    const aggregated: Record<string, { name: string; Total: number }> = {}

    data.forEach((log) => {
        const date = new Date(log.timestamp)
        let key: string

        if (period === "day") {
            // Format: 10h, 11h, etc.
            key = `${date.getHours()}h`
        } else if (period === "week") {
            // Format: Lun, Mar, etc.
            const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
            key = days[date.getDay()]
        } else if (period === "month") {
            // Format: 01, 02, etc. (jour du mois)
            key = date.getDate().toString().padStart(2, "0")
        } else if (period === "year") {
            // Format: Jan, Fév, etc.
            const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
            key = months[date.getMonth()]
        }

        if (!aggregated[key]) {
            aggregated[key] = { name: key, Total: 0 }
        }

        aggregated[key].Total++
    })

    // Convertir l'objet en tableau et trier
    const result = Object.values(aggregated)

    // Trier selon la période
    if (period === "day") {
        result.sort((a, b) => Number.parseInt(a.name) - Number.parseInt(b.name))
    } else if (period === "week") {
        const dayOrder = { Lun: 0, Mar: 1, Mer: 2, Jeu: 3, Ven: 4, Sam: 5, Dim: 6 }
        result.sort((a, b) => dayOrder[a.name as keyof typeof dayOrder] - dayOrder[b.name as keyof typeof dayOrder])
    } else if (period === "month") {
        result.sort((a, b) => Number.parseInt(a.name) - Number.parseInt(b.name))
    } else if (period === "year") {
        const monthOrder = {
            Jan: 0,
            Fév: 1,
            Mar: 2,
            Avr: 3,
            Mai: 4,
            Juin: 5,
            Juil: 6,
            Août: 7,
            Sep: 8,
            Oct: 9,
            Nov: 10,
            Déc: 11,
        }
        result.sort((a, b) => monthOrder[a.name as keyof typeof monthOrder] - monthOrder[b.name as keyof typeof monthOrder])
    }

    return result
}
