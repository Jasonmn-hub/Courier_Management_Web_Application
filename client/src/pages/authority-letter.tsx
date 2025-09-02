import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileDown, FileText, Plus, Edit, Upload, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Department {
  id: number;
  name: string;
  authorityDocumentPath: string | null;
  createdAt: string;
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
}

interface AuthorityLetterField {
  id: number;
  departmentId: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  createdAt: string;
}

export default function AuthorityLetter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [customFilename, setCustomFilename] = useState("");
  const [selectedFilenameField, setSelectedFilenameField] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'word'>('pdf');

  // Redirect to home if not authenticated
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
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated,
  });

  // Fetch all templates
  const { data: allTemplates = [], isLoading: templatesLoading } = useQuery<AuthorityTemplate[]>({
    queryKey: ['/api/authority-letter-templates'],
    enabled: isAuthenticated,
  });

  // Get departments that have active templates
  const departmentsWithTemplates = departments.filter(dept => 
    allTemplates.some(template => template.departmentId === dept.id && template.isActive)
  );

  // Get templates for selected department
  const availableTemplates = selectedDepartment 
    ? allTemplates.filter(template => template.departmentId === selectedDepartment && template.isActive)
    : [];

  // Fetch fields for selected template
  const { data: fields = [], isLoading: fieldsLoading } = useQuery<AuthorityLetterField[]>({
    queryKey: ['/api/authority-letter-fields', selectedTemplate],
    queryFn: async () => {
      if (!selectedTemplate) return [];
      const response = await apiRequest('GET', `/api/authority-letter-fields?templateId=${selectedTemplate}`);
      return response.json();
    },
    enabled: !!selectedTemplate,
  });

  // Preview letter mutation
  const previewMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string> }) => {
      const res = await apiRequest('POST', '/api/authority-letter/preview', data);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast({ title: "Preview Generated", description: "Authority letter preview updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate preview", variant: "destructive" });
    },
  });

  // Generate filename based on template fields
  const generateFilename = () => {
    if (!selectedFilenameField || selectedFilenameField === 'none' || !fieldValues[selectedFilenameField]) {
      return customFilename || 'authority-letter';
    }
    
    const fieldValue = fieldValues[selectedFilenameField];
    const sanitized = fieldValue.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitized}_authority_letter`;
  };

  // Download PDF letter mutation
  const downloadPDFMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string>; fileName?: string }) => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No auth token');
      
      const response = await fetch('/api/authority-letter/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate authority letter');
      }
      
      // Handle PDF download
      const blob = await response.blob();
      const filename = data.fileName || 'authority-letter.pdf';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { filename };
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `PDF downloaded: ${data.filename}` });
      setShowFilenameDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate authority letter", variant: "destructive" });
    },
  });

  // Download Word letter mutation
  const downloadWordMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string>; fileName?: string }) => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No auth token');
      
      const response = await fetch('/api/authority-letter/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate Word document');
      }
      
      // Handle Word document download
      const blob = await response.blob();
      const filename = data.fileName || 'authority-letter.docx';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { filename };
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Word document downloaded: ${data.filename}` });
      setShowFilenameDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate Word document", variant: "destructive" });
    },
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
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

  // Auto-generate preview when template changes
  useEffect(() => {
    if (selectedTemplate && Object.keys(fieldValues).length > 0) {
      previewMutation.mutate({ templateId: selectedTemplate, fieldValues });
    }
  }, [selectedTemplate]);

  const handleDownloadPDF = () => {
    if (!selectedTemplate || !fieldValues) {
      toast({ title: "Error", description: "Please select a template and fill required fields", variant: "destructive" });
      return;
    }
    setShowFilenameDialog(true);
    setDownloadFormat('pdf');
  };

  const handleDownloadWord = () => {
    if (!selectedTemplate || !fieldValues) {
      toast({ title: "Error", description: "Please select a template and fill required fields", variant: "destructive" });
      return;
    }
    setShowFilenameDialog(true);
    setDownloadFormat('word');
  };

  const handleConfirmDownload = () => {
    const fileName = generateFilename();
    if (downloadFormat === 'word') {
      downloadWordMutation.mutate({ 
        templateId: selectedTemplate!, 
        fieldValues, 
        fileName 
      });
    } else {
      downloadPDFMutation.mutate({ 
        templateId: selectedTemplate!, 
        fieldValues, 
        fileName 
      });
    }
  };

  const handleBulkUpload = () => {
    if (!selectedTemplate || !csvFile) {
      toast({ title: "Error", description: "Please select a template and upload a CSV file", variant: "destructive" });
      return;
    }
    bulkUploadMutation.mutate({ templateId: selectedTemplate, csvFile });
  };

  // Generate sample CSV file
  const handleDownloadSampleCSV = () => {
    if (!selectedDepartment || fields.length === 0) {
      toast({ title: "Error", description: "Please select a department with template fields", variant: "destructive" });
      return;
    }

    // Create CSV header row with field names
    const headers = fields.map(field => field.fieldName).join(',');
    
    // Create sample data row with placeholder values
    const sampleRow = fields.map(field => {
      switch (field.fieldType) {
        case 'date':
          return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        case 'number':
          return '123';
        case 'textarea':
          return 'Sample long text content';
        default:
          return `Sample ${field.fieldLabel}`;
      }
    }).join(',');

    const csvContent = `${headers}\n${sampleRow}`;
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_template_${selectedDepartment}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Sample CSV file downloaded successfully" });
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Auto-generate preview for real-time updates
    if (selectedTemplate) {
      const newFieldValues = { ...fieldValues, [fieldName]: value };
      previewMutation.mutate({ templateId: selectedTemplate, fieldValues: newFieldValues });
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Authority Letters (PDF)
          </h1>
          <p className="text-slate-600 mt-1">
            Generate authority letters from department templates in PDF format
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowBulkUpload(true)} 
            variant="outline" 
            className="flex items-center gap-2"
            data-testid="button-bulk-upload"
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
        </div>
      </div>

      {departmentsWithTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Templates Available</h3>
            <p className="text-slate-600 mb-4">
              No departments have active authority letter templates yet.
            </p>
            <p className="text-sm text-slate-500">
              Ask your administrator to upload authority letter templates in the "Manage Authority Letter" section.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Generate Authority Letter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Department Selection */}
              <div>
                <Label htmlFor="department">Select Department</Label>
                <Select 
                  value={selectedDepartment?.toString() || ""} 
                  onValueChange={(value) => {
                    setSelectedDepartment(parseInt(value));
                    setSelectedTemplate(null);
                    setFieldValues({});
                    setGeneratedContent("");
                  }}
                >
                  <SelectTrigger data-testid="select-department">
                    <SelectValue placeholder="Choose a department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentsWithTemplates.map((department) => (
                      <SelectItem key={department.id} value={department.id.toString()}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              {selectedDepartment && availableTemplates.length > 0 && (
                <div>
                  <Label htmlFor="template">Select Template</Label>
                  <Select 
                    value={selectedTemplate?.toString() || ""} 
                    onValueChange={(value) => {
                      setSelectedTemplate(parseInt(value));
                      setFieldValues({});
                      setGeneratedContent("");
                    }}
                  >
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.templateName}
                          {template.isDefault && " (Default)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic Fields */}
              {selectedTemplate && fields.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900">Fill Template Fields</h3>
                  {fields.map((field) => (
                    <div key={field.id}>
                      <Label htmlFor={field.fieldName}>
                        {field.fieldLabel}
                        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {field.fieldType === 'textarea' ? (
                        <Textarea
                          id={field.fieldName}
                          value={fieldValues[field.fieldName] || ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                          data-testid={`textarea-${field.fieldName}`}
                        />
                      ) : field.fieldType === 'date' ? (
                        <Input
                          type="date"
                          id={field.fieldName}
                          value={fieldValues[field.fieldName] || ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          data-testid={`input-date-${field.fieldName}`}
                        />
                      ) : (
                        <Input
                          type={field.fieldType === 'number' ? 'number' : 'text'}
                          id={field.fieldName}
                          value={fieldValues[field.fieldName] || ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                          data-testid={`input-${field.fieldName}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              {selectedTemplate && (
                <div className="flex gap-2 pt-4">
                  {/* Real-time preview - no button needed */}
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleDownloadPDF}
                      disabled={downloadPDFMutation.isPending}
                      className="flex items-center gap-2"
                      data-testid="button-download-pdf"
                    >
                      <FileDown className="h-4 w-4" />
                      {downloadPDFMutation.isPending ? "Generating..." : "Download PDF"}
                    </Button>
                    <Button 
                      onClick={handleDownloadWord}
                      disabled={downloadWordMutation.isPending}
                      variant="outline"
                      className="flex items-center gap-2"
                      data-testid="button-download-word"
                    >
                      <FileDown className="h-4 w-4" />
                      {downloadWordMutation.isPending ? "Generating..." : "Download Word"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Letter Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedContent ? (
                <div className="bg-white border rounded-lg p-6 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-slate-800 font-mono">
                    {generatedContent}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p>Generate a preview to see the authority letter content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filename Selection Dialog */}
      <Dialog open={showFilenameDialog} onOpenChange={setShowFilenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize PDF Filename</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="filename-field">Use Field Value for Filename</Label>
              <Select value={selectedFilenameField} onValueChange={setSelectedFilenameField}>
                <SelectTrigger data-testid="select-filename-field">
                  <SelectValue placeholder="Select a field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {fields.map((field) => (
                    <SelectItem key={field.fieldName} value={field.fieldName}>
                      {field.fieldLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="custom-filename">Or Enter Custom Filename</Label>
              <Input
                id="custom-filename"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="authority-letter"
                data-testid="input-custom-filename"
              />
            </div>
            
            <div className="text-sm text-slate-600">
              Preview: <code>{generateFilename()}.{downloadFormat === 'word' ? 'docx' : 'pdf'}</code>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFilenameDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmDownload} disabled={downloadPDFMutation.isPending || downloadWordMutation.isPending}>
                {(downloadPDFMutation.isPending || downloadWordMutation.isPending) ? "Generating..." : `Download ${downloadFormat === 'word' ? 'Word' : 'PDF'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Generate PDFs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-department">Department</Label>
              <Select 
                value={selectedDepartment?.toString() || ""} 
                onValueChange={(value) => setSelectedDepartment(parseInt(value))}
              >
                <SelectTrigger data-testid="select-bulk-department">
                  <SelectValue placeholder="Choose a department..." />
                </SelectTrigger>
                <SelectContent>
                  {departmentsWithTemplates.map((department) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                data-testid="input-csv-file"
              />
              <p className="text-sm text-slate-600 mt-1">
                CSV should contain columns matching the template field names
              </p>
            </div>
            
            {/* Sample CSV Download */}
            {selectedDepartment && fields.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Download Sample CSV</Label>
                    <p className="text-sm text-slate-600">
                      Get a sample CSV file with the correct field names and format
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadSampleCSV}
                    className="flex items-center gap-2"
                    data-testid="button-download-sample-csv"
                  >
                    <FileDown className="h-4 w-4" />
                    Download Sample
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkUpload(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkUpload} 
                disabled={bulkUploadMutation.isPending || !selectedDepartment || !csvFile}
              >
                <Download className="h-4 w-4 mr-2" />
                {bulkUploadMutation.isPending ? "Generating..." : "Generate & Download ZIP"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}