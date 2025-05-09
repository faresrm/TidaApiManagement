import { createClient } from "@/lib/supabase/server"
//Enum Messages
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
  // Generic error messages
  NO_DATA_FOUND = "No {resourceType} found for the stock symbol '{symbol}'. Please verify the entered symbol.",
  DATA_RETRIEVAL_SUCCESS = "{resourceType} for symbol '{symbol}' retrieved successfully. Displaying page {page} of {totalPages} (Total: {totalCount} entries).",
  DATA_RETRIEVAL_ERROR = "Error retrieving {resourceType}",
  PROCESSING_ERROR = "An error occurred... Details: {details}",
  NO_Company_DATA_FOUND = "No companies found.",

  // Date-related error messages
  MISSING_DATE_PARAMS = "The 'from' and 'to' parameters are required",
  INVALID_DATE_FORMAT = "Invalid date format. Please use YYYY-MM-DD",
  INVALID_DATE_RANGE = "'from' date must be before the 'to' date",

  // Collection endpoints
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

export async function logUsage(
    userId: string,
    keyId: string,
    endpoint: string,
    status: "success" | "error",
) {
  try {
    const supabase = await createClient(); // Créer une nouvelle instance
    const { error } = await supabase.from("usage_logs").insert({
      user_id: userId,
      api_key_id: keyId,
      endpoint,
      timestamp: new Date().toISOString(),
      status,
    });

    if (error) {
      console.error("Error inserting usage log:", error.message, error.details);
      throw error; // Lancer l'erreur pour une meilleure visibilité
    }
  } catch (logError) {
    console.error("Failed to record usage log:", {
      error: logError,
      userId,
      keyId,
      endpoint,
      status,
    });
    // Vous pouvez ajouter une logique pour réessayer ou alerter ici
  }
}

export async function validateApiKey(request: Request) {
  try {
    // Retrieve API key from the query parameter
    const url = new URL(request.url)
    const apiKey = url.searchParams.get("apikey")

    // If the key is not in the parameters, check the Authorization header (for backward compatibility)
    let authHeader = null
    if (!apiKey) {
      authHeader = request.headers.get("authorization")

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          valid: false,
          error: ApiError.MISSING_API_KEY,
        }
      }
    }

    // Extract the API key from the header if necessary
    const keyToValidate = apiKey || authHeader!.split(" ")[1]

    console.log("API Key to validate:", keyToValidate)

    // Validate the API key in the database
    const supabase = await createClient()

    const { data: keyData, error } = await supabase
        .from("api_keys")
        .select("id, user_id, is_active")
        .eq("key", keyToValidate)
        .single();

    if (error) {
      console.error("Error during API key validation:", error);
      return {
        valid: false,
        error: ApiError.INVALID_API_KEY,
      };
    }

    if (!keyData || !keyData.is_active) {
      return {
        valid: false,
        error: ApiError.INACTIVE_API_KEY,
      };
    }

    // Update the last used date
    await supabase.from("api_keys").update({ last_used: new Date().toISOString() }).eq("id", keyData.id)

    return {
      valid: true,
      userId: keyData.user_id,
      keyId: keyData.id,
    }
  } catch (error) {
    console.error("Error during API key validation:", error)
    return {
      valid: false,
      error: ApiError.API_KEY_VALIDATION_ERROR,
    }
  }
}

export async function checkRateLimit(userId: string) {
  try {
    const today = new Date()

    const supabase = await createClient()
    console.log("Checking rate limits for user:", userId)
    // Retrieve the active subscription to know the limitations
    const { data: subscriptions, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .gte("end_date", today.toISOString())
        .order("created_at", { ascending: false }) // Sort by creation date descending
    console.log(subscriptions)
    if (subscriptionError) {
      console.error("Error fetching subscription:", subscriptionError)
    }

    // Use the first active subscription found or the default free plan
    const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null
    console.log("Current subscription:", subscription)
    // Retrieve the plan details
    const { data: planData, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", subscription?.plan_id || "free")
        .single()
    console.log("Current plan:", planData)
    if (planError) {
      console.error("Error fetching plan:", planError)
    }

    // Default values for the free plan
    const plan = planData || {
      daily_limit: 500,
      request_interval: 12, // 5 requests per minute (60/5 = 12 seconds)
    }

    // Check the number of calls today
    today.setHours(0, 0, 0, 0)

    const { count: dailyCount, error: countError } = await supabase
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("timestamp", today.toISOString())

    if (countError) {
      console.error("Error counting daily calls:", countError)
    }

    console.log("Number of calls today:", dailyCount)

    if (dailyCount && dailyCount >= plan.daily_limit) {
      return {
        allowed: false,
        error: ApiError.DAILY_LIMIT_REACHED.replace("{limit}", String(plan.daily_limit)),
      }
    }

    // Check requests per minute
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

      console.log("Number of calls in the last minute:", recentCount)

      // Calculate the number of allowed requests per minute
      const requestsPerMinute = plan.request_interval > 0 ? Math.floor(60 / plan.request_interval) : 1000000

      if (recentCount && recentCount >= requestsPerMinute) {
        return {
          allowed: false,
          error: ApiError.RATE_LIMIT_REACHED.replace("{limit}", String(requestsPerMinute)),
        }
      }
    }

    return {
      allowed: true,
    }
  } catch (error) {
    console.error("Unexpected error during rate limit check:", error)
    return {
      allowed: false,
      error: ApiError.RATE_LIMIT_CHECK_ERROR,
    }
  }
}