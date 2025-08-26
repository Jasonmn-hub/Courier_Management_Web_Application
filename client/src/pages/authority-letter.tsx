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
import { FileDown, FileText, Plus, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Department {
  id: number;
  name: string;
  authorityDocumentPath: string | null;
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
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState<string>("");

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

  // Fetch departments with uploaded documents
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated,
  });

  // Filter departments that have uploaded Word documents
  const departmentsWithDocuments = departments.filter(dept => dept.authorityDocumentPath);

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

  // Preview letter mutation
  const previewMutation = useMutation({
    mutationFn: async (data: { departmentId: number; fieldValues: Record<string, string> }) => {
      const res = await apiRequest('POST', '/api/authority-letter/preview-from-department', data);
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

  // Download letter mutation
  const downloadMutation = useMutation({
    mutationFn: async (data: { departmentId: number; fieldValues: Record<string, string> }) => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No auth token');
      
      const response = await fetch('/api/authority-letter/generate-from-department', {
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
      
      // Check if response is a Word document (binary) or JSON (text fallback)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        // It's a Word document - trigger download directly
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition');
        const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'authority-letter.docx';
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        return { isWordDocument: true, filename };
      } else {
        // It's JSON (text fallback)
        return response.json();
      }
    },
    onSuccess: (data) => {
      if (data.isWordDocument) {
        toast({ title: "Success", description: `Word document downloaded: ${data.filename}` });
      } else {
        if (data.isTextFallback) {
          toast({ 
            title: "Downloaded (Text Fallback)", 
            description: "Word document processing failed. Downloaded text version instead.",
            variant: "destructive"
          });
        } else {
          toast({ title: "Success", description: "Authority letter downloaded successfully" });
        }
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to download authority letter", variant: "destructive" });
    },
  });


  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handlePreview = () => {
    if (!selectedDepartment) {
      toast({ title: "Error", description: "Please select a department", variant: "destructive" });
      return;
    }

    previewMutation.mutate({
      departmentId: selectedDepartment,
      fieldValues
    });
  };

  const handleDownloadWord = () => {
    if (!selectedDepartment) {
      toast({ title: "Error", description: "Please select a department", variant: "destructive" });
      return;
    }

    // Validate required fields
    const requiredFields = fields.filter(field => field.isRequired);
    const missingFields = requiredFields.filter(field => !fieldValues[field.fieldName]?.trim());
    
    if (missingFields.length > 0) {
      toast({ 
        title: "Validation Error", 
        description: `Please fill in required fields: ${missingFields.map(f => f.fieldLabel).join(', ')}`,
        variant: "destructive" 
      });
      return;
    }
    
    downloadMutation.mutate({
      departmentId: selectedDepartment,
      fieldValues
    });
  };

  // Auto-preview when field values change
  useEffect(() => {
    if (selectedDepartment && fields.length > 0) {
      const timer = setTimeout(() => {
        handlePreview();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fieldValues, selectedDepartment, fields]);



  useEffect(() => {
    if (departmentsWithDocuments.length > 0 && !selectedDepartment) {
      // Auto-select user's department if they have document, otherwise select first available
      const userDept = departmentsWithDocuments.find(dept => dept.id === (user as any)?.departmentId);
      setSelectedDepartment(userDept ? userDept.id : departmentsWithDocuments[0].id);
    }
  }, [departmentsWithDocuments, selectedDepartment, user]);

  // Reset field values when department changes
  useEffect(() => {
    setFieldValues({});
    setGeneratedContent("");
  }, [selectedDepartment]);

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
          <div className="mb-8">
            <div>
              <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                Authority Letter Generator
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Generate official authority letters using uploaded Word documents with dynamic ##field## placeholders
              </p>
              {departmentsWithDocuments.length === 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>No departments with Word documents found.</strong> 
                    {(user as any)?.role === 'admin' ? (
                      <span> Please go to Departments tab to upload Word document templates first.</span>
                    ) : (
                      <span> Please contact your administrator to upload department Word document templates.</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>


          <div className="grid gap-8 lg:grid-cols-2">
            {/* Form Section */}
            <Card>
              <CardHeader>
                <CardTitle>Letter Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="department">Select Department</Label>
                  <Select value={selectedDepartment?.toString() || ""} onValueChange={(value) => setSelectedDepartment(parseInt(value))}>
                    <SelectTrigger data-testid="select-department">
                      <SelectValue placeholder="Choose a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentsWithDocuments.map((department) => (
                        <SelectItem key={department.id} value={department.id.toString()}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDepartment && (
                    <p className="text-xs text-slate-500 mt-1">
                      Using Word document template from {departmentsWithDocuments.find(d => d.id === selectedDepartment)?.name} department
                    </p>
                  )}
                </div>

                {/* Dynamic form fields based on department fields */}
                {selectedDepartment && (
                  <div className="space-y-4">
                    {fieldsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-slate-500 mt-2">Loading form fields...</p>
                      </div>
                    ) : fields.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50 rounded-lg border-2 border-dashed">
                        <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-600 font-medium">No custom fields configured</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {(user as any)?.role === 'admin' ? (
                            <span>Go to Departments → Manage Fields to add ##field## placeholders for this department's Word document.</span>
                          ) : (
                            <span>Contact your administrator to configure form fields for this department.</span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="font-medium text-slate-900 flex items-center">
                          Fill Document Fields 
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {fields.length} field{fields.length !== 1 ? 's' : ''}
                          </span>
                        </h4>
                        
                        {fields.map((field) => (
                          <div key={field.id}>
                            <Label htmlFor={field.fieldName} className="flex items-center">
                              {field.fieldLabel}
                              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                              <span className="ml-2 text-xs font-mono bg-slate-100 px-1 rounded">##${field.fieldName}##</span>
                            </Label>
                            {field.fieldType === 'date' ? (
                              <Input
                                id={field.fieldName}
                                type="date"
                                value={fieldValues[field.fieldName] || ""}
                                onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                                required={field.isRequired}
                                data-testid={`input-${field.fieldName}`}
                              />
                            ) : field.fieldType === 'number' ? (
                              <Input
                                id={field.fieldName}
                                type="number"
                                value={fieldValues[field.fieldName] || ""}
                                onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                                placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                                required={field.isRequired}
                                data-testid={`input-${field.fieldName}`}
                              />
                            ) : (
                              <Input
                                id={field.fieldName}
                                type="text"
                                value={fieldValues[field.fieldName] || ""}
                                onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                                placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                                required={field.isRequired}
                                data-testid={`input-${field.fieldName}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={handlePreview} 
                    variant="outline"
                    disabled={previewMutation.isPending || !selectedDepartment || fields.length === 0}
                    data-testid="button-preview"
                  >
                    {previewMutation.isPending ? "Updating..." : "Update Preview"}
                  </Button>
                  <Button 
                    onClick={handleDownloadWord} 
                    className="flex-1"
                    disabled={downloadMutation.isPending || !selectedDepartment || fields.length === 0}
                    data-testid="button-download-word"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {downloadMutation.isPending ? "Generating..." : "Download Word Document"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Letter Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-8 border rounded-lg min-h-[600px] shadow-inner" style={{
                  fontFamily: 'Times New Roman, serif',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  maxWidth: '210mm',
                  margin: '0 auto',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 0 10px rgba(0,0,0,0.1)'
                }}>
                  {generatedContent ? (
                    <div className="whitespace-pre-line" style={{
                      letterSpacing: '0.3px',
                      textAlign: 'left'
                    }}>
                      {generatedContent}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-center mt-20" style={{ fontFamily: 'system-ui' }}>
                      {!selectedDepartment ? (
                        "Select a department to begin"
                      ) : fields.length === 0 ? (
                        "No fields configured for this department"
                      ) : (
                        "Fill the form fields to preview the authority letter"
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}