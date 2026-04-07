"use client";

import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { extractResumeText } from "@/lib/resume";
import type { ProfileRecord } from "@/lib/types";

interface ProfileFormProps {
  userId: string;
  initialProfile: ProfileRecord | null;
  loadError?: string | null;
}

const graduationYears = [2025, 2026, 2027, 2028, 2029, 2030];

function toNullableValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function ProfileForm({
  userId,
  initialProfile,
  loadError,
}: ProfileFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    full_name: initialProfile?.full_name ?? "",
    university: initialProfile?.university ?? "Rutgers University",
    major: initialProfile?.major ?? "",
    minor: initialProfile?.minor ?? "",
    double_major: initialProfile?.double_major ?? "",
    graduation_year: initialProfile?.graduation_year?.toString() ?? "",
    career_interests: initialProfile?.career_interests ?? "",
  });
  const [resumeFilename, setResumeFilename] = useState<string | null>(
    initialProfile?.resume_filename ?? null,
  );
  const [hasResume, setHasResume] = useState(Boolean(initialProfile?.resume_text));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMinorField, setShowMinorField] = useState(Boolean(initialProfile?.minor));
  const [showDoubleMajorField, setShowDoubleMajorField] = useState(
    Boolean(initialProfile?.double_major),
  );

  const upsertProfile = async (payload: Record<string, string | number | null>) => {
    const profilePayload = {
      id: userId,
      updated_at: new Date().toISOString(),
      ...payload,
    } as never;

    const { error } = await supabase
      .from("profiles" as never)
      .upsert(profilePayload);

    if (error) {
      throw new Error(error.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const profilePayload: Record<string, string | number | null> = {
        full_name: toNullableValue(formData.full_name),
        university: toNullableValue(formData.university) ?? "Rutgers University",
        major: toNullableValue(formData.major),
        graduation_year: formData.graduation_year
          ? Number(formData.graduation_year)
          : null,
        career_interests: toNullableValue(formData.career_interests),
      };

      if (showMinorField) {
        profilePayload.minor = toNullableValue(formData.minor);
      }

      if (showDoubleMajorField) {
        profilePayload.double_major = toNullableValue(formData.double_major);
      }

      await upsertProfile(profilePayload);

      toast.success("Profile saved");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const processFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !["pdf", "docx"].includes(extension)) {
      toast.error("Upload a PDF or DOCX resume");
      return;
    }

    setIsUploading(true);

    try {
      const resumeText = await extractResumeText(file);

      await upsertProfile({
        resume_text: resumeText,
        resume_filename: file.name,
      });

      setResumeFilename(file.name);
      setHasResume(true);
      toast.success("Resume uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload resume");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      await processFile(file);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      await processFile(file);
    }
  };

  const handleRemoveResume = async () => {
    setIsRemoving(true);

    try {
      await upsertProfile({
        resume_text: null,
        resume_filename: null,
      });

      setResumeFilename(null);
      setHasResume(false);
      toast.success("Resume removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove resume");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <Card className="rounded-[32px]">
        <CardHeader className="space-y-3 p-6 md:p-8">
          <Badge className="w-fit">Profile</Badge>
          <CardTitle className="text-3xl">Tell Signal who you are</CardTitle>
          <p className="signal-copy max-w-2xl text-sm">
            Your profile shapes the positioning, talking points, and application
            advice that show up in every brief.
          </p>
        </CardHeader>

        <CardContent className="space-y-6 p-6 pt-0 md:p-8 md:pt-0">
          {loadError ? (
            <div className="signal-callout-quiet rounded-2xl p-4 text-sm leading-6 text-foreground">
              {loadError}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={formData.full_name}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="Avery Patel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="university">University</Label>
              <Input
                id="university"
                value={formData.university}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    university: event.target.value,
                  }))
                }
                placeholder="Rutgers University"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="major">Major</Label>
              <Input
                id="major"
                value={formData.major}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    major: event.target.value,
                  }))
                }
                placeholder="Finance and Environmental Policy"
              />
              <div className="flex flex-wrap gap-3 pt-2 text-sm">
                {!showMinorField ? (
                  <button
                    type="button"
                    className="signal-link"
                    onClick={() => setShowMinorField(true)}
                  >
                    + Add minor
                  </button>
                ) : null}
                {!showDoubleMajorField ? (
                  <button
                    type="button"
                    className="signal-link"
                    onClick={() => setShowDoubleMajorField(true)}
                  >
                    + Add double major
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="graduation-year">Expected graduation year</Label>
              <select
                id="graduation-year"
                className="flex h-12 w-full rounded-[14px] border border-input-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.graduation_year}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    graduation_year: event.target.value,
                  }))
                }
              >
                <option value="" className="bg-white text-foreground">
                  Select year
                </option>
                {graduationYears.map((year) => (
                  <option key={year} value={year} className="bg-white text-foreground">
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(showMinorField || showDoubleMajorField) ? (
            <div className="grid gap-5 md:grid-cols-2">
              {showMinorField ? (
                <div className="space-y-2">
                  <Label htmlFor="minor">Minor</Label>
                  <Input
                    id="minor"
                    value={formData.minor}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        minor: event.target.value,
                      }))
                    }
                    placeholder="Mathematics"
                  />
                </div>
              ) : null}

              {showDoubleMajorField ? (
                <div className="space-y-2">
                  <Label htmlFor="double-major">Double major</Label>
                  <Input
                    id="double-major"
                    value={formData.double_major}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        double_major: event.target.value,
                      }))
                    }
                    placeholder="Statistics"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="career-interests">Career interests</Label>
            <Textarea
              id="career-interests"
              value={formData.career_interests}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  career_interests: event.target.value,
                }))
              }
              placeholder="ESG advisory, management consulting, sustainability"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={handleSave} size="lg" disabled={isSaving || isUploading}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px]">
        <CardHeader className="space-y-3 p-6 md:p-8">
          <Badge variant={hasResume ? "success" : "secondary"} className="w-fit">
            {hasResume ? "Resume on file" : "Resume upload"}
          </Badge>
          <CardTitle className="text-3xl">Power up your positioning</CardTitle>
          <p className="signal-copy text-sm">
            Upload a PDF or DOCX resume. Signal stores only the extracted text and
            filename, so briefs can personalize your pitch without saving the file
            itself.
          </p>
        </CardHeader>

        <CardContent className="space-y-5 p-6 pt-0 md:p-8 md:pt-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`group flex min-h-[250px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center ${
              isDragging
                ? "signal-callout"
                : "signal-empty-state hover:border-border hover:bg-white/70"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={isUploading}
          >
            <span className="signal-icon-frame flex h-14 w-14 items-center justify-center rounded-[14px]">
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
            </span>
            <p className="mt-5 text-lg font-semibold text-foreground">
              {isUploading ? "Extracting resume text..." : "Drop your resume here"}
            </p>
            <p className="signal-copy mt-3 max-w-sm text-sm">
              Or click to upload a PDF or DOCX. Signal will pull the text, save the
              filename, and use it to tailor future briefs.
            </p>
          </button>

          {resumeFilename ? (
            <div className="signal-callout rounded-2xl p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="signal-icon-frame mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px]">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      Resume uploaded
                    </p>
                    <p className="signal-copy mt-2 text-sm">{resumeFilename}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveResume}
                    disabled={isRemoving || isUploading}
                  >
                    {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remove resume
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="signal-empty-state rounded-2xl p-5 text-sm leading-7 text-secondary">
              No resume uploaded yet. Once you add one, Signal will personalize your
              one-liner, talking points, outreach template, and application advice.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
