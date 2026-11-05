import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  useAdminNoticesQuery,
  useCreateNoticeMutation,
  useDeleteNoticeMutation,
  useUpdateNoticeMutation,
} from "@/features/notices/noticesAPI";
import {
  NOTICE_AUDIENCES,
  NOTICE_LEVELS,
  type Notice,
  type NoticeAudience,
  type NoticeLevel,
  type NoticeUpsertPayload,
} from "@/features/notices/noticesType";

const emptyForm: NoticeUpsertPayload = {
  title: "",
  body: "",
  level: "info",
  audience: "ALL",
  isPublished: false,
  isDismissable: true,
  priority: 0,
  startsAt: null,
  endsAt: null,
};

const NoticesAdminSection = () => {
  const { data } = useAdminNoticesQuery();
  const [createNotice] = useCreateNoticeMutation();
  const [updateNotice] = useUpdateNoticeMutation();
  const [deleteNotice] = useDeleteNoticeMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState<NoticeUpsertPayload>(emptyForm);

  const notices = data?.notices ?? [];

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (notice: Notice) => {
    setEditing(notice);
    setForm({
      title: notice.title,
      body: notice.body,
      level: notice.level,
      audience: notice.audience,
      isPublished: notice.isPublished,
      isDismissable: notice.isDismissable,
      priority: notice.priority,
      startsAt: notice.startsAt,
      endsAt: notice.endsAt,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    try {
      if (editing) {
        await updateNotice({ id: editing.id, data: form }).unwrap();
        toast.success("Notice updated");
      } else {
        await createNotice(form).unwrap();
        toast.success("Notice created");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to save notice");
    }
  };

  const togglePublish = async (notice: Notice) => {
    try {
      await updateNotice({
        id: notice.id,
        data: { ...formFromNotice(notice), isPublished: !notice.isPublished },
      }).unwrap();
      toast.success(notice.isPublished ? "Unpublished" : "Published");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNotice(id).unwrap();
      toast.success("Notice deleted");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Notices</CardTitle>
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-1 size-4" /> New notice
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No notices yet.
                  </TableCell>
                </TableRow>
              ) : (
                notices.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate font-medium">{n.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{n.level}</Badge>
                    </TableCell>
                    <TableCell>{n.audience}</TableCell>
                    <TableCell>{n.priority}</TableCell>
                    <TableCell>
                      <Switch
                        checked={n.isPublished}
                        onCheckedChange={() => togglePublish(n)}
                        aria-label="Toggle published"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(n)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit notice" : "New notice"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={140}
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={form.level}
                    onValueChange={(v) => setForm((f) => ({ ...f, level: v as NoticeLevel }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTICE_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={form.audience}
                    onValueChange={(v) => setForm((f) => ({ ...f, audience: v as NoticeAudience }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTICE_AUDIENCES.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority (0–9999)</Label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.isPublished}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v }))}
                    />
                    Published
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.isDismissable}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, isDismissable: v }))}
                    />
                    Dismissable
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Starts at (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt ? toLocalInput(form.startsAt) : ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ends at (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt ? toLocalInput(form.endsAt) : ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>{editing ? "Save changes" : "Create notice"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const formFromNotice = (n: Notice): NoticeUpsertPayload => ({
  title: n.title,
  body: n.body,
  level: n.level,
  audience: n.audience,
  isPublished: n.isPublished,
  isDismissable: n.isDismissable,
  priority: n.priority,
  startsAt: n.startsAt,
  endsAt: n.endsAt,
});

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default NoticesAdminSection;
