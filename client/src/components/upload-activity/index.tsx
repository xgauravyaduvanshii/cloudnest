/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
  X,
  ChevronDown,
  ChevronUp,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/app/api-client";
import { useAppDispatch } from "@/app/hook";
import {
  useCancelUploadJobMutation,
  useGetUploadJobQuery,
  useListUploadJobsQuery,
  usePauseUploadJobMutation,
  useResumeUploadJobMutation,
  useRetryUploadJobMutation,
} from "@/features/uploadJobs/uploadJobsAPI";
import {
  UploadJob,
  UploadJobStatus,
  isTerminalJob,
} from "@/features/uploadJobs/uploadJobsType";

const formatBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const statusMeta: Record<
  UploadJobStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Queued", className: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "Uploading", className: "bg-blue-500/15 text-blue-500" },
  PAUSED: { label: "Paused", className: "bg-amber-500/15 text-amber-500" },
  COMPLETED: { label: "Completed", className: "bg-green-500/15 text-green-500" },
  PARTIAL_FAILED: {
    label: "Partial",
    className: "bg-orange-500/15 text-orange-500",
  },
  FAILED: { label: "Failed", className: "bg-red-500/15 text-red-500" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

/** Estimate upload speed (bytes/sec) from successive progress samples. */
const useSpeed = (processedBytes: number, active: boolean) => {
  const samples = useRef<{ bytes: number; ts: number }[]>([]);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    const now = Date.now();
    samples.current.push({ bytes: processedBytes, ts: now });
    // Keep a rolling ~6s window.
    samples.current = samples.current.filter((s) => now - s.ts <= 6000);
    if (!active || samples.current.length < 2) {
      setSpeed(0);
      return;
    }
    const first = samples.current[0];
    const last = samples.current[samples.current.length - 1];
    const dt = (last.ts - first.ts) / 1000;
    if (dt <= 0) return;
    setSpeed(Math.max(0, (last.bytes - first.bytes) / dt));
  }, [processedBytes, active]);

  return speed;
};

const JobErrors = ({ jobId }: { jobId: string }) => {
  const { data } = useGetUploadJobQuery(jobId, { skip: false });
  const failed = (data?.data.items || []).filter(
    (item) => item.status === "FAILED" || item.errorMessage,
  );
  if (!failed.length) {
    return (
      <p className="text-xs text-muted-foreground">No file-level errors.</p>
    );
  }
  return (
    <ul className="space-y-1">
      {failed.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-2 text-xs text-red-500"
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">
            <span className="font-medium">{item.originalName}</span>
            {item.errorMessage ? ` — ${item.errorMessage}` : ""}
            {item.status === "FAILED" && item.attemptCount >= item.maxAttempts
              ? " (no retries left)"
              : item.nextRetryAt
                ? " (retrying)"
                : ""}
          </span>
        </li>
      ))}
    </ul>
  );
};

const JobRow = ({ job }: { job: UploadJob }) => {
  const [expanded, setExpanded] = useState(false);
  const { progress, status } = job;
  const done = progress.uploaded + progress.skipped;
  const pct =
    progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const active = status === "PENDING" || status === "PROCESSING";
  const speed = useSpeed(progress.processedBytes, active);

  const [pauseJob] = usePauseUploadJobMutation();
  const [resumeJob] = useResumeUploadJobMutation();
  const [cancelJob] = useCancelUploadJobMutation();
  const [retryJob] = useRetryUploadJobMutation();

  const meta = statusMeta[status];

  return (
    <div className="rounded-lg border border-muted bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Badge variant="secondary" className={meta.className}>
            {active ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : status === "COMPLETED" ? (
              <CircleCheck className="mr-1 size-3" />
            ) : status === "PARTIAL_FAILED" || status === "FAILED" ? (
              <CircleAlert className="mr-1 size-3" />
            ) : null}
            {meta.label}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {progress.total} file{progress.total === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Toggle details"
        >
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      <div className="mt-2">
        <Progress value={pct} className="h-2" />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3">
        <span>Uploaded: {progress.uploaded}</span>
        <span>Skipped: {progress.skipped}</span>
        <span className={progress.failed ? "text-red-500" : ""}>
          Failed: {progress.failed}
        </span>
        <span>Remaining: {progress.remaining}</span>
        <span>
          Bytes: {formatBytes(progress.processedBytes)} /{" "}
          {formatBytes(progress.totalBytes)}
        </span>
        <span>{speed > 0 ? `${formatBytes(speed)}/s` : "—"}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "PENDING" || status === "PROCESSING" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => pauseJob(job.id)}
          >
            <Pause className="size-3.5" /> Pause
          </Button>
        ) : null}
        {status === "PAUSED" ? (
          <Button size="sm" variant="outline" onClick={() => resumeJob(job.id)}>
            <Play className="size-3.5" /> Resume
          </Button>
        ) : null}
        {!isTerminalJob(status) ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => cancelJob(job.id)}
          >
            <X className="size-3.5" /> Cancel
          </Button>
        ) : null}
        {status === "PARTIAL_FAILED" || status === "FAILED" ? (
          <Button size="sm" variant="outline" onClick={() => retryJob(job.id)}>
            <RotateCcw className="size-3.5" /> Retry failed
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 border-t border-muted pt-2">
          <JobErrors jobId={job.id} />
        </div>
      ) : null}
    </div>
  );
};

const UploadActivity = () => {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const prevTerminal = useRef<Record<string, boolean>>({});

  const { data, isSuccess } = useListUploadJobsQuery(
    { pageNumber: 1, pageSize: 20 },
    { pollingInterval: open ? 2000 : 4000 },
  );

  const jobs = useMemo(() => data?.data.jobs ?? [], [data]);
  const activeCount = jobs.filter((j) => !isTerminalJob(j.status)).length;

  // When a job transitions into a terminal state, refresh the file list so newly
  // uploaded assets appear without a manual reload.
  useEffect(() => {
    if (!isSuccess) return;
    let anyCompletedNow = false;
    for (const job of jobs) {
      const isNow = isTerminalJob(job.status);
      if (isNow && !prevTerminal.current[job.id]) anyCompletedNow = true;
      prevTerminal.current[job.id] = isNow;
    }
    if (anyCompletedNow) {
      dispatch(apiClient.util.invalidateTags(["files"]));
    }
  }, [jobs, isSuccess, dispatch]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border border-muted bg-background/95 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between border-b border-muted px-3 py-2">
            <span className="text-sm font-semibold">Upload activity</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Inbox className="size-8" />
                <p className="text-sm">No uploads yet.</p>
              </div>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </div>
        </div>
      ) : null}

      <Button
        onClick={() => setOpen((v) => !v)}
        className="relative h-12 w-12 rounded-full shadow-lg"
        aria-label="Toggle upload activity"
      >
        <UploadCloud className="size-5" />
        {activeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </Button>
    </div>
  );
};

export default UploadActivity;
