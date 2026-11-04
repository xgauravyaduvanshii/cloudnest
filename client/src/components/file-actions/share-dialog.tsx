import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateShareMutation,
  useListSharesForResourceQuery,
  useRevokeShareMutation,
  useUpdateShareMutation,
} from "@/features/shares/sharesAPI";
import type { SharePermission } from "@/features/shares/sharesType";
import { FileType } from "@/features/files/filesType";

type Props = {
  file: FileType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard");
  } catch {
    toast.error("Unable to copy link");
  }
};

export const ShareDialog = ({ file, open, onOpenChange }: Props) => {
  const [permission, setPermission] = useState<SharePermission>("view");
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("0");
  const [maxDownloads, setMaxDownloads] = useState<string>("0");
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useListSharesForResourceQuery(
    { resourceType: "file", resourceId: file?._id ?? "" },
    { skip: !file?._id },
  );
  const [createShare] = useCreateShareMutation();
  const [revokeShare] = useRevokeShareMutation();
  const [updateShare] = useUpdateShareMutation();

  if (!file) return null;
  const shares = data?.shares ?? [];

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const days = Number(expiresInDays);
      const dl = Number(maxDownloads);
      const expiresAt =
        days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const res = await createShare({
        resourceType: "file",
        resourceId: file._id,
        permission,
        password: password.trim() ? password.trim() : null,
        expiresAt,
        maxDownloads: dl > 0 ? dl : null,
      }).unwrap();
      toast.success("Share link created");
      copyToClipboard(res.share.url);
      setPassword("");
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? "Failed to create share");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate">Share “{file.originalName}”</DialogTitle>
          <DialogDescription>
            Create a link with optional password, expiry, and download limits.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Permission</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View only</SelectItem>
                <SelectItem value="download">View + download</SelectItem>
                <SelectItem value="upload">Upload</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="share-password">Password (optional)</Label>
            <Input
              id="share-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for no password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="share-expiry">Expires in days (0 = never)</Label>
            <Input
              id="share-expiry"
              type="number"
              min={0}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="share-max-downloads">Max downloads (0 = unlimited)</Label>
            <Input
              id="share-max-downloads"
              type="number"
              min={0}
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleCreate} disabled={isCreating} className="w-full">
          {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Create link
        </Button>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Existing links</h4>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && shares.length === 0 && (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          )}
          {shares.map((share) => (
            <div
              key={share._id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {share.permission}
                  </Badge>
                  {share.hasPassword && <Badge variant="outline">password</Badge>}
                  {share.expiresAt && new Date(share.expiresAt) < new Date() && (
                    <Badge variant="destructive">expired</Badge>
                  )}
                  {!share.isActive && <Badge variant="outline">disabled</Badge>}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {share.viewCount} views · {share.downloadCount} downloads
                  {share.maxDownloads ? ` / ${share.maxDownloads}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={share.isActive}
                  onCheckedChange={(checked) =>
                    updateShare({ shareId: share._id, isActive: checked })
                  }
                />
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(share.url)}>
                  <Copy className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => revokeShare(share._id)}
                  aria-label="Revoke link"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
