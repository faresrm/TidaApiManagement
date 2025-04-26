"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Key, Trash, RefreshCw } from "lucide-react";

interface ApiKey {
  id: string;
  key: string;
  name: string;
  created_at: string;
  last_used?: string;
  is_active: boolean;
}

interface ApiKeysListProps {
  apiKeys: ApiKey[];
}

export function ApiKeysList({ apiKeys }: ApiKeysListProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const activeKeys = apiKeys.filter((key) => key.is_active);
  const keysCount = activeKeys.length;

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Key copied",
      description: "The API key has been copied to the clipboard",
    });
  };

  const handleDeleteClick = (key: ApiKey) => {
    setSelectedKey(key);
    setShowDeleteDialog(true);
  };

  const handleRotateClick = (key: ApiKey) => {
    setSelectedKey(key);
    setShowRotateDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedKey) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/keys?id=${selectedKey.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error deleting the API key");
      }

      toast({
        title: "Key deleted",
        description: "The API key has been successfully deactivated",
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleRotateConfirm = async () => {
    if (!selectedKey) return;

    setIsRotating(true);
    setNewKey(null);

    try {
      const response = await fetch("/api/keys", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyId: selectedKey.id }),
      });

      if (!response.ok) {
        throw new Error("Error rotating the API key");
      }

      const data = await response.json();

      if (data.data && data.data[0]) {
        setNewKey(data.data[0].key);
      }

      toast({
        title: "Key rotated",
        description: "Your API key has been successfully rotated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRotating(false);
    }
  };

  return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Your API Keys ({keysCount}/5)</h3>
          <p className="text-sm text-muted-foreground">You can create up to 5 active API keys</p>
        </div>

        {apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <Key className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No API Keys</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You haven't created any API keys yet. Create one to start using our APIs.
              </p>
            </div>
        ) : (
            <div className="grid gap-4">
              {apiKeys.map((key) => (
                  <Card key={key.id} className={`p-4 ${!key.is_active ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Key className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Created on {new Date(key.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleCopyKey(key.key)} disabled={!key.is_active}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRotateClick(key)} disabled={!key.is_active}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Rotate
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteClick(key)} disabled={!key.is_active}>
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-mono bg-muted p-2 rounded-md overflow-x-auto">{key.key}</p>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">
                        Usage: <code>?apikey={key.key}</code>
                      </p>
                    </div>
                    {key.last_used && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Last used: {new Date(key.last_used).toLocaleString()}
                        </p>
                    )}
                    {!key.is_active && <p className="mt-2 text-xs text-destructive">This key has been deactivated</p>}
                  </Card>
              ))}
            </div>
        )}

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete API Key</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this API key? This action is irreversible and all
                applications using this key will stop working.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
            open={showRotateDialog}
            onOpenChange={(open) => {
              setShowRotateDialog(open);
              if (!open) setNewKey(null);
            }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rotate API Key</DialogTitle>
              <DialogDescription>
                {newKey
                    ? "Your API key has been rotated. Make sure to update all your applications that use this key."
                    : "Are you sure you want to rotate this API key? The old key will no longer work, and all applications will need to be updated."}
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
                  <DialogFooter>
                    <Button
                        onClick={() => {
                          setShowRotateDialog(false);
                          setNewKey(null);
                          router.refresh();
                        }}
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </div>
            ) : (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRotateDialog(false)} disabled={isRotating}>
                    Cancel
                  </Button>
                  <Button onClick={handleRotateConfirm} disabled={isRotating}>
                    {isRotating ? "Rotating..." : "Rotate"}
                  </Button>
                </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
}