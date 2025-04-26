import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionPlans } from "@/components/subscription-plans";
import { createClient } from "@/lib/supabase/server";

// Functions to calculate requests per minute from the interval
function calculateRequestsPerMinute(requestInterval: number) {
  if (requestInterval <= 0) return 0; // Unlimited
  return Math.floor(60 / requestInterval);
}

export default async function SubscriptionsPage() {
  const supabase = await createClient();

  // Use getUser instead of getSession for more security
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    return <div>You must be logged in to access this page.</div>;
  }

  // Fetch all available plans
  const { data: plansData, error: plansError } = await supabase
      .from("plans")
      .select("*")
      .order("price", { ascending: true });

  if (plansError) {
    console.error("Error fetching plans:", plansError);
    return <div>Error loading plans. Please try again later.</div>;
  }

  // Fetch the most recent active subscription
  const { data: subscriptions, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false }); // Sort by creation date descending
  console.log("Subscriptions data:", subscriptions);
  if (subscriptionError) {
    console.error("Error fetching subscription:", subscriptionError);
  }

  // Use the first active subscription found or the default free plan
  const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;
  console.log(subscription, "Subscription data");
  const currentPlanId = subscription?.plan_id || "free";
  console.log("Current plan ID:", currentPlanId);

  // Transform the plan data for display
  const availablePlans = plansData.map((plan) => {
    // Calculate requests per minute from the interval
    const requestsPerMinute = calculateRequestsPerMinute(plan.request_interval);

    // Generate features based on plan limits
    const features = [
      `${plan.daily_limit >= 1000000 ? "Unlimited API calls" : `${plan.daily_limit.toLocaleString()} API calls per day`}`,
      `${requestsPerMinute === 0 ? "Unlimited requests per minute" : `${requestsPerMinute} requests per minute`}`,
      "Access to all endpoints",
      `${plan.id === "enterprise" ? "Unlimited API keys" : "Maximum 5 API keys"}`,
      ...(plan.id === "free" ? [] : []),
      ...(plan.id === "basic" ? ["Email support"] : []),
      ...(plan.id === "pro" ? ["Advanced statistics"] : []),
      ...(plan.id === "enterprise" ? ["24/7 dedicated support"] : []),
    ];

    return {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      daily_limit: plan.daily_limit,
      request_interval: plan.request_interval,
      requests_per_minute: requestsPerMinute,
      description: plan.description,
      features,
    };
  });

  return (
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Subscriptions</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Choose your plan</CardTitle>
            <CardDescription>
              Select the plan that best suits your needs. Your current plan:{" "}
              <span className="font-medium">{availablePlans.find((p) => p.id === currentPlanId)?.name || "Free"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubscriptionPlans plans={availablePlans} currentPlanId={currentPlanId} userId={userId} />
          </CardContent>
        </Card>
      </div>
  );
}