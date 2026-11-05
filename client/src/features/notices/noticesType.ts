export type NoticeLevel =
  | "welcome"
  | "info"
  | "success"
  | "warning"
  | "maintenance";

export type NoticeAudience = "ALL" | "USER" | "ADMIN";

export type Notice = {
  id: string;
  title: string;
  body: string;
  level: NoticeLevel;
  audience: NoticeAudience;
  isPublished: boolean;
  isDismissable: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicNotice = Pick<
  Notice,
  "id" | "title" | "body" | "level" | "priority"
>;

export type ActiveNoticesResponse = { notices: Notice[] };
export type PublicNoticesResponse = { notices: PublicNotice[] };
export type AdminNoticesResponse = { notices: Notice[] };

export type NoticeUpsertPayload = {
  title: string;
  body: string;
  level: NoticeLevel;
  audience: NoticeAudience;
  isPublished: boolean;
  isDismissable: boolean;
  priority: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

export const NOTICE_LEVELS: NoticeLevel[] = [
  "welcome",
  "info",
  "success",
  "warning",
  "maintenance",
];

export const NOTICE_AUDIENCES: NoticeAudience[] = ["ALL", "USER", "ADMIN"];
