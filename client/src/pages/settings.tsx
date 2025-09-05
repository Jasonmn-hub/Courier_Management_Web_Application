import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Plus, FileText, Trash2, Mail, User, Calendar, Search, Pencil, Settings as SettingsIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ExportDialog } from "@/components/export-dialog";
import { formatEntityId } from "@/lib/idUtils";
import { formatDateDDMMYYYY, formatTimeHHMM } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  employeeCode?: string;
  role: string;
}

interface SmtpSettings {
  host: string;
  port: number;
  useTLS: boolean;
  useSSL: boolean;
  username: string;
  password: string;
}


interface CustomField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  departmentId?: number;
}

interface DropdownOption {
  id: number;
  fieldId: number;
  departmentId: number;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
}

interface SamlSettings {
  entityId?: string;
  ssoUrl?: string;
  certificateContent?: string;
  enabled?: boolean;
}

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId: number;
  timestamp: string;
  user?: User;
  emailId?: string;
  details?: string;
  entityData?: any;
}

function SamlSSOSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [samlData, setSamlData] = useState({
    entityId: "",
    ssoUrl: "",
    certificateContent: "",
    enabled: false
  });

  // Fetch SAML settings
  const { data: samlSettings, isLoading: samlLoading } = useQuery<SamlSettings>({
    queryKey: ['/api/saml-settings'],
  });

  // Update form when data is loaded
  useEffect(() => {
    if (samlSettings) {
      setSamlData({
        entityId: samlSettings.entityId || "",
        ssoUrl: samlSettings.ssoUrl || "",
        certificateContent: samlSettings.certificateContent || "",
        enabled: samlSettings.enabled || false
      });
    }
  }, [samlSettings]);

  // Save SAML mutation
  const saveSamlMutation = useMutation({
    mutationFn: async (settings: typeof samlData) => {
      const res = await apiRequest('POST', '/api/saml-settings', settings);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "SAML SSO settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/saml-settings'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save SAML settings", variant: "destructive" });
    }
  });

  if (samlLoading) {
    return <div className="text-center py-4">Loading SAML settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          SAML SSO Configuration (Skillmine Integration)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="saml-entity-id">Entity ID (Service Provider)</Label>
              <Input
                id="saml-entity-id"
                type="text"
                placeholder="https://your-domain.com/saml/metadata"
                value={samlData.entityId}
                onChange={(e) => setSamlData(prev => ({ ...prev, entityId: e.target.value }))}
                data-testid="input-saml-entity-id"
              />
              <p className="text-sm text-slate-500 mt-1">The unique identifier for your service provider</p>
            </div>
            <div>
              <Label htmlFor="saml-sso-url">SSO URL (Identity Provider)</Label>
              <Input
                id="saml-sso-url"
                type="url"
                placeholder="https://skillmine.com/saml/sso"
                value={samlData.ssoUrl}
                onChange={(e) => setSamlData(prev => ({ ...prev, ssoUrl: e.target.value }))}
                data-testid="input-saml-sso-url"
              />
              <p className="text-sm text-slate-500 mt-1">Skillmine SSO endpoint URL</p>
            </div>
          </div>
          
          <div>
            <Label htmlFor="saml-certificate">X.509 Certificate</Label>
            <textarea
              id="saml-certificate"
              className="w-full min-h-[200px] px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
              placeholder="-----BEGIN CERTIFICATE-----
MIICXjCCAcegAwIBAgIBADANBgkqhkiG9w0BAQ0FADBLMQswCQYDVQQGEwJ1czEL...
-----END CERTIFICATE-----"
              value={samlData.certificateContent}
              onChange={(e) => setSamlData(prev => ({ ...prev, certificateContent: e.target.value }))}
              data-testid="textarea-saml-certificate"
            />
            <p className="text-sm text-slate-500 mt-1">
              Paste the X.509 certificate from Skillmine (including BEGIN/END lines)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="saml-enabled"
              checked={samlData.enabled}
              onChange={(e) => setSamlData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
              data-testid="checkbox-saml-enabled"
            />
            <Label htmlFor="saml-enabled">Enable SAML SSO</Label>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Configuration Instructions:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
              <li>Contact Skillmine support to set up SSO integration</li>
              <li>Provide them with your Entity ID and redirect URLs</li>
              <li>Obtain the SSO URL and X.509 certificate from Skillmine</li>
              <li>Configure the settings above and enable SSO</li>
              <li>Test the integration with a user account</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => saveSamlMutation.mutate(samlData)}
            disabled={saveSamlMutation.isPending}
            data-testid="button-save-saml"
          >
            {saveSamlMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSamlData({
                entityId: samlSettings?.entityId || "",
                ssoUrl: samlSettings?.ssoUrl || "",
                certificateContent: samlSettings?.certificateContent || "",
                enabled: samlSettings?.enabled || false
              });
            }}
            data-testid="button-reset-saml"
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditLogsTable() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['/api/audit-logs', { limit: pageSize, offset: (currentPage - 1) * pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', pageSize.toString());
      params.set('offset', ((currentPage - 1) * pageSize).toString());
      
      const response = await apiRequest('GET', `/api/audit-logs?${params.toString()}`);
      return response.json();
    },
  });

  // Fetch all users for entity resolution
  const { data: allUsers } = useQuery({
    queryKey: ['/api/users'],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [viewingLog, setViewingLog] = useState<AuditLog | null>(null);

  // Function to get entity details - shows user name/email for user entities
  const getEntityDetails = (entityId: string | number, entityType: string, users: any) => {
    if (entityType.toLowerCase() === 'user') {
      // Look up user details from the users data
      const usersList = (users as any)?.users || [];
      const user = usersList.find((u: any) => u.id === String(entityId));
      if (user) {
        return `User: ${user.name || 'Unknown'} (${user.email || 'No email'})`;
      }
      return `User ID: ${entityId} (Details not found)`;
    }
    
    // For non-user entities, use the original formatted ID
    const entityTypeMap: Record<string, any> = {
      'courier': 'courier',
      'department': 'department', 
      'branch': 'branch',
      'vendor': 'vendor',
      'received_courier': 'received_courier',
      'audit_log': 'audit_log'
    };
    
    const mappedType = entityTypeMap[entityType.toLowerCase()] || 'audit_log';
    return `Entity ID: ${formatEntityId(entityId, mappedType)}`;
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading audit logs...</div>;
  }

  const logs = (auditLogs as any)?.logs || [];
  const totalLogs = (auditLogs as any)?.total || 0;
  const totalPages = Math.ceil(totalLogs / pageSize);

  const filteredLogs = logs.filter((log: AuditLog) => {
    const term = searchTerm.toLowerCase();
    return (
      log.entityType.toLowerCase().includes(term) ||
      log.entityId.toString().includes(term) ||
      (log.user?.name?.toLowerCase().includes(term) ?? false) ||
      log.action.toLowerCase().includes(term) ||
      (log.emailId?.toLowerCase().includes(term) ?? false)
    );
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <Plus className="h-4 w-4 text-green-500" />;
      case 'UPDATE': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'DELETE': return <Trash2 className="h-4 w-4 text-red-500" />;
      default: return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border rounded-lg">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold">Audit Logs</h3>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-64"
          />
          <ExportDialog title="Audit Logs" exportType="audit-logs">
            <Button variant="outline" size="sm" data-testid="button-export-audit-logs">
              <Download className="h-4 w-4 mr-2" />
              Export Audit Logs
            </Button>
          </ExportDialog>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>User/Confirmation</TableHead>
            <TableHead>Email/Status</TableHead>
            <TableHead>Date & Time</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                {searchTerm ? "No audit logs found matching your search." : "No audit logs found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredLogs.map((log: AuditLog) => (
              <TableRow key={log.id} className="cursor-pointer hover:bg-slate-50" data-testid={`audit-log-${log.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getActionIcon(log.action)}
                    <Badge className={getActionColor(log.action)}>
                      {log.action}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{log.entityType}</div>
                  <div className="text-sm text-slate-500 font-mono">
                    ID: {log.entityId ? formatEntityId(log.entityId, log.entityType.toLowerCase() === 'courier' ? 'courier' : 
                        log.entityType.toLowerCase() === 'user' ? 'user' : 
                        log.entityType.toLowerCase() === 'department' ? 'department' : 
                        log.entityType.toLowerCase() === 'branch' ? 'branch' : 
                        log.entityType.toLowerCase() === 'vendor' ? 'vendor' :
                        log.entityType.toLowerCase() === 'received_courier' ? 'received_courier' : 'audit_log') : 'N/A'}
                  </div>
                </TableCell>
                <TableCell>
                  {log.action === 'EMAIL_CONFIRM_RECEIVED' ?
                    (log.emailId ? `Email Confirmed: ${log.emailId}` : 'Email Confirmation') :
                    (log.details || (log.entityId ? getEntityDetails(log.entityId, log.entityType, allUsers) : 'N/A'))
                  }
                </TableCell>
                <TableCell>
                  {log.action === 'EMAIL_CONFIRM_RECEIVED' ?
                    'User clicked email confirmation link' :
                    (log.user?.name || 'Unknown')
                  }
                </TableCell>
                <TableCell>
                  {log.action === 'EMAIL_CONFIRM_RECEIVED' ?
                    (log.emailId || 'N/A') :
                    (log.user?.email || 'N/A')
                  }
                </TableCell>
                <TableCell className="text-sm">
                  {formatDateDDMMYYYY(log.timestamp)}
                  <div className="text-xs text-slate-500">
                    {formatTimeHHMM(log.timestamp)}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingLog(log)}
                    data-testid={`button-view-details-${log.id}`}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center text-sm text-slate-500">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalLogs)} to {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} entries
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Log Details Dialog */}
      <Dialog open={!!viewingLog} onOpenChange={(open) => { if (!open) setViewingLog(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {viewingLog && (
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">Action</Label>
                <p>{viewingLog.action}</p>
              </div>
              <div>
                <Label className="font-semibold">Entity Type</Label>
                <p>{viewingLog.entityType}</p>
              </div>
              
              {/* Show details if available, otherwise fall back to entity ID */}
              {viewingLog.details && (
                <div>
                  <Label className="font-semibold">Description</Label>
                  <p className="text-blue-600 font-medium">{viewingLog.details}</p>
                </div>
              )}
              
              <div>
                <Label className="font-semibold">Entity ID</Label>
                <p>{viewingLog.entityId || 'N/A'}</p>
              </div>

              {/* Show entity data if available */}
              {viewingLog.entityData && (
                <div>
                  <Label className="font-semibold">Entity Information</Label>
                  <div className="bg-slate-50 p-3 rounded-md mt-2">
                    {typeof viewingLog.entityData === 'object' ? (
                      Object.entries(viewingLog.entityData).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-slate-200 last:border-0">
                          <span className="font-medium text-slate-600">{key}:</span>
                          <span className="text-slate-800">{value as string}</span>
                        </div>
                      ))
                    ) : (
                      <p>{JSON.stringify(viewingLog.entityData)}</p>
                    )}
                  </div>
                </div>
              )}

              {viewingLog.action === 'EMAIL_CONFIRM_RECEIVED' ? (
                <>
                  <div>
                    <Label className="font-semibold">Confirmation Type</Label>
                    <p>Email Link Confirmation</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Email Address</Label>
                    <p className="text-blue-600">{viewingLog.emailId || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Confirmation Method</Label>
                    <p>User clicked email confirmation link</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="font-semibold">User</Label>
                    <p>{viewingLog.user?.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">User Email</Label>
                    <p>{viewingLog.user?.email || 'N/A'}</p>
                  </div>
                </>
              )}
              {viewingLog.emailId && viewingLog.action !== 'EMAIL_CONFIRM_RECEIVED' && (
                <div>
                  <Label className="font-semibold">Related Email</Label>
                  <p className="text-blue-600">{viewingLog.emailId}</p>
                </div>
              )}
              <div>
                <Label className="font-semibold">Timestamp</Label>
                <p>{viewingLog.timestamp ? new Date(viewingLog.timestamp).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("smtp");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [showDropdownDialog, setShowDropdownDialog] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [newOptionLabel, setNewOptionLabel] = useState("");

  // Initialize active tab based on route and URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (location === "/custom-fields") setActiveTab("fields");
    else if (location === "/audit-logs") setActiveTab("audit");
    else if (tabParam === "saml") setActiveTab("saml");
    else setActiveTab("smtp");
  }, [location]);

  // Fetch all fields
  const { data: fields = [], isLoading: fieldsLoading } = useQuery<CustomField[]>({
    queryKey: ['/api/fields'],
  });

  // Fetch dropdown options for selected field
  const { data: dropdownOptions = [], isLoading: optionsLoading } = useQuery<DropdownOption[]>({
    queryKey: ['/api/field-dropdown-options', selectedField?.id],
    queryFn: async () => {
      if (!selectedField?.id) return [];
      const response = await apiRequest('GET', `/api/field-dropdown-options/${selectedField.id}`);
      return response.json();
    },
    enabled: !!selectedField?.id,
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments'],
  });

  const createFieldMutation = useMutation({
    mutationFn: async (fieldData: { name: string; type: string }) => {
      const res = await apiRequest('POST', '/api/fields', fieldData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fields'] });
      toast({ title: "Custom Field", description: `Field "${newFieldName}" added successfully` });
      setNewFieldName("");
      setNewFieldType("text");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create field", variant: "destructive" });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: number) => {
      await apiRequest('DELETE', `/api/fields/${fieldId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fields'] });
      toast({ title: "Success", description: "Field deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete field", variant: "destructive" });
    },
  });

  // Dropdown option mutations
  const createOptionMutation = useMutation({
    mutationFn: async (optionData: { fieldId: number; departmentId: number; optionValue: string; optionLabel: string }) => {
      const response = await apiRequest('POST', '/api/field-dropdown-options', optionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/field-dropdown-options', selectedField?.id] });
      toast({ title: "Success", description: "Dropdown option added successfully" });
      setNewOptionValue("");
      setNewOptionLabel("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create dropdown option", variant: "destructive" });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (optionId: number) => {
      await apiRequest('DELETE', `/api/field-dropdown-options/${optionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/field-dropdown-options', selectedField?.id] });
      toast({ title: "Success", description: "Dropdown option deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete dropdown option", variant: "destructive" });
    },
  });
  const [smtpData, setSmtpData] = useState({
    host: "",
    port: 587,
    useTLS: false,
    useSSL: false,
    username: "",
    password: "",
    fromEmail: "",
    applicationUrl: ""
  });

  const [testEmail, setTestEmail] = useState("");

  // Fetch SMTP settings
  const { data: existingSmtpSettings } = useQuery({
    queryKey: ['/api/smtp-settings'],
  });

  // Load existing SMTP settings
  useEffect(() => {
    if (existingSmtpSettings && typeof existingSmtpSettings === 'object') {
      setSmtpData({
        host: (existingSmtpSettings as any).host || "",
        port: (existingSmtpSettings as any).port || 587,
        useTLS: (existingSmtpSettings as any).useTLS || false,
        useSSL: (existingSmtpSettings as any).useSSL || false,
        username: (existingSmtpSettings as any).username || "",
        password: (existingSmtpSettings as any).password || "",
        fromEmail: (existingSmtpSettings as any).fromEmail || "",
        applicationUrl: (existingSmtpSettings as any).applicationUrl || ""
      });
    }
  }, [existingSmtpSettings]);

  // Save SMTP settings mutation
  const saveSmtpMutation = useMutation({
    mutationFn: async (data: typeof smtpData) => {
      const res = await apiRequest('POST', '/api/smtp-settings', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smtp-settings'] });
      toast({ title: "SMTP Settings", description: "Configuration saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save SMTP settings", variant: "destructive" });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest('POST', '/api/smtp-settings/test', { testEmail: email });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Test Email", description: data.message });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Failed to send test email";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
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
          <div className="flex-1 min-w-0 mb-8">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure system settings and preferences
            </p>
          </div>

          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={(tab) => {
            setActiveTab(tab);
            // Update URL to reflect the current tab
            const newUrl = tab === "saml" ? "/settings?tab=saml" : "/settings";
            window.history.replaceState({}, '', newUrl);
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="smtp" data-testid="tab-smtp-settings">SMTP Settings</TabsTrigger>
              <TabsTrigger value="fields" data-testid="tab-fields">Fields</TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit-logs">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="smtp" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    SMTP Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.gmail.com"
                        value={smtpData.host}
                        onChange={(e) => setSmtpData({ ...smtpData, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        placeholder="587"
                        value={smtpData.port}
                        onChange={(e) => setSmtpData({ ...smtpData, port: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-user">Username</Label>
                      <Input
                        id="smtp-user"
                        placeholder="your-email@domain.com"
                        value={smtpData.username}
                        onChange={(e) => setSmtpData({ ...smtpData, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-pass">Password</Label>
                      <Input
                        id="smtp-pass"
                        type="password"
                        placeholder="App password"
                        value={smtpData.password}
                        onChange={(e) => setSmtpData({ ...smtpData, password: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-from">From Email (Optional)</Label>
                      <Input
                        id="smtp-from"
                        type="email"
                        placeholder="noreply@yourcompany.com"
                        value={smtpData.fromEmail}
                        onChange={(e) => setSmtpData({ ...smtpData, fromEmail: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="app-url">Application URL</Label>
                      <Input
                        id="app-url"
                        type="url"
                        placeholder="https://your-app-domain.com"
                        value={smtpData.applicationUrl}
                        onChange={(e) => setSmtpData({ ...smtpData, applicationUrl: e.target.value })}
                      />
                      <p className="text-sm text-muted-foreground">
                        This URL will be used in login links sent via email
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtp-tls"
                        checked={smtpData.useTLS}
                        onChange={(e) => setSmtpData({ ...smtpData, useTLS: e.target.checked })}
                      />
                      <Label htmlFor="smtp-tls">Use TLS</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="smtp-ssl"
                        checked={smtpData.useSSL}
                        onChange={(e) => setSmtpData({ ...smtpData, useSSL: e.target.checked })}
                      />
                      <Label htmlFor="smtp-ssl">Use SSL</Label>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="test-email">Test Email Address</Label>
                      <Input
                        id="test-email"
                        type="email"
                        placeholder="test@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        data-testid="input-test-email"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => saveSmtpMutation.mutate(smtpData)}
                        disabled={saveSmtpMutation.isPending}
                        data-testid="button-save-smtp"
                      >
                        {saveSmtpMutation.isPending ? "Saving..." : "Save Configuration"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!testEmail) {
                            toast({ title: "Error", description: "Please enter a test email address", variant: "destructive" });
                            return;
                          }
                          testEmailMutation.mutate(testEmail);
                        }}
                        disabled={testEmailMutation.isPending || !testEmail}
                        data-testid="button-test-email"
                      >
                        {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="fields" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Custom Fields
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Field name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                    />
                    <Select value={newFieldType} onValueChange={setNewFieldType}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="calendar">Calendar</SelectItem>
                        <SelectItem value="dropdown">Dropdown</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        if (newFieldName.trim()) {
                          createFieldMutation.mutate({ name: newFieldName, type: newFieldType });
                        } else {
                          toast({ title: "Error", description: "Please enter a field name", variant: "destructive" });
                        }
                      }}
                      disabled={createFieldMutation.isPending}
                      data-testid="button-add-field"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fieldsLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4">
                              Loading fields...
                            </TableCell>
                          </TableRow>
                        ) : fields.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-slate-500">
                              No custom fields created yet. Add your first field above.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (fields as CustomField[]).map((field) => (
                            <TableRow key={field.id} data-testid={`field-row-${field.id}`}>
                              <TableCell className="font-medium">{field.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {field.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={field.required ? "secondary" : "outline"}>
                                  {field.required ? "Yes" : "No"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {field.departmentId ? `Department ${field.departmentId}` : "All Departments"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {field.type === 'dropdown' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedField(field);
                                        setShowDropdownDialog(true);
                                      }}
                                      data-testid={`button-manage-dropdown-${field.id}`}
                                      title="Manage dropdown options"
                                    >
                                      <SettingsIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // TODO: Open edit field dialog
                                      toast({ title: "Feature", description: "Edit field functionality coming soon!" });
                                    }}
                                    data-testid={`button-edit-field-${field.id}`}
                                    title="Edit field"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete the field "${field.name}"?`)) {
                                        deleteFieldMutation.mutate(field.id);
                                      }
                                    }}
                                    disabled={deleteFieldMutation.isPending}
                                    data-testid={`button-delete-field-${field.id}`}
                                    title="Delete field"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Audit Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AuditLogsTable />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Dropdown Options Management Dialog */}
          {showDropdownDialog && selectedField && (
            <Dialog open={showDropdownDialog} onOpenChange={setShowDropdownDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Manage Dropdown Options for "{selectedField.name}"</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Add new option form */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Add New Option</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="option-value">Option Value</Label>
                        <Input
                          id="option-value"
                          placeholder="e.g., value1"
                          value={newOptionValue}
                          onChange={(e) => setNewOptionValue(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="option-label">Option Label</Label>
                        <Input
                          id="option-label"
                          placeholder="e.g., Display Text"
                          value={newOptionLabel}
                          onChange={(e) => setNewOptionLabel(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={() => {
                            if (newOptionValue.trim() && newOptionLabel.trim()) {
                              // Use the first department if available, or default to 1
                              const departmentId = (departments as any)[0]?.id || 1;
                              createOptionMutation.mutate({
                                fieldId: selectedField.id,
                                departmentId,
                                optionValue: newOptionValue.trim(),
                                optionLabel: newOptionLabel.trim()
                              });
                            } else {
                              toast({ title: "Error", description: "Please fill in both value and label", variant: "destructive" });
                            }
                          }}
                          disabled={createOptionMutation.isPending}
                        >
                          {createOptionMutation.isPending ? "Adding..." : "Add Option"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Existing options list */}
                  <div className="border rounded-lg">
                    <div className="p-4 border-b">
                      <h4 className="font-medium">Existing Options</h4>
                    </div>
                    <div className="p-4">
                      {optionsLoading ? (
                        <div className="text-center py-4">Loading options...</div>
                      ) : dropdownOptions.length === 0 ? (
                        <div className="text-center py-4 text-slate-500">
                          No options created yet. Add your first option above.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Value</TableHead>
                              <TableHead>Label</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dropdownOptions.map((option) => (
                              <TableRow key={option.id}>
                                <TableCell className="font-mono text-sm">{option.optionValue}</TableCell>
                                <TableCell>{option.optionLabel}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete the option "${option.optionLabel}"?`)) {
                                        deleteOptionMutation.mutate(option.id);
                                      }
                                    }}
                                    disabled={deleteOptionMutation.isPending}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDropdownDialog(false);
                      setSelectedField(null);
                      setNewOptionValue("");
                      setNewOptionLabel("");
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </main>
  );
}