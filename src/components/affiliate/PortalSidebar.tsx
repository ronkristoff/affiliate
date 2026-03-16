"use client";

import Link from "next/link";
import { Home, DollarSign, Link2, Images, User } from "lucide-react";

interface PortalSidebarProps {
  portalName: string;
  primaryColor: string;
  currentPath: string;
}

export function PortalSidebar({ portalName, primaryColor, currentPath }: PortalSidebarProps) {
  const navItems = [
    { href: "/portal/home", label: "Home", icon: Home },
    { href: "/portal/earnings", label: "Earnings", icon: DollarSign },
    { href: "/portal/links", label: "Links", icon: Link2 },
    { href: "/portal/assets", label: "Assets", icon: Images },
    { href: "/portal/account", label: "Account", icon: User },
  ];

  return (
    <aside 
      className="hidden lg:block w-56 bg-white border-r border-gray-200 min-h-screen p-4"
      style={{ 
        borderRightColor: primaryColor,
        borderRightWidth: '2px'
      }}
    >
      <div className="flex items-center gap-2 mb-8">
        <div 
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {portalName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-bold text-gray-900">
          {portalName}
        </span>
      </div>
      
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-opacity-10' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              style={isActive ? { 
                backgroundColor: `${primaryColor}20`,
                color: primaryColor 
              } : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}