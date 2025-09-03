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
  wordTemplateUrl?: string | null;
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
  const [wordTemplateFile, setWordTemplateFile] = useState<File | null>(null);
  const [uploadingTemplateId, setUploadingTemplateId] = useState<number | null>(null);
  const [newTemplateWordFile, setNewTemplateWordFile] = useState<File | null>(null);
  const [extractingContent, setExtractingContent] = useState(false);
  
  // Template management states
  const [newTemplate, setNewTemplate] = useState({
    templateName: '',
    templateDescription: '',
    templateContent: ''
  });

  // Field management states
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [editingField, setEditingField] = useState<AuthorityLetterField | null>(null);
  const [newField, setNewField] = useState({
    fieldName: '',
    fieldLabel: '',
    fieldType: 'text',
    textTransform: 'none',
    numberFormat: 'none',
    dateFormat: 'DD-MM-YYYY',
    isRequired: false
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
      setNewTemplate({ templateName: '', templateDescription: '', templateContent: '' });
      setNewTemplateWordFile(null);
      setExtractingContent(false);
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

  // Extract Word content for new template mutation
  const extractWordContentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('wordDocument', file);
      
      const response = await fetch('/api/authority-templates/extract-word-content', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Content extraction failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Word extraction successful:', data);
      setNewTemplate(prev => ({ ...prev, templateContent: data.htmlContent }));
      toast({ title: "Success", description: "Word document content extracted successfully" });
      setExtractingContent(false);
    },
    onError: (error: any) => {
      console.error('Word extraction error:', error);
      if (error.message.includes('401')) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: `Failed to extract Word document content: ${error.message}`, variant: "destructive" });
      setExtractingContent(false);
    },
  });

  // Upload Word template mutation
  const uploadWordTemplateMutation = useMutation({
    mutationFn: async ({ templateId, file }: { templateId: number; file: File }) => {
      const formData = new FormData();
      formData.append('wordTemplate', file);
      
      const response = await fetch(`/api/authority-templates/${templateId}/upload-word`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Word template uploaded successfully" });
      refetchTemplates();
      setWordTemplateFile(null);
      setUploadingTemplateId(null);
    },
    onError: (error: any) => {
      if (error.message.includes('401')) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: "Failed to upload Word template", variant: "destructive" });
      setUploadingTemplateId(null);
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

  // Generate PDF mutation (smart routing for HTML/Word templates)
  const generatePDFMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string> }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/authority-letter/generate-template', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to generate authority letter');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Check content type to determine file extension
      const contentType = response.headers.get('content-type');
      const isWordDoc = contentType?.includes('wordprocessingml');
      a.download = `authority_letter_${Date.now()}.${isWordDoc ? 'docx' : 'pdf'}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Authority letter generated and downloaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to generate authority letter", variant: "destructive" });
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

  // Field management mutations
  const createFieldMutation = useMutation({
    mutationFn: async (fieldData: any) => {
      const response = await apiRequest('POST', '/api/authority-letter-fields', {
        ...fieldData,
        departmentId: selectedDepartment
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Field created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/authority-letter-fields', selectedDepartment] });
      setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', numberFormat: 'none', dateFormat: 'DD-MM-YYYY', isRequired: false });
      setShowFieldManager(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create field", variant: "destructive" });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ fieldId, fieldData }: { fieldId: number; fieldData: any }) => {
      const response = await apiRequest('PUT', `/api/authority-letter-fields/${fieldId}`, fieldData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Field updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/authority-letter-fields', selectedDepartment] });
      setEditingField(null);
      setShowFieldManager(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update field", variant: "destructive" });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      const response = await apiRequest('DELETE', `/api/authority-letter-fields/${fieldId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Field deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/authority-letter-fields', selectedDepartment] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete field", variant: "destructive" });
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

  // Field management handlers
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

  const handleEditField = (field: AuthorityLetterField) => {
    setEditingField(field);
    setNewField({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      textTransform: field.textTransform || 'none',
      numberFormat: (field as any).numberFormat || 'none',
      dateFormat: (field as any).dateFormat || 'DD-MM-YYYY',
      isRequired: field.isRequired
    });
    setShowFieldManager(true);
  };

  const handleUpdateField = () => {
    if (!editingField || !newField.fieldName.trim() || !newField.fieldLabel.trim()) {
      toast({
        title: "Validation Error",
        description: "Field name and label are required.",
        variant: "destructive",
      });
      return;
    }
    updateFieldMutation.mutate({
      fieldId: editingField.id,
      fieldData: newField
    });
  };

  const handleDeleteField = (fieldId: number) => {
    if (confirm("Are you sure you want to delete this field? This action cannot be undone.")) {
      deleteFieldMutation.mutate(fieldId);
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
                                <div className="flex items-center justify-between w-full">
                                  <span>
                                    {template.templateName}
                                    {template.isDefault && " (Default)"}
                                  </span>
                                  <div className="flex gap-1 ml-2">
                                    {template.wordTemplateUrl && (
                                      <span className="text-xs bg-purple-100 text-purple-800 px-1 py-0.5 rounded">Word</span>
                                    )}
                                    <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">HTML</span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {templatesLoading && (
                          <p className="text-sm text-slate-500 mt-1">Loading templates...</p>
                        )}
                        {selectedTemplate && templates.find(t => t.id === selectedTemplate) && (
                          <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                            <p><strong>Selected:</strong> {templates.find(t => t.id === selectedTemplate)?.templateName}</p>
                            <p><strong>Type:</strong> {templates.find(t => t.id === selectedTemplate)?.wordTemplateUrl ? 'Word + HTML Template (will generate .docx)' : 'HTML Template only (will generate .pdf)'}</p>
                            {templates.find(t => t.id === selectedTemplate)?.templateDescription && (
                              <p><strong>Description:</strong> {templates.find(t => t.id === selectedTemplate)?.templateDescription}</p>
                            )}
                          </div>
                        )}
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
                                    {template.wordTemplateUrl && (
                                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Word Template</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                  {/* Word Template Upload */}
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="file"
                                      accept=".doc,.docx"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setWordTemplateFile(file);
                                          setUploadingTemplateId(template.id);
                                          uploadWordTemplateMutation.mutate({ templateId: template.id, file });
                                        }
                                      }}
                                      style={{ display: 'none' }}
                                      id={`word-upload-${template.id}`}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => document.getElementById(`word-upload-${template.id}`)?.click()}
                                      disabled={uploadingTemplateId === template.id && uploadWordTemplateMutation.isPending}
                                      title="Upload Word Template"
                                      data-testid={`button-upload-word-${template.id}`}
                                    >
                                      {uploadingTemplateId === template.id && uploadWordTemplateMutation.isPending ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                      ) : (
                                        <>
                                          <Upload className="h-4 w-4 mr-1" />
                                          {template.wordTemplateUrl ? 'Update' : 'Upload'} Word
                                        </>
                                      )}
                                    </Button>
                                  </div>
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

                    {/* Template Fields Management */}
                    {selectedDepartment && (
                      <div className="mt-8 pt-6 border-t">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <Label className="text-lg font-semibold">Template Fields</Label>
                            <p className="text-sm text-slate-500 mt-1">
                              Manage custom fields for this department's templates
                            </p>
                          </div>
                          <Button 
                            onClick={() => {
                              setEditingField(null);
                              setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', numberFormat: 'none', dateFormat: 'DD-MM-YYYY', isRequired: false });
                              setShowFieldManager(true);
                            }}
                            size="sm"
                            data-testid="button-add-field"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Field
                          </Button>
                        </div>
                        
                        {fieldsLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                          </div>
                        ) : fields.length === 0 ? (
                          <p className="text-center py-4 text-slate-500">
                            No template fields found. Add fields to use as placeholders in your templates.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {fields.map((field) => (
                              <div key={field.id} className="flex items-center justify-between p-3 border rounded bg-slate-50">
                                <div className="flex-1">
                                  <h4 className="font-medium">{field.fieldLabel}</h4>
                                  <p className="text-sm text-slate-500">
                                    Field Name: <code className="bg-slate-200 px-1 rounded">##${field.fieldName}##</code>
                                  </p>
                                  <div className="flex gap-2 mt-1">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      {field.fieldType}
                                    </span>
                                    {field.isRequired && (
                                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                                    )}
                                    {field.textTransform && field.textTransform !== 'none' && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        {field.textTransform}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditField(field)}
                                    data-testid={`button-edit-field-${field.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteField(field.id)}
                                    disabled={deleteFieldMutation.isPending}
                                    className="text-red-600 hover:text-red-800"
                                    data-testid={`button-delete-field-${field.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">How to use template fields:</h4>
                          <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Use field names as placeholders in your templates like <code>##field_name##</code></li>
                            <li>• Fields will be replaced with actual values when generating letters</li>
                            <li>• Required fields must be filled before generating letters</li>
                          </ul>
                        </div>
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
                    <Label>Upload Word Template (Optional)</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="file"
                        accept=".docx,.doc"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            console.log('File selected for extraction:', file.name, file.type, file.size);
                            setNewTemplateWordFile(file);
                            setExtractingContent(true);
                            extractWordContentMutation.mutate(file);
                          }
                        }}
                        style={{ display: 'none' }}
                        id="new-template-word-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('new-template-word-upload')?.click()}
                        disabled={extractingContent}
                        data-testid="button-upload-word-new-template"
                      >
                        {extractingContent ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {newTemplateWordFile ? 'Change Word Document' : 'Upload Word Document'}
                          </>
                        )}
                      </Button>
                      {newTemplateWordFile && !extractingContent && (
                        <span className="text-sm text-green-600">✓ {newTemplateWordFile.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Upload a Word document to automatically extract content as HTML template
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="template-content">Template Content (HTML)</Label>
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


                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTemplateManager(false);
                        setNewTemplate({ templateName: '', templateDescription: '', templateContent: '' });
                        setNewTemplateWordFile(null);
                        setExtractingContent(false);
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

          {/* Field Management Modal */}
          {showFieldManager && selectedDepartment && (
            <Dialog open={showFieldManager} onOpenChange={setShowFieldManager}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingField ? 'Edit Template Field' : 'Add Template Field'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                        Used as ##field_name## in templates
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
                        Displayed to users when filling forms
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="field-type">Field Type</Label>
                      <Select 
                        value={newField.fieldType} 
                        onValueChange={(value) => setNewField({
                          ...newField, 
                          fieldType: value,
                          textTransform: 'none',
                          numberFormat: 'none', 
                          dateFormat: 'DD-MM-YYYY'
                        })}
                      >
                        <SelectTrigger data-testid="select-field-type">
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Text Transform Options */}
                    {(newField.fieldType === 'text' || newField.fieldType === 'textarea') && (
                      <div>
                        <Label htmlFor="text-transform">Text Transform</Label>
                        <Select 
                          value={newField.textTransform} 
                          onValueChange={(value) => setNewField({...newField, textTransform: value})}
                        >
                          <SelectTrigger data-testid="select-text-transform">
                            <SelectValue placeholder="Select transform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="sentence">Sentence case</SelectItem>
                            <SelectItem value="lowercase">lowercase</SelectItem>
                            <SelectItem value="uppercase">UPPERCASE</SelectItem>
                            <SelectItem value="capitalize_words">Capitalize Each Word</SelectItem>
                            <SelectItem value="toggle">tOGGLE CASE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Number Format Options */}
                    {newField.fieldType === 'number' && (
                      <div>
                        <Label htmlFor="number-format">Number Format</Label>
                        <Select 
                          value={newField.numberFormat || 'none'} 
                          onValueChange={(value) => setNewField({...newField, numberFormat: value})}
                        >
                          <SelectTrigger data-testid="select-number-format">
                            <SelectValue placeholder="Select number format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Without commas (12345)</SelectItem>
                            <SelectItem value="with_commas">With commas (12,345)</SelectItem>
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
                            <SelectValue placeholder="Select date format" />
                          </SelectTrigger>
                          <SelectContent>
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

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is-required"
                      checked={newField.isRequired}
                      onChange={(e) => setNewField({...newField, isRequired: e.target.checked})}
                      data-testid="checkbox-is-required"
                    />
                    <Label htmlFor="is-required">This field is required</Label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowFieldManager(false);
                        setEditingField(null);
                        setNewField({ fieldName: '', fieldLabel: '', fieldType: 'text', textTransform: 'none', numberFormat: 'none', dateFormat: 'DD-MM-YYYY', isRequired: false });
                      }}
                      data-testid="button-cancel-field"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={editingField ? handleUpdateField : handleCreateField}
                      disabled={createFieldMutation.isPending || updateFieldMutation.isPending || !newField.fieldName || !newField.fieldLabel}
                      data-testid="button-save-field"
                    >
                      {(createFieldMutation.isPending || updateFieldMutation.isPending) ? 'Saving...' : (editingField ? 'Update Field' : 'Create Field')}
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