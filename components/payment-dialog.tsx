"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  cardNumber: z.string().regex(/^\d{16}$/, { message: "Card number must be 16 digits" }),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/, { message: "Invalid format (MM/YY expected)" }),
  cvv: z.string().regex(/^\d{3}$/, { message: "CVV must be 3 digits" }),
  cardholderName: z.string().min(1, { message: "Cardholder name is required" }),
});

interface Plan {
  id: string;
  name: string;
  price: number;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  onSuccess: (planId: string) => void;
}

export function PaymentDialog({ open, onOpenChange, plan, onSuccess }: PaymentDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      cardholderName: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);

    try {
      const response = await fetch("/api/payment/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          cardNumber: values.cardNumber,
          expiryDate: values.expiryDate,
          cvv: values.cvv,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error processing payment");
      }

      toast({
        title: "Payment successful",
        description: `Your payment of ${plan.price}€ has been processed successfully`,
      });

      form.reset();
      onSuccess(plan.id);
    } catch (error: any) {
      toast({
        title: "Payment error",
        description: error.message || "An error occurred while processing the payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Payment for {plan.name} Plan</DialogTitle>
            <DialogDescription>
              You will be charged {plan.price}€ per month for the {plan.name} plan. Enter your payment
              information below.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                  control={form.control}
                  name="cardholderName"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cardholder Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="cardNumber"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>Card Number</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date</FormLabel>
                          <FormControl>
                            <Input placeholder="MM/YY" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="cvv"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>CVV</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing ? "Processing..." : `Pay ${plan.price}€`}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
  );
}