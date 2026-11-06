"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, UserRound, Loader2, AlertCircle, Mic, Volume2, Pause, Square, Plus, Trash2, Pin, PinOff, Edit2, Check, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import dynamic from "next/dynamic";
import { ChatStore, ChatSession, Citation as StoreCitation } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { localizeDocText } from "@/lib/i18n/localize";

const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then(mod => mod.PdfViewer), {
  ssr: false,
});

// ─── Badge tone by confidence ─────────────────────────────────────────────────

function confidenceTone(confidence: string): "blue" | "green" | "amber" | "red" {
  if (confidence === "High") return "green";
  if (confidence === "Medium") return "amber";
  if (confidence === "Low") return "red";
  return "blue";
}

function detectQueryLanguage(text: string): "hi" | "en" {
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  if (devanagariCount > 0) return "hi";
  const hiWords = new Set(["kya", "kaise", "hai", "hain", "ke", "ki", "ko", "me", "mein", "par", "se", "aur", "ya", "niyam", "suraksha", "khadan", "mantri", "shuru", "karo", "batao", "bataiye", "samajh", "aaya", "karein", "chahiye"]);
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const matchCount = words.filter(w => hiWords.has(w)).length;
  if (matchCount >= 2) return "hi";
  return "en";
}

function localizeCitationText(text: string, targetLang: "hi" | "en"): string {
  return localizeDocText(text, targetLang);
}

export default function AssistantPage() {
  const { lang, t } = useLanguage();
  
  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Citations & PDF
  const [activeCitations, setActiveCitations] = useState<StoreCitation[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<{sourceId: string, title: string, page: number, highlightText?: string} | null>(null);
  
  // TTS / STT
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const startInputValueRef = useRef("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // History Sidebar state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  // Initialize
  useEffect(() => {
    const list = ChatStore.listSessions();
    setSessions(list);
    
    const activeId = ChatStore.getActiveSessionId();
    if (activeId) {
      const active = ChatStore.loadSession(activeId);
      if (active) {
        setActiveSession(active);
        // Load latest citations if any
        const lastAssistantMsg = active.messages.slice().reverse().find(m => m.role === "assistant");
        if (lastAssistantMsg && lastAssistantMsg.citations) {
          setActiveCitations(lastAssistantMsg.citations);
        }
      } else if (list.length > 0) {
        switchSession(list[0].id);
      } else {
        startNewChat();
      }
    } else if (list.length > 0) {
      switchSession(list[0].id);
    } else {
      startNewChat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      mountedRef.current = false;
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + H for history
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setHistoryOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const refreshSessions = useCallback(() => {
    setSessions(ChatStore.listSessions());
  }, []);

  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsLoading(false);
    setIsStreaming(false);
    const s = ChatStore.createSession(lang);
    setActiveSession(s);
    setActiveCitations([]);
    refreshSessions();
    setInputValue("");
    setError(null);
  }, [lang, refreshSessions]);

  const switchSession = useCallback((id: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsLoading(false);
    setIsStreaming(false);
    ChatStore.setActiveSessionId(id);
    const s = ChatStore.loadSession(id);
    if (s) {
      setActiveSession(s);
      const lastAssistantMsg = s.messages.slice().reverse().find(m => m.role === "assistant");
      setActiveCitations(lastAssistantMsg?.citations ?? []);
    }
    setInputValue("");
    setError(null);
    if (window.innerWidth < 1024) setHistoryOpen(false);
  }, []);

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ChatStore.deleteSession(id);
    refreshSessions();
    if (activeSession?.id === id) {
      const remaining = ChatStore.listSessions();
      if (remaining.length > 0) switchSession(remaining[0].id);
      else startNewChat();
    }
  };

  const togglePin = (id: string, pinned: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    ChatStore.pinSession(id, !pinned);
    refreshSessions();
  };

  const handleCitationClick = (citation: StoreCitation) => {
    setSelectedPdf({
      sourceId: citation.sourceId || citation.source_id || "",
      title: citation.title || "Document",
      page: citation.page || 1,
      highlightText: citation.excerpt,
    });
  };

  const startEditTitle = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(id);
    setEditTitleValue(title);
  };

  const saveEditTitle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editingTitleId && editTitleValue.trim()) {
      ChatStore.renameSession(editingTitleId, editTitleValue.trim());
      refreshSessions();
      if (activeSession?.id === editingTitleId) {
        setActiveSession(ChatStore.loadSession(editingTitleId));
      }
    }
    setEditingTitleId(null);
  };

  const toggleSpeech = (index: number, text: string) => {
    if (!synthRef.current) {
      setSpeechError(t("assistant.ttsError"));
      return;
    }
    if (playingMessageIndex === index) {
      if (isPlaying) { synthRef.current.pause(); setIsPlaying(false); }
      else { synthRef.current.resume(); setIsPlaying(true); }
      return;
    }
    synthRef.current.cancel(); 
    setPlayingMessageIndex(index);
    setIsPlaying(true);
    const cleanText = text.replace(/[#*`_>]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const hasHindi = /[\u0900-\u097F]/.test(cleanText);
    utterance.lang = hasHindi ? 'hi-IN' : 'en-IN';
    const voices = synthRef.current.getVoices();
    const voice = voices.find(v => v.lang === utterance.lang) || voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (!mountedRef.current) return;
      setPlayingMessageIndex(null);
      setIsPlaying(false);
    };
    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') console.error("SpeechSynthesis error:", e);
      if (!mountedRef.current) return;
      setPlayingMessageIndex(null);
      setIsPlaying(false);
    };
    synthRef.current.speak(utterance);
  };
  
  const stopSpeech = () => {
    if (synthRef.current) synthRef.current.cancel();
    setPlayingMessageIndex(null);
    setIsPlaying(false);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError(t("assistant.micUnsupported"));
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setSpeechError(null);
      startInputValueRef.current = inputValue; 
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognitionRef.current.onerror = (event: any) => {
      if (event.error !== "aborted") setSpeechError(t("assistant.micError"));
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognitionRef.current.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      const base = startInputValueRef.current ? startInputValueRef.current + " " : "";
      setInputValue(base + transcript);
    };
    recognitionRef.current.lang = lang === "hi" ? "hi-IN" : "en-IN";
    try { recognitionRef.current.start(); } catch {
      setSpeechError(t("assistant.micError"));
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isStreaming]);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
  };

  async function handleAsk() {
    const question = inputValue.trim();
    if (!question || isLoading || !activeSession) return;

    setError(null);
    setInputValue("");
    
    // Add user message
    ChatStore.addMessage(activeSession.id, { role: "user", content: question });
    setActiveSession(ChatStore.loadSession(activeSession.id));
    refreshSessions();

    setIsLoading(true);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    // Create empty assistant message
    ChatStore.addMessage(activeSession.id, { role: "assistant", content: "", isStreaming: true });
    setActiveSession(ChatStore.loadSession(activeSession.id));

    try {
      // Auto-detect language (force Hindi if UI language is Hindi, else detect from query)
      const queryLang = lang === "hi" ? "hi" : detectQueryLanguage(question);

      // Build history for context (last 5 messages)
      const history = activeSession.messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, n_results: 5, language: queryLang }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(t("assistant.errorGeneric"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let finalCitations: StoreCitation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error);
              if (data.token) {
                fullContent += data.token;
                ChatStore.updateLastMessage(activeSession.id, { content: fullContent });
                // Optimistic UI update
                setActiveSession(prev => {
                  if (!prev) return prev;
                  const newMsgs = [...prev.messages];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: fullContent };
                  return { ...prev, messages: newMsgs };
                });
              }
              if (data.citations) finalCitations = data.citations;
            } catch (e) {
              console.error("SSE parse error", e);
            }
          }
        }
      }

      // Finalize
      ChatStore.updateLastMessage(activeSession.id, { content: fullContent, citations: finalCitations, isStreaming: false });
      setActiveSession(ChatStore.loadSession(activeSession.id));
      setActiveCitations(finalCitations);
      refreshSessions();

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        ChatStore.updateLastMessage(activeSession.id, { isStreaming: false });
        setActiveSession(ChatStore.loadSession(activeSession.id));
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Remove empty assistant message on failure if it's completely empty
        const s = ChatStore.loadSession(activeSession.id);
        if (s && s.messages[s.messages.length-1].content === "") {
            s.messages.pop();
            ChatStore.saveSession(s);
            setActiveSession(s);
        }
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* ── Compact Assistant Header Bar ───────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <Badge tone="green" className="text-[10px] px-2 py-0.5 shrink-0">{t("assistant.headerEyebrow")}</Badge>
          <h1 className="text-xs sm:text-sm font-semibold truncate text-foreground">{t("assistant.headerTitle")}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(!historyOpen)} className="h-7 text-xs shrink-0 lg:hidden">
          <Menu className="h-3.5 w-3.5 mr-1" />
          {t("assistant.historyBtn")}
        </Button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* ── Chat History Sidebar ────────────────────────────────────────── */}
        <div 
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-64 border-r bg-card transition-transform lg:static lg:block lg:translate-x-0 shadow-xl lg:shadow-none",
            historyOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="p-3 border-b flex justify-between items-center">
              <Button onClick={startNewChat} className="w-full justify-start font-medium" variant="secondary">
                <Plus className="mr-2 h-4 w-4" />
                {t("chat.newChat")}
              </Button>
              <Button variant="ghost" size="icon" className="lg:hidden ml-2" onClick={() => setHistoryOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{t("chat.empty")}</div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => switchSession(s.id)}
                      className={cn(
                        "group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                        activeSession?.id === s.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                      )}
                    >
                      {editingTitleId === s.id ? (
                        <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                          <input 
                            autoFocus
                            value={editTitleValue}
                            onChange={(e) => setEditTitleValue(e.target.value)}
                            onKeyDown={(e) => { if(e.key === "Enter") saveEditTitle(); if(e.key === "Escape") setEditingTitleId(null); }}
                            className="flex-1 bg-transparent border-b border-primary outline-none px-1 text-sm text-foreground"
                          />
                          <button onClick={(e) => saveEditTitle(e)} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditingTitleId(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            {s.pinned && <Pin className="h-3 w-3 shrink-0 text-primary fill-primary" />}
                            <span className="truncate">{s.title}</span>
                          </div>
                          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            <button onClick={(e) => startEditTitle(s.id, s.title, e)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 className="h-3 w-3" /></button>
                            <button onClick={(e) => togglePin(s.id, s.pinned, e)} className="p-1 text-muted-foreground hover:text-foreground">{s.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}</button>
                            <button onClick={(e) => deleteSession(s.id, e)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Workspace ────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="grid w-full h-full min-h-0 overflow-hidden xl:grid-cols-[1fr_360px]">
            {/* Chat Panel */}
            <div className="flex h-full min-h-0 flex-col bg-background p-4 sm:p-6 overflow-hidden">
              <div className="scrollbar-thin flex-1 min-h-0 overflow-y-auto pr-2 space-y-6">
                {activeSession?.messages.map((message, index) => {
                  const isAssistant = message.role === "assistant";
                  const isStreamingNow = message.isStreaming;
                  
                  let confidence = "Low";
                  let confidenceLabel = t("assistant.confidenceLow");
                  let category = t("assistant.categoryRecommendation");
                  let categoryTone = "green" as "blue" | "green" | "amber" | "red" | "neutral";
                  
                  if (isAssistant && message.citations && message.citations.length > 0) {
                    const confidences = message.citations.map(c => c.confidence || "Low");
                    if (confidences.includes("High")) {
                      confidence = "High";
                      confidenceLabel = t("assistant.confidenceHigh");
                    } else if (confidences.includes("Medium")) {
                      confidence = "Medium";
                      confidenceLabel = t("assistant.confidenceMedium");
                    }
                    
                    const type = (message.citations[0].sourceType || "").toLowerCase();
                    if (type.includes("circular") || type.includes("cmr") || type.includes("act") || type.includes("regulation")) {
                      category = t("assistant.categorySafetyRule");
                      categoryTone = "blue";
                    } else if (type.includes("sop") || type.includes("guideline")) {
                      category = t("assistant.categorySOP");
                      categoryTone = "amber";
                    } else if (type.includes("audit") || type.includes("report") || type.includes("inspection")) {
                      category = t("assistant.categoryInspection");
                      categoryTone = "neutral";
                    } else if (type.includes("emergency")) {
                      category = t("assistant.categoryEmergency");
                      categoryTone = "red";
                    }
                  }

                  return (
                    <div key={message.id || `${message.role}-${index}`} className={`flex gap-3 ${isAssistant ? "" : "justify-end"}`}>
                      {isAssistant && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      <div className={`max-w-[780px] rounded-lg border p-4 text-sm leading-6 shadow-sm ${isAssistant ? "bg-card" : "bg-primary text-primary-foreground"}`}>
                        {isAssistant && message.citations && message.citations.length > 0 && !isStreamingNow && (
                          <div className="mb-3 flex items-center gap-2">
                            <Badge tone={confidenceTone(confidence)} className="h-5 px-2 text-[10px] font-medium tracking-wide">
                              {confidenceLabel}
                            </Badge>
                            <Badge tone={categoryTone} className="h-5 px-2 text-[10px] font-medium tracking-wide uppercase">
                              {category}
                            </Badge>
                          </div>
                        )}
                        
                        {isAssistant ? (
                          <div className={cn("prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed", isStreamingNow && "streaming-cursor")}>
                            {message.content ? (
                              <ReactMarkdown
                                components={{
                                  blockquote: ({ ...props }) => (
                                    <div className="my-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30">
                                      <div className="mb-1 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{t("assistant.practicalTip")}</span>
                                      </div>
                                      <div className="text-[13px] text-blue-900/90 dark:text-blue-200 [&>p]:m-0 pl-6">{props.children}</div>
                                    </div>
                                  ),
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            ) : (
                              <span className="text-muted-foreground animate-pulse">{t("chat.streamingLabel")}</span>
                            )}
                          </div>
                        ) : (
                          message.content
                        )}

                        {isAssistant && !isStreamingNow && message.content && (
                          <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-2 opacity-60 hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleSpeech(index, message.content)}>
                              {playingMessageIndex === index && isPlaying ? <><Pause className="mr-1 h-3 w-3" /> {t("assistant.ttsSpeaking")}</> : <><Volume2 className="mr-1 h-3 w-3" /> {t("assistant.ttsListen")}</>}
                            </Button>
                            {playingMessageIndex === index && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={stopSpeech}>
                                <Square className="mr-1 h-3 w-3" /> {t("assistant.ttsStop")}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {!isAssistant && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                          <UserRound className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {isLoading && !isStreaming && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
                    <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("assistant.searching")}
                    </div>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-4 shrink-0">
                {speechError && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{speechError}</span>
                  </div>
                )}
                <div className="relative flex items-end gap-2 bg-card rounded-xl border shadow-sm p-2 focus-within:ring-1 focus-within:ring-primary transition-shadow">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? t("assistant.micListening") : t("assistant.placeholder")}
                    className={cn("min-h-[52px] max-h-32 resize-none border-0 bg-transparent py-3 pr-10 focus-visible:ring-0", isListening && "text-primary")}
                    rows={1}
                  />
                  <div className="absolute right-4 top-3 flex items-center gap-1">
                    <Button size="icon" variant="ghost" className={cn("h-8 w-8 rounded-full", isListening && "animate-pulse text-primary bg-primary/10")} onClick={toggleVoiceInput} type="button">
                      <Mic className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <p className="text-[11px] text-muted-foreground hidden sm:block">
                    {t("assistant.footerText")}
                  </p>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    {isStreaming ? (
                      <Button onClick={stopGeneration} variant="destructive" size="sm" className="h-8">
                        <Square className="mr-2 h-3.5 w-3.5 fill-current" />
                        {t("chat.stopGeneration")}
                      </Button>
                    ) : (
                      <Button onClick={handleAsk} disabled={isLoading || (!inputValue.trim() && !isListening)} size="sm" className="h-8">
                        <Send className="mr-2 h-3.5 w-3.5" />
                        {t("assistant.btnAsk")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Citations Panel ────────────────────────────────────────── */}
            <div className="hidden border-l bg-muted/20 p-4 xl:block overflow-y-auto scrollbar-thin">
              <h3 className="mb-1 text-sm font-semibold">{t("assistant.activeCitations")}</h3>
              <p className="mb-4 text-xs text-muted-foreground">{t("assistant.activeCitationsDesc")}</p>
              
              <div className="space-y-3">
                {(() => {
                  const displayCitations = activeCitations.length > 0 ? activeCitations : (
                    activeSession?.messages.slice().reverse().find(m => m.role === "assistant" && m.citations && m.citations.length > 0)?.citations ?? []
                  );

                  if (displayCitations.length === 0) {
                    return (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        {t("assistant.noCitations")}
                      </div>
                    );
                  }

                  return displayCitations.map((citation, i) => {
                    const displayTitle = localizeCitationText(citation.title || "", lang);
                    const displaySection = localizeCitationText(citation.section || "", lang);
                    const pageText = citation.page > 0 ? (lang === "hi" ? `· पृष्ठ ${citation.page}` : `· p.${citation.page}`) : "";
                    
                    return (
                      <div 
                        key={`${citation.sourceId || citation.source_id}-${i}`} 
                        className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                        onClick={() => handleCitationClick(citation)}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <Badge tone="neutral" className="bg-background text-[10px]">
                            {localizeCitationText(citation.sourceType || citation.sourceId || citation.source_id || "", lang)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                          {displayTitle}
                        </p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {displaySection} {pageText}
                        </p>
                        {citation.excerpt && (
                          <div className="mt-2 border-l-2 border-primary/30 pl-2 text-xs italic text-muted-foreground line-clamp-4 group-hover:line-clamp-none transition-all">
                            &ldquo;{localizeCitationText(citation.excerpt || "", lang)}&rdquo;
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedPdf && (
        <PdfViewer 
          sourceId={selectedPdf.sourceId}
          title={selectedPdf.title}
          initialPage={selectedPdf.page}
          highlightText={selectedPdf.highlightText}
          isOpen={true}
          onClose={() => setSelectedPdf(null)}
        />
      )}
    </div>
  );
}
