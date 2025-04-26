"use client"

import { useState, useEffect } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

// Définir des variables CSS pour les couleurs
const successColor = "var(--success, #a3e635)"
const infoColor = "var(--info, #93c5fd)"

// Types pour les données d'utilisation
interface ApiUsageData {
    timestamp: string
    basePath: string
    count: number
    success: number
    failed: number
    endpoints: Record<string, number>
}

interface ApiUsageSummary {
    basePath: string
    apiCalls: number
    keys: number
    reqPerMin: number
    successRate: number
}

// Périodes disponibles
type TimePeriod = "5m" | "15m" | "1h" | "4h" | "24h" | "72h" | "7d" | "30d"

// Composant personnalisé pour le tooltip du graphique
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const endpoints = payload[0].payload.endpoints || {}

        return (
            <div className="bg-background p-3 border rounded-md shadow-md">
                <p className="font-medium">{label}</p>
                <div className="mt-2">
                    {Object.entries(endpoints).map(([endpoint, count]: [string, any]) => (
                        <div key={endpoint} className="flex items-center text-sm py-1">
                            <div className="w-2 h-2 rounded-full bg-primary mr-2" />
                            <span className="font-mono">{endpoint}</span>
                            <span className="ml-2 text-muted-foreground">({count})</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-success mr-2" />
                        <span>Succès: {payload[0].value}</span>
                    </div>
                    <div className="flex items-center ml-4">
                        <div className="w-2 h-2 rounded-full bg-info mr-2" />
                        <span>Échecs: {payload[1]?.value || 0}</span>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

export function ApiUsageDashboard() {
    const [period, setPeriod] = useState<TimePeriod>("5m")
    const [chartData, setChartData] = useState<any[]>([])
    const [tableData, setTableData] = useState<ApiUsageSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Fonction pour charger les données en fonction de la période
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/usage/dashboard?period=${period}`);
                if (!response.ok) {
                    throw new Error("Erreur lors de la récupération des données");
                }
                const data = await response.json();

                // Trier les données par timestamp en fonction de la période
                const sortedChartData = data.chartData.sort((a: ApiUsageData, b: ApiUsageData) => {
                    let dateA: Date, dateB: Date;

                    if (period === "72h") {
                        // Format DD/MM HH:mm (ex. "21/04 22:04")
                        // Ajouter une année fictive (2025) pour parsing
                        const [dayA, monthA, timeA] = a.timestamp.split(/[\s/]/);
                        const [dayB, monthB, timeB] = b.timestamp.split(/[\s/]/);
                        dateA = new Date(`2025-${monthA}-${dayA}T${timeA}:00`);
                        dateB = new Date(`2025-${monthB}-${dayB}T${timeB}:00`);
                    } else if (period === "7d" || period === "30d") {
                        // Format DD/MM (ex. "18/04")
                        const [dayA, monthA] = a.timestamp.split("/");
                        const [dayB, monthB] = b.timestamp.split("/");
                        dateA = new Date(`2025-${monthA}-${dayA}`);
                        dateB = new Date(`2025-${monthB}-${dayB}`);
                    } else {
                        // Format HH:mm:ss (ex. "01:32:28")
                        dateA = new Date(`1970-01-01T${a.timestamp}`);
                        dateB = new Date(`1970-01-01T${b.timestamp}`);
                    }

                    return dateA.getTime() - dateB.getTime();
                });

                // Mettre à jour les données du graphique
                setChartData(sortedChartData);
                console.log("Sorted Chart Data:", sortedChartData);

                // Mettre à jour les données du tableau
                setTableData(data.tableData);
            } catch (error) {
                console.error("Erreur:", error);
                setError("Impossible de charger les données d'utilisation");
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [period]);

    // Fonction pour gérer le changement de période
    const handlePeriodChange = (newPeriod: TimePeriod) => {
        setPeriod(newPeriod)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Requests Usage</h2>
                <div className="flex items-center space-x-1 rounded-md bg-muted p-1">
                    <button
                        onClick={() => handlePeriodChange("5m")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "5m"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        5m
                    </button>
                    <button
                        onClick={() => handlePeriodChange("15m")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "15m"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        15m
                    </button>
                    <button
                        onClick={() => handlePeriodChange("1h")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "1h"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        1h
                    </button>
                    <button
                        onClick={() => handlePeriodChange("4h")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "4h"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        4h
                    </button>
                    <button
                        onClick={() => handlePeriodChange("24h")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "24h"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        24h
                    </button>
                    <button
                        onClick={() => handlePeriodChange("72h")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "72h"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        72h
                    </button>
                    <button
                        onClick={() => handlePeriodChange("7d")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "7d"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        7d
                    </button>
                    <button
                        onClick={() => handlePeriodChange("30d")}
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            period === "30d"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-background/50"
                        }`}
                    >
                        30d
                    </button>
                </div>
            </div>

            <Card className="bg-background">
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex h-[300px] items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                        </div>
                    ) : error ? (
                        <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-10 w-10 mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                            <div className="rounded-full bg-muted p-3 mb-2">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                            <p className="text-center">No data available for this period</p>
                            <p className="text-center text-sm mt-1">
                                Try selecting a different period or generating more API activity.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} stackOffset="sign">
                                <XAxis dataKey="timestamp" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="success" stackId="a" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="failed" stackId="a" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[250px]">Base Path</TableHead>
                            <TableHead>API Calls</TableHead>
                            <TableHead>Keys</TableHead>
                            <TableHead>Req/Min</TableHead>
                            <TableHead>Success</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Loading data...
                                </TableCell>
                            </TableRow>
                        ) : tableData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <AlertCircle className="h-5 w-5 mb-1" />
                                        <p>No data available for this period
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            tableData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center">
                                            <div className="h-2 w-2 rounded-full bg-blue-400 mr-2"></div>
                                            {row.basePath}
                                        </div>
                                    </TableCell>
                                    <TableCell>{row.apiCalls}</TableCell>
                                    <TableCell>{row.keys}</TableCell>
                                    <TableCell>{row.reqPerMin.toFixed(4)}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                                        >
                                            {row.successRate}%
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
