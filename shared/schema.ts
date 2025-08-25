import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  serial,
  text,
  date,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const roleEnum = pgEnum('role', ['admin', 'manager', 'user']);
export const statusEnum = pgEnum('status', ['on_the_way', 'received', 'completed', 'deleted']);
export const fieldTypeEnum = pgEnum('field_type', ['text', 'calendar', 'dropdown']);

// User storage table (required for Replit Auth with extensions)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  name: varchar("name", { length: 100 }),
  password: text("password"),
  role: roleEnum("role").default('user'),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }),
  type: fieldTypeEnum("type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const departmentFields = pgTable("department_fields", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").references(() => departments.id),
  fieldId: integer("field_id").references(() => fields.id),
});

export const couriers = pgTable("couriers", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").references(() => departments.id),
  createdBy: varchar("created_by").references(() => users.id),
  toBranch: varchar("to_branch", { length: 100 }),
  email: varchar("email", { length: 100 }),
  courierDate: date("courier_date"),
  vendor: varchar("vendor", { length: 100 }),
  podNo: varchar("pod_no", { length: 100 }),
  details: text("details"),
  contactDetails: text("contact_details"),
  remarks: text("remarks"),
  status: statusEnum("status").default('on_the_way'),
  receivedDate: date("received_date"),
  receivedRemarks: text("received_remarks"),
  podCopyPath: varchar("pod_copy_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smtpSettings = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  host: varchar("host", { length: 200 }),
  port: integer("port"),
  username: varchar("username", { length: 100 }),
  password: text("password"),
  fromEmail: varchar("from_email", { length: 100 }),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  couriers: many(couriers),
  auditLogs: many(auditLogs),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  couriers: many(couriers),
  departmentFields: many(departmentFields),
}));

export const fieldsRelations = relations(fields, ({ many }) => ({
  departmentFields: many(departmentFields),
}));

export const departmentFieldsRelations = relations(departmentFields, ({ one }) => ({
  department: one(departments, {
    fields: [departmentFields.departmentId],
    references: [departments.id],
  }),
  field: one(fields, {
    fields: [departmentFields.fieldId],
    references: [fields.id],
  }),
}));

export const couriersRelations = relations(couriers, ({ one }) => ({
  department: one(departments, {
    fields: [couriers.departmentId],
    references: [departments.id],
  }),
  creator: one(users, {
    fields: [couriers.createdBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  name: true,
  role: true,
  departmentId: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourierSchema = createInsertSchema(couriers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSmtpSettingsSchema = createInsertSchema(smtpSettings).omit({
  id: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Courier = typeof couriers.$inferSelect;
export type InsertCourier = z.infer<typeof insertCourierSchema>;
export type Field = typeof fields.$inferSelect;
export type InsertField = z.infer<typeof insertFieldSchema>;
export type SmtpSettings = typeof smtpSettings.$inferSelect;
export type InsertSmtpSettings = z.infer<typeof insertSmtpSettingsSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
