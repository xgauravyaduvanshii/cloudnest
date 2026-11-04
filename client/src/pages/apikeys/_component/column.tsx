/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  Copy,
  KeyRound,
  Loader,
  MoreHorizontal,
  ShieldOff,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useDeleteApiKeyMutation,
  useRevokeApiKeyMutation,
  useRotateApiKeyMutation,
} from "@/features/apikeys/apikeysAPI";
import { toast } from "sonner";

export const apiKeysColumns: ColumnDef<any>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span>{row.original?.name}</span>,
  },
  {
    accessorKey: "displayKey",
    header: "Display Key",
    cell: ({ row }) => {
      const displayKey = row.original?.displayKey;
      const maskedKey = displayKey.endsWith("...")
        ? displayKey.replace(/\.\.\.$/, "")
        : displayKey;
      return (
        <div
          className="relative px-2 h-8 border rounded-sm bg-muted overflow-hidden whitespace-nowrap
          max-w-[185px] flex items-center
        "
        >
          <span className="relative z-20">{maskedKey}</span>
          <span
            className="whitespace-nowrap block mt-4 -ml-[0.5px]"
            aria-hidden="true"
          >
            ********************
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "scopes",
    header: "Scopes",
    cell: ({ row }) => {
      const scopes: string[] = row.original?.scopes ?? [];
      if (!scopes.length) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {scopes.map((scope) => (
            <Badge key={scope} variant="secondary" className="font-mono text-[10px]">
              {scope}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const { isRevoked, expiresAt } = row.original ?? {};
      if (isRevoked) {
        return <Badge variant="destructive">Revoked</Badge>;
      }
      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        return <Badge variant="destructive">Expired</Badge>;
      }
      if (expiresAt) {
        return (
          <Badge variant="outline">
            Expires {format(expiresAt, "MMM dd, yyyy")}
          </Badge>
        );
      }
      return <Badge variant="outline">Active</Badge>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => format(row.getValue("createdAt"), "MMM dd, yyyy"),
  },
  {
    accessorKey: "lastUsedAt",
    header: "Last Used",
    cell: ({ row }) => {
      const lastUsedAt = row.original?.lastUsedAt;
      return (
        <span>{lastUsedAt ? format(lastUsedAt, "MMM dd, yyyy") : "Never"}</span>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell row={row} />,
  },
];

// eslint-disable-next-line react-refresh/only-export-components
const ActionsCell = ({ row }: { row: any }) => {
  const apiKeyId = row.original._id;
  const isRevoked = !!row.original?.isRevoked;
  const [deleteApiKey, { isLoading: isDeleting }] = useDeleteApiKeyMutation();
  const [revokeApiKey, { isLoading: isRevoking }] = useRevokeApiKeyMutation();
  const [rotateApiKey, { isLoading: isRotating }] = useRotateApiKeyMutation();
  const [rotatedKey, setRotatedKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleDelete = () => {
    if (!apiKeyId) return;
    deleteApiKey(apiKeyId)
      .unwrap()
      .then(() => {
        toast.success("Apikey deleted successfully");
      })
      .catch((error) => {
        console.log(error);
        toast.error("Failed to deleted apikey");
      });
  };

  const handleRevoke = () => {
    if (!apiKeyId) return;
    revokeApiKey(apiKeyId)
      .unwrap()
      .then(() => toast.success("API key revoked"))
      .catch(() => toast.error("Failed to revoke API key"));
  };

  const handleRotate = () => {
    if (!apiKeyId) return;
    rotateApiKey(apiKeyId)
      .unwrap()
      .then((res) => setRotatedKey(res.key))
      .catch(() => toast.error("Failed to rotate API key"));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rotatedKey);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <DropdownMenu modal>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-44"
          align="end"
          onCloseAutoFocus={(e: { preventDefault: () => void }) => {
            e.preventDefault();
          }}
        >
          {!isRevoked && (
            <DropdownMenuItem
              className="relative !font-medium"
              disabled={isRotating}
              onSelect={(e: Event) => {
                e.preventDefault();
                handleRotate();
              }}
            >
              <KeyRound className="mr-1 h-4 w-4" />
              Rotate
              {isRotating && (
                <Loader className="ml-1 h-4 w-4 absolute right-2 animate-spin" />
              )}
            </DropdownMenuItem>
          )}
          {!isRevoked && (
            <DropdownMenuItem
              className="relative !font-medium"
              disabled={isRevoking}
              onSelect={(e: Event) => {
                e.preventDefault();
                handleRevoke();
              }}
            >
              <ShieldOff className="mr-1 h-4 w-4" />
              Revoke
              {isRevoking && (
                <Loader className="ml-1 h-4 w-4 absolute right-2 animate-spin" />
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="relative !text-red-500 !font-medium"
            disabled={isDeleting}
            onSelect={(e: Event) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4 !text-red-500" />
            Delete
            {isDeleting && (
              <Loader className="ml-1 h-4 w-4 absolute right-2 animate-spin" />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={!!rotatedKey}
        onOpenChange={(open) => {
          if (!open) {
            setRotatedKey("");
            setIsCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rotated API Key</DialogTitle>
            <DialogDescription>
              The previous key has been revoked. Copy this new key now — it will
              not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={rotatedKey}
              readOnly
              className="h-10 font-mono text-sm bg-muted"
            />
            <Button type="button" variant="outline" onClick={handleCopy}>
              {isCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
