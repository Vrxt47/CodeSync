import { spawn } from "node:child_process";
import { AppError } from "../../../utils/AppError";

/**
 * Formats Java source code using google-java-format via controlled stdin/stdout piping.
 * Applies a 5-second hard execution timeout and strict argument allowlisting.
 */
export async function formatJava(content: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let resolved = false;

    // Fixed, allowlisted arguments for google-java-format (reading from stdin: -)
    const child = spawn("google-java-format", ["-"], {
      shell: false,
      timeout: 5000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (resolved) return;
      resolved = true;
      if (err.code === "ENOENT") {
        reject(
          new AppError(
            "Java formatter (google-java-format) is not available on the server",
            503,
            "FORMATTER_UNAVAILABLE"
          )
        );
      } else {
        reject(
          new AppError(
            `Failed to execute Java formatter: ${err.message}`,
            500,
            "FORMATTER_EXEC_ERROR"
          )
        );
      }
    });

    child.on("close", (code, signal) => {
      if (resolved) return;
      resolved = true;

      if (signal === "SIGTERM" || signal === "SIGKILL") {
        return reject(
          new AppError("Java formatting timed out after 5 seconds", 504, "FORMAT_TIMEOUT")
        );
      }

      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new AppError(
            `Java formatting failed (code ${code}): ${stderr || stdout}`,
            422,
            "FORMAT_SYNTAX_ERROR"
          )
        );
      }
    });

    // Write source code to child process stdin
    child.stdin.write(content);
    child.stdin.end();
  });
}
