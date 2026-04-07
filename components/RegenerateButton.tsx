"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface RegenerateButtonProps {
  companyName: string;
  briefId: string;
}

export function RegenerateButton({
  companyName,
  briefId,
}: RegenerateButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyName, briefId }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Could not regenerate the brief.");
      }

      toast.success("Brief regenerated successfully");
      if (payload.id !== briefId) {
        router.push(`/brief/${payload.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not regenerate the brief.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      {isLoading ? "Regenerating..." : "Regenerate Brief"}
    </Button>
  );
}
