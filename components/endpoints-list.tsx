"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Code, ExternalLink } from "lucide-react";

interface Endpoint {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  example: string;
  response?: string; // Response is optional
}

interface EndpointsListProps {
  endpoints: Endpoint[];
}

export function EndpointsList({ endpoints }: EndpointsListProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleViewDetails = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    setShowDialog(true);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-green-500";
      case "POST":
        return "bg-blue-500";
      case "PUT":
        return "bg-yellow-500";
      case "DELETE":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
      <div className="space-y-4">
        {endpoints.map((endpoint) => (
            <Card key={endpoint.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Badge className={`${getMethodColor(endpoint.method)} text-white`}>{endpoint.method}</Badge>
                  <div>
                    <p className="font-medium">{endpoint.name}</p>
                    <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleViewDetails(endpoint)}>
                  <Code className="mr-2 h-4 w-4" />
                  Details
                </Button>
              </div>
            </Card>
        ))}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            {selectedEndpoint && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <Badge className={`${getMethodColor(selectedEndpoint.method)} text-white`}>
                        {selectedEndpoint.method}
                      </Badge>
                      <span>{selectedEndpoint.path}</span>
                    </DialogTitle>
                    <DialogDescription>{selectedEndpoint.description}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Usage Example:</h4>
                      <pre className="bg-muted p-4 rounded-md text-xs whitespace-pre-wrap break-all">
                    <code>{selectedEndpoint.example}</code>
                  </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Authentication Parameters:</h4>
                      <p className="text-sm">
                        Add your API key as a query parameter <code>apikey</code>:
                      </p>
                      <pre className="bg-muted p-4 rounded-md text-xs whitespace-pre-wrap break-all mt-2">
                    <code>{selectedEndpoint.path}?apikey=YOUR_API_KEY</code>
                  </pre>
                    </div>
                    {selectedEndpoint.response && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Response:</h4>
                          <pre className="bg-muted p-4 rounded-md text-xs max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all border border-gray-200">
                      <code>{selectedEndpoint.response}</code>
                    </pre>
                        </div>
                    )}
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" asChild>
                        <a href="/docs" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Full Documentation
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
}