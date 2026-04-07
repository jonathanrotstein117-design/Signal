"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { LoadingBrief, loadingBriefSteps } from "@/components/LoadingBrief";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  compact?: boolean;
  enableUrlAutostart?: boolean;
}

export function SearchBar({
  compact = false,
  enableUrlAutostart = false,
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [lastAutoStartedKey, setLastAutoStartedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentStep((value) =>
        value < loadingBriefSteps.length - 1 ? value + 1 : value,
      );
    }, 1600);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const generateBrief = async (rawCompanyName: string) => {
    const normalizedCompany = rawCompanyName.trim();
    if (!normalizedCompany) {
      setError("Enter a company name to generate a brief.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyName: normalizedCompany }),
      });

      const payload = (await response.json()) as {
        id?: string;
        error?: string;
      };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Signal could not generate the brief.");
      }

      toast.success("Brief generated successfully");
      router.push(`/brief/${payload.id}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  const generateBriefRef = useRef(generateBrief);
  generateBriefRef.current = generateBrief;

  useEffect(() => {
    if (!enableUrlAutostart || isLoading) {
      return;
    }

    const autoCompany = searchParams.get("company")?.trim() ?? "";
    const shouldAutostart = searchParams.get("autostart") === "1";
    const cacheKey = `${autoCompany}:${shouldAutostart}`;

    if (!autoCompany || !shouldAutostart || lastAutoStartedKey === cacheKey) {
      return;
    }

    setCompanyName(autoCompany);
    setLastAutoStartedKey(cacheKey);
    void generateBriefRef.current(autoCompany);
    router.replace(pathname);
  }, [
    enableUrlAutostart,
    isLoading,
    lastAutoStartedKey,
    pathname,
    router,
    searchParams,
  ]);

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await generateBrief(companyName);
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleGenerate}
        className={cn(
          "signal-search-panel rounded-[20px] p-3 md:p-4",
          compact && "rounded-2xl p-2.5 md:p-3",
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
            <Input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Enter a company name..."
              className={cn(
                "h-16 rounded-[14px] border-[0.5px] border-input-border bg-white pl-12 text-base shadow-none",
                compact && "h-12 rounded-[12px] text-sm",
              )}
              disabled={isLoading}
            />
          </div>
          <Button
            size={compact ? "default" : "lg"}
            className={cn(
              "h-16 min-w-[180px] w-full md:w-auto",
              compact && "h-12 min-w-[160px]",
            )}
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Generating..." : "Generate Brief"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="signal-callout-quiet rounded-2xl px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {isLoading && !compact ? <LoadingBrief currentStep={currentStep} /> : null}
    </div>
  );
}
