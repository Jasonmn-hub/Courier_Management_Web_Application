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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Download, 
  Upload, 
  Plus, 
  Eye, 
  Settings, 
  FileSpreadsheet,
  Archive,
  Trash2,
  Edit
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

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
}

interface AuthorityLetterField {
  id: number;
  departmentId: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  textTransform: string;
  isRequired: boolean;
}

export default function AuthorityLetterNew() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [previewContent, setPreviewContent] = useState<string>("");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Template management states
  const [newTemplate, setNewTemplate] = useState({
    templateName: '',
    templateDescription: '',
    templateContent: '',
    isDefault: false
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated,
  });

  // Fetch templates for selected department
  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<AuthorityTemplate[]>({
    queryKey: ['/api/authority-templates', selectedDepartment],
    queryFn: async () => {
      if (!selectedDepartment) return [];
      const response = await apiRequest('GET', `/api/authority-templates/${selectedDepartment}`);
      return response.json();
    },
    enabled: !!selectedDepartment,
  });

  // Fetch fields for selected department
  const { data: fields = [], isLoading: fieldsLoading } = useQuery<AuthorityLetterField[]>({
    queryKey: ['/api/authority-letter-fields', selectedDepartment],
    queryFn: async () => {
      if (!selectedDepartment) return [];
      const response = await apiRequest('GET', `/api/authority-letter-fields?departmentId=${selectedDepartment}`);
      return response.json();
    },
    enabled: !!selectedDepartment,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiRequest('POST', '/api/authority-templates', {
        ...templateData,
        departmentId: selectedDepartment
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template created successfully" });
      refetchTemplates();
      setNewTemplate({ templateName: '', templateDescription: '', templateContent: '', isDefault: false });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest('DELETE', `/api/authority-templates/${templateId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template deleted successfully" });
      refetchTemplates();
      if (selectedTemplate === deleteTemplateMutation.variables) {
        setSelectedTemplate(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string> }) => {
      const response = await apiRequest('POST', '/api/authority-letter/preview-pdf', data);
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewContent(data.htmlContent);
      toast({ title: "Preview Generated", description: "Letter preview updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
    },
  });

  // Generate PDF mutation
  const generatePDFMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string> }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/authority-letter/generate-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `authority_letter_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "PDF generated and downloaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    },
  });

  // Bulk generation mutation
  const bulkGenerateMutation = useMutation({
    mutationFn: async (data: { templateId: number; csvFile: File }) => {
      const formData = new FormData();
      formData.append('templateId', data.templateId.toString());
      formData.append('csvFile', data.csvFile);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/authority-letter/bulk-generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate bulk PDFs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `authority_letters_bulk_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Bulk PDFs generated and downloaded successfully" });
      setShowBulkUpload(false);
      setCsvFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to generate bulk PDFs", variant: "destructive" });
    },
  });

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handlePreview = () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a template first", variant: "destructive" });
      return;
    }
    previewMutation.mutate({ templateId: selectedTemplate, fieldValues });
  };

  const handleGeneratePDF = () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a template first", variant: "destructive" });
      return;
    }
    generatePDFMutation.mutate({ templateId: selectedTemplate, fieldValues });
  };

  const handleDownloadSampleCSV = async () => {
    if (!selectedDepartment) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/authority-letter/sample-csv/${selectedDepartment}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to download sample CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `authority_letter_sample_${selectedDepartment}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Sample CSV downloaded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download sample CSV", variant: "destructive" });
    }
  };

  if (isLoading || !isAuthenticated) {
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
                PDF Authority Letter Generator
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Generate professional PDF authority letters with multiple templates and bulk processing
              </p>
            </div>
          </div>

          <Tabs defaultValue="generate" className="mt-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generate">Generate Letters</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Generation</TabsTrigger>
              {(user as any)?.role === 'admin' && (
                <TabsTrigger value="templates">Manage Templates</TabsTrigger>
              )}
            </TabsList>

            {/* Generate Single Letters */}
            <TabsContent value="generate" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Authority Letter Form
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Department Selection */}
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={selectedDepartment?.toString() || ""}
                        onValueChange={(value) => {
                          setSelectedDepartment(parseInt(value));
                          setSelectedTemplate(null);
                          setFieldValues({});
                          setPreviewContent("");
                        }}
                        data-testid="select-department"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Template Selection */}
                    {selectedDepartment && (
                      <div>
                        <Label htmlFor="template">Template</Label>
                        <Select
                          value={selectedTemplate?.toString() || ""}
                          onValueChange={(value) => {
                            setSelectedTemplate(parseInt(value));
                            setPreviewContent("");
                          }}
                          data-testid="select-template"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.filter(t => t.isActive).map((template) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.templateName} {template.isDefault && "(Default)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Dynamic Fields */}
                    {selectedTemplate && fields.length > 0 && (
                      <div className="space-y-3">
                        <Label>Fill the required fields:</Label>
                        {fields.map((field) => (
                          <div key={field.id}>
                            <Label htmlFor={field.fieldName}>
                              {field.fieldLabel} {field.isRequired && <span className="text-red-500">*</span>}
                            </Label>
                            {field.fieldType === 'date' ? (
                              <Input
                                id={field.fieldName}
                                type="date"
                                value={fieldValues[field.fieldName] || ''}
                                onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                                data-testid={`input-${field.fieldName}`}
                              />
                            ) : (
                              <Input
                                id={field.fieldName}
                                type={field.fieldType === 'number' ? 'number' : 'text'}
                                placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                                value={fieldValues[field.fieldName] || ''}
                                onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                                data-testid={`input-${field.fieldName}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {selectedTemplate && (
                      <div className="flex gap-3 pt-4">
                        <Button 
                          onClick={handlePreview}
                          variant="outline"
                          disabled={previewMutation.isPending}
                          data-testid="button-preview"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button 
                          onClick={handleGeneratePDF}
                          disabled={generatePDFMutation.isPending}
                          data-testid="button-generate-pdf"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Generate PDF
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Preview Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Live Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previewContent ? (
                      <div 
                        className="bg-white p-4 border rounded-lg max-h-96 overflow-y-auto text-sm"
                        dangerouslySetInnerHTML={{ __html: previewContent }}
                        data-testid="preview-content"
                      />
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        Select a template and click "Preview" to see the letter preview
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Bulk Generation */}
            <TabsContent value="bulk" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Bulk PDF Generation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {/* Department Selection */}
                      <div>
                        <Label htmlFor="bulk-department">Department</Label>
                        <Select
                          value={selectedDepartment?.toString() || ""}
                          onValueChange={(value) => setSelectedDepartment(parseInt(value))}
                          data-testid="select-bulk-department"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id.toString()}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Template Selection */}
                      {selectedDepartment && (
                        <div>
                          <Label htmlFor="bulk-template">Template</Label>
                          <Select
                            value={selectedTemplate?.toString() || ""}
                            onValueChange={(value) => setSelectedTemplate(parseInt(value))}
                            data-testid="select-bulk-template"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.filter(t => t.isActive).map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.templateName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* CSV Upload */}
                      {selectedTemplate && (
                        <div>
                          <Label htmlFor="csv-file">Upload CSV File</Label>
                          <Input
                            id="csv-file"
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setCsvFile(file);
                            }}
                            data-testid="input-csv-file"
                          />
                          {csvFile && (
                            <p className="text-sm text-green-600 mt-1">
                              Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">How to use bulk generation:</h4>
                        <ol className="text-sm text-blue-800 space-y-1">
                          <li>1. Download the sample CSV file</li>
                          <li>2. Fill in your data following the sample format</li>
                          <li>3. Upload your completed CSV file</li>
                          <li>4. Click "Generate Bulk PDFs" to download a ZIP file</li>
                        </ol>
                      </div>

                      {selectedDepartment && (
                        <Button 
                          onClick={handleDownloadSampleCSV}
                          variant="outline"
                          className="w-full"
                          data-testid="button-download-sample-csv"
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Download Sample CSV
                        </Button>
                      )}

                      {csvFile && selectedTemplate && (
                        <Button 
                          onClick={() => bulkGenerateMutation.mutate({ 
                            templateId: selectedTemplate, 
                            csvFile 
                          })}
                          disabled={bulkGenerateMutation.isPending}
                          className="w-full"
                          data-testid="button-bulk-generate"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          {bulkGenerateMutation.isPending ? 'Generating...' : 'Generate Bulk PDFs'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Template Management (Admin only) */}
            {(user as any)?.role === 'admin' && (
              <TabsContent value="templates" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Template Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Department Selection for Templates */}
                    <div>
                      <Label>Select Department to Manage Templates</Label>
                      <Select
                        value={selectedDepartment?.toString() || ""}
                        onValueChange={(value) => setSelectedDepartment(parseInt(value))}
                        data-testid="select-template-department"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Existing Templates */}
                    {selectedDepartment && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <Label>Existing Templates</Label>
                          <Button 
                            onClick={() => setShowTemplateManager(true)}
                            size="sm"
                            data-testid="button-add-template"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Template
                          </Button>
                        </div>
                        
                        {templatesLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                          </div>
                        ) : templates.length === 0 ? (
                          <p className="text-center py-4 text-slate-500">
                            No templates found. Add your first template to get started.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {templates.map((template) => (
                              <div key={template.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex-1">
                                  <h4 className="font-medium">{template.templateName}</h4>
                                  <p className="text-sm text-slate-500">{template.templateDescription}</p>
                                  <div className="flex gap-2 mt-1">
                                    {template.isDefault && (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                                    )}
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      template.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {template.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                                    disabled={deleteTemplateMutation.isPending}
                                    className="text-red-600 hover:text-red-800"
                                    data-testid={`button-delete-template-${template.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Template Creation Modal */}
          {showTemplateManager && selectedDepartment && (
            <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input
                        id="template-name"
                        value={newTemplate.templateName}
                        onChange={(e) => setNewTemplate({...newTemplate, templateName: e.target.value})}
                        placeholder="e.g., Standard Authority Letter"
                        data-testid="input-template-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="template-description">Description</Label>
                      <Input
                        id="template-description"
                        value={newTemplate.templateDescription}
                        onChange={(e) => setNewTemplate({...newTemplate, templateDescription: e.target.value})}
                        placeholder="Brief description of this template"
                        data-testid="input-template-description"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="template-content">HTML Template Content</Label>
                    <Textarea
                      id="template-content"
                      value={newTemplate.templateContent}
                      onChange={(e) => setNewTemplate({...newTemplate, templateContent: e.target.value})}
                      placeholder={`Enter HTML template with placeholders like ##field_name##\n\nExample:\n<h1>Authority Letter</h1>\n<p>Date: ##current_date##</p>\n<p>Company: ##company_name##</p>`}
                      rows={15}
                      className="font-mono text-sm"
                      data-testid="textarea-template-content"
                    />
                    <p className="text-sm text-slate-500 mt-1">
                      Use ##field_name## placeholders that match your department fields. 
                      Use ##current_date## for automatic date insertion.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is-default"
                      checked={newTemplate.isDefault}
                      onChange={(e) => setNewTemplate({...newTemplate, isDefault: e.target.checked})}
                      data-testid="checkbox-is-default"
                    />
                    <Label htmlFor="is-default">Set as default template for this department</Label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTemplateManager(false);
                        setNewTemplate({ templateName: '', templateDescription: '', templateContent: '', isDefault: false });
                      }}
                      data-testid="button-cancel-template"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createTemplateMutation.mutate(newTemplate)}
                      disabled={createTemplateMutation.isPending || !newTemplate.templateName || !newTemplate.templateContent}
                      data-testid="button-save-template"
                    >
                      {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </main>
  );
}