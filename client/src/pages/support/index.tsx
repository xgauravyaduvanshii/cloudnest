import { LifeBuoy, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetMyContactRequestsQuery } from "@/features/contact/contactAPI";
import type { ContactStatus } from "@/features/contact/contactType";

const statusTone: Record<ContactStatus, string> = {
  NEW: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SOLVED: "bg-green-500/15 text-green-300 border-green-500/30",
  REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const StatusBadge = ({ status }: { status: ContactStatus }) => (
  <Badge variant="outline" className={statusTone[status]}>
    {status.replace("_", " ")}
  </Badge>
);

const SupportPage = () => {
  const { data, isLoading, isError, refetch } = useGetMyContactRequestsQuery();
  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Support requests you've submitted through CloudNest, with their
          current status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="size-4" /> Submitted requests
          </CardTitle>
          <CardDescription>
            Track progress from New through Approved, In progress, and Solved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Couldn't load your requests.
              <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
                <RefreshCw className="mr-1 size-4" /> Retry
              </Button>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              You haven't submitted any requests yet. Use the{" "}
              <a href="/contact" className="text-primary underline">
                contact form
              </a>{" "}
              to reach the team.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[180px] truncate font-medium">
                      {r.subject || "—"}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {r.message}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {r.adminNote || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportPage;
