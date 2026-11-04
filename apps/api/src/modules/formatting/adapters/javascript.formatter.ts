import { AppError } from "../../../utils/AppError";

/**
 * Formats JavaScript source code using Prettier in-process.
 */
export async function formatJavaScript(content: string): Promise<string> {
  try {
    const prettier = await import("prettier");
    const formatted = await prettier.format(content, {
      parser: "babel",
      tabWidth: 4,
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
    });
    return formatted;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Syntax error in JavaScript code";
    throw new AppError(`JavaScript formatting failed: ${message}`, 422, "FORMAT_SYNTAX_ERROR");
  }
}
