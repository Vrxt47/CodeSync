import path from "path";
import type { NextConfig } from "next";

const monacoEntry = require.resolve("monaco-editor");
const monacoRoot = path.dirname(path.dirname(path.dirname(monacoEntry)));
const monacoEditorApiPath = path.join(monacoRoot, "esm/vs/editor/editor.api.js");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@codesync/shared"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "monaco-editor/esm/vs/editor/editor.api.js": monacoEditorApiPath,
      "monaco-editor/esm/vs/editor/editor.api": monacoEditorApiPath,
    };
    return config;
  },
};

export default nextConfig;
