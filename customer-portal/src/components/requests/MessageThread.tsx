import { useRef, useEffect } from "react";
import type { Message } from "../../types";

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const isAgent = message.authorRole === "agent" || message.authorRole === "manager";

  return (
    <div
      className={`flex gap-3 animate-slide-up ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${
          isOwn
            ? "bg-gradient-to-br from-brand-400 to-brand-600"
            : "bg-gradient-to-br from-slate-400 to-slate-600"
        }`}
      >
        {isAgent ? "🛡" : message.authorName.charAt(0).toUpperCase()}
      </div>

      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            {isAgent ? `${message.authorName} · Support Team` : message.authorName}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isOwn
              ? "rounded-tr-sm bg-gradient-to-br from-brand-500 to-brand-700 text-white"
              : "rounded-tl-sm bg-white text-slate-800 border border-slate-100"
          }`}
        >
          {message.content}
        </div>
        <span className="text-xs text-slate-400">{formatDate(message.createdAt)}</span>
      </div>
    </div>
  );
}

export function MessageThread({ messages, currentUserId }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl mb-2">💬</span>
        <p className="text-sm text-slate-500">No messages yet. Start the conversation below.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.authorId === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
