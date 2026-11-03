"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  fileName: string;
  isSaving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  fileName,
  isSaving = false,
  onSave,
  onDiscard,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#252526] border border-[#3C3C3C] rounded-lg shadow-2xl p-5 text-[#CCCCCC] flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-[#CCA700]/20 text-[#CCA700] shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 id="unsaved-changes-title" className="text-base font-semibold text-white">
              Do you want to save the changes you made to {fileName}?
            </h3>
            <p className="text-xs text-[#858585] mt-1 leading-relaxed">
              Your changes will be lost if you don&apos;t save them before switching or closing.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#333333]">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#2D2D2D] hover:bg-[#383838] text-[#CCCCCC] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {/* Don't Save / Discard Button */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#3A3D41] hover:bg-[#4E5157] text-[#CCCCCC] transition-colors disabled:opacity-50"
          >
            Don&apos;t Save
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#007ACC] hover:bg-[#0062A3] text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
