"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout, accessToken } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#181818] flex flex-col items-center justify-center text-[#CCCCCC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#007ACC] mb-3" />
        <p className="text-sm font-mono text-[#858585]">Restoring secure session...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userInitials =
    user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CS";

  return (
    <div className="min-h-screen bg-[#181818] text-[#CCCCCC] flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-[#303030] bg-[#1E1E1E] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center text-[#007ACC] shadow-sm">
              <Code2 className="h-5 w-5" />
            </div>
            <span className="font-bold text-base text-white">CodeSync</span>
          </Link>
          <span className="text-xs text-[#858585] font-mono">/ Dashboard</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-[#303030] bg-[#252526] text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white text-xs gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#007ACC]" />
              Open IDE Workspace
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            className="h-8 text-xs bg-[#5A1D1D] hover:bg-[#782323] text-white border border-[#F14C4C]/30 gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-[#1E1E1E] border border-[#303030] rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#007ACC] to-[#005A9E] flex items-center justify-center text-white text-lg font-bold shadow-md ring-2 ring-[#007ACC]/30">
              {userInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{user.name}</h1>
                <Badge
                  variant="outline"
                  className="border-[#3FB950]/50 text-[#3FB950] bg-[#3FB950]/10 text-[10px]"
                >
                  Authenticated
                </Badge>
              </div>
              <p className="text-xs text-[#858585] font-mono mt-0.5">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <Card className="bg-[#1E1E1E] border-[#303030]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-[#007ACC]" />
                <CardTitle className="text-sm font-semibold text-white">User Profile</CardTitle>
              </div>
              <CardDescription className="text-xs text-[#858585]">
                Account information registered with CodeSync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#2A2D2E]">
                <span className="text-[#858585]">Full Name:</span>
                <span className="font-medium text-white">{user.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2A2D2E]">
                <span className="text-[#858585]">Email Address:</span>
                <span className="font-mono text-white">{user.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#2A2D2E]">
                <span className="text-[#858585]">User ID:</span>
                <span className="font-mono text-[11px] text-[#858585]">{user.id}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#858585]">Password Hash:</span>
                <span className="text-[11px] text-[#3FB950] font-mono flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Securely Omitted (Bcrypt)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Authentication & Security Details */}
          <Card className="bg-[#1E1E1E] border-[#303030]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#3FB950]" />
                <CardTitle className="text-sm font-semibold text-white">
                  Security & Token Architecture
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[#858585]">
                Chunk 4 production-grade authentication safeguards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded bg-[#252526] border border-[#303030]">
                <KeyRound className="h-4 w-4 text-[#007ACC] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white text-xs">In-Memory JWT Access Token</p>
                  <p className="text-[11px] text-[#858585] mt-0.5">
                    15-minute lifespan. Kept strictly in client memory — never stored in
                    localStorage or sessionStorage to prevent XSS theft.
                  </p>
                  <p className="text-[10px] text-[#007ACC] font-mono mt-1 truncate max-w-xs">
                    {accessToken ? `Active Token: ${accessToken.slice(0, 24)}...` : "Active"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded bg-[#252526] border border-[#303030]">
                <ShieldCheck className="h-4 w-4 text-[#3FB950] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white text-xs">
                    HttpOnly Refresh Cookie & Token Rotation
                  </p>
                  <p className="text-[11px] text-[#858585] mt-0.5">
                    7-day token stored in HttpOnly, SameSite=Lax cookie. Hashed with SHA-256 in
                    PostgreSQL. Rotated on every refresh with reuse detection.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
