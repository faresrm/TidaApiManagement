import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EndpointsList } from "@/components/endpoints-list"
import { createClient } from "@/lib/supabase/server"

// Endpoints disponibles
const availableEndpoints = [
    {
        id: "get-ownership-form13",
        name: "GET /api/ownership/form13/{symbol}",
        description: "Retrieve institutional ownership data from Form 13 filings for a specific stock symbol.",
        method: "GET",
        path: "/api/ownership/form13/{symbol}",
        example: "curl -X GET https://api.example.com/api/ownership/form13/AAPL?limit=4&apikey=YOUR_API_KEY",
        response: JSON.stringify(
            [
                {
                    stockSymbol: "AAPL",
                    cik: 123456,
                    dateReported: "2024-12-31",
                    issuer: "Apple Inc.",
                    filingDate: "2025-01-15",
                    cusip: "037833100",
                    class: "COM",
                    type: "13F-HR",
                    investmentDiscretion: "SOLE",
                    sharedVoting: 50000,
                    nonVoting: 20000,
                    change: 0.05,
                    value: 180000000,
                    shares: 100000,
                    soleVoting: 30000,
                },
            ],
            null,
            2
        ),
    },
    {
        id: "get-company-profile",
        name: "GET /api/company/{symbol}",
        description: "Retrieve comprehensive information about a company, including price, identifiers, exchange details, and contact information.",
        method: "GET",
        path: "/api/company/{symbol}",
        example: "curl -X GET https://api.example.com/api/company/AAPL?apikey=YOUR_API_KEY",
        response: JSON.stringify(
            {
                symbol: "AAPL",
                price: 232.8,
                marketCap: 3500823120000,
                beta: 1.24,
                lastDividend: 0.99,
                range: "164.08-260.1",
                change: 4.79,
                changePercentage: 2.1008,
                volume: 0,
                averageVolume: 50542058,
                companyName: "Apple Inc.",
                currency: "USD",
                cik: "0000320193",
                isin: "US0378331005",
                cusip: "037833100",
                exchangeFullName: "NASDAQ Global Select",
                exchange: "NASDAQ",
                industry: "Consumer Electronics",
                website: "https://www.apple.com",
                description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers...",
                ceo: "Mr. Timothy D. Cook",
                sector: "Technology",
                country: "US",
                fullTimeEmployees: "164000",
                phone: "(408) 996-1010",
                address: "One Apple Park Way",
                city: "Cupertino",
                state: "CA",
                zip: "95014",
                image: "https://images.financialmodelingprep.com/symbol/AAPL.png",
                ipoDate: "1980-12-12",
                defaultImage: false,
                isEtf: false,
                isActivelyTrading: true,
                isAdr: false,
                isFund: false,
            },
            null,
            2
        ),
    },
    {
        id: "get-financials-balance-sheet",
        name: "GET /api/financials/balance-sheet/{symbol}",
        description: "Retrieve recent balance sheet entries for a company, including assets, liabilities, equity, and investments.",
        method: "GET",
        path: "/api/financials/balance-sheet/{symbol}",
        example: "curl -X GET https://api.example.com/api/financials/balance-sheet/AAPL?limit=4&apikey=YOUR_API_KEY",
        response: JSON.stringify(
            [
                {
                    symbol: "AAPL",
                    date: "2024-12-31",
                    reportedCurrency: "USD",
                    calendarYear: 2024,
                    period: "Q4",
                    cashAndCashEquivalents: 79000000000,
                    shortTermInvestments: 12000000000,
                    cashAndShortTermInvestments: 91000000000,
                    netReceivables: 64000000000,
                    inventory: 41000000000,
                    otherCurrentAssets: 15000000000,
                    totalCurrentAssets: 211000000000,
                    propertyPlantEquipmentNet: 42000000000,
                    goodwill: 38000000000,
                    intangibleAssets: 9000000000,
                    goodwillAndIntangibleAssets: 47000000000,
                    longTermInvestments: 132000000000,
                    taxAssets: 2000000000,
                    otherNonCurrentAssets: 8000000000,
                    totalNonCurrentAssets: 230000000000,
                    otherAssets: 4000000000,
                    totalAssets: 387000000000,
                    accountPayables: 68000000000,
                    shortTermDebt: 25000000000,
                    taxPayables: 10000000000,
                    deferredRevenue: 8000000000,
                    otherCurrentLiabilities: 14000000000,
                    totalCurrentLiabilities: 125000000000,
                    longTermDebt: 100000000000,
                    deferredRevenueNonCurrent: 6000000000,
                    deferrredTaxLiabilitiesNonCurrent: 5000000000,
                    otherNonCurrentLiabilities: 7000000000,
                    totalNonCurrentLiabilities: 118000000000,
                    otherLiabilities: 3000000000,
                    totalLiabilities: 245000000000,
                    preferredStock: 0,
                    commonStock: 60000000000,
                    retainedEarnings: 40000000000,
                    accumulatedOtherComprehensiveIncomeLoss: -2000000000,
                    othertotalStockholdersEquity: 2000000000,
                    totalStockholdersEquity: 142000000000,
                    totalLiabilitiesAndStockholdersEquity: 387000000000,
                    totalInvestments: 144000000000,
                    totalDebt: 125000000000,
                    netDebt: 46000000000,
                    minorityInterest: 1000000000,
                    capitalLeaseObligations: 2000000000,
                    totalEquity: 142000000000,
                },
            ],
            null,
            2
        ),
    },
    {
        id: "get-financials-cash-flow",
        name: "GET /api/financials/cash-flow/{symbol}",
        description: "Retrieve detailed cash flow data for a company, including operating, investing, and financing activities.",
        method: "GET",
        path: "/api/financials/cash-flow/{symbol}",
        example: "curl -X GET https://api.example.com/api/financials/cash-flow/AAPL?limit=4&apikey=YOUR_API_KEY",
        response: JSON.stringify(
            [
                {
                    date: "2024-12-31",
                    symbol: "AAPL",
                    reportedCurrency: "USD",
                    calendarYear: 2024,
                    period: "Q4",
                    netIncome: 97000000000,
                    depreciationAndAmortization: 11000000000,
                    deferredIncomeTax: 2000000000,
                    stockBasedCompensation: 3000000000,
                    changeInWorkingCapital: -4000000000,
                    accountsReceivables: -5000000000,
                    inventory: -2000000000,
                    accountsPayables: 3000000000,
                    otherWorkingCapital: -1000000000,
                    otherNonCashItems: 1500000000,
                    netCashProvidedByOperatingActivites: 110000000000,
                    investmentsInPropertyPlantAndEquipment: -25000000000,
                    acquisitionsNet: -3000000000,
                    purchasesOfInvestments: -20000000000,
                    salesMaturitiesOfInvestments: 18000000000,
                    otherInvestingActivites: -1000000000,
                    netCashUsedForInvestingActivites: -31000000000,
                    debtRepayment: -5000000000,
                    commonStockIssued: 4000000000,
                    commonStockRepurchased: -20000000000,
                    dividendsPaid: -14000000000,
                    otherFinancingActivites: -1000000000,
                    netCashUsedProvidedByFinancingActivities: -36000000000,
                    effectOfForexChangesOnCash: -200000000,
                    netChangeInCash: 43000000000,
                    cashAtEndOfPeriod: 120000000000,
                    cashAtBeginningOfPeriod: 77000000000,
                    operatingCashFlow: 110000000000,
                    capitalExpenditure: -25000000000,
                    freeCashFlow: 85000000000,
                },
            ],
            null,
            2
        ),
    },
    {
        id: "get-financials-income-statement",
        name: "GET /api/financials/income-statement/{symbol}",
        description: "Retrieve detailed income statement data for a company, including revenue, expenses, EBITDA, net income, and EPS.",
        method: "GET",
        path: "/api/financials/income-statement/{symbol}",
        example: "curl -X GET https://api.example.com/api/financials/income-statement/AAPL?limit=4&apikey=YOUR_API_KEY",
        response: JSON.stringify(
            [
                {
                    date: "2024-12-31",
                    symbol: "AAPL",
                    reportedCurrency: "USD",
                    calendarYear: 2024,
                    period: "Q4",
                    revenue: 420000000000,
                    costOfRevenue: 250000000000,
                    grossProfit: 170000000000,
                    grossProfitRatio: 0.4048,
                    ResearchAndDevelopmentExpenses: 22000000000,
                    GeneralAndAdministrativeExpenses: 15000000000,
                    SellingAndMarketingExpenses: 10000000000,
                    SellingGeneralAndAdministrativeExpenses: 25000000000,
                    otherExpenses: 2000000000,
                    operatingExpenses: 67000000000,
                    costAndExpenses: 317000000000,
                    interestExpense: 3000000000,
                    depreciationAndAmortization: 11000000000,
                    EBITDA: 95000000000,
                    EBITDARatio: 0.2262,
                    operatingIncome: 103000000000,
                    operatingIncomeRatio: 0.2452,
                    totalOtherIncomeExpensesNet: -1000000000,
                    incomeBeforeTax: 102000000000,
                    incomeBeforeTaxRatio: 0.2429,
                    incomeTaxExpense: 16000000000,
                    netIncome: 86000000000,
                    netIncomeRatio: 0.2048,
                    EPS: 5.50,
                    EPSDiluted: 5.30,
                    weightedAverageShsOut: 15600000000,
                    weightedAverageShsOutDil: 16200000000,
                    interestIncome: 800000000,
                },
            ],
            null,
            2
        ),
    },
    {
        id: "get-stock-historical-price",
        name: "GET /api/stock/historical-price/{symbol}",
        description: "Retrieve daily historical stock prices, including open, high, low, close, adjusted close, volume, and VWAP.",
        method: "GET",
        path: "/api/stock/historical-price/{symbol}",
        example: "curl -X GET https://api.example.com/api/stock/historical-price/AAPL?from=2024-01-01&to=2024-04-15&apikey=YOUR_API_KEY",
        response: JSON.stringify(
            [
                {
                    symbol: "AAPL",
                    date: "2024-04-15",
                    open: 172.22,
                    high: 175.12,
                    low: 171.88,
                    close: 174.55,
                    adjClose: 174.55,
                    volume: 82000000,
                    unadjustedVolume: 82000000,
                    change: 2.33,
                    changePercent: 1.35,
                    vwap: 173.85,
                    label: "Apr 15, 24",
                    changeOverTime: 0.0543,
                },
            ],
            null,
            2
        ),
    },
]

export default async function EndpointsPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // Récupérer l'abonnement actif pour connaître les limitations
  const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single()

  const plan = subscription?.plans || { daily_limit: 500, request_interval: 12 }

  // Calculer les requêtes par minute
  const requestsPerMinute = plan.request_interval > 0 ? Math.floor(60 / plan.request_interval) : "Illimitées"

  return (
      <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold tracking-tight">API Endpoints</h2>
          </div>
          <Card>
              <CardHeader>
                  <CardTitle>Available Endpoints</CardTitle>
                  <CardDescription>
                      List of available API endpoints with your current subscription. Daily
                      limit: {plan.daily_limit} calls,
                      requests per minute: {requestsPerMinute}.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <EndpointsList endpoints={availableEndpoints}/>
              </CardContent>
          </Card>
      </div>
  )
}