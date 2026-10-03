import { z } from "zod";
import { revenueSharesSchema } from "./revenue";
const base64 = z
  .string()
  .min(4)
  .max(2_000_000)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
export const envelopeSchema = z.object({ iv: base64, ciphertext: base64 });
export const encryptedDatasetSchema = z.object({
  format: z.literal("datapermit-aes-gcm-v1"),
  records: envelopeSchema,
  publisherKey: envelopeSchema,
});
export const recordSchema = z.object({
  input: z.string().min(1).max(4000),
  expected: z.string().min(1).max(4000),
  category: z.string().min(1).max(100),
});
export const publishSchema = z.object({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(20).max(1000),
  language: z.string().trim().min(2).max(50),
  category: z.enum([
    "Customer support",
    "Language understanding",
    "Agent safety",
    "Image annotation",
  ]),
  price: z
    .string()
    .regex(/^\d{1,6}(\.\d{1,6})?$/)
    .refine((v) => Number(v) > 0),
  durationDays: z.number().int().min(1).max(365),
  quota: z.number().int().min(1).max(100000),
  version: z
    .string()
    .regex(/^\d+(\.\d+){0,2}$/)
    .max(30),
  familyId: z
    .string()
    .regex(/^[-a-z0-9]{5,80}$/)
    .optional(),
  revenueShares: revenueSharesSchema,
  terms: z.string().min(20).max(3000),
  records: z.array(recordSchema).min(3).max(1000),
});
