import { useMemo, useState } from "react";
import { FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderType } from "@/features/files/filesType";

export type MovingItem = {
  id: string;
  name: string;
  type: "file" | "folder";
} | null;

type Props = {
  item: MovingItem;
  open: boolean;
  folders: FolderType[];
  currentFolderId?: string | null;
  onOpenChange: (open: boolean) => void;
  onMove: (targetFolderId: string | null) => Promise<void>;
};

const HOME_VALUE = "__home__";

export const MoveItemDialog = ({
  item,
  open,
  folders,
  currentFolderId,
  onOpenChange,
  onMove,
}: Props) => {
  const [target, setTarget] = useState(HOME_VALUE);
  const [isMoving, setIsMoving] = useState(false);

  const targets = useMemo(
    () => folders.filter((folder) => folder.id !== item?.id),
    [folders, item?.id]
  );

  const submit = async () => {
    setIsMoving(true);
    try {
      await onMove(target === HOME_VALUE ? null : target);
      setTarget(HOME_VALUE);
      onOpenChange(false);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {item?.type}</DialogTitle>
          <DialogDescription className="truncate">
            Choose a destination for {item?.name || "this item"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Destination folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={HOME_VALUE}>
                {currentFolderId ? "Home" : "Home (current)"}
              </SelectItem>
              {targets.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={submit} disabled={isMoving}>
            <FolderInput className="size-4" />
            Move
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
