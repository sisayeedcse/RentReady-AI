import { z } from "zod";
import { MaintenancePrioritySchema, PaymentMethodSchema } from "./actions.js";

export const CreatePropertySchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(80).default("Dhaka"),
  notes: z.string().trim().max(500).optional()
});

export const CreateUnitSchema = z.object({
  property_id: z.string().uuid(),
  unit_code: z.string().trim().min(1).max(40),
  floor_label: z.string().trim().max(40).optional(),
  size_sqft: z.number().int().positive().max(50000).optional(),
  default_rent_paisa: z.number().int().positive()
});

export const CreateTenantSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional()
});

export const CreateTenancySchema = z.object({
  unit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthly_rent_paisa: z.number().int().positive(),
  rent_due_day: z.number().int().min(1).max(28).default(5)
});

export const RecordPaymentRequestSchema = z.object({
  tenancy_id: z.string().uuid(),
  amount_paisa: z.number().int().positive(),
  payment_method: PaymentMethodSchema.default("cash"),
  obligation_id: z.string().uuid().optional(),
  reference_no: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  idempotency_key: z.string().trim().min(8).max(128)
});

export const ReversePaymentRequestSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  idempotency_key: z.string().trim().min(8).max(128)
});

export const CreateExpenseRequestSchema = z.object({
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  category_name: z.string().trim().min(1).max(80),
  amount_paisa: z.number().int().positive(),
  incurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(500),
  idempotency_key: z.string().trim().min(8).max(128)
});

export const CreateMaintenanceSchema = z.object({
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(1000),
  priority: MaintenancePrioritySchema.default("medium")
});

export const SendSmsRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  template_type: z.enum(["rent_reminder", "payment_receipt"]),
  message_body: z.string().trim().min(5).max(480),
  confirmed: z.literal(true),
  idempotency_key: z.string().trim().min(8).max(128)
});
