"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceApi } from "@/lib/workspaceApi";
import type { Workspace } from "@/types/workspace";

interface DeleteWorkspaceDialogProps {
  workspace: Workspace | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedWorkspaceId: string) => void;
}

export const DeleteWorkspaceDialog: React.FC<DeleteWorkspaceDialogProps> = ({
  workspace,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmationInput("");
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen || !workspace) return null;

  const isConfirmed = confirmationInput.trim() === workspace.name;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) {
      setError(`Please type "${workspace.name}" exactly to confirm deletion.`);
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await workspaceApi.deleteWorkspace(workspace.id);
      onSuccess(workspace.id);
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete workspace. Please try again.";
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#1E1E1E] border border-red-900/60 rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303030] bg-red-950/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 id="delete-dialog-title" className="text-base font-semibold text-white">
                Delete Workspace
              </h2>
              <p className="text-xs text-red-400/90 font-mono">Irreversible Destructive Action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#303030] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-[#CCCCCC] space-y-2 bg-[#252526] p-3.5 rounded border border-[#303030]">
            <p>
              Are you sure you want to permanently delete{" "}
              <strong className="text-white font-semibold underline decoration-red-500 underline-offset-2">
                {workspace.name}
              </strong>
              ?
            </p>
            <p className="text-[#858585]">
              This will permanently delete all files, chat messages, execution history, and revoke
              access for all members.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm-input" className="text-xs font-medium text-[#CCCCCC]">
              Type{" "}
              <span className="font-mono text-white bg-[#252526] px-1 py-0.5 rounded border border-[#303030] select-all">
                {workspace.name}
              </span>{" "}
              to confirm:
            </Label>
            <Input
              id="delete-confirm-input"
              type="text"
              autoFocus
              value={confirmationInput}
              onChange={(e) => {
                setConfirmationInput(e.target.value);
                if (error) setError(null);
              }}
              disabled={isDeleting}
              placeholder={workspace.name}
              className="bg-[#252526] border-[#303030] text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#303030]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isDeleting}
              className="border-[#303030] bg-[#252526] text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isDeleting || !isConfirmed}
              className="bg-red-600 hover:bg-red-700 text-white gap-2 font-medium disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Workspace</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
