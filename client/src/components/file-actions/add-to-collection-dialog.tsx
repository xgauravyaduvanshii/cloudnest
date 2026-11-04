import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddFilesToCollectionMutation,
  useCreateCollectionMutation,
  useListCollectionsQuery,
} from "@/features/collections/collectionsAPI";
import { FileType } from "@/features/files/filesType";

type Props = {
  file: FileType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const AddToCollectionDialog = ({ file, open, onOpenChange }: Props) => {
  const [selected, setSelected] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useListCollectionsQuery(undefined, { skip: !open });
  const [addFiles] = useAddFilesToCollectionMutation();
  const [createCollection] = useCreateCollectionMutation();

  if (!file) return null;
  const collections = data?.collections ?? [];

  const handleAdd = async () => {
    if (!selected && !newName.trim()) {
      toast.error("Choose a collection or name a new one");
      return;
    }
    setBusy(true);
    try {
      let collectionId = selected;
      if (!collectionId && newName.trim()) {
        const created = await createCollection({
          name: newName.trim(),
          fileIds: [file._id],
        }).unwrap();
        collectionId = created.collection._id;
      } else if (collectionId) {
        await addFiles({ collectionId, fileIds: [file._id] }).unwrap();
      }
      toast.success("Added to collection");
      setSelected("");
      setNewName("");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-4" /> Add to collection
          </DialogTitle>
          <DialogDescription className="truncate">{file.originalName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading collections…</p>
        ) : collections.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Existing collection</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name} ({c.fileCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You have no collections yet — create one below.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="new-collection">Or create a new collection</Label>
          <Input
            id="new-collection"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Collection name"
          />
        </div>

        <Button onClick={handleAdd} disabled={busy} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add file
        </Button>
      </DialogContent>
    </Dialog>
  );
};
