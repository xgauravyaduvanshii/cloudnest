import { Folder, FolderInput, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderType } from "@/features/files/filesType";

type Props = {
  folder: FolderType;
  onOpen: (folder: FolderType) => void;
  onMove?: (folder: FolderType) => void;
  onDelete?: (folder: FolderType) => void;
};

export const FolderCard = ({ folder, onOpen, onMove, onDelete }: Props) => {
  return (
    <Card
      className="group relative flex h-72 cursor-pointer flex-col justify-between rounded-lg border bg-muted/40 p-4 transition-all hover:border-border/70 hover:shadow-md"
      onClick={() => onOpen(folder)}
    >
      {(onMove || onDelete) && (
        <div
          className="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {onMove && (
            <Button size="icon" variant="secondary" onClick={() => onMove(folder)}>
              <FolderInput className="size-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="secondary" onClick={() => onDelete(folder)}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-1 items-center justify-center">
        <Folder className="size-20 text-primary transition-transform group-hover:scale-105" />
      </div>
      <div>
        <div className="truncate text-sm font-medium">{folder.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">Folder</div>
      </div>
    </Card>
  );
};
