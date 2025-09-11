import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Edit, Trash2, Settings, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DepartmentForm from "@/components/departments/department-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { formatEntityId } from "@/lib/idUtils";

interface User {
  id: string;
  role: string;
  email: string;
  name: string;
}

interface Department {
  id: number;
  name: string;
  authorityDocumentPath?: string;
  createdAt: string;
  updatedAt: string;
  templateCount?: number;
}

export default function Departments() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFieldsManager, setShowFieldsManager] = useState(false);
  const [selectedDepartmentForFields, setSelectedDepartmentForFields] = useState<Department | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; department: Department | null }>({
    show: false,
    department: null,
  });

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user as User)?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  const { data: allDepartments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated && (user as User)?.role === 'admin',
  });

  // Filter departments on the client side
  const departments = allDepartments.filter((dept) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return dept.name?.toLowerCase().includes(searchLower);
  });

  // Fetch authority letter fields for selected department
  const { data: departmentFields = [], isLoading: fieldsLoading, refetch: refetchFields } = useQuery<any[]>({
    queryKey: ['/api/authority-letter-fields'],
    queryFn: async () => {
      if (!selectedDepartmentForFields) return [];
      const response = await apiRequest('GET', `/api/authority-letter-fields?departmentId=${selectedDepartmentForFields.id}`);
      return response.json();
    },
    enabled: !!selectedDepartmentForFields,
  });

  const [newField, setNewField] = useState({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', isRequired: false });


  // Create field mutation
  const createFieldMutation = useMutation({
    mutationFn: async (fieldData: any) => {
      const response = await apiRequest('POST', '/api/authority-letter-fields', {
        ...fieldData,
        departmentId: selectedDepartmentForFields?.id
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Field created successfully.",
      });
      refetchFields();
      setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', isRequired: false });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create field.",
        variant: "destructive",
      });
    },
  });

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      const response = await apiRequest('DELETE', `/api/authority-letter-fields/${fieldId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Field deleted successfully.",
      });
      refetchFields();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete field.",
        variant: "destructive",
      });
    },
  });

  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (departmentId: number) => {
      const response = await apiRequest('DELETE', `/api/departments/${departmentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Department deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setDeleteConfirmation({ show: false, department: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete department.",
        variant: "destructive",
      });
      setDeleteConfirmation({ show: false, department: null });
    },
  });

  const handleCreateField = () => {
    if (!newField.fieldName.trim() || !newField.fieldLabel.trim()) {
      toast({
        title: "Validation Error",
        description: "Field name and label are required.",
        variant: "destructive",
      });
      return;
    }

    createFieldMutation.mutate(newField);
    // Reset form after successful mutation
    setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', isRequired: false });
  };

  const handleDeleteDepartment = (department: Department) => {
    setDeleteConfirmation({ show: true, department });
  };

  const confirmDeleteDepartment = () => {
    if (deleteConfirmation.department) {
      deleteDepartmentMutation.mutate(deleteConfirmation.department.id);
    }
  };


  if (isLoading || !isAuthenticated || (user as User)?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                Department Management
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage departments and their field configurations
              </p>
            </div>
          </div>

          {/* Department Management */}
          <div className="mt-8">
            <div className="mb-6">
              <Button 
                onClick={() => setShowDepartmentForm(true)}
                data-testid="button-add-department"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>

            {/* Department List */}
            <Card>
              <CardHeader>
                <CardTitle>All Departments</CardTitle>
                
                {/* Search Input */}
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search departments by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-departments"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {departmentsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : departments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No departments found. Add your first department to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium text-slate-600">
                            {dept.id}
                          </TableCell>
                          <TableCell className="font-medium">
                            {dept.name}
                          </TableCell>
                          <TableCell>
                            {new Date(dept.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <div className="flex justify-center space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingDepartment(dept);
                                        setShowDepartmentForm(true);
                                      }}
                                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800"
                                      data-testid={`button-edit-${dept.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit Department</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteDepartment(dept)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                                      data-testid={`button-delete-${dept.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete Department</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add/Edit Department Modal */}
      {showDepartmentForm && (
        <DepartmentForm
          department={editingDepartment}
          onClose={() => {
            setShowDepartmentForm(false);
            setEditingDepartment(null);
          }}
          onSuccess={() => {
            setShowDepartmentForm(false);
            setEditingDepartment(null);
          }}
        />
      )}


      {/* Fields Manager Modal */}
      {showFieldsManager && selectedDepartmentForFields && (
        <Dialog open={showFieldsManager} onOpenChange={setShowFieldsManager}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Manage Custom Fields - {selectedDepartmentForFields.name}</DialogTitle>
              <DialogDescription>
                Create custom fields for ## ## placeholders in your Word document. Users will fill these fields when generating authority letters.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Add New Field */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold">Add New Field</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Field Name (for ##name##)</label>
                    <Input
                      placeholder="e.g., employee_name"
                      value={newField.fieldName}
                      onChange={(e) => setNewField({...newField, fieldName: e.target.value})}
                      data-testid="input-field-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Field Label (for users)</label>
                    <Input
                      placeholder="e.g., Employee Name"
                      value={newField.fieldLabel}
                      onChange={(e) => setNewField({...newField, fieldLabel: e.target.value})}
                      data-testid="input-field-label"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <select
                      value={newField.fieldType}
                      onChange={(e) => setNewField({...newField, fieldType: e.target.value})}
                      className="w-24 h-9 px-3 border border-input bg-background text-sm rounded-md"
                      data-testid="select-field-type"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Text Format</label>
                    <select
                      value={newField.textTransform}
                      onChange={(e) => setNewField({...newField, textTransform: e.target.value})}
                      className="w-36 h-9 px-3 border border-input bg-background text-sm rounded-md"
                      data-testid="select-text-transform"
                    >
                      <option value="none">Normal</option>
                      <option value="uppercase">UPPERCASE</option>
                      <option value="capitalize">Capitalize Each Word</option>
                      <option value="toggle">tOGGLE cASE</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="required-field"
                      checked={newField.isRequired}
                      onChange={(e) => setNewField({...newField, isRequired: e.target.checked})}
                      data-testid="checkbox-field-required"
                    />
                    <label htmlFor="required-field" className="text-sm">Required</label>
                  </div>
                  <Button
                    onClick={handleCreateField}
                    disabled={createFieldMutation.isPending}
                    size="sm"
                    data-testid="button-add-field"
                  >
                    {createFieldMutation.isPending ? 'Adding...' : 'Add Field'}
                  </Button>
                </div>
              </div>

              {/* Existing Fields */}
              <div className="space-y-4">
                <h4 className="font-semibold">Existing Fields</h4>
                {fieldsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : departmentFields.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No fields created yet. Add your first field above.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {departmentFields.map((field: any) => (
                      <div key={field.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">##${field.fieldName}##</span>
                            <span className="font-medium">{field.fieldLabel}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{field.fieldType}</span>
                            {field.isRequired && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFieldMutation.mutate(field.id)}
                          disabled={deleteFieldMutation.isPending}
                          className="text-red-600 hover:text-red-800"
                          data-testid={`button-delete-field-${field.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowFieldsManager(false);
                  setSelectedDepartmentForFields(null);
                  setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', isRequired: false });
                }}
                data-testid="button-close-fields-manager"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.show && deleteConfirmation.department && (
        <Dialog open={deleteConfirmation.show} onOpenChange={(open) => !open && setDeleteConfirmation({ show: false, department: null })}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Department</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteConfirmation.department.name}"? This action cannot be undone and will also delete all associated data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmation({ show: false, department: null })}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteDepartment}
                disabled={deleteDepartmentMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteDepartmentMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}