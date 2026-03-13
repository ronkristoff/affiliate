"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
}

export function LogoutButton({
  variant = "ghost",
  size = "default",
  className = "",
  showIcon = true,
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {showIcon && <LogOut className="mr-2 h-4 w-4" />}
          Logout
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription>
            Are you sure you want to log out? You will need to sign in again to access your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleLogout} disabled={isLoading}>
            {isLoading ? "Logging out..." : "Logout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
