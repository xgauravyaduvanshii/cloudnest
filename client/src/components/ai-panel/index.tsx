import { useState } from "react";
import {
  Sparkles,
  Search,
  Wand2,
  MessageSquare,
  Plus,
  Loader2,
  ShieldCheck,
  Brain,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAiStatusQuery,
  useAiModelsQuery,
  useLazyAiSearchQuery,
  useAssistantPlanMutation,
  useAssistantApplyMutation,
  useChatMutation,
} from "@/features/ai/aiAPI";
import type {
  AssistantAction,
  SearchResultItem,
  AiCitation,
  AiModelOption,
} from "@/features/ai/aiType";
import PromptComposer from "./prompt-composer";

const AiPanel = () => {
  const [open, setOpen] = useState(false);
  const { data: status } = useAiStatusQuery(undefined, { skip: !open });
  const { data: modelsData } = useAiModelsQuery(undefined, { skip: !open });
  const models: AiModelOption[] = modelsData?.models || [];

  return (
    <>
      <Button
        size="lg"
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <span />
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI Assistant
            </SheetTitle>
            <SheetDescription className="text-xs">
              {status?.enabled
                ? `Powered by ${status.provider} (${status.chatModel})`
                : "Smart search, organization and document chat."}
            </SheetDescription>
          </SheetHeader>

          {status && !status.enabled && (
            <div className="px-4 pt-3">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>AI is not configured</AlertTitle>
                <AlertDescription className="text-xs">
                  Search still matches file names. Enable AI on the server to unlock
                  enrichment, semantic ranking, assistant plans and document chat.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <Tabs defaultValue="search" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-4 mt-3 grid grid-cols-3">
              <TabsTrigger value="search" className="gap-1 text-xs">
                <Search className="h-3.5 w-3.5" /> Search
              </TabsTrigger>
              <TabsTrigger value="assistant" className="gap-1 text-xs">
                <Wand2 className="h-3.5 w-3.5" /> Assistant
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1 text-xs">
                <MessageSquare className="h-3.5 w-3.5" /> Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-0 flex-1 overflow-y-auto p-4">
              <SearchTab />
            </TabsContent>
            <TabsContent value="assistant" className="mt-0 flex-1 overflow-y-auto p-4">
              <AssistantTab aiEnabled={!!status?.enabled} models={models} />
            </TabsContent>
            <TabsContent value="chat" className="mt-0 flex-1 overflow-y-auto p-4">
              <ChatTab aiEnabled={!!status?.enabled} models={models} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
};

const SearchTab = () => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search] = useLazyAiSearchQuery();

  const run = async () => {
    if (!term.trim()) return;
    setLoading(true);
    try {
      const res = await search({ query: term.trim(), limit: 25 }).unwrap();
      setResults(res.results);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Search files by meaning or name…"
        />
        <Button onClick={run} disabled={loading || !term.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!loading && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No results yet. Try a keyword.</p>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {results.map((r) => (
          <div key={r.file._id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{r.file.originalName}</span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {r.score.toFixed(2)}
              </Badge>
            </div>
            {r.ai?.summary && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.ai.summary}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {r.match.name && <Badge variant="outline" className="text-[10px]">name</Badge>}
              {r.match.keyword && <Badge variant="outline" className="text-[10px]">keyword</Badge>}
              {r.match.semantic > 0.2 && (
                <Badge variant="outline" className="text-[10px]">semantic {r.match.semantic.toFixed(2)}</Badge>
              )}
              {r.ai?.tags.slice(0, 4).map((t) => (
                <Badge key={t} className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Thinking = ({
  reasoning,
  steps,
}: {
  reasoning?: string | null;
  steps?: string[];
}) => {
  const [open, setOpen] = useState(false);
  const lines = steps?.length ? steps : reasoning ? [reasoning] : [];
  if (!lines.length) return null;
  return (
    <div className="rounded-md border bg-muted/40">
      <button
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <Brain className="h-3.5 w-3.5" />
        Thinking
        <ChevronDown
          className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>
      {open && (
        <ol className="list-decimal space-y-1 px-6 pb-2 text-xs text-muted-foreground">
          {lines.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
};

const AssistantTab = ({
  aiEnabled,
  models,
}: {
  aiEnabled: boolean;
  models: AiModelOption[];
}) => {
  const [plan, setPlan] = useState<AssistantAction[]>([]);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [rationale, setRationale] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [assistantPlan] = useAssistantPlanMutation();
  const [assistantApply] = useAssistantApplyMutation();

  const makePlan = async (payload: { text: string; fileIds: string[]; folderId?: string; model?: string }) => {
    if (!payload.text.trim()) return;
    setPlanning(true);
    setPlan([]);
    setReasoning([]);
    setRationale(null);
    try {
      const res = await assistantPlan({
        instruction: payload.text.trim(),
        model: payload.model,
        fileIds: payload.fileIds.length ? payload.fileIds : undefined,
        folderId: payload.folderId,
      }).unwrap();
      setPlan(res.actions);
      setReasoning(res.reasoning ?? []);
      setRationale(res.rationale ?? null);
      if (!res.actions.length) toast.info("No safe actions proposed");
    } catch {
      toast.error("Could not build a plan");
    } finally {
      setPlanning(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const res = await assistantApply({ actions: plan }).unwrap();
      toast.success(`Applied ${res.applied} action(s), skipped ${res.skipped}`);
      setPlan([]);
      setReasoning([]);
      setRationale(null);
    } catch {
      toast.error("Failed to apply plan");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {!aiEnabled && (
        <p className="text-xs text-muted-foreground">
          The assistant needs AI enabled on the server.
        </p>
      )}
      <PromptComposer
        aiEnabled={aiEnabled}
        models={models}
        loading={planning}
        placeholder="e.g. Group my invoices and receipts into a Finances collection"
        submitLabel="Preview plan"
        onSubmit={makePlan}
      />

      <Thinking steps={reasoning} />
      {rationale && <p className="text-xs text-muted-foreground">{rationale}</p>}

      {plan.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium">Review proposed actions (nothing has changed yet):</p>
            {plan.map((a, i) => (
              <div key={i} className="rounded-md border p-2 text-xs">
                {a.type === "create_collection" ? (
                  <span>
                    <Plus className="mr-1 inline h-3 w-3" />
                    Create collection <strong>{a.name}</strong>
                  </span>
                ) : (
                  <span>
                    Add <strong>{a.fileIds.length}</strong> file(s) to{" "}
                    <strong>{a.collection}</strong>
                  </span>
                )}
              </div>
            ))}
          </div>
          <Button onClick={apply} disabled={applying} className="mt-auto">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span className="ml-2">Confirm &amp; apply</span>
          </Button>
        </>
      )}
    </div>
  );
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
  reasoning?: string | null;
};

const ChatTab = ({
  aiEnabled,
  models,
}: {
  aiEnabled: boolean;
  models: AiModelOption[];
}) => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [chat] = useChatMutation();

  const send = async (payload: { text: string; fileIds: string[]; folderId?: string; model?: string }) => {
    const message = payload.text.trim();
    if (!message) return;
    setTurns((t) => [...t, { role: "user", content: message }]);
    setSending(true);
    try {
      const res = await chat({
        message,
        conversationId,
        model: payload.model,
        fileIds: payload.fileIds.length ? payload.fileIds : undefined,
        folderId: payload.folderId,
      }).unwrap();
      if (res.conversationId) setConversationId(res.conversationId);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: res.answer,
          citations: res.citations,
          reasoning: res.reasoning,
        },
      ]);
    } catch {
      toast.error("Chat request failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {turns.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ask questions about your stored files. Answers cite the files used.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "text-right" : ""}>
            {turn.role === "assistant" && <Thinking reasoning={turn.reasoning} />}
            <div
              className={
                "inline-block mt-1 max-w-[90%] rounded-lg border p-2 text-sm whitespace-pre-wrap " +
                (turn.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")
              }
            >
              {turn.content}
            </div>
            {turn.citations && turn.citations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {turn.citations.map((c) => (
                  <Badge key={c.fileId} variant="outline" className="text-[10px]">
                    {c.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <PromptComposer
        aiEnabled={aiEnabled}
        models={models}
        loading={sending}
        multiline={false}
        placeholder={aiEnabled ? "Ask about your files… (@ to add context)" : "AI chat is disabled"}
        submitLabel="Send"
        onSubmit={send}
      />
    </div>
  );
};

export default AiPanel;
