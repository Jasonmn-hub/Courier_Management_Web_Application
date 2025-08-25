import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  fieldIds: z.array(z.number()).optional(),
});

interface DepartmentFormProps {
  department?: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface Field {
  id: number;
  name: string;
  type: string;
}

export default function DepartmentForm({ department, onClose, onSuccess }: DepartmentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available fields
  const { data: allFields = [] } = useQuery<Field[]>({
    queryKey: ['/api/fields'],
  });

  // Fetch current department fields if editing
  const { data: currentFields = [] } = useQuery<Field[]>({
    queryKey: ['/api/departments', department?.id, 'fields'],
    enabled: !!department?.id,
  });

  const form = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: department?.name || "",
      fieldIds: currentFields.map((f: any) => f.id) || [],
    },
  });

  // Update form when currentFields data loads
  const currentFieldIds = currentFields.map((f: Field) => f.id);
  if (currentFieldIds.length > 0 && form.getValues('fieldIds')?.length === 0) {
    form.setValue('fieldIds', currentFieldIds);
  }

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof departmentSchema>) => {
      if (department) {
        const result = await apiRequest('PUT', `/api/departments/${department.id}`, { name: data.name });
        if (data.fieldIds && data.fieldIds.length > 0) {
          await apiRequest('PUT', `/api/departments/${department.id}/fields`, { fieldIds: data.fieldIds });
        }
        return result;
      } else {
        const result = await apiRequest('POST', '/api/departments', { name: data.name }) as any;
        if (data.fieldIds && data.fieldIds.length > 0) {
          await apiRequest('PUT', `/api/departments/${result.id}/fields`, { fieldIds: data.fieldIds });
        }
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fields'] });
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
        description: `Failed to ${department ? 'update' : 'create'} department`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof departmentSchema>) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {department ? 'Edit Department' : 'Add New Department'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Department Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter department name" 
                      {...field} 
                      data-testid="input-department-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Custom Fields Selection */}
            <FormField
              control={form.control}
              name="fieldIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Custom Fields</FormLabel>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                    {allFields.length === 0 ? (
                      <p className="text-sm text-slate-500">No custom fields available</p>
                    ) : (
                      allFields.map((customField) => (
                        <div key={customField.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`field-${customField.id}`}
                            checked={field.value?.includes(customField.id) || false}
                            onCheckedChange={(checked) => {
                              const currentIds = field.value || [];
                              if (checked) {
                                field.onChange([...currentIds, customField.id]);
                              } else {
                                field.onChange(currentIds.filter((id: number) => id !== customField.id));
                              }
                            }}
                            data-testid={`checkbox-field-${customField.id}`}
                          />
                          <Label 
                            htmlFor={`field-${customField.id}`} 
                            className="text-sm font-normal cursor-pointer"
                          >
                            {customField.name} ({customField.type})
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel-department"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-department"
              >
                <Save className="h-4 w-4 mr-2" />
                {mutation.isPending ? 'Saving...' : `${department ? 'Update' : 'Save'} Department`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
