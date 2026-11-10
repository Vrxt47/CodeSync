export type ConflictResolutionKind =
  "already_persisted" | "safe_version_drift" | "external_conflict";

export interface ConflictClassificationInput {
  currentContent: string;
  attemptedContent: string;
  savedBaselineContent: string;
  remoteContent: string;
}

/**
 * Classifies an HTTP 409 conflict response after fetching the authoritative server file state.
 *
 * - `"already_persisted"`: PostgreSQL already stores `currentContent` (e.g., Hocuspocus saved it).
 * - `"safe_version_drift"`: Server content matches our pre-edit baseline or our in-flight attempt
 *   without external divergence; safe to refresh `version` and save the latest buffer at most once.
 * - `"external_conflict"`: Server content diverged independently (another user/session edit);
 *   never silently overwrite PostgreSQL or clobber local edits.
 */
export function classifyHttpConflict(input: ConflictClassificationInput): ConflictResolutionKind {
  const { currentContent, attemptedContent, savedBaselineContent, remoteContent } = input;

  if (remoteContent === currentContent) {
    return "already_persisted";
  }

  if (remoteContent === savedBaselineContent || remoteContent === attemptedContent) {
    return "safe_version_drift";
  }

  return "external_conflict";
}

/**
 * Routes unsaved-changes dialog resume strictly to the single active persistence engine
 * so REST autosave and Hocuspocus collaboration never race on `File.version`.
 */
export function selectResumeTargetEngine(collabOwnsTab: boolean): "collab" | "rest" {
  return collabOwnsTab ? "collab" : "rest";
}

/**
 * Determines whether REST autosave initialization should mark a tab dirty on activation.
 * Collaborative tabs delegate dirty tracking to Hocuspocus/Yjs while keeping REST baseline synced.
 */
export function shouldAutosaveInitMarkDirty(
  collabOwnsTab: boolean,
  content: string,
  savedBaselineContent: string
): boolean {
  if (collabOwnsTab) {
    return false;
  }
  return content !== savedBaselineContent;
}
