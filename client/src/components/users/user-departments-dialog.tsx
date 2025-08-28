import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";

interface UserDepartmentsDialogProps {
  user?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserDepartmentsDialog({ user, onClose, onSuccess }: UserDepartmentsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([]);

  // Fetch all departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['/api/departments'],
  });

  // Fetch user's current departments
  const { data: userDepartments = [], isLoading: userDepartmentsLoading } = useQuery({
    queryKey: ['/api/users', user?.id, 'departments'],
    enabled: !!user?.id,
  });

  // Load current departments when data is available
  useEffect(() => {
    if (userDepartments && Array.isArray(userDepartments)) {
      setSelectedDepartments(userDepartments);
    }
  }, [userDepartments]);

  const updateDepartmentsMutation = useMutation({
    mutationFn: async (departmentIds: number[]) => {
      const res = await apiRequest('POST', `/api/users/${user.id}/departments`, {
        departmentIds
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user.id, 'departments'] });
      toast({
        title: "Success",
        description: "User departments updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user departments",
        variant: "destructive",
      });
    },
  });

  const handleDepartmentToggle = (departmentId: number, checked: boolean) => {
    setSelectedDepartments(prev => {
      if (checked) {
        return [...prev, departmentId];
      } else {
        return prev.filter(id => id !== departmentId);
      }
    });
  };

  const handleSave = () => {
    updateDepartmentsMutation.mutate(selectedDepartments);
  };

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Departments</DialogTitle>
          <p className="text-sm text-slate-500">
            Assign departments to {user.firstName && user.lastName ? 
              `${user.firstName} ${user.lastName}` : 
              user.email
            }
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current departments */}
          {user.departments && user.departments.length > 0 && (
            <div>
              <label className="text-sm font-medium">Current Departments:</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.departments.map((dept: any) => (
                  <Badge key={dept.id} variant="outline" className="text-xs">
                    {dept.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Department selection */}
          <div>
            <label className="text-sm font-medium">Select Departments:</label>
            {departmentsLoading ? (
              <div className="animate-pulse space-y-2 mt-2">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ) : (
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                {departments.map((department: any) => (
                  <div key={department.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${department.id}`}
                      checked={selectedDepartments.includes(department.id)}
                      onCheckedChange={(checked) => 
                        handleDepartmentToggle(department.id, !!checked)
                      }
                      data-testid={`checkbox-department-${department.id}`}
                    />
                    <label 
                      htmlFor={`dept-${department.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {department.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateDepartmentsMutation.isPending}
              data-testid="button-save-departments"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateDepartmentsMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}