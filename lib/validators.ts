import { z } from "zod";

export const RestaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  phone: z.string().max(30, "Phone must be 30 characters or fewer").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});

export const AdminNumberSchema = z.object({
  phone: z.string().min(7, "Valid phone required"),
  role: z.literal("admin").optional().default("admin"),
  is_active: z.boolean().default(true),
});

export const ZoneSchema = z.object({
  zone_name: z.string().min(1, "Zone name required"),
  delivery_fee: z.number().min(0).default(0),
  min_order_amount: z.number().min(0).default(0),
  is_active: z.boolean().default(true),
});

// Bot message templates payload (stored as JSON string in bot_messages.message_text for now).
export const BotMessagesSchema = z.object({
  welcome_message: z.string().default(""),
  menu_help_message: z.string().default(""),
  address_request_message: z.string().default(""),
  delivery_info_message: z.string().default(""),
  out_of_area_message: z.string().default(""),
  order_confirmation_message: z.string().default(""),
  closed_hours_message: z.string().default(""),
});
