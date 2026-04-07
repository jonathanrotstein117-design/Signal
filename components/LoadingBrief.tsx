"use client";

import { motion } from "framer-motion";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const loadingBriefSteps = [
  "Searching latest news...",
  "Analyzing employee sentiment...",
  "Building your positioning strategy...",
  "Generating your brief...",
];

interface LoadingBriefProps {
  currentStep: number;
}

export function LoadingBrief({ currentStep }: LoadingBriefProps) {
  return (
    <div className="surface-panel rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="signal-eyebrow">
            Signal is working
          </p>
          <h3 className="signal-title mt-2 text-2xl text-foreground">
            Generating your intel brief
          </h3>
        </div>
        <LoaderCircle className="h-6 w-6 animate-spin text-accent" />
      </div>

      <div className="space-y-3">
        {loadingBriefSteps.map((step, index) => {
          const isComplete = index < currentStep;
          const isActive = index === currentStep;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0.4, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-[14px] border px-4 py-4",
                isActive
                  ? "signal-callout"
                  : "signal-card-soft",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border",
                    isComplete
                      ? "border-accent/18 bg-accent/8 text-accent"
                      : isActive
                        ? "border-accent/18 bg-accent/8 text-accent"
                        : "border-border bg-background text-secondary",
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </span>
                <div className="flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {step}
                    {isActive ? (
                      <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {isComplete
                      ? "Done"
                      : isActive
                        ? "In progress..."
                        : "Queued"}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-full bg-background-soft">
        <motion.div
          className="h-2 rounded-full bg-accent"
          animate={{ width: `${((currentStep + 1) / loadingBriefSteps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
