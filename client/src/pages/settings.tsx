import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
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

  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
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
          <Tabs defaultValue="smtp" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="smtp" data-testid="tab-smtp-settings">SMTP Settings</TabsTrigger>
              <TabsTrigger value="fields" data-testid="tab-fields">Fields</TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit-logs">Audit Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="smtp" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>SMTP Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-500">SMTP settings configuration will be implemented here</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="fields" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-500">Custom fields management will be implemented here</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="audit" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-500">Audit logs viewer will be implemented here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
