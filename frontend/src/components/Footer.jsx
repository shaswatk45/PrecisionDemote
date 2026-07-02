export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-safe via-accent to-unsafe flex items-center justify-center text-[10px] font-bold text-white">
            16
          </span>
          <span>
            Precision<span className="text-gradient font-semibold">Demote</span>
            <span className="text-gray-600"> · FP32 → FP16 static analysis</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/shaswatk45/PrecisionDemote"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://clang.llvm.org/docs/LibTooling.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Clang LibTooling
          </a>
          <span className="text-gray-600">MIT Licensed</span>
        </div>
      </div>
    </footer>
  )
}
