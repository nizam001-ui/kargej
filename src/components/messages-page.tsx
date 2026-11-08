"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, MessageCircle, Send, ShieldCheck } from "lucide-react";

type Conversation = { id: string; last_message_at: string | null; counterpart: { id: string; full_name: string; city: string | null; avatar_url: string | null } | null };
type Message = { id: string; body: string; sender_id: string; created_at: string };
type ApiResult<T> = { data?: T; error?: string };

export function MessagesPage({ role, conversationId }: { role: string; conversationId?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState(conversationId || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        const [threadsResponse, profileResponse] = await Promise.all([fetch("/api/conversations"), fetch("/api/profile")]);
        const threads = await threadsResponse.json() as ApiResult<Conversation[]>;
        const profile = await profileResponse.json() as ApiResult<{ id: string }>;
        if (!threadsResponse.ok) throw new Error(threads.error || "Could not load conversations.");
        if (!canceled) {
          setConversations(threads.data || []);
          setUserId(profile.data?.id || "");
          if (!activeId && threads.data?.[0]) setActiveId(threads.data[0].id);
        }
      } catch (caught) {
        if (!canceled) setError(caught instanceof Error ? caught.message : "Could not load conversations.");
      }
    })();
    return () => { canceled = true; };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    let canceled = false;
    void fetch(`/api/messages?conversation_id=${encodeURIComponent(activeId)}`).then(async (response) => {
      const result = await response.json() as ApiResult<Message[]>;
      if (!response.ok) throw new Error(result.error || "Could not load messages.");
      if (!canceled) setMessages(result.data || []);
    }).catch((caught: unknown) => {
      if (!canceled) setError(caught instanceof Error ? caught.message : "Could not load messages.");
    });
    return () => { canceled = true; };
  }, [activeId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || !activeId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: activeId, body: draft }) });
      const result = await response.json() as ApiResult<Message>;
      if (!response.ok || !result.data) throw new Error(result.error || "Could not send message.");
      setMessages((current) => [...current, result.data!]);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  const active = conversations.find((item) => item.id === activeId);
  return <main className="messages-page">
    <header className="messages-top"><Link href={`/dashboard/${role}/overview`}><ArrowLeft size={16}/> Dashboard</Link><b>Messages</b><Link href="/help">Help centre <ArrowUpRight size={14}/></Link></header>
    <div className="messages-layout">
      <aside className="conversation-list"><div className="conversation-heading"><div><h1>Messages</h1><p>Keep project conversations in one place.</p></div><MessageCircle size={18}/></div>{conversations.map((item) => <button key={item.id} className={`conversation-item ${activeId === item.id ? "active" : ""}`} onClick={() => { setMessages([]); setActiveId(item.id); }}><span className="conversation-avatar">{item.counterpart?.full_name?.slice(0, 1) || "K"}</span><span><b>{item.counterpart?.full_name || "Kárgéj member"}</b><small>{item.counterpart?.city || "Balochistan"}</small></span></button>)}{!conversations.length&&!error&&<div className="conversation-empty"><MessageCircle size={22}/><p>Your conversations will appear here.</p><Link href="/explore">Find a professional <ArrowUpRight size={14}/></Link></div>}</aside>
      <section className="message-thread"><header className="thread-heading"><span className="conversation-avatar">{active?.counterpart?.full_name?.slice(0, 1) || "K"}</span><div><b>{active?.counterpart?.full_name || "Choose a conversation"}</b><small>{active?.counterpart?.city ? `${active.counterpart.city}, Balochistan` : "Messages are private to conversation participants"}</small></div><span className="thread-safety"><ShieldCheck size={15}/> Stay respectful</span></header><div className="thread-content">{messages.map((message) => <div key={message.id} className={`message-bubble ${message.sender_id === userId ? "sent" : "received"}`}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</time></div>)}{activeId&&!messages.length&&!error&&<div className="thread-empty"><MessageCircle size={23}/><b>Start the conversation</b><p>Share the project details or ask a question to get things moving.</p></div>}{error&&<p className="form-error" role="alert">{error}</p>}</div><form className="message-compose" onSubmit={sendMessage}><textarea aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!activeId||busy} rows={2} placeholder={activeId ? "Write a message…" : "Choose a conversation first"}/><button className="button button-primary" disabled={!activeId||busy||!draft.trim()}><Send size={15}/> Send</button></form></section>
    </div>
  </main>;
}

