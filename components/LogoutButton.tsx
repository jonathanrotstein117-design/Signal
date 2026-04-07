"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log out.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {isLoading ? "Logging out..." : "Log Out"}
    </Button>
  );
}
