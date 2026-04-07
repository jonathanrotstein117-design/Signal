"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      theme="light"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "!border !border-border !bg-white !text-foreground !shadow-[0_20px_48px_rgba(28,43,58,0.08)]",
          title: "!text-foreground",
          description: "!text-secondary",
        },
      }}
    />
  );
}
