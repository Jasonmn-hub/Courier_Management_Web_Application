import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Users, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface Department {
  id: number;
  name: string;
}

interface UserPolicy {
  id: number;
  departmentId: number;
  tabName: string;
  isEnabled: boolean;
  department?: Department;
}

const AVAILABLE_TABS = [
  { name: 'branches', label: 'Branch List', description: 'Manage branch locations and details' },
  { name: 'authority-letter', label: 'Authority Letters', description: 'Generate and manage authority letters' },
  { name: 'couriers', label: 'Courier Management', description: 'Send and track courier items' },
  { name: 'received-couriers', label: 'Received Couriers', description: 'View received courier items' },
];

export default function UserPolicies() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user as any)?.role !== 'admin')) {
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
  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      return response.json();
    },
    enabled: isAuthenticated && (user as any)?.role === 'admin',
  });

  // Fetch user policies
  const { data: policies = [], refetch: refetchPolicies } = useQuery({
    queryKey: ['/api/user-policies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user-policies');
      return response.json();
    },
    enabled: isAuthenticated && (user as any)?.role === 'admin',
  });

  // Update policy mutation
  const updatePolicyMutation = useMutation({
    mutationFn: async ({ departmentId, tabName, isEnabled }: { departmentId: number; tabName: string; isEnabled: boolean }) => {
      const response = await apiRequest('POST', '/api/user-policies', {
        departmentId,
        tabName,
        isEnabled
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Policy updated successfully" });
      refetchPolicies();
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: "Failed to update policy", variant: "destructive" });
    },
  });

  const handlePolicyChange = (departmentId: number, tabName: string, isEnabled: boolean) => {
    updatePolicyMutation.mutate({ departmentId, tabName, isEnabled });
  };

  const getPolicyStatus = (departmentId: number, tabName: string): boolean => {
    const policy = policies.find((p: UserPolicy) => p.departmentId === departmentId && p.tabName === tabName);
    return policy?.isEnabled ?? true; // Default to enabled if no policy exists
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
            <Shield className="h-8 w-8 text-primary" />
            User Policies
          </h1>
          <p className="text-slate-600 mt-1">
            Configure which tabs are visible to each department's users and managers
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Departments</p>
                <p className="text-2xl font-bold text-slate-900">{departments.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Available Tabs</p>
                <p className="text-2xl font-bold text-slate-900">{AVAILABLE_TABS.length}</p>
              </div>
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Policies</p>
                <p className="text-2xl font-bold text-slate-900">
                  {policies.filter((p: UserPolicy) => p.isEnabled).length}
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Department Tab Permissions
          </CardTitle>
          <p className="text-sm text-slate-600">
            Enable or disable specific tabs for each department. Users and managers in each department will only see enabled tabs.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Department</TableHead>
                  {AVAILABLE_TABS.map((tab) => (
                    <TableHead key={tab.name} className="text-center min-w-32">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">{tab.label}</span>
                        <span className="text-xs text-slate-500 text-center">{tab.description}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department: Department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {department.name}
                      </div>
                    </TableCell>
                    {AVAILABLE_TABS.map((tab) => {
                      const isEnabled = getPolicyStatus(department.id, tab.name);
                      return (
                        <TableCell key={tab.name} className="text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => 
                                handlePolicyChange(department.id, tab.name, checked)
                              }
                              disabled={updatePolicyMutation.isPending}
                              data-testid={`switch-${department.id}-${tab.name}`}
                            />
                            <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
                              {isEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {departments.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p>No departments found. Create departments first to manage policies.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How User Policies Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-slate-600 space-y-2">
            <p>• <strong>Enabled tabs</strong> will appear in the navigation for users and managers in that department</p>
            <p>• <strong>Disabled tabs</strong> will be hidden from the navigation for that department</p>
            <p>• <strong>Admin users</strong> always see all tabs regardless of these policies</p>
            <p>• Changes take effect immediately for all logged-in users</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}