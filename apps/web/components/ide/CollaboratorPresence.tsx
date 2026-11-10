"use client";

import React from "react";
import type { Collaborator } from "@/hooks/useCollab";

export interface CollaboratorPresenceProps {
  collaborators?: Collaborator[];
  maxVisible?: number;
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && first && last && first[0] && last[0]) {
    return (first[0] + last[0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * CollaboratorPresence displays active remote collaborators working in the current document
 * with overlapping avatar circles, colored rings, initials, and hover tooltips.
 */
export const CollaboratorPresence: React.FC<CollaboratorPresenceProps> = ({
  collaborators = [],
  maxVisible = 4,
}) => {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, maxVisible);
  const overflowCount = collaborators.length - maxVisible;
  const overflowNames =
    overflowCount > 0
      ? collaborators
          .slice(maxVisible)
          .map((c) => c.user.name)
          .join(", ")
      : "";

  return (
    <div
      className="flex items-center -space-x-1.5 py-0.5 select-none"
      aria-label={`${collaborators.length} remote collaborator${collaborators.length === 1 ? "" : "s"}`}
    >
      {visibleCollaborators.map((c) => {
        const user = c.user;
        const color = user.color && /^#[0-9A-Fa-f]{6}$/.test(user.color) ? user.color : "#007acc";
        const tooltip = `${user.name}${user.email ? ` (${user.email})` : ""} — Active in document`;

        return (
          <div
            key={c.clientId}
            title={tooltip}
            className="relative h-6 w-6 rounded-full ring-2 ring-[#181818] flex items-center justify-center cursor-pointer transition-transform hover:scale-110 hover:z-20 shadow-sm shrink-0"
            style={{
              backgroundColor: color,
              borderColor: color,
            }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-full w-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[10px] font-bold text-white tracking-tight leading-none drop-shadow-sm">
                {getInitials(user.name)}
              </span>
            )}
            {/* Live presence indicator badge */}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-[#181818]"
              title="Online"
            />
          </div>
        );
      })}

      {overflowCount > 0 && (
        <div
          title={`Additional collaborators: ${overflowNames}`}
          className="relative h-6 w-6 rounded-full bg-[#2A2D2E] ring-2 ring-[#181818] flex items-center justify-center text-[10px] font-semibold text-[#CCCCCC] cursor-pointer hover:bg-[#333638] transition-transform hover:scale-110 hover:z-20 shrink-0"
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
};
