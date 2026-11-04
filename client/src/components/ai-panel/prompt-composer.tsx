import { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Check,
  Folder,
  Layers,
  Loader2,
  Plus,
  Database,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLazyAiSearchQuery } from "@/features/ai/aiAPI";
import type { AiModelOption } from "@/features/ai/aiType";
import { useGetAllFilesQuery } from "@/features/files/filesAPI";
import { useListCollectionsQuery, useLazyGetCollectionQuery } from "@/features/collections/collectionsAPI";
import { useGetStorageAccountsQuery } from "@/features/storageAccounts/storageAccountsAPI";

const NO_MODEL = "__default__";

type SelectedFile = { id: string; name: string };

export type ComposerSubmit = {
  text: string;
  fileIds: string[];
  folderId?: string;
  model?: string;
};

type Props = {
  aiEnabled: boolean;
  models: AiModelOption[];
  placeholder: string;
  submitLabel: string;
  loading?: boolean;
  multiline?: boolean;
  onSubmit: (payload: ComposerSubmit) => void;
};

const PromptComposer = ({
  aiEnabled,
  models,
  placeholder,
  submitLabel,
  loading,
  multiline = true,
  onSubmit,
}: Props) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [folder, setFolder] = useState<SelectedFile | null>(null);
  const [collection, setCollection] = useState<
    (SelectedFile & { fileIds: string[] }) | null
  >(null);
  const [account, setAccount] = useState<SelectedFile | null>(null);
  const [model, setModel] = useState<string>(NO_MODEL);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const [searchFiles] = useLazyAiSearchQuery();
  const [fileHits, setFileHits] = useState<SelectedFile[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: filesData } = useGetAllFilesQuery(
    { provider: "S3", pageSize: 500, pageNumber: 1 },
    { skip: !open },
  );
  const { data: collectionsData } = useListCollectionsQuery(undefined, {
    skip: !open,
  });
  const { data: accountsData } = useGetStorageAccountsQuery(undefined, {
    skip: !open,
  });
  const [getCollection] = useLazyGetCollectionQuery();

  // Debounced file search inside the mention popover.
  useEffect(() => {
    if (!open) return;
    const q = term.trim();
    if (!q) {
      setFileHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchFiles({ query: q, limit: 15 }).unwrap();
        setFileHits(
          res.results.map((r) => ({ id: r.file._id, name: r.file.originalName })),
        );
      } catch {
        setFileHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term, open, searchFiles]);

  const rootFolders = filesData?.folders || [];
  const collections = collectionsData?.collections || [];
  const accounts = (accountsData?.accounts || []).filter(
    (a) => a.status === "ACTIVE",
  );

  const selectedFileIds = useMemo(() => new Set(files.map((f) => f.id)), [files]);

  const toggleFile = (file: SelectedFile) => {
    setFiles((prev) =>
      prev.some((f) => f.id === file.id)
        ? prev.filter((f) => f.id !== file.id)
        : [...prev, file],
    );
  };

  const pickFolder = (f: SelectedFile) => {
    setFolder((prev) => (prev?.id === f.id ? null : f));
  };

  const pickCollection = async (c: { id: string; name: string }) => {
    if (collection?.id === c.id) {
      setCollection(null);
      return;
    }
    try {
      const res = await getCollection(c.id).unwrap();
      const ids = (res.collection.files || []).map((file) => file._id);
      setCollection({ id: c.id, name: c.name, fileIds: ids });
    } catch {
      setCollection({ id: c.id, name: c.name, fileIds: [] });
    }
  };

  const pickAccount = (a: SelectedFile) => {
    setAccount((prev) => (prev?.id === a.id ? null : a));
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    const fileIds = [
      ...files.map((f) => f.id),
      ...(collection ? collection.fileIds : []),
    ];
    let finalText = trimmed;
    if (account) finalText += `${finalText ? "\n" : ""}(storage account: ${account.name})`;
    if (!finalText && !fileIds.length && !folder) return;
    onSubmit({
      text: finalText,
      fileIds: [...new Set(fileIds)],
      folderId: folder?.id,
      model: model === NO_MODEL ? undefined : model,
    });
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "@" && text.length === 0) setOpen(true);
    if (e.key === "Enter" && !e.shiftKey && !multiline) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContext = !!(files.length || folder || collection || account);

  return (
    <div className="rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
      {hasContext && (
        <div className="mb-2 flex flex-wrap gap-1 px-1">
          {files.map((f) => (
            <Badge key={f.id} variant="secondary" className="gap-1 text-[11px]">
              <FileText className="h-3 w-3" />
              <span className="max-w-32 truncate">{f.name}</span>
              <button onClick={() => toggleFile(f)} aria-label="remove">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {folder && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Folder className="h-3 w-3" />
              <span className="max-w-32 truncate">{folder.name}</span>
              <button onClick={() => setFolder(null)} aria-label="remove">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {collection && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Layers className="h-3 w-3" />
              <span className="max-w-32 truncate">{collection.name}</span>
              <button onClick={() => setCollection(null)} aria-label="remove">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {account && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Database className="h-3 w-3" />
              <span className="max-w-32 truncate">{account.name}</span>
              <button onClick={() => setAccount(null)} aria-label="remove">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={!aiEnabled}
        className="min-h-[64px] resize-none border-0 bg-transparent p-2 focus-visible:ring-0"
      />

      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="flex items-center gap-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!aiEnabled}
                aria-label="Attach context"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-2">
              <Input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search files, folders, collections…"
                className="mb-2 h-8"
              />
              <div className="max-h-64 space-y-3 overflow-y-auto">
                <MentionSection title="Files">
                  {searching && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!searching &&
                    fileHits.map((file) => (
                      <MentionRow
                        key={file.id}
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label={file.name}
                        active={selectedFileIds.has(file.id)}
                        onClick={() => toggleFile(file)}
                      />
                    ))}
                  {!searching && !term && (
                    <p className="px-1 text-[11px] text-muted-foreground">
                      Type to search your files by name or meaning.
                    </p>
                  )}
                </MentionSection>

                {rootFolders.length > 0 && (
                  <MentionSection title="Folders">
                    {rootFolders.map((f) => (
                      <MentionRow
                        key={f.id}
                        icon={<Folder className="h-3.5 w-3.5" />}
                        label={f.name}
                        active={folder?.id === f.id}
                        onClick={() => pickFolder({ id: f.id, name: f.name })}
                      />
                    ))}
                  </MentionSection>
                )}

                {collections.length > 0 && (
                  <MentionSection title="Collections">
                    {collections.map((c) => (
                      <MentionRow
                        key={c.id}
                        icon={<Layers className="h-3.5 w-3.5" />}
                        label={c.name}
                        active={collection?.id === c.id}
                        onClick={() => pickCollection({ id: c.id, name: c.name })}
                      />
                    ))}
                  </MentionSection>
                )}

                {accounts.length > 0 && (
                  <MentionSection title="Accounts">
                    {accounts.map((a) => (
                      <MentionRow
                        key={a.id}
                        icon={<Database className="h-3.5 w-3.5" />}
                        label={a.displayName}
                        active={account?.id === a.id}
                        onClick={() => pickAccount({ id: a.id, name: a.displayName })}
                      />
                    ))}
                  </MentionSection>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!aiEnabled}
            aria-label="Mention context"
            onClick={() => setOpen(true)}
          >
            <AtSign className="h-4 w-4" />
          </Button>

          {models.length > 0 && (
            <Select value={model} onValueChange={setModel} disabled={!aiEnabled}>
              <SelectTrigger className="h-8 w-auto max-w-[140px] gap-1 border-0 text-xs">
                <SelectValue placeholder="Default model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MODEL}>Default model</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!aiEnabled || loading || (!text.trim() && !hasContext)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span>{submitLabel}</span>
          )}
        </Button>
      </div>
    </div>
  );
};

const MentionSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </p>
    <div className="space-y-0.5">{children}</div>
  </div>
);

const MentionRow = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
  >
    <span className="text-muted-foreground">{icon}</span>
    <span className="flex-1 truncate">{label}</span>
    {active && <Check className="h-3.5 w-3.5 text-primary" />}
  </button>
);

export default PromptComposer;
