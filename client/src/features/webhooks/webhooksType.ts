export interface WebhookDocument {
  _id: string;
  id: string;
  userId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  event: string;
  status: "delivered" | "failed" | "pending";
  responseStatus: number | null;
  createdAt: string;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
}

export interface UpdateWebhookInput {
  id: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export interface CreateWebhookResponse {
  endpoint: WebhookDocument;
  // Revealed exactly once at creation time.
  secret: string;
  message: string;
}

export interface ListWebhooksResponse {
  webhooks: WebhookDocument[];
}

export interface ListWebhookEventsResponse {
  events: string[];
}

export interface ListDeliveriesResponse {
  deliveries: WebhookDelivery[];
}

export interface UpdateWebhookResponse {
  webhook: WebhookDocument;
  message: string;
}

export interface DeleteWebhookResponse {
  message: string;
}
