"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CareerFairDiscoverySection } from "@/components/CareerFairDiscoverySection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  estimateRemainingMinutes,
  getCareerFairProgress,
  getCareerFairStatus,
  hasPocketBrief,
  MAX_CAREER_FAIR_COMPANIES,
  mergeCompanyLists,
  parseCompanyList,
  sortCareerFairCompanies,
} from "@/lib/career-fair";
import type {
  CareerFairCompany,
  CareerFairCompanyStatus,
  NormalizedCareerFairRecord,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface CareerFairWorkspaceProps {
  initialFair: NormalizedCareerFairRecord | null;
  hasResume: boolean;
  universityName: string | null;
  initialLoadError?: string | null;
}

interface CareerFairApiPayload {
  fair: NormalizedCareerFairRecord;
  status: CareerFairCompanyStatus;
  progress: ReturnType<typeof getCareerFairProgress>;
  error?: string;
}

function getMatchBadgeClasses(score: number | null) {
  if ((score ?? 0) >= 80) {
    return "border-accent/18 bg-accent/8 text-accent";
  }

  if ((score ?? 0) >= 60) {
    return "border-foreground/12 bg-foreground/5 text-foreground";
  }

  return "border-border bg-background-soft text-secondary";
}

function getStatusLabel(status: CareerFairCompanyStatus) {
  if (status === "completed") {
    return "Done";
  }

  if (status === "processing") {
    return "Researching";
  }

  if (status === "error") {
    return "Skipped";
  }

  return "Queued";
}

function MatchBadge({ score }: { score: number | null }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold",
        getMatchBadgeClasses(score),
      )}
    >
      {score ?? 0}% match
    </div>
  );
}

function SetupComposer({
  mode,
  fairName,
  companyInput,
  companies,
  onFairNameChange,
  onCompanyInputChange,
  onCompanyInputKeyDown,
  onCompanyInputBlur,
  onCompanyPaste,
  onRemoveCompany,
  onAddCompanies,
  onSubmit,
  onCancel,
  isSubmitting,
  helperNote,
}: {
  mode: "new" | "append";
  fairName: string;
  companyInput: string;
  companies: string[];
  onFairNameChange: (value: string) => void;
  onCompanyInputChange: (value: string) => void;
  onCompanyInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompanyInputBlur: () => void;
  onCompanyPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveCompany: (name: string) => void;
  onAddCompanies: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  helperNote?: string | null;
}) {
  const minimumCompanies = mode === "append" ? 1 : 2;
  const fairNameInputId = `fair-name-${mode}`;
  const companyTextareaId = `companies-${mode}`;

  return (
    <section id="manual-fair-form" className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="surface-panel rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{mode === "append" ? "Expand your plan" : "Setup"}</Badge>
          <p className="signal-eyebrow">
            {companies.length} / {MAX_CAREER_FAIR_COMPANIES} companies
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {helperNote ? (
            <div className="signal-callout rounded-2xl px-4 py-4 text-sm text-foreground">
              {helperNote}
            </div>
          ) : null}

          <div className="space-y-3">
            <label htmlFor={fairNameInputId} className="text-sm font-medium text-foreground">
              Fair name
            </label>
            <Input
              id={fairNameInputId}
              value={fairName}
              onChange={(event) => onFairNameChange(event.target.value)}
              placeholder="Rutgers Spring 2026 Career Fair"
              className="h-12 rounded-[14px] text-base"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={companyTextareaId} className="text-sm font-medium text-foreground">
                Companies
              </label>
              <p className="text-xs text-secondary">
                Press Enter or comma, or paste a list
              </p>
            </div>

            <div className="signal-card-soft rounded-2xl p-4">
              <Textarea
                id={companyTextareaId}
                value={companyInput}
                onChange={(event) => onCompanyInputChange(event.target.value)}
                onKeyDown={onCompanyInputKeyDown}
                onBlur={onCompanyInputBlur}
                onPaste={onCompanyPaste}
                placeholder={"GEICO\nL'Oréal\nZS Associates\nPwC"}
                className="min-h-24 border-none bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
                disabled={isSubmitting || companies.length >= MAX_CAREER_FAIR_COMPANIES}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {companies.map((company) => (
                  <button
                    key={company}
                    type="button"
                    onClick={() => onRemoveCompany(company)}
                    className="inline-flex items-center gap-2 rounded-full border border-accent/18 bg-accent/8 px-3 py-2 text-sm text-accent hover:border-accent/30 hover:bg-accent/12"
                  >
                    {company}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={onAddCompanies}
                disabled={
                  isSubmitting ||
                  !companyInput.trim() ||
                  companies.length >= MAX_CAREER_FAIR_COMPANIES
                }
              >
                <Plus className="h-4 w-4" />
                Add companies
              </Button>
              <p className="text-sm text-secondary">
                Minimum {minimumCompanies}, maximum {MAX_CAREER_FAIR_COMPANIES}.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              !fairName.trim() ||
              companies.length < minimumCompanies
            }
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            {isSubmitting
              ? "Starting..."
              : mode === "append"
                ? "Add Companies"
                : "Generate Game Plan"}
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="surface-panel rounded-2xl p-6 md:p-8">
        <p className="signal-eyebrow">
          What you get
        </p>
        <div className="mt-6 space-y-5">
          {[
            {
              icon: Sparkles,
              title: "Batch research",
              body: "Signal researches every company one at a time so you can watch the plan build in real time.",
            },
            {
              icon: Target,
              title: "Ranked fit",
              body: "Each company gets a match score, a why-you-fit explanation, and a booth strategy built around your resume.",
            },
            {
              icon: ArrowRight,
              title: "Pocket briefs",
              body: "Pull up a glanceable cheat sheet on your phone before you step into line.",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="signal-card-soft rounded-2xl p-5"
              >
                <span className="signal-icon-frame flex h-11 w-11 items-center justify-center rounded-[14px]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="signal-title mt-5 text-xl text-foreground">{item.title}</h3>
                <p className="signal-copy mt-3 text-sm">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProcessingBoard({ fair }: { fair: NormalizedCareerFairRecord }) {
  const progress = getCareerFairProgress(fair.companies);
  const estimatedMinutes = estimateRemainingMinutes(fair.companies);

  return (
    <section className="surface-panel rounded-2xl p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <Badge>Processing</Badge>
          <h2 className="signal-title mt-5 text-3xl text-foreground sm:text-4xl">
            Building your career fair game plan
          </h2>
          <p className="signal-copy mt-4 max-w-xl text-base">
            Signal is researching each company in sequence, scoring your fit, and
            packaging booth-ready pocket briefs as they complete.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="signal-card-soft rounded-2xl p-5">
              <p className="signal-stat-value">
                {progress.terminal} / {progress.total}
              </p>
              <p className="signal-copy mt-2 text-sm">Companies researched</p>
            </div>
            <div className="signal-card-soft rounded-2xl p-5">
              <p className="signal-stat-value">{progress.completed}</p>
              <p className="signal-copy mt-2 text-sm">Ready to use</p>
            </div>
            <div className="signal-card-soft rounded-2xl p-5">
              <p className="signal-stat-value">
                {estimatedMinutes ? `~${estimatedMinutes}m` : "Done"}
              </p>
              <p className="signal-copy mt-2 text-sm">Estimated remaining</p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-full bg-background-soft">
            <motion.div
              className="h-3 rounded-full bg-accent"
              animate={{
                width: `${(progress.terminal / Math.max(progress.total, 1)) * 100}%`,
              }}
            />
          </div>

          <p className="signal-copy mt-3 text-sm">
            {progress.terminal} of {progress.total} companies researched...
          </p>
        </div>

        <div className="space-y-3">
          {fair.companies.map((company, index) => {
            const isProcessing = company.status === "processing";
            const isComplete = company.status === "completed";
            const isError = company.status === "error";

            return (
              <motion.div
                key={`${company.name}-${company.status}-${index}`}
                initial={{ opacity: 0.5, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-[24px] border px-4 py-4",
                  isProcessing
                    ? "border-blue-400/24 bg-blue-400/10"
                    : isComplete
                      ? "border-emerald-400/20 bg-emerald-400/10"
                      : isError
                        ? "border-orange-400/18 bg-orange-400/10"
                        : "border-white/8 bg-white/4",
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      isProcessing
                        ? "border-blue-400/28 bg-blue-400/10 text-blue-200"
                        : isComplete
                          ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
                          : isError
                            ? "border-orange-400/24 bg-orange-400/10 text-orange-100"
                            : "border-white/10 bg-white/5 text-white/45",
                    )}
                  >
                    {isProcessing ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isError ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-semibold">{index + 1}</span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="truncate text-base font-semibold text-foreground">
                        {company.name}
                      </p>
                      <p className="text-sm text-secondary">
                        {getStatusLabel(company.status)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-secondary">
                      {company.status === "completed"
                        ? "Pocket brief locked in."
                        : company.status === "processing"
                          ? "Brief, fit score, and booth cheat sheet in progress..."
                          : company.status === "error"
                            ? company.error_message ?? "Skipped for now. You can still continue with the rest of the plan."
                            : "Waiting for its turn."}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PocketBriefDeck({
  companies,
  activeIndex,
  onClose,
  onChange,
}: {
  companies: CareerFairCompany[];
  activeIndex: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const activeCompany = companies[activeIndex];
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!activeCompany || !hasPocketBrief(activeCompany.pocket_brief)) {
    return null;
  }

  const canGoBack = activeIndex > 0;
  const canGoForward = activeIndex < companies.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[rgba(245,243,238,0.92)] backdrop-blur-xl"
      >
        <div className="flex h-full w-full flex-col sm:justify-center sm:p-6">
          <div className="surface-panel mx-auto flex h-full w-full max-w-3xl flex-col rounded-none sm:h-auto sm:min-h-[760px] sm:max-h-[90vh] sm:rounded-[24px]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="signal-eyebrow">
                  Pocket Brief
                </p>
                <p className="signal-copy mt-2 text-sm">
                  {activeIndex + 1} of {companies.length}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div
              className="flex-1 overflow-auto px-5 py-6 sm:px-6"
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const endX = event.changedTouches[0]?.clientX ?? null;

                if (touchStartX.current === null || endX === null) {
                  return;
                }

                const delta = touchStartX.current - endX;

                if (delta > 48 && canGoForward) {
                  onChange(activeIndex + 1);
                }

                if (delta < -48 && canGoBack) {
                  onChange(activeIndex - 1);
                }
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCompany.name}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  className="flex min-h-full flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge>{activeCompany.industry ?? "Industry"}</Badge>
                      <MatchBadge score={activeCompany.match_score ?? null} />
                    </div>

                    <h3 className="signal-title mt-5 text-3xl text-foreground sm:text-4xl">
                      {activeCompany.name}
                    </h3>

                    <div className="mt-8 space-y-5 text-foreground">
                      {[
                        {
                          label: "Your one-liner",
                          value: activeCompany.pocket_brief.one_liner,
                        },
                        {
                          label: "Lead talking point",
                          value: activeCompany.pocket_brief.top_talking_point,
                        },
                        {
                          label: "Best question to ask",
                          value: activeCompany.pocket_brief.best_question,
                        },
                        {
                          label: "Key fact",
                          value: activeCompany.pocket_brief.key_fact,
                        },
                        {
                          label: "Pro tip",
                          value: activeCompany.pocket_brief.pro_tip,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="signal-card-soft rounded-2xl px-4 py-4 sm:px-5"
                        >
                          <p className="signal-eyebrow">
                            {item.label}
                          </p>
                          <p className="mt-3 text-lg leading-8 text-foreground sm:text-xl">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-border pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => onChange(activeIndex - 1)}
                          disabled={!canGoBack}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => onChange(activeIndex + 1)}
                          disabled={!canGoForward}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {activeCompany.brief_id ? (
                        <Button asChild>
                          <Link href={`/brief/${activeCompany.brief_id}`}>View Full Brief →</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function CareerFairWorkspace({
  initialFair,
  hasResume,
  universityName,
  initialLoadError,
}: CareerFairWorkspaceProps) {
  const [currentFair, setCurrentFair] = useState(initialFair);
  const [composerMode, setComposerMode] = useState<"new" | "append" | null>(
    initialFair ? null : "new",
  );
  const [fairName, setFairName] = useState(initialFair?.fair_name ?? "");
  const [companyInput, setCompanyInput] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePocketIndex, setActivePocketIndex] = useState<number | null>(null);
  const [manualSetupNote, setManualSetupNote] = useState<string | null>(null);
  const previousStatus = useRef<CareerFairCompanyStatus | null>(
    initialFair ? getCareerFairStatus(initialFair.companies) : null,
  );

  const activeFairId = currentFair?.id ?? null;
  const status = currentFair ? getCareerFairStatus(currentFair.companies) : null;
  const rankedCompanies = currentFair
    ? sortCareerFairCompanies(
        currentFair.companies.filter((company) => company.status === "completed"),
      )
    : [];
  const pocketBriefCompanies = rankedCompanies.filter((company) =>
    hasPocketBrief(company.pocket_brief),
  );
  const skippedCompanies = currentFair
    ? currentFair.companies.filter((company) => company.status === "error")
    : [];
  const showManualSetup = !currentFair || composerMode === "new";

  useEffect(() => {
    if (!activeFairId || (status !== "processing" && status !== "pending")) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/career-fair/${activeFairId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as CareerFairApiPayload;

        if (!response.ok || !payload.fair) {
          throw new Error(payload.error ?? "Signal could not refresh the game plan.");
        }

        if (!cancelled) {
          setCurrentFair(payload.fair);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 3_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeFairId, status]);

  useEffect(() => {
    if (status && previousStatus.current !== status) {
      if (
        (previousStatus.current === "processing" || previousStatus.current === "pending") &&
        (status === "completed" || status === "error")
      ) {
        toast.success("Career fair game plan is ready");
      }

      previousStatus.current = status;
    }
  }, [status]);

  useEffect(() => {
    if (activePocketIndex === null) {
      return;
    }

    if (activePocketIndex < 0 || activePocketIndex >= pocketBriefCompanies.length) {
      setActivePocketIndex(null);
    }
  }, [activePocketIndex, pocketBriefCompanies.length]);

  const addDraftCompanies = (value = companyInput) => {
    const parsed = parseCompanyList(value);

    if (!parsed.length) {
      return;
    }

    setCompanies((current) => {
      const next = mergeCompanyLists(current, parsed);

      if (next.length === current.length) {
        toast.error("Those companies are already in the list.");
      } else if (next.length === MAX_CAREER_FAIR_COMPANIES) {
        toast.message("Reached the 20-company limit for this fair.");
      }

      return next;
    });
    setCompanyInput("");
  };

  const resetComposer = (mode: "new" | "append") => {
    setComposerMode(mode);
    setFairName(mode === "append" ? currentFair?.fair_name ?? "" : "");
    setCompanies([]);
    setCompanyInput("");
    setManualSetupNote(null);
  };

  const handleUseDiscoveredFair = (fair: {
    name: string;
    companies_found: string[] | null;
  }) => {
    setComposerMode("new");
    setFairName(fair.name);
    setCompanies(mergeCompanyLists([], fair.companies_found ?? []));
    setCompanyInput("");
    setManualSetupNote(
      fair.companies_found?.length
        ? `Signal found ${fair.companies_found.length} companies for this fair and loaded them into the setup form below.`
        : "We couldn't find the company list for this fair. You can paste it below.",
    );

    window.requestAnimationFrame(() => {
      document.getElementById("manual-fair-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleSubmit = async () => {
    const pendingCompanies = mergeCompanyLists(companies, parseCompanyList(companyInput));
    const minimumCompanies = composerMode === "append" ? 1 : 2;

    if (!fairName.trim()) {
      toast.error("Enter a career fair name.");
      return;
    }

    if (pendingCompanies.length < minimumCompanies) {
      toast.error(
        composerMode === "append"
          ? "Add at least one company."
          : "Add at least two companies to build your plan.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/career-fair/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fairName: fairName.trim(),
          companies: pendingCompanies,
          fairId: composerMode === "append" ? currentFair?.id : undefined,
        }),
      });

      const payload = (await response.json()) as CareerFairApiPayload;

      if (!response.ok || !payload.fair) {
        throw new Error(payload.error ?? "Signal could not start the game plan.");
      }

      setCurrentFair(payload.fair);
      setComposerMode(null);
      setCompanies([]);
      setCompanyInput("");
      setActivePocketIndex(null);
      setManualSetupNote(null);
      toast.success(
        composerMode === "append"
          ? "Companies added to your game plan"
          : "Career fair mode is running",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Signal could not start the game plan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <CareerFairDiscoverySection
        universityName={universityName}
        onUseFair={handleUseDiscoveredFair}
      />

      {!hasResume ? (
        <div className="signal-callout rounded-2xl px-5 py-5 text-sm text-foreground">
          Uploading your resume will make the match scores and pocket briefs much
          sharper. Career Fair Mode still works without it, but the ranking will
          be less personalized.
        </div>
      ) : null}

      {initialLoadError ? (
        <div className="signal-callout-quiet rounded-2xl px-5 py-5 text-sm text-foreground">
          {initialLoadError}
        </div>
      ) : null}

      {showManualSetup ? (
        <section className="space-y-4">
          <div>
            <p className="signal-eyebrow">
              Manual setup
            </p>
            <h2 className="signal-title mt-3 text-3xl text-foreground">
              Or set up a fair manually
            </h2>
          </div>

          <SetupComposer
            mode="new"
            fairName={fairName}
            companyInput={companyInput}
            companies={companies}
            onFairNameChange={setFairName}
            onCompanyInputChange={setCompanyInput}
            onCompanyInputKeyDown={(event) => {
              if ((event.key === "Enter" && !event.shiftKey) || event.key === ",") {
                event.preventDefault();
                addDraftCompanies();
              }
            }}
            onCompanyInputBlur={() => addDraftCompanies()}
            onCompanyPaste={(event) => {
              const pasted = event.clipboardData.getData("text");

              if (pasted.includes(",") || pasted.includes("\n")) {
                event.preventDefault();
                addDraftCompanies(pasted);
              }
            }}
            onRemoveCompany={(name) =>
              setCompanies((current) => current.filter((company) => company !== name))
            }
            onAddCompanies={() => addDraftCompanies()}
            onSubmit={handleSubmit}
            onCancel={currentFair ? () => setComposerMode(null) : undefined}
            isSubmitting={isSubmitting}
            helperNote={manualSetupNote}
          />
        </section>
      ) : null}

      {currentFair ? (
        <>
          <section className="surface-panel rounded-2xl p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{currentFair.fair_name}</Badge>
                  <Badge variant="secondary">
                    Created {formatDate(currentFair.created_at)}
                  </Badge>
                  <Badge variant="secondary">
                    {currentFair.companies.length} companies
                  </Badge>
                </div>
                <h2 className="signal-title mt-5 text-3xl text-foreground sm:text-4xl">
                  {status === "processing" || status === "pending"
                    ? "Your ranked game plan is coming together."
                    : "Your ranked career fair game plan is ready."}
                </h2>
                <p className="signal-copy mt-4 max-w-2xl text-base">
                  Open the highest-match booths first, keep the pocket briefs on
                  your phone, and walk the fair with a tighter strategy.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {status !== "processing" && status !== "pending" ? (
                  <Button variant="secondary" onClick={() => resetComposer("append")}>
                    Add More Companies
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => resetComposer("new")}>
                  Start New Fair
                </Button>
              </div>
            </div>
          </section>

          {composerMode === "append" ? (
            <SetupComposer
              mode="append"
              fairName={fairName}
              companyInput={companyInput}
              companies={companies}
              onFairNameChange={setFairName}
              onCompanyInputChange={setCompanyInput}
              onCompanyInputKeyDown={(event) => {
                if ((event.key === "Enter" && !event.shiftKey) || event.key === ",") {
                  event.preventDefault();
                  addDraftCompanies();
                }
              }}
              onCompanyInputBlur={() => addDraftCompanies()}
              onCompanyPaste={(event) => {
                const pasted = event.clipboardData.getData("text");

                if (pasted.includes(",") || pasted.includes("\n")) {
                  event.preventDefault();
                  addDraftCompanies(pasted);
                }
              }}
              onRemoveCompany={(name) =>
                setCompanies((current) => current.filter((company) => company !== name))
              }
              onAddCompanies={() => addDraftCompanies()}
              onSubmit={handleSubmit}
              onCancel={() => setComposerMode(null)}
              isSubmitting={isSubmitting}
            />
          ) : null}

          {status === "processing" || status === "pending" ? (
            <ProcessingBoard fair={currentFair} />
          ) : rankedCompanies.length ? (
            <section className="space-y-6">
              <div>
                <p className="signal-eyebrow">
                  Ranked companies
                </p>
                <h3 className="signal-title mt-3 text-3xl text-foreground">
                  Start with the strongest matches
                </h3>
              </div>

              <div className="grid gap-5">
                {rankedCompanies.map((company, index) => (
                  <motion.div
                    key={`${company.name}-${company.match_score}-${index}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "surface-panel rounded-2xl p-6 md:p-7",
                      index === 0 && "border-accent/18",
                    )}
                  >
                    <div
                      className={cn(
                        "grid gap-6 lg:grid-cols-[1fr_auto]",
                        index === 0 && "xl:grid-cols-[1.08fr_0.92fr]",
                      )}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge>#{index + 1}</Badge>
                          <Badge variant="secondary">
                            {company.industry ?? "Unknown industry"}
                          </Badge>
                        </div>
                        <h4
                          className={cn(
                            "signal-title mt-5 text-foreground",
                            index === 0 ? "text-3xl sm:text-4xl" : "text-2xl",
                          )}
                        >
                          {company.name}
                        </h4>
                        <p className="signal-copy mt-4 max-w-3xl text-base">
                          {company.why_you_match}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-4 lg:items-end">
                        <MatchBadge score={company.match_score ?? null} />
                        <div className="flex flex-wrap gap-3">
                          {company.brief_id ? (
                            <Button asChild variant="secondary">
                              <Link href={`/brief/${company.brief_id}`}>View Full Brief</Link>
                            </Button>
                          ) : null}
                          {hasPocketBrief(company.pocket_brief) ? (
                            <Button
                              onClick={() => {
                                const pocketIndex = pocketBriefCompanies.indexOf(company);

                                if (pocketIndex >= 0) {
                                  setActivePocketIndex(pocketIndex);
                                }
                              }}
                            >
                              Pocket Brief
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          ) : (
            <section className="signal-empty-state rounded-2xl px-6 py-10 text-center">
              <p className="signal-title text-2xl text-foreground">
                No ranked companies were completed
              </p>
              <p className="signal-copy mx-auto mt-3 max-w-2xl text-sm">
                Signal could not finish any companies for this fair. You can add
                new companies or start a fresh fair and try again.
              </p>
            </section>
          )}

          {skippedCompanies.length ? (
            <section className="space-y-4">
              <div>
                <p className="signal-eyebrow">
                  Skipped
                </p>
                <h3 className="signal-title mt-3 text-2xl text-foreground">
                  A few companies could not be completed
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {skippedCompanies.map((company) => (
                  <div
                    key={company.name}
                    className="signal-callout-quiet rounded-2xl p-5"
                  >
                    <p className="text-lg font-semibold text-foreground">{company.name}</p>
                    <p className="mt-3 text-sm leading-7 text-foreground">
                      {company.error_message ?? "Signal skipped this company and continued with the rest of the fair."}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activePocketIndex !== null && pocketBriefCompanies[activePocketIndex] ? (
        <PocketBriefDeck
          companies={pocketBriefCompanies}
          activeIndex={activePocketIndex}
          onClose={() => setActivePocketIndex(null)}
          onChange={(index) => setActivePocketIndex(index)}
        />
      ) : null}
    </div>
  );
}
