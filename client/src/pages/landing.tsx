import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Truck, Package, Users, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ name: "", email: "", password: "" });
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const { login, register, isLoginLoading, isRegisterLoading } = useAuth();
  const { toast } = useToast();

  const handleLogin = async () => {
    try {
      await login(loginData);
      toast({ title: "Success", description: "Logged in successfully!" });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Login failed",
        variant: "destructive" 
      });
    }
  };

  const handleRegister = async () => {
    try {
      await register(registerData);
      toast({ title: "Success", description: "Account created successfully!" });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Registration failed",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-primary" />
              <h1 className="ml-3 text-2xl font-bold text-slate-900">CourierTrack</h1>
            </div>
            <Dialog open={showLogin} onOpenChange={setShowLogin}>
              <DialogTrigger asChild>
                <Button data-testid="button-login">
                  Sign In
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {isRegisterMode ? "Create Account" : "Sign In"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {isRegisterMode && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        type="text"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                        placeholder="Enter your name"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={isRegisterMode ? registerData.email : loginData.email}
                      onChange={(e) => {
                        if (isRegisterMode) {
                          setRegisterData({ ...registerData, email: e.target.value });
                        } else {
                          setLoginData({ ...loginData, email: e.target.value });
                        }
                      }}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={isRegisterMode ? registerData.password : loginData.password}
                      onChange={(e) => {
                        if (isRegisterMode) {
                          setRegisterData({ ...registerData, password: e.target.value });
                        } else {
                          setLoginData({ ...loginData, password: e.target.value });
                        }
                      }}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={isRegisterMode ? handleRegister : handleLogin}
                      disabled={isLoginLoading || isRegisterLoading}
                      className="w-full"
                    >
                      {(isLoginLoading || isRegisterLoading) 
                        ? "Please wait..." 
                        : (isRegisterMode ? "Create Account" : "Sign In")
                      }
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsRegisterMode(!isRegisterMode)}
                      className="w-full"
                    >
                      {isRegisterMode ? "Already have an account? Sign In" : "Don't have an account? Register"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Professional Courier Management System
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Streamline your courier operations with powerful tracking, role-based access control, 
            and comprehensive analytics. Built for teams that need reliable delivery management.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Dialog open={showLogin} onOpenChange={setShowLogin}>
              <DialogTrigger asChild>
                <Button size="lg" data-testid="button-get-started">
                  Get Started
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="text-center">
              <Package className="h-12 w-12 text-primary mx-auto" />
              <CardTitle className="text-lg">Courier Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 text-center">
                Complete lifecycle management from dispatch to delivery with real-time status updates.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-primary mx-auto" />
              <CardTitle className="text-lg">Role-Based Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 text-center">
                Admin, Manager, and User roles with granular permissions for secure operations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <BarChart3 className="h-12 w-12 text-primary mx-auto" />
              <CardTitle className="text-lg">Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 text-center">
                Comprehensive insights with charts and statistics to optimize your operations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Truck className="h-12 w-12 text-primary mx-auto" />
              <CardTitle className="text-lg">Multi-Vendor Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 text-center">
                Support for multiple courier vendors with standardized tracking and reporting.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Ready to transform your courier management?
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Join teams that trust CourierTrack for their delivery operations.
          </p>
          <div className="mt-10">
            <Dialog open={showLogin} onOpenChange={setShowLogin}>
              <DialogTrigger asChild>
                <Button size="lg" data-testid="button-start-now">
                  Start Now
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-slate-500">
            <p>&copy; 2024 CourierTrack. Professional courier management solution.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
