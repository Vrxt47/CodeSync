"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { workspaceApi } from "@/lib/workspaceApi";
import { IDELayout } from "@/components/ide/IDELayout";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/types/workspace";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace(`/login?redirect=/workspace/${workspaceId}`);
    }
  }, [isAuthLoading, isAuthenticated, router, workspaceId]);

  useEffect(() => {
    if (!workspaceId || isAuthLoading || !isAuthenticated) return;

    let isMounted = true;

    async function loadWorkspace() {
      try {
        setIsLoading(true);
        setError(null);
        setIsDenied(false);
        const data = await workspaceApi.getWorkspace(workspaceId);
        if (isMounted) {
          setWorkspace(data);
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err?.statusCode === 403 || err?.code === "WORKSPACE_ACCESS_DENIED") {
          setIsDenied(true);
          setError("You do not have permission to access this workspace.");
        } else if (err?.statusCode === 404) {
          setError("The requested workspace was not found.");
        } else {
          setError(err?.message || "Failed to load workspace.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, isAuthLoading, isAuthenticated]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="h-screen w-screen bg-[#181818] flex flex-col items-center justify-center text-[#CCCCCC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#007ACC] mb-3" />
        <p className="text-sm font-mono text-[#858585]">Loading workspace environment...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="h-screen w-screen bg-[#181818] flex flex-col items-center justify-center text-[#CCCCCC] p-6">
        <div className="max-w-md w-full bg-[#1E1E1E] border border-[#303030] rounded-lg p-6 shadow-xl text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-950/40 border border-red-800/60 flex items-center justify-center mx-auto text-red-400">
            {isDenied ? <ShieldAlert className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isDenied ? "Access Denied" : "Workspace Unavailable"}
            </h2>
            <p className="text-xs text-[#858585] mt-1.5">{error}</p>
          </div>
          <Link href="/dashboard" className="block pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#303030] bg-[#252526] text-white hover:bg-[#2A2D2E] gap-2 mx-auto text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <IDELayout
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userRole={workspace.role}
    />
  );
}
