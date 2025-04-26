"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PaymentDialog } from "@/components/payment-dialog";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  price: number;
  daily_limit: number;
  requests_per_minute?: number;
  request_interval?: number;
  description: string;
  features: string[];
}

interface SubscriptionPlansProps {
  plans: Plan[];
  currentPlanId: string;
  userId: string;
}

export function SubscriptionPlans({ plans, currentPlanId: initialPlanId, userId }: SubscriptionPlansProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState(initialPlanId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Function to retrieve the current subscription
  const refreshCurrentSubscription = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/subscriptions");

      if (!response.ok) {
        throw new Error("Error fetching subscription");
      }

      const data = await response.json();

      if (data.subscription && data.subscription.plan_id) {
        setCurrentPlanId(data.subscription.plan_id);
        console.log("Current plan updated:", data.subscription.plan_id);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === currentPlanId) {
      toast({
        title: "Already subscribed",
        description: `You are already subscribed to the ${plan.name} plan`,
      });
      return;
    }

    if (plan.id === "free") {
      handleSubscribe(plan.id);
      return;
    }

    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const handleSubscribe = async (planId: string) => {
    setIsLoading(true);

    try {
      console.log("Updating subscription to plan:", planId);

      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Response error:", data);
        throw new Error(data.error || "Error updating subscription");
      }

      console.log("Subscription update response:", data);

      toast({
        title: "Subscription updated",
        description: `Your subscription has been successfully updated to the ${
            plans.find((p) => p.id === planId)?.name
        } plan`,
      });

      // Force a full page reload
      window.location.href = "/dashboard/subscriptions";
    } catch (error: any) {
      console.error("Full error:", error);

      toast({
        title: "Error",
        description: error.message || "An error occurred while updating the subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = (planId: string) => {
    handleSubscribe(planId);
    setShowPaymentDialog(false);
  };

  // Calculate requests per minute from the interval if necessary
  const getRequestsPerMinute = (plan: Plan) => {
    if (plan.requests_per_minute !== undefined) {
      return plan.requests_per_minute;
    }

    if (plan.request_interval && plan.request_interval > 0) {
      return Math.floor(60 / plan.request_interval);
    }

    return "Unlimited";
  };

  return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">
            Your current plan: {plans.find((p) => p.id === currentPlanId)?.name || "Free"}
          </h3>
          <Button variant="outline" size="sm" onClick={refreshCurrentSubscription} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
              <Card key={plan.id} className={plan.id === currentPlanId ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.id === currentPlanId && (
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          Current
                        </Badge>
                    )}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">{plan.price}€</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-medium">Daily Calls</span>
                      <span className="text-sm font-bold">
                    {plan.daily_limit >= 1000000 ? "Unlimited" : plan.daily_limit.toLocaleString()}
                  </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-medium">Requests/minute</span>
                      <span className="text-sm font-bold">{getRequestsPerMinute(plan)}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm mt-4">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <Check className="mr-2 h-4 w-4 text-primary" />
                          {feature}
                        </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                      className="w-full"
                      variant={plan.id === currentPlanId ? "outline" : "default"}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={plan.id === currentPlanId || isLoading}
                  >
                    {isLoading ? (
                        <Zap className="mr-2 h-4 w-4 animate-pulse" />
                    ) : plan.id === currentPlanId ? (
                        "Current Plan"
                    ) : (
                        "Choose this plan"
                    )}
                  </Button>
                </CardFooter>
              </Card>
          ))}
        </div>

        {selectedPlan && (
            <PaymentDialog
                open={showPaymentDialog}
                onOpenChange={setShowPaymentDialog}
                plan={selectedPlan}
                onSuccess={handlePaymentSuccess}
            />
        )}
      </div>
  );
}