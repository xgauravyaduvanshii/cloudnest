import { useState } from "react";
import {
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBroadcastEmailMutation,
  useCreateAdminEmailTemplateMutation,
  useDeleteAdminEmailTemplateMutation,
  useGetAdminEmailTemplatesQuery,
  useGetAdminSmtpQuery,
  useSendTemplateTestMutation,
  useSetEmailTemplateEnabledMutation,
  useUpdateAdminEmailTemplateMutation,
} from "@/features/admin/adminAPI";
import type {
  EmailTemplate,
  EmailTemplatePayload,
} from "@/features/admin/adminType";

const BROADCAST_AUDIENCES = ["ALL", "USER", "ADMIN"] as const;
type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

const emptyForm = {
  key: "",
  name: "",
  subject: "",
  htmlBody: "",
  textBody: "",
  description: "",
  isEnabled: true,
};

type FormState = typeof emptyForm;

const EmailTemplatesSection = () => {
  const { data } = useGetAdminEmailTemplatesQuery();
  const { data: smtpData } = useGetAdminSmtpQuery();

  const [createTemplate] = useCreateAdminEmailTemplateMutation();
  const [updateTemplate] = useUpdateAdminEmailTemplateMutation();
  const [setEnabled] = useSetEmailTemplateEnabledMutation();
  const [deleteTemplate] = useDeleteAdminEmailTemplateMutation();
  const [sendTest] = useSendTemplateTestMutation();
  const [broadcast] = useBroadcastEmailMutation();

  const templates = data?.templates ?? [];
  const configs = smtpData?.configs ?? [];
  const activeConfig = configs.find((c) => c.isActive) ?? null;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [testFor, setTestFor] = useState<EmailTemplate | null>(null);
  const [testTo, setTestTo] = useState("");

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bcTemplate, setBcTemplate] = useState("");
  const [bcAudience, setBcAudience] = useState<BroadcastAudience>("ALL");
  const [bcTitle, setBcTitle] = useState("We have an update");
  const [bcBody, setBcBody] = useState("Here is the latest news from CloudNest.");
  const [broadcasting, setBroadcasting] = useState(false);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (t: EmailTemplate) => {
    setEditing(t);
    setForm({
      key: t.key,
      name: t.name,
      subject: t.subject,
      htmlBody: t.htmlBody,
      textBody: t.textBody,
      description: t.description ?? "",
      isEnabled: t.isEnabled,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.subject.trim()) {
      toast.error("Name and subject are required.");
      return;
    }
    if (!form.htmlBody.trim() || !form.textBody.trim()) {
      toast.error("HTML and plain-text bodies are required.");
      return;
    }
    if (!editing && !/^[a-z0-9_]+$/.test(form.key.trim())) {
      toast.error("Key is required (lowercase letters, numbers, underscores).");
      return;
    }

    try {
      if (editing) {
        const payload: Partial<EmailTemplatePayload> = {
          name: form.name.trim(),
          subject: form.subject.trim(),
          htmlBody: form.htmlBody,
          textBody: form.textBody,
          description: form.description.trim() || null,
          isEnabled: form.isEnabled,
        };
        await updateTemplate({ id: editing.id, data: payload }).unwrap();
        toast.success("Template updated");
      } else {
        const payload: EmailTemplatePayload = {
          key: form.key.trim(),
          name: form.name.trim(),
          subject: form.subject.trim(),
          htmlBody: form.htmlBody,
          textBody: form.textBody,
          description: form.description.trim() || null,
          isEnabled: form.isEnabled,
        };
        await createTemplate(payload).unwrap();
        toast.success("Template created");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to save template");
    }
  };

  const toggleEnabled = async (t: EmailTemplate) => {
    try {
      await setEnabled({ id: t.id, isEnabled: !t.isEnabled }).unwrap();
      toast.success(t.isEnabled ? "Template disabled" : "Template enabled");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to update template");
    }
  };

  const remove = async (t: EmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteTemplate(t.id).unwrap();
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete template");
    }
  };

  const runTest = async () => {
    if (!testFor || !testTo.trim()) return;
    try {
      await sendTest({
        id: testFor.id,
        to: testTo.trim(),
        configId: activeConfig?.id,
        vars: {
          userName: "there",
          otpCode: "123456",
          expiresMinutes: 15,
          magicLink: "https://example.com/magic-link?token=sample",
          resetLink: "https://example.com/reset-password?token=sample",
          providerName: "Google Drive",
          errorDetails: "Sample error details",
          promoContent: "Sample promotion",
          status: "approved",
          title: "Sample notice",
          body: "Sample notice body",
          headline: "Welcome to CloudNest",
        },
      }).unwrap();
      toast.success(`Test email queued to ${testTo}`);
      setTestFor(null);
      setTestTo("");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to send test email");
    }
  };

  const runBroadcast = async () => {
    if (!bcTemplate) {
      toast.error("Choose a template to broadcast.");
      return;
    }
    setBroadcasting(true);
    try {
      const res = await broadcast({
        templateKey: bcTemplate,
        audience: bcAudience,
        vars: { title: bcTitle, body: bcBody, headline: bcTitle, promoContent: bcBody },
      }).unwrap();
      toast.success(`Broadcast complete — ${res.sent}/${res.total} sent`);
      setBroadcastOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.message || "Broadcast failed");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Email templates</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBroadcastOpen(true)}>
            <Megaphone className="mr-1 size-4" /> Broadcast
          </Button>
          <Button size="sm" onClick={startCreate}>
            <Plus className="mr-1 size-4" /> New template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Templates power every transactional and marketing email. Edit the
          subject and bodies below; <code>{"{{variable}}"}</code> tokens are
          replaced when the email is rendered. Disabling a template stops it
          from being sent.
        </p>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No templates yet.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">{t.name}</div>
                      {t.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {t.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.key}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <span className="truncate text-sm">{t.subject}</span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={t.isEnabled}
                        onCheckedChange={() => toggleEnabled(t)}
                        aria-label="Toggle enabled"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTestFor(t);
                            setTestTo("");
                          }}
                          aria-label="Send test"
                        >
                          <Send className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create / edit dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    disabled={!!editing}
                    placeholder="welcome"
                  />
                  {editing && (
                    <p className="text-xs text-muted-foreground">Key cannot be changed.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Welcome email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Welcome to CloudNest, {{userName}}"
                />
              </div>
              <div className="space-y-2">
                <Label>HTML body</Label>
                <Textarea
                  rows={8}
                  value={form.htmlBody}
                  onChange={(e) => setForm((f) => ({ ...f, htmlBody: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Plain-text body</Label>
                <Textarea
                  rows={4}
                  value={form.textBody}
                  onChange={(e) => setForm((f) => ({ ...f, textBody: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              {editing && editing.variables.length > 0 && (
                <div className="space-y-1">
                  <Label>Available variables</Label>
                  <div className="flex flex-wrap gap-1">
                    {editing.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-enabled"
                  checked={form.isEnabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))}
                />
                <Label htmlFor="tpl-enabled">Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>
                {editing ? "Save changes" : "Create template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send test dialog */}
        <Dialog open={!!testFor} onOpenChange={(o) => !o && setTestFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send test: {testFor?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Input
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {activeConfig
                  ? `Sending via active configuration "${activeConfig.name}". Sample merge values are used.`
                  : "No active SMTP configuration — the server environment fallback will be used. Sample merge values are used."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestFor(null)}>
                Cancel
              </Button>
              <Button onClick={runTest} disabled={!testTo.trim()}>
                <Send className="mr-1 size-4" /> Send test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Broadcast dialog */}
        <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Broadcast email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={bcTemplate} onValueChange={setBcTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter((t) => t.isEnabled)
                      .map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={bcAudience}
                  onValueChange={(v) => setBcAudience(v as BroadcastAudience)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BROADCAST_AUDIENCES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title / headline</Label>
                <Input value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Message body</Label>
                <Textarea rows={3} value={bcBody} onChange={(e) => setBcBody(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Delivered to verified recipients in batches. This can send a
                large number of emails.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBroadcastOpen(false)}>
                Cancel
              </Button>
              <Button onClick={runBroadcast} disabled={broadcasting || !bcTemplate}>
                <Megaphone className="mr-1 size-4" />
                {broadcasting ? "Broadcasting..." : "Broadcast"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EmailTemplatesSection;
