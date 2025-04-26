"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface UsageData {
  name: string
  Total: number
}

export function UsageChart() {
  const [data, setData] = useState<UsageData[]>([])
  const [period, setPeriod] = useState<string>("week")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/usage?period=${period}`)

        if (!response.ok) {
          throw new Error("Erreur lors de la récupération des données d'utilisation")
        }

        const usageData = await response.json()
        setData(usageData)
      } catch (err) {
        console.error("Erreur:", err)
        setError("Impossible de charger les données d'utilisation")
        setData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [period])

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
  }

  return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Utilisation des API</CardTitle>
            <CardDescription>
              Nombre d'appels API par{" "}
              {period === "day" ? "heure" : period === "week" ? "jour" : period === "month" ? "jour du mois" : "mois"}
            </CardDescription>
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="pl-2">
          {isLoading ? (
              <div className="flex h-[350px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
          ) : error ? (
              <div className="flex h-[350px] items-center justify-center">
                <p className="text-destructive">{error}</p>
              </div>
          ) : data.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center">
                <p className="text-muted-foreground">Aucune donnée disponible pour cette période</p>
              </div>
          ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                      cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
  )
}
