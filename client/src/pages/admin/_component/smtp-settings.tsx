import { useEffect, useState } from "react";
import { Mail, Plus, Power, Save, Server, Trash2, Zap } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useActivateAdminSmtpMutation,
  useCreateAdminSmtpMutation,
  useDeleteAdminSmtpMutation,
  useGetAdminEmailTemplatesQuery,
  useGetAdminSmtpQuery,
  useSmtpTestSendMutation,
  useTestAdminSmtpConnectionMutation,
  useUpdateAdminSmtpMutation,
} from "@/features/admin/adminAPI";
import type { SmtpConfig, SmtpConfigPayload } from "@/features/admin/adminType";

const emptyForm = {
  name: "",
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromName: "CloudNest",
  fromAddress: "",
  replyTo: "",
};

type FormState = typeof emptyForm;

const SmtpSettingsSection = () => {
  const { data } = useGetAdminSmtpQuery();
  const { data: templatesData } = useGetAdminEmailTemplatesQuery();

  const [createConfig] = useCreateAdminSmtpMutation();
  const [updateConfig] = useUpdateAdminSmtpMutation();
  const [deleteConfig] = useDeleteAdminSmtpMutation();
  const [activateConfig] = useActivateAdminSmtpMutation();
  const [testConnection] = useTestAdminSmtpConnectionMutation();
  const [testSend] = useSmtpTestSendMutation();

  const configs = data?.configs ?? [];
  const templates = templatesData?.templates ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmtpConfig | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [testFor, setTestFor] = useState<SmtpConfig | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testTemplate, setTestTemplate] = useState("");

  useEffect(() => {
    if (!testTemplate && templates.length) setTestTemplate(templates[0].key);
  }, [templates, testTemplate]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (config: SmtpConfig) => {
    setEditing(config);
    setForm({
      name: config.name,
      host: config.host,
      port: config.port,
      secure: config.secure,
      username: config.username || "",
      password: "", // blank => keep stored password
      fromName: config.fromName || "",
      fromAddress: config.fromAddress,
      replyTo: config.replyTo || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.fromAddress.trim()) {
      toast.error("Name, host, and from address are required.");
      return;
    }
    const payload: SmtpConfigPayload = {
      name: form.name.trim(),
      host: form.host.trim(),
      port: Number(form.port) || 587,
      secure: form.secure,
      username: form.username.trim() || null,
      fromName: form.fromName.trim() || null,
      fromAddress: form.fromAddress.trim(),
      replyTo: form.replyTo.trim() || null,
    };
    // Only send a password when the admin typed one (blank keeps the stored value).
    if (form.password.trim()) payload.password = form.password.trim();

    try {
      if (editing) {
        await updateConfig({ id: editing.id, ...payload }).unwrap();
        toast.success("Configuration updated");
      } else {
        await createConfig(payload).unwrap();
        toast.success("Configuration created");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to save configuration");
    }
  };

  const activate = async (config: SmtpConfig) => {
    try {
      await activateConfig(config.id).unwrap();
      toast.success(`${config.name} is now active`);
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to activate");
    }
  };

  const runConnectionTest = async (config: SmtpConfig) => {
    try {
      await testConnection(config.id).unwrap();
      toast.success("Connection verified");
    } catch (e: any) {
      toast.error(e?.data?.message || "Connection failed");
    }
  };

  const remove = async (config: SmtpConfig) => {
    if (!window.confirm(`Delete SMTP configuration "${config.name}"?`)) return;
    try {
      await deleteConfig(config.id).unwrap();
      toast.success("Configuration deleted");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete");
    }
  };

  const sendTest = async () => {
    if (!testFor || !testTo.trim() || !testTemplate) return;
    try {
      await testSend({
        to: testTo.trim(),
        templateKey: testTemplate,
        configId: testFor.id,
        vars: { userName: "there", otpCode: "123456", expiresMinutes: 15 },
      }).unwrap();
      toast.success(`Test email queued to ${testTo}`);
      setTestFor(null);
      setTestTo("");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to send test email");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="size-4" /> SMTP configurations
        </CardTitle>
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-1 size-4" /> Add configuration
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          The active configuration is used for all outbound email. If none is
          active, the server falls back to environment SMTP settings. Passwords
          are encrypted at rest and never returned to the browser.
        </p>

        {configs.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No SMTP configurations yet. Add one to start sending email.
          </div>
        ) : (
          configs.map((config) => (
            <div
              key={config.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{config.name}</span>
                  {config.isActive && (
                    <Badge variant="secondary">Active</Badge>
                  )}
                  {config.hasPassword && (
                    <Badge variant="outline">Has password</Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {config.host}:{config.port}
                  {config.secure ? " (TLS/SSL)" : " (STARTTLS)"} — from{" "}
                  {config.fromAddress}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!config.isActive && (
                  <Button size="sm" variant="outline" onClick={() => activate(config)}>
                    <Power className="size-4" /> Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runConnectionTest(config)}
                >
                  <Zap className="size-4" /> Test
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTestFor(config);
                    setTestTo("");
                  }}
                >
                  <Mail className="size-4" /> Send test
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(config)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(config)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}

        {/* Create / edit dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit configuration" : "New configuration"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Primary SMTP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From address</Label>
                  <Input
                    value={form.fromAddress}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fromAddress: e.target.value }))
                    }
                    placeholder="no-reply@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, port: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="smtp-secure"
                  checked={form.secure}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, secure: v }))}
                />
                <Label htmlFor="smtp-secure">Secure (SMTPS / implicit TLS, usually port 465)</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editing?.hasPassword ? "Leave blank to keep current" : "SMTP password"}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From name</Label>
                  <Input
                    value={form.fromName}
                    onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-to (optional)</Label>
                  <Input
                    value={form.replyTo}
                    onChange={(e) => setForm((f) => ({ ...f, replyTo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>
                <Save className="mr-1 size-4" /> {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send test dialog */}
        <Dialog open={!!testFor} onOpenChange={(o) => !o && setTestFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send test email via {testFor?.name}</DialogTitle>
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
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={testTemplate} onValueChange={setTestTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Sample merge values are used so the test renders immediately.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestFor(null)}>
                Cancel
              </Button>
              <Button onClick={sendTest} disabled={!testTo.trim()}>
                <Mail className="mr-1 size-4" /> Send test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SmtpSettingsSection;
