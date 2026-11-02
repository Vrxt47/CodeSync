"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Edit3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceApi } from "@/lib/workspaceApi";
import type { Workspace } from "@/types/workspace";

interface RenameWorkspaceDialogProps {
  workspace: Workspace | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedWorkspace: Workspace) => void;
}

export const RenameWorkspaceDialog: React.FC<RenameWorkspaceDialogProps> = ({
  workspace,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workspace && isOpen) {
      setName(workspace.name);
      setDescription(workspace.description || "");
      setError(null);
      setIsSubmitting(false);
    }
  }, [workspace, isOpen]);

  if (!isOpen || !workspace) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Workspace name is required.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Workspace name cannot exceed 100 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await workspaceApi.renameWorkspace(workspace.id, {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
      });
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to rename workspace. Please try again.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#1E1E1E] border border-[#303030] rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303030] bg-[#252526]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center text-[#007ACC]">
              <Edit3 className="h-4 w-4" />
            </div>
            <div>
              <h2 id="rename-dialog-title" className="text-base font-semibold text-white">
                Rename Workspace
              </h2>
              <p className="text-xs text-[#858585]">Update workspace name and details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#303030] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rename-ws-name" className="text-xs font-medium text-[#CCCCCC]">
              Workspace Name <span className="text-[#007ACC]">*</span>
            </Label>
            <Input
              id="rename-ws-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              maxLength={100}
              className="bg-[#252526] border-[#303030] text-white text-sm focus:border-[#007ACC] focus:ring-1 focus:ring-[#007ACC]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rename-ws-desc" className="text-xs font-medium text-[#CCCCCC]">
              Description <span className="text-[#858585] font-normal">(Optional)</span>
            </Label>
            <textarea
              id="rename-ws-desc"
              rows={3}
              placeholder="Describe what this workspace is used for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              maxLength={500}
              className="w-full rounded-md border border-[#303030] bg-[#252526] px-3 py-2 text-sm text-white placeholder:text-[#858585] focus:outline-none focus:border-[#007ACC] focus:ring-1 focus:ring-[#007ACC] resize-none"
            />
            <p className="text-[11px] text-[#858585] text-right">{description.length}/500</p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#303030]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-[#303030] bg-[#252526] text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              className="bg-[#007ACC] hover:bg-[#0062A3] text-white gap-2 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
