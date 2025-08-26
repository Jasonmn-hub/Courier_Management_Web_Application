import {
  users,
  departments,
  couriers,
  receivedCouriers,
  fields,
  departmentFields,
  smtpSettings,
  auditLogs,
  authorityLetterTemplates,
  authorityLetterFields,
  type User,
  type UpsertUser,
  type Department,
  type InsertDepartment,
  type Courier,
  type InsertCourier,
  type ReceivedCourier,
  type InsertReceivedCourier,
  type Field,
  type InsertField,
  type SmtpSettings,
  type InsertSmtpSettings,
  type AuditLog,
  type InsertAuditLog,
  type AuthorityLetterTemplate,
  type InsertAuthorityLetterTemplate,
  type AuthorityLetterField,
  type InsertAuthorityLetterField,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: { name: string; email: string; password: string; role: string; departmentId?: number | null }): Promise<User>;
  updateUser(id: string, userData: { name: string; email: string; role: string; departmentId?: number | null }): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Department operations
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, department: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  
  // Courier operations
  getAllCouriers(filters?: {
    status?: string;
    departmentId?: number;
    search?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ couriers: (Courier & { department?: Department; creator?: User })[]; total: number }>;
  getCourierById(id: number): Promise<(Courier & { department?: Department; creator?: User }) | undefined>;
  createCourier(courier: InsertCourier): Promise<Courier>;
  updateCourier(id: number, courier: Partial<InsertCourier>): Promise<Courier | undefined>;
  deleteCourier(id: number): Promise<boolean>;
  restoreCourier(id: number): Promise<boolean>;
  
  // Received Courier operations
  getAllReceivedCouriers(filters?: {
    departmentId?: number;
    search?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<(ReceivedCourier & { department?: Department; creator?: User })[]>;
  getReceivedCourierById(id: number): Promise<ReceivedCourier | undefined>;
  createReceivedCourier(courier: InsertReceivedCourier): Promise<ReceivedCourier>;
  updateReceivedCourier(id: number, courier: Partial<InsertReceivedCourier>): Promise<ReceivedCourier | undefined>;
  deleteReceivedCourier(id: number): Promise<boolean>;
  
  // Field operations
  getAllFields(): Promise<Field[]>;
  createField(field: InsertField): Promise<Field>;
  updateField(id: number, field: Partial<InsertField>): Promise<Field | undefined>;
  deleteField(id: number): Promise<boolean>;
  
  // Department-Field operations
  getDepartmentFields(departmentId: number): Promise<Field[]>;
  updateDepartmentFields(departmentId: number, fieldIds: number[]): Promise<void>;
  
  // SMTP operations
  getSmtpSettings(): Promise<SmtpSettings | undefined>;
  updateSmtpSettings(settings: InsertSmtpSettings): Promise<SmtpSettings>;
  
  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number, offset?: number, startDate?: string, endDate?: string): Promise<{ logs: (AuditLog & { user?: User })[]; total: number }>;
  
  // Statistics
  getCourierStats(departmentId?: number): Promise<{
    total: number;
    onTheWay: number;
    completed: number;
    thisMonth: number;
  }>;
  
  // Authority Letter Template operations
  getAllAuthorityLetterTemplates(departmentId?: number): Promise<AuthorityLetterTemplate[]>;
  getAuthorityLetterTemplate(id: number): Promise<AuthorityLetterTemplate | undefined>;
  createAuthorityLetterTemplate(template: InsertAuthorityLetterTemplate): Promise<AuthorityLetterTemplate>;
  updateAuthorityLetterTemplate(id: number, template: Partial<InsertAuthorityLetterTemplate>): Promise<AuthorityLetterTemplate | undefined>;
  deleteAuthorityLetterTemplate(id: number): Promise<boolean>;
  
  // Authority Letter Field operations
  getAllAuthorityLetterFields(departmentId?: number): Promise<AuthorityLetterField[]>;
  getAuthorityLetterField(id: number): Promise<AuthorityLetterField | undefined>;
  createAuthorityLetterField(field: InsertAuthorityLetterField): Promise<AuthorityLetterField>;
  updateAuthorityLetterField(id: number, field: Partial<InsertAuthorityLetterField>): Promise<AuthorityLetterField | undefined>;
  deleteAuthorityLetterField(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: { name: string; email: string; password: string; role: string; departmentId?: number | null }): Promise<User> {
    const [user] = await db.insert(users).values({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role as any,
      departmentId: userData.departmentId
    }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, userData: { name: string; email: string; role: string; departmentId?: number | null }): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({
        name: userData.name,
        email: userData.email,
        role: userData.role as any,
        departmentId: userData.departmentId,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Department operations
  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(departments.name);
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }

  async updateDepartment(id: number, department: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [updatedDepartment] = await db
      .update(departments)
      .set({ ...department, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return updatedDepartment;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Courier operations
  async getAllCouriers(filters: {
    status?: string;
    departmentId?: number;
    search?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{ couriers: (Courier & { department?: Department; creator?: User })[]; total: number }> {
    let query = db
      .select({
        id: couriers.id,
        departmentId: couriers.departmentId,
        createdBy: couriers.createdBy,
        toBranch: couriers.toBranch,
        email: couriers.email,
        courierDate: couriers.courierDate,
        vendor: couriers.vendor,
        customVendor: couriers.customVendor,
        podNo: couriers.podNo,
        details: couriers.details,
        contactDetails: couriers.contactDetails,
        remarks: couriers.remarks,
        status: couriers.status,
        receivedDate: couriers.receivedDate,
        receivedRemarks: couriers.receivedRemarks,
        podCopyPath: couriers.podCopyPath,
        createdAt: couriers.createdAt,
        updatedAt: couriers.updatedAt,
        department: departments,
        creator: users,
      })
      .from(couriers)
      .leftJoin(departments, eq(couriers.departmentId, departments.id))
      .leftJoin(users, eq(couriers.createdBy, users.id));

    const conditions = [];

    if (filters.status && filters.status !== "") {
      conditions.push(eq(couriers.status, filters.status as any));
    }

    if (filters.departmentId && filters.departmentId !== 0) {
      conditions.push(eq(couriers.departmentId, filters.departmentId));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(couriers.podNo, `%${filters.search}%`),
          ilike(couriers.vendor, `%${filters.search}%`),
          ilike(couriers.toBranch, `%${filters.search}%`),
          ilike(couriers.email, `%${filters.search}%`)
        )
      );
    }

    if (filters.startDate) {
      conditions.push(sql`${couriers.courierDate} >= ${filters.startDate}`);
    }

    if (filters.endDate) {
      conditions.push(sql`${couriers.courierDate} <= ${filters.endDate}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(couriers.createdAt)) as any;

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    const results = await query;
    
    // Get total count
    let countQuery = db.select({ count: sql`count(*)` }).from(couriers);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    const countResult = await countQuery;
    const count = countResult[0]?.count || 0;

    return {
      couriers: results.map(r => ({
        ...r,
        department: r.department || undefined,
        creator: r.creator || undefined
      })),
      total: Number(count),
    };
  }

  async getCourierById(id: number): Promise<(Courier & { department?: Department; creator?: User }) | undefined> {
    const [result] = await db
      .select({
        id: couriers.id,
        departmentId: couriers.departmentId,
        createdBy: couriers.createdBy,
        toBranch: couriers.toBranch,
        email: couriers.email,
        courierDate: couriers.courierDate,
        vendor: couriers.vendor,
        customVendor: couriers.customVendor,
        podNo: couriers.podNo,
        details: couriers.details,
        contactDetails: couriers.contactDetails,
        remarks: couriers.remarks,
        status: couriers.status,
        receivedDate: couriers.receivedDate,
        receivedRemarks: couriers.receivedRemarks,
        podCopyPath: couriers.podCopyPath,
        createdAt: couriers.createdAt,
        updatedAt: couriers.updatedAt,
        department: departments,
        creator: users,
      })
      .from(couriers)
      .leftJoin(departments, eq(couriers.departmentId, departments.id))
      .leftJoin(users, eq(couriers.createdBy, users.id))
      .where(eq(couriers.id, id));
    
    return result ? {
      ...result,
      department: result.department || undefined,
      creator: result.creator || undefined
    } : undefined;
  }

  async createCourier(courier: InsertCourier): Promise<Courier> {
    const [newCourier] = await db.insert(couriers).values(courier).returning();
    return newCourier;
  }

  async updateCourier(id: number, courier: Partial<InsertCourier>): Promise<Courier | undefined> {
    const [updatedCourier] = await db
      .update(couriers)
      .set({ ...courier, updatedAt: new Date() })
      .where(eq(couriers.id, id))
      .returning();
    return updatedCourier;
  }

  async deleteCourier(id: number): Promise<boolean> {
    const [updatedCourier] = await db
      .update(couriers)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(couriers.id, id))
      .returning();
    return !!updatedCourier;
  }

  async restoreCourier(id: number): Promise<boolean> {
    const [updatedCourier] = await db
      .update(couriers)
      .set({ status: 'on_the_way', updatedAt: new Date() })
      .where(eq(couriers.id, id))
      .returning();
    return !!updatedCourier;
  }

  // Field operations
  async getAllFields(): Promise<Field[]> {
    return await db.select().from(fields).orderBy(fields.name);
  }

  async createField(field: InsertField): Promise<Field> {
    const [newField] = await db.insert(fields).values(field).returning();
    return newField;
  }

  async updateField(id: number, field: Partial<InsertField>): Promise<Field | undefined> {
    const [updatedField] = await db
      .update(fields)
      .set({ ...field, updatedAt: new Date() })
      .where(eq(fields.id, id))
      .returning();
    return updatedField;
  }

  async deleteField(id: number): Promise<boolean> {
    const result = await db.delete(fields).where(eq(fields.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // SMTP operations
  async getSmtpSettings(): Promise<SmtpSettings | undefined> {
    const [settings] = await db.select().from(smtpSettings).limit(1);
    return settings;
  }

  async updateSmtpSettings(settings: InsertSmtpSettings): Promise<SmtpSettings> {
    // Delete existing settings and insert new ones
    await db.delete(smtpSettings);
    const [newSettings] = await db.insert(smtpSettings).values(settings).returning();
    return newSettings;
  }

  // Audit log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(limit = 50, offset = 0, startDate?: string, endDate?: string): Promise<{ logs: (AuditLog & { user?: User })[]; total: number }> {
    let query = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        timestamp: auditLogs.timestamp,
        user: users,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id));

    const conditions = [];

    if (startDate) {
      conditions.push(sql`${auditLogs.timestamp} >= ${startDate}`);
    }

    if (endDate) {
      conditions.push(sql`${auditLogs.timestamp} <= ${endDate + ' 23:59:59'}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(auditLogs.timestamp)) as any;

    if (limit) {
      query = query.limit(limit) as any;
    }

    if (offset) {
      query = query.offset(offset) as any;
    }

    const logs = await query;

    // Get count with same filters
    let countQuery = db.select({ count: sql`count(*)` }).from(auditLogs);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    const countResult = await countQuery;
    const count = countResult[0]?.count || 0;

    return {
      logs: logs.map(log => ({
        ...log,
        user: log.user || undefined
      })),
      total: Number(count),
    };
  }

  // Department-Field operations
  async getDepartmentFields(departmentId: number): Promise<Field[]> {
    const result = await db
      .select({
        id: fields.id,
        name: fields.name,
        type: fields.type,
        createdAt: fields.createdAt,
        updatedAt: fields.updatedAt,
      })
      .from(departmentFields)
      .innerJoin(fields, eq(departmentFields.fieldId, fields.id))
      .where(eq(departmentFields.departmentId, departmentId))
      .orderBy(fields.name);
    
    return result;
  }

  async updateDepartmentFields(departmentId: number, fieldIds: number[]): Promise<void> {
    // Remove existing assignments
    await db.delete(departmentFields).where(eq(departmentFields.departmentId, departmentId));
    
    // Add new assignments
    if (fieldIds.length > 0) {
      const values = fieldIds.map(fieldId => ({
        departmentId,
        fieldId
      }));
      await db.insert(departmentFields).values(values);
    }
  }

  // Statistics
  async getCourierStats(departmentId?: number): Promise<{
    total: number;
    onTheWay: number;
    completed: number;
    thisMonth: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build base conditions
    const baseConditions = [
      eq(couriers.status, 'on_the_way')
    ];
    
    const completedConditions = [
      eq(couriers.status, 'completed')
    ];

    // Add department filter if specified
    if (departmentId) {
      baseConditions.push(eq(couriers.departmentId, departmentId));
      completedConditions.push(eq(couriers.departmentId, departmentId));
    }

    const [onTheWayResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(and(...baseConditions));
      
    const [completedResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(and(...completedConditions));
      
    const [thisMonthResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(
        and(
          ...baseConditions,
          sql`${couriers.createdAt} >= ${startOfMonth}`
        )
      );

    const onTheWayCount = Number(onTheWayResult?.count || 0);
    const completedCount = Number(completedResult?.count || 0);
    const thisMonthCount = Number(thisMonthResult?.count || 0);

    return {
      total: onTheWayCount + completedCount,
      onTheWay: onTheWayCount,
      completed: completedCount,
      thisMonth: thisMonthCount,
    };
  }

  // Received Courier operations
  async getAllReceivedCouriers(filters?: {
    departmentId?: number;
    search?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<(ReceivedCourier & { department?: Department; creator?: User })[]> {
    let query = db
      .select({
        id: receivedCouriers.id,
        departmentId: receivedCouriers.departmentId,
        createdBy: receivedCouriers.createdBy,
        podNumber: receivedCouriers.podNumber,
        receivedDate: receivedCouriers.receivedDate,
        fromLocation: receivedCouriers.fromLocation,
        courierVendor: receivedCouriers.courierVendor,
        customVendor: receivedCouriers.customVendor,
        receiverName: receivedCouriers.receiverName,
        emailId: receivedCouriers.emailId,
        sendEmailNotification: receivedCouriers.sendEmailNotification,
        customDepartment: receivedCouriers.customDepartment,
        remarks: receivedCouriers.remarks,
        createdAt: receivedCouriers.createdAt,
        updatedAt: receivedCouriers.updatedAt,
        department: departments,
        creator: users,
      })
      .from(receivedCouriers)
      .leftJoin(departments, eq(receivedCouriers.departmentId, departments.id))
      .leftJoin(users, eq(receivedCouriers.createdBy, users.id));
    
    const conditions = [];
    
    if (filters?.departmentId) {
      conditions.push(eq(receivedCouriers.departmentId, filters.departmentId));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(receivedCouriers.podNumber, `%${filters.search}%`),
          ilike(receivedCouriers.fromLocation, `%${filters.search}%`),
          ilike(receivedCouriers.courierVendor, `%${filters.search}%`)
        )
      );
    }

    if (filters?.startDate) {
      conditions.push(sql`${receivedCouriers.receivedDate} >= ${filters.startDate}`);
    }

    if (filters?.endDate) {
      conditions.push(sql`${receivedCouriers.receivedDate} <= ${filters.endDate}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(receivedCouriers.createdAt)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const results = await query;
    
    return results.map(r => ({
      ...r,
      department: r.department || undefined,
      creator: r.creator || undefined
    }));
  }

  async getReceivedCourierById(id: number): Promise<ReceivedCourier | undefined> {
    const [courier] = await db.select().from(receivedCouriers).where(eq(receivedCouriers.id, id));
    return courier;
  }

  async createReceivedCourier(courier: InsertReceivedCourier): Promise<ReceivedCourier> {
    const [newCourier] = await db.insert(receivedCouriers).values(courier).returning();
    return newCourier;
  }

  async updateReceivedCourier(id: number, courier: Partial<InsertReceivedCourier>): Promise<ReceivedCourier | undefined> {
    const [updatedCourier] = await db.update(receivedCouriers)
      .set({ ...courier, updatedAt: new Date() })
      .where(eq(receivedCouriers.id, id))
      .returning();
    return updatedCourier;
  }

  async deleteReceivedCourier(id: number): Promise<boolean> {
    const result = await db.delete(receivedCouriers).where(eq(receivedCouriers.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Authority Letter Template methods
  async getAllAuthorityLetterTemplates(departmentId?: number): Promise<AuthorityLetterTemplate[]> {
    const query = db.select().from(authorityLetterTemplates);
    
    if (departmentId) {
      return await query.where(eq(authorityLetterTemplates.departmentId, departmentId));
    }
    
    return await query;
  }

  async getAuthorityLetterTemplate(id: number): Promise<AuthorityLetterTemplate | undefined> {
    const [template] = await db.select().from(authorityLetterTemplates).where(eq(authorityLetterTemplates.id, id));
    return template;
  }

  async createAuthorityLetterTemplate(template: InsertAuthorityLetterTemplate): Promise<AuthorityLetterTemplate> {
    const [newTemplate] = await db.insert(authorityLetterTemplates).values(template).returning();
    return newTemplate;
  }

  async updateAuthorityLetterTemplate(id: number, template: Partial<InsertAuthorityLetterTemplate>): Promise<AuthorityLetterTemplate | undefined> {
    const [updatedTemplate] = await db.update(authorityLetterTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(authorityLetterTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteAuthorityLetterTemplate(id: number): Promise<boolean> {
    const result = await db.delete(authorityLetterTemplates).where(eq(authorityLetterTemplates.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Authority Letter Field methods
  async getAllAuthorityLetterFields(departmentId?: number): Promise<AuthorityLetterField[]> {
    const query = db.select().from(authorityLetterFields);
    
    if (departmentId) {
      return await query.where(eq(authorityLetterFields.departmentId, departmentId));
    }
    
    return await query;
  }

  async getAuthorityLetterField(id: number): Promise<AuthorityLetterField | undefined> {
    const [field] = await db.select().from(authorityLetterFields).where(eq(authorityLetterFields.id, id));
    return field;
  }

  async createAuthorityLetterField(field: InsertAuthorityLetterField): Promise<AuthorityLetterField> {
    const [newField] = await db.insert(authorityLetterFields).values(field).returning();
    return newField;
  }

  async updateAuthorityLetterField(id: number, field: Partial<InsertAuthorityLetterField>): Promise<AuthorityLetterField | undefined> {
    const [updatedField] = await db.update(authorityLetterFields)
      .set(field)
      .where(eq(authorityLetterFields.id, id))
      .returning();
    return updatedField;
  }

  async deleteAuthorityLetterField(id: number): Promise<boolean> {
    const result = await db.delete(authorityLetterFields).where(eq(authorityLetterFields.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
