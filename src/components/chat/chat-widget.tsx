"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle,
  Send,
  Trash2,
  Loader2,
  Bot,
  User as UserIcon,
} from "lucide-react";

import { http } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ChatLink = { label: string; href: string };
type ChatMsg = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  links: ChatLink[];
  createdAt: string;
};

const MAX_LEN = 1000;

/**
 * Chatbox trợ lý (mục 5.11 PRD): floating button góc phải dưới + panel hỏi đáp.
 * Chỉ hiển thị khi feature flag CHATBOX_ENABLED bật (kiểm qua /api/config/features).
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: cfg } = useQuery({
    queryKey: ["features"],
    queryFn: () =>
      http.get<{ chatboxEnabled: boolean }>("/api/config/features"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: () => http.get<{ messages: ChatMsg[] }>("/api/chat/messages"),
    enabled: open && !!cfg?.chatboxEnabled,
  });
  const messages = data?.messages ?? [];

  const send = useMutation({
    mutationFn: (message: string) =>
      http.post<{ answer: string; links: ChatLink[] }>("/api/chat", { message }),
    onMutate: (message) => setPendingUser(message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingUser(null),
  });

  const clear = useMutation({
    mutationFn: () => http.del<{ success: boolean }>("/api/chat/messages"),
    onSuccess: () => {
      qc.setQueryData(["chat-messages"], { messages: [] });
      toast.success("Đã xoá cuộc trò chuyện.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cuộn xuống cuối khi có tin mới / đang gửi.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, pendingUser, send.isPending, open]);

  if (!cfg?.chatboxEnabled) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || send.isPending) return;
    send.mutate(msg);
    setInput("");
  }

  const isEmpty =
    !isLoading && messages.length === 0 && !pendingUser && !send.isPending;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Mở trợ lý"
          className="bg-gradient-brand fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2">
            <span className="bg-gradient-brand flex h-8 w-8 items-center justify-center rounded-lg text-white">
              <Bot className="h-4 w-4" />
            </span>
            Trợ lý Điểm rèn luyện
          </SheetTitle>
        </SheetHeader>

        {/* Danh sách tin nhắn */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {isEmpty && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Xin chào! Mình có thể hướng dẫn nhập điểm, import/export Excel, tra
              cứu sinh viên và giải thích số liệu trong phạm vi quyền của bạn.
              Hãy đặt câu hỏi nhé.
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} onNavigate={() => setOpen(false)} />
          ))}

          {/* Tin đang gửi (optimistic) + trạng thái đang trả lời */}
          {pendingUser && (
            <MessageBubble
              msg={{
                id: "pending",
                role: "USER",
                content: pendingUser,
                links: [],
                createdAt: "",
              }}
              onNavigate={() => setOpen(false)}
            />
          )}
          {send.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang trả lời...
            </div>
          )}
        </div>

        {/* Ô nhập + hành động */}
        <form onSubmit={handleSubmit} className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder="Nhập câu hỏi... (Enter để gửi)"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || send.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => clear.mutate()}
              disabled={clear.isPending || messages.length === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Xoá cuộc trò chuyện
            </button>
            <span className="text-xs text-muted-foreground">
              {input.length}/{MAX_LEN}
            </span>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  msg,
  onNavigate,
}: {
  msg: ChatMsg;
  onNavigate: () => void;
}) {
  const isUser = msg.role === "USER";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
          isUser ? "bg-primary" : "bg-gradient-brand"
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={cn("max-w-[80%] space-y-1.5", isUser && "items-end")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {msg.content}
        </div>
        {msg.links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.links.map((l, i) => (
              <Link
                key={i}
                href={l.href}
                onClick={onNavigate}
                className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
