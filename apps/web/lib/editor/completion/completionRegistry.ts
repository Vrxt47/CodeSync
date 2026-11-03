import type * as Monaco from "monaco-editor";
import { registerPythonCompletionProvider } from "./pythonCompletions";
import { registerCppCompletionProvider } from "./cppCompletions";
import { registerJavascriptCompletionProvider } from "./javascriptCompletions";
import { registerJavaCompletionProvider } from "./javaCompletions";

let isRegistered = false;
let disposables: Monaco.IDisposable[] = [];

/**
 * Checks whether custom completion providers are currently registered.
 */
export function areCompletionProvidersRegistered(): boolean {
  return isRegistered;
}

/**
 * Registers language-specific completion providers for Python, C++, JavaScript, and Java.
 * Idempotent: Calling this multiple times will safely return the existing disposables without
 * duplicate registrations or duplicate suggestions.
 */
export function registerAllCompletionProviders(monaco: typeof Monaco): Monaco.IDisposable[] {
  if (isRegistered) {
    return disposables;
  }

  try {
    const pythonDisp = registerPythonCompletionProvider(monaco);
    const cppDisp = registerCppCompletionProvider(monaco);
    const jsDisp = registerJavascriptCompletionProvider(monaco);
    const javaDisp = registerJavaCompletionProvider(monaco);

    disposables = [pythonDisp, cppDisp, jsDisp, javaDisp];
    isRegistered = true;
  } catch (error) {
    console.error("Failed to register Monaco completion providers:", error);
  }

  return disposables;
}

/**
 * Disposes all registered completion providers and resets registration state.
 * Useful for cleanup and isolated automated testing.
 */
export function unregisterAllCompletionProviders(): void {
  for (const disposable of disposables) {
    try {
      disposable.dispose();
    } catch {
      // Ignore individual disposal errors
    }
  }
  disposables = [];
  isRegistered = false;
}

