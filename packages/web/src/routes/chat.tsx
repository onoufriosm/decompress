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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import {
  MessageSquare,
  Send,
  Loader2,
  Video,
  X,
  Search,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Lock,
} from "lucide-react";

interface VideoOption {
  id: string;
  title: string;
  source_name: string;
  has_transcript: boolean;
}

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

// Get the API URL from environment or default to localhost
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function ChatPage() {
  const { user, session } = useAuth();
  const { queriesRemaining, limitReached, loading: usageLoading, refresh: refreshUsage } = useQueryUsage();

  // Thread state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);
  const [showThreadsSidebar, setShowThreadsSidebar] = useState(true);

  // Video state
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [videoSearch, setVideoSearch] = useState("");
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [videosLocked, setVideosLocked] = useState(false);

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
  const canUseAI = !limitReached && !!user;

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    if (!user) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/threads`, { headers });
      if (response.ok) {
        const data = await response.json();
        setThreads(data);
      }
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoadingThreads(false);
    }
  }, [user, getAuthHeaders]);

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
        setSelectedVideos(data.video_ids || []);
        setActiveThreadId(threadId);
        // Lock videos if the thread already has messages
        setVideosLocked(loadedMessages.length > 0);
      }
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  }, [getAuthHeaders, setMessages]);

  // Create new thread
  const createThread = useCallback(async () => {
    setCreatingThread(true);
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
        setActiveThreadId(thread.id);
        setMessages([]);
        setSelectedVideos([]);
        setVideosLocked(false); // New thread, videos not locked yet
      }
    } catch (err) {
      console.error("Failed to create thread:", err);
    } finally {
      setCreatingThread(false);
    }
  }, [getAuthHeaders, setMessages]);

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
          setSelectedVideos([]);
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

  // Fetch videos with transcripts
  useEffect(() => {
    async function fetchVideos() {
      setLoadingVideos(true);
      const { data } = await supabase
        .from("videos")
        .select(`
          id,
          title,
          has_transcript,
          source:sources(name)
        `)
        .eq("has_transcript", true)
        .order("published_at", { ascending: false })
        .limit(100);

      if (data) {
        setVideos(
          data.map((v) => ({
            id: v.id,
            title: v.title,
            source_name: ((v.source as unknown as { name: string }) || { name: "Unknown" }).name,
            has_transcript: v.has_transcript,
          }))
        );
      }
      setLoadingVideos(false);
    }

    fetchVideos();
  }, []);

  const filteredVideos = videos.filter(
    (v) =>
      v.title.toLowerCase().includes(videoSearch.toLowerCase()) ||
      v.source_name.toLowerCase().includes(videoSearch.toLowerCase())
  );

  const toggleVideo = (id: string) => {
    // Don't allow changes if videos are locked
    if (videosLocked) return;

    const newSelection = selectedVideos.includes(id)
      ? selectedVideos.filter((v) => v !== id)
      : [...selectedVideos, id];

    setSelectedVideos(newSelection);

    // Update thread videos if we have an active thread
    if (activeThreadId) {
      updateThreadVideos(activeThreadId, newSelection);
    }
  };

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
    if (!canUseAI || selectedVideos.length === 0 || !inputMessage.trim() || sending) return;

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

    // Lock videos once conversation starts
    setVideosLocked(true);

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
              Select one or more videos and ask questions about their content.
              Our AI will analyze the transcripts to give you accurate answers.
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
                setSelectedVideos([]);
                setVideosLocked(false); // Unlock videos for new conversation
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
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVideoPanel(!showVideoPanel)}
            >
              <Video className="h-4 w-4 mr-1" />
              {selectedVideos.length > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {selectedVideos.length}
                </Badge>
              ) : (
                "Select Videos"
              )}
              <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showVideoPanel ? "rotate-180" : ""}`} />
            </Button>
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
        </div>

        {/* Limit reached warning */}
        {limitReached && (
          <div className="px-4 py-3 bg-destructive/10 text-destructive text-sm flex items-center gap-2 border-b">
            <AlertCircle className="h-4 w-4" />
            You've reached your monthly limit of 200 queries. Your limit resets at the start of next month.
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
                    {selectedVideos.length > 0
                      ? `Ask questions about the ${selectedVideos.length} selected video${selectedVideos.length > 1 ? "s" : ""}`
                      : "Select videos to ask questions about their content"}
                  </p>
                  {selectedVideos.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowVideoPanel(true)}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Select Videos
                    </Button>
                  )}
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

          {/* Video Selection Panel */}
          {showVideoPanel && (
            <div className="w-80 border-l flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  {videosLocked ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  {videosLocked ? "Videos (Locked)" : "Select Videos"}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowVideoPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {!videosLocked && (
                <div className="p-3 border-b shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search videos..."
                      value={videoSearch}
                      onChange={(e) => setVideoSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              {selectedVideos.length > 0 && (
                <div className="p-2 border-b bg-muted/50 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedVideos.length} selected
                      {videosLocked && " (locked)"}
                    </span>
                    {!videosLocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          setSelectedVideos([]);
                          if (activeThreadId) {
                            updateThreadVideos(activeThreadId, []);
                          }
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-auto">
                <div className="p-2 space-y-1">
                  {loadingVideos ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="p-2">
                        <Skeleton className="h-4 w-3/4 mb-1" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))
                  ) : filteredVideos.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">
                      No videos with transcripts found
                    </p>
                  ) : (
                    filteredVideos.map((video) => (
                      <div
                        key={video.id}
                        className={`flex items-start gap-2 p-2 rounded-md ${
                          videosLocked
                            ? "cursor-default opacity-60"
                            : "hover:bg-muted cursor-pointer"
                        } ${selectedVideos.includes(video.id) ? "bg-muted" : ""}`}
                        onClick={() => toggleVideo(video.id)}
                      >
                        <Checkbox
                          checked={selectedVideos.includes(video.id)}
                          onCheckedChange={() => toggleVideo(video.id)}
                          disabled={videosLocked}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">
                            {video.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {video.source_name}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
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
                  ? "Ask a question about the selected videos..."
                  : "Select videos to start chatting..."
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={sending || !canUseAI || selectedVideos.length === 0}
            />
            <Button
              type="submit"
              disabled={
                !inputMessage.trim() ||
                sending ||
                !canUseAI ||
                selectedVideos.length === 0
              }
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
