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
  fieldDropdownOptions,
  branches,
  userPolicies,
  userDepartments,
  passwordResetTokens,
  vendors,
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
  type Branch,
  type InsertBranch,
  type UserPolicy,
  type InsertUserPolicy,
  type Vendor,
  type InsertVendor,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ilike, or, sql, lt, gt } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersWithDepartments(searchTerm?: string): Promise<Array<User & { departments: Array<{ id: number; name: string }> }>>;
  createUser(user: { name: string; email: string; employeeCode?: string | null; mobileNumber?: string | null; password: string; role: string; departmentId?: number | null }): Promise<User>;
  updateUser(id: string, userData: { name: string; email: string; employeeCode?: string | null; mobileNumber?: string | null; role: string; departmentId?: number | null; password?: string }): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserDepartments(userId: string): Promise<number[]>;
  assignUserToDepartments(userId: string, departmentIds: number[]): Promise<void>;
  
  // Department operations
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, department: Partial<InsertDepartment> & { authorityDocumentPath?: string }): Promise<Department | undefined>;
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
    thisMonthOnTheWay: number;
    thisMonthCompleted: number;
  }>;
  
  getMonthlyStats(departmentId?: number): Promise<Array<{
    month: string;
    onTheWay: number;
    completed: number;
  }>>;
  
  getBranchStats(departmentId?: number): Promise<Array<{
    name: string;
    count: number;
    recentActivity: string;
  }>>;
  
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
  
  // Field Dropdown Options operations
  getFieldDropdownOptions(fieldId: number): Promise<any[]>;
  createFieldDropdownOption(option: { fieldId: number; departmentId: number; optionValue: string; optionLabel: string; sortOrder?: number }): Promise<any>;
  updateFieldDropdownOption(id: number, option: { optionValue?: string; optionLabel?: string; sortOrder?: number }): Promise<any>;
  deleteFieldDropdownOption(id: number): Promise<boolean>;
  
  // Branch operations
  getAllBranches(filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ branches: Branch[]; total: number }>;
  getBranchById(id: number): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: number, branch: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: number): Promise<boolean>;
  updateBranchStatus(id: number, status: string): Promise<Branch | undefined>;
  createBulkBranches(branches: InsertBranch[]): Promise<Branch[]>;
  exportBranches(status?: string): Promise<Branch[]>;
  
  // Vendor operations
  getAllVendors(filters?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vendors: Vendor[]; total: number }>;
  getVendorById(id: number): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: number): Promise<boolean>;
  updateVendorStatus(id: number, isActive: boolean): Promise<Vendor | undefined>;
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

  async createUser(userData: { name: string; email: string; employeeCode?: string | null; mobileNumber?: string | null; password: string; role: string; departmentId?: number | null }): Promise<User> {
    const [user] = await db.insert(users).values({
      name: userData.name,
      email: userData.email,
      employeeCode: userData.employeeCode,
      mobileNumber: userData.mobileNumber,
      password: userData.password,
      role: userData.role as any,
      departmentId: userData.departmentId
    }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, userData: { name: string; email: string; employeeCode?: string | null; mobileNumber?: string | null; role: string; departmentId?: number | null; password?: string }): Promise<User | undefined> {
    const updateData: any = {
      name: userData.name,
      email: userData.email,
      employeeCode: userData.employeeCode,
      mobileNumber: userData.mobileNumber,
      role: userData.role as any,
      departmentId: userData.departmentId,
      updatedAt: new Date()
    };
    
    if (userData.password) {
      updateData.password = userData.password;
    }
    
    const [user] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.length > 0;
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

  async getUserDepartments(userId: string): Promise<number[]> {
    const departments = await db.select({ departmentId: userDepartments.departmentId })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId));
    return departments.map(d => d.departmentId).filter((id): id is number => id !== null);
  }

  async assignUserToDepartments(userId: string, departmentIds: number[]): Promise<void> {
    // Remove existing assignments
    await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
    
    // Add new assignments
    if (departmentIds.length > 0) {
      await db.insert(userDepartments).values(
        departmentIds.map(departmentId => ({ userId, departmentId }))
      );
    }
  }

  async getUsersWithDepartments(searchTerm?: string): Promise<Array<User & { departments: Array<{ id: number; name: string }> }>> {
    // First get all users with their primary department
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      name: users.name,
      employeeCode: users.employeeCode,
      mobileNumber: users.mobileNumber,
      password: users.password,
      role: users.role,
      departmentId: users.departmentId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      primaryDepartmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id));

    // Then get all additional department assignments
    const userDeptAssignments = await db.select({
      userId: userDepartments.userId,
      departmentId: userDepartments.departmentId,
      departmentName: departments.name,
    })
    .from(userDepartments)
    .leftJoin(departments, eq(userDepartments.departmentId, departments.id));

    // Build user map with all departments
    const userMap = new Map();
    
    allUsers.forEach(user => {
      const departmentsList = [];
      
      // Add primary department if it exists
      if (user.departmentId && user.primaryDepartmentName) {
        departmentsList.push({
          id: user.departmentId,
          name: user.primaryDepartmentName
        });
      }
      
      userMap.set(user.id, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        name: user.name,
        employeeCode: user.employeeCode,
        mobileNumber: user.mobileNumber,
        password: user.password,
        role: user.role,
        departmentId: user.departmentId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        departments: departmentsList
      });
    });

    // Add additional department assignments
    userDeptAssignments.forEach(assignment => {
      const user = userMap.get(assignment.userId);
      if (user && assignment.departmentId && assignment.departmentName) {
        // Check if this department is not already added (avoid duplicates with primary dept)
        const existingDept = user.departments.find((d: any) => d.id === assignment.departmentId);
        if (!existingDept) {
          user.departments.push({
            id: assignment.departmentId,
            name: assignment.departmentName
          });
        }
      }
    });

    return Array.from(userMap.values());
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
    return result.length > 0;
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department;
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
        receiverName: couriers.receiverName,
        remarks: couriers.remarks,
        status: couriers.status,
        receivedDate: couriers.receivedDate,
        receivedRemarks: couriers.receivedRemarks,
        podCopyPath: couriers.podCopyPath,
        confirmationToken: couriers.confirmationToken,
        reminderEmailSent: couriers.reminderEmailSent,
        reminderEmailSentAt: couriers.reminderEmailSentAt,
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
          sql`CAST(${couriers.id} AS TEXT) ILIKE ${'%' + filters.search + '%'}`,
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
        receiverName: couriers.receiverName,
        remarks: couriers.remarks,
        status: couriers.status,
        receivedDate: couriers.receivedDate,
        receivedRemarks: couriers.receivedRemarks,
        podCopyPath: couriers.podCopyPath,
        confirmationToken: couriers.confirmationToken,
        reminderEmailSent: couriers.reminderEmailSent,
        reminderEmailSentAt: couriers.reminderEmailSentAt,
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
    return result.length > 0;
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

  // Password reset token operations
  async createPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<void> {
    // Clean up expired tokens for this email first
    await db.delete(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.email, email),
        lt(passwordResetTokens.expiresAt, new Date())
      ));

    // Insert new token
    await db.insert(passwordResetTokens).values({
      email,
      token,
      expiresAt,
      isUsed: false
    });
  }

  async verifyPasswordResetToken(email: string, token: string): Promise<boolean> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.email, email),
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.isUsed, false),
        gt(passwordResetTokens.expiresAt, new Date())
      ))
      .limit(1);

    return !!resetToken;
  }

  async markPasswordResetTokenAsUsed(email: string, token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ isUsed: true })
      .where(and(
        eq(passwordResetTokens.email, email),
        eq(passwordResetTokens.token, token)
      ));
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.email, email))
      .returning({ id: users.id });
    
    return result.length > 0;
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
        emailId: auditLogs.emailId,
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
    sent: number;
    received: number;
    thisMonth: number;
    thisMonthOnTheWay: number;
    thisMonthCompleted: number;
    thisMonthSent: number;
    thisMonthReceived: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build base conditions for on the way couriers
    const onTheWayConditions = [
      eq(couriers.status, 'on_the_way')
    ];
    
    // Build conditions for completed couriers (both completed status and received status)
    const completedConditions = [
      or(
        eq(couriers.status, 'completed'),
        eq(couriers.status, 'received')
      )
    ];

    // Add department filter if specified
    if (departmentId) {
      onTheWayConditions.push(eq(couriers.departmentId, departmentId));
      completedConditions.push(eq(couriers.departmentId, departmentId));
    }

    // Get on the way count
    const [onTheWayResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(and(...onTheWayConditions));
      
    // Get completed count from couriers table
    const [completedResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(and(...completedConditions));

    // Get received couriers count (these are also "completed")
    let receivedConditions = [];
    if (departmentId) {
      receivedConditions.push(eq(receivedCouriers.departmentId, departmentId));
    }

    const [receivedResult] = await db.select({ count: sql`count(*)` })
      .from(receivedCouriers)
      .where(receivedConditions.length > 0 ? and(...receivedConditions) : sql`1=1`);
      
    // Get this month's on the way count
    const [thisMonthOnTheWayResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(
        and(
          ...onTheWayConditions,
          sql`${couriers.createdAt} >= ${startOfMonth.toISOString()}`
        )
      );
      
    // Get this month's completed count
    const [thisMonthCompletedResult] = await db.select({ count: sql`count(*)` })
      .from(couriers)
      .where(
        and(
          ...completedConditions,
          sql`${couriers.createdAt} >= ${startOfMonth.toISOString()}`
        )
      );
      
    // Get this month's received couriers count
    let thisMonthReceivedConditions = [
      sql`${receivedCouriers.receivedDate} >= ${startOfMonth.toISOString()}`
    ];
    if (departmentId) {
      thisMonthReceivedConditions.push(eq(receivedCouriers.departmentId, departmentId));
    }
    
    const [thisMonthReceivedResult] = await db.select({ count: sql`count(*)` })
      .from(receivedCouriers)
      .where(and(...thisMonthReceivedConditions));

    const onTheWayCount = Number(onTheWayResult?.count || 0);
    const completedCount = Number(completedResult?.count || 0);
    const receivedCount = Number(receivedResult?.count || 0);
    const thisMonthOnTheWayCount = Number(thisMonthOnTheWayResult?.count || 0);
    const thisMonthCompletedCount = Number(thisMonthCompletedResult?.count || 0);
    const thisMonthReceivedCount = Number(thisMonthReceivedResult?.count || 0);
    
    // Total completed this month includes both completed couriers and received couriers
    const totalThisMonthCompleted = thisMonthCompletedCount + thisMonthReceivedCount;

    // Total completed includes both completed couriers and received couriers
    const totalCompleted = completedCount + receivedCount;

    return {
      total: onTheWayCount + totalCompleted,
      onTheWay: onTheWayCount,
      completed: totalCompleted,
      sent: completedCount + onTheWayCount, // Sent couriers from main table
      received: receivedCount, // Received couriers from received table
      thisMonth: thisMonthOnTheWayCount + totalThisMonthCompleted,
      thisMonthOnTheWay: thisMonthOnTheWayCount,
      thisMonthCompleted: totalThisMonthCompleted,
      thisMonthSent: thisMonthCompletedCount + thisMonthOnTheWayCount,
      thisMonthReceived: thisMonthReceivedCount,
    };
  }

  async getMonthlyStats(departmentId?: number): Promise<Array<{
    month: string;
    onTheWay: number;
    completed: number;
    sent: number;
    received: number;
  }>> {
    const now = new Date();
    const monthlyData = [];
    
    // Get data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthName = date.toLocaleDateString('en', { month: 'short' });
      
      // Build conditions for the month range
      let onTheWayConditions = [
        eq(couriers.status, 'on_the_way'),
        sql`${couriers.createdAt} >= ${date.toISOString()}`,
        sql`${couriers.createdAt} < ${nextDate.toISOString()}`
      ];
      
      let completedConditions = [
        or(
          eq(couriers.status, 'completed'),
          eq(couriers.status, 'received')
        ),
        sql`${couriers.createdAt} >= ${date.toISOString()}`,
        sql`${couriers.createdAt} < ${nextDate.toISOString()}`
      ];
      
      // Add department filter if specified
      if (departmentId) {
        onTheWayConditions.push(eq(couriers.departmentId, departmentId));
        completedConditions.push(eq(couriers.departmentId, departmentId));
      }
      
      // Get counts for this month
      const [onTheWayResult] = await db.select({ count: sql`count(*)` })
        .from(couriers)
        .where(and(...onTheWayConditions));
        
      const [completedResult] = await db.select({ count: sql`count(*)` })
        .from(couriers)
        .where(and(...completedConditions));
      
      // Also get received couriers for this month
      let receivedConditions = [
        sql`${receivedCouriers.receivedDate} >= ${date.toISOString()}`,
        sql`${receivedCouriers.receivedDate} < ${nextDate.toISOString()}`
      ];
      
      if (departmentId) {
        receivedConditions.push(eq(receivedCouriers.departmentId, departmentId));
      }
      
      const [receivedResult] = await db.select({ count: sql`count(*)` })
        .from(receivedCouriers)
        .where(and(...receivedConditions));
      
      const onTheWayCount = Number(onTheWayResult?.count || 0);
      const completedCount = Number(completedResult?.count || 0);
      const receivedCount = Number(receivedResult?.count || 0);
      const totalCompleted = completedCount + receivedCount;
      
      monthlyData.push({
        month: monthName,
        onTheWay: onTheWayCount,
        completed: totalCompleted,
        sent: completedCount + onTheWayCount, // Sent couriers from main table
        received: receivedCount // Received couriers from received table
      });
    }
    
    return monthlyData;
  }

  async getBranchStats(departmentId?: number): Promise<Array<{
    name: string;
    count: number;
    recentActivity: string;
  }>> {
    // Build base conditions
    let conditions = [
      sql`${couriers.toBranch} IS NOT NULL`,
      sql`${couriers.toBranch} != ''`
    ];
    
    // Add department filter if specified
    if (departmentId) {
      conditions.push(eq(couriers.departmentId, departmentId));
    }
    
    // Get branch statistics
    const branchStats = await db
      .select({
        name: couriers.toBranch,
        count: sql<number>`count(*)`,
        latestDate: sql<Date>`max(${couriers.createdAt})`
      })
      .from(couriers)
      .where(and(...conditions))
      .groupBy(couriers.toBranch)
      .orderBy(sql`count(*) DESC`);
    
    // Also get received courier branches
    let receivedConditions = [
      sql`${receivedCouriers.fromLocation} IS NOT NULL`,
      sql`${receivedCouriers.fromLocation} != ''`
    ];
    
    if (departmentId) {
      receivedConditions.push(eq(receivedCouriers.departmentId, departmentId));
    }
    
    const receivedBranchStats = await db
      .select({
        name: receivedCouriers.fromLocation,
        count: sql<number>`count(*)`,
        latestDate: sql<Date>`max(${receivedCouriers.receivedDate})`
      })
      .from(receivedCouriers)
      .where(and(...receivedConditions))
      .groupBy(receivedCouriers.fromLocation)
      .orderBy(sql`count(*) DESC`);
    
    // Combine and aggregate branch data
    const branchMap = new Map<string, { count: number; latestDate: Date | null }>();
    
    // Add courier branches
    branchStats.forEach(branch => {
      branchMap.set(branch.name!, {
        count: Number(branch.count),
        latestDate: branch.latestDate
      });
    });
    
    // Add received courier branches
    receivedBranchStats.forEach(branch => {
      const existing = branchMap.get(branch.name!);
      if (existing) {
        existing.count += Number(branch.count);
        if (branch.latestDate && (!existing.latestDate || branch.latestDate > existing.latestDate)) {
          existing.latestDate = branch.latestDate;
        }
      } else {
        branchMap.set(branch.name!, {
          count: Number(branch.count),
          latestDate: branch.latestDate
        });
      }
    });
    
    // Convert to final format
    const result = Array.from(branchMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      recentActivity: data.latestDate 
        ? new Date(data.latestDate).toLocaleDateString('en', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })
        : 'No activity'
    }));
    
    // Sort by count descending
    result.sort((a, b) => b.count - a.count);
    
    return result;
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
        status: receivedCouriers.status,
        confirmationToken: receivedCouriers.confirmationToken,
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
          sql`CAST(${receivedCouriers.id} AS TEXT) ILIKE ${'%' + filters.search + '%'}`,
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
    return result.length > 0;
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
    return result.length > 0;
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
    return result.length > 0;
  }

  // Field Dropdown Options methods
  async getFieldDropdownOptions(fieldId: number): Promise<any[]> {
    return await db.select().from(fieldDropdownOptions).where(eq(fieldDropdownOptions.fieldId, fieldId)).orderBy(fieldDropdownOptions.sortOrder);
  }

  async createFieldDropdownOption(option: { fieldId: number; departmentId: number; optionValue: string; optionLabel: string; sortOrder?: number }): Promise<any> {
    const [newOption] = await db.insert(fieldDropdownOptions).values(option).returning();
    return newOption;
  }

  async updateFieldDropdownOption(id: number, option: { optionValue?: string; optionLabel?: string; sortOrder?: number }): Promise<any> {
    const [updatedOption] = await db.update(fieldDropdownOptions)
      .set(option)
      .where(eq(fieldDropdownOptions.id, id))
      .returning();
    return updatedOption;
  }

  async deleteFieldDropdownOption(id: number): Promise<boolean> {
    const result = await db.delete(fieldDropdownOptions).where(eq(fieldDropdownOptions.id, id));
    return result.length > 0;
  }

  // Branch methods
  async getAllBranches(filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    departmentId?: number;
  }): Promise<{ branches: Branch[]; total: number }> {
    let query = db.select().from(branches);
    let countQuery = db.select({ count: sql`count(*)` }).from(branches);

    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(branches.status, filters.status));
    }

    if (filters?.departmentId) {
      conditions.push(eq(branches.departmentId, filters.departmentId));
    }

    if (filters?.search) {
      conditions.push(
        or(
          sql`CAST(${branches.id} AS TEXT) ILIKE ${'%' + filters.search + '%'}`,
          ilike(branches.branchName, `%${filters.search}%`),
          ilike(branches.branchCode, `%${filters.search}%`),
          ilike(branches.branchAddress, `%${filters.search}%`),
          ilike(branches.state, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      query = query.where(whereClause) as any;
      countQuery = countQuery.where(whereClause) as any;
    }

    query = query.orderBy(branches.srNo) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const [branchesResult, countResult] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      branches: branchesResult,
      total: Number((countResult[0] as any).count)
    };
  }

  async getBranchById(id: number): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch;
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    // Auto-assign Sr. No if not provided - use max + 1 for proper sequential numbering
    if (!branch.srNo) {
      const [maxResult] = await db.select({ maxSrNo: sql`COALESCE(MAX(${branches.srNo}), 0)` }).from(branches);
      branch.srNo = (Number(maxResult?.maxSrNo) || 0) + 1;
    }
    
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  async updateBranch(id: number, branch: Partial<InsertBranch>): Promise<Branch | undefined> {
    const [updatedBranch] = await db.update(branches)
      .set({ ...branch, updatedAt: new Date() })
      .where(eq(branches.id, id))
      .returning();
    return updatedBranch;
  }

  async deleteBranch(id: number): Promise<boolean> {
    try {
      const result = await db.delete(branches).where(eq(branches.id, id));
      return (result as any).rowCount > 0 || result.length > 0;
    } catch (error) {
      console.error("Error deleting branch:", error);
      return false;
    }
  }

  async updateBranchStatus(id: number, status: string): Promise<Branch | undefined> {
    const [updatedBranch] = await db.update(branches)
      .set({ status, updatedAt: new Date() })
      .where(eq(branches.id, id))
      .returning();
    return updatedBranch;
  }

  async createBulkBranches(branchList: InsertBranch[]): Promise<Branch[]> {
    // Auto-assign Sr. No for branches without one
    const [maxSrNoResult] = await db.select({ maxSrNo: sql`COALESCE(MAX(${branches.srNo}), 0)` }).from(branches);
    let nextSrNo = (Number(maxSrNoResult?.maxSrNo) || 0) + 1;
    
    const branchesWithSrNo = branchList.map(branch => ({
      ...branch,
      srNo: branch.srNo || nextSrNo++
    }));
    
    const newBranches = await db.insert(branches).values(branchesWithSrNo).returning();
    return newBranches;
  }

  async exportBranches(status?: string): Promise<Branch[]> {
    let query = db.select().from(branches);
    
    if (status) {
      query = query.where(eq(branches.status, status)) as any;
    }
    
    return await (query as any).orderBy(branches.srNo, branches.branchName);
  }

  // Vendor operations
  async getAllVendors(filters?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vendors: Vendor[]; total: number }> {
    let query = db.select().from(vendors);
    let countQuery = db.select({ count: sql`count(*)` }).from(vendors);

    const conditions: any[] = [];

    if (filters?.search) {
      conditions.push(
        or(
          sql`CAST(${vendors.id} AS TEXT) ILIKE ${'%' + filters.search + '%'}`,
          ilike(vendors.vendorName, `%${filters.search}%`),
          ilike(vendors.mobileNumber, `%${filters.search}%`),
          ilike(vendors.email, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      query = query.where(whereClause) as any;
      countQuery = countQuery.where(whereClause) as any;
    }

    query = query.orderBy(vendors.vendorName) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const [vendorsResult, countResult] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      vendors: vendorsResult,
      total: Number((countResult[0] as any).count)
    };
  }

  async getVendorById(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [updatedVendor] = await db.update(vendors)
      .set({ ...vendor, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return updatedVendor;
  }

  async deleteVendor(id: number): Promise<boolean> {
    try {
      const result = await db.delete(vendors).where(eq(vendors.id, id));
      return (result as any).rowCount > 0 || result.length > 0;
    } catch (error) {
      console.error("Error deleting vendor:", error);
      return false;
    }
  }

  async updateVendorStatus(id: number, isActive: boolean): Promise<Vendor | undefined> {
    const [updatedVendor] = await db.update(vendors)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return updatedVendor;
  }

  // User Policy operations
  async getAllUserPolicies(): Promise<UserPolicy[]> {
    const query = db.select({
      id: userPolicies.id,
      departmentId: userPolicies.departmentId,
      tabName: userPolicies.tabName,
      isEnabled: userPolicies.isEnabled,
      createdAt: userPolicies.createdAt,
      updatedAt: userPolicies.updatedAt,
      department: {
        id: departments.id,
        name: departments.name
      }
    })
    .from(userPolicies)
    .leftJoin(departments, eq(userPolicies.departmentId, departments.id));
    
    return await query;
  }

  async getUserPolicy(departmentId: number | null | undefined, tabName: string): Promise<UserPolicy | undefined> {
    if (!departmentId) return undefined;
    const [policy] = await db.select().from(userPolicies)
      .where(and(eq(userPolicies.departmentId, departmentId), eq(userPolicies.tabName, tabName)));
    return policy;
  }

  async createOrUpdateUserPolicy(policy: InsertUserPolicy): Promise<UserPolicy> {
    const existing = await this.getUserPolicy(policy.departmentId, policy.tabName);
    
    if (existing && policy.departmentId !== null && policy.departmentId !== undefined) {
      const [updated] = await db.update(userPolicies)
        .set({ isEnabled: policy.isEnabled, updatedAt: new Date() })
        .where(and(eq(userPolicies.departmentId, policy.departmentId), eq(userPolicies.tabName, policy.tabName)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userPolicies).values(policy).returning();
      return created;
    }
  }

  // Reminder Email operations
  async getOverdueCouriers(): Promise<(Courier & { department?: Department; creator?: User })[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const results = await db
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
        receiverName: couriers.receiverName,
        remarks: couriers.remarks,
        status: couriers.status,
        receivedDate: couriers.receivedDate,
        receivedRemarks: couriers.receivedRemarks,
        podCopyPath: couriers.podCopyPath,
        confirmationToken: couriers.confirmationToken,
        reminderEmailSent: couriers.reminderEmailSent,
        reminderEmailSentAt: couriers.reminderEmailSentAt,
        createdAt: couriers.createdAt,
        updatedAt: couriers.updatedAt,
        department: departments,
        creator: users,
      })
      .from(couriers)
      .leftJoin(departments, eq(couriers.departmentId, departments.id))
      .leftJoin(users, eq(couriers.createdBy, users.id))
      .where(
        and(
          eq(couriers.status, 'on_the_way'),
          eq(couriers.reminderEmailSent, false),
          sql`${couriers.createdAt} <= ${twentyFourHoursAgo.toISOString()}`
        )
      );
    
    return results.map(r => ({
      ...r,
      department: r.department || undefined,
      creator: r.creator || undefined
    }));
  }

  async markReminderEmailSent(courierId: number): Promise<void> {
    await db.update(couriers)
      .set({ reminderEmailSent: true, reminderEmailSentAt: new Date(), updatedAt: new Date() })
      .where(eq(couriers.id, courierId));
  }
}

export const storage = new DatabaseStorage();
