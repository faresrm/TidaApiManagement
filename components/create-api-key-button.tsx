"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { PlusCircle } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).max(50),
});

interface CreateApiKeyButtonProps {
  userId: string;
  activeKeysCount: number;
}

export function CreateApiKeyButton({ userId, activeKeysCount }: CreateApiKeyButtonProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsCreating(true);
    setNewKey(null);

    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error creating the API key");
      }

      if (data.data && data.data[0]) {
        setNewKey(data.data[0].key);
        form.reset();
      }

      toast({
        title: "API key created",
        description: "Your new API key has been created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setNewKey(null);
    form.reset();
    router.refresh();
  };

  const isLimitReached = activeKeysCount >= 5;

  return (
      <>
        <Button
            onClick={() => setOpen(true)}
            disabled={isLimitReached}
            title={isLimitReached ? "You have reached the limit of 5 active API keys" : ""}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New API Key
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to access our endpoints. Make sure to copy it as it will not be
                visible again.
              </DialogDescription>
            </DialogHeader>

            {newKey ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-sm font-medium mb-2">Your new API key:</p>
                    <p className="font-mono text-xs break-all">{newKey}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Copy this key now. For security reasons, you won't be able to see it again after closing
                    this window.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Use this key by adding it as a query parameter to your API calls:
                  </p>
                  <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">GET /api/v1/users?apikey={newKey}</pre>
                  <DialogFooter>
                    <Button onClick={handleClose}>Close</Button>
                  </DialogFooter>
                </div>
            ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                              <FormLabel>Key Name</FormLabel>
                              <FormControl>
                                <Input placeholder="API Production" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
            )}
          </DialogContent>
        </Dialog>
      </>
  );
}