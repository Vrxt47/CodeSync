import { FileNode } from "@/types/ide";

export const MOCK_WORKSPACE_NAME = "MY-WORKSPACE";

export const MOCK_FILE_TREE: FileNode[] = [
  {
    id: "folder-src",
    name: "src",
    type: "folder",
    path: "src",
    children: [
      {
        id: "folder-components",
        name: "components",
        type: "folder",
        path: "src/components",
        children: [
          {
            id: "file-header-tsx",
            name: "Header.tsx",
            type: "file",
            path: "src/components/Header.tsx",
            extension: "tsx",
            language: "TypeScript React",
            content: `import React from 'react';
import { Code2, Bell, Settings } from 'lucide-react';

interface HeaderProps {
  title?: string;
  version?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = "CodeSync IDE",
  version = "0.2.0"
}) => {
  return (
    <header className="h-11 border-b border-[#303030] bg-[#181818] flex items-center justify-between px-4 text-[#CCCCCC]">
      <div className="flex items-center gap-2">
        <Code2 className="h-5 w-5 text-[#007ACC]" />
        <span className="font-semibold text-sm tracking-tight text-white">{title}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#252526] text-[#858585]">
          v{version}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-1 hover:bg-[#2A2D2E] rounded text-[#858585] hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
        </button>
        <button className="p-1 hover:bg-[#2A2D2E] rounded text-[#858585] hover:text-white transition-colors">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

export default Header;
`,
          },
        ],
      },
      {
        id: "folder-utils",
        name: "utils",
        type: "folder",
        path: "src/utils",
        children: [
          {
            id: "file-helper-ts",
            name: "helper.ts",
            type: "file",
            path: "src/utils/helper.ts",
            extension: "ts",
            language: "TypeScript",
            content: `/**
 * CodeSync Workspace Utilities
 * Shared helper functions for IDE state & formatting
 */

export interface SessionInfo {
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  connectedAt: Date;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return \`\${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} \${sizes[i]}\`;
}

export function getLanguageByExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    cpp: 'C++',
    cc: 'C++',
    h: 'C++',
    hpp: 'C++',
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    py: 'Python',
    java: 'Java',
    json: 'JSON',
    md: 'Markdown',
    svg: 'XML / SVG',
    gitignore: 'Git Ignore',
  };
  return languageMap[ext.toLowerCase()] || 'Plain Text';
}
`,
          },
        ],
      },
      {
        id: "file-main-cpp",
        name: "main.cpp",
        type: "file",
        path: "src/main.cpp",
        extension: "cpp",
        language: "C++",
        content: `// ============================================================================
// CodeSync Collaborative IDE — C++ Environment
// Multi-language execution powered by Judge0 CE sandbox
// ============================================================================

#include <iostream>
#include <vector>
#include <string>
#include <iomanip>

struct SystemComponent {
    std::string name;
    std::string status;
    int port;
};

int main() {
    std::cout << "=========================================" << std::endl;
    std::cout << "   CodeSync Cloud IDE — Runtime v0.2.0   " << std::endl;
    std::cout << "=========================================" << std::endl;

    std::vector<SystemComponent> components = {
        {"Next.js Web Frontend", "Online", 3000},
        {"Express REST API",     "Online", 4000},
        {"Hocuspocus CRDT Server", "Online", 1234},
        {"PostgreSQL Database",  "Ready",  5432},
        {"Redis Task Broker",    "Ready",  6379}
    };

    std::cout << std::left << std::setw(25) << "Component"
              << std::setw(10) << "Status"
              << "Port" << std::endl;
    std::cout << "-----------------------------------------" << std::endl;

    for (const auto& item : components) {
        std::cout << std::left << std::setw(25) << item.name
                  << std::setw(10) << item.status
                  << ":" << item.port << std::endl;
    }

    std::cout << "-----------------------------------------" << std::endl;
    std::cout << "Status: All services operational." << std::endl;
    return 0;
}
`,
      },
    ],
  },
  {
    id: "folder-public",
    name: "public",
    type: "folder",
    path: "public",
    children: [
      {
        id: "file-logo-svg",
        name: "logo.svg",
        type: "file",
        path: "public/logo.svg",
        extension: "svg",
        language: "XML",
        content: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#007ACC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m18 16 4-4-4-4" />
  <path d="m6 8-4 4 4 4" />
  <path d="m14.5 4-5 16" />
</svg>
`,
      },
    ],
  },
  {
    id: "file-readme-md",
    name: "README.md",
    type: "file",
    path: "README.md",
    extension: "md",
    language: "Markdown",
    content: `# CodeSync — Collaborative Browser-Based IDE

A high-performance, real-time collaborative development environment designed for pair programming, interviews, and team workflows.

## Key Capabilities
- **Monaco Editor Integration**: First-class editing experience with multi-cursor support.
- **CRDT Synchronization**: Real-time multi-user editing powered by Yjs & Hocuspocus.
- **Sandboxed Execution**: Isolated remote execution using Judge0 CE.
- **Integrated Terminal**: Streaming output, stdin support, and process metrics.
- **Multi-Language**: Python, C++, TypeScript/JavaScript, and Java.

## Quick Start
\`\`\`bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
\`\`\`
`,
  },
  {
    id: "file-package-json",
    name: "package.json",
    type: "file",
    path: "package.json",
    extension: "json",
    language: "JSON",
    content: `{
  "name": "my-workspace",
  "version": "1.0.0",
  "description": "CodeSync Project Workspace",
  "main": "src/main.cpp",
  "scripts": {
    "start": "node src/utils/helper.ts",
    "test": "echo \\"Running workspace unit tests...\\" && exit 0"
  },
  "dependencies": {
    "react": "^19.0.0",
    "lucide-react": "^1.16.0"
  }
}
`,
  },
  {
    id: "file-gitignore",
    name: ".gitignore",
    type: "file",
    path: ".gitignore",
    extension: "gitignore",
    language: "Git Ignore",
    content: `node_modules/
dist/
build/
.next/
.cache/
.env
.env.local
*.log
.DS_Store
Thumbs.db
`,
  },
];

export function findFileById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getAllFolderIds(nodes: FileNode[]): string[] {
  const folderIds: string[] = [];
  function recurse(items: FileNode[]) {
    for (const item of items) {
      if (item.type === "folder") {
        folderIds.push(item.id);
        if (item.children) recurse(item.children);
      }
    }
  }
  recurse(nodes);
  return folderIds;
}
