import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  useDeleteContactRequestMutation,
  useGetAdminContactRequestsQuery,
  useUpdateContactStatusMutation,
} from "@/features/contact/contactAPI";
import {
  CONTACT_STATUSES,
  type ContactStatus,
} from "@/features/contact/contactType";

const statusTone: Record<ContactStatus, string> = {
  NEW: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SOLVED: "bg-green-500/15 text-green-300 border-green-500/30",
  REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
};

const ContactRequestsSection = () => {
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "ALL">("ALL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useGetAdminContactRequestsQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    keyword: keyword || undefined,
    pageSize: 20,
    pageNumber: page,
  });
  const [updateStatus] = useUpdateContactStatusMutation();
  const [deleteRequest] = useDeleteContactRequestMutation();

  const requests = data?.requests ?? [];

  const changeStatus = async (id: string, status: ContactStatus) => {
    try {
      await updateStatus({ id, status }).unwrap();
      toast.success("Status updated");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to update status");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRequest(id).unwrap();
      toast.success("Request deleted");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contact requests</CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1 size-4" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search name, email, subject…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as ContactStatus | "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {CONTACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No requests found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {r.subject || "—"}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {r.message}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(v) => changeStatus(r.id, v as ContactStatus)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data?.pagination.pageNumber ?? page} of{" "}
            {data?.pagination.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <Badge variant="outline" className={statusTone.NEW}>
              {data?.pagination.totalCount ?? 0} total
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(data?.pagination.totalPages ?? 1) <= page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactRequestsSection;
