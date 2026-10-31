import Link from "next/link";
import { Code2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1E1E1E] text-[#CCCCCC] select-none p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center text-[#007ACC]">
          <Code2 className="h-5 w-5" />
        </div>
        <span className="font-semibold text-lg text-white">CodeSync</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">404 — Page Not Found</h2>
      <p className="text-sm text-[#858585] mb-6">The requested resource could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded bg-[#007ACC] hover:bg-[#005A9E] text-white text-xs font-medium transition-colors"
      >
        Return to IDE
      </Link>
    </div>
  );
}
