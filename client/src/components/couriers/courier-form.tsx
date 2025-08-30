import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useAuth } from "@/hooks/useAuth";

const courierSchema = z.object({
  toBranch: z.string().min(1, "Destination is required"),
  email: z.string().email("Valid email is required"),
  courierDate: z.string().min(1, "Courier date is required"),
  vendor: z.string().min(1, "Vendor is required"),
  customVendor: z.string().optional(),
  podNo: z.string().min(1, "POD number is required"),
  contactDetails: z.string().min(1, "Contact details are required"),
  receiverName: z.string().min(1, "Receiver name is required"),
  details: z.string().min(1, "Courier details are required"),
  remarks: z.string().optional(),
  sendEmail: z.boolean().default(true),
  ccEmails: z.string().optional(),
});

interface CourierFormProps {
  courier?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CourierForm({ courier, onClose, onSuccess }: CourierFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { user } = useAuth();

  const form = useForm<z.infer<typeof courierSchema>>({
    resolver: zodResolver(courierSchema),
    defaultValues: {
      toBranch: courier?.toBranch || "",
      email: courier?.email || "",
      courierDate: courier?.courierDate || "",
      vendor: courier?.vendor || "",
      customVendor: courier?.customVendor || "",
      podNo: courier?.podNo || "",
      contactDetails: courier?.contactDetails || "",
      receiverName: courier?.receiverName || "",
      details: courier?.details || "",
      remarks: courier?.remarks || "",
      sendEmail: true,
      ccEmails: "",
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  const { data: branchesData } = useQuery({
    queryKey: ['/api/branches', { status: 'active' }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', 'active');
      
      const response = await apiRequest('GET', `/api/branches?${params.toString()}`);
      return response.json();
    },
    enabled: !!user, // Enable when user is authenticated
  });
  
  // Get users for autocomplete
  const { data: usersData } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    },
    enabled: !!user, // Enable when user is authenticated
  });
  
  // Get vendors for dropdown
  const { data: vendorsData } = useQuery({
    queryKey: ['/api/vendors'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/vendors');
      return response.json();
    },
    enabled: !!user, // Enable when user is authenticated
  });

  // Get department custom fields
  const { data: departmentFields = [] } = useQuery({
    queryKey: ['/api/departments/fields', user?.departmentId],
    queryFn: async () => {
      if (!user?.departmentId) return [];
      const response = await apiRequest('GET', `/api/departments/${user.departmentId}/fields`);
      return response.json();
    },
    enabled: !!user?.departmentId,
  });

  const branches = branchesData?.branches || [];
  const users = usersData?.users || [];
  const vendors = vendorsData?.vendors || [];

  // State for custom field values
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const handleCustomFieldChange = (fieldName: string, value: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof courierSchema>) => {
      const formData = new FormData();
      
      // Append form fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Add user's department ID
      if (user?.departmentId) {
        formData.append('departmentId', user.departmentId.toString());
      }

      // Add custom field values
      if (Object.keys(customFieldValues).length > 0) {
        formData.append('customFields', JSON.stringify(customFieldValues));
      }

      // Append file if selected
      if (selectedFile) {
        formData.append('podCopy', selectedFile);
      }

      const url = courier ? `/api/couriers/${courier.id}` : '/api/couriers';
      const method = courier ? 'PUT' : 'POST';
      
      // Get auth token for file upload request
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/couriers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/monthly'] });
      onSuccess();
    },
    onError: (error) => {
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
      toast({
        title: "Error",
        description: `Failed to ${courier ? 'update' : 'create'} courier`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof courierSchema>) => {
    mutation.mutate(data);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF, JPG, or PNG file",
          variant: "destructive",
        });
        return;
      }

      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };


  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {courier ? 'Edit Courier' : 'Add New Courier'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

              {/* To Branch/Other */}
              <FormField
                control={form.control}
                name="toBranch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To (Branch / Other)</FormLabel>
                    <FormControl>
                      <Autocomplete
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          // Auto-fill email if branch is selected
                          const selectedBranch = branches.find((b: any) => b.branchName === value || `${b.branchName} (${b.branchCode})` === value);
                          if (selectedBranch && selectedBranch.email) {
                            form.setValue('email', selectedBranch.email);
                          } else {
                            // Check if it's a user
                            const selectedUser = users.find((u: any) => u.name === value || u.email === value);
                            if (selectedUser && selectedUser.email) {
                              form.setValue('email', selectedUser.email);
                            }
                          }
                        }}
                        options={[
                          ...branches.map((branch: any) => ({
                            value: branch.branchName,
                            label: `${branch.branchName} - ${branch.email || 'No Email'}`
                          })),
                          ...users.map((user: any) => ({
                            value: user.name || user.email,
                            label: `${user.name} - ${user.email}`
                          }))
                        ]}
                        placeholder="Type branch name, user name, or custom destination..."
                        onAddNew={(value) => {
                          field.onChange(value);
                          toast({ 
                            title: "Custom Destination", 
                            description: `Using custom destination: ${value}` 
                          });
                        }}
                        data-testid="autocomplete-to-branch"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email ID */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email ID</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="recipient@example.com" 
                        {...field} 
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Courier Date */}
              <FormField
                control={form.control}
                name="courierDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Courier Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-courier-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Courier Vendor */}
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Courier Vendor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vendor">
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors
                          .filter((vendor: any) => vendor.isActive)
                          .map((vendor: any) => (
                            <SelectItem key={vendor.id} value={vendor.vendorName}>
                              {vendor.vendorName}
                            </SelectItem>
                          ))}
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Custom Vendor Field (when "Others" is selected) */}
              {form.watch("vendor") === "Others" && (
                <FormField
                  control={form.control}
                  name="customVendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Vendor Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter vendor name" 
                          {...field} 
                          data-testid="input-custom-vendor"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* POD No. */}
              <FormField
                control={form.control}
                name="podNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>POD No.</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="POD-2024-XXX" 
                        {...field} 
                        data-testid="input-pod-no"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Details */}
              <FormField
                control={form.control}
                name="contactDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Details</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Phone number" 
                        {...field} 
                        data-testid="input-contact-details"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Receiver Name */}
              <FormField
                control={form.control}
                name="receiverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receiver Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Name of the person receiving" 
                        {...field} 
                        data-testid="input-receiver-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            {/* Custom Department Fields */}
            {departmentFields.length > 0 && (
              <div className="space-y-4">
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-lg font-medium">Department Specific Fields</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {departmentFields.map((field: any) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.name}
                      </label>
                      {field.type === 'dropdown' ? (
                        <Select 
                          onValueChange={(value) => handleCustomFieldChange(field.name, value)}
                          value={customFieldValues[field.name] || ''}
                        >
                          <SelectTrigger data-testid={`select-${field.name.toLowerCase().replace(/\s+/g, '-')}`}>
                            <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {/* TODO: Add dropdown options when available */}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          placeholder={`Enter ${field.name.toLowerCase()}`}
                          value={customFieldValues[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                          data-testid={`input-${field.name.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>

            {/* POD Copy Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">POD Copy (Optional)</label>
              <Card className="border-dashed border-2">
                <CardContent className="p-4">
                  {selectedFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Upload className="h-4 w-4 text-primary" />
                        <span className="text-sm">{selectedFile.name}</span>
                        <span className="text-xs text-slate-500">
                          ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                      <div className="text-sm text-slate-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                          <span>Upload a file</span>
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                            data-testid="input-file-upload"
                          />
                        </label>
                        <span className="pl-1">or drag and drop</span>
                      </div>
                      <p className="text-xs text-slate-500">PDF, PNG, JPG up to 10MB</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={2}
                      placeholder="Additional notes..." 
                      {...field} 
                      data-testid="textarea-remarks"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Notification Options */}
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <FormField
                control={form.control}
                name="sendEmail"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-send-email"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Send email notification</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ccEmails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CC Emails (comma separated)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="email1@example.com, email2@example.com" 
                        {...field} 
                        data-testid="input-cc-emails"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-courier"
              >
                <Save className="h-4 w-4 mr-2" />
                {mutation.isPending ? 'Saving...' : `${courier ? 'Update' : 'Save'} Courier`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
