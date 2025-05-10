import { createClient } from "@/lib/supabase/server"
import { queueLog } from "@/lib/log-queue"

// Enum Messages
export enum ApiError {
  MISSING_API_KEY = "Missing API key. Use the query parameter '?apikey=YOUR_API_KEY'",
  INVALID_API_KEY = "Invalid API key",
  INACTIVE_API_KEY = "Inactive or invalid API key",
  API_KEY_VALIDATION_ERROR = "Error during API key validation",
  DAILY_LIMIT_REACHED = "Daily limit reached ({limit} calls per day)",
  RATE_LIMIT_REACHED = "Rate limit reached ({limit} requests/minute)",
  SUBSCRIPTION_FETCH_ERROR = "Error fetching subscription details",
  PLAN_FETCH_ERROR = "Error fetching plan details",
  USAGE_LOG_ERROR = "Error recording usage log",
  DAILY_COUNT_ERROR = "Error counting daily API calls",
  RECENT_COUNT_ERROR = "Error counting recent API calls",
  RATE_LIMIT_CHECK_ERROR = "Internal error during rate limit check",
}

// Centralized API response messages
export enum ApiResponse {
  NO_DATA_FOUND = "No {resourceType} found for the stock symbol '{symbol}'. Please verify the entered symbol.",
  DATA_RETRIEVAL_SUCCESS = "{resourceType} for symbol '{symbol}' retrieved successfully. Displaying page {page} of {totalPages} (Total: {totalCount} entries).",
  DATA_RETRIEVAL_ERROR = "Error retrieving {resourceType}",
  PROCESSING_ERROR = "An error occurred... Details: {details}",
  NO_Company_DATA_FOUND = "No companies found.",
  MISSING_DATE_PARAMS = "The 'from' and 'to' parameters are required",
  INVALID_DATE_FORMAT = "Invalid date format. Please use YYYY-MM-DD",
  INVALID_DATE_RANGE = "'from' date must be before the 'to' date",
  COLLECTION_DATA_RETRIEVAL_SUCCESS = "{resourceType} retrieved successfully. Displaying page {page} of {totalPages} (Total: {totalCount} entries).",
}

// Helper function to format API response messages
export function formatApiMessage(message: string, params: Record<string, string | number>): string {
  let formattedMessage = message
  for (const [key, value] of Object.entries(params)) {
    formattedMessage = formattedMessage.replace(`{${key}}`, String(value))
  }
  return formattedMessage
}

// Fonction pour valider un UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Nouvelle fonction de logging qui utilise la file d'attente
export function logUsage(userId: string, keyId: string, endpoint: string, status: "success" | "error"): void {
  try {
    // Valider les paramètres
    if (!isValidUUID(userId) || !isValidUUID(keyId)) {
      console.error(`logUsage - UUID invalide: userId=${userId}, keyId=${keyId}`)
      return
    }

    // Ajouter à la file d'attente
    queueLog(userId, keyId, endpoint, status)
  } catch (error) {
    console.error("logUsage - Erreur:", error)
  }
}

// Asynchronous version of logUsage
export async function logUsageAsync(
    userId: string,
    keyId: string,
    endpoint: string,
    status: "success" | "error",
): Promise<void> {
  try {
    // Valider les paramètres
    if (!isValidUUID(userId) || !isValidUUID(keyId)) {
      console.error(`logUsageAsync - UUID invalide: userId=${userId}, keyId=${keyId}`)
      return
    }

    // Ajouter à la file d'attente
    queueLog(userId, keyId, endpoint, status)
  } catch (error) {
    console.error("logUsageAsync - Erreur:", error)
  }
}

export async function validateApiKey(request: Request) {
  console.log("validateApiKey - Début")
  try {
    const url = new URL(request.url)
    const apiKey = url.searchParams.get("apikey")
    let authHeader = null
    if (!apiKey) {
      authHeader = request.headers.get("authorization")
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log("validateApiKey - Clé API manquante")
        return {
          valid: false,
          error: ApiError.MISSING_API_KEY,
        }
      }
    }

    const keyToValidate = apiKey || authHeader!.split(" ")[1]
    console.log("validateApiKey - Clé API à valider:", keyToValidate)

    const supabase = await createClient()
    const { data: keyData, error } = await supabase
        .from("api_keys")
        .select("id, user_id, is_active")
        .eq("key", keyToValidate)
        .single()

    if (error) {
      console.error("validateApiKey - Erreur lors de la validation:", error)
      return {
        valid: false,
        error: ApiError.INVALID_API_KEY,
      }
    }

    if (!keyData || !keyData.is_active) {
      console.log("validateApiKey - Clé inactive ou inexistante")
      return {
        valid: false,
        error: ApiError.INACTIVE_API_KEY,
      }
    }

    // Valider les UUID
    if (!isValidUUID(keyData.user_id) || !isValidUUID(keyData.id)) {
      console.error("validateApiKey - UUID invalide dans keyData:", keyData)
      return {
        valid: false,
        error: ApiError.INVALID_API_KEY,
      }
    }

    await supabase.from("api_keys").update({ last_used: new Date().toISOString() }).eq("id", keyData.id)
    console.log("validateApiKey - Clé API validée avec succès, userId:", keyData.user_id)

    return {
      valid: true,
      userId: keyData.user_id,
      keyId: keyData.id,
    }
  } catch (error) {
    console.error("validateApiKey - Erreur inattendue:", error)
    return {
      valid: false,
      error: ApiError.API_KEY_VALIDATION_ERROR,
    }
  }
}

export async function checkRateLimit(userId: string) {
  console.log("checkRateLimit - Début pour userId:", userId)
  try {
    if (!isValidUUID(userId)) {
      console.error("checkRateLimit - userId invalide:", userId)
      return {
        allowed: false,
        error: ApiError.RATE_LIMIT_CHECK_ERROR,
      }
    }

    const today = new Date()
    const supabase = await createClient()
    console.log("checkRateLimit - Vérification des limites de taux pour userId:", userId)

    const { data: subscriptions, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .gte("end_date", today.toISOString())
        .order("created_at", { ascending: false })

    if (subscriptionError) {
      console.error("checkRateLimit - Erreur lors de la récupération de l'abonnement:", subscriptionError)
    }

    const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null
    console.log("checkRateLimit - Abonnement actuel:", subscription)

    const { data: planData, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", subscription?.plan_id || "free")
        .single()

    console.log("checkRateLimit - Plan actuel:", planData)
    if (planError) {
      console.error("checkRateLimit - Erreur lors de la récupération du plan:", planError)
    }

    const plan = planData || {
      daily_limit: 500,
      request_interval: 12,
    }

    today.setHours(0, 0, 0, 0)
    const { count: dailyCount, error: countError } = await supabase
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("timestamp", today.toISOString())

    if (countError) {
      console.error("checkRateLimit - Erreur lors du comptage des appels quotidiens:", countError)
    }

    console.log("checkRateLimit - Nombre d'appels aujourd'hui:", dailyCount)

    if (dailyCount && dailyCount >= plan.daily_limit) {
      console.log("checkRateLimit - Limite quotidienne atteinte")
      return {
        allowed: false,
        error: ApiError.DAILY_LIMIT_REACHED.replace("{limit}", String(plan.daily_limit)),
      }
    }

    if (plan.request_interval > 0) {
      const minuteAgo = new Date()
      minuteAgo.setMinutes(minuteAgo.getMinutes() - 1)

      const { count: recentCount, error: recentError } = await supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("timestamp", minuteAgo.toISOString())

      if (recentError) {
        console.error("checkRateLimit - Erreur lors du comptage des appels récents:", recentError)
      }

      console.log("checkRateLimit - Nombre d'appels dans la dernière minute:", recentCount)

      const requestsPerMinute = plan.request_interval > 0 ? Math.floor(60 / plan.request_interval) : 1000000

      if (recentCount && recentCount >= requestsPerMinute) {
        console.log("checkRateLimit - Limite de taux par minute atteinte")
        return {
          allowed: false,
          error: ApiError.RATE_LIMIT_REACHED.replace("{limit}", String(requestsPerMinute)),
        }
      }
    }

    console.log("checkRateLimit - Limites de taux OK")
    return {
      allowed: true,
    }
  } catch (error) {
    console.error("checkRateLimit - Erreur inattendue:", error)
    return {
      allowed: false,
      error: ApiError.RATE_LIMIT_CHECK_ERROR,
    }
  }
}
