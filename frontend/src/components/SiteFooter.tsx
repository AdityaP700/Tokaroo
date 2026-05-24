
export default function SiteFooter() {
  return (
    <footer className="bg-zinc-950 pt-24 pb-8 px-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-orange-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      <div className="container mx-auto max-w-7xl relative z-10 flex flex-col items-center">

        <div className="w-full flex justify-between items-end mb-4 px-2">
          <p className="text-zinc-500 text-sm font-mono">© 2026 Tokaroo</p>
          <div className="flex gap-6">
            <a href="#" className="text-zinc-500 hover:text-orange-400 transition-colors text-sm font-mono">GitHub</a>
            <a href="#" className="text-zinc-500 hover:text-orange-400 transition-colors text-sm font-mono">Docs</a>
          </div>
        </div>

        <h2 className="text-[14vw] leading-none font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-zinc-800 to-zinc-950 select-none">
          TOKAROO
        </h2>

      </div>
    </footer>
  );
}