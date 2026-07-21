// frontend/src/components/customer/ChatInterface.tsx
// =============================================================================
// ChatInterface — AI Chat Component
// =============================================================================
// Manages the full conversation between the customer and the LangGraph agent.
//
// Key behaviours:
//   • Maintains a local `messages` array (user + assistant turns).
//   • Sends POST /chat/message via our Axios client on submit.
//   • Renders customer bubbles right-aligned, AI bubbles left-aligned
//     per DESIGN.md § 4.6 — no glowing effects, clean Everforest palette.
//   • Shows three-dot typing animation while awaiting the AI response.
//   • Detects the `interrupted` flag from the backend and renders a
//     distinct approval-pending banner inside the chat flow.
//   • Handles 429 rate-limit errors with a countdown banner.
//   • Auto-scrolls to the latest message.
//
// Props:
//   injectedMessage — a string passed down by CustomerTerminal when the
//                     user clicks "Add to Order" on a menu card. The
//                     ChatInterface pre-fills the input with this string.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/api/client'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { CanopyApiError } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'user' | 'assistant' | 'system'

interface Message {
  id: string
  role: Role
  content: string
  timestamp: Date
  /** Set to true on the assistant message that triggered the HITL interrupt */
  isInterrupted?: boolean
}

interface ChatResponse {
  response: string
  interrupted: boolean
  thread_id: string
}

interface Props {
  /** Pre-fill the input from a menu card click — cleared after use */
  injectedMessage?: string
  onInjectedConsumed?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const INITIAL_GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content: "Welcome to Canopy 🌿 I'm your personal ordering assistant. Tell me what you'd like to eat today, or ask me anything about our menu!",
  timestamp: new Date(),
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Three-dot typing animation — DESIGN.md § 4.6 Typing Indicator */
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* AI avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center">
        <span className="text-accent-green text-xs">🌿</span>
      </div>
      {/* Bubble */}
      <div
        className="px-4 py-3 border border-bg-border"
        style={{
          background: '#343F44',
          borderRadius: '16px 16px 16px 4px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        <LoadingSpinner size="sm" />
      </div>
    </div>
  )
}

/** HITL interrupt banner — shown inline in the chat flow */
function ApprovalBanner() {
  return (
    <div
      className="flex items-start gap-3 animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="flex-shrink-0 w-7 h-7" /> {/* spacer to align with AI bubbles */}
      <div
        className="w-full border px-4 py-3.5 rounded-xl"
        style={{
          background: 'rgba(219, 188, 127, 0.08)',
          borderColor: 'rgba(219, 188, 127, 0.35)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base leading-none">⏳</span>
          <span className="text-warning-yellow font-semibold text-sm tracking-wide">
            Awaiting Manager Approval
          </span>
        </div>
        <p className="text-text-muted text-xs leading-relaxed">
          Your order has been submitted and is now in the manager's queue.
          You'll be notified here as soon as it's reviewed. This usually takes
          just a moment.
        </p>
      </div>
    </div>
  )
}

/** Individual chat message bubble — DESIGN.md § 4.6 */
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (message.role === 'system') return null

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center">
          <span className="text-accent-green text-xs">🌿</span>
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: '75%' }}
      >
        {/* Bubble */}
        <div
          className="px-4 py-2.5 text-text-primary text-sm leading-relaxed whitespace-pre-wrap"
          style={
            isUser
              ? {
                  // Customer bubble — DESIGN.md § 4.6
                  background: 'rgba(167, 192, 128, 0.13)',
                  border: '1px solid rgba(167, 192, 128, 0.25)',
                  borderRadius: '16px 16px 4px 16px',
                }
              : {
                  // AI bubble — DESIGN.md § 4.6
                  background: '#343F44',
                  border: '1px solid #475258',
                  borderRadius: '16px 16px 16px 4px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                }
          }
        >
          {message.content}
        </div>

        {/* Timestamp — DESIGN.md § 4.6 */}
        <span className="text-text-muted text-xs px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatInterface({ injectedMessage, onInjectedConsumed }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_GREETING])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null)

  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Handle injected message from menu card click
  useEffect(() => {
    if (injectedMessage) {
      setInput(injectedMessage)
      inputRef.current?.focus()
      onInjectedConsumed?.()
    }
  }, [injectedMessage, onInjectedConsumed])

  // Rate-limit countdown timer
  useEffect(() => {
    if (rateLimitSeconds === null) return
    if (rateLimitSeconds <= 0) {
      setRateLimitSeconds(null)
      return
    }
    rateLimitTimerRef.current = setInterval(() => {
      setRateLimitSeconds((s) => (s !== null && s > 0 ? s - 1 : null))
    }, 1000)
    return () => {
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current)
    }
  }, [rateLimitSeconds])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    // Optimistically append user message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const data = await api.post<ChatResponse>('/chat/message', { message: text })

      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        isInterrupted: data.interrupted,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError

      if (apiErr.statusCode === 429) {
        // Parse Retry-After from response headers (set by RULES.md § E-3)
        const retryAfter = parseInt(
          (apiErr as unknown as { response?: { headers?: Record<string, string> } })
            ?.response?.headers?.['retry-after'] ?? '15',
          10,
        )
        setRateLimitSeconds(retryAfter)
        // Remove the optimistically added user message for cleanliness
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        setInput(text) // restore input so user doesn't lose their message
      } else {
        // Generic error as system message
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: apiErr.friendlyMessage ?? 'Something went wrong. Please try again.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Chat header ──────────────────────────────────────────────── */}
      <div
        className="px-5 py-3.5 border-b border-bg-border flex items-center gap-3"
        style={{ background: '#343F44' }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-accent-green animate-pulse" />
        <div>
          <p className="text-text-heading font-semibold text-sm">Canopy Assistant</p>
          <p className="text-text-muted text-xs">AI-powered · Always available</p>
        </div>
      </div>

      {/* ── Rate limit banner ─────────────────────────────────────────── */}
      {rateLimitSeconds !== null && (
        <div
          className="mx-4 mt-3 px-4 py-2.5 rounded-lg border text-sm flex items-center gap-2"
          style={{
            background: 'rgba(230, 126, 128, 0.08)',
            borderColor: 'rgba(230, 126, 128, 0.3)',
          }}
          role="alert"
        >
          <span className="text-danger-red">⚠</span>
          <span className="text-danger-red font-medium">
            You're going too fast! Please wait{' '}
            <span className="font-bold">{rateLimitSeconds}s</span>.
          </span>
        </div>
      )}

      {/* ── Message list ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble message={msg} />
            {/* Approval banner appears directly after the interrupted message */}
            {msg.isInterrupted && <div className="mt-3"><ApprovalBanner /></div>}
          </div>
        ))}

        {/* AI typing indicator */}
        {isLoading && <TypingIndicator />}

        {/* Invisible anchor to scroll into view */}
        <div ref={scrollAnchorRef} />
      </div>

      {/* ── Input bar ─────────────────────────────────────────────────── */}
      <div
        className="px-4 py-3.5 border-t border-bg-border"
        style={{ background: '#2D353B' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message… (Enter to send, Shift+Enter for new line)"
            disabled={isLoading || rateLimitSeconds !== null}
            rows={1}
            className="flex-1 resize-none text-sm leading-relaxed px-3.5 py-2.5 rounded-lg
                       bg-bg-elevated border border-bg-border text-text-primary
                       placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-150"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            aria-label="Chat message input"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isLoading || rateLimitSeconds !== null}
            className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center
                       bg-accent-green text-bg-base font-bold text-base
                       hover:brightness-110 active:brightness-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150"
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
        <p className="text-text-muted text-xs mt-1.5 pl-0.5">
          Shift+Enter for new line · Your order requires manager approval before confirmation.
        </p>
      </div>
    </div>
  )
}
