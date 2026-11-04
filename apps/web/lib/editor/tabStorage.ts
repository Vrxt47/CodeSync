export interface StoredTabsState {
  openFileIds: string[];
  activeFileId: string | null;
  tabOrder: string[];
}

const TAB_STORAGE_PREFIX = "codesync_tabs_";

/**
 * Persist open tabs metadata to localStorage for a specific workspace.
 * Stores only lightweight identifiers and tab order.
 */
export function saveTabsState(
  workspaceId: string,
  openFileIds: string[],
  activeFileId: string | null
): void {
  if (typeof window === "undefined" || !workspaceId) return;

  try {
    const key = `${TAB_STORAGE_PREFIX}${workspaceId}`;
    if (openFileIds.length === 0) {
      localStorage.removeItem(key);
      return;
    }

    const payload: StoredTabsState = {
      openFileIds,
      activeFileId,
      tabOrder: openFileIds,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors in restricted browser environments
  }
}

/**
 * Retrieve persisted tabs metadata for a specific workspace.
 */
export function getStoredTabsState(workspaceId: string): StoredTabsState | null {
  if (typeof window === "undefined" || !workspaceId) return null;

  try {
    const key = `${TAB_STORAGE_PREFIX}${workspaceId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.openFileIds)) {
      return {
        openFileIds: parsed.openFileIds.filter((id: unknown) => typeof id === "string"),
        activeFileId: typeof parsed.activeFileId === "string" ? parsed.activeFileId : null,
        tabOrder: Array.isArray(parsed.tabOrder)
          ? parsed.tabOrder.filter((id: unknown) => typeof id === "string")
          : parsed.openFileIds,
      };
    }
  } catch {
    // Return null on parsing failure or storage access rejection
  }

  return null;
}

/**
 * Remove stored tab metadata for a specific workspace.
 */
export function clearStoredTabsState(workspaceId: string): void {
  if (typeof window === "undefined" || !workspaceId) return;

  try {
    localStorage.removeItem(`${TAB_STORAGE_PREFIX}${workspaceId}`);
  } catch {
    // Ignore storage errors
  }
}
