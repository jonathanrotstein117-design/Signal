import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const message = params.message ?? params.error ?? null;

  return (
    <main className="signal-shell flex min-h-screen items-center justify-center px-6 py-14">
      <div className="w-full max-w-5xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-xl">
            <p className="signal-eyebrow">
              Signal Access
            </p>
            <h1 className="signal-display mt-4 text-[clamp(3rem,7vw,5rem)]">
              Research faster. Walk in prepared.
            </h1>
            <p className="signal-copy mt-5 text-lg">
              Log in to generate company briefs that combine live signals,
              hiring insights, and student-focused positioning in one workspace.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <AuthForm mode="login" message={message} />
          </div>
        </div>
      </div>
    </main>
  );
}
