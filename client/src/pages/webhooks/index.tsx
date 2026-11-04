import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Copy,
  Check,
  History,
  Loader,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import PageLayout from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import {
  useCreateWebhookMutation,
  useDeleteWebhookMutation,
  useListWebhookDeliveriesQuery,
  useListWebhookEventsQuery,
  useListWebhooksQuery,
  useUpdateWebhookMutation,
} from "@/features/webhooks/webhooksAPI";
import type { WebhookDocument } from "@/features/webhooks/webhooksType";
import { toast } from "sonner";

const WebhooksPage = () => {
  const { data: eventsData, isLoading: eventsLoading } =
    useListWebhookEventsQuery();
  const { data: webhooksData, isLoading: webhooksLoading } =
    useListWebhooksQuery();
  const events = eventsData?.events ?? [];
  const webhooks = webhooksData?.webhooks ?? [];

  return (
    <PageLayout
      title="Webhooks"
      subtitle="Receive real-time notifications when events happen in your account."
      rightAction={
        <CreateWebhookDialog events={events} loading={eventsLoading} />
      }
    >
      <div className="w-full h-auto space-y-4">
        {webhooksLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <EmptyState
            title="No webhooks yet"
            description="Create a webhook endpoint to start receiving signed event notifications."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {webhooks.map((wh) => (
              <WebhookCard key={wh._id} webhook={wh} events={events} />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

const WebhookCard = ({
  webhook,
  events,
}: {
  webhook: WebhookDocument;
  events: string[];
}) => {
  const [updateWebhook, { isLoading: isUpdating }] = useUpdateWebhookMutation();
  const [deleteWebhook, { isLoading: isDeleting }] = useDeleteWebhookMutation();
  const [deliveriesOpen, setDeliveriesOpen] = useState(false);

  const handleToggle = (isActive: boolean) => {
    updateWebhook({ id: webhook._id, isActive })
      .unwrap()
      .then(() => toast.success(isActive ? "Webhook enabled" : "Webhook disabled"))
      .catch(() => toast.error("Failed to update webhook"));
  };

  const handleDelete = () => {
    deleteWebhook(webhook._id)
      .unwrap()
      .then(() => toast.success("Webhook deleted"))
      .catch(() => toast.error("Failed to delete webhook"));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-sm font-mono">
            {webhook.url}
          </CardTitle>
          <CardDescription>
            Created {format(webhook.createdAt, "MMM dd, yyyy")}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={webhook.isActive}
            disabled={isUpdating}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {webhook.events.map((e) => (
            <Badge key={e} variant="secondary" className="font-mono text-[10px]">
              {e}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeliveriesOpen(true)}
          >
            <History className="mr-1 h-4 w-4" />
            Deliveries
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="!text-red-500"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Loader className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </CardContent>

      <DeliveriesDialog
        webhook={webhook}
        events={events}
        open={deliveriesOpen}
        onOpenChange={setDeliveriesOpen}
      />
    </Card>
  );
};

const DeliveriesDialog = ({
  webhook,
  open,
  onOpenChange,
}: {
  webhook: WebhookDocument;
  events: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data, isLoading } = useListWebhookDeliveriesQuery(webhook._id, {
    skip: !open,
  });
  const deliveries = data?.deliveries ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recent deliveries</DialogTitle>
          <DialogDescription className="truncate font-mono">
            {webhook.url}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : deliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No deliveries recorded yet.
            </p>
          ) : (
            deliveries.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs">{d.event}</span>
                  <p className="text-xs text-muted-foreground">
                    {format(d.createdAt, "MMM dd, yyyy HH:mm")}
                    {d.responseStatus ? ` · ${d.responseStatus}` : ""}
                  </p>
                </div>
                <Badge
                  variant={d.status === "delivered" ? "outline" : "destructive"}
                >
                  {d.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CreateWebhookDialog = ({
  events,
  loading,
}: {
  events: string[];
  loading: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [secret, setSecret] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [createWebhook, { isLoading }] = useCreateWebhookMutation();

  const canSubmit = useMemo(
    () => /^https?:\/\/.+/.test(url) && selected.length > 0,
    [url, selected],
  );

  const reset = () => {
    setUrl("");
    setSelected([]);
    setSecret("");
    setIsCopied(false);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    createWebhook({ url, events: selected })
      .unwrap()
      .then((res) => {
        setSecret(res.secret);
        toast.success("Webhook created");
      })
      .catch((err) =>
        toast.error(err?.data?.message ?? "Failed to create webhook"),
      );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(reset, 100);
      }}
    >
      <DialogTrigger asChild>
        <Button className="!pr-7">
          <Plus />
          Create Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Subscribe an HTTPS endpoint to account events. Deliveries are signed
            with HMAC-SHA256.
          </DialogDescription>
        </DialogHeader>

        {secret ? (
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Store this signing secret now — it will not be shown again.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Signing Secret</Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="h-10 font-mono text-sm bg-muted"
                />
                <Button variant="outline" onClick={handleCopy}>
                  {isCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                placeholder="https://example.com/hooks/cloudnest"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {events.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selected.includes(event)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? [...prev, event]
                              : prev.filter((s) => s !== event),
                          )
                        }
                      />
                      <span className="font-mono text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              )}
              {selected.length === 0 && !loading && (
                <p className="text-xs text-destructive">
                  Select at least one event.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!canSubmit || isLoading}
              onClick={handleSubmit}
            >
              {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Creating..." : "Create Webhook"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WebhooksPage;
