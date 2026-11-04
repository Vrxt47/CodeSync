import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import type { FormatRequestInput, FormatResponseData } from "./formatting.schema";
import { formatJavaScript } from "./adapters/javascript.formatter";
import { formatPython } from "./adapters/python.formatter";
import { formatCpp } from "./adapters/cpp.formatter";
import { formatJava } from "./adapters/java.formatter";

export class FormattingService {
  /**
   * Formats source code for a verified workspace file.
   * Enforces strict workspace access verification and isolated formatter execution.
   */
  public static async format(
    userId: string,
    input: FormatRequestInput
  ): Promise<FormatResponseData> {
    const { fileId, content, language } = input;

    // 1. Verify file existence
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }

    if (file.type !== "FILE") {
      throw new AppError("Cannot format a directory", 400, "CANNOT_FORMAT_FOLDER");
    }

    // 2. Verify workspace access authorization
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: file.workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new AppError(
        "You do not have access to this workspace",
        403,
        "WORKSPACE_ACCESS_DENIED"
      );
    }

    // 3. Delegate to allowlisted formatter adapter
    let formattedContent: string;

    switch (language) {
      case "javascript":
        formattedContent = await formatJavaScript(content);
        break;
      case "python":
        formattedContent = await formatPython(content);
        break;
      case "cpp":
        formattedContent = await formatCpp(content);
        break;
      case "java":
        formattedContent = await formatJava(content);
        break;
      default:
        throw new AppError(
          `Unsupported language for formatting: ${language}`,
          400,
          "UNSUPPORTED_LANGUAGE"
        );
    }

    return { formattedContent };
  }
}
