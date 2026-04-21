"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  Users,
  Code,
  CreditCard,
  Palette,
  Mail,
  GitBranch,
  Plug,
  Wallet,
} from "lucide-react";

// Available settings pages (only show implemented pages)
const settingsLinks = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/branding", label: "Portal Branding", icon: Palette },
  { href: "/settings/team", label: "Team Members", icon: Users },
  { href: "/settings/tracking", label: "Tracking Code", icon: Code },
  { href: "/settings/attribution", label: "Attribution", icon: GitBranch },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/payouts", label: "Payout Settings", icon: Wallet },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/email-templates", label: "Email Templates", icon: Mail },
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
