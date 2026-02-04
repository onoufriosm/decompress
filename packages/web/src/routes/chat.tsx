import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@/lib/auth";
import { useQueryUsage } from "@/hooks/use-query-usage";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import {
  MessageSquare,
  Send,
  Loader2,
  X,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatPageProps {
  videoId?: string;
}

// Get the API URL from environment or default to localhost
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function ChatPage({ videoId }: ChatPageProps) {
  const { user, session } = useAuth();
  const { queriesRemaining, limitReached, loading: usageLoading, refresh: refreshUsage } = useQueryUsage();

  // Thread state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);
  const [showThreadsSidebar, setShowThreadsSidebar] = useState(true);

  // Selected videos - derived from prop or loaded from thread
  const [threadVideoIds, setThreadVideoIds] = useState<string[]>([]);
  const selectedVideos = videoId ? [videoId] : threadVideoIds;

  // Chat state
  const [inputMessage, setInputMessage] = useState("");

  // Fetch auth headers helper
  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${data.session?.access_token || ""}`,
      "Content-Type": "application/json",
    };
  }, []);

  // Use ref to always get current selectedVideos value in the body function
  const selectedVideosRef = useRef(selectedVideos);
  selectedVideosRef.current = selectedVideos;

  // Create transport with dynamic headers and body
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: `${API_URL}/api/chat`,
      headers: () => ({
        Authorization: `Bearer ${session?.access_token || ""}`,
      }),
      body: () => ({
        videoIds: selectedVideosRef.current,
      }),
    });
  }, [session?.access_token]);

  // Vercel AI SDK v6 useChat hook for streaming
  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
  } = useChat({
    transport,
    onFinish: async ({ message }) => {
      // Refresh usage count after each message
      refreshUsage();

      // Save assistant message to database
      if (activeThreadId && message.role === "assistant") {
        const content = message.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p: { type: "text"; text: string }) => p.text)
          .join("") || "";

        await saveMessage(activeThreadId, "assistant", content);
        // Refresh threads to update the title if it changed
        fetchThreads();
      }
    },
  });

  const sending = status === "submitted" || status === "streaming";
  const canUseAI = !limitReached && !!user && selectedVideos.length > 0;

  // Fetch threads (filtered by videoId if provided)
  const fetchThreads = useCallback(async () => {
    if (!user) return;

    try {
      const headers = await getAuthHeaders();
      const url = videoId
        ? `${API_URL}/api/threads?videoId=${videoId}`
        : `${API_URL}/api/threads`;
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setThreads(data);
      }
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoadingThreads(false);
    }
  }, [user, getAuthHeaders, videoId]);

  // Load thread messages
  const loadThread = useCallback(async (threadId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/threads/${threadId}`, { headers });
      if (response.ok) {
        const data = await response.json();

        // Convert stored messages to AI SDK format
        const loadedMessages = (data.messages || []).map((msg: ChatMessage) => ({
          id: msg.id,
          role: msg.role,
          parts: [{ type: "text", text: msg.content }],
        }));

        setMessages(loadedMessages);
        // Only update thread video IDs if we're not in single-video mode
        if (!videoId) {
          setThreadVideoIds(data.video_ids || []);
        }
        setActiveThreadId(threadId);
      }
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  }, [getAuthHeaders, setMessages, videoId]);

  // Create new thread
  const createThread = useCallback(async () => {
    setCreatingThread(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/threads`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: "New Chat",
          videoIds: videoId ? [videoId] : [],
        }),
      });

      if (response.ok) {
        const thread = await response.json();
        setThreads((prev) => [thread, ...prev]);
        setActiveThreadId(thread.id);
        setMessages([]);
        if (!videoId) {
          setThreadVideoIds([]);
        }
      }
    } catch (err) {
      console.error("Failed to create thread:", err);
    } finally {
      setCreatingThread(false);
    }
  }, [getAuthHeaders, setMessages, videoId]);

  // Delete thread
  const deleteThread = useCallback(async (threadId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/threads/${threadId}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
          setMessages([]);
          setThreadVideoIds([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete thread:", err);
    }
  }, [getAuthHeaders, activeThreadId, setMessages]);

  // Save message to database
  const saveMessage = useCallback(async (threadId: string, role: "user" | "assistant", content: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/threads/${threadId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ role, content }),
      });
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  }, [getAuthHeaders]);

  // Update thread videos
  const updateThreadVideos = useCallback(async (threadId: string, videoIds: string[]) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/threads/${threadId}/videos`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ videoIds }),
      });
    } catch (err) {
      console.error("Failed to update thread videos:", err);
    }
  }, [getAuthHeaders]);

  // Fetch threads on mount
  useEffect(() => {
    if (user) {
      fetchThreads();
    }
  }, [user, fetchThreads]);

  // Get text content from message parts
  const getMessageContent = (msg: typeof messages[0]): string => {
    if (!msg.parts) return "";
    return msg.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUseAI || !inputMessage.trim() || sending) return;

    // Create thread if we don't have one
    let threadId = activeThreadId;
    if (!threadId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/threads`, {
          method: "POST",
          headers,
          body: JSON.stringify({ title: "New Chat" }),
        });

        if (response.ok) {
          const thread = await response.json();
          setThreads((prev) => [thread, ...prev]);
          threadId = thread.id;
          setActiveThreadId(thread.id);

          // Associate videos with new thread
          await updateThreadVideos(thread.id, selectedVideos);
        }
      } catch (err) {
        console.error("Failed to create thread:", err);
        return;
      }
    }

    const messageText = inputMessage.trim();
    setInputMessage("");

    // Save user message to database
    if (threadId) {
      await saveMessage(threadId, "user", messageText);
    }

    await sendMessage({ text: messageText });
  };

  // Not logged in
  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AI Chat</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat with Video Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Ask questions about video content and get AI-powered answers based on transcripts.
            </p>
            <SignInDialog
              trigger={<Button className="w-full">Sign in to Start</Button>}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Threads Sidebar */}
      {showThreadsSidebar && (
        <div className="w-64 border-r flex flex-col overflow-hidden bg-muted/30">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Conversations</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={createThread}
              disabled={creatingThread}
            >
              {creatingThread ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingThreads ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="p-2">
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))
              ) : threads.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  No conversations yet
                </p>
              ) : (
                threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`group flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer ${
                      activeThreadId === thread.id ? "bg-muted" : ""
                    }`}
                    onClick={() => loadThread(thread.id)}
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{thread.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                setActiveThreadId(null);
                setMessages([]);
                setThreadVideoIds([]);
              }}
            >
              <Plus className="h-3 w-3 mr-2" />
              New conversation
            </Button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowThreadsSidebar(!showThreadsSidebar)}
            >
              {showThreadsSidebar ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <h1 className="font-semibold">AI Chat</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {usageLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className={limitReached ? "text-destructive" : ""}>
                {queriesRemaining} queries remaining
              </span>
            )}
          </div>
        </div>

        {/* Limit reached warning */}
        {limitReached && (
          <div className="px-4 py-3 bg-destructive/10 text-destructive text-sm flex items-center gap-2 border-b">
            <AlertCircle className="h-4 w-4" />
            You've reached your monthly limit of 200 queries. Your limit resets at the start of next month.
          </div>
        )}

        {/* No video selected warning (only in standalone mode) */}
        {!videoId && selectedVideos.length === 0 && (
          <div className="px-4 py-3 bg-muted text-muted-foreground text-sm flex items-center gap-2 border-b">
            <AlertCircle className="h-4 w-4" />
            Select a conversation with a video to start chatting, or go to a video page to ask questions.
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground">
                    {videoId
                      ? "Ask questions about this video's content"
                      : "Select a conversation or go to a video page to ask questions"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{getMessageContent(msg)}</p>
                    </div>
                  </div>
                ))}
                {sending && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error.message || "Failed to send message"}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6"
              onClick={() => window.location.reload()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
            <Input
              placeholder={
                selectedVideos.length > 0
                  ? "Ask a question about the video..."
                  : "Select a video to start chatting..."
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={sending || !canUseAI}
            />
            <Button
              type="submit"
              disabled={!inputMessage.trim() || sending || !canUseAI}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
