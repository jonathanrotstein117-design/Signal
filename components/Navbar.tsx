"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  LayoutDashboard,
  UserRound,
  Waves,
} from "lucide-react";

import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavbarProps {
  userEmail?: string | null;
  className?: string;
}

const navItems = [
  {
    href: "/discover",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/career-fair",
    label: "Career Fair",
    icon: BriefcaseBusiness,
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({ userEmail, className }: NavbarProps) {
  const pathname = usePathname();
  const isAuthed = Boolean(userEmail);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10">
        <div className="flex min-h-[82px] items-center justify-between gap-6">
          <Link
            href={isAuthed ? "/dashboard" : "/"}
            className="group inline-flex items-center gap-3"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-foreground text-white">
              <Waves className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Signal
              </span>
              <span className="signal-eyebrow text-[10px] tracking-[0.22em]">
                Career Intelligence
              </span>
            </span>
          </Link>

          {isAuthed ? (
            <nav className="hidden items-center gap-1 rounded-full border border-border bg-white/72 p-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white text-foreground shadow-[0_6px_16px_rgba(28,43,58,0.05)]"
                        : "text-muted hover:bg-white hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div className="flex-1" />
          )}

          {isAuthed ? (
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-border bg-white/72 px-4 py-2 text-sm text-secondary lg:block">
                {userEmail}
              </div>
              <Link
                href="/profile"
                className={cn(
                  "hidden items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium md:inline-flex",
                  isActivePath(pathname, "/profile")
                    ? "border-border bg-white text-foreground"
                    : "border-transparent text-muted hover:border-border hover:bg-white hover:text-foreground",
                )}
              >
                <UserRound className="h-4 w-4" />
                Profile
              </Link>
              <LogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/explore">
                  Try Signal Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {isAuthed ? (
          <div className="pb-4 md:hidden">
            <nav className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...navItems, { href: "/profile", label: "Profile", icon: UserRound }].map(
                (item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap",
                        active
                          ? "border-border bg-white text-foreground"
                          : "border-border bg-white/72 text-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                },
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
