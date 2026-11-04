import { spawn } from "node:child_process";
import { AppError } from "../../../utils/AppError";

/**
 * Formats C++ source code using clang-format via controlled stdin/stdout piping.
 * Applies a 5-second hard execution timeout and strict argument allowlisting.
 */
export async function formatCpp(content: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let resolved = false;

    // Fixed, allowlisted arguments for clang-format
    const child = spawn("clang-format", ["--assume-filename=code.cpp", "--style=Google"], {
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
            "C++ formatter (clang-format) is not available on the server",
            503,
            "FORMATTER_UNAVAILABLE"
          )
        );
      } else {
        reject(
          new AppError(
            `Failed to execute C++ formatter: ${err.message}`,
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
          new AppError("C++ formatting timed out after 5 seconds", 504, "FORMAT_TIMEOUT")
        );
      }

      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new AppError(
            `C++ formatting failed (code ${code}): ${stderr || stdout}`,
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
