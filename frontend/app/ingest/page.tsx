"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileType, CheckCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function IngestPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const onDropBlueprint = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setTimeout(() => setStep(2), 600);
    }
  }, []);

  const onDropManual = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setTimeout(() => setStep(3), 600);
    }
  }, []);

  const { getRootProps: getBpProps, getInputProps: getBpInputProps, isDragActive: isBpDragActive } = useDropzone({
    onDrop: onDropBlueprint,
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "application/acad": [".dwg"] },
    maxFiles: 1,
  });

  const { getRootProps: getMnProps, getInputProps: getMnInputProps, isDragActive: isMnDragActive } = useDropzone({
    onDrop: onDropManual,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-[var(--text)]">Data Ingestion Hub</h1>
          <p className="text-[var(--muted)]">Upload your industrial assets to initialize the Omni-Graph.</p>
        </div>

        <div className="space-y-6">
          {/* Step 1: Blueprint */}
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`relative flex flex-col rounded-xl border-2 transition-all ${
              step > 1 ? "border-[var(--success)] bg-[var(--surface)] p-4" : isBpDragActive ? "border-[var(--primary)] bg-[var(--surface)] p-12" : "border-dashed border-[var(--border)] bg-transparent p-12 hover:border-[var(--primary)] hover:bg-[var(--surface)]"
            }`}
            {...(step === 1 ? (getBpProps() as any) : {})}
          >
            {step === 1 && <input {...getBpInputProps()} />}
            
            <div className="flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${step > 1 ? "bg-emerald-500/20 text-emerald-500" : "bg-[var(--bg)] text-[var(--primary)]"}`}>
                  {step > 1 ? <CheckCircle className="h-6 w-6" /> : <FileType className="h-8 w-8" />}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text)]">1. Upload Spatial Schematic</h3>
                  <p className="text-sm text-[var(--muted)]">Supports PNG, JPEG, DWG/CAD</p>
                </div>
              </div>
              {step === 1 && <UploadCloud className="h-6 w-6 text-[var(--muted)]" />}
            </div>
            
            {step === 1 && (
              <div className="mt-6 flex justify-center text-sm font-mono text-[var(--muted)] pointer-events-none">
                {isBpDragActive ? "Drop file here..." : "Drag & drop or click to browse"}
              </div>
            )}
          </motion.div>

          {/* Step 2: Manual */}
          <AnimatePresence>
            {step >= 2 && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
                className={`relative flex flex-col rounded-xl border-2 transition-all ${
                  step > 2 ? "border-[var(--success)] bg-[var(--surface)] p-4" : isMnDragActive ? "border-[var(--secondary)] bg-[var(--surface)] p-12" : "border-dashed border-[var(--border)] bg-transparent p-12 hover:border-[var(--secondary)] hover:bg-[var(--surface)]"
                }`}
                {...(step === 2 ? (getMnProps() as any) : {})}
              >
                {step === 2 && <input {...getMnInputProps()} />}
                
                <div className="flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-3 ${step > 2 ? "bg-emerald-500/20 text-emerald-500" : "bg-[var(--bg)] text-[var(--secondary)]"}`}>
                      {step > 2 ? <CheckCircle className="h-6 w-6" /> : <FileType className="h-8 w-8" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text)]">2. Upload Technical Manual</h3>
                      <p className="text-sm text-[var(--muted)]">Supports PDF format</p>
                    </div>
                  </div>
                  {step === 2 && <UploadCloud className="h-6 w-6 text-[var(--muted)]" />}
                </div>
                
                {step === 2 && (
                  <div className="mt-6 flex justify-center text-sm font-mono text-[var(--muted)] pointer-events-none">
                    {isMnDragActive ? "Drop PDF here..." : "Drag & drop or click to browse"}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button */}
          <AnimatePresence>
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.2 }}
                className="mt-8 flex justify-center"
              >
                <button
                  onClick={() => router.push("/process")}
                  className="group flex items-center gap-2 rounded-md bg-[var(--primary)] px-8 py-3 font-bold text-black transition-all hover:bg-[var(--text)] hover:shadow-[0_0_20px_var(--primary)]"
                >
                  Initialize AI Extraction <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
