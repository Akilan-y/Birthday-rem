import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Check,
  Copy,
  Gift,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  AssistantPersona,
  ChatMessageEntry,
  ComputedBirthday,
} from '../types/birthday';
import {formatCountdownLabel, formatShortDate} from '../utils/dateMath';

interface ChatbotPanelProps {
  birthdays: ComputedBirthday[];
  messages: ChatMessageEntry[];
  onAppendMessages: (newMessages: ChatMessageEntry[]) => Promise<void> | void;
  onClearMessages: () => Promise<void> | void;
}

const PERSONA_OPTIONS: {
  id: AssistantPersona;
  label: string;
  modelLabel: string;
  description: string;
}[] = [
  {
    id: 'eco-gifting',
    label: 'Eco Gift Advisor',
    modelLabel: 'gemini-4-hydrogen',
    description: 'Sustainable, low-waste, and handmade gift ideas tailored to your list.',
  },
  {
    id: 'milestone-planner',
    label: 'Milestone Planner',
    modelLabel: 'gemini-4-hydrogen',
    description: 'Keepsake ideas and gathering plans for milestone birthdays.',
  },
  {
    id: 'quick-wishes',
    label: 'Quick Note Writer',
    modelLabel: 'gemini-3.1-flash-lite',
    description: 'Fast, heartfelt birthday card messages and short personal notes.',
  },
];

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({
  birthdays,
  messages,
  onAppendMessages,
  onClearMessages,
}) => {
  const [persona, setPersona] = useState<AssistantPersona>('eco-gifting');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages.length, isSending]);

  const activePersonaConfig =
    PERSONA_OPTIONS.find((p) => p.id === persona) ?? PERSONA_OPTIONS[0];

  const birthdayContextSummary = useMemo(() => {
    if (birthdays.length === 0) return '';
    return birthdays
      .slice(0, 12)
      .map((b) => {
        const ageText = b.turningAge !== null ? `, turning ${b.turningAge}` : '';
        const noteText = b.note ? ` | Note: ${b.note}` : '';
        return `- ${b.name}: ${formatShortDate(b.month, b.day)} (${formatCountdownLabel(b.daysUntil)}${ageText}, Circle: ${b.group}${noteText})`;
      })
      .join('\n');
  }, [birthdays]);

  const quickPrompts = useMemo(() => {
    const next = birthdays[0];
    if (!next) {
      return [
        'Suggest 5 zero-waste birthday gift ideas under $30',
        'Write a warm birthday note for a close friend',
        'How should I organize a milestone 50th keepsake book?',
      ];
    }
    return [
      `Eco-friendly gift ideas for ${next.name} (${formatShortDate(next.month, next.day)})`,
      `Write 3 heartfelt birthday card notes for ${next.name}`,
      next.turningAge !== null
        ? `Plan a thoughtful celebration for ${next.name} turning ${next.turningAge}`
        : `Suggest a meaningful low-waste surprise for ${next.name}`,
    ];
  }, [birthdays]);

  const sendMessageText = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);
    setInput('');

    const userMsg: ChatMessageEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      persona,
      model: activePersonaConfig.modelLabel,
      createdAt: new Date().toISOString(),
    };

    // Persist user message right away so history stays consistent
    await onAppendMessages([userMsg]);

    try {
      const historyPayload = messages.slice(-16).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          message: trimmed,
          persona,
          history: historyPayload,
          birthdayContext: birthdayContextSummary,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        model?: string;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Failed to receive a reply from Gemini.');
      }

      const modelMsg: ChatMessageEntry = {
        id: crypto.randomUUID(),
        role: 'model',
        text: data.reply,
        persona,
        model: data.model || activePersonaConfig.modelLabel,
        createdAt: new Date().toISOString(),
      };

      await onAppendMessages([modelMsg]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Gemini right now. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageText(input);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <section
      aria-label="Gemini celebration assistant"
      className="flex flex-col h-[calc(100vh-14rem)] min-h-[520px] rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/75 dark:bg-white/[0.03] overflow-hidden"
    >
      {/* Header & Role Selector */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#1D8FE1] dark:text-[#38BDF8]" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Celebration Assistant
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {activePersonaConfig.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Assistant role"
            className="flex items-center gap-1 p-1 rounded-full bg-slate-200/70 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.07] overflow-x-auto max-w-full"
          >
            {PERSONA_OPTIONS.map((opt) => {
              const active = persona === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPersona(opt.id)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#1D8FE1] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearMessages}
              title="Clear conversation history"
              aria-label="Clear conversation history"
              className="min-h-[38px] px-3 rounded-full border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
            <div className="w-11 h-11 rounded-2xl bg-[#1D8FE1]/15 border border-[#1D8FE1]/30 flex items-center justify-center text-[#1D8FE1] dark:text-[#38BDF8]">
              <Gift className="w-5 h-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
              Ask for gift ideas, milestone plans, or birthday notes
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your conversation stays multi-turn across messages, and the assistant can reference your upcoming birthday dates and notes.
            </p>
            <div className="mt-5 flex flex-col gap-2 w-full">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessageText(prompt)}
                  className="w-full text-left px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#1D8FE1] text-white'
                      : 'border border-slate-200 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.05] text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <div
                    className={`mt-2 flex items-center justify-between gap-4 text-[10px] ${
                      isUser ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="font-mono tabular-nums">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.05] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Error Banner + Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-white/[0.02]"
      >
        {error && (
          <p className="mb-3 text-xs text-rose-500 dark:text-rose-400">{error}</p>
        )}
        <div className="flex items-end gap-2.5">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageText(input);
              }
            }}
            placeholder={`Ask ${activePersonaConfig.label}...`}
            aria-label="Message Gemini assistant"
            className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.05] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#38BDF8] resize-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Send message"
            className="min-h-[44px] px-4 rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-xs font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </form>
    </section>
  );
};
