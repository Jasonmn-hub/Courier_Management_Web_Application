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

interface AuthorityLetterTemplate {
  id: number;
  departmentId: number;
  templateName: string;
  templateContent: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    templateName: "",
    templateContent: "",
    departmentId: (user as any)?.departmentId || 1
  });

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

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<AuthorityLetterTemplate[]>({
    queryKey: ['/api/authority-letter-templates'],
    enabled: isAuthenticated,
  });

  // Fetch fields
  const { data: fields = [], isLoading: fieldsLoading } = useQuery<AuthorityLetterField[]>({
    queryKey: ['/api/authority-letter-fields'],
    enabled: isAuthenticated,
  });

  // Generate letter mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { templateId: number; fieldValues: Record<string, string> }) => {
      const res = await apiRequest('POST', '/api/authority-letter/generate', data);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast({ title: "Success", description: "Authority letter generated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate authority letter", variant: "destructive" });
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      const res = await apiRequest('POST', '/api/authority-letter-templates', template);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/authority-letter-templates'] });
      toast({ title: "Success", description: "Template created successfully" });
      setNewTemplate({ templateName: "", templateContent: "", departmentId: (user as any)?.departmentId || 1 });
      setShowTemplateManager(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleGenerate = () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a template", variant: "destructive" });
      return;
    }
    
    generateMutation.mutate({
      templateId: selectedTemplate,
      fieldValues
    });
  };

  const handleDownload = () => {
    if (!generatedContent) {
      toast({ title: "Error", description: "Please generate a letter first", variant: "destructive" });
      return;
    }

    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `authority-letter-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Authority letter downloaded" });
  };

  const createDefaultTemplate = () => {
    setNewTemplate({
      templateName: "Default Authority Letter",
      templateContent: `##Current Date##

To,
##Recipient Name##
##Recipient Address##

AUTHORITY LETTER

Dear Sir/Madam,

We hereby authorize ##Authorized Person##, ##Designation## to provide the services of transporting the ##Asset Type## of ##Company Name## from ##From Location## to ##To Location##.

NOTE:- NOT FOR SALE THIS ##Asset Note## ARE FOR ONLY OFFICE USE.

Thanking you.

FOR ##Company Name##


_______________________
##Signatory Name##
[##Signatory Designation##]`,
      departmentId: (user as any)?.departmentId || 1
    });
  };

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].id);
    }
  }, [templates, selectedTemplate]);

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
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                  Authority Letter Generator
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Generate official authority letters using department templates with ##field## placeholders
                </p>
              </div>
              {(user as any)?.role === 'admin' && (
                <Button onClick={() => setShowTemplateManager(!showTemplateManager)} variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Manage Templates
                </Button>
              )}
            </div>
          </div>

          {showTemplateManager && (user as any)?.role === 'admin' && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Template Manager
                  <Button onClick={createDefaultTemplate} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Default Template
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="templateName">Template Name</Label>
                  <Input
                    id="templateName"
                    value={newTemplate.templateName}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, templateName: e.target.value }))}
                    placeholder="Enter template name"
                    data-testid="input-template-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="templateContent">Template Content (Use ##FieldName## for placeholders)</Label>
                  <Textarea
                    id="templateContent"
                    value={newTemplate.templateContent}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, templateContent: e.target.value }))}
                    placeholder="Enter template content with ##field## placeholders"
                    rows={15}
                    className="font-mono text-sm"
                    data-testid="textarea-template-content"
                  />
                </div>
                
                <Button 
                  onClick={() => createTemplateMutation.mutate(newTemplate)}
                  disabled={createTemplateMutation.isPending || !newTemplate.templateName.trim()}
                  data-testid="button-create-template"
                >
                  {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Form Section */}
            <Card>
              <CardHeader>
                <CardTitle>Letter Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="template">Select Template</Label>
                  <Select value={selectedTemplate?.toString() || ""} onValueChange={(value) => setSelectedTemplate(parseInt(value))}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.templateName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic form fields based on template */}
                {selectedTemplate && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-slate-900">Fill Template Fields</h4>
                    
                    {/* Common fields that are likely to be in templates */}
                    {[
                      { name: 'Recipient Name', key: 'Recipient Name' },
                      { name: 'Recipient Address', key: 'Recipient Address' },
                      { name: 'Company Name', key: 'Company Name' },
                      { name: 'Authorized Person', key: 'Authorized Person' },
                      { name: 'Designation', key: 'Designation' },
                      { name: 'Asset Type', key: 'Asset Type' },
                      { name: 'From Location', key: 'From Location' },
                      { name: 'To Location', key: 'To Location' },
                      { name: 'Asset Note', key: 'Asset Note' },
                      { name: 'Signatory Name', key: 'Signatory Name' },
                      { name: 'Signatory Designation', key: 'Signatory Designation' },
                    ].map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={field.key}>{field.name}</Label>
                        <Input
                          id={field.key}
                          value={fieldValues[field.key] || ""}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.name.toLowerCase()}`}
                          data-testid={`input-${field.key.toLowerCase().replace(' ', '-')}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={handleGenerate} 
                    className="flex-1"
                    disabled={generateMutation.isPending || !selectedTemplate}
                    data-testid="button-generate"
                  >
                    {generateMutation.isPending ? "Generating..." : "Generate Letter"}
                  </Button>
                  <Button 
                    onClick={handleDownload} 
                    variant="outline" 
                    disabled={!generatedContent}
                    data-testid="button-download"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download
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
                <div className="bg-white p-6 border rounded-lg min-h-[600px] font-mono text-sm whitespace-pre-line">
                  {generatedContent || (
                    <div className="text-slate-500 text-center mt-20">
                      Select a template and fill the fields to preview the authority letter
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