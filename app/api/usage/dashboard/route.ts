import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "5m"

    const supabase =await createClient()

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
    if (period === "5m") {
        startDate.setMinutes(startDate.getMinutes() - 5)
    } else if (period === "15m") {
        startDate.setMinutes(startDate.getMinutes() - 15)
    } else if (period === "1h") {
        startDate.setHours(startDate.getHours() - 1)
    } else if (period === "4h") {
        startDate.setHours(startDate.getHours() - 4)
    } else if (period === "24h") {
        startDate.setHours(startDate.getHours() - 24)
    } else if (period === "72h") {
        startDate.setHours(startDate.getHours() - 72)
    } else if (period === "7d") {
        startDate.setDate(startDate.getDate() - 7)
    } else if (period === "30d") {
        startDate.setDate(startDate.getDate() - 30)
    }

    try {
        // Récupérer les données d'utilisation pour le graphique
        const { data: usageLogs, error } = await supabase
            .from("usage_logs")
            .select("*")
            .eq("user_id", userId)
            .gte("timestamp", startDate.toISOString())
            .order("timestamp", { ascending: true })

        if (error) {
            throw error
        }

        // Générer les données du graphique
        const chartData = generateChartData(usageLogs || [], period)

        // Générer les données du tableau
        const tableData = generateTableData(usageLogs || [], period)

        return NextResponse.json({
            chartData,
            tableData,
        })
    } catch (error: any) {
        console.error("Erreur lors de la récupération des données:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Fonction pour générer les données du graphique
function generateChartData(logs: any[], period: string) {
    if (logs.length === 0) return []

    const timeFormat = getTimeFormat(period)
    const groupedData: Record<string, { success: number; failed: number; endpoints: Record<string, number> }> = {}

    // Créer des intervalles de temps en fonction de la période
    const intervals = generateTimeIntervals(period)
    intervals.forEach((interval) => {
        groupedData[interval] = { success: 0, failed: 0, endpoints: {} }
    })

    // Regrouper les logs par intervalle de temps
    logs.forEach((log) => {
        const date = new Date(log.timestamp)
        const timeKey = formatDate(date, timeFormat)

        if (!groupedData[timeKey]) {
            groupedData[timeKey] = { success: 0, failed: 0, endpoints: {} }
        }

        if (log.status === "success") {
            groupedData[timeKey].success += 1
        } else {
            groupedData[timeKey].failed += 1
        }

        // Ajouter l'endpoint aux données pour le tooltip
        if (!groupedData[timeKey].endpoints[log.endpoint]) {
            groupedData[timeKey].endpoints[log.endpoint] = 0
        }
        groupedData[timeKey].endpoints[log.endpoint] += 1
    })

    // Convertir en tableau pour le graphique
    return Object.entries(groupedData).map(([timestamp, data]) => ({
        timestamp,
        success: data.success,
        failed: data.failed,
        endpoints: data.endpoints,
    }))
}

// Fonction pour générer les données du tableau
function generateTableData(logs: any[], period: string) {
    if (logs.length === 0) return []

    const basePaths: Record<
        string,
        {
            apiCalls: number
            keys: Set<string>
            successCount: number
            totalCount: number
            startTime: Date
        }
    > = {}

    // Regrouper les logs par base path
    logs.forEach((log) => {
        const basePath = getBasePath(log.endpoint)

        if (!basePaths[basePath]) {
            basePaths[basePath] = {
                apiCalls: 0,
                keys: new Set(),
                successCount: 0,
                totalCount: 0,
                startTime: new Date(log.timestamp),
            }
        }

        basePaths[basePath].apiCalls += 1
        basePaths[basePath].keys.add(log.api_key_id)
        basePaths[basePath].totalCount += 1

        if (log.status === "success") {
            basePaths[basePath].successCount += 1
        }
    })

    // Calculer les minutes écoulées pour la période
    const periodMinutes = getPeriodMinutes(period)

    // Convertir en tableau pour le tableau
    return Object.entries(basePaths).map(([basePath, data]) => ({
        basePath,
        apiCalls: data.apiCalls,
        keys: data.keys.size,
        reqPerMin: data.apiCalls / periodMinutes,
        successRate: Math.round((data.successCount / data.totalCount) * 100),
    }))
}

// Fonction pour obtenir le format de temps en fonction de la période
function getTimeFormat(period: string): string {
    switch (period) {
        case "5m":
        case "15m":
        case "1h":
            return "HH:mm:ss"
        case "4h":
        case "24h":
            return "HH:mm"
        case "72h":
            return "dd/MM HH:mm"
        case "7d":
            return "dd/MM"
        case "30d":
            return "dd/MM"
        default:
            return "HH:mm:ss"
    }
}

// Fonction pour formater une date selon un format spécifique
function formatDate(date: Date, format: string): string {
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const seconds = date.getSeconds().toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")

    return format
        .replace("HH", hours)
        .replace("mm", minutes)
        .replace("ss", seconds)
        .replace("dd", day)
        .replace("MM", month)
}

// Fonction pour générer des intervalles de temps en fonction de la période
function generateTimeIntervals(period: string): string[] {
    const now = new Date()
    const intervals: string[] = []
    const format = getTimeFormat(period)

    let intervalCount: number
    let intervalMinutes: number

    switch (period) {
        case "5m":
            intervalCount = 5
            intervalMinutes = 1
            break
        case "15m":
            intervalCount = 15
            intervalMinutes = 1
            break
        case "1h":
            intervalCount = 12
            intervalMinutes = 5
            break
        case "4h":
            intervalCount = 8
            intervalMinutes = 30
            break
        case "24h":
            intervalCount = 24
            intervalMinutes = 60
            break
        case "72h":
            intervalCount = 24
            intervalMinutes = 180
            break
        case "7d":
            intervalCount = 7
            intervalMinutes = 1440 // 24 heures
            break
        case "30d":
            intervalCount = 30
            intervalMinutes = 1440 // 24 heures
            break
        default:
            intervalCount = 5
            intervalMinutes = 1
    }

    for (let i = intervalCount - 1; i >= 0; i--) {
        const date = new Date(now)
        date.setMinutes(date.getMinutes() - i * intervalMinutes)
        intervals.push(formatDate(date, format))
    }

    return intervals
}

// Fonction pour extraire le chemin de base d'un endpoint
function getBasePath(endpoint: string): string {
    // Extraire le chemin de base, par exemple "/api/users/123" -> "/api/users"
    const parts = endpoint.split("/")
    if (parts.length <= 3) return endpoint

    // Si le dernier segment semble être un ID (contient uniquement des chiffres ou des caractères spéciaux)
    const lastPart = parts[parts.length - 1]
    if (/^\d+$/.test(lastPart) || /^[a-f0-9-]+$/.test(lastPart)) {
        return parts.slice(0, -1).join("/")
    }

    return endpoint
}

// Fonction pour obtenir le nombre de minutes pour une période
function getPeriodMinutes(period: string): number {
    switch (period) {
        case "5m":
            return 5
        case "15m":
            return 15
        case "1h":
            return 60
        case "4h":
            return 240
        case "24h":
            return 1440
        case "72h":
            return 4320
        case "7d":
            return 10080
        case "30d":
            return 43200
        default:
            return 5
    }
}
