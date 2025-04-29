import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, CreditCard, DollarSign, Users } from "lucide-react";
import { ApiUsageDashboard } from "@/components/api-usage-dashboard";
import { createClient } from "@/lib/supabase/server";
import { UsageChart } from "@/components/usage-chart";

export default async function DashboardPage() {
  // Initialize default values
  let apiKeysCount = 0;
  let usageLogs = [];
    let dailycallCount = 0;
  let subscriptionData = {
    plans: {
      name: "Free",
      price: 0,
      daily_limit: 100,
    },
  };

  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (userId) {
      // Fetch usage logs
        const today = new Date();
        today.setHours(0, 0, 0, 0);
      const { data: logsData } = await supabase
          .from("usage_logs")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .range(0, 9999); // <--- Ajoute cette ligne pour dépasser les 1000
      const { count: dailyCount, error: countError } = await supabase
          .from("usage_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("timestamp", today.toISOString())
      dailycallCount = dailyCount || 0;
      usageLogs = logsData || [];

        console.log("Usage logs:", usageLogs.length);

      // Fetch active subscription
      const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("*, plans(*)")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

      // If subscription exists, use it
      if (subscriptions && subscriptions.length > 0) {
        subscriptionData = subscriptions[0];
        console.log("Subscription data:", subscriptionData);
      } else {
        // Create a default subscription if none exists
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        await supabase.from("subscriptions").insert({
          user_id: userId,
          plan_id: "free",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: "active",
        });
      }

      // Get API keys count
      const { count } = await supabase
          .from("api_keys")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_active", true);

      apiKeysCount = count || 0;
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    // Continue with default values on error
  }


    return (
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Calls Today</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dailycallCount || 0}

                  </div>
                  <p className="text-xs text-muted-foreground">
                    Daily Limit: {subscriptionData?.plans?.daily_limit || 100}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{apiKeysCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{subscriptionData?.plans?.name || "Free"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${subscriptionData?.plans?.price || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/*<div className="grid gap-4 md:grid-cols2">*/}
            {/* <Card>*/}
            {/* <CardHeader>*/}
            {/* <CardTitle>Recent Activity</CardTitle>*/}
            {/* <CardDescription>Your recent API usage and events</CardDescription>*/}
            {/* </CardHeader>*/}
            {/* <CardContent>*/}
            {/* {usageLogs.length > 0 ? (*/}
            {/* <div className="space-y-4">*/}
            {/* {usageLogs.slice(0, 5).map((log, index) => (*/}
            {/* <div key={index} className="flex items-center gap-4">*/}
            {/* <div className="w-2 h-2 rounded-full bg-primary" />*/}
            {/* <div className="flex-1">*/}
            {/* <p className="text-sm font-medium">{log.endpoint}</p>*/}
            {/* <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>*/}
            {/* </div>*/}
            {/* <div>*/}
            {/* <Badge variant={log.status >= 400 ? "destructive" : "default"}>{log.status}</Badge>*/}
            {/* </div>*/}
            {/* </div>*/}
            {/* ))}*/}
            {/* </div>*/}
            {/* ) : (*/}
            {/* <div className="flex h-[200px] items-center justify-center">*/}
            {/* <p className="text-muted-foreground">No recent activity</p>*/}
            {/* </div>*/}
            {/* )}*/}
            {/* </CardContent>*/}
            {/* </Card>*/}
            {/*</div>*/}

            <ApiUsageDashboard />
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4">
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Detailed Analytics</CardTitle>
                <CardDescription>Visualize your API usage across different time periods</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Detailed analytics will be available soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}