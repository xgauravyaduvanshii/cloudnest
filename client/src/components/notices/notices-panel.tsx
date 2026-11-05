import { useEffect, useState } from "react";
import {
  Bell,
  Info,
  PartyPopper,
  Sparkles,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTypedSelector } from "@/app/hook";
import {
  useActiveNoticesQuery,
  useDismissNoticeMutation,
  usePublicNoticesQuery,
} from "@/features/notices/noticesAPI";
import type {
  Notice,
  NoticeLevel,
  PublicNotice,
} from "@/features/notices/noticesType";
import { cn } from "@/lib/utils";

const levelIcon: Record<NoticeLevel, React.ComponentType<{ className?: string }>> = {
  welcome: PartyPopper,
  info: Info,
  success: Sparkles,
  warning: TriangleAlert,
  maintenance: Wrench,
};

const levelTone: Record<NoticeLevel, string> = {
  welcome: "text-red-200 bg-red-500/15 border-red-500/25",
  info: "text-sky-200 bg-sky-500/15 border-sky-500/25",
  success: "text-emerald-200 bg-emerald-500/15 border-emerald-500/25",
  warning: "text-amber-200 bg-amber-500/15 border-amber-500/25",
  maintenance: "text-orange-200 bg-orange-500/15 border-orange-500/25",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const NoticeItem = ({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss?: (id: string) => void;
}) => {
  const Icon = levelIcon[notice.level];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
            levelTone[notice.level],
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-sm font-semibold">{notice.title}</h4>
            {notice.isDismissable && onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                aria-label={`Dismiss ${notice.title}`}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{notice.body}</p>
          <div className="mt-2 text-xs text-muted-foreground/70">
            {formatDate(notice.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NoticesBell = () => {
  const { accessToken, user } = useTypedSelector((state) => state.auth);
  const enabled = Boolean(accessToken && user);
  const { data } = useActiveNoticesQuery(undefined, { skip: !enabled });
  const [dismiss] = useDismissNoticeMutation();
  const [dismissedLocal, setDismissedLocal] = useState<Set<string>>(new Set());

  const notices = (data?.notices ?? []).filter((n) => !dismissedLocal.has(n.id));
  const count = notices.length;

  const handleDismiss = async (id: string) => {
    setDismissedLocal((prev) => new Set(prev).add(id));
    await dismiss(id);
  };

  if (!enabled) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`Notices${count ? ` (${count} new)` : ""}`}
        >
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Notices</h3>
          <Badge variant="secondary">{count}</Badge>
        </div>
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        ) : (
          <div className="max-h-[24rem] space-y-2 overflow-y-auto">
            {notices.map((notice) => (
              <NoticeItem key={notice.id} notice={notice} onDismiss={handleDismiss} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

/**
 * Auto-showing top banner for the highest-priority active welcome/maintenance
 * notice. Renders inside the authenticated app shell.
 */
export const NoticesAnnouncementBar = () => {
  const { accessToken, user } = useTypedSelector((state) => state.auth);
  const enabled = Boolean(accessToken && user);
  const { data } = useActiveNoticesQuery(undefined, { skip: !enabled });
  const [dismiss] = useDismissNoticeMutation();
  const [hidden, setHidden] = useState(false);

  if (!enabled || hidden) return null;

  const top = (data?.notices ?? [])
    .filter((n) => n.level === "welcome" || n.level === "maintenance")
    .sort((a, b) => b.priority - a.priority)[0];

  if (!top) return null;

  const Icon = levelIcon[top.level];

  return (
    <div className={cn("flex items-center gap-3 border-b px-4 py-2 text-sm", levelTone[top.level])}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold">{top.title}:</strong> {top.body}
      </span>
      {top.isDismissable && (
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={async () => {
            setHidden(true);
            await dismiss(top.id);
          }}
          className="shrink-0 opacity-70 transition hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};

const PUBLIC_DISMISS_KEY = "cn_public_notice_dismissed";

const readDismissedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(PUBLIC_DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
};

/**
 * Public (unauthenticated) announcement bar for the marketing/landing pages.
 * Shows the highest-priority published welcome/maintenance notice. Dismissals
 * persist in localStorage since there is no user session to store them against.
 */
export const PublicAnnouncementBar = () => {
  const { data } = usePublicNoticesQuery();
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissedIds);

  const top: PublicNotice | undefined = (data?.notices ?? [])
    .filter((n) => n.level === "welcome" || n.level === "maintenance")
    .filter((n) => !dismissed.has(n.id))
    .sort((a, b) => b.priority - a.priority)[0];

  useEffect(() => {
    try {
      localStorage.setItem(PUBLIC_DISMISS_KEY, JSON.stringify([...dismissed]));
    } catch {
      /* storage unavailable */
    }
  }, [dismissed]);

  if (!top) return null;

  const Icon = levelIcon[top.level];

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-white/10 px-4 py-2 text-sm",
        levelTone[top.level],
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">{top.title}:</strong> {top.body}
      </span>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => setDismissed((prev) => new Set(prev).add(top.id))}
        className="shrink-0 opacity-70 transition hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
};

export default NoticesBell;
