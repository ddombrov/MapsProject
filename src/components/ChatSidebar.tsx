'use client';

import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import type { ChatOp, ItineraryItem } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  location: string;
  days: number;
  itinerary: ItineraryItem[];
  onApply: (ops: ChatOp[]) => void;
}

export function ChatSidebar({ location, days, itinerary, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (!location || days < 1) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: trimmed },
        { role: 'assistant', text: 'Set a destination and dates first so I know where to add things.' },
      ]);
      setInput('');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, location, days, itinerary }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.ops?.length) onApply(data.ops);
        setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.error || 'Something went wrong.' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Failed to reach the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-5 md:right-24 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover"
        title="Chat to add, remove, or swap places"
      >
        <MessageCircle size={22} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-5 md:right-24 z-40 w-80 max-w-[calc(100vw-2rem)] h-96 max-h-[60vh] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-primary text-white">
        <span className="text-sm font-semibold">Edit via Chat</span>
        <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400">
            Try: &quot;add a bakery for day 2 morning&quot;, &quot;remove the museum&quot;, or &quot;swap the pizza place for
            something vegan&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs rounded-lg px-2.5 py-1.5 max-w-[85%] ${
              m.role === 'user' ? 'bg-primary text-white self-end' : 'bg-gray-100 text-gray-700 self-start'
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400 self-start">Thinking…</div>}
      </div>
      <div className="flex items-center gap-1.5 p-2 border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder="I want..."
          className="flex-1 text-xs p-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading}
          className="p-2 rounded-lg bg-primary text-white disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
