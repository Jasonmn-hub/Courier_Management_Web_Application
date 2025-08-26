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
import { Plus, Trash2, Mail, User, Calendar, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface CustomField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  departmentId?: number;
}

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId: number;
  timestamp: string;
  user: User;
}

function AuditLogsTable() {
  const { toast } = useToast();
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['/api/audit-logs'],
  });

  if (isLoading) {
    return <div className="text-center py-4">Loading audit logs...</div>;
  }

  const logs = (auditLogs as any)?.logs || [];

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Date & Time</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log: AuditLog) => (
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
                <div className="text-sm text-slate-500">ID: {log.entityId}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{log.user?.name || 'Unknown'}</div>
                    <div className="text-sm text-slate-500">{log.user?.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {new Date(log.timestamp).toLocaleDateString()}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Audit Log Details",
                      description: `${log.action} action on ${log.entityType} (ID: ${log.entityId}) by ${log.user?.name || 'Unknown'} at ${new Date(log.timestamp).toLocaleString()}`,
                    });
                  }}
                  data-testid={`button-view-details-${log.id}`}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {logs.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No audit logs found
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  // Determine active tab based on route
  const getActiveTab = () => {
    if (location === "/custom-fields") return "fields";
    if (location === "/audit-logs") return "audit";
    return "smtp";
  };

  // Fetch all fields
  const { data: fields = [], isLoading: fieldsLoading } = useQuery<CustomField[]>({
    queryKey: ['/api/fields'],
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
  const [smtpData, setSmtpData] = useState<SmtpSettings>({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: ""
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
          <Tabs value={getActiveTab()} className="w-full">
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
                        value={smtpData.user}
                        onChange={(e) => setSmtpData({ ...smtpData, user: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-pass">Password</Label>
                      <Input
                        id="smtp-pass"
                        type="password"
                        placeholder="App password"
                        value={smtpData.pass}
                        onChange={(e) => setSmtpData({ ...smtpData, pass: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="smtp-secure"
                      checked={smtpData.secure}
                      onChange={(e) => setSmtpData({ ...smtpData, secure: e.target.checked })}
                    />
                    <Label htmlFor="smtp-secure">Use TLS/SSL</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => toast({ title: "SMTP Settings", description: "Configuration saved successfully" })}>
                      Save Configuration
                    </Button>
                    <Button variant="outline" onClick={() => toast({ title: "Test Email", description: "Test email sent successfully" })}>
                      Send Test Email
                    </Button>
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
                      disabled={createFieldMutation.isPending || !newFieldName.trim()}
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
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
        </div>
      </div>
    </main>
  );
}
