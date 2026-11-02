"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="h-screen w-screen bg-[#181818] flex flex-col items-center justify-center text-[#CCCCCC]">
      <Loader2 className="h-8 w-8 animate-spin text-[#007ACC] mb-3" />
      <p className="text-sm font-mono text-[#858585]">Initializing CodeSync...</p>
    </div>
  );
}
