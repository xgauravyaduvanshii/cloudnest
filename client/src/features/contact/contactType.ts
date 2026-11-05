export type ContactStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "SOLVED"
  | "REJECTED";

export type ContactRequest = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmitContactPayload = {
  name: string;
  email: string;
  subject?: string;
  message: string;
};

export type SubmitContactResponse = {
  message: string;
  request: ContactRequest;
};

export type MyContactRequestsResponse = { requests: ContactRequest[] };

export type AdminContactRequestsResponse = {
  requests: ContactRequest[];
  pagination: {
    pageSize: number;
    pageNumber: number;
    totalCount: number;
    totalPages: number;
  };
};

export const CONTACT_STATUSES: ContactStatus[] = [
  "NEW",
  "APPROVED",
  "IN_PROGRESS",
  "SOLVED",
  "REJECTED",
];
