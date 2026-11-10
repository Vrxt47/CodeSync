"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  fileName: string;
  isSaving?: boolean;
  isDiscarding?: boolean;
  errorMessage?: string;
  isCollaborative?: boolean;
  activeCollaboratorCount?: number;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  fileName,
  isSaving = false,
  isDiscarding = false,
  errorMessage,
  isCollaborative = false,
  activeCollaboratorCount = 0,
  onSave,
  onDiscard,
  onCancel,
}) => {
  const isBusy = isSaving || isDiscarding;
  const isMultiUserCollab = Boolean(isCollaborative && activeCollaboratorCount > 0);

  const dialogTitle = isMultiUserCollab
    ? `Save shared changes to ${fileName}?`
    : `Do you want to save the changes you made to ${fileName}?`;

  const dialogDescription = isMultiUserCollab
    ? `This file is in an active collaborative session with ${activeCollaboratorCount} other collaborator${activeCollaboratorCount > 1 ? "s" : ""}. Edits have already been shared with the room in real time. Leaving will close your tab without forcing a database save right now.`
    : `Your changes will be lost if you don't save them before switching or closing.`;

  const discardButtonLabel = isDiscarding
    ? isMultiUserCollab
      ? "Leaving..."
      : "Discarding..."
    : isMultiUserCollab
      ? "Leave Session"
      : "Don't Save";

  // Listen for Escape key to safely cancel without discarding or saving
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={!isBusy ? onCancel : undefined}
    >
      <div
        className="w-full max-w-md bg-[#252526] border border-[#3C3C3C] rounded-lg shadow-2xl p-5 text-[#CCCCCC] flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-[#CCA700]/20 text-[#CCA700] shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 id="unsaved-changes-title" className="text-base font-semibold text-white">
              {dialogTitle}
            </h3>
            <p className="text-xs text-[#858585] mt-1 leading-relaxed">{dialogDescription}</p>
          </div>
        </div>

        {/* Error notification banner if save failed */}
        {errorMessage && (
          <div className="p-2.5 rounded bg-[#F14C4C]/15 border border-[#F14C4C]/30 text-[#F14C4C] text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#333333]">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#2D2D2D] hover:bg-[#383838] text-[#CCCCCC] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          {/* Don't Save / Discard Button */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#3A3D41] hover:bg-[#4E5157] text-[#CCCCCC] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isDiscarding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{discardButtonLabel}</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={onSave}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#007ACC] hover:bg-[#0062A3] text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
