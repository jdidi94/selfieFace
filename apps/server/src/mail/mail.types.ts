export type MailSendResult = {
  sent: boolean;
  messageId?: string;
  skippedReason?: string;
};

export type MailTemplateType =
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'
  | 'RESTOCK'
  | 'ORDER_CONFIRMATION'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ADMIN_ORDER_NOTIFY'
  | 'ADMIN_LOW_STOCK'
  | 'MARKETING'
  | 'NEWSLETTER_WELCOME'
  | 'RAW';

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Optional SES ConfigurationSet / tags — reserved for later. */
  replyTo?: string;
  templateType?: MailTemplateType;
  userId?: string | null;
  orderId?: string | null;
};

export type OrderMailContext = {
  orderId?: string;
  userId?: string | null;
  orderNumber: string;
  customerName: string;
  email: string;
  currency: string;
  total: number;
  status: string;
  locale?: string;
  items: { name: string; quantity: number; lineTotal: number }[];
  trackingNote?: string | null;
  storefrontUrl: string;
  orderUrl?: string;
};
