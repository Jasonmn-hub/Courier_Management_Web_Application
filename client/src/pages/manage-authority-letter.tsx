import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  Upload, 
  Plus, 
  Edit,
  Trash2,
  Download,
  Settings,
  Search,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  role: string;
  email: string;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

interface AuthorityTemplate {
  id: number;
  departmentId: number;
  templateName: string;
  templateContent: string;
  templateDescription?: string;
  isDefault: boolean;
  isActive: boolean;
  wordTemplateUrl?: string | null;
  createdAt: string;
  department?: Department;
}

export default function ManageAuthorityLetter() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showWordUploadForm, setShowWordUploadForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AuthorityTemplate | null>(null);
  const [uploadingWordTemplate, setUploadingWordTemplate] = useState<AuthorityTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([]);
  const [wordFile, setWordFile] = useState<File | null>(null);
  
  // Template Fields Management State
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplateForFields, setSelectedTemplateForFields] = useState<AuthorityTemplate | null>(null);
  const [showFieldsManager, setShowFieldsManager] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [newField, setNewField] = useState({ 
    fieldName: '', 
    fieldLabel: '', 
    fieldType: 'text', 
    textTransform: 'none', 
    numberFormat: 'none',
    dateFormat: 'DD-MM-YYYY',
    isRequired: false 
  });
  
  const [newTemplate, setNewTemplate] = useState({
    templateName: '',
    templateDescription: '',
    templateContent: '<p>Default authority letter template content. Replace with your template.</p>',
    isDefault: false,
    isActive: true
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

  // Fetch departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated && (user as User)?.role === 'admin',
  });

  // Fetch all templates
  const { data: allTemplates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<AuthorityTemplate[]>({
    queryKey: ['/api/authority-letter-templates'],
    enabled: isAuthenticated && (user as User)?.role === 'admin',
  });

  // Filter templates
  const templates = allTemplates.filter((template) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      template.templateName?.toLowerCase().includes(searchLower) ||
      template.templateDescription?.toLowerCase().includes(searchLower) ||
      departments.find(d => d.id === template.departmentId)?.name?.toLowerCase().includes(searchLower)
    );
  });

  // Fetch authority letter fields for selected template
  const { data: templateFields = [], isLoading: fieldsLoading, refetch: refetchFields } = useQuery<any[]>({
    queryKey: ['/api/authority-letter-fields', selectedTemplateForFields?.id],
    queryFn: async () => {
      if (!selectedTemplateForFields) return [];
      const response = await apiRequest('GET', `/api/authority-letter-fields?templateId=${selectedTemplateForFields.id}`);
      return response.json();
    },
    enabled: !!selectedTemplateForFields,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiRequest('POST', '/api/authority-letter-templates', templateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template created successfully.",
      });
      refetchTemplates();
      setShowUploadForm(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template.",
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/authority-letter-templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template updated successfully.",
      });
      refetchTemplates();
      setShowEditForm(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest('DELETE', `/api/authority-letter-templates/${templateId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template deleted successfully.",
      });
      refetchTemplates();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template.",
        variant: "destructive",
      });
    },
  });

  // Upload Word template mutation
  const uploadWordTemplateMutation = useMutation({
    mutationFn: async ({ templateId, file }: { templateId: number; file: File }) => {
      const formData = new FormData();
      formData.append('wordTemplate', file);

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/authority-templates/${templateId}/upload-word`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to upload Word template');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Word template uploaded successfully.",
      });
      refetchTemplates();
      setShowWordUploadForm(false);
      setUploadingWordTemplate(null);
      setWordFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload Word template.",
        variant: "destructive",
      });
    },
  });

  // Create field mutation
  const createFieldMutation = useMutation({
    mutationFn: async (fieldData: any) => {
      const response = await apiRequest('POST', '/api/authority-letter-fields', {
        ...fieldData,
        templateId: selectedTemplateForFields?.id
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Field created successfully.",
      });
      refetchFields();
      setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', numberFormat: 'none', dateFormat: 'DD-MM-YYYY', isRequired: false });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create field.",
        variant: "destructive",
      });
    },
  });

  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/authority-letter-fields/${id}`, {
        ...data,
        templateId: selectedTemplateForFields?.id
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Field updated successfully.",
      });
      refetchFields();
      setEditingField(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update field.",
        variant: "destructive",
      });
    },
  });

  // Reorder field mutation
  const reorderFieldMutation = useMutation({
    mutationFn: async ({ fieldId, direction }: { fieldId: number; direction: 'up' | 'down' }) => {
      const response = await apiRequest('PUT', '/api/authority-letter-fields/reorder', {
        fieldId,
        direction,
        templateId: selectedTemplateForFields?.id
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Field order updated successfully.",
      });
      refetchFields();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder field.",
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

  const resetForm = () => {
    setNewTemplate({
      templateName: '',
      templateDescription: '',
      templateContent: '<p>Default authority letter template content. Replace with your template.</p>',
      isDefault: false,
      isActive: true
    });
    setSelectedDepartments([]);
    setWordFile(null);
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.templateName.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDepartments.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one department.",
        variant: "destructive",
      });
      return;
    }

    // Create templates for each selected department
    selectedDepartments.forEach(departmentId => {
      createTemplateMutation.mutate({
        ...newTemplate,
        departmentId
      });
    });
  };

  const handleEditTemplate = (template: AuthorityTemplate) => {
    setEditingTemplate(template);
    setShowEditForm(true);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    
    updateTemplateMutation.mutate({
      id: editingTemplate.id,
      data: {
        templateName: editingTemplate.templateName,
        templateDescription: editingTemplate.templateDescription,
        templateContent: editingTemplate.templateContent,
        isDefault: editingTemplate.isDefault,
        isActive: editingTemplate.isActive
      }
    });
  };

  const handleWordFileUpload = () => {
    if (!uploadingWordTemplate || !wordFile) {
      toast({
        title: "No File Selected",
        description: "Please select a Word document to upload.",
        variant: "destructive",
      });
      return;
    }

    uploadWordTemplateMutation.mutate({ templateId: uploadingWordTemplate.id, file: wordFile });
  };

  const openWordUploadDialog = (template: AuthorityTemplate) => {
    setUploadingWordTemplate(template);
    setShowWordUploadForm(true);
    setWordFile(null);
  };

  const openFieldsManager = (template: AuthorityTemplate) => {
    setSelectedTemplateForFields(template);
    setShowFieldsManager(true);
  };

  const getDepartmentName = (departmentId: number) => {
    return departments.find(d => d.id === departmentId)?.name || `Department ${departmentId}`;
  };

  // Field management functions
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
  };

  const handleEditField = (field: any) => {
    setEditingField(field);
  };

  const handleUpdateField = () => {
    if (!editingField) return;
    
    updateFieldMutation.mutate({
      id: editingField.id,
      data: {
        fieldName: editingField.fieldName,
        fieldLabel: editingField.fieldLabel,
        fieldType: editingField.fieldType,
        textTransform: editingField.textTransform,
        numberFormat: editingField.numberFormat,
        dateFormat: editingField.dateFormat,
        isRequired: editingField.isRequired
      }
    });
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
                Manage Authority Letter Templates
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload and manage authority letter templates and fields for departments
              </p>
            </div>
          </div>

          {/* Template Management */}
          <div className="mt-8">
                <div className="flex justify-end mb-6">
                  <Button 
                    onClick={() => setShowUploadForm(true)}
                    data-testid="button-add-template"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Template
                  </Button>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Authority Letter Templates</CardTitle>
                    
                    {/* Search Input */}
                    <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        placeholder="Search templates by name, description, or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-templates"
                      />
                    </div>
                  </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No templates found. Add your first template to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Word Template</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.templateName}</TableCell>
                          <TableCell>{getDepartmentName(template.departmentId)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {template.templateDescription || 'No description'}
                          </TableCell>
                          <TableCell className="text-center">
                            {template.wordTemplateUrl ? (
                              <span className="text-green-600 font-medium">✓ Uploaded</span>
                            ) : (
                              <span className="text-gray-500">No file</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center space-x-2">
                              {template.isDefault && (
                                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                  Default
                                </span>
                              )}
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                template.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {template.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <div className="flex justify-center space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditTemplate(template)}
                                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800"
                                      data-testid={`button-edit-${template.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit Template</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openWordUploadDialog(template)}
                                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                                      data-testid={`button-upload-word-${template.id}`}
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Upload Word Template</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openFieldsManager(template)}
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-800"
                                      data-testid={`button-manage-fields-${template.id}`}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Manage Template Fields</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                                      data-testid={`button-delete-${template.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete Template</p>
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

      {/* Upload New Template Modal */}
      {showUploadForm && (
        <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Authority Letter Template</DialogTitle>
              <DialogDescription>
                Create a new template and assign it to one or more departments.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplate.templateName}
                    onChange={(e) => setNewTemplate({...newTemplate, templateName: e.target.value})}
                    placeholder="e.g., Standard Authority Letter"
                    className="border-input"
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <Label htmlFor="is-default" className="flex items-center">
                    <Checkbox
                      id="is-default"
                      checked={newTemplate.isDefault}
                      onCheckedChange={(checked) => setNewTemplate({...newTemplate, isDefault: !!checked})}
                      data-testid="checkbox-is-default"
                      className="border-input"
                    />
                    <span className="ml-2">Set as default template</span>
                  </Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={newTemplate.templateDescription}
                  onChange={(e) => setNewTemplate({...newTemplate, templateDescription: e.target.value})}
                  placeholder="Brief description of this template"
                  className="border-input"
                  data-testid="input-template-description"
                />
              </div>
              
              <div>
                <Label htmlFor="template-content">Template Content (HTML)</Label>
                <Textarea
                  id="template-content"
                  value={newTemplate.templateContent}
                  onChange={(e) => setNewTemplate({...newTemplate, templateContent: e.target.value})}
                  rows={6}
                  className="font-mono text-sm border-input"
                  data-testid="textarea-template-content"
                />
              </div>
              
              <div>
                <Label>Assign to Departments</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                  {departments.map((dept) => (
                    <Label key={dept.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedDepartments.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDepartments([...selectedDepartments, dept.id]);
                          } else {
                            setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                          }
                        }}
                        data-testid={`checkbox-dept-${dept.id}`}
                      />
                      <span>{dept.name}</span>
                    </Label>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="word-file">Upload Word Template (Optional)</Label>
                <Input
                  id="word-file"
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setWordFile(file);
                    }
                  }}
                  className="border-input cursor-pointer file:cursor-pointer"
                  data-testid="input-word-file"
                />
                {wordFile && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {wordFile.name}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Choose a Word document (.doc or .docx) to upload as template
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadForm(false);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTemplate}
                disabled={createTemplateMutation.isPending}
                data-testid="button-create-template"
              >
                {createTemplateMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-2" />
                    Create Template
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Template Modal */}
      {showEditForm && editingTemplate && (
        <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Authority Letter Template</DialogTitle>
              <DialogDescription>
                Update template details for {getDepartmentName(editingTemplate.departmentId)}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-template-name">Template Name</Label>
                  <Input
                    id="edit-template-name"
                    value={editingTemplate.templateName}
                    onChange={(e) => setEditingTemplate({...editingTemplate, templateName: e.target.value})}
                    data-testid="input-edit-template-name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-is-default">
                    <Checkbox
                      id="edit-is-default"
                      checked={editingTemplate.isDefault}
                      onCheckedChange={(checked) => setEditingTemplate({...editingTemplate, isDefault: !!checked})}
                      data-testid="checkbox-edit-is-default"
                    />
                    <span className="ml-2">Set as default template</span>
                  </Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-template-description">Description</Label>
                <Input
                  id="edit-template-description"
                  value={editingTemplate.templateDescription || ''}
                  onChange={(e) => setEditingTemplate({...editingTemplate, templateDescription: e.target.value})}
                  data-testid="input-edit-template-description"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-template-content">Template Content (HTML)</Label>
                <Textarea
                  id="edit-template-content"
                  value={editingTemplate.templateContent}
                  onChange={(e) => setEditingTemplate({...editingTemplate, templateContent: e.target.value})}
                  rows={6}
                  className="font-mono text-sm"
                  data-testid="textarea-edit-template-content"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-is-active">
                  <Checkbox
                    id="edit-is-active"
                    checked={editingTemplate.isActive}
                    onCheckedChange={(checked) => setEditingTemplate({...editingTemplate, isActive: !!checked})}
                    data-testid="checkbox-edit-is-active"
                  />
                  <span className="ml-2">Template is active</span>
                </Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingTemplate(null);
                }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTemplate}
                disabled={updateTemplateMutation.isPending}
                data-testid="button-update-template"
              >
                {updateTemplateMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-3 w-3 mr-2" />
                    Update Template
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Word Upload Modal */}
      {showWordUploadForm && uploadingWordTemplate && (
        <Dialog open={showWordUploadForm} onOpenChange={setShowWordUploadForm}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Word Template</DialogTitle>
              <DialogDescription>
                Upload a Word document template for "{uploadingWordTemplate.templateName}" - {getDepartmentName(uploadingWordTemplate.departmentId)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="word-upload">Select Word Document</Label>
                <Input
                  id="word-upload"
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setWordFile(file);
                    }
                  }}
                  data-testid="input-word-upload"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Only Word documents (.doc, .docx) are allowed
                </p>
              </div>
              
              {wordFile && (
                <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{wordFile.name}</div>
                    <div className="text-xs text-slate-500">
                      {(wordFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
              )}

              {uploadingWordTemplate.wordTemplateUrl && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center text-amber-800">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Current Word Template</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">
                    This template already has a Word document. Uploading a new one will replace the existing file.
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowWordUploadForm(false);
                  setUploadingWordTemplate(null);
                  setWordFile(null);
                }}
                data-testid="button-cancel-word-upload"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWordFileUpload}
                disabled={!wordFile || uploadWordTemplateMutation.isPending}
                data-testid="button-confirm-word-upload"
              >
                {uploadWordTemplateMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 mr-2" />
                    Upload Word Template
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Template Fields Manager Modal */}
      {showFieldsManager && selectedTemplateForFields && (
        <Dialog open={showFieldsManager} onOpenChange={setShowFieldsManager}>
          <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Template Fields</DialogTitle>
              <DialogDescription>
                Manage custom fields for template "{selectedTemplateForFields.templateName}".
                Use these fields in your template with ##field_name## syntax.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {/* Add New Field Form */}
              <div className="mb-8 p-4 bg-slate-50 rounded-lg">
                <h3 className="text-lg font-medium text-slate-900 mb-4">Add New Field</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="field-name">Field Name</Label>
                    <Input
                      id="field-name"
                      value={newField.fieldName}
                      onChange={(e) => setNewField({...newField, fieldName: e.target.value})}
                      placeholder="e.g., employee_name"
                      data-testid="input-field-name"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Use lowercase with underscores (will be ##field_name##)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="field-label">Field Label</Label>
                    <Input
                      id="field-label"
                      value={newField.fieldLabel}
                      onChange={(e) => setNewField({...newField, fieldLabel: e.target.value})}
                      placeholder="e.g., Employee Name"
                      data-testid="input-field-label"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Display name shown to users
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="field-type">Field Type</Label>
                    <Select
                      value={newField.fieldType}
                      onValueChange={(value) => setNewField({...newField, fieldType: value})}
                    >
                      <SelectTrigger data-testid="select-field-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="textarea">Textarea</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="text-transform">Text Transform</Label>
                    <Select
                      value={newField.textTransform}
                      onValueChange={(value) => setNewField({...newField, textTransform: value})}
                    >
                      <SelectTrigger data-testid="select-text-transform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="sentence">Sentence case</SelectItem>
                        <SelectItem value="lowercase">lowercase</SelectItem>
                        <SelectItem value="uppercase">UPPERCASE</SelectItem>
                        <SelectItem value="capitalize_words">Capitalize Each Word</SelectItem>
                        <SelectItem value="toggle">tOGGLE CASE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Number Format Options */}
                  {newField.fieldType === 'number' && (
                    <div>
                      <Label htmlFor="number-format">Number Format</Label>
                      <Select
                        value={newField.numberFormat || 'none'}
                        onValueChange={(value) => setNewField({...newField, numberFormat: value})}
                      >
                        <SelectTrigger data-testid="select-number-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <SelectItem value="none">Without comma</SelectItem>
                          <SelectItem value="with_commas">With comma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date Format Options */}
                  {newField.fieldType === 'date' && (
                    <div>
                      <Label htmlFor="date-format">Date Format</Label>
                      <Select
                        value={newField.dateFormat || 'DD-MM-YYYY'}
                        onValueChange={(value) => setNewField({...newField, dateFormat: value})}
                      >
                        <SelectTrigger data-testid="select-date-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <SelectItem value="DD-MM-YYYY">DD-MM-YYYY (02-09-2025)</SelectItem>
                          <SelectItem value="MM-DD-YYYY">MM-DD-YYYY (09-02-2025)</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2025-09-02)</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (02/09/2025)</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (09/02/2025)</SelectItem>
                          <SelectItem value="YYYY/MM/DD">YYYY/MM/DD (2025/09/02)</SelectItem>
                          <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (02.09.2025)</SelectItem>
                          <SelectItem value="MM.DD.YYYY">MM.DD.YYYY (09.02.2025)</SelectItem>
                          <SelectItem value="YYYY.MM.DD">YYYY.MM.DD (2025.09.02)</SelectItem>
                          <SelectItem value="DD Mon YYYY">DD Mon YYYY (02 Sep 2025)</SelectItem>
                          <SelectItem value="DD Month YYYY">DD Month YYYY (02 September 2025)</SelectItem>
                          <SelectItem value="Month DD, YYYY">Month DD, YYYY (September 02, 2025)</SelectItem>
                          <SelectItem value="YYYY Month DD">YYYY Month DD (2025 September 02)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 mb-4">
                    <Checkbox
                      id="is-required"
                      checked={newField.isRequired}
                      onCheckedChange={(checked) => setNewField({...newField, isRequired: !!checked})}
                      data-testid="checkbox-field-required"
                    />
                    <Label htmlFor="is-required">Required</Label>
                </div>
                
                <Button
                  onClick={handleCreateField}
                  disabled={createFieldMutation.isPending}
                  data-testid="button-add-field"
                >
                  {createFieldMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </>
                  )}
                </Button>
              </div>
              
              {/* Existing Fields List */}
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">
                  Existing Fields for "{selectedTemplateForFields.templateName}"
                </h3>
                
                {fieldsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : templateFields.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No custom fields created for this template yet. Add your first field above.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Display Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Transform</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templateFields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => reorderFieldMutation.mutate({ fieldId: field.id, direction: 'up' })}
                                disabled={index === 0 || reorderFieldMutation.isPending}
                                className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800"
                                data-testid={`button-move-up-${field.id}`}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => reorderFieldMutation.mutate({ fieldId: field.id, direction: 'down' })}
                                disabled={index === templateFields.length - 1 || reorderFieldMutation.isPending}
                                className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800"
                                data-testid={`button-move-down-${field.id}`}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            ##{field.fieldName}##
                          </TableCell>
                          <TableCell>{field.fieldLabel}</TableCell>
                          <TableCell className="capitalize">{field.fieldType}</TableCell>
                          <TableCell className="capitalize">
                            {field.textTransform === 'none' ? '-' : field.textTransform}
                          </TableCell>
                          <TableCell>
                            {field.isRequired ? (
                              <span className="text-red-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-gray-500">No</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <div className="flex justify-center space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditField(field)}
                                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800"
                                      data-testid={`button-edit-field-${field.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit Field</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteFieldMutation.mutate(field.id)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                                      data-testid={`button-delete-field-${field.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete Field</p>
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
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowFieldsManager(false);
                  setSelectedTemplateForFields(null);
                  setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', numberFormat: 'none', dateFormat: 'DD-MM-YYYY', isRequired: false });
                }}
                data-testid="button-close-fields-manager"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Field Modal */}
      {editingField && (
        <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Template Field</DialogTitle>
              <DialogDescription>
                Update field details for "{selectedTemplateForFields?.templateName}".
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-field-name">Field Name</Label>
                  <Input
                    id="edit-field-name"
                    value={editingField.fieldName}
                    onChange={(e) => setEditingField({...editingField, fieldName: e.target.value})}
                    placeholder="e.g., employee_name"
                    data-testid="input-edit-field-name"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Use lowercase with underscores
                  </p>
                </div>
                <div>
                  <Label htmlFor="edit-field-label">Field Label</Label>
                  <Input
                    id="edit-field-label"
                    value={editingField.fieldLabel}
                    onChange={(e) => setEditingField({...editingField, fieldLabel: e.target.value})}
                    placeholder="e.g., Employee Name"
                    data-testid="input-edit-field-label"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Display name shown to users
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="edit-field-type">Field Type</Label>
                  <Select
                    value={editingField.fieldType}
                    onValueChange={(value) => setEditingField({...editingField, fieldType: value})}
                  >
                    <SelectTrigger data-testid="select-edit-field-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-text-transform">Text Transform</Label>
                  <Select
                    value={editingField.textTransform}
                    onValueChange={(value) => setEditingField({...editingField, textTransform: value})}
                  >
                    <SelectTrigger data-testid="select-edit-text-transform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="sentence">Sentence case</SelectItem>
                      <SelectItem value="lowercase">lowercase</SelectItem>
                      <SelectItem value="uppercase">UPPERCASE</SelectItem>
                      <SelectItem value="capitalize_words">Capitalize Each Word</SelectItem>
                      <SelectItem value="toggle">tOGGLE CASE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Number Format Options */}
                {editingField.fieldType === 'number' && (
                  <div>
                    <Label htmlFor="edit-number-format">Number Format</Label>
                    <Select
                      value={editingField.numberFormat || 'none'}
                      onValueChange={(value) => setEditingField({...editingField, numberFormat: value})}
                    >
                      <SelectTrigger data-testid="select-edit-number-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="none">Without comma</SelectItem>
                        <SelectItem value="with_commas">With comma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Date Format Options */}
                {editingField.fieldType === 'date' && (
                  <div>
                    <Label htmlFor="edit-date-format">Date Format</Label>
                    <Select
                      value={editingField.dateFormat || 'DD-MM-YYYY'}
                      onValueChange={(value) => setEditingField({...editingField, dateFormat: value})}
                    >
                      <SelectTrigger data-testid="select-edit-date-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="DD-MM-YYYY">DD-MM-YYYY (02-09-2025)</SelectItem>
                        <SelectItem value="MM-DD-YYYY">MM-DD-YYYY (09-02-2025)</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2025-09-02)</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (02/09/2025)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (09/02/2025)</SelectItem>
                        <SelectItem value="YYYY/MM/DD">YYYY/MM/DD (2025/09/02)</SelectItem>
                        <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (02.09.2025)</SelectItem>
                        <SelectItem value="MM.DD.YYYY">MM.DD.YYYY (09.02.2025)</SelectItem>
                        <SelectItem value="YYYY.MM.DD">YYYY.MM.DD (2025.09.02)</SelectItem>
                        <SelectItem value="DD Mon YYYY">DD Mon YYYY (02 Sep 2025)</SelectItem>
                        <SelectItem value="DD Month YYYY">DD Month YYYY (02 September 2025)</SelectItem>
                        <SelectItem value="Month DD, YYYY">Month DD, YYYY (September 02, 2025)</SelectItem>
                        <SelectItem value="YYYY Month DD">YYYY Month DD (2025 September 02)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="edit-is-required"
                  checked={editingField.isRequired}
                  onCheckedChange={(checked) => setEditingField({...editingField, isRequired: !!checked})}
                  data-testid="checkbox-edit-field-required"
                />
                <Label htmlFor="edit-is-required">Required</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingField(null)}
                data-testid="button-cancel-edit-field"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateField}
                disabled={updateFieldMutation.isPending}
                data-testid="button-update-field"
              >
                {updateFieldMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-3 w-3 mr-2" />
                    Update Field
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}