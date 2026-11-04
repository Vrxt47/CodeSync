"use client";

import { useState, useRef, useCallback } from "react";
import { fileApi } from "@/lib/fileApi";
import type { FileSystemItem } from "@/types/filesystem";

export interface UseFileContentResult {
  file: FileSystemItem | null;
  content: string;
  version: number | null;
  isLoading: boolean;
  error: string | null;
  loadFile: (fileId: string) => Promise<string | null>;
  getFileVersion: () => number | null;
  reset: () => void;
}

/**
 * Handles fetching file content from the backend with strict race condition prevention.
 * If multiple file open requests are triggered consecutively, earlier in-flight responses
 * are automatically discarded if a newer request has been initiated.
 */
export function useFileContent(): UseFileContentResult {
  const [file, setFile] = useState<FileSystemItem | null>(null);
  const [content, setContent] = useState<string>("");
  const [version, setVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestSeqRef = useRef<number>(0);
  const versionRef = useRef<number | null>(null);

  const loadFile = useCallback(async (fileId: string): Promise<string | null> => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const item = await fileApi.getFile(fileId);

      // Discard stale response if a newer request was issued in the meantime
      if (seq !== requestSeqRef.current) {
        return null;
      }

      const fileContent = item.content ?? "";
      versionRef.current = item.version;
      setVersion(item.version);
      setFile(item);
      setContent(fileContent);
      return fileContent;
    } catch (err: unknown) {
      if (seq !== requestSeqRef.current) {
        return null;
      }
      const message = err instanceof Error ? err.message : "Failed to load file content";
      setError(message);
      return null;
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const getFileVersion = useCallback((): number | null => {
    return versionRef.current;
  }, []);

  const reset = useCallback(() => {
    requestSeqRef.current++;
    versionRef.current = null;
    setVersion(null);
    setFile(null);
    setContent("");
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    file,
    content,
    version,
    isLoading,
    error,
    loadFile,
    getFileVersion,
    reset,
  };
}
