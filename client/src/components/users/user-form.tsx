import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  employeeCode: z.string().optional(),
  mobileNumber: z.string().optional(),
  role: z.enum(["admin", "sub_admin", "manager", "user"], {
    required_error: "Role is required",
  }),
  departmentId: z.string().optional(),
  password: z.string().min(1, "Password is required"),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  employeeCode: z.string().optional(),
  mobileNumber: z.string().optional(),
  role: z.enum(["admin", "sub_admin", "manager", "user"], {
    required_error: "Role is required",
  }),
  departmentId: z.string().optional(),
  password: z.string().optional(),
});

interface UserFormProps {
  user?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserForm({ user, onClose, onSuccess }: UserFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [duplicateDialog, setDuplicateDialog] = useState<{
    isOpen: boolean;
    duplicateFields: Array<{ field: string; value: string; displayName: string }>;
  }>({
    isOpen: false,
    duplicateFields: []
  });

  const form = useForm({
    resolver: zodResolver(user ? updateUserSchema : createUserSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      employeeCode: user?.employeeCode || "",
      mobileNumber: user?.mobileNumber || "",
      role: user?.role || "user",
      departmentId: user?.departmentId?.toString() || "",
      password: "",
      resetPassword: false,
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        departmentId: data.departmentId && data.departmentId !== "none" ? parseInt(data.departmentId) : null,
      };

      // Remove password field if empty for existing users
      if (user && !data.password) {
        delete payload.password;
      }

      if (user) {
        return await apiRequest('PUT', `/api/users/${user.id}`, payload);
      } else {
        return await apiRequest('POST', '/api/users', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      onSuccess();
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }

      // Handle field-specific validation errors (especially duplicates)
      if (error?.response?.data?.field && error?.response?.data?.message) {
        const fieldName = error.response.data.field;
        const message = error.response.data.message;
        const value = error.response.data.value || '';
        
        // Check if this is a duplicate field error
        const isDuplicateError = message.toLowerCase().includes('already exists');
        
        if (isDuplicateError && (fieldName === 'email' || fieldName === 'employeeCode' || fieldName === 'mobileNumber')) {
          // Set the field error (red message below field)
          if (fieldName === 'email') {
            form.setError('email', { message });
          } else if (fieldName === 'employeeCode') {
            form.setError('employeeCode', { message });
          } else if (fieldName === 'mobileNumber') {
            form.setError('mobileNumber', { message });
          }

          // Also show popup for duplicate fields
          const displayName = fieldName === 'employeeCode' ? 'Employee Code' : 
                              fieldName === 'mobileNumber' ? 'Mobile Number' : 
                              'Email Address';
          
          setDuplicateDialog({
            isOpen: true,
            duplicateFields: [{
              field: fieldName,
              value: value,
              displayName: displayName
            }]
          });
        } else {
          // Set specific field error for non-duplicate errors
          if (fieldName === 'email') {
            form.setError('email', { message });
          } else if (fieldName === 'employeeCode') {
            form.setError('employeeCode', { message });
          } else if (fieldName === 'name') {
            form.setError('name', { message });
          } else if (fieldName === 'mobileNumber') {
            form.setError('mobileNumber', { message });
          } else {
            // For any other field or unknown field, show toast
            toast({
              title: "Error",
              description: message,
              variant: "destructive",
            });
          }
        }
      } else {
        // Generic error handling for non-field-specific errors
        toast({
          title: "Error",
          description: `Failed to ${user ? 'update' : 'create'} user`,
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const watchedRole = form.watch("role");

  return (
    <>
      {/* Duplicate Fields Alert Dialog */}
      <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(open) => setDuplicateDialog(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent data-testid="dialog-duplicate-validation">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Duplicate Information Detected</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>The following fields contain information that already exists in the system:</p>
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
                {duplicateDialog.duplicateFields.map((duplicate, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                    <span className="font-medium text-red-700 dark:text-red-300">{duplicate.displayName}:</span>
                    <span className="text-red-600 dark:text-red-400 font-mono bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-sm">
                      {duplicate.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Please modify the highlighted fields with unique values before saving the user.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setDuplicateDialog(prev => ({ ...prev, isOpen: false }))}
              data-testid="button-close-duplicate-dialog"
            >
              I'll Fix This
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main User Form Dialog */}
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {user ? 'Edit User' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter full name" 
                      {...field} 
                      data-testid="input-user-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="user@example.com" 
                      {...field} 
                      data-testid="input-user-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Employee Code */}
            <FormField
              control={form.control}
              name="employeeCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Code</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter employee code" 
                      {...field} 
                      data-testid="input-user-employee-code"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mobile Number */}
            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter mobile number" 
                      {...field} 
                      data-testid="input-user-mobile-number"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-user-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="sub_admin">Sub Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Department - show for all roles */}
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-user-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Department</SelectItem>
                      {departments && Array.isArray(departments) && departments.map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      )) as any}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password - show for new users or when editing */}
            {!user && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Enter initial password" 
                        {...field} 
                        data-testid="input-user-password"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-slate-500">User will be able to change this password after first login</p>
                  </FormItem>
                )}
              />
            )}

            {/* Reset Password Option for existing users */}
            {user && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reset Password (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Enter new password (leave blank to keep current)" 
                        {...field} 
                        data-testid="input-user-new-password"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-slate-500">Leave blank to keep current password</p>
                  </FormItem>
                )}
              />
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel-user"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-user"
              >
                <Save className="h-4 w-4 mr-2" />
                {mutation.isPending ? 'Saving...' : `${user ? 'Update' : 'Save'} User`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
