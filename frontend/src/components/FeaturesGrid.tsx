import { Brain, Unplug, Database } from 'lucide-react';

const FAILURES = [
  {
    title: 'Lost in the Middle',
    desc: 'LLMs systematically ignore context placed in center window. Chunks 3–7 become invisible.',
    metric: '40–60%',
    metricLabel: 'attention lost',
    icon: <Brain className="w-5 h-5 text-orange-500" />
  },
  {
    title: 'Semantic Mismatch',
    desc: 'Retrieved chunks match lexically but diverge semantically. Model produces wrong answers.',
    metric: '23%',
    metricLabel: 'avg. retrieval noise',
    icon: <Unplug className="w-5 h-5 text-orange-400" />
  },
  {
    title: 'Context Overflow',
    desc: 'Tokens exceed window limits. Critical chunks drop silently.',
    metric: '128k →',
    metricLabel: 'silent truncation',
    icon: <Database className="w-5 h-5 text-yellow-500" />
  }
];

export default function FeaturesGrid() {
  return (
    <section className="bg-zinc-950 py-24 px-6 border-b border-zinc-900">
      <div className="container mx-auto max-w-6xl">

        <div className="mb-16 max-w-2xl">
          <span className="text-orange-500 font-mono text-sm tracking-wider uppercase mb-2 block">
            Invisible Failures
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
            Where AI fails silently.
          </h2>
          <p className="text-zinc-400 text-lg">
            These problems exist in every RAG system. Tokaroo reveals them.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FAILURES.map((f, i) => (
            <div
              key={i}
              className="group relative p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-900/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 shadow-inner">
                  {f.icon}
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold text-white tracking-tighter">
                    {f.metric}
                  </div>
                  <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                    {f.metricLabel}
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-zinc-800/50 mb-6" />

              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}