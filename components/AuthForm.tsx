"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthFormProps {
  mode: "login" | "signup";
  message?: string | null;
}

export function AuthForm({ mode, message }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isLogin = mode === "login";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.push("/dashboard");
        router.refresh();
        return;
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/api/auth/callback?next=/dashboard`
          : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      router.push(
        "/login?message=" +
          encodeURIComponent(
            "Account created. Check your email to confirm your account, then log in.",
          ),
      );
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4 p-7 md:p-8">
        <CardTitle className="text-3xl">
          {isLogin ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription className="text-base text-secondary">
          {isLogin
            ? "Log in to generate live company briefs and track your latest research."
            : "Start building career intel briefs that feel tailored, current, and recruiter-ready."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-7 pb-7 pt-0 md:px-8 md:pb-8">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-email`}>Email</Label>
            <Input
              id={`${mode}-email`}
              type="email"
              autoComplete="email"
              placeholder="you@rutgers.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-password`}>Password</Label>
            <Input
              id={`${mode}-password`}
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {(error || message) && (
            <div className="signal-callout-quiet rounded-[14px] px-4 py-3 text-sm text-foreground">
              {error ?? message}
            </div>
          )}

          <Button className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? "Log In" : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-secondary">
          {isLogin ? "Need an account?" : "Already have an account?"}{" "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="signal-link font-medium"
          >
            {isLogin ? "Sign up" : "Log in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
