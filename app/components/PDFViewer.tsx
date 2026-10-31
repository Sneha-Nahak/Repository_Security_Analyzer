"use client";

import { useEffect, useRef } from "react";

interface PDFViewerProps {
  htmlContent: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PDFViewer({ htmlContent, isOpen, onClose }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen && iframeRef.current) {
      // Create a blob from HTML content
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [isOpen, htmlContent]);

  if (!isOpen) return null;

  return (
    <div className="report-overlay">
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
        <div className="report-dialog-header">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">Scan report</p>
            <h2 id="report-dialog-title">Security Report Preview</h2>
          </div>
          <button onClick={onClose} className="report-dialog-close" aria-label="Close report preview">×</button>
        </div>
        <div className="report-dialog-content">
          <iframe ref={iframeRef} title="Security Report Preview" />
        </div>
        <div className="report-dialog-footer">
          <button onClick={onClose} className="font-semibold text-slate-700 transition">Close preview</button>
        </div>
      </section>
    </div>
  );
}
