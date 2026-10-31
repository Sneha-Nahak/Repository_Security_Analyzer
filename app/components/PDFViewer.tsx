"use client";

import { useEffect, useRef } from "react";

interface PDFViewerProps {
  htmlContent: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PDFViewer({ htmlContent, isOpen, onClose }: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), iframe, a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus();
      } else {
        document.querySelector<HTMLElement>("#main-content")?.focus();
      }
      previousFocusRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const originalBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const originalRootOverflow = root.style.overflow;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    body.style.position = 'fixed';
    body.style.top = '-' + scrollY + 'px';
    body.style.left = '-' + scrollX + 'px';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = (currentPaddingRight + scrollbarWidth) + 'px';
    }
    root.style.overflow = 'hidden';

    return () => {
      body.style.position = originalBodyStyles.position;
      body.style.top = originalBodyStyles.top;
      body.style.left = originalBodyStyles.left;
      body.style.width = originalBodyStyles.width;
      body.style.overflow = originalBodyStyles.overflow;
      body.style.paddingRight = originalBodyStyles.paddingRight;
      root.style.overflow = originalRootOverflow;

      const originalScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = originalScrollBehavior;
    };
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div className="report-overlay">
      <section ref={dialogRef} className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" tabIndex={-1}>
        <div className="report-dialog-header">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">Scan report</p>
            <h2 id="report-dialog-title">Security Report Preview</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="report-dialog-close" aria-label="Close report preview">×</button>
        </div>
        <div className="report-dialog-content">
          <iframe ref={iframeRef} title="Security Report Preview" />
        </div>
        <div className="report-dialog-footer">
          <button type="button" onClick={onClose} className="font-semibold text-slate-700 transition">Close preview</button>
        </div>
      </section>
    </div>
  );
}
