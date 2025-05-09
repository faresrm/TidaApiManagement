import { createServerClient } from "@/lib/supabase/server"

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

export function formatApiMessage(message: string, params: Record<string, string | number>): string {
  let formattedMessage = message
  for (const [key, value] of Object.entries(params)) {
    formattedMessage = formattedMessage.replace(`{${key}}`, String(value))
  }
  return formattedMessage
}

export async function logUsageAsync(
    supabase: any,
    userId: string,
    keyId: string,
    endpoint: string,
    status: "success" | "error"
) {
  supabase
      .from("usage_logs")
      .insert({
        user_id: userId,
        api_key_id: keyId,
        endpoint,
        timestamp: new Date().toISOString(),
        status,
      })
      .then(
          () => console.log("Log recorded"),
          (error) => console.error("Error logging:", error)
      )
}

export async function logUsage(userId: string, keyId: string, endpoint: string, status: "success" | "error") {
  try {
    const supabase = createServerClient()
    await supabase.from("usage_logs").insert({
      user_id: userId,
      api_key_id: keyId,
      endpoint,
      timestamp: new Date().toISOString(),
      status,
    })
  } catch (logError) {
    console.error("Error recording usage log:", logError)
  }
}

export async function validateApiKey(request: Request) {
  try {
    const url = new URL(request.url)
    const apiKey = url.searchParams.get("apikey")

    let authHeader = null
    if (!apiKey) {
      authHeader = request.headers.get("authorization")
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { valid: false, error: ApiError.MISSING_API_KEY }
      }
    }

    const keyToValidate = apiKey || authHeader!.split(" ")[1]
    console.log("API Key to validate:", keyToValidate)

    const supabase = createServerClient()

    const { data: keyData, error } = await supabase
        .from("api_keys")
        .select("id, user_id, is_active")
        .eq("key", keyToValidate)
        .single()

    if (error) {
      console.error("Error during API key validation:", error)
      return { valid: false, error: ApiError.INVALID_API_KEY }
    }

    if (!keyData || !keyData.is_active) {
      return { valid: false, error: ApiError.INACTIVE_API_KEY }
    }

    await supabase.from("api_keys").update({ last_used: new Date().toISOString() }).eq("id", keyData.id)

    return {
      valid: true,
      userId: keyData.user_id,
      keyId: keyData.id,
    }
  } catch (error) {
    console.error("Error during API key validation:", error)
    return { valid: false, error: ApiError.API_KEY_VALIDATION_ERROR }
  }
}

export async function checkRateLimit(userId: string) {
  try {
    const today = new Date()
    const supabase = createServerClient()

    console.log("Checking rate limits for user:", userId)

    const { data: subscriptions, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .gte("end_date", today.toISOString())
        .order("created_at", { ascending: false })

    if (subscriptionError) {
      console.error("Error fetching subscription:", subscriptionError)
    }

    const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null

    const { data: planData, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", subscription?.plan_id || "free")
        .single()

    if (planError) {
      console.error("Error fetching plan:", planError)
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
      console.error("Error counting daily calls:", countError)
    }

    if (dailyCount && dailyCount >= plan.daily_limit) {
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
        console.error("Error counting recent calls:", recentError)
      }

      const requestsPerMinute = plan.request_interval > 0 ? Math.floor(60 / plan.request_interval) : 1000000

      if (recentCount && recentCount >= requestsPerMinute) {
        return {
          allowed: false,
          error: ApiError.RATE_LIMIT_REACHED.replace("{limit}", String(requestsPerMinute)),
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error("Unexpected error during rate limit check:", error)
    return {
      allowed: false,
      error: ApiError.RATE_LIMIT_CHECK_ERROR,
    }
  }
}
