"use client";

import Link from "next/link";
import { Home, DollarSign, Link2, Images, User } from "lucide-react";

interface PortalBottomNavProps {
  portalName: string;
  primaryColor: string;
  currentPath: string;
}

export function PortalBottomNav({ portalName, primaryColor, currentPath }: PortalBottomNavProps) {
  const navItems = [
    { href: "/portal/home", label: "Home", icon: Home },
    { href: "/portal/earnings", label: "Earnings", icon: DollarSign },
    { href: "/portal/links", label: "Links", icon: Link2 },
    { href: "/portal/assets", label: "Assets", icon: Images },
    { href: "/portal/account", label: "Account", icon: User },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 md:hidden z-50"
      style={{ 
        borderTopColor: primaryColor,
        borderTopWidth: '2px'
      }}
    >
      <div className="flex justify-around items-center h-full">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full ${
                isActive ? '' : 'text-gray-500'
              }`}
              style={{ color: isActive ? primaryColor : undefined }}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}