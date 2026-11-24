import { z } from "zod";
import { isValidIsoCalendarDate } from "../date.js";
import { MaintenancePrioritySchema, PaymentMethodSchema } from "./actions.js";

export const MAX_SAFE_AMOUNT_PAISA = 10_000_000_000; // 100,000,000 BDT

export const UuidSchema = z.string().uuid();

const ValidIsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(isValidIsoCalendarDate, "Invalid calendar date");

const PositivePaisaSchema = z
  .number()
  .int("Amount must be an integer in paisa")
  .positive("Amount must be greater than 0")
  .max(MAX_SAFE_AMOUNT_PAISA, "Amount exceeds maximum allowed limit");

const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "idempotency_key contains disallowed characters");

export const CreatePropertySchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(80).default("Dhaka"),
  notes: z.string().trim().max(500).optional()
});

export const CreateUnitSchema = z.object({
  property_id: UuidSchema,
  unit_code: z.string().trim().min(1).max(40),
  floor_label: z.string().trim().max(40).optional(),
  size_sqft: z.number().int().positive().max(50000).optional(),
  default_rent_paisa: PositivePaisaSchema
});

export const CreateTenantSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().email().max(254).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional()
});

export const CreateTenancySchema = z.object({
  unit_id: UuidSchema,
  tenant_id: UuidSchema,
  start_date: ValidIsoDateSchema,
  monthly_rent_paisa: PositivePaisaSchema,
  rent_due_day: z.number().int().min(1).max(28).default(5)
});

export const GenerateObligationsSchema = z.object({
  billing_month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/, "billing_month must be YYYY-MM or YYYY-MM-01")
    .optional()
});

export const RecordPaymentRequestSchema = z.object({
  tenancy_id: UuidSchema,
  amount_paisa: PositivePaisaSchema,
  payment_method: PaymentMethodSchema.default("cash"),
  obligation_id: UuidSchema.optional(),
  reference_no: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  idempotency_key: IdempotencyKeySchema
});

export const ReversePaymentRequestSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  idempotency_key: IdempotencyKeySchema
});

export const CreateExpenseRequestSchema = z.object({
  property_id: UuidSchema,
  unit_id: UuidSchema.optional(),
  category_name: z.string().trim().min(1).max(80),
  amount_paisa: PositivePaisaSchema,
  incurred_on: ValidIsoDateSchema,
  description: z.string().trim().min(1).max(500),
  idempotency_key: IdempotencyKeySchema
});

export const CreateMaintenanceSchema = z.object({
  property_id: UuidSchema,
  unit_id: UuidSchema.optional(),
  tenant_id: UuidSchema.optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(1000),
  priority: MaintenancePrioritySchema.default("medium")
});

export const SendSmsRequestSchema = z.object({
  tenant_id: UuidSchema,
  template_type: z.enum(["rent_reminder", "payment_receipt"]),
  message_body: z.string().trim().min(5).max(480),
  confirmed: z.literal(true),
  idempotency_key: IdempotencyKeySchema
});
