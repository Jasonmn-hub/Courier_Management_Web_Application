import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { toast } = useToast();

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsEmailSent(true);
        toast({
          title: "Reset Code Sent",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send reset code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {isEmailSent ? "Check Your Email" : "Forgot Password?"}
            </CardTitle>
            <p className="text-slate-600 text-sm mt-2">
              {isEmailSent 
                ? "We've sent a 6-digit reset code to your email address"
                : "Enter your email address and we'll send you a reset code"
              }
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isEmailSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleForgotPassword();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? "Sending..." : "Send Reset Code"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center text-sm text-slate-600">
                  <p>We sent a reset code to:</p>
                  <p className="font-medium text-slate-900">{email}</p>
                </div>
                <Link href="/reset-password" className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Enter Reset Code
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEmailSent(false);
                    setEmail("");
                  }}
                  className="w-full"
                >
                  Use Different Email
                </Button>
              </div>
            )}
            
            <div className="text-center">
              <Link href="/login" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}