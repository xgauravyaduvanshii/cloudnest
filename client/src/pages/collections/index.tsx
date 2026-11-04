import { useState } from "react";
import { toast } from "sonner";
import { FolderKanban, Loader2, Plus, Trash2 } from "lucide-react";
import PageLayout from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  useGetCollectionQuery,
  useListCollectionsQuery,
} from "@/features/collections/collectionsAPI";

const CreateCollectionDialog = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [createCollection] = useCreateCollectionMutation();

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCollection({ name: name.trim(), description: description.trim() || null }).unwrap();
      toast.success("Collection created");
      setName("");
      setDescription("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New collection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
          <DialogDescription>
            Group files together without moving or copying them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="collection-name">Name</Label>
            <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collection-description">Description (optional)</Label>
            <Input
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={busy || !name.trim()} className="w-full">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CollectionCard = ({
  id,
  name,
  fileCount,
  onDelete,
  onOpen,
}: {
  id: string;
  name: string;
  fileCount: number;
  onDelete: () => void;
  onOpen: () => void;
}) => (
  <Card className="flex flex-col justify-between gap-3 p-4">
    <button className="text-left" onClick={onOpen}>
      <div className="flex items-center gap-2">
        <FolderKanban className="size-4 text-muted-foreground" />
        <span className="font-medium">{name}</span>
      </div>
      <Badge variant="secondary" className="mt-2">
        {fileCount} file{fileCount === 1 ? "" : "s"}
      </Badge>
    </button>
    <div className="flex justify-end">
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete collection">
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
    <span className="sr-only">{id}</span>
  </Card>
);

const CollectionFilesDialog = ({
  collectionId,
  open,
  onOpenChange,
}: {
  collectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data, isLoading } = useGetCollectionQuery(collectionId ?? "", {
    skip: !collectionId,
  });
  const collection = data?.collection;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{collection?.name ?? "Collection"}</DialogTitle>
          <DialogDescription>{collection?.description ?? "Files in this collection"}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && (collection?.files?.length ? collection.files : []).map((f) => (
          <div key={f._id} className="flex items-center justify-between gap-2 rounded-md border p-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.originalName}</p>
              <p className="text-xs text-muted-foreground">{f.formattedSize}</p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <a href={f.url} target="_blank" rel="noreferrer">
                View
              </a>
            </Button>
          </div>
        ))}
        {!isLoading && collection && (collection.files?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">This collection is empty.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Collections = () => {
  const { data, isLoading, isFetching, refetch } = useListCollectionsQuery();
  const [deleteCollection] = useDeleteCollectionMutation();
  const [openId, setOpenId] = useState<string | null>(null);

  const collections = data?.collections ?? [];

  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id).unwrap();
      toast.success("Collection deleted");
      refetch();
    } catch {
      toast.error("Failed to delete collection");
    }
  };

  return (
    <PageLayout
      title="Collections"
      subtitle="Organize files into flexible groups — a file can live in many collections."
      rightAction={<CreateCollectionDialog onCreated={refetch} />}
    >
      {isLoading || isFetching ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <FolderKanban className="size-10 text-muted-foreground" />
          <p className="font-medium">No collections yet</p>
          <p className="text-sm text-muted-foreground">
            Create a collection to group related files together.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <CollectionCard
              key={c._id}
              id={c._id}
              name={c.name}
              fileCount={c.fileCount}
              onDelete={() => handleDelete(c._id)}
              onOpen={() => setOpenId(c._id)}
            />
          ))}
        </div>
      )}

      <CollectionFilesDialog
        collectionId={openId}
        open={!!openId}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </PageLayout>
  );
};

export default Collections;
