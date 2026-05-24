
export default function HeroSection() {
  return (
    <section className="relative w-full min-h-[85vh] bg-zinc-950 flex items-center overflow-hidden border-b border-zinc-900">

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      <div className="container mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center relative z-10">

        <div className="flex flex-col gap-8 max-w-xl">
          <div className="flex flex-col gap-4">
            <h1 className="text-6xl lg:text-7xl font-black tracking-tighter text-white uppercase">
              Tokaroo
            </h1>
            <h2 className="text-2xl lg:text-3xl font-semibold text-zinc-100 tracking-tight leading-snug">
              Token-Level Engineering Toolkit. <br />
              For RAG Pipelines.
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed font-mono">
              Visualize attention decay. <br />
              Diagnose semantic mismatch. <br />
              Break retrieval strategies.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="h-10 px-6 rounded-md bg-zinc-50 text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Start Simulation
            </button>
            <button className="h-10 px-6 rounded-md border border-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-900 transition-colors">
              View Docs
            </button>
          </div>
        </div>

        <div className="relative w-full aspect-square max-w-2xl mx-auto flex items-center justify-center">
          <div className="absolute inset-0 bg-orange-500/20 blur-[120px] rounded-full pointer-events-none" />

          <img
            src="/ChatGPT_Image_May_24__2026__04_48_23_PM-removebg-preview.png"
            alt="Tokaroo Diagnostic Workbench"
            className="w-full h-full object-contain relative z-20 drop-shadow-[0_0_30px_rgba(234,88,12,0.3)]"
          />
        </div>

      </div>
    </section>
  );
}