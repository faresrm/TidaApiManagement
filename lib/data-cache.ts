import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"

export const getCachedCompanies = cache(async (offset: number, limit: number, filters: {
    sector?: string
    industry?: string
    exchange?: string
}) => {
    const supabase = createServerClient()

    let query = supabase
        .from("companies")
        .select(`
      symbol,
      price,
      market_cap,
      beta,
      company_name,
      currency,
      exchange,
      industry,
      sector,
      country,
      is_etf,
      is_actively_trading
    `, { count: "exact" })
        .order("market_cap", { ascending: false })
        .range(offset, offset + limit - 1)

    if (filters.sector) query = query.eq("sector", filters.sector)
    if (filters.industry) query = query.eq("industry", filters.industry)
    if (filters.exchange) query = query.eq("exchange", filters.exchange)

    return query
})
