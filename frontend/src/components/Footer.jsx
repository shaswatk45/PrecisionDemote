export default function Footer() {
  const columns = [
    {
      title: 'Technology',
      links: [
        { label: 'Clang LibTooling', url: 'https://clang.llvm.org/docs/LibTooling.html' },
        { label: 'LLVM 18 Compiler', url: 'https://llvm.org/' },
        { label: 'ARM fp16 Extensions', url: 'https://developer.arm.com/' },
      ],
    },
    {
      title: 'Formats',
      links: [
        { label: '__fp16 half-precision', url: 'https://en.wikipedia.org/wiki/Half-precision_floating-point_format' },
        { label: 'bfloat16 brain-precision', url: 'https://en.wikipedia.org/wiki/Bfloat16_floating-point_format' },
        { label: 'SARIF 2.1.0 Standard', url: 'https://sarifweb.azurewebsites.net/' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'GitHub Repository', url: 'https://github.com/shaswatk45/PrecisionDemote' },
        { label: 'Static Analysis Rules', url: '#' },
        { label: 'Developer Guide', url: '#' },
      ],
    },
  ]

  return (
    <footer className="bg-surface-dark border-t border-line-strong mt-16 font-sans">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-line">
          {/* Logo Column */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-sm bg-nv flex items-center justify-center text-[10px] font-bold text-black font-mono">16</span>
              <span className="font-bold text-base uppercase tracking-wider text-white">
                Precision<span className="text-nv">Demote</span>
              </span>
            </div>
            <p className="text-xs text-mute max-w-sm leading-relaxed">
              Automated mixed-precision type demotion tool. Analyze, score safety, and rewrite float declarations using LLVM compiler pass diagnostics.
            </p>
          </div>

          {/* Nav Columns */}
          {columns.map((col) => (
            <div key={col.title} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-mute hover:text-nv transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Fine Print */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-[10px] uppercase tracking-widest text-stone font-mono">
          <div>
            &copy; {new Date().getFullYear()} PrecisionDemote Framework. All Rights Reserved.
          </div>
          <div className="flex gap-4">
            <span>MIT Licensed</span>
            <span>&middot;</span>
            <span>v3.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
