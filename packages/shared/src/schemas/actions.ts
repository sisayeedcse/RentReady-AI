import { z } from "zod";

export const PaymentMethodSchema = z.enum(["cash", "bkash", "nagad", "bank", "other"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const MaintenancePrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type MaintenancePriority = z.infer<typeof MaintenancePrioritySchema>;

const BillingMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "billing_month must be YYYY-MM");

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "date must be YYYY-MM-DD");

const PositiveBdtAmountSchema = z
  .number()
  .finite()
  .positive("amount_bdt must be greater than 0")
  .max(100_000_000, "amount_bdt exceeds maximum allowed limit");

export const RecordRentPaymentActionSchema = z
  .object({
    intent: z.literal("record_rent_payment"),
    amount_bdt: PositiveBdtAmountSchema,
    tenant_name_query: z.string().trim().min(1).max(120).optional(),
    unit_code_query: z.string().trim().min(1).max(40).optional(),
    billing_month: BillingMonthSchema.optional(),
    payment_method: PaymentMethodSchema.default("cash"),
    reference_no: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(500).optional()
  })
  .refine((v) => Boolean(v.tenant_name_query || v.unit_code_query), {
    message: "At least one of tenant_name_query or unit_code_query is required"
  });

export const RecordExpenseActionSchema = z.object({
  intent: z.literal("record_expense"),
  amount_bdt: PositiveBdtAmountSchema,
  category_query: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  property_name_query: z.string().trim().min(1).max(120).optional(),
  unit_code_query: z.string().trim().min(1).max(40).optional(),
  incurred_on: IsoDateSchema.optional()
});

export const GetOutstandingRentActionSchema = z.object({
  intent: z.literal("get_outstanding_rent"),
  tenant_name_query: z.string().trim().min(1).max(120).optional(),
  unit_code_query: z.string().trim().min(1).max(40).optional(),
  property_name_query: z.string().trim().min(1).max(120).optional(),
  billing_month: BillingMonthSchema.optional()
});

export const GetMonthlyCollectionActionSchema = z.object({
  intent: z.literal("get_monthly_collection"),
  billing_month: BillingMonthSchema.optional(),
  property_name_query: z.string().trim().min(1).max(120).optional()
});

export const GetPaymentHistoryActionSchema = z
  .object({
    intent: z.literal("get_payment_history"),
    tenant_name_query: z.string().trim().min(1).max(120).optional(),
    unit_code_query: z.string().trim().min(1).max(40).optional(),
    limit: z.number().int().min(1).max(50).default(10)
  })
  .refine((v) => Boolean(v.tenant_name_query || v.unit_code_query), {
    message: "At least one of tenant_name_query or unit_code_query is required"
  });

export const CreateMaintenanceRequestActionSchema = z.object({
  intent: z.literal("create_maintenance_request"),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(1000),
  unit_code_query: z.string().trim().min(1).max(40).optional(),
  property_name_query: z.string().trim().min(1).max(120).optional(),
  priority: MaintenancePrioritySchema.default("medium")
});

export const PrepareRentReminderActionSchema = z
  .object({
    intent: z.literal("prepare_rent_reminder"),
    tenant_name_query: z.string().trim().min(1).max(120).optional(),
    unit_code_query: z.string().trim().min(1).max(40).optional(),
    billing_month: BillingMonthSchema.optional(),
    language: z.enum(["bn", "en"]).default("bn")
  })
  .refine((v) => Boolean(v.tenant_name_query || v.unit_code_query), {
    message: "At least one of tenant_name_query or unit_code_query is required"
  });

export const GetPropertySummaryActionSchema = z.object({
  intent: z.literal("get_property_summary"),
  property_name_query: z.string().trim().min(1).max(120).optional()
});

export const UnknownIntentActionSchema = z.object({
  intent: z.literal("unknown"),
  reason: z.string().trim().min(1).max(300)
});

export const VoiceActionPayloadSchema = z.union([
  RecordRentPaymentActionSchema,
  RecordExpenseActionSchema,
  GetOutstandingRentActionSchema,
  GetMonthlyCollectionActionSchema,
  GetPaymentHistoryActionSchema,
  CreateMaintenanceRequestActionSchema,
  PrepareRentReminderActionSchema,
  GetPropertySummaryActionSchema,
  UnknownIntentActionSchema
]);

export type VoiceActionPayload = z.infer<typeof VoiceActionPayloadSchema>;

export const WRITE_INTENTS = new Set<VoiceActionPayload["intent"]>([
  "record_rent_payment",
  "record_expense",
  "create_maintenance_request",
  "prepare_rent_reminder"
]);

export function requiresConfirmation(intent: VoiceActionPayload["intent"]): boolean {
  return WRITE_INTENTS.has(intent);
}
