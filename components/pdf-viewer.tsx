"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight, Printer, Loader2, FileDown } from "lucide-react";
import { Button } from "./ui/button";

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { useLanguage } from "@/lib/i18n/LanguageContext";

// Configure PDF.js worker from the bundled copy in /public — no external CDN required
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface PdfViewerProps {
  sourceId: string;
  title: string;
  initialPage?: number;
  highlightText?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PdfViewer({ sourceId, title, initialPage = 1, highlightText, isOpen, onClose }: PdfViewerProps) {
  const { lang } = useLanguage();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<"width" | "page">("page");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPageNumber(initialPage || 1);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen, initialPage]);

  // Adjust scale based on container resize
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      // Standard A4 PDF aspect ratio is ~1.414 (height/width)
      // So width is ~0.707 of height.
      // 595 x 842 points.
      const pdfBaseWidth = 600;
      
      if (fitMode === "width") {
        // Leave some padding
        setScale((clientWidth - 40) / pdfBaseWidth);
      } else {
        // Fit Page
        // A4 ratio
        const expectedWidth = (clientHeight - 40) * 0.707;
        setScale(Math.min((clientWidth - 40) / pdfBaseWidth, expectedWidth / pdfBaseWidth));
      }
    };

    if (isOpen) {
      updateScale();
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
  }, [isOpen, fitMode]);

  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  const handlePrint = () => {
    // Remove any previous iframe
    if (printIframeRef.current && document.body.contains(printIframeRef.current)) {
      document.body.removeChild(printIframeRef.current);
    }
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = documentUrl;
    printIframeRef.current = iframe;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      // Defer removal to allow print dialog to appear
      const cleanup = setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        if (printIframeRef.current === iframe) {
          printIframeRef.current = null;
        }
      }, 10000);
      // Store cleanup id in case we need it
      (iframe as HTMLIFrameElement & { _cleanupId?: ReturnType<typeof setTimeout> })._cleanupId = cleanup;
    };
  };

  // Custom text renderer for highlighting
  const textRenderer = useCallback((textItem: { str: string, itemIndex: number }) => {
    if (!highlightText) return textItem.str;
    
    // Create a very basic fuzzy highlight by checking if words from the highlightText are in the str.
    // Full paragraph matching across multiple text items is hard in react-pdf without complex state,
    // so we do a simple string inclusion or word match for the excerpt.
    const cleanHighlight = highlightText.trim().toLowerCase();
    const cleanText = textItem.str.toLowerCase();
    
    // If the entire text item is part of the highlight
    if (cleanHighlight.includes(cleanText) && cleanText.length > 5) {
      return <mark className="bg-yellow-300/60 text-yellow-900 rounded-[2px]">{textItem.str}</mark>;
    }
    
    // Try to find the exact substring match within the textItem
    const idx = cleanText.indexOf(cleanHighlight);
    if (idx >= 0) {
      const before = textItem.str.slice(0, idx);
      const match = textItem.str.slice(idx, idx + cleanHighlight.length);
      const after = textItem.str.slice(idx + cleanHighlight.length);
      return (
        <>
          {before}
          <mark className="bg-yellow-300/60 text-yellow-900 rounded-[2px]">{match}</mark>
          {after}
        </>
      );
    }
    
    // If we only have a partial match, try a word-by-word match if it's a long text item
    const words = cleanHighlight.split(/\s+/).filter(w => w.length > 4);
    for (const word of words) {
      if (cleanText.includes(word)) {
        // Highlight this specific text item because it contains significant words from the excerpt
        return <mark className="bg-yellow-300/40 text-yellow-900 rounded-[2px]">{textItem.str}</mark>;
      }
    }

    return textItem.str;
  }, [highlightText]);

  if (!isOpen) return null;

  const documentUrl = `/api/documents/${sourceId}/download?lang=${lang}&v=${Date.now()}`;
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    if (initialPage > numPages) setPageNumber(numPages);
  }

  const handleZoomIn = () => setScale(s => s + 0.2);
  const handleZoomOut = () => setScale(s => Math.max(0.4, s - 0.2));
  const handleNextPage = () => setPageNumber(p => (numPages ? Math.min(p + 1, numPages) : p));
  const handlePrevPage = () => setPageNumber(p => Math.max(p - 1, 1));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/20 bg-black/50 px-4 text-white shadow-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
          <div className="hidden md:block">
            <h2 className="text-sm font-semibold truncate max-w-[300px] lg:max-w-[500px]" title={title}>{title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Pagination */}
          <div className="flex items-center gap-1 mr-4 bg-white/10 rounded-md p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={handlePrevPage} disabled={pageNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-[80px] text-center">
              {pageNumber} / {numPages || '-'}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleNextPage} disabled={pageNumber >= (numPages || 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom */}
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hidden sm:inline-flex" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-10 text-center hidden sm:inline-block">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hidden sm:inline-flex" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block"></div>

          {/* Fit */}
          <Button 
            variant="ghost" 
            size="sm" 
            className={`text-white hover:bg-white/20 hidden md:inline-flex ${fitMode === 'width' ? 'bg-white/20' : ''}`}
            onClick={() => setFitMode("width")}
          >
            {lang === "hi" ? "चौड़ाई में फिट" : "Fit Width"}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`text-white hover:bg-white/20 hidden md:inline-flex ${fitMode === 'page' ? 'bg-white/20' : ''}`}
            onClick={() => setFitMode("page")}
          >
            {lang === "hi" ? "पूरा पृष्ठ" : "Fit Page"}
          </Button>

          <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block"></div>

          {/* Actions */}
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handlePrint} title={lang === "hi" ? "प्रिंट करें" : "Print"}>
            <Printer className="h-4 w-4" />
          </Button>
          <a href={documentUrl} download>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" title={lang === "hi" ? "डाउनलोड करें" : "Download"}>
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      {/* Viewer Area */}
      <div 
        className="flex-1 overflow-auto flex justify-center bg-[#2d2d2d]" 
        ref={containerRef}
      >
        <div className="py-8 my-auto flex justify-center min-h-full">
          <Document
            file={documentUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center text-white/50 h-64">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>{lang === "hi" ? "दस्तावेज़ लोड हो रहा है..." : "Loading document..."}</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center text-red-400 h-64 max-w-md text-center">
                <FileDown className="h-12 w-12 mb-4 opacity-50" />
                <p>{lang === "hi" ? "पीडीएफ फ़ाइल लोड करने में विफल।" : "Failed to load PDF file."}</p>
                <p className="text-sm mt-2 opacity-80">{lang === "hi" ? "दस्तावेज़ वैध पीडीएफ नहीं हो सकता है या सर्वर से गायब हो सकता है।" : "The document might not be a valid PDF or could be missing from the server."}</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              // @ts-expect-error - CustomTextRenderer type expects string but react-pdf supports JSX here
              customTextRenderer={textRenderer}
              renderAnnotationLayer={false}
              className="shadow-2xl bg-white"
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
