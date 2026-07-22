"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Network, Cpu, Database } from "lucide-react";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 400, damping: 25 },
    },
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[var(--bg)] p-6">
      {/* Abstract Background Particles (Simulated with simple CSS divs for now to keep it lightweight) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-15">
        <div className="absolute top-[20%] left-[10%] h-[500px] w-[500px] rounded-full bg-[var(--primary)] blur-[120px]" />
        <div className="absolute top-[40%] right-[10%] h-[400px] w-[400px] rounded-full bg-[var(--tertiary)] blur-[100px]" />
      </div>

      <motion.div
        className="z-10 flex max-w-4xl flex-col items-center text-center"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.h1
          className="mb-6 text-6xl font-black tracking-tighter text-[var(--text)] md:text-8xl"
          variants={itemVariants}
        >
          OMNI<span className="text-[var(--primary)]">-</span>GRAPH
        </motion.h1>
        
        <motion.p
          className="mb-12 max-w-2xl text-lg text-[var(--muted)] md:text-xl"
          variants={itemVariants}
        >
          The next-generation industrial knowledge intelligence engine. Transform static engineering manuals and CAD schematics into a fully navigable, 3D semantic network.
        </motion.p>

        <motion.div variants={itemVariants}>
          <Link
            href="/ingest"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-md border border-[var(--primary)] bg-[var(--bg)] px-8 py-4 font-bold text-[var(--text)] transition-all hover:bg-[var(--primary)] hover:text-black hover:shadow-[0_0_20px_var(--primary)]"
          >
            <span className="relative z-10 flex items-center gap-2 tracking-widest">
              ENTER COMMAND CENTER <Cpu className="h-5 w-5" />
            </span>
          </Link>
        </motion.div>

        <motion.div
          className="mt-24 grid w-full grid-cols-1 gap-6 md:grid-cols-3"
          variants={containerVariants}
        >
          {[
            {
              icon: Network,
              title: "Hybrid-Edge Architecture",
              desc: "Decoupled AI processing allows localized operation even in air-gapped industrial environments.",
            },
            {
              icon: Database,
              title: "Multi-Modal Ingestion",
              desc: "Deterministic extraction of P&ID layouts seamlessly linked to deep technical text contexts.",
            },
            {
              icon: Cpu,
              title: "Deterministic Mapping",
              desc: "Zero hallucination guarantees. Every node maps to an exact coordinate and document paragraph.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:-translate-y-[6px] hover:border-[var(--primary)] hover:shadow-[0_4px_20px_-5px_var(--primary)]"
              variants={itemVariants}
            >
              <feature.icon className="mb-4 h-8 w-8 text-[var(--primary)]" />
              <h3 className="mb-2 font-bold text-[var(--text)]">{feature.title}</h3>
              <p className="text-sm text-[var(--muted)]">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
