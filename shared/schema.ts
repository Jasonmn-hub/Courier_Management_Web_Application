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
  boolean,
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
  authorityDocumentPath: varchar("authority_document_path", { length: 255 }), // Legacy - kept for backward compatibility
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
  customVendor: varchar("custom_vendor", { length: 100 }),
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

export const receivedCouriers = pgTable("received_couriers", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").references(() => departments.id),
  createdBy: varchar("created_by").references(() => users.id),
  podNumber: varchar("pod_number", { length: 100 }).notNull(),
  receivedDate: date("received_date").notNull(),
  fromLocation: varchar("from_location", { length: 200 }).notNull(), // Branch/Other
  courierVendor: varchar("courier_vendor", { length: 100 }).notNull(),
  customVendor: varchar("custom_vendor", { length: 100 }),
  receiverName: varchar("receiver_name", { length: 100 }),
  emailId: varchar("email_id", { length: 100 }),
  sendEmailNotification: boolean("send_email_notification").default(false),
  customDepartment: varchar("custom_department", { length: 100 }),
  remarks: text("remarks"),
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
  entityId: varchar("entity_id", { length: 100 }),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Branches table for comprehensive branch management
export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  srNo: integer("sr_no"), // Serial number
  branchName: varchar("branch_name", { length: 255 }).notNull(),
  branchCode: varchar("branch_code", { length: 50 }).notNull().unique(),
  branchAddress: text("branch_address").notNull(),
  pincode: varchar("pincode", { length: 10 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  status: varchar("status", { length: 20 }).default('active').notNull(), // 'active' or 'closed'
  departmentId: integer("department_id").references(() => departments.id), // Department-specific branches
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User policies for department-based tab permissions
export const userPolicies = pgTable("user_policies", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").references(() => departments.id),
  tabName: varchar("tab_name", { length: 100 }).notNull(), // 'branches', 'couriers', etc.
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Authority letter templates table - Enhanced for PDF generation
export const authorityLetterTemplates = pgTable('authority_letter_templates', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id').references(() => departments.id),
  templateName: varchar('template_name', { length: 255 }).notNull(),
  templateContent: text('template_content').notNull(), // HTML template for PDF generation
  templateDescription: text('template_description'), // Description for users
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  wordTemplateUrl: varchar('word_template_url', { length: 255 }), // Optional Word template for reference
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Authority letter fields table (for ##field## placeholders)
export const authorityLetterFields = pgTable('authority_letter_fields', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id').references(() => departments.id),
  fieldName: varchar('field_name', { length: 255 }).notNull(),
  fieldLabel: varchar('field_label', { length: 255 }).notNull(),
  fieldType: varchar('field_type', { length: 50 }).default('text').notNull(), // text, number, date
  textTransform: varchar('text_transform', { length: 20 }).default('none'), // none, uppercase, capitalize, toggle
  isRequired: boolean('is_required').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Dropdown field options table for custom fields
export const fieldDropdownOptions = pgTable('field_dropdown_options', {
  id: serial('id').primaryKey(),
  fieldId: integer('field_id').references(() => authorityLetterFields.id, { onDelete: 'cascade' }),
  departmentId: integer('department_id').references(() => departments.id),
  optionValue: varchar('option_value', { length: 255 }).notNull(),
  optionLabel: varchar('option_label', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  couriers: many(couriers),
  receivedCouriers: many(receivedCouriers),
  auditLogs: many(auditLogs),
}));

export const receivedCouriersRelations = relations(receivedCouriers, ({ one }) => ({
  department: one(departments, {
    fields: [receivedCouriers.departmentId],
    references: [departments.id],
  }),
  createdByUser: one(users, {
    fields: [receivedCouriers.createdBy],
    references: [users.id],
  }),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  couriers: many(couriers),
  receivedCouriers: many(receivedCouriers),
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

export const branchesRelations = relations(branches, ({ one, many }) => ({
  department: one(departments, {
    fields: [branches.departmentId],
    references: [departments.id],
  }),
  // Future relations with couriers if needed
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

export const insertReceivedCourierSchema = createInsertSchema(receivedCouriers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuthorityLetterTemplateSchema = createInsertSchema(authorityLetterTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuthorityLetterFieldSchema = createInsertSchema(authorityLetterFields).omit({
  id: true,
  createdAt: true,
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPolicySchema = createInsertSchema(userPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Courier = typeof couriers.$inferSelect;
export type InsertCourier = z.infer<typeof insertCourierSchema>;
export type ReceivedCourier = typeof receivedCouriers.$inferSelect;
export type InsertReceivedCourier = z.infer<typeof insertReceivedCourierSchema>;
export type Field = typeof fields.$inferSelect;
export type InsertField = z.infer<typeof insertFieldSchema>;
export type SmtpSettings = typeof smtpSettings.$inferSelect;
export type InsertSmtpSettings = z.infer<typeof insertSmtpSettingsSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuthorityLetterTemplate = typeof authorityLetterTemplates.$inferSelect;
export type InsertAuthorityLetterTemplate = z.infer<typeof insertAuthorityLetterTemplateSchema>;
export type AuthorityLetterField = typeof authorityLetterFields.$inferSelect;
export type InsertAuthorityLetterField = z.infer<typeof insertAuthorityLetterFieldSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type UserPolicy = typeof userPolicies.$inferSelect;
export type InsertUserPolicy = z.infer<typeof insertUserPolicySchema>;
