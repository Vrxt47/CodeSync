export const APP_NAME = "CodeSync";
export const APP_DESCRIPTION = "Collaborative coding, together.";

export const SUPPORTED_LANGUAGES = [
  {
    id: "python",
    name: "Python",
    extension: ".py",
    defaultCode: '# Python 3\nprint("Hello, CodeSync!")\n',
  },
  {
    id: "cpp",
    name: "C++",
    extension: ".cpp",
    defaultCode:
      '// C++ 17\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, CodeSync!" << std::endl;\n    return 0;\n}\n',
  },
  {
    id: "javascript",
    name: "JavaScript",
    extension: ".js",
    defaultCode: '// JavaScript\nconsole.log("Hello, CodeSync!");\n',
  },
  {
    id: "java",
    name: "Java",
    extension: ".java",
    defaultCode:
      '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodeSync!");\n    }\n}\n',
  },
] as const;

export type SupportedLanguageId = (typeof SUPPORTED_LANGUAGES)[number]["id"];

export const USER_ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
