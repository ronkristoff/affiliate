"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  Users,
  Code,
  CreditCard,
} from "lucide-react";

// Available settings pages (only show implemented pages)
const settingsLinks = [
  { href: "/settings/profile", label: "Profile", icon: User },
  // TODO: Enable when implemented - Story 2.3, 2.8
  // { href: "/settings/saligpay", label: "SaligPay Integration", icon: CreditCard },
  // TODO: Enable when implemented - Story 8.7
  // { href: "/settings/branding", label: "Portal Branding", icon: Palette },
  { href: "/settings/team", label: "Team Members", icon: Users },
  // Story 2.8 - Tracking Snippet
  { href: "/settings/tracking", label: "Tracking Code", icon: Code },
  // Story 3.1 - Billing
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  // TODO: Enable when implemented - Future stories
  // { href: "/settings/notifications", label: "Notifications", icon: Bell },
  // { href: "/settings/api-keys", label: "API Keys", icon: Key },
];

interface SettingsNavProps {
  className?: string;
}

export function SettingsNav({ className }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col space-y-1", className)}>
      {settingsLinks.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
