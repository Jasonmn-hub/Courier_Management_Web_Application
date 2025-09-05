import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SamlSettings {
  entityId: string;
  ssoUrl: string;
  certificateContent: string;
  enabled: boolean;
}

export default function SamlSSO() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
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

  // Redirect to home if not authenticated or not admin
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

  if (isLoading || !isAuthenticated || (user as any)?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (samlLoading) {
    return (
      <main className="flex-1 relative overflow-y-auto focus:outline-none">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <div className="text-center py-8">Loading SAML settings...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900">SAML SSO Configuration</h1>
            <p className="mt-2 text-sm text-slate-700">
              Configure SAML Single Sign-On for Skillmine Integration
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
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
                      type="text"
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
                  <Textarea
                    id="saml-certificate"
                    placeholder="-----BEGIN CERTIFICATE-----
MIICXjCCAcegAwIBAgIBADALBgkqhkiG9w0BAQ0FADCBkjELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRYwFAYDVQQHDA1Nb3VudGFpbiBWaWV3...
-----END CERTIFICATE-----"
                    value={samlData.certificateContent}
                    onChange={(e) => setSamlData(prev => ({ ...prev, certificateContent: e.target.value }))}
                    className="font-mono text-sm min-h-[200px]"
                    data-testid="textarea-saml-certificate"
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Paste the X.509 certificate from Skillmine (including BEGIN/END lines)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="saml-enabled"
                    checked={samlData.enabled}
                    onCheckedChange={(checked) => setSamlData(prev => ({ ...prev, enabled: checked as boolean }))}
                    data-testid="checkbox-saml-enabled"
                  />
                  <Label htmlFor="saml-enabled">Enable SAML SSO</Label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-slate-900 mb-2">Configuration Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                  <li>Contact Skillmine support to set up SSO integration</li>
                  <li>Provide them with your Entity ID and redirect URLs</li>
                  <li>Obtain the SSO URL and X.509 certificate from Skillmine</li>
                  <li>Configure the settings above and enable SSO</li>
                  <li>Test the integration with a user account</li>
                </ol>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => saveSamlMutation.mutate(samlData)}
                  disabled={saveSamlMutation.isPending}
                  data-testid="button-save-saml-config"
                >
                  {saveSamlMutation.isPending ? "Saving..." : "Save Configuration"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSamlData({
                    entityId: samlSettings?.entityId || "",
                    ssoUrl: samlSettings?.ssoUrl || "",
                    certificateContent: samlSettings?.certificateContent || "",
                    enabled: samlSettings?.enabled || false
                  })}
                  data-testid="button-reset-saml-config"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}