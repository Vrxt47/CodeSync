import { z } from "zod";

export const formatRequestSchema = z.object({
  fileId: z.string().uuid("Invalid file ID format"),
  content: z.string().max(1024 * 1024, "Content exceeds maximum formatting limit of 1MB"),
  language: z.enum(["javascript", "python", "cpp", "java"], {
    errorMap: () => ({
      message: "Unsupported formatting language. Supported: javascript, python, cpp, java",
    }),
  }),
});

export type FormatRequestInput = z.infer<typeof formatRequestSchema>;

export interface FormatResponseData {
  formattedContent: string;
}
