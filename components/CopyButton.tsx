"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy that text");
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={className}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
