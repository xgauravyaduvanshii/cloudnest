import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateFolderMutation } from "@/features/files/filesAPI";
import { StorageProvider } from "@/features/files/filesType";

export const CreateFolderDialog = (props: {
  parentId?: string | null;
  provider: StorageProvider;
  accountId?: string | null;
  isGoogleDriveLive?: boolean;
  children?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [createFolder, { isLoading }] = useCreateFolderMutation();

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Folder name is required");
      return;
    }

    try {
      await createFolder({
        name: trimmedName,
        parentId: props.parentId || null,
        provider: props.provider,
        accountId: props.accountId || undefined,
        isGoogleDriveLive: props.isGoogleDriveLive,
      }).unwrap();
      toast.success("Folder created");
      setName("");
      setIsOpen(false);
    } catch {
      toast.error("Failed to create folder");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {props.children || (
          <Button variant="outline">
            <FolderPlus className="size-4" />
            New folder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Create a folder in the current location.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="Folder name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <Button className="w-full" onClick={submit} disabled={isLoading}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
