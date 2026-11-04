import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import PageLayout from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  useActivityTimelineQuery,
  useQuotaAlertsQuery,
  useStorageBreakdownQuery,
  useUploadReliabilityQuery,
} from "@/features/activity/activityAPI";

const StatCard = ({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {icon}
    </div>
    <div className="mt-2 text-2xl font-semibold">{value}</div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </Card>
);

const describeAction = (action: string) =>
  action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const Activity = () => {
  const timeline = useActivityTimelineQuery({ pageSize: 25, pageNumber: 1 });
  const reliability = useUploadReliabilityQuery();
  const breakdown = useStorageBreakdownQuery();
  const alerts = useQuotaAlertsQuery();

  const r = reliability.data;
  const alertsList = alerts.data?.alerts ?? [];

  return (
    <PageLayout title="Activity & Insights" subtitle="Your timeline, storage breakdown, and upload reliability.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upload success rate"
          value={r ? (r.successRate === null ? "—" : `${r.successRate}%`) : "—"}
          hint={r ? `${r.uploaded} succeeded · ${r.failed} failed` : undefined}
          icon={<TrendingUp className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Duplicates skipped"
          value={r ? String(r.skipped) : "—"}
          hint={r ? `${r.formattedDuplicateSavings} saved` : undefined}
          icon={<CheckCircle2 className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Largest provider"
          value={
            breakdown.data?.byProvider?.[0]
              ? breakdown.data.byProvider[0].formattedTotalSize
              : "—"
          }
          hint={breakdown.data?.byProvider?.[0]?.provider}
          icon={<ActivityIcon className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Quota warnings"
          value={alerts.isLoading ? "…" : String(alertsList.length)}
          hint={alertsList.length ? "Approaching limits" : "All good"}
          icon={<AlertTriangle className="size-4 text-muted-foreground" />}
        />
      </div>

      {alertsList.length > 0 && (
        <Card className="mt-4 space-y-3 p-4">
          <h3 className="text-sm font-medium">Near quota</h3>
          {alertsList.map((a) => (
            <div key={a.storageAccountId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{a.displayName}</span>
                <span className="text-muted-foreground">
                  {a.formattedUsage} / {a.formattedLimit}
                </span>
              </div>
              <Progress value={Math.min(100, a.usedPercent)} />
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Recent activity</h3>
        </div>
        {timeline.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (timeline.data?.events?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="divide-y">
            {timeline.data!.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{describeAction(e.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.entityType ? `${e.entityType} · ` : ""}
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {e.actorType}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  );
};

export default Activity;
